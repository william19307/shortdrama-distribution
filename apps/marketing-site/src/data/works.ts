// 全部为示例数据（非真实作品 / 真实成绩）
export type Work = {
  id: string; title: string; en: string; genre: string; lang: string; platforms: string[];
  views: number; eps: number; rating: number; year: number; hue: [string, string]; motif: string;
  desc: string; tags: string[]; trend: number[]; markets: string[]; hot?: boolean;
};
export const GENRES = ['全部', '霸总', '复仇', '甜宠', '逆袭', '悬疑', '奇幻', '家庭', '狼人'];
export const PLATFORMS = ['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort'];
export const LANGS = ['英语', '西班牙语', '葡萄牙语', '日语', '印尼语', '泰语'];
export const PLAT_COLOR: Record<string, string> = { ReelShort: '#E5243B', DramaBox: '#F28C28', ShortMax: '#7B3FE4', FlexTV: '#1E88E5', GoodShort: '#14A37F' };

const raw: [string, string, string, string, string[], number, number, [string, string], string, string][] = [
  ['亿万总裁的契约新娘', 'The Billionaire\'s Contract Bride', '霸总', '英语', ['ReelShort', 'DramaBox'], 18600, 82, ['#3a0613', '#D6153C'], '♛', '一纸契约，让落魄设计师成为亿万总裁的挂名妻子，却在豪门暗涌中发现当年家族破产的真相。'],
  ['重生后我让渣男跪下', 'Reborn to Make Him Kneel', '复仇', '英语', ['ReelShort'], 15200, 76, ['#120f2e', '#6b3fe4'], '⚔', '被背叛致死的女主重生回五年前，步步为营，夺回属于自己的一切。'],
  ['狼王的替身月光', 'The Alpha\'s Moonlight Substitute', '狼人', '英语', ['GoodShort', 'ShortMax'], 13400, 90, ['#0b1d2e', '#2d7fb8'], '☾', '被族群驱逐的孤女，竟是狼王命定的月光伴侣。'],
  ['闪婚后首富老公藏不住了', 'My Secret Tycoon Husband', '甜宠', '西班牙语', ['DramaBox'], 9800, 68, ['#3b0b2a', '#f05c8c'], '♥', '相亲认错人闪婚，平凡老公每天都在悄悄露馅。'],
  ['赘婿的逆袭', 'Rise of the Son-in-Law', '逆袭', '英语', ['FlexTV', 'ReelShort'], 12100, 100, ['#1a1404', '#d4a017'], '⚡', '隐忍三年的上门女婿，一朝身份揭晓，全城震动。'],
  ['午夜第十三号病房', 'Ward 13 at Midnight', '悬疑', '日语', ['ShortMax'], 6400, 60, ['#081a17', '#1f9e86'], '✚', '实习医生每晚值班都会收到一条来自不存在病房的呼叫。'],
  ['龙族公主的复仇', 'Vengeance of the Dragon Princess', '奇幻', '葡萄牙语', ['GoodShort'], 7300, 88, ['#2a0a05', '#ff6a2b'], '✦', '被封印千年的龙族公主苏醒于现代都市，开始清算旧账。'],
  ['妈妈的第二人生', 'Mom\'s Second Life', '家庭', '印尼语', ['DramaBox', 'FlexTV'], 5600, 70, ['#1f1a10', '#c58b4a'], '❀', '五十岁的全职妈妈离婚后重返职场，活成了全家的骄傲。'],
  ['她是黑帮继承人', 'She Is the Mafia Heiress', '霸总', '英语', ['ReelShort', 'ShortMax'], 11200, 84, ['#0d0d0d', '#8a0b26'], '♠', '平凡女孩在生日当天被告知：她是地下帝国唯一的继承人。'],
  ['豪门千金归来', 'Return of the True Heiress', '复仇', '西班牙语', ['DramaBox', 'GoodShort'], 8900, 74, ['#2b0d18', '#c2185b'], '♕', '被调包二十年的真千金回归豪门，假千金的好日子到头了。'],
  ['总裁请签收你的萌宝', 'Sign Here, CEO Daddy', '甜宠', '泰语', ['FlexTV'], 4200, 66, ['#33140a', '#ff8a65'], '☺', '五年后她带着天才萌宝回国，萌宝第一件事是给妈咪找回爸爸。'],
  ['战神归来', 'The War God Returns', '逆袭', '印尼语', ['ShortMax', 'FlexTV'], 6900, 95, ['#0e1622', '#4a6fa5'], '✪', '边境战神卸甲归来，只为守护一个人。'],
  ['消失的伴娘', 'The Vanished Bridesmaid', '悬疑', '英语', ['GoodShort'], 5100, 58, ['#101418', '#5c6b7a'], '?', '婚礼前夜伴娘离奇消失，每位宾客都藏着秘密。'],
  ['吸血鬼王子的契约', 'Pact with the Vampire Prince', '奇幻', '英语', ['ReelShort', 'GoodShort'], 10400, 80, ['#1a0410', '#9c1b4b'], '✟', '为救弟弟，她与沉睡百年的吸血鬼王子签下血契。'],
  ['离婚后前夫追妻火葬场', 'Chasing My Ex-Wife', '霸总', '葡萄牙语', ['DramaBox'], 7700, 78, ['#1d0f24', '#a05ad6'], '✧', '签下离婚协议那天，他才知道失去的是什么。'],
  ['外婆的小面馆', 'Grandma\'s Noodle House', '家庭', '日语', ['ShortMax'], 3300, 50, ['#1b140b', '#e0a85a'], '♨', '一碗面，连起三代人的和解。'],
];
const mk = (seed: number, total: number) => { const a: number[] = []; let v = 0; for (let i = 0; i < 12; i++) { const g = Math.max(0.02, Math.sin(seed + i * 0.7) * 0.06 + (i < 4 ? 0.16 : 0.07) - i * 0.004); v += g; a.push(v); } return a.map(x => Math.round((x / v) * total)); };
export const WORKS: Work[] = raw.map((r, i) => ({
  id: 'w' + (i + 1), title: r[0], en: r[1], genre: r[2], lang: r[3], platforms: r[4], views: r[5] * 10000, eps: r[6],
  rating: +(8.2 + ((i * 37) % 15) / 10).toFixed(1), year: 2025 + (i % 2), hue: r[7], motif: r[8], desc: r[9],
  tags: [r[2], r[3], r[6] + '集'], trend: mk(i, r[5] * 10000), markets: ['北美', '东南亚', '拉美', '欧洲', '中东', '日韩'].filter((_, k) => (i + k) % 3 !== 0), hot: i < 5,
}));
export const fmtViews = (n: number) => n >= 1e8 ? (n / 1e8).toFixed(1) + ' 亿' : (n / 1e4).toFixed(0) + ' 万';
export const TESTIMONIALS = [
  { name: '陈女士', role: '某影视文化公司 · 制片人', text: '以前出海要对接五六家平台，现在一个后台全搞定。对账单每一集的播放和分成都能核对，心里踏实。', c: '#D6153C' },
  { name: '刘先生', role: '某短剧工作室 · 创始人', text: '防伪水印帮我们追回了两次盗版搬运。首部剧上线 45 天回本，比预期快了一倍。', c: '#7B3FE4' },
  { name: '王女士', role: '某传媒集团 · 版权总监', text: '译制、上架、投放、结算全流程透明，月结准时到账，是我们合作体验最好的发行方。', c: '#14A37F' },
];
