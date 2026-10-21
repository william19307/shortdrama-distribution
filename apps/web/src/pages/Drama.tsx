import { amountColumn } from '@ds/antdTheme';
import { App, Button, Descriptions, Form, Input, InputNumber, Modal, Progress, Select, Space, Steps, Table, Tabs, Tag, Upload } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile } from '../api';
import { useAuth } from '../auth';
import { EPISODE_CLIENT, ErrorNote, PageHead, PhaseTag, PlatformChip, StatusTag, labelOf } from '../ui';

interface Platform { id: string; name: string; firstBatch: boolean; enabled: boolean }
interface Episode { id: string; no: number; fileName: string | null; reviewStatus: string; rejectReason: string | null; fileSize: string | null }
interface Asset { id: string; type: string; name: string; fileKey: string; reviewStatus?: string; rejectReason?: string | null }
interface Plan {
  id: string; code: string; status: string; round: string; statusLabel?: string; phase?: string; phaseLabel?: string;
  expectedFinish?: string | null; precheckNote?: string | null; rejectSummary?: string | null;
  platforms: { id: string; platformId: string; platformName: string; listingStatus: string }[];
  shares: { id: string; platformId: string; clientRate: string; overRate?: string | null; mode?: string; reviewStatus: string }[];
}
interface Drama {
  id: string; code: string; title: string; titleEn: string; synopsis: string; genre: string; language: string;
  episodeCountExpected: number | null; phase: string; coverUrl: string | null;
  episodes: Episode[]; assets: Asset[]; plans: Plan[]; company: { name: string };
}

