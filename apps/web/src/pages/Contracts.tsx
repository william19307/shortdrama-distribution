import { App, Button, Form, Input, Modal, Select, Space, Table } from 'antd';
import { useEffect, useState } from 'react';
import { api, qs, type Page } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, StatusTag } from '../ui';

interface Contract { id: string; code: string; title: string; type: string; status: string; note?: string; company?: { name: string }; dramas?: { drama: { title: string } }[] }
interface DramaOpt { id: string; title: string; code: string }

export function ContractsPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const client = user?.role === 'CLIENT';
  const [rows, setRows] = useState<Page<Contract> | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [dramas, setDramas] = useState<DramaOpt[]>([]);
  const [page, setPage] = useState(1);

  const load = () => api<Page<Contract>>(`/contracts${qs({ page, pageSize: 20 })}`).then(setRows).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <PageHead title="合同申请及列表" extra={client ? <Button type="primary" onClick={async () => { setOpen(true); const list = await api<Page<DramaOpt>>('/dramas?page=1&pageSize=100'); setDramas(list.items); }}>申请合同</Button> : null} />
      <ErrorNote error={error} />
      <Table
        rowKey="id"
        dataSource={rows?.items || []}
        pagination={{ current: page, pageSize: 20, total: rows?.total || 0, onChange: setPage, showSizeChanger: false }}
        columns={[
          { title: '编号', dataIndex: 'code', width: 120 },
          { title: '标题', dataIndex: 'title' },
          { title: '客户', dataIndex: ['company', 'name'], render: (value: string) => value || '—' },
          { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag status={value} /> },
          { title: '剧目', render: (_: unknown, row: Contract) => row.dramas?.map((item) => item.drama.title).join('、') || '—' },
          {
            title: '',
            render: (_: unknown, row: Contract) => user && user.role !== 'CLIENT' ? (
              <Space>
                {['APPLYING', 'DRAFTING', 'PENDING_SIGN', 'EFFECTIVE'].map((status) => (
                  <Button key={status} size="small" onClick={async () => { await api(`/contracts/${row.id}`, { method: 'PATCH', json: { status } }); load(); }}>{status === row.status ? '当前' : status === 'DRAFTING' ? '起草' : status === 'PENDING_SIGN' ? '待签' : status === 'EFFECTIVE' ? '生效' : ''}</Button>
                )).filter((node) => node.props.children)}
              </Space>
            ) : null,
          },
        ].filter((col) => client ? col.title !== '客户' : true)}
      />
      <Modal title="申请合同" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={async (values) => {
          try {
            await api('/contracts', { method: 'POST', json: values });
            message.success('已提交申请');
            setOpen(false);
            load();
          } catch (err) { message.error(err instanceof Error ? err.message : '没有提交'); }
        }}>
          <Form.Item name="title" label="合同标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="DISTRIBUTION"><Select options={[{ value: 'DISTRIBUTION', label: '发行合同' }, { value: 'SUPPLEMENT', label: '补充协议' }]} /></Form.Item>
          <Form.Item name="dramaIds" label="关联剧目" rules={[{ required: true }]}><Select mode="multiple" options={dramas.map((item) => ({ value: item.id, label: `${item.code} ${item.title}` }))} /></Form.Item>
          <Form.Item name="note" label="说明"><Input.TextArea /></Form.Item>
          <Button type="primary" htmlType="submit">提交</Button>
        </Form>
      </Modal>
    </div>
  );
}
