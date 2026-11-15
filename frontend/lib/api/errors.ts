// Plain-language explanations for API errors. The raw code, status and request ID stay available
// for support (shown under "Technical details"); people see what went wrong and what to do next.
import { ApiError } from './client';

export interface FriendlyError {
  title: string;
  message: string;
  /** Raw details for support staff; never the main text. */
  technical: string;
  requestId: string | null;
  fieldMessages: string[];
}

const FIELD_LABEL: Record<string, string> = {
  file: 'File',
  version_label: 'Version label',
  rationale: 'Reason',
  decision_reason: 'Decision reason',
  disposition: 'Disposition',
  next_status: 'Status',
  external_record_reference: 'External record reference',
  external_record_source_id: 'Source record',
};

const REASON_TEXT: Record<string, string> = {
  missing: 'is required',
  duplicate: 'is already used. Choose a different one',
  invalid: 'is not valid',
  too_long: 'is too long',
};

function fieldMessage(field: string, reason: string): string {
  const label = FIELD_LABEL[field] ?? field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return `${label} ${REASON_TEXT[reason] ?? reason.replace(/_/g, ' ')}.`;
}

const BY_CODE: Record<string, (e: ApiError) => { title: string; message: string }> = {
  NETWORK_ERROR: () => ({ title: 'Can’t reach the server', message: 'Check your connection and that the service is running, then try again.' }),
  CANCELLED: () => ({ title: 'Cancelled', message: 'Nothing was changed.' }),
  PDF_TOO_LARGE: () => ({ title: 'File is too large', message: 'Protocol files can be up to 12 MB. Choose a smaller file, or compress the PDF and try again.' }),
  UNSUPPORTED_MEDIA_TYPE: () => ({ title: 'This file isn’t a readable PDF', message: 'The file is damaged or not really a PDF. Export it again as PDF and choose it again.' }),
  VALIDATION_ERROR: (e) => {
    if (e.details.some((d) => d.field === 'version_label' && d.reason === 'duplicate')) {
      return { title: 'That version label is already used', message: 'Each upload needs a new version label, for example 1.2. Change the label and upload again.' };
    }
    return { title: 'Some details need fixing', message: 'Check the highlighted fields and try again.' };
  },
  TRIAL_NOT_FOUND: () => ({ title: 'Study not found', message: 'This study doesn’t exist or was removed. Go back to the list of studies.' }),
  PATIENT_NOT_FOUND: () => ({ title: 'Patient not found', message: 'This patient isn’t part of this study. Go back to the candidate list.' }),
  CASE_NOT_FOUND: () => ({ title: 'Case not found', message: 'This case doesn’t exist. Go back to Safety to see the current cases.' }),
  VERSION_NOT_FOUND: () => ({ title: 'Protocol version not found', message: 'Choose another version from the list.' }),
  SOURCE_NOT_FOUND: () => ({ title: 'Source record not found', message: 'Choose a registered source record and try again.' }),
  JOB_NOT_FOUND: () => ({ title: 'Background task not found', message: 'Start the step again.' }),
  REVISION_CONFLICT: () => ({ title: 'Someone else changed this first', message: 'Reload to see the latest version, then make your change again.' }),
  EVENT_VERSION_CONFLICT: () => ({ title: 'This record changed in the meantime', message: 'Reload and try again.' }),
  IDEMPOTENCY_CONFLICT: () => ({ title: 'This request was already sent with different details', message: 'Reload the page and try again.' }),
  JOB_ALREADY_RUNNING: () => ({ title: 'Already running', message: 'Wait for the current run to finish.' }),
  VERSION_ALREADY_ACTIVE: () => ({ title: 'Already approved', message: 'This protocol version is already in use.' }),
  PROTOCOL_NOT_ACTIVE: () => ({ title: 'No approved protocol', message: 'An investigator must approve the protocol rules before this step.' }),
  APPROVAL_BLOCKED: () => ({ title: 'Approval is blocked', message: 'Some protocol sections still need review. Resolve them, then approve again.' }),
  INVALID_TRANSITION: () => ({ title: 'That change isn’t allowed now', message: 'The case is in a different state. Reload to see its current status.' }),
  INVALID_TIME_INTERVAL: () => ({ title: 'Dates don’t make sense', message: 'Check that the start date is before the end date.' }),
  ROLE_FORBIDDEN: () => ({ title: 'Not available for your role', message: 'Switch to a role that works on this to continue.' }),
  ACTOR_REQUIRED: () => ({ title: 'Choose a role', message: 'Pick a role in "Viewing as" at the top of the page.' }),
  ACTOR_UNKNOWN: () => ({ title: 'Unknown role', message: 'Pick a role in "Viewing as" at the top of the page.' }),
  AGENT_UNAVAILABLE: () => ({ title: 'Automated summary is unavailable', message: 'You can review and decide without it.' }),
};

export function friendlyError(err: unknown): FriendlyError {
  if (err instanceof ApiError) {
    const known = BY_CODE[err.code]?.(err);
    const generic = err.status >= 500
      ? { title: 'Something went wrong on the server', message: 'Try again in a moment. If it keeps happening, contact support with the details below.' }
      : err.status === 404
        ? { title: 'Not found', message: 'It may have been removed. Go back and choose it again.' }
        : err.status === 403
          ? BY_CODE.ROLE_FORBIDDEN(err)
          : { title: 'That didn’t work', message: 'Try again. If it keeps happening, contact support with the details below.' };
    const { title, message } = known ?? generic;
    return {
      title, message,
      technical: `${err.code}${err.status ? ` (HTTP ${err.status})` : ''} · ${err.message}`,
      requestId: err.requestId,
      fieldMessages: err.details.map((d) => fieldMessage(d.field, d.reason)),
    };
  }
  const raw = err instanceof Error ? err.message : String(err);
  return { title: 'Something went wrong', message: 'Try again. If it keeps happening, reload the page.', technical: raw, requestId: null, fieldMessages: [] };
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
