import { PlaySquareOutlined } from '@ant-design/icons';
import { motion as motionTokens } from '@ds/tokens';
import { Button, Checkbox, Input, Modal, Segmented, Select, Space, Table, Typography, Upload } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, download, getToken, qs, type Page } from '../api';
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
  techLabel?: string | null;
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
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [folder, setFolder] = useState<{ title: string; episodes: { no: number; fileName: string }[]; cover?: string; poster?: string; trailer?: string; subtitles: string[]; conflicts: string[] }[] | null>(null);

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
      {client ? (
        <Space wrap style={{ marginBottom: 16 }}>
          <Upload directory multiple showUploadList={false} beforeUpload={(file, list) => {
            if (file !== list[list.length - 1]) return false;
            const paths = list.map((item) => (item as File & { webkitRelativePath?: string }).webkitRelativePath || item.name).filter(Boolean);
            api<{ dramas: NonNullable<typeof folder> }>('/library/folder-preview', { method: 'POST', json: { paths } }).then((res) => setFolder(res.dramas)).catch((err) => setError(err.message));
            return false;
          }}><Button type="primary">上传文件夹</Button></Upload>
          <Button onClick={() => download('/dramas/metadata-template', 'metadata-template.xlsx')}>下载元数据模板</Button>
          <Upload accept=".xlsx" showUploadList={false} beforeUpload={async (file) => {
            const body = new FormData();
            body.append('file', file);
            try {
              const res = await api<{ applied: number; failed: number; rows: { rowNo: number; error: string }[] }>('/dramas/metadata-import', { method: 'POST', body });
              setNotice(`元数据已导入 ${res.applied} 行${res.failed ? `，${res.failed} 行有误` : ''}`);
              if (res.failed) setError(res.rows.filter((row) => row.error).map((row) => row.error).join('；'));
              load();
            } catch (err) { setError(err instanceof Error ? err.message : '没有导入'); }
            return false;
          }}><Button>导入元数据</Button></Upload>
        </Space>
      ) : null}
      <Modal title="匹配确认" open={Boolean(folder)} onCancel={() => setFolder(null)} okText="全部确认" onOk={async () => {
        if (!folder) return;
        const paths = folder.flatMap((drama) => [
          ...drama.episodes.map((episode) => `${drama.title}/${episode.fileName}`),
          drama.cover, drama.poster, drama.trailer, ...drama.subtitles,
        ].filter((item): item is string => Boolean(item)));
        await api('/library/folder-apply', { method: 'POST', json: { paths } });
        setFolder(null);
        setNotice('文件夹已确认');
        load();
      }}>
        {(folder || []).map((drama) => (
          <div key={drama.title} style={{ marginBottom: 12 }}>
            <b>{drama.title}</b>
            <div>{drama.episodes.length} 集已识别{drama.cover ? ' · 封面' : ''}{drama.poster ? ' · 海报' : ''}{drama.trailer ? ' · 预告' : ''}{drama.subtitles.length ? ' · 字幕' : ''}</div>
            {drama.conflicts.map((item) => <div key={item} style={{ color: '#cf1322' }}>{item}</div>)}
          </div>
        ))}
      </Modal>
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
      <AnimatePresence mode="wait">
        <motion.div key={view} {...motionTokens.presets.page}>
          {view === 'wall' ? (
            !data || loading ? null : data.items.length ? (
              <div className="poster-grid">
                {data.items.map((drama) => (
                  <motion.button key={drama.id} className="ds-poster" style={{ position: 'relative' }} onClick={() => nav(`/dramas/${drama.id}`)} {...motionTokens.presets.cardHover}>
                    <Checkbox checked={selected.includes(drama.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelected((cur) => event.target.checked ? [...new Set([...cur, drama.id])] : cur.filter((id) => id !== drama.id))} style={{ position: 'absolute', zIndex: 2, left: 8, top: 8 }} />
                    {drama.coverUrl ? <img src={drama.coverUrl} alt="" /> : null}
                    <div className="ds-poster__art" style={{ background: drama.coverUrl ? 'var(--ds-grad-bar)' : 'var(--ds-grad-bento)' }}>
                      <div className="ds-poster__kicker">{drama.code}</div>
                      <div className="ds-poster__title">{drama.title}</div>
                    </div>
                    <div className="ds-poster__badge"><PhaseTag phase={drama.phase} />{drama.techLabel ? <span style={{ marginLeft: 6 }}>{drama.techLabel}</span> : null}</div>
                    <div className="ds-poster__info">{drama.genre || '未分题材'} · {drama.language} · {drama._count?.episodes ?? 0} 集</div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="ds-empty">
                <div className="ds-empty__icon"><PlaySquareOutlined /></div>
                <h5>还没有剧</h5>
                <p>上传成片和封面后，会按封面墙排在这里。</p>
                {client ? <Button type="primary" onClick={() => nav('/dramas/new')}>新建剧目</Button> : null}
              </div>
            )
          ) : (
            <Table
              rowKey="id"
              loading={loading}
              dataSource={data?.items || []}
              rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys.map(String)) }}
              pagination={{ current: page, pageSize: 24, total: data?.total || 0, onChange: setPage, showSizeChanger: false }}
              onRow={(row) => ({ onClick: () => nav(`/dramas/${row.id}`), style: { cursor: 'pointer' } })}
              columns={[
                { title: '编号', dataIndex: 'code', width: 110, className: 'ds-num', align: 'right' as const },
                {
                  title: '剧名',
                  dataIndex: 'title',
                  render: (_: string, row: DramaCard) => (
                    <span className="ds-cover">
                      <span className="ds-poster">{row.coverUrl ? <img src={row.coverUrl} alt="" /> : <span className="ds-poster__art"><span className="ds-poster__title">{row.title.slice(0, 1)}</span></span>}</span>
                      <span><b>{row.title}</b><small>{row.code}</small></span>
                    </span>
                  ),
                },
                { title: '客户', dataIndex: ['company', 'name'], render: (value: string) => value || '—' },
                { title: '题材', dataIndex: 'genre' },
                { title: '语言', dataIndex: 'language', width: 90 },
                { title: '集数', dataIndex: ['_count', 'episodes'], width: 80, className: 'ds-num', align: 'right' as const, render: (value: number) => value ?? '—' },
                { title: '状态', dataIndex: 'phase', width: 120, render: (value: string) => <PhaseTag phase={value} /> },
                { title: '更新', dataIndex: 'updatedAt', width: 120, render: dayText },
              ].filter((col) => client ? col.title !== '客户' : true)}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {selected.length ? (
        <div style={{ position: 'fixed', zIndex: 20, left: 24, right: 24, bottom: 24, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--ds-bg-elevated, #fff)', border: '1px solid var(--ds-line, #e5e5e5)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          <b>已选 {selected.length}</b>
          <Button onClick={async () => {
            const all = await api<{ ids: string[]; total: number }>('/dramas/selection', { method: 'POST', json: { q: q || undefined, phase } });
            setSelected(all.ids);
            setNotice(`已选中全部筛选结果 ${all.total} 部`);
          }}>选中全部筛选结果（共 {data?.total || 0} 部）</Button>
          {client ? <Button type="primary" onClick={async () => {
            try {
              const res = await api<{ submittedCount: number; needsActionCount: number; needsAction: { title: string; reason: string }[] }>('/plans/batch', { method: 'POST', json: { dramaIds: selected, round: 'FIRST' } });
              setNotice(`已提交 ${res.submittedCount} 部，${res.needsActionCount} 部需处理${res.needsAction[0] ? `：${res.needsAction[0].reason}` : ''}。已记入任务中心`);
            } catch (err) { setError(err instanceof Error ? err.message : '没有提交'); }
          }}>申请发行</Button> : null}
          <Button onClick={async () => { const tag = window.prompt('标签') || ''; if (!tag) return; await api('/dramas/batch', { method: 'POST', json: { ids: selected, tag } }); setNotice('已打标签'); }}>打标签</Button>
          <Button onClick={async () => { const group = window.prompt('分组') || ''; if (!group) return; await api('/dramas/batch', { method: 'POST', json: { ids: selected, group } }); setNotice('已加入分组'); }}>加入分组</Button>
          <Button onClick={async () => {
            const headers = new Headers({ 'Content-Type': 'application/json' });
            const token = getToken();
            if (token) headers.set('Authorization', `Bearer ${token}`);
            const res = await fetch('/api/dramas/export', { method: 'POST', headers, body: JSON.stringify({ ids: selected, q: q || undefined, phase }) });
            if (!res.ok) { setError('导出失败'); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dramas.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}>导出</Button>
          <Button onClick={() => { setSelected([]); setNotice(''); }}>取消</Button>
          {notice ? <span style={{ color: 'var(--ds-text-3)' }}>{notice}</span> : null}
        </div>
      ) : null}
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
