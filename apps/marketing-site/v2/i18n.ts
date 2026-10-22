import { createContext, useContext } from 'react';
export type Lang = 'en' | 'zh';
const en = {
  sample: 'Sample', sampleNote: 'Sample brand & data — for demonstration. Replace before launch.',
  nav: { originals: 'Originals', top10: 'Top 10', platform: 'Platform', global: 'Global', partners: 'Partners', contact: 'Contact' }, cta: 'Partner with us',
  hero: { eyebrow: 'Global short drama distribution', h1a: 'Stories made', h1b: 'to travel.', sub: 'We take vertical dramas from script to screens in 42 markets — localized, protected, and paid on time.', primary: 'Submit your series', secondary: 'Watch the slate', now: 'Now distributing' },
  rows: { trending: 'Trending worldwide', power: 'Power plays', heart: 'Hearts & shadows' },
  card: { match: 'Match', eps: 'eps', views: 'views', more: 'Details' },
  top10: { t: 'Top 10 this season', s: 'Ranked by global views across partner platforms.' },
  stats: { t: 'Scale you can see.', views: 'Global views', markets: 'Markets live', langs: 'Languages', ontime: 'On-time payouts' },
  map: { eyebrow: 'Global reach', t: 'One launch.\nForty-two markets.', s: 'From North America to Southeast Asia, every title goes live with native subtitles and dubbing.', live: 'Live markets' },
  bento: { eyebrow: 'The platform', t: 'Everything after "cut."',
    dist: ['Distribution', 'Five platforms. One deal.'], loc: ['Localization', 'Subtitles & AI dubbing in 16 languages.'], wm: ['Forensic watermark', 'Every stream is traceable. Every leak, found.'],
    rec: ['Transparent reconciliation', 'Per-episode, per-platform statements you can audit.'], set: ['Settlement', 'Monthly. On time. In your currency.'], ana: ['Audience insights', 'Know who watches, where, and when.'] },
  flow: { eyebrow: 'How it works', t: 'From script to payout.', steps: [['Submit', 'Share your series and rights. Decision in 72 hours.'], ['Localize', 'Translation, dubbing, and market-fit edits.'], ['Launch', 'Day-and-date release across partner platforms.'], ['Get paid', 'Watermarked data, reconciled monthly, paid on T+30.']] },
  settle: { t: 'Settlement, simplified.', steps: ['Platform data T+1', 'Watermark cross-check', 'Statement T+7', 'Payout T+30'] },
  partners: { t: 'Live on the platforms audiences love.' },
  voice: { t: 'Trusted by storytellers.' },
  join: { eyebrow: 'Partner with us', t: 'Your next hit\nstarts here.', s: 'Tell us about your series. Our team replies within 2 business days.',
    company: 'Company', name: 'Your name', email: 'Work email', titles: 'Titles in catalog', msg: 'Tell us about your series (optional)', submit: 'Submit application', ok: 'Thank you. We\'ll be in touch within 2 business days.', okNote: 'Demo only — nothing was sent.',
    err: { required: 'Required', email: 'Enter a valid email', agree: 'Please accept to continue' }, agree: 'I agree to be contacted about distribution.', select: 'Select' },
  footer: { rights: 'All data shown is sample data.', privacy: 'Privacy', terms: 'Terms' },
  modal: { platforms: 'Platforms', lang: 'Language', markets: 'Markets', close: 'Close' },
};
const zh: typeof en = {
  sample: '示例', sampleNote: '示例品牌与数据，仅供演示，上线前请替换。',
  nav: { originals: '作品', top10: 'Top 10', platform: '平台能力', global: '全球覆盖', partners: '合作平台', contact: '联系' }, cta: '成为合作伙伴',
  hero: { eyebrow: '全球短剧发行', h1a: '好故事，', h1b: '生来出海。', sub: '从剧本到 42 个市场的屏幕——本地化、版权保护、准时结算。', primary: '提交你的作品', secondary: '浏览片单', now: '正在发行' },
  rows: { trending: '全球热播', power: '权力与逆袭', heart: '心动与暗影' },
  card: { match: '匹配', eps: '集', views: '播放', more: '详情' },
  top10: { t: '本季 Top 10', s: '按合作平台全球播放量排名。' },
  stats: { t: '看得见的规模。', views: '全球播放', markets: '上线市场', langs: '语种', ontime: '准时结算率' },
  map: { eyebrow: '全球覆盖', t: '一次发行，\n四十二个市场。', s: '从北美到东南亚，每部作品都以本地字幕与配音同步上线。', live: '已上线市场' },
  bento: { eyebrow: '平台能力', t: '"咔"之后的一切。',
    dist: ['多平台发行', '五大平台，一份合约。'], loc: ['本地化', '16 种语言字幕与 AI 配音。'], wm: ['防伪水印', '每一路播放可溯源，每一次盗播可追回。'],
    rec: ['透明对账', '按集、按平台出具可审计对账单。'], set: ['结算', '月结、准时、以你的币种到账。'], ana: ['观众洞察', '谁在看、在哪看、何时看。'] },
  flow: { eyebrow: '合作流程', t: '从剧本，到回款。', steps: [['提交', '提交作品与版权信息，72 小时内答复。'], ['本地化', '翻译、配音与市场化剪辑。'], ['上线', '多平台同步首发。'], ['回款', '水印数据核验，月度对账，T+30 到账。']] },
  settle: { t: '结算，就该简单。', steps: ['平台数据 T+1', '水印交叉核验', '对账单 T+7', '回款 T+30'] },
  partners: { t: '登陆观众最爱的平台。' },
  voice: { t: '创作者的信赖之选。' },
  join: { eyebrow: '成为合作伙伴', t: '下一部爆款，\n从这里开始。', s: '告诉我们你的作品，团队将在 2 个工作日内回复。',
    company: '公司名称', name: '你的姓名', email: '工作邮箱', titles: '片库规模', msg: '介绍一下你的作品（选填）', submit: '提交申请', ok: '感谢提交，我们将在 2 个工作日内联系你。', okNote: '演示环境——未实际发送。',
    err: { required: '必填', email: '请输入有效邮箱', agree: '请勾选同意' }, agree: '我同意就发行合作事宜被联系。', select: '请选择' },
  footer: { rights: '页面所示数据均为示例。', privacy: '隐私', terms: '条款' },
  modal: { platforms: '平台', lang: '语言', markets: '市场', close: '关闭' },
};
export const DICT = { en, zh };
export type Dict = typeof en;
export const I18n = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({ lang: 'en', t: en, setLang: () => {} });
export const useT = () => useContext(I18n);
