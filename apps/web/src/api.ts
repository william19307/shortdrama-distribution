export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const TOKEN = 'shortform.token';

export function getToken() {
  return localStorage.getItem(TOKEN);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN, token);
  else localStorage.removeItem(TOKEN);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`/api${path}`, { ...init, headers, body });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : '请求没有完成';
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      setToken(null);
      if (!location.pathname.startsWith('/login')) location.assign('/login');
    }
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, '导出失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function qs(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

interface UploadSession {
  id: string;
  key: string;
  mode: 'single' | 'multipart';
  viaApi?: boolean;
  url?: string;
  headers?: Record<string, string>;
  partSize?: number;
  partCount?: number;
  completedParts?: { partNumber: number; etag?: string }[];
}

function putBlob(url: string, body: Blob, headers: Headers, onProgress?: (loaded: number, total: number) => void) {
  return new Promise<{ status: number; etag: string; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, etag: xhr.getResponseHeader('ETag') || '', text: xhr.responseText || '' });
    xhr.onerror = () => reject(new ApiError(0, '网络中断，可以重试'));
    xhr.send(body);
  });
}

/** 小文件一次 PUT；超过 8MB 且对象存储为 S3 时按分片上传。失败后用同一文件再调一次即可续传已确认的分片。 */
export async function uploadFile(
  file: File,
  purpose: string,
  extra: { dramaId?: string; episodeNo?: number; companyId?: string } = {},
  options: { onProgress?: (ratio: number) => void } = {},
) {
  const session = await api<UploadSession>('/storage/uploads', {
    method: 'POST',
    json: {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      purpose,
      ...extra,
    },
  });
  const report = (loaded: number) => options.onProgress?.(file.size ? Math.min(1, loaded / file.size) : 1);
  if (session.mode === 'single') {
    const headers = new Headers(session.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', file.type || 'application/octet-stream');
    const token = getToken();
    if (session.url?.startsWith('/api') && token) headers.set('Authorization', `Bearer ${token}`);
    const put = await putBlob(session.url || '', file, headers, (loaded) => report(loaded));
    if (put.status < 200 || put.status >= 300) throw new ApiError(put.status, '文件没有传到存储，可以重试');
  } else {
    const partSize = session.partSize || 8 * 1024 * 1024;
    const partCount = session.partCount || Math.ceil(file.size / partSize);
    const done = new Set((session.completedParts || []).map((part) => part.partNumber));
    let loaded = [...done].reduce((sum, partNumber) => sum + Math.min(partSize, Math.max(0, file.size - (partNumber - 1) * partSize)), 0);
    report(loaded);
    for (let index = 0; index < partCount; index += 1) {
      const partNumber = index + 1;
      const blob = file.slice(index * partSize, Math.min(file.size, partNumber * partSize));
      if (done.has(partNumber)) continue;
      const headers = new Headers();
      headers.set('Content-Type', 'application/octet-stream');
      const token = getToken();
      let url = '';
      if (session.viaApi) {
        if (token) headers.set('Authorization', `Bearer ${token}`);
        url = `/api/storage/uploads/${session.id}/parts/${partNumber}`;
      } else {
        const signed = await api<{ url: string }>(`/storage/uploads/${session.id}/parts`, { method: 'POST', json: { partNumber } });
        url = signed.url;
      }
      const put = await putBlob(url, blob, headers, (partLoaded) => report(loaded + partLoaded));
      if (put.status < 200 || put.status >= 300) throw new ApiError(put.status || 0, `第 ${partNumber} 片上传失败，可以重试`);
      if (!session.viaApi) {
        const etag = put.etag || `"part-${partNumber}"`;
        await api(`/storage/uploads/${session.id}/parts/ack`, { method: 'POST', json: { partNumber, etag } });
      }
      loaded += blob.size;
      report(loaded);
    }
  }
  report(file.size);
  return api<{ id: string; key: string; status: string }>(`/storage/uploads/${session.id}/complete`, { method: 'POST', json: {} });
}
