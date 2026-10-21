import { Button, List, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api, qs } from '../api';
import { ErrorNote, PageHead } from '../ui';

interface Note {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPage() {
  const [rows, setRows] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const load = () =>
    api<{ items: Note[]; unread: number }>(`/notifications${qs({ page: 1, pageSize: 50 })}`)
      .then((res) => {
        setRows(res.items);
        setUnread(res.unread || 0);
      })
      .catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHead title="站内消息" hint="数据未完成、审核超时和名单确认都会记在这里。工单仍在「消息与工单」。" />
      <ErrorNote error={error} />
      <Space style={{ marginBottom: 12 }}>
        <span>未读 {unread}</span>
        <Button
          disabled={!unread}
          onClick={async () => {
            await api('/notifications/read-all', { method: 'POST' });
            load();
          }}
        >
          全部已读
        </Button>
      </Space>
      <List
        dataSource={rows}
        locale={{ emptyText: '还没有站内消息' }}
        renderItem={(item) => (
          <List.Item
            style={{ cursor: 'pointer', fontWeight: item.readAt ? 400 : 600, paddingInline: 12 }}
            onClick={async () => {
              if (!item.readAt) await api(`/notifications/${item.id}/read`, { method: 'POST' });
              load();
            }}
          >
            <List.Item.Meta
              title={<span>{item.readAt ? null : <Typography.Text type="danger">● </Typography.Text>}{item.title}</span>}
              description={
                <>
                  <div>{item.body}</div>
                  <Typography.Text type="secondary">{new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}</Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
}
