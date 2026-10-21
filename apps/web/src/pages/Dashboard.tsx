import { chart } from '@ds/tokens';
import { Card, Col, Row, Statistic } from 'antd';
import * as echarts from 'echarts';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, money } from '../ui';

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
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Dash>('/dashboard').then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!data) return;
    const trendEl = document.getElementById('trend-chart');
    const topEl = document.getElementById('top-chart');
    if (!trendEl || !topEl) return;
    const trend = echarts.init(trendEl);
    const top = echarts.init(topEl);
    const grid = chart.grid.dark;
    trend.setOption({
      color: [chart.categorical[0], chart.categorical[2]],
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: '#AEAEB2' } },
      grid: { left: 48, right: 24, top: 36, bottom: 28 },
      xAxis: { type: 'category', data: data.trend.map((row) => row.date.slice(5)), axisLabel: { color: '#86868B' }, axisLine: { lineStyle: { color: grid } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: grid } }, axisLabel: { color: '#86868B' } },
      series: [{ name: '播放', type: 'line', smooth: true, data: data.trend.map((row) => row.views), areaStyle: { color: 'rgba(214,21,60,.18)' } }],
    });
    top.setOption({
      color: [chart.categorical[0]],
      grid: { left: 100, right: 24, top: 16, bottom: 24 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: grid } }, axisLabel: { color: '#86868B' } },
      yAxis: { type: 'category', data: data.top.map((row) => row.title).reverse(), axisLabel: { color: '#AEAEB2', width: 88, overflow: 'truncate' } },
      series: [{ type: 'bar', data: data.top.map((row) => row.views).reverse(), barMaxWidth: 18 }],
    });
    const onResize = () => { trend.resize(); top.resize(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); trend.dispose(); top.dispose(); };
  }, [data]);

  const client = user?.role === 'CLIENT';
  return (
    <div>
      <PageHead title={client ? '数据总览' : '数据看板'} hint={data?.conclusion} />
      <ErrorNote error={error} />
      <div className="stat-row">
        <Card className="ds-stat"><Statistic title="播放" value={data?.views ?? 0} /></Card>
        <Card className="ds-stat"><Statistic title="估算人民币" value={data ? money(data.revenueCny) : '—'} /></Card>
        <Card className="ds-stat"><Statistic title="正在发行的剧" value={data?.liveDramas ?? 0} /></Card>
        <Card className="ds-stat"><Statistic title="在架平台" value={data?.platformCount ?? 0} suffix={data?.platforms?.length ? '' : ''} /></Card>
      </div>
      <p style={{ color: 'var(--ds-text-3)', marginTop: -8 }}>{data?.asOf}。{data?.revenueNote}{data?.delta != null ? ` 近 7 天播放较前一周 ${data.delta >= 0 ? '+' : ''}${data.delta}%。` : ''}</p>
      <Row gutter={16}>
        <Col xs={24} lg={14}><Card title="播放趋势"><div id="trend-chart" className="chart-box" /></Card></Col>
        <Col xs={24} lg={10}><Card title="播放最多"><div id="top-chart" className="chart-box" /></Card></Col>
      </Row>
    </div>
  );
}
