import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Drawer, Input, Form, Select, App as AntApp, Result, Tooltip, Checkbox } from 'antd';
import { MenuOutlined, SearchOutlined, MoonOutlined, SunOutlined, HomeFilled, FireOutlined, AppstoreOutlined, GlobalOutlined, SafetyCertificateOutlined, MessageOutlined, RocketOutlined, PlayCircleFilled, ArrowLeftOutlined, CheckCircleFilled, LockOutlined, EyeOutlined, AccountBookOutlined, CloudUploadOutlined, TranslationOutlined, LineChartOutlined, WalletOutlined, ArrowRightOutlined, StarFilled } from '@ant-design/icons';
import { WORKS, GENRES, PLATFORMS, LANGS, PLAT_COLOR, TESTIMONIALS, fmtViews, Work } from './data/works';
import { Cover, WorkCard, PBadge, Demo, Curve } from './ui';
import { useThemeMode } from './main';

const go = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

function Side({ onPick }: { onPick?: () => void }) {
  const nav = useNavigate(); const [sp] = useSearchParams(); const g = sp.get('g') || '全部';
  const item = (icon: React.ReactNode, label: string, act: () => void, on = false) => <div className={'sitem' + (on ? ' on' : '')} onClick={() => { act(); onPick?.(); }}>{icon}<span>{label}</span></div>;
  const sec = (id: string) => () => { nav('/'); go(id); };
  return (
    <nav className="side">
      {item(<HomeFilled />, '首页', () => { nav('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, g === '全部')}
      {item(<FireOutlined />, '优秀作品', sec('works'))}
      {item(<GlobalOutlined />, '发行能力', sec('ability'))}
      {item(<SafetyCertificateOutlined />, '数据与结算', sec('trust'))}
      {item(<MessageOutlined />, '客户证言', sec('voice'))}
      {item(<RocketOutlined />, '入驻发行', sec('join'))}
      <div className="sdiv" /><div className="stitle">按题材浏览</div>
      {GENRES.slice(1).map(x => item(<span className="gdot" />, x, () => { nav('/?g=' + encodeURIComponent(x)); go('works'); }, g === x))}
      <div className="sdiv" /><div className="sfoot">© 2026 星河出海 · 示例站点<br />页面所有数据均为示例</div>
    </nav>
  );
}

export default function App() {
  const { dark, setDark } = useThemeMode(); const nav = useNavigate(); const loc = useLocation();
  const [drawer, setDrawer] = useState(false); const [q, setQ] = useState('');
  useEffect(() => { if (!loc.search) window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="shell">
      <div className="demobar">本站为对外营销站演示稿 · 作品、数据、证言均为<b>示例</b>，非真实业务数据</div>
      <header className="top">
        <div className="tl">
          <Button type="text" shape="circle" icon={<MenuOutlined />} onClick={() => setDrawer(true)} className="burger" aria-label="菜单" />
          <div className="brand" onClick={() => nav('/')}><span className="blogo"><PlayCircleFilled /></span><b>星河出海</b><sup>短剧发行</sup></div>
        </div>
        <form className="search" onSubmit={e => { e.preventDefault(); nav('/?q=' + encodeURIComponent(q)); go('works'); }}>
          <input placeholder="搜索剧名、题材、平台" value={q} onChange={e => setQ(e.target.value)} /><button aria-label="搜索"><SearchOutlined /></button>
        </form>
        <div className="tr">
          <Tooltip title={dark ? '浅色主题' : '深色主题'}><Button type="text" shape="circle" icon={dark ? <SunOutlined /> : <MoonOutlined />} onClick={() => setDark(!dark)} aria-label="切换主题" /></Tooltip>
          <Button type="primary" shape="round" icon={<RocketOutlined />} onClick={() => { nav('/'); go('join'); }} className="joinbtn">入驻发行</Button>
          <Button shape="round" onClick={() => nav('/login')} className="loginbtn">登录</Button>
        </div>
      </header>
      <div className="body">
        <aside className="sidewrap"><Side /></aside>
        <Drawer placement="left" open={drawer} onClose={() => setDrawer(false)} width={260} title={<div className="brand"><span className="blogo"><PlayCircleFilled /></span><b>星河出海</b></div>} styles={{ body: { padding: 8 } }}><Side onPick={() => setDrawer(false)} /></Drawer>
        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/work/:id" element={<Detail />} />
            <Route path="/login" element={<Login />} />
          </Routes>
          <Footer />
        </main>
      </div>
    </div>
  );
}

function Hero() {
  const nav = useNavigate(); const list = WORKS.slice(0, 5); const [i, setI] = useState(0); const [pause, setPause] = useState(false);
  useEffect(() => { if (pause) return; const t = setTimeout(() => setI((i + 1) % list.length), 6000); return () => clearTimeout(t); }, [i, pause]);
  const w = list[i];
  return (
    <section className="hero" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}>
      <div className="hstage" key={w.id} style={{ ['--a' as any]: w.hue[0], ['--b' as any]: w.hue[1] }}>
        <div className="hvid"><div className="hglow" /><div className="hglow g2" /><div className="hscan" /><div className="hposter"><Cover w={w} big /></div></div>
        <div className="hinfo">
          <div className="hrow"><span className="live"><i />预览播放中</span><Demo /></div>
          <div className="hen">{w.en}</div>
          <h1>{w.title}</h1>
          <p>{w.desc}</p>
          <div className="hstats"><div><b>{fmtViews(w.views)}</b><span>全球播放</span></div><div><b>{w.platforms.length}</b><span>上线平台</span></div><div><b>{w.rating}</b><span>用户评分</span></div></div>
          <div className="hplat">{w.platforms.map(p => <PBadge key={p} p={p} />)}</div>
          <div className="hbtns"><Button size="large" shape="round" icon={<PlayCircleFilled />} onClick={() => nav('/work/' + w.id)} className="hwhite">查看发行成绩</Button><Button size="large" shape="round" className="hghost" onClick={() => go('join')}>我也要出海</Button></div>
        </div>
        <div className="hprog"><i key={i + String(pause)} className={pause ? 'paused' : ''} /></div>
      </div>
      <div className="hthumbs">
        {list.map((x, k) => <div key={x.id} className={'hth' + (k === i ? ' on' : '')} onClick={() => setI(k)}><Cover w={x} /><div><div className="ell" style={{ fontWeight: 600 }}>{x.title}</div><div className="meta">{x.genre} · {fmtViews(x.views)}播放</div></div></div>)}
      </div>
    </section>
  );
}

function ChipRow({ label, opts, v, set }: { label: string; opts: string[]; v: string; set: (s: string) => void }) {
  return <div className="chiprow"><span className="clabel">{label}</span>{opts.map(o => <button key={o} className={'chip' + (v === o ? ' on' : '')} onClick={() => set(o)}>{o}</button>)}</div>;
}

function Works() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const g = sp.get('g') || '全部'; const q = sp.get('q') || ''; const [p, setP] = useState('全部'); const [l, setL] = useState('全部');
  const setG = (x: string) => { const n = new URLSearchParams(sp); x === '全部' ? n.delete('g') : n.set('g', x); setSp(n, { replace: true }); };
  const list = WORKS.filter(w => (g === '全部' || w.genre === g) && (p === '全部' || w.platforms.includes(p)) && (l === '全部' || w.lang === l) && (!q || (w.title + w.en + w.genre + w.platforms.join()).toLowerCase().includes(q.toLowerCase())));
  return (
    <section id="works" className="sec">
      <div className="sh"><div><h2>优秀发行作品 <Demo /></h2><div className="sub">已发行 300+ 部短剧，覆盖 6 大语种、40+ 国家和地区（示例）</div></div></div>
      <div className="chips">
        <ChipRow label="题材" opts={GENRES} v={g} set={setG} />
        <ChipRow label="平台" opts={['全部', ...PLATFORMS]} v={p} set={setP} />
        <ChipRow label="语种" opts={['全部', ...LANGS]} v={l} set={setL} />
        {q && <div className="qhint">搜索「{q}」<a onClick={() => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n); }}>清除</a></div>}
      </div>
      {list.length ? <div className="grid">{list.map(w => <WorkCard key={w.id} w={w} onClick={() => nav('/work/' + w.id)} />)}</div>
        : <div className="empty"><SearchOutlined style={{ fontSize: 36 }} /><div>没有符合条件的示例作品</div><Button onClick={() => { setSp({}); setP('全部'); setL('全部'); }}>清空筛选</Button></div>}
    </section>
  );
}

const STATS = [['300+', '已发行短剧'], ['42', '覆盖国家与地区'], ['18 亿+', '累计全球播放'], ['T+30', '月结到账周期']];
const STEPS = [
  [<CloudUploadOutlined />, '提交片源', '上传成片与授权文件，3 个工作日完成审核'],
  [<TranslationOutlined />, '译制本地化', 'AI + 人工双校字幕配音，6 大语种同步交付'],
  [<GlobalOutlined />, '多平台上架', '一次提交，同步分发至合作海外平台'],
  [<LineChartOutlined />, '投放与回款', '实时看板追踪成绩，按月对账结算'],
];
function Ability() {
  return (
    <section id="ability" className="sec">
      <div className="sh"><div><h2>一站式海外发行能力</h2><div className="sub">从片源到回款，你只需专注创作</div></div></div>
      <div className="stats">{STATS.map(([v, l]) => <div key={l} className="stat"><b>{v}</b><span>{l}</span><Demo /></div>)}</div>
      <div className="wallt">合作海外平台</div>
      <div className="pwall">{PLATFORMS.map(p => <div key={p} className="pw" style={{ ['--pc' as any]: PLAT_COLOR[p] }}><span className="pwlogo">{p.slice(0, 1)}</span><b>{p}</b><span className="meta">文字徽章 · 待替换官方 Logo</span></div>)}</div>
      <div className="wallt">发行流程</div>
      <div className="steps">{STEPS.map(([ic, t, d], k) => <div key={k} className="step"><div className="snum">0{k + 1}</div><div className="sic">{ic}</div><b>{t}</b><p>{d}</p>{k < 3 && <ArrowRightOutlined className="sarrow" />}</div>)}</div>
    </section>
  );
}

function Trust() {
  return (
    <section id="trust" className="sec">
      <div className="trust">
        <div className="tcol">
          <h2>数据透明，<span className="red">每一分钱都可追溯</span></h2>
          <div className="tfeat"><EyeOutlined /><div><b>逐集数据透明</b><p>平台回传数据直连看板，播放、充值、分成按集拆分，随时导出核对。</p></div></div>
          <div className="tfeat"><LockOutlined /><div><b>防伪溯源水印</b><p>每个分发渠道嵌入独立隐形水印，盗版搬运可定位到源头，协助维权下架。</p></div></div>
          <div className="tfeat"><AccountBookOutlined /><div><b>三方对账单</b><p>平台账单、发行方账单、版权方账单三方比对，差异自动标红。</p></div></div>
        </div>
        <div className="tvis">
          <div className="wmdemo"><Cover w={WORKS[8]} /><div className="wmgrid">{Array.from({ length: 24 }).map((_, k) => <span key={k}>XH·RS·0817</span>)}</div><div className="wmstamp">渠道 ReelShort · 批次 0817 · 指纹 9F3A…C21</div></div>
          <div className="bill">
            <div className="bh"><b>2026 年 9 月对账单</b><Demo /></div>
            {[['ReelShort', '¥ 186,420', true], ['DramaBox', '¥ 92,310', true], ['ShortMax', '¥ 48,905', false]].map(([p, v, ok]) => <div className="brow" key={p as string}><PBadge p={p as string} sm /><span className="bv">{v}</span>{ok ? <span className="ok"><CheckCircleFilled /> 三方一致</span> : <span className="warn">差异 0.3% 复核中</span>}</div>)}
            <div className="btot"><span>应结合计</span><b>¥ 327,635</b></div>
          </div>
        </div>
      </div>
      <div className="wallt" style={{ marginTop: 32 }}>结算流程</div>
      <div className="settle">{[['平台回款', '每月 15 日前平台结算至发行方'], ['生成账单', '系统自动生成逐集分成账单'], ['在线确认', '版权方在线核对、一键确认'], ['开票打款', 'T+30 内打款至对公账户']].map(([t, d], k) => <div key={t} className="sst"><span className="sdot">{k + 1}</span><b>{t}</b><span className="meta">{d}</span></div>)}</div>
    </section>
  );
}

function Voices() {
  return (
    <section id="voice" className="sec">
      <div className="sh"><div><h2>听听合作伙伴怎么说 <Demo /></h2><div className="sub">证言为示例，正式上线前需替换为授权真实证言</div></div></div>
      <div className="voices">{TESTIMONIALS.map(t => <div key={t.name} className="voice"><div className="stars">{[1, 2, 3, 4, 5].map(s => <StarFilled key={s} />)}</div><p>“{t.text}”</p><div className="vwho"><span className="vav" style={{ background: t.c }}>{t.name[0]}</span><div><b>{t.name}</b><div className="meta">{t.role}</div></div></div></div>)}</div>
    </section>
  );
}

function Join() {
  const { message } = AntApp.useApp(); const [form] = Form.useForm(); const [done, setDone] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const submit = (v: any) => { setLoading(true); setTimeout(() => { setLoading(false); setDone(v.company); message.success('提交成功，我们将在 1 个工作日内联系你'); form.resetFields(); }, 700); };
  return (
    <section id="join" className="sec">
      <div className="join">
        <div className="jl">
          <h2>把你的短剧，<br />带给全世界观众</h2>
          <p>入驻零门槛 · 无预付费用 · 版权方最高可得 70% 分成（示例条款）</p>
          <ul>{['专属发行经理 1 对 1 对接', '免费译制试片 1 集', '首月数据看板免费开通'].map(x => <li key={x}><CheckCircleFilled /> {x}</li>)}</ul>
        </div>
        <div className="jr">
          {done ? <Result status="success" title="提交成功" subTitle={`感谢「${done}」的信任！发行经理将在 1 个工作日内与你联系。（演示环境，未真实提交）`} extra={<Button onClick={() => setDone(null)}>再提交一份</Button>} /> :
            <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
              <div className="jtitle"><b>入驻发行申请</b><Demo>演示表单 · 不会真实发送</Demo></div>
              <div className="frow">
                <Form.Item name="company" label="公司 / 工作室名称" rules={[{ required: true, message: '请填写公司名称' }, { min: 2, message: '至少 2 个字' }]}><Input placeholder="如：某某影视文化有限公司" /></Form.Item>
                <Form.Item name="name" label="联系人" rules={[{ required: true, message: '请填写联系人' }]}><Input placeholder="你的称呼" /></Form.Item>
              </div>
              <div className="frow">
                <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请填写手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入 11 位有效手机号' }]}><Input placeholder="11 位手机号" maxLength={11} /></Form.Item>
                <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请填写邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}><Input placeholder="name@company.com" /></Form.Item>
              </div>
              <div className="frow">
                <Form.Item name="count" label="可发行片量" rules={[{ required: true, message: '请选择片量' }]}><Select placeholder="请选择" options={['1-5 部', '6-20 部', '21-50 部', '50 部以上'].map(v => ({ value: v }))} /></Form.Item>
                <Form.Item name="genres" label="主要题材"><Select mode="multiple" maxTagCount={2} placeholder="可多选" options={GENRES.slice(1).map(v => ({ value: v }))} /></Form.Item>
              </div>
              <Form.Item name="note" label="补充说明"><Input.TextArea rows={3} placeholder="代表作品、期望上线平台等" maxLength={300} showCount /></Form.Item>
              <Form.Item name="agree" valuePropName="checked" rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请阅读并同意隐私条款')) }]}><Checkbox>我已阅读并同意《隐私政策》（示例）</Checkbox></Form.Item>
              <Button type="primary" htmlType="submit" size="large" block shape="round" loading={loading}>提交入驻申请</Button>
            </Form>}
        </div>
      </div>
    </section>
  );
}

