const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome' }); const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = [], fails = []; p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300))); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const base = 'file://' + encodeURI('/workspace/proto-v3/短剧发行平台原型-第一稿.html') + '#';
  const fs = require('fs'); fs.rmSync('shots', { recursive: true, force: true }); fs.mkdirSync('shots', { recursive: true });
  const shot = async (n) => { await p.waitForTimeout(600); await p.screenshot({ path: `shots/${n}.png` }); };
  const go = async (h) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(800); };
  const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(300); };
  const role = async (name) => { if (!(await p.evaluate(() => location.hash.startsWith('#/o') || location.hash.startsWith('#/a')))) await go('/o/workbench'); await p.mouse.move(10, 400); await p.waitForTimeout(200); await p.locator('header .ant-avatar').hover(); await p.waitForTimeout(500); const it = p.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: name }); if (!(await it.count())) { await p.locator('header .ant-avatar').click(); await p.waitForTimeout(400); } await it.first().click(); await p.waitForTimeout(400); await p.mouse.move(10, 400); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(name + ': ' + e.message.split('\n').slice(0, 3).join(' | ')); await p.keyboard.press('Escape').catch(() => {}); } };
  const T = 4000; p.setDefaultTimeout(T);
  await p.goto(base + '/login'); await p.waitForTimeout(1200);
  await step('routes', async () => {
    const pages = [['01-login', '/login'], ['02-dashboard', '/u/dashboard'], ['03-library', '/u/library'], ['05-upload', '/u/upload'], ['07-plans', '/u/plans'], ['08-drama-live', '/u/drama/D10001'], ['09-drama-reject', '/u/drama/D10004?tab=eps'], ['11-settle', '/u/settle'], ['13-contracts', '/u/contracts'], ['14-tickets', '/u/tickets'], ['16-account', '/u/account'], ['18-utasks', '/u/tasks'], ['19-organize', '/u/organize'], ['17-404-user', '/u/nothing'],
      ['20-ops-workbench', '/o/workbench'], ['21-ops-customers', '/o/customers'], ['22-ops-review', '/o/review'], ['25-ops-share', '/o/share'], ['27-ops-dist', '/o/distribution'], ['28-ops-sync', '/o/sync'], ['30-ops-watermark', '/o/watermark'], ['31-ops-tickets', '/o/tickets'], ['32-ops-contracts', '/o/contracts'], ['33-ops-settle', '/o/settle'], ['37-ops-404', '/o/notexist'], ['38-ops-forbidden-rates', '/o/rates'], ['39-ops-forbidden-admin', '/a/roles']];
    for (const [n, h] of pages) { await go(h); if (n === '03-library') { await shot('03a-library-tour'); const sk = p.locator('.ant-tour a', { hasText: '跳过全部' }); if (await sk.count()) await sk.click(); } await shot(n); }
  });
  // ── 注册新账号空状态
  await step('register', async () => {
    await go('/login'); await p.locator('.ant-tabs-tab', { hasText: '注册企业账号' }).click(); await p.waitForTimeout(300); await shot('50-register');
    await p.locator('#c').fill('青柠短剧工作室（厦门）'); await p.locator('#m').fill('boss@qingning.cn'); await p.locator('#p').fill('12345678'); await p.locator('button', { hasText: '获取验证码' }).click(); await p.locator('#v').fill('123456'); await p.locator('button', { hasText: '注册并进入' }).click(); await p.waitForTimeout(900);
    await shot('51-new-dashboard'); await go('/u/library'); await shot('52-new-library'); await go('/u/settle'); await shot('53-new-settle'); await go('/u/account'); await shot('54-new-account');
  });
  await step('new-cert', async () => {
    await p.locator('button', { hasText: '去认证' }).first().click(); await p.waitForTimeout(400);
    await p.locator('.ant-modal input[type=file]').setInputFiles({ name: '营业执照_青柠.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') }); await p.waitForTimeout(300); await shot('55-cert-step1');
    await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await p.locator('#legal').fill('林青'); await p.locator('#contact').fill('13800002222'); await shot('55b-cert-step2'); await p.locator('.ant-modal button', { hasText: '提交认证' }).click(); await p.waitForTimeout(400);
    await p.locator('.card .ant-upload button', { hasText: '上传' }).locator('xpath=..').locator('input[type=file]').setInputFiles({ name: '青柠_2026授权书.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }).catch(async () => { await p.locator('input[type=file]').last().setInputFiles({ name: '青柠_2026授权书.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); });
    await p.waitForTimeout(400); await shot('56-new-account-pending');
  });
  await step('ops-bell+cert+lic', async () => {
    await go('/o/workbench'); await p.locator('header .anticon-bell').click(); await p.waitForTimeout(400); await shot('57-ops-bell'); await esc();
    await go('/o/customers'); await p.locator('input[placeholder*="客户名"]').fill('青柠短剧'); await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.locator('button', { hasText: '审核认证' }).first().click(); await shot('58-ops-cert-drawer'); await p.locator('.ant-drawer button', { hasText: '通过' }).click(); await p.waitForTimeout(300);
    await go('/o/customers?tab=lic'); await shot('59-ops-lic-review'); await p.locator('.ant-table-row', { hasText: '青柠_2026授权书' }).locator('button', { hasText: '通过' }).click(); await p.waitForTimeout(300); await shot('59b-ops-lic-after');
  });
  await step('new-after', async () => { await go('/u/account'); await p.locator('header .anticon-bell').click(); await p.waitForTimeout(400); await shot('60-new-user-bell'); await esc(); await shot('60b-new-account-ok'); });
  // ── 切回演示账号
  await step('switch-demo', async () => { await p.locator('header .ant-avatar').hover(); await p.waitForTimeout(400); await shot('61-switch-demo-menu'); await p.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: '切换到演示账号' }).click(); await p.mouse.move(10, 400); await p.waitForTimeout(800); await shot('61b-demo-dashboard'); });
  // ── 发行（2 步）
  await step('publish', async () => {
    await go('/u/library'); await p.locator('.stcard', { hasText: '草稿' }).click(); await p.waitForTimeout(400); for (let i = 0; i < 5; i++) await p.locator('.vcard .ck').nth(i).click({ force: true });
    await p.locator('.floatbar button', { hasText: '申请发行' }).click(); await p.waitForTimeout(400); await p.locator('.pick', { hasText: '首发' }).click(); await shot('62-publish-step1');
    await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await shot('62b-publish-check'); await p.locator('.ant-modal button', { hasText: /^提交/ }).click(); await shot('62c-publish-done'); await esc();
  });
  // ── 提款全链路
  await step('withdraw-client', async () => {
    await go('/u/settle'); await p.locator('button', { hasText: '一键提款' }).click(); await shot('63-withdraw-step1'); await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await shot('63b-withdraw-account');
    await p.locator('.ant-modal button', { hasText: '提交提款' }).click(); await shot('63c-withdraw-done'); await p.locator('.ant-modal button', { hasText: '好的' }).click(); await shot('63d-settle-checking');
  });
  await step('withdraw-ops', async () => {
    await go('/o/withdraw'); await shot('64-ops-withdraw-tabs'); await role('赵倩'); await go('/o/withdraw');
    await p.locator('.ant-table-row', { hasText: '星河影业（杭州）' }).first().locator('button', { hasText: '核对通过' }).click(); await p.waitForTimeout(300);
    await p.locator('.ant-tabs-tab', { hasText: '待开票' }).click(); await shot('64b-ops-wait-invoice');
  });
  await step('withdraw-invoice', async () => {
    await go('/u/settle'); await shot('65-client-need-invoice'); await p.locator('.wdcard button', { hasText: '上传发票' }).first().click(); await p.waitForTimeout(300); await shot('65b-invoice-modal');
    await p.locator('.ant-modal input[type=file]').setInputFiles({ name: '发票_星河_2610.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await p.waitForTimeout(400); await shot('65c-after-invoice');
  });
  await step('withdraw-audit-pay', async () => {
    await go('/o/withdraw'); await p.locator('.ant-tabs-tab', { hasText: '发票审核中' }).click(); await p.locator('.ant-table-row', { hasText: '发票_星河_2610' }).locator('button', { hasText: '审核发票' }).click(); await p.waitForTimeout(300);
    for (const c of await p.locator('.ant-drawer .ant-checkbox-input').all()) await c.check(); await shot('66-invoice-audit'); await p.locator('.ant-drawer button', { hasText: '通过' }).click(); await p.waitForTimeout(300);
    await p.locator('.ant-tabs-tab', { hasText: '打款中' }).click(); await p.locator('.ant-table-row', { hasText: '发票_星河_2610' }).locator('button', { hasText: '确认打款' }).click(); await p.waitForTimeout(300); await shot('67-pay-no-voucher');
    await p.locator('.ant-modal input[type=file]').setInputFiles({ name: '回单_TX_星河.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await shot('67b-pay-voucher'); await p.locator('.ant-modal button', { hasText: '确认已打款' }).click(); await p.waitForTimeout(300);
    await p.locator('.ant-tabs-tab', { hasText: '已到账' }).click(); await shot('67c-paid');
    await go('/u/settle'); await shot('68-client-paid');
  });
  // ── 分成主管复核
  await step('share-sup', async () => {
    await role('林晓'); await go('/o/share'); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(1).check(); await p.locator('button', { hasText: '批量套用模板' }).click(); await p.locator('.ant-modal button', { hasText: '提交' }).click(); await p.waitForTimeout(3000);
    await p.locator('.ant-tabs-tab', { hasText: '分成复核' }).click(); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('button', { hasText: '批量复核通过' }).click(); await p.waitForTimeout(300); await shot('69-share-specialist-blocked');
    await role('王敏'); await go('/o/share?tab=review'); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('input[placeholder="退回原因"]').fill(''); await p.locator('button', { hasText: '批量复核通过' }).click(); await p.waitForTimeout(3000); await shot('69b-share-sup-pass');
    await go('/o/share'); await p.locator('.ant-table-tbody button', { hasText: '逐剧编辑' }).first().click(); await shot('69c-share-mode-illu'); await esc();
  });
  // ── 发行管理 → 已上架 → 客户联动
  await step('dist-live', async () => {
    await go('/o/distribution?q=D10001'); await shot('70-dist-search'); await go('/o/distribution'); await p.locator('.ant-segmented-item', { hasText: '二轮' }).click(); await shot('70b-dist-second');
    await go('/o/distribution?q=C20391'); await p.waitForTimeout(300);
    const row = p.locator('.ant-table-row', { hasText: '星河影业（杭州）' }).first(); const row2 = p.locator('.ant-table-row', { has: p.locator('.mcell', { hasText: '待上架' }) }).first(); const cell = row2.locator('.mcell', { hasText: '待上架' }).first(); let did = '';
    if (await cell.count()) { did = (await row2.locator('.meta').first().innerText()).trim(); await cell.click(); await p.locator('.ant-popover button', { hasText: '已上架' }).click(); await p.locator('#pid').fill('RS-889911'); await p.locator('#url').fill('https://reelshort.com/s/889911'); await shot('71-dist-live-form'); await p.locator('.ant-modal button.ant-btn-primary').click(); await p.waitForTimeout(400); }
    await go('/u/dashboard'); await p.locator('header .anticon-bell').click(); await p.waitForTimeout(400); await shot('72-client-live-notif'); await p.locator('.notif').first().click(); await p.waitForTimeout(700); await shot('72b-client-drama-plat');
  });
  // ── 数据导入 → 专员提交主管
  await step('sync-escalate', async () => {
    await role('林晓'); await go('/o/sync'); await p.locator('button', { hasText: '导入报表' }).first().click(); await p.locator('button', { hasText: '使用示例报表' }).click();
    await p.locator('.maprow.need .ant-select').click(); await p.locator('.ant-select-item', { hasText: '收入' }).first().click(); await p.locator('.wizfoot button', { hasText: '下一步' }).click();
    await p.locator('button', { hasText: '同名批量确认' }).click(); await p.locator('.wizfoot button', { hasText: '下一步' }).click(); await shot('73-import-validate'); await p.locator('.wizfoot button', { hasText: '下一步' }).click(); await shot('73b-import-specialist');
    await p.locator('button', { hasText: '提交主管处理' }).click(); await p.waitForTimeout(500); await shot('73c-escalated-board');
    await role('王敏'); await go('/o/sync'); await p.locator('header .anticon-bell').click(); await p.waitForTimeout(400); await shot('74-sup-bell'); await esc();
    await p.locator('button', { hasText: '主管处理' }).first().click(); await p.waitForTimeout(400); await shot('74b-sup-handle'); await p.locator('button', { hasText: '强制发布' }).click(); await p.waitForTimeout(400); await shot('74c-sup-published'); await esc();
  });
  // ── 合同线下签署
  await step('contract', async () => {
    await go('/o/contracts'); await p.locator('.ant-segmented-item', { hasText: '待签署' }).click(); await shot('75-ops-contract-pending');
    await go('/u/contracts'); await p.locator('.ant-segmented-item', { hasText: '待签署' }).click(); await p.waitForTimeout(300); await p.locator('.ccard').first().click(); await p.waitForTimeout(400); await shot('76-client-sign-steps');
    await p.locator('.ant-drawer input[type=file]').setInputFiles({ name: '合同盖章扫描件.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await p.waitForTimeout(300); await shot('76b-client-scan-uploaded'); await esc();
    await go('/o/contracts'); await p.locator('.ant-segmented-item', { hasText: '待确认' }).click(); await shot('77-ops-contract-confirm'); await p.locator('button', { hasText: '确认生效' }).first().click(); await p.waitForTimeout(300); await shot('77b-ops-contract-done');
  });
  // ── 审核：分派/抽检/SLA、容量
  await step('review-cfg', async () => {
    await go('/o/review-cfg'); await shot('78-sla-board'); await p.locator('.ant-tabs-tab', { hasText: '分派规则' }).click(); await shot('78b-assign-rule'); await p.locator('.ant-tabs-tab', { hasText: '抽检策略' }).click(); await shot('78c-sample-cfg');
    await go('/o/review'); await p.locator('.ant-tabs-tab', { hasText: '待分派' }).click(); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('.ant-select', { hasText: '分派给' }).click(); await p.waitForTimeout(300); await shot('79-assign-capacity'); await esc();
    await p.locator('.ant-table-thead .ant-dropdown-trigger').first().click().catch(() => {}); await p.waitForTimeout(300); await shot('79b-select-filtered'); await esc();
    await p.locator('button', { hasText: '列设置' }).click(); await p.waitForTimeout(300); await shot('79c-col-setting'); await esc();
    await go('/o/review/D10005'); await shot('80-review-desk');
  });
  // ── RBAC
  await step('rbac', async () => {
    await role('林晓'); await go('/o/workbench'); await shot('81-specialist-menu'); await go('/o/settle-review'); await shot('81b-specialist-forbidden');
    await go('/a/roles'); await shot('82-admin-forbidden'); await p.locator('button', { hasText: '切换为管理员' }).click(); await p.waitForTimeout(500); await shot('82b-admin-roles');
    await p.locator('.ant-table-row', { hasText: '汇率配置' }).locator('.ant-checkbox-input').nth(0).check(); await p.locator('button', { hasText: '保存' }).click(); await p.waitForTimeout(300);
    await go('/a/params'); await shot('83-admin-params'); await go('/a/logs'); await shot('84-admin-logs'); await go('/a/tasks'); await shot('85-admin-tasks');
    await role('林晓'); await go('/o/rates'); await shot('86-specialist-rates-granted');
  });
  await step('task-cancel', async () => {
    await go('/o/customers'); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('.ant-select', { hasText: '分配给' }).click(); await p.locator('.ant-select-item').first().click(); await p.locator('[data-testid=tasks]').click(); await p.waitForTimeout(300); await p.locator('.ant-drawer a', { hasText: '取消' }).first().click(); await shot('87-task-cancelled'); await esc();
  });
  await step('misc', async () => { await go('/u/dashboard'); await p.locator('.syncb .sb').first().hover(); await p.waitForTimeout(400); await shot('88-sync-badge'); await go('/u/tickets'); await shot('89-tickets-wording'); await go('/u/settle'); await p.locator('.scard').nth(2).click(); await shot('90-statement'); await esc(); });
  console.log('FAILS:', JSON.stringify(fails, null, 1)); console.log('ERRORS:', JSON.stringify(errs, null, 1)); await b.close();
})();
