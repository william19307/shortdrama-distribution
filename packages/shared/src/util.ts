/** 剧名归一化：去空白与标点、全半角、大小写。用于搜索与防重。 */
export function normalizeName(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function shanghaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 平台数据日 = 上海今日减去口径（T-1 或 T-2）。 */
export function expectedStatDate(lag: 'T1' | 'T2', now = new Date()): string {
  return addDays(shanghaiToday(now), lag === 'T2' ? -2 : -1);
}

export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  return d;
}

export function formatCnDate(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate + (isoOrDate.length === 10 ? 'T00:00:00+08:00' : '')) : isoOrDate;
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' }).format(date);
}

/**
 * 抽检：≤8 集全审；否则前 3 + 后 2 + 中间均匀抽取至少 10% 且总数不少于 8。
 * 确定性选取，便于复核。
 */
export function sampleEpisodeNos(nos: number[]): { sampled: number[]; exempt: number[] } {
  const sorted = [...new Set(nos)].sort((a, b) => a - b);
  if (sorted.length <= 8) return { sampled: sorted, exempt: [] };
  const picked = new Set<number>();
  sorted.slice(0, 3).forEach((n) => picked.add(n));
  sorted.slice(-2).forEach((n) => picked.add(n));
  const middle = sorted.slice(3, -2);
  const extra = Math.max(1, Math.ceil(sorted.length * 0.1));
  for (let i = 0; i < extra && middle.length; i += 1) {
    picked.add(middle[Math.min(middle.length - 1, Math.floor((i * middle.length) / extra))]);
  }
  for (const n of middle) {
    if (picked.size >= 8) break;
    picked.add(n);
  }
  const sampled = sorted.filter((n) => picked.has(n));
  const exempt = sorted.filter((n) => !picked.has(n));
  return { sampled, exempt };
}

/** 文件名：平台代码_剧ID或剧名_YYYYMMDD_类型_序号.png */
export function parseWatermarkFilename(filename: string): {
  platformCode?: string;
  dramaToken?: string;
  date?: string;
  kind?: 'LISTING' | 'DATA' | 'DELIST';
} | null {
  const base = filename.replace(/\.[^.]+$/, '');
  const parts = base.split('_');
  if (parts.length < 4) return null;
  const [platformCode, dramaToken, ymd, kindRaw] = parts;
  if (!/^\d{8}$/.test(ymd)) return null;
  const kindMap: Record<string, 'LISTING' | 'DATA' | 'DELIST'> = {
    上架: 'LISTING',
    LISTING: 'LISTING',
    数据: 'DATA',
    DATA: 'DATA',
    下架: 'DELIST',
    DELIST: 'DELIST',
  };
  const kind = kindMap[kindRaw.toUpperCase()] || kindMap[kindRaw];
  if (!kind) return null;
  return {
    platformCode,
    dramaToken,
    date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    kind,
  };
}

export const DAILY_FIELD_DOCS: { key: string; zh: string; required: boolean }[] = [
  { key: 'recordId', zh: '记录号（平台+日期+剧+语言）', required: true },
  { key: 'statDate', zh: '数据所属日期', required: true },
  { key: 'statTimezone', zh: '统计时区', required: true },
  { key: 'platform', zh: '平台', required: true },
  { key: 'contractCode', zh: '合同编号', required: false },
  { key: 'dramaId', zh: '我方剧目', required: true },
  { key: 'platformDramaId', zh: '平台剧目 ID', required: false },
  { key: 'titleLocal', zh: '平台上线标题', required: true },
  { key: 'language', zh: '语种', required: true },
  { key: 'territory', zh: '国家/地区', required: false },
  { key: 'episodesOnline', zh: '已上线集数', required: true },
  { key: 'views', zh: '播放量', required: true },
  { key: 'viewMetricDef', zh: '播放量口径', required: true },
  { key: 'uniqueViewers', zh: '去重观看人数', required: false },
  { key: 'paidUnlocks', zh: '付费解锁集次', required: false },
  { key: 'grossRevenue', zh: '毛收入', required: false },
  { key: 'netRevenue', zh: '可分账净收入', required: false },
  { key: 'currency', zh: '币种', required: true },
  { key: 'shareRate', zh: '合同分成比例', required: false },
  { key: 'mgAmount', zh: '保底金额（客户不可见）', required: false },
  { key: 'mgRecouped', zh: '累计已抵扣保底（客户不可见）', required: false },
  { key: 'revenueShareDue', zh: '公式应分（客户不可见，不参与结算计算）', required: false },
  { key: 'dealType', zh: '合作类型', required: true },
  { key: 'dataSource', zh: '数据来源', required: true },
  { key: 'evidenceFiles', zh: '截图路径', required: false },
  { key: 'evidenceSha256', zh: '截图哈希', required: true },
  { key: 'enteredBy', zh: '录入人', required: true },
  { key: 'enteredAt', zh: '录入时间', required: true },
  { key: 'reviewedBy', zh: '复核人', required: false },
  { key: 'reviewedAt', zh: '复核时间', required: false },
  { key: 'status', zh: '状态', required: true },
  { key: 'anomalyNote', zh: '异常说明', required: false },
];

export const PART_SIZE = 8 * 1024 * 1024;
export const SINGLE_PUT_MAX = 8 * 1024 * 1024;
/** 达到这个大小，或整夹上传时，引导走分片续传。 */
export const MULTIPART_GUIDE_BYTES = 500 * 1024 * 1024;
