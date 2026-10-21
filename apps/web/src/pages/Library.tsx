import { Button, Input, Segmented, Select, Space, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, download, qs, type Page } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, PhaseTag, dayText } from '../ui';

interface DramaCard {
  id: string;
  code: string;
  title: string;
  titleEn: string;
  genre: string;
  language: string;
  phase: string;
  coverUrl: string | null;
  updatedAt: string;
  company?: { name: string };
  _count?: { episodes: number };
}

export function LibraryPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const client = user?.role === 'CLIENT';
  const [view, setView] = useState<'wall' | 'table'>('wall');
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState<string>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<DramaCard> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api<Page<DramaCard>>(`/dramas${qs({ q, phase, page, pageSize: 24, sort: 'updatedAt', order: 'desc' })}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [q, phase, page]);

  return (
    <div>
      <PageHead
        title={client ? '我的剧集' : '视频库'}
        hint="列表在服务端分页和筛选，适合几百到几千部剧。"
        extra={client ? <Button type="primary" onClick={() => nav('/dramas/new')}>新建剧目</Button> : <Button onClick={() => download(`/dramas/export${qs({ q, phase })}`, 'dramas.csv').catch((err) => setError(err.message))}>导出</Button>}
      />
      <ErrorNote error={error} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear placeholder="剧名、外文名或编号" style={{ width: 260 }} onSearch={(value) => { setPage(1); setQ(value); }} />
        <Select
          allowClear
          placeholder="发行状态"
          style={{ width: 160 }}
          value={phase}
          onChange={(value) => { setPage(1); setPhase(value); }}
          options={['action', 'review', 'ready', 'live', 'offline', 'withdrawn', 'idle'].map((value) => ({ value, label: { action: '需要处理', review: '审核中', ready: '准备上架', live: '已上架', offline: '已下架', withdrawn: '已撤回', idle: '未发行' }[value] }))}
        />
        <Segmented value={view} onChange={(value) => setView(value as 'wall' | 'table')} options={[{ label: '封面', value: 'wall' }, { label: '表格', value: 'table' }]} />
      </Space>
      {view === 'wall' ? (
        <div className="poster-grid">
          {(data?.items || []).map((drama) => (
            <button key={drama.id} className="ds-poster" onClick={() => nav(`/dramas/${drama.id}`)}>
              {drama.coverUrl ? <img src={drama.coverUrl} alt="" /> : null}
              <div className="ds-poster__art" style={{ background: drama.coverUrl ? 'linear-gradient(transparent, rgba(0,0,0,.85))' : 'var(--ds-grad-bento)' }}>
                <div className="ds-poster__kicker">{drama.code}</div>
                <div className="ds-poster__title">{drama.title}</div>
              </div>
              <div className="ds-poster__badge"><PhaseTag phase={drama.phase} /></div>
              <div className="ds-poster__info">{drama.genre || '未分题材'} · {drama.language} · {drama._count?.episodes ?? 0} 集</div>
            </button>
          ))}
        </div>
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data?.items || []}
          pagination={{ current: page, pageSize: 24, total: data?.total || 0, onChange: setPage, showSizeChanger: false }}
          onRow={(row) => ({ onClick: () => nav(`/dramas/${row.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '编号', dataIndex: 'code', width: 110 },
            { title: '剧名', dataIndex: 'title' },
            { title: '客户', dataIndex: ['company', 'name'], render: (value: string) => value || '—' },
            { title: '题材', dataIndex: 'genre' },
            { title: '语言', dataIndex: 'language', width: 90 },
            { title: '状态', dataIndex: 'phase', width: 120, render: (value: string) => <PhaseTag phase={value} /> },
            { title: '更新', dataIndex: 'updatedAt', width: 120, render: dayText },
          ].filter((col) => client ? col.title !== '客户' : true)}
        />
      )}
      {view === 'wall' && (data?.total || 0) > 24 ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">共 {data?.total} 部</Typography.Text>
          <Button style={{ marginLeft: 12 }} disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <Button style={{ marginLeft: 8 }} disabled={page * 24 >= (data?.total || 0)} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      ) : null}
    </div>
  );
}
