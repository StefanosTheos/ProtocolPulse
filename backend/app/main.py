from contextlib import asynccontextmanager
import logging
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException

from backend.app.api.routes import router
from backend.app.core.config import get_settings
from backend.app.core.errors import DomainError
from backend.app.db.session import make_engine, session_factory
from backend.app.db.version import HEAD
from backend.app.services.jobs import JobRunner


def create_app(settings=None, factory=None, start_worker=True):
    logging.basicConfig(level=logging.WARNING)
    logging.getLogger('ai').setLevel(logging.INFO)
    settings = settings or get_settings()
    if not settings.synthetic_data_only:
        raise ValueError("ProtocolPulse demo requires SYNTHETIC_DATA_ONLY=true")
    factory = factory or session_factory(make_engine(settings.database_url))
    runner = JobRunner(factory, settings)

    @asynccontextmanager
    async def lifespan(app):
        # Readiness is checked, never repaired by schema creation or seeding.
        from sqlalchemy import text

        try:
            with factory() as session:
                migrated = session.scalar(text("SELECT version_num FROM alembic_version")) == HEAD
        except SQLAlchemyError:
            migrated = False
        if migrated and start_worker:
            runner.start()
            import asyncio

            await asyncio.sleep(0)
        yield
        await runner.stop()

    app = FastAPI(title="ProtocolPulse", version="1.0.0-rc2", lifespan=lifespan)
    app.state.settings, app.state.factory, app.state.runner = settings, factory, runner
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_methods=["GET", "POST", "PUT", "PATCH"],
        allow_headers=["Content-Type", "X-Demo-Actor-Id", "X-Request-ID", "Idempotency-Key", "If-Match"],
        expose_headers=["X-Request-ID"],
    )

    def error(request, code, message, status, details=(), retryable=False):
        rid = getattr(request.state, "request_id", str(uuid4()))
        return JSONResponse(
            status_code=status,
            content=dict(
                error=dict(code=code, message=message, details=list(details), retryable=retryable),
                request_id=rid,
            ),
            headers={"X-Request-ID": rid},
        )

    @app.middleware("http")
    async def correlation(request, call_next):
        supplied = request.headers.get("x-request-id")
        try:
            request.state.request_id = str(UUID(supplied)) if supplied else str(uuid4())
        except ValueError:
            return error(request, "VALIDATION_ERROR", "X-Request-ID must be a UUID", 422)
        if request.method == "GET" and request.url.path.startswith("/api/v1"):
            # Reject misspelled/uncontracted filters rather than silently ignoring them.
            route = next(
                (
                    r
                    for r in app.routes
                    if getattr(r, "methods", None)
                    and request.method in r.methods
                    and r.path_regex.fullmatch(request.url.path)
                ),
                None,
            )
            if route:
                allowed = {p.alias for p in route.dependant.query_params}
                if set(request.query_params) - allowed:
                    return error(request, "VALIDATION_ERROR", "Unknown query parameter", 422)
        try:
            response = await call_next(request)
        except Exception:
            return error(request, "INTERNAL_ERROR", "Unexpected operational failure", 500)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(DomainError)
    async def domain_error(request, exc):
        return error(request, exc.code, exc.message, exc.status, exc.details, exc.retryable)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error(
            request,
            "VALIDATION_ERROR",
            "Request validation failed",
            422,
            [dict(field=".".join(str(p) for p in e["loc"]), reason=e["msg"]) for e in exc.errors()],
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return error(
            request, "REVISION_CONFLICT", "Database uniqueness or reference guard rejected operation", 409
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        return error(request, "PERSISTENCE_FAILED", "Database operation failed", 500, retryable=True)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(
            request,
            "NOT_FOUND" if exc.status_code == 404 else "BAD_REQUEST",
            "Request not supported",
            exc.status_code,
        )

    app.include_router(router)
    from fastapi.openapi.utils import get_openapi

    from backend.app.schemas.common import ErrorEnvelope

    def openapi():
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        errors = ErrorEnvelope.model_json_schema(ref_template="#/components/schemas/{model}")
        definitions = errors.pop("$defs", {})
        schema["components"]["schemas"].update(definitions)
        schema["components"]["schemas"]["ErrorEnvelope"] = errors
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                if method not in ("get", "post", "put", "patch"):
                    continue
                params = operation.setdefault("parameters", [])
                for param in params:
                    if param["name"] == "x-demo-actor-id":
                        param["required"] = True
                        param["schema"] = {"type": "string"}
                params.append(
                    {
                        "in": "header",
                        "name": "X-Request-ID",
                        "required": False,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                )
                for header, required in [
                    ("Idempotency-Key", method == "post"),
                    ("If-Match", method in ("put", "patch") or path.endswith("/approve")),
                ]:
                    if required:
                        params.append(
                            {"in": "header", "name": header, "required": True, "schema": {"type": "string"}}
                        )
                for status in (400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503):
                    operation["responses"][str(status)] = {
                        "description": "Structured operational error",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}
                        },
                    }
                if path.endswith("/health"):
                    operation["responses"]["503"] = {
                        "description": "Degraded readiness",
                        "content": {
                            "application/json": {"schema": {"$ref": "#/components/schemas/Envelope_Health_"}}
                        },
                    }
        app.openapi_schema = schema
        return schema

    app.openapi = openapi
    return app


app = create_app()
