import type { ApiRequest, ApiResponse, Transport } from './client';

function buildUrl(baseUrl: string, req: ApiRequest): string {
  const url = new URL(baseUrl.replace(/\/+$/, '') + req.path);
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parseJson(text: string): Promise<unknown> {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// fetch has no upload progress, so multipart uploads use XMLHttpRequest.
function xhrUpload(url: string, req: ApiRequest): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(req.method, url);
    for (const [k, v] of Object.entries(req.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) req.onUploadProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.onload = async () => {
      resolve({
        status: xhr.status,
        requestIdHeader: xhr.getResponseHeader('X-Request-ID'),
        body: await parseJson(xhr.responseText),
      });
    };
    xhr.send(req.body as FormData);
  });
}

export function createLiveTransport(baseUrl: string): Transport {
  return async (req) => {
    const url = buildUrl(baseUrl, req);
    if (req.body instanceof FormData) return xhrUpload(url, req);
    const headers: Record<string, string> = { Accept: 'application/json', ...req.headers };
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      cache: 'no-store',
    });
    return {
      status: res.status,
      requestIdHeader: res.headers.get('X-Request-ID'),
      body: await parseJson(await res.text()),
    };
  };
}