function Home() {
  const loc = useLocation();
  useEffect(() => { if (loc.search) go('works'); }, []);
  return <div className="page"><Hero /><Works /><Ability /><Trust /><Voices /><Join /></div>;
}

function Detail() {
  const { id } = useParams(); const nav = useNavigate(); const w = WORKS.find(x => x.id === id);
  if (!w) return <div className="page"><Result status="404" title="作品不存在" extra={<Button onClick={() => nav('/')}>返回首页</Button>} /></div>;
  const rel = WORKS.filter(x => x.id !== w.id && (x.genre === w.genre || x.platforms.some(p => w.platforms.includes(p)))).slice(0, 6);
  return (
    <div className="page detail">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => nav(-1)} style={{ marginBottom: 12 }}>返回</Button>
      <div className="dgrid">
        <div>
          <div className="dhead">
            <div className="dcov"><Cover w={w} big /></div>
            <div className="dinfo">
              <div className="hrow"><span className="tagg">{w.genre}</span><span className="tagg">{w.lang}</span><span className="tagg">{w.eps} 集</span><Demo /></div>
              <h1>{w.title}</h1><div className="meta" style={{ fontSize: 14 }}>{w.en} · {w.year}</div>
              <p className="ddesc">{w.desc}</p>
              <div className="dstats"><div><b>{fmtViews(w.views)}</b><span>累计播放</span></div><div><b>{w.rating}</b><span>平均评分</span></div><div><b>{w.markets.length}</b><span>重点市场</span></div></div>
              <Button type="primary" shape="round" size="large" onClick={() => { nav('/'); go('join'); }}>发行同类作品</Button>
            </div>
          </div>
          <div className="dcard"><div className="dct"><b>上线平台</b></div><div className="dplats">{w.platforms.map((p, k) => <div key={p} className="dplat" style={{ ['--pc' as any]: PLAT_COLOR[p] }}><span className="pwlogo">{p[0]}</span><div><b>{p}</b><div className="meta">上线 {w.year}-0{3 + k}-1{k + 2} · 占比 {Math.round(100 / w.platforms.length + (k ? -8 : 8) * (w.platforms.length - 1))}%</div></div></div>)}</div>
            <div className="dct" style={{ marginTop: 16 }}><b>重点市场</b></div><div className="hrow">{w.markets.map(m => <span key={m} className="tagg">{m}</span>)}</div></div>
          <div className="dcard"><div className="dct"><b>上线 12 周累计播放</b><Demo /></div><Curve data={w.trend} /></div>
        </div>
        <aside className="drel"><div className="dct"><b>相关作品</b></div>{rel.map(x => <div key={x.id} className="relc" onClick={() => nav('/work/' + x.id)}><Cover w={x} /><div style={{ minWidth: 0 }}><div className="wc-t">{x.title}</div><div className="meta">{x.genre} · {fmtViews(x.views)}播放</div><div className="wc-p">{x.platforms.map(p => <PBadge key={p} p={p} sm />)}</div></div></div>)}</aside>
      </div>
    </div>
  );
}

