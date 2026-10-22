import { inflateRawSync } from 'zlib';

const MAX_ENTRY = 15 * 1024 * 1024;

export type ZipEntry = { name: string; data?: Buffer; error?: string };

function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

export function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const used = new Map<string, number>();
  for (const file of files) {
    const name = uniqueZipName(file.name, used);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, file.data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + file.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** 读取中央目录。只接受存储和 deflate，单文件解压不超过 15MB。结构损坏时抛出错误。 */
export function unzip(buf: Buffer): ZipEntry[] {
  if (buf.length < 22) throw new Error('不是有效的 zip');
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('不是有效的 zip');
  const total = buf.readUInt16LE(eocd + 10);
  const centralSize = buf.readUInt32LE(eocd + 12);
  const centralOff = buf.readUInt32LE(eocd + 16);
  if (centralOff === 0xffffffff || centralSize === 0xffffffff) throw new Error('不支持超大压缩包');
  if (centralOff + centralSize > buf.length) throw new Error('不是有效的 zip');
  const entries: ZipEntry[] = [];
  let pos = centralOff;
  const end = centralOff + centralSize;
  let images = 0;
  for (let i = 0; i < total; i += 1) {
    if (pos + 46 > end || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('不是有效的 zip');
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const crc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    if (pos + 46 + nameLen > buf.length) throw new Error('不是有效的 zip');
    const rawName = decodeZipName(buf.subarray(pos + 46, pos + 46 + nameLen), flags);
    pos += 46 + nameLen + extraLen + commentLen;
    if (skipZipEntry(rawName)) continue;
    const name = rawName.replace(/\\/g, '/').split('/').pop() || rawName;
    if (flags & 1) {
      entries.push({ name, error: '压缩包里的文件已加密' });
      continue;
    }
    if (compSize === 0xffffffff || uncompSize === 0xffffffff || localOff === 0xffffffff) {
      entries.push({ name, error: '不支持超大压缩包' });
      continue;
    }
    const image = /\.(png|jpe?g|webp)$/i.test(name);
    if (image) {
      images += 1;
      if (images > 100) {
        entries.push({ name, error: '一次最多 100 张' });
        continue;
      }
    }
    if (uncompSize > MAX_ENTRY || compSize > MAX_ENTRY) {
      entries.push({ name, error: '单张不能超过 15MB' });
      continue;
    }
    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) {
      entries.push({ name, error: '这张图解压失败' });
      continue;
    }
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > buf.length) {
      entries.push({ name, error: '这张图解压失败' });
      continue;
    }
    if (method !== 0 && method !== 8) {
      entries.push({ name, error: '压缩方式不支持' });
      continue;
    }
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    let data: Buffer;
    try {
      data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY });
    } catch {
      entries.push({ name, error: '这张图解压失败' });
      continue;
    }
    if (data.length > MAX_ENTRY || crc32(data) !== crc) {
      entries.push({ name, error: data.length > MAX_ENTRY ? '单张不能超过 15MB' : '这张图解压失败' });
      continue;
    }
    entries.push({ name, data });
  }
  return entries;
}

function findEocd(buf: Buffer) {
  const min = Math.max(0, buf.length - (22 + 65535));
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) !== 0x06054b50) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen === buf.length) return i;
  }
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function decodeZipName(name: Buffer, flags: number) {
  if (flags & 0x800) return name.toString('utf8');
  const utf8 = name.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return name.toString('latin1');
}

function skipZipEntry(name: string) {
  const norm = name.replace(/\\/g, '/');
  if (!norm || norm.endsWith('/')) return true;
  const parts = norm.split('/').filter(Boolean);
  if (!parts.length) return true;
  if (parts.some((part) => part === '__MACOSX' || part.startsWith('.'))) return true;
  return false;
}

function uniqueZipName(name: string, used: Map<string, number>) {
  const base = name.split(/[/\\]/).pop()?.replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_') || 'shot.png';
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  if (!count) return base;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return `${base}-${count + 1}`;
  return `${base.slice(0, dot)}-${count + 1}${base.slice(dot)}`;
}
