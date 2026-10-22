import { CaretDownFilled, CaretUpFilled } from '@ant-design/icons';
import { chart, colors, platformColor, platformMarker, type PlatformKey } from '@ds/tokens';
import { RankBadge } from '@ds/RankBadge';
import { Button, Card, Col, Row } from 'antd';
import * as echarts from 'echarts';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useDsTheme } from '../theme';
import { ErrorNote, PageHead, PlatformChip, money } from '../ui';

interface Dash {
  views: number;
  revenueCny: string;
  revenueNote: string;
  liveDramas: number;
  platformCount: number;
  platforms: string[];
  asOf: string;
  conclusion: string;
  delta: number | null;
  trend: { date: string; views: number; revenueCny: string }[];
  top: { dramaId: string; title: string; views: number }[];
  updating?: boolean;
  updatingLabel?: string;
}

const PLATFORM_KEYS = new Set<string>(['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort']);

export function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { mode } = useDsTheme();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  const [certStatus, setCertStatus] = useState('');

  useEffect(() => {
    api<Dash>('/dashboard').then(setData).catch((err) => setError(err.message));
    if (user?.role === 'CLIENT') api<{ certStatus: string }>('/company').then((company) => setCertStatus(company.certStatus)).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!data) return;
    const trendEl = document.getElementById('trend-chart');
    const topEl = document.getElementById('top-chart');
    const platEl = document.getElementById('platform-chart');
    if (!trendEl || !topEl || !platEl) return;
    const trend = echarts.init(trendEl);
    const top = echarts.init(topEl);
    const plat = echarts.init(platEl);
    const palette = colors[mode];
    const grid = chart.grid[mode];
    const axis = { color: palette.textTertiary };
    trend.setOption({
      color: [...chart.categorical],
      textStyle: { color: palette.textSecondary, fontFamily: 'Inter, "Noto Sans SC", sans-serif' },
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: palette.textSecondary } },
      grid: { left: 48, right: 24, top: 36, bottom: 28 },
      xAxis: { type: 'category', data: data.trend.map((row) => row.date.slice(5)), axisLabel: axis, axisLine: { lineStyle: { color: grid } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: grid } }, axisLabel: axis },
      series: [
        { name: '播放', type: 'line', smooth: true, data: data.trend.map((row) => row.views), areaStyle: { color: chart.sequential[1] } },
        { name: '估算人民币', type: 'line', smooth: true, yAxisIndex: 0, data: data.trend.map((row) => Number(row.revenueCny)) },
      ],
    });
    top.setOption({
      color: [chart.categorical[1]],
      textStyle: { color: palette.textSecondary },
      grid: { left: 100, right: 24, top: 16, bottom: 24 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: grid } }, axisLabel: axis },
      yAxis: { type: 'category', data: data.top.map((row) => row.title).reverse(), axisLabel: { color: palette.textSecondary, width: 88, overflow: 'truncate' } },
      series: [{ type: 'bar', data: data.top.map((row) => row.views).reverse(), barMaxWidth: 18 }],
    });
    const listed = data.platforms.filter((name): name is PlatformKey => PLATFORM_KEYS.has(name));
    plat.setOption({
      textStyle: { color: palette.textSecondary },
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: palette.textSecondary } },
      grid: { left: 48, right: 88, top: 28, bottom: 28 },
      xAxis: { type: 'category', data: ['在架'], axisLabel: axis, axisLine: { lineStyle: { color: grid } } },
      yAxis: { type: 'value', min: 0, max: 2, splitLine: { lineStyle: { color: grid } }, axisLabel: axis },
      series: listed.map((name) => ({
        name,
        type: 'line',
        data: [1],
        color: platformColor(name, mode),
        symbol: platformMarker[name].symbol,
        symbolSize: 12,
        lineStyle: { type: platformMarker[name].dash, width: 2 },
        endLabel: { show: true, formatter: name, color: palette.text },
      })),
    });
    const onResize = () => { trend.resize(); top.resize(); plat.resize(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); trend.dispose(); top.dispose(); plat.dispose(); };
  }, [data, mode]);

  const client = user?.role === 'CLIENT';
  const delta = data?.delta;
  const deltaUp = (delta ?? 0) >= 0;
  return (
    <div>
      <PageHead
        title={client ? '数据总览' : '数据看板'}
        hint={data?.conclusion}
        extra={client && (certStatus === 'UNVERIFIED' || certStatus === 'REJECTED') ? <Button type="primary" onClick={() => nav('/company')}>去认证</Button> : null}
      />
      {client && data?.updating ? <div style={{ margin: '0 0 12px', fontWeight: 600, color: '#cf1322' }}>{data.updatingLabel || '数据更新中'}</div> : null}
      <ErrorNote error={error} />
      <motion.div className="stat-row" {...chartMotion.list}>
        <Stat label="播放" value={data ? data.views.toLocaleString('en-US') : '—'} delta={delta} up={deltaUp} />
        <Stat label="估算人民币" value={data ? money(data.revenueCny) : '—'} />
        <Stat label="正在发行的剧" value={data ? String(data.liveDramas) : '—'} />
        <Stat label="在架平台" value={data ? String(data.platformCount) : '—'} />
      </motion.div>
      <p style={{ color: 'var(--ds-text-3)', marginTop: -8 }}>{data?.asOf}。{data?.revenueNote}</p>
      <div style={{ marginBottom: 16 }}>{data?.platforms.map((name) => <PlatformChip key={name} name={name} sync="在架" />)}</div>
      <Row gutter={16}>
        <Col xs={24} lg={14}><Card title="播放趋势"><div id="trend-chart" className="chart-box" /></Card></Col>
        <Col xs={24} lg={10}>
          <Card title="播放最多">
            <motion.ol style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 8 }} {...chartMotion.list}>
              {(data?.top || []).map((row, index) => (
                <motion.li key={row.dramaId} style={{ display: 'flex', alignItems: 'center', gap: 8 }} {...chartMotion.item}>
                  <RankBadge rank={index + 1} size="sm" />
                  <span style={{ flex: 1 }}>{row.title}</span>
                  <span className="ds-num">{row.views.toLocaleString('en-US')}</span>
                </motion.li>
              ))}
            </motion.ol>
            <div id="top-chart" className="chart-box" />
          </Card>
        </Col>
      </Row>
      <Card title="在架平台" style={{ marginTop: 16 }}><div id="platform-chart" className="chart-box" /></Card>
    </div>
  );
}

const chartMotion = {
  list: { initial: 'hidden' as const, animate: 'show' as const, variants: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } } },
  item: { variants: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } } },
};

function Stat({ label, value, delta, up }: { label: string; value: string; delta?: number | null; up?: boolean }) {
  return (
    <motion.div className="ds-stat" {...chartMotion.item}>
      <div className="ds-stat__label">{label}</div>
      <div className="ds-stat__value">{value}</div>
      {delta != null ? (
        <div className={`ds-stat__delta ${up ? 'up' : 'down'}`}>
          {up ? <CaretUpFilled /> : <CaretDownFilled />}
          {up ? '+' : ''}{delta}%
        </div>
      ) : null}
    </motion.div>
  );
}
