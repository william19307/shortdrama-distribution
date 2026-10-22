export type FolderKind = 'EPISODE' | 'COVER' | 'POSTER' | 'TRAILER' | 'SUBTITLE' | 'OTHER';

export interface FolderDrama {
  title: string;
  episodes: { no: number; path: string; fileName: string }[];
  cover?: string;
  poster?: string;
  trailer?: string;
  subtitles: string[];
  conflicts: string[];
  extras: string[];
}

const EPISODE_NAME = [/^第\s*0*(\d+)\s*集$/i, /^ep\s*0*(\d+)$/i, /^e\s*0*(\d+)$/i, /^0*(\d+)$/];

export function episodeNoFromName(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, '').trim();
  for (const pattern of EPISODE_NAME) {
    const hit = base.match(pattern);
    if (!hit) continue;
    const no = Number(hit[1]);
    if (no >= 1 && no <= 999) return no;
  }
  return null;
}

export function folderKind(filename: string): FolderKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.srt')) return 'SUBTITLE';
  const base = lower.replace(/\.[^.]+$/, '');
  if (base === 'cover') return 'COVER';
  if (base === 'poster') return 'POSTER';
  if (base === 'trailer') return 'TRAILER';
  if (episodeNoFromName(filename) && /\.(mp4|mov|m4v)$/i.test(filename)) return 'EPISODE';
  return 'OTHER';
}

/** 按「剧名/集文件」识别文件夹。集号支持第001集、EP01、01。 */
export function recognizeFolder(paths: string[]): FolderDrama[] {
  const groups = new Map<string, FolderDrama>();
  for (const raw of paths) {
    const parts = raw.split(/[/\\]/).filter((part) => part && part !== '.');
    if (parts.length < 2) continue;
    const title = parts[0];
    const fileName = parts[parts.length - 1];
    const group = groups.get(title) ?? { title, episodes: [], subtitles: [], conflicts: [], extras: [] };
    const kind = folderKind(fileName);
    if (kind === 'EPISODE') {
      const no = episodeNoFromName(fileName)!;
      const prev = group.episodes.find((item) => item.no === no);
      if (prev) group.conflicts.push(`第 ${no} 集重复：${prev.fileName} 与 ${fileName}`);
      else group.episodes.push({ no, path: raw, fileName });
    } else if (kind === 'COVER') group.cover = raw;
    else if (kind === 'POSTER') group.poster = raw;
    else if (kind === 'TRAILER') group.trailer = raw;
    else if (kind === 'SUBTITLE') group.subtitles.push(raw);
    else group.extras.push(raw);
    groups.set(title, group);
  }
  return [...groups.values()].map((group) => ({ ...group, episodes: group.episodes.sort((a, b) => a.no - b.no) }));
}
