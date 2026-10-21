import { App, Button, Form, Input, List, Space, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, qs, type Page } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, PageHead, StatusTag, labelOf } from '../ui';

interface Ticket {
  id: string; code: string; title: string; body: string; type: string; status: string; createdAt: string;
  drama?: { title?: string } | null;
  messages?: { id: string; authorName: string; content: string; createdAt: string }[];
  shots?: { id: string; url: string | null; sha256: string; shortHash: string; filename: string }[];
}

export function TicketsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const { user } = useAuth();
  const [list, setList] = useState<Page<Ticket> | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');

  const loadList = () => api<Page<Ticket>>(`/tickets${qs({ page: 1, pageSize: 50 })}`).then(setList).catch((err) => setError(err.message));
  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    if (!id) { setTicket(null); return; }
    api<Ticket>(`/tickets/${id}`).then(async (row) => {
      if (user?.role === 'CLIENT' && row.status === 'PENDING_CLIENT') {
        const read = await api<Ticket>(`/tickets/${id}/read`, { method: 'POST' });
        setTicket(read);
      } else setTicket(row);
    }).catch((err) => setError(err.message));
  }, [id, user?.role]);

  return (
    <div>
      <PageHead title="消息与工单" hint="审核结果和带时间戳的防伪截图都会出现在这里。" />
      <ErrorNote error={error} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16 }}>
        <List
          dataSource={list?.items || []}
          renderItem={(item) => (
            <List.Item style={{ cursor: 'pointer', background: item.id === id ? 'var(--ds-surface-2)' : undefined }} onClick={() => nav(`/tickets/${item.id}`)}>
              <List.Item.Meta title={<span>{item.title}</span>} description={<span>{item.code} · {labelOf(item.type)} · <StatusTag status={item.status} /></span>} />
            </List.Item>
          )}
        />
        <div>
          {ticket ? (
            <>
              <Space><b>{ticket.title}</b><StatusTag status={ticket.status} /><Tag>{labelOf(ticket.type)}</Tag></Space>
              <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.body}</p>
              {(ticket.shots || []).map((shot) => (
                <figure key={shot.id}>
                  {shot.url ? <img src={shot.url} alt="防伪截图" style={{ maxWidth: '100%', borderRadius: 8 }} /> : null}
                  <figcaption style={{ color: 'var(--ds-text-3)' }}>校验 {shot.shortHash}</figcaption>
                </figure>
              ))}
              <List dataSource={ticket.messages || []} renderItem={(item) => <List.Item><List.Item.Meta title={item.authorName} description={item.content} /></List.Item>} />
              <Form onFinish={async () => {
                try {
                  const next = await api<Ticket>(`/tickets/${ticket.id}/messages`, { method: 'POST', json: { content: text } });
                  setTicket(next);
                  setText('');
                  loadList();
                } catch (err) { message.error(err instanceof Error ? err.message : '没有发出'); }
              }}>
                <Input.TextArea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="补充说明" />
                <Button htmlType="submit" type="primary" style={{ marginTop: 8 }} disabled={!text.trim()}>发送</Button>
              </Form>
            </>
          ) : <span style={{ color: 'var(--ds-text-3)' }}>从左边选一张工单。</span>}
        </div>
      </div>
    </div>
  );
}
