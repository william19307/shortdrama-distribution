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
  url?: string;
  headers?: Record<string, string>;
  partSize?: number;
  partCount?: number;
}

/** 小文件一次 PUT；超过 8MB 且对象存储为 S3 时按分片直传。确认后才写入剧集或附件。 */
export async function uploadFile(file: File, purpose: string, extra: { dramaId?: string; episodeNo?: number; companyId?: string } = {}) {
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
  if (session.mode === 'single') {
    const headers = new Headers(session.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', file.type || 'application/octet-stream');
    const token = getToken();
    if (session.url?.startsWith('/api') && token) headers.set('Authorization', `Bearer ${token}`);
    const put = await fetch(session.url || '', { method: 'PUT', body: file, headers });
    if (!put.ok) throw new ApiError(put.status, '文件没有传到存储');
  } else {
    const partSize = session.partSize || 8 * 1024 * 1024;
    const partCount = session.partCount || Math.ceil(file.size / partSize);
    for (let index = 0; index < partCount; index += 1) {
      const partNumber = index + 1;
      const blob = file.slice(index * partSize, Math.min(file.size, partNumber * partSize));
      const signed = await api<{ url: string }>(`/storage/uploads/${session.id}/parts`, { method: 'POST', json: { partNumber } });
      const put = await fetch(signed.url, { method: 'PUT', body: blob });
      if (!put.ok) throw new ApiError(put.status, `第 ${partNumber} 片上传失败`);
      const etag = put.headers.get('etag') || put.headers.get('ETag') || `"part-${partNumber}"`;
      await api(`/storage/uploads/${session.id}/parts/ack`, { method: 'POST', json: { partNumber, etag } });
    }
  }
  return api<{ id: string; key: string; status: string }>(`/storage/uploads/${session.id}/complete`, { method: 'POST', json: {} });
}