function Login() {
  const { message } = AntApp.useApp();
  return <div className="page"><div className="loginbox"><h2>登录发行平台</h2><p className="meta">版权方 / 制片公司账号（演示，不会真实登录）</p>
    <Form layout="vertical" onFinish={() => message.info('演示环境：登录后将跳转发行管理后台')} requiredMark={false}>
      <Form.Item name="u" label="手机号或邮箱" rules={[{ required: true, message: '请输入账号' }]}><Input /></Form.Item>
      <Form.Item name="p" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password /></Form.Item>
      <Button type="primary" htmlType="submit" block shape="round" size="large">登录</Button></Form>
    <div className="meta" style={{ marginTop: 16, textAlign: 'center' }}>还没有账号？<a onClick={() => { location.hash = '#/'; go('join'); }}>申请入驻</a></div></div></div>;
}

function Footer() {
  return <footer className="foot"><div className="fcols">
    <div><div className="brand"><span className="blogo"><PlayCircleFilled /></span><b>星河出海</b></div><p className="meta" style={{ maxWidth: 280, marginTop: 10 }}>专注中国短剧海外发行，连接优质内容与全球观众。（示例公司）</p></div>
    {[['产品', ['发行平台', '数据看板', '防伪水印', '结算中心']], ['合作', ['版权方入驻', '平台合作', '译制合作']], ['联系', ['bd@example.com', '400-000-0000（示例）', '上海 · 示例地址']]].map(([t, l]) => <div key={t as string}><b>{t}</b>{(l as string[]).map(x => <div key={x} className="meta flink">{x}</div>)}</div>)}
  </div><div className="fbot meta">© 2026 星河出海（示例） · 平台名称为各自商标所有者所有，此处仅作文字示意 · 本站全部数据为示例</div></footer>;
}