export function DramaPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const { user } = useAuth();
  const client = user?.role === 'CLIENT';
  const staffReview = user?.role === 'OPS' || user?.role === 'OPS_MANAGER' || user?.role === 'ADMIN';
  const [drama, setDrama] = useState<Drama | null>(null);
  const [error, setError] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [upload, setUpload] = useState<{ name: string; percent: number; error?: string; retry?: () => void } | null>(null);
  const [round, setRound] = useState<'FIRST' | 'SECOND'>('FIRST');
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [episodeNo, setEpisodeNo] = useState(1);

  const load = () => {
    if (!id || id === 'new') return;
    api<Drama>(`/dramas/${id}`).then(setDrama).catch((err) => setError(err.message));
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api<Platform[]>('/platforms').then(setPlatforms).catch(() => undefined); }, []);

  if (id === 'new') {
    return (
      <div>
        <PageHead title="新建剧目" hint="先建档，再上传成片、封面和授权材料。" />
        <Form layout="vertical" style={{ maxWidth: 560 }} onFinish={async (values) => {
          try {
            const created = await api<Drama>('/dramas', { method: 'POST', json: values });
            message.success('剧目已建立');
            nav(`/dramas/${created.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : '没有建成');
          }
        }}>
          <ErrorNote error={error} />
          <Form.Item name="title" label="剧名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="titleEn" label="外文名"><Input /></Form.Item>
          <Form.Item name="genre" label="题材"><Input placeholder="例如 甜宠、逆袭" /></Form.Item>
          <Form.Item name="language" label="成片语言" initialValue="英语"><Input /></Form.Item>
          <Form.Item name="episodeCountExpected" label="计划集数"><InputNumber min={1} max={500} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="synopsis" label="简介"><Input.TextArea rows={4} /></Form.Item>
          <Button type="primary" htmlType="submit">保存</Button>
        </Form>
      </div>
    );
  }

  const first = platforms.filter((item) => item.firstBatch && item.enabled);
  const sendFile = async (file: File, purpose: string, no?: number) => {
    setUpload({ name: file.name, percent: 0 });
    try {
      await uploadFile(file, purpose, { dramaId: id, episodeNo: no }, { onProgress: (ratio) => setUpload({ name: file.name, percent: Math.round(ratio * 100) }) });
      message.success('已保存');
      setUpload(null);
      load();
    } catch (err) {
      const text = err instanceof Error ? err.message : '上传失败，可以重试';
      setUpload({ name: file.name, percent: 0, error: text, retry: () => sendFile(file, purpose, no) });
    }
  };

  const apply = async () => {
    try {
      const names = custom.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      const plan = await api<Plan>('/plans', {
        method: 'POST',
        json: {
          dramaId: id,
          round,
          platformIds: round === 'SECOND' ? picked : undefined,
          customPlatforms: round === 'SECOND' ? names : undefined,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (plan.status === 'PRECHECK_FAILED') message.warning(plan.precheckNote || '预检没有通过');
      else message.success(plan.phaseLabel || '申请已提交');
      setApplyOpen(false);
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '没有提交');
    }
  };

  return (
    <div>
      <PageHead
        title={drama ? `${drama.title}` : '剧目'}
        hint={drama ? `${drama.code}${drama.titleEn ? ` · ${drama.titleEn}` : ''}${client ? '' : ` · ${drama.company?.name || ''}`}` : ''}
        extra={drama ? <Space><PhaseTag phase={drama.phase} />{client ? <Button type="primary" onClick={() => setApplyOpen(true)}>申请发行</Button> : null}</Space> : null}
      />
      <ErrorNote error={error} />
      {drama ? (
        <>
          <Space align="start" size={20} style={{ marginBottom: 16, width: '100%' }}>
            <div className="ds-poster" style={{ width: 160, flex: '0 0 160px' }}>
              {drama.coverUrl ? <img src={drama.coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              <div className="ds-poster__art" style={{ background: drama.coverUrl ? 'var(--ds-grad-bar)' : 'var(--ds-grad-bento)' }}>
                <div className="ds-poster__title" style={{ fontSize: 'var(--ds-fs-h4)' }}>{drama.title}</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 'var(--ds-fs-h2)', letterSpacing: 'var(--ds-ls-h2)', lineHeight: 'var(--ds-lh-h2)', margin: '0 0 12px' }}>{drama.title}</h2>
              <Steps size="small" current={flowStep(drama)} items={[{ title: '上传' }, { title: '审核' }, { title: '本地化' }, { title: '分发' }, { title: '结算' }]} style={{ marginBottom: 16 }} />
              <Descriptions column={1} size="small">
                <Descriptions.Item label="题材">{drama.genre || '—'}</Descriptions.Item>
                <Descriptions.Item label="语言">{drama.language}</Descriptions.Item>
                <Descriptions.Item label="简介">{drama.synopsis || '还没有简介'}</Descriptions.Item>
              </Descriptions>
            </div>
          </Space>
          <Tabs items={[
            {
              key: 'ep',
              label: `分集 ${drama.episodes.length}`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {client || staffReview ? (
                    <Space>
                      <InputNumber min={1} value={episodeNo} onChange={(value) => setEpisodeNo(value || 1)} />
                      <Upload showUploadList={false} beforeUpload={(file) => { sendFile(file, 'EPISODE', episodeNo); return false; }}>
                        <Button>上传这一集</Button>
                      </Upload>
                      <Upload showUploadList={false} beforeUpload={(file) => { sendFile(file, 'COVER'); return false; }}><Button>上传封面</Button></Upload>
                    </Space>
                  ) : null}
                  {upload ? (
                    <div style={{ maxWidth: 420 }}>
                      <div style={{ marginBottom: 4 }}>{upload.name}{upload.error ? ` · ${upload.error}` : ''}</div>
                      <Progress percent={upload.percent} status={upload.error ? 'exception' : upload.percent >= 100 ? 'success' : 'active'} />
                      {upload.error && upload.retry ? <Button size="small" onClick={upload.retry}>重试</Button> : null}
                    </div>
                  ) : null}
                  <Table rowKey="id" pagination={false} dataSource={drama.episodes} columns={[
                    { title: '集', dataIndex: 'no', width: 70 },
                    { title: '文件', dataIndex: 'fileName', render: (value) => value || '未上传' },
                    { title: '大小', dataIndex: 'fileSize', width: 120, render: (value) => value ? `${(Number(value) / 1024 / 1024).toFixed(1)} MB` : '—' },
                    { title: '审核', dataIndex: 'reviewStatus', render: (value, row: Episode) => <span><StatusTag status={value} text={client ? EPISODE_CLIENT[value] || labelOf(value) : undefined} /> {row.rejectReason ? <span style={{ color: 'var(--ds-text-2)' }}>{row.rejectReason}</span> : null}</span> },
                  ]} />
                </Space>
              ),
            },
            {
              key: 'docs',
              label: '授权与版权',
              children: (
                <Space direction="vertical">
                  {client ? (
                    <Space>
                      <Upload showUploadList={false} beforeUpload={(file) => { sendFile(file, 'LICENSE'); return false; }}><Button>上传授权书</Button></Upload>
                      <Upload showUploadList={false} beforeUpload={(file) => { sendFile(file, 'COPYRIGHT'); return false; }}><Button>上传版权证明</Button></Upload>
                    </Space>
                  ) : null}
                  {drama.assets.map((asset) => (
                    <Space key={asset.id}>
                      <Tag>{asset.type === 'LICENSE' ? '授权书' : asset.type === 'COPYRIGHT' ? '版权证明' : asset.type}</Tag>
                      <span>{asset.name}</span>
                      {asset.reviewStatus ? <StatusTag status={asset.reviewStatus} /> : null}
                      {staffReview && (asset.type === 'LICENSE' || asset.type === 'COPYRIGHT') && asset.reviewStatus !== 'APPROVED' ? (
                        <Button size="small" type="primary" disabled={user?.role === 'ADMIN'} onClick={async () => { try { await api(`/assets/${asset.id}/review`, { method: 'POST', json: { pass: true } }); message.success('授权材料已通过'); const next = await api<Drama>(`/dramas/${id}`); setDrama(next); } catch (err) { message.error(err instanceof Error ? err.message : '没有通过'); } }}>审核通过</Button>
                      ) : null}
                    </Space>
                  ))}
                  {!drama.assets.length ? <span style={{ color: 'var(--ds-text-3)' }}>还没有授权材料。申请发行前需要授权书或版权证明。</span> : null}
                </Space>
              ),
            },
            {
              key: 'plans',
              label: '发行计划',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {drama.plans.map((plan) => (
                    <div key={plan.id} style={{ border: '1px solid var(--ds-border)', borderRadius: 12, padding: 12 }}>
                      <Space>
                        <b>{plan.code}</b>
                        <Tag>{labelOf(plan.round)}</Tag>
                        <StatusTag status={plan.status} text={client ? plan.phaseLabel : plan.statusLabel} />
                        {client && plan.expectedFinish ? <span style={{ color: 'var(--ds-text-2)' }}>{plan.expectedFinish}</span> : null}
                      </Space>
                      {plan.precheckNote ? <p>{plan.precheckNote}</p> : null}
                      {plan.rejectSummary ? <pre style={{ whiteSpace: 'pre-wrap' }}>{plan.rejectSummary}</pre> : null}
                      <div style={{ marginTop: 8 }}>{plan.platforms.map((item) => <PlatformChip key={item.id} name={item.platformName} sync={labelOf(item.listingStatus)} />)}</div>
                      {plan.shares?.length ? (
                        <Table
                          style={{ marginTop: 8 }}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          dataSource={plan.shares}
                          columns={[
                            { title: '平台', render: (_: unknown, share: Plan['shares'][number]) => <PlatformChip name={plan.platforms.find((item) => item.platformId === share.platformId)?.platformName || '平台'} /> },
                            { title: '分成比例', dataIndex: 'clientRate', className: 'ds-num', align: 'right' as const, render: (value: string) => `${value}%` },
                            amountColumn<Plan['shares'][number]>({ title: '超出后比例', dataIndex: 'overRate', currency: '', digits: 2 }),
                            ...(client ? [] : [{ title: '方式', dataIndex: 'mode', render: (value: string) => labelOf(value) }]),
                          ]}
                        />
                      ) : null}
                      <Space style={{ marginTop: 8 }}>
                        {client && ['PENDING_ASSIGN', 'PENDING_REVIEW'].includes(plan.status) ? <Button onClick={async () => { await api(`/plans/${plan.id}/withdraw`, { method: 'POST' }); load(); }}>撤回</Button> : null}
                        {client && plan.status === 'NEEDS_REVISION' ? <Button type="primary" onClick={async () => { try { await api(`/plans/${plan.id}/resubmit`, { method: 'POST' }); message.success('已重新提交'); load(); } catch (err) { message.error(err instanceof Error ? err.message : '还不能提交'); } }}>重新提交</Button> : null}
                        {staffReview ? <Button onClick={() => nav(`/reviews/${plan.id}`)}>打开审核</Button> : null}
                      </Space>
                    </div>
                  ))}
                  {!drama.plans.length ? <span style={{ color: 'var(--ds-text-3)' }}>还没有发行申请。</span> : null}
                </Space>
              ),
            },
          ]} />
        </>
      ) : null}
      <Modal title="申请发行" open={applyOpen} onCancel={() => setApplyOpen(false)} onOk={apply} okText="提交">
        <p>首发固定为当前启用的五家平台，不能删掉其中任何一家。二轮请自己填写要去的平台。提交后由你自行把成片交给平台，这里不代为推送。</p>
        <SegmentedRound value={round} onChange={setRound} />
        {round === 'FIRST' ? (
          <Space wrap>{first.map((item) => <Tag key={item.id}>{item.name}</Tag>)}</Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select mode="multiple" style={{ width: '100%' }} placeholder="选择已有平台" value={picked} onChange={setPicked} options={platforms.filter((item) => item.enabled).map((item) => ({ value: item.id, label: item.name }))} />
            <Input placeholder="手填平台名，多个用逗号隔开" value={custom} onChange={(event) => setCustom(event.target.value)} />
          </Space>
        )}
      </Modal>
    </div>
  );
}

function flowStep(drama: Drama) {
  if (!drama.episodes.length) return 0;
  if (drama.phase === 'action' || drama.phase === 'review') return 1;
  if (drama.phase === 'ready') return 2;
  if (drama.phase === 'live') return 3;
  return drama.assets.length ? 2 : 0;
}

function SegmentedRound({ value, onChange }: { value: 'FIRST' | 'SECOND'; onChange: (value: 'FIRST' | 'SECOND') => void }) {
  return (
    <Space style={{ margin: '12px 0' }}>
      <Button type={value === 'FIRST' ? 'primary' : 'default'} onClick={() => onChange('FIRST')}>首发</Button>
      <Button type={value === 'SECOND' ? 'primary' : 'default'} onClick={() => onChange('SECOND')}>二轮</Button>
    </Space>
  );
}
