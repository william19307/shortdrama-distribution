// v2 扩展数据（全部为示例 Sample，非真实作品/成绩）。替换品牌：改 BRAND 即可。
import { WORKS, PLATFORMS, type Work } from './works';
export const BRAND = { name: 'StarRiver Global', short: 'StarRiver', email: 'partners@starriver.example', sample: true };
export const GENRE_EN: Record<string, string> = { 霸总: 'Billionaire', 复仇: 'Revenge', 甜宠: 'Romance', 逆袭: 'Underdog', 悬疑: 'Thriller', 奇幻: 'Fantasy', 家庭: 'Family', 狼人: 'Werewolf' };
export const LANG_EN: Record<string, string> = { 英语: 'English', 西班牙语: 'Spanish', 葡萄牙语: 'Portuguese', 日语: 'Japanese', 印尼语: 'Indonesian', 泰语: 'Thai' };
const TAG_EN = ['One contract. One lie. One love.', 'She came back. They should run.', 'Born an outcast. Destined for the throne.', 'He married a nobody. Or did he?', 'Three years of silence. One day of reckoning.', 'Some patients never check out.', 'A thousand years asleep. Zero mercy.', 'Fifty, free, and finally first.', 'Happy birthday. You own the city.', 'Twenty years stolen. Taking it all back.', 'Genius kid. Missing dad. Mission on.', 'He laid down his sword. Not his oath.', 'One wedding. Twelve guests. One body.', 'Bound by blood. Tempted by forever.', 'He signed the papers. Then he lost her.', 'One bowl. Three generations.'];
const TAG_ZH = ['一纸契约，一场谎言，一段真心。', '她回来了，他们该逃了。', '生而被弃，命定为王。', '他娶了个普通人？未必。', '隐忍三年，清算一日。', '有些病人，永远不会出院。', '沉睡千年，绝不留情。', '五十岁，重新做自己。', '生日快乐，整座城归你。', '被偷走的二十年，全部拿回。', '天才萌宝，寻父行动。', '卸下战甲，不卸誓言。', '一场婚礼，一个失踪者。', '血契为约，永夜为诱。', '签下离婚协议，他才懂失去。', '一碗面，三代人。'];
const RATINGS = ['TV-14', 'TV-MA', 'TV-PG', 'TV-14'];
export type WorkV2 = Work & { genreEn: string; langEn: string; tagEn: string; tagZh: string; rated: string; layout: number; match: number };
export const WORKS_V2: WorkV2[] = WORKS.map((w, i) => ({ ...w, genreEn: GENRE_EN[w.genre], langEn: LANG_EN[w.lang], tagEn: TAG_EN[i], tagZh: TAG_ZH[i], rated: RATINGS[i % 4], layout: i % 4, match: 99 - ((i * 7) % 14) }));
export const TOP10 = [...WORKS_V2].sort((a, b) => b.views - a.views).slice(0, 10);
export const ROWS = [
  { key: 'trending', ids: WORKS_V2.filter(w => w.hot).concat(WORKS_V2.slice(8, 12)) },
  { key: 'power', ids: WORKS_V2.filter(w => ['霸总', '复仇', '逆袭'].includes(w.genre)) },
  { key: 'heart', ids: WORKS_V2.filter(w => ['甜宠', '狼人', '奇幻', '家庭', '悬疑'].includes(w.genre)) },
];
export { PLATFORMS };
export const STATS = [{ v: 1.2, suf: 'B+', dec: 1, k: 'views' }, { v: 42, suf: '', dec: 0, k: 'markets' }, { v: 16, suf: '', dec: 0, k: 'langs' }, { v: 99.8, suf: '%', dec: 1, k: 'ontime' }];
// 市场：[lon, lat, key]
export const MARKETS: [number, number, string][] = [[-98, 39, 'na'], [-46, -23, 'latam'], [-99, 19, 'mx'], [2, 48, 'eu'], [-3, 40, 'es'], [55, 25, 'me'], [106, -6, 'id'], [100, 13, 'th'], [139, 35, 'jp'], [127, 37, 'kr'], [121, 14, 'ph'], [151, -33, 'au'], [-79, 43, 'ca'], [77, 28, 'in'], [3, 6, 'ng']];
export const HUB: [number, number] = [114, 22];
export const TESTIMONIALS_V2 = [
  { name: 'Chen L.', roleEn: 'Producer, Sample Pictures', roleZh: '制片人 · 示例影业', en: 'One partner, five platforms. Every episode, every cent — reconciled.', zh: '一个伙伴，五大平台。每一集、每一分，都对得上。' },
  { name: 'Marco R.', roleEn: 'Founder, Example Studio', roleZh: '创始人 · 示例工作室', en: 'Watermarking caught two piracy leaks. We broke even in 45 days.', zh: '防伪水印帮我们追回两次盗版。45 天回本。' },
  { name: 'Aiko T.', roleEn: 'Head of Rights, Demo Media', roleZh: '版权总监 · 示例传媒', en: 'The most transparent distributor we have ever worked with. Payouts land on time.', zh: '合作过最透明的发行方。月结准时到账。' },
];
