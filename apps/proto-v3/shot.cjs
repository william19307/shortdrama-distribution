const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'}); const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push('PAGEERR '+e.message));
  const base = 'file:///workspace/proto-v3/%E7%9F%AD%E5%89%A7%E5%8F%91%E8%A1%8C%E5%B9%B3%E5%8F%B0%E5%8E%9F%E5%9E%8B-v3.html#';
  require('fs').mkdirSync('screenshots', { recursive: true });
  const only = process.argv[2];
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `screenshots/${n}.png` }); };
  const go = async (h) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(900); };
  await p.goto(base + '/login'); await p.waitForTimeout(1200);
  const pages = [['01-login','/login'],['02-dashboard','/u/dashboard'],['03-library','/u/library'],['05-upload','/u/upload'],['07-plans','/u/plans'],['08-drama-live','/u/drama/D10001'],['09-drama-reject','/u/drama/D10004?tab=eps'],['10-drama-review','/u/drama/D10005'],['11-settle','/u/settle'],['13-contracts','/u/contracts'],['14-tickets','/u/tickets'],['16-account','/u/account'],['17-404','/u/nothing'],
   ['20-ops-workbench','/o/workbench'],['21-ops-customers','/o/customers'],['22-ops-review','/o/review'],['23-ops-review-team','/o/review'],['25-ops-share','/o/share'],['27-ops-dist','/o/distribution'],['28-ops-sync','/o/sync'],['30-ops-watermark','/o/watermark'],['31-ops-tickets','/o/tickets'],['32-ops-contracts','/o/contracts'],['33-ops-settle','/o/settle'],['35-ops-settle-review','/o/settle-review'],['36-ops-withdraw','/o/withdraw'],['37-ops-rates','/o/rates'],['38-ops-config','/o/config'],['39-ops-admin','/o/admin']];
  for (const [n, h] of pages) { if (only && !n.includes(only)) continue; await go(h);
    if (n === '03-library') { await p.waitForTimeout(500); await shot('03a-library-tour'); const sk = p.locator('.ant-tour-close'); if (await sk.count()) await sk.click(); }
    if (n === '23-ops-review-team') await p.locator('.ant-tabs-tab', { hasText: '团队队列' }).click();
    await shot(n); }
  if (!only || only === 'flow') {
    // 库：多选 + 浮动条 + 发行向导
    await go('/u/library'); const sk = p.locator('.ant-tour-close'); if (await sk.count()) await sk.click();
    await p.locator('.stcard', { hasText: '草稿' }).click(); await p.waitForTimeout(400);
    for (let i = 0; i < 6; i++) await p.locator('.vcard .ck').nth(i).click({ force: true });
    await shot('04-library-multiselect');
    await p.locator('.floatbar button', { hasText: '申请发行' }).click(); await p.waitForTimeout(500); await shot('06a-publish-step1');
    await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await p.locator('.pick', { hasText: '首发' }).click(); await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await shot('06b-publish-platforms');
    await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await shot('06c-publish-precheck');
    await p.locator('.ant-modal button', { hasText: /^提交/ }).click(); await shot('06d-publish-done');
    await p.keyboard.press('Escape');
    // upload demo
    await go('/u/upload'); await p.locator('button', { hasText: '示例文件夹' }).click(); await p.locator('.mcard.orange').first().click(); await shot('05b-upload-match');
    await p.locator('button', { hasText: /确认 \d+ 部/ }).click(); await p.waitForTimeout(1500); await p.locator('.ant-float-btn').click(); await shot('05c-upload-queue'); await p.keyboard.press('Escape');
    // 认证拦截 + 认证
    await go('/u/contracts'); await p.locator('button', { hasText: '申请合同' }).first().click(); await shot('13b-cert-gate'); await p.locator('.ant-modal-confirm button', { hasText: '去认证' }).click(); await p.waitForTimeout(800); await shot('16b-cert-wizard');
    await p.locator('.ant-modal input[type=file]').setInputFiles({ name: '营业执照.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') }); await p.waitForTimeout(300);
    await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await p.locator('#legal').fill('陈星'); await p.locator('#contact').fill('13800001111'); await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await p.locator('.ant-modal button', { hasText: '提交认证' }).click(); await shot('16c-cert-pending');
    // 运营审核认证
    await go('/o/customers'); await p.locator('.ant-segmented-item', { hasText: '审核中' }).click(); await p.locator('input[placeholder*="客户名"]').fill('星河'); await p.keyboard.press('Enter'); await p.locator('button', { hasText: '审核认证' }).first().click(); await shot('21b-cert-review'); await p.locator('.ant-drawer button', { hasText: '通过' }).click();
    // 提款
    await go('/u/settle'); await p.locator('button', { hasText: '一键提款' }).click(); await shot('12a-withdraw-step1'); await p.locator('.ant-modal button', { hasText: '下一步' }).click();
    await p.locator('#bank').fill('招商银行杭州分行'); await p.locator('#no').fill('571900012345678'); await p.locator('.ant-modal button', { hasText: '保存账户' }).click(); await p.waitForTimeout(400); await p.locator('.ant-modal button', { hasText: '下一步' }).click(); await shot('12b-withdraw-invoice');
    await p.locator('.ant-modal input[type=file]').setInputFiles({ name: '发票_星河_2609.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') }); await p.locator('.ant-modal button', { hasText: '提交提款' }).click(); await shot('12c-withdraw-done'); await p.locator('.ant-modal button', { hasText: '好的' }).click(); await shot('11b-settle-after');
    await p.locator('.scard').nth(3).click(); await shot('11c-statement'); await p.keyboard.press('Escape');
    // tickets watermark
    await go('/u/tickets?id=GD-10293'); await shot('15-ticket-watermark');
    // ops review desk + import + settle entry + review
    await go('/o/review/D10005'); await shot('24-ops-review-desk');
    await go('/o/share'); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(1).check(); await p.locator('button', { hasText: '批量套用模板' }).click(); await shot('26-ops-share-apply'); await p.keyboard.press('Escape');
    await go('/o/sync'); await p.locator('button', { hasText: '导入报表' }).first().click(); await p.locator('button', { hasText: '使用示例报表' }).click(); await shot('29a-import-mapping');
    await p.locator('.maprow.need .ant-select').click(); await p.locator('.ant-select-item', { hasText: '收入' }).first().click(); await p.locator('.wizfoot button', { hasText: '下一步' }).click(); await shot('29b-import-match');
    await p.locator('button', { hasText: '同名批量确认' }).click(); await p.locator('.wizfoot button', { hasText: '下一步' }).click(); await shot('29c-import-validate'); await p.keyboard.press('Escape');
    await go('/o/settle'); await p.locator('.ant-segmented-item', { hasText: '待录入' }).click(); await p.locator('.ant-table-tbody button', { hasText: '录入' }).first().click(); await p.locator('#amt').fill('99999'); await shot('34-ops-settle-entry'); await p.keyboard.press('Escape');
    await go('/o/withdraw'); await p.locator('.ant-tabs-tab', { hasText: '发票审核中' }).click(); await p.locator('button', { hasText: '审核发票' }).first().click(); await shot('36b-invoice-audit'); await p.keyboard.press('Escape');
    await go('/o/review'); await p.locator('.ant-tabs-tab', { hasText: '团队队列' }).click(); for (let i = 0; i < 4; i++) await p.locator('.ant-table-tbody .ant-checkbox-input').nth(i).check(); await p.locator('button', { hasText: '批量通过' }).click(); await p.waitForTimeout(300);
    await go('/o/share'); await p.locator('.ant-table-tbody .ant-checkbox-input').nth(0).check(); await p.locator('button', { hasText: '批量套用模板' }).click(); await p.locator('.ant-modal button', { hasText: '提交' }).click();
    await p.locator('[data-testid=tasks]').click(); await p.waitForTimeout(800); await shot('40-ops-taskcenter'); await p.waitForTimeout(4000); const r = p.locator('.ant-drawer a', { hasText: '查看报告' }); if (await r.count()) await r.first().click(); await shot('40b-ops-taskcenter-report'); await p.keyboard.press('Escape');
    await go('/u/dashboard'); await p.locator('.ant-select-selector input').first().fill('龙王'); await p.waitForTimeout(500); await shot('41-global-search');
  }
  if (!only || only === 'flow') { await go('/u/library'); await p.locator('.anticon-moon').first().click(); await shot('42-library-dark'); await p.locator('.anticon-moon').first().click(); await p.locator('.anticon-menu').first().click(); await shot('43-collapsed'); }
  console.log('ERRORS:', JSON.stringify(errs, null, 1)); await b.close();
})();
