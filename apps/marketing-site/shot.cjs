const { chromium } = require('playwright');
const url = 'file://' + __dirname + '/营销站.html';
(async () => {
  const b = await chromium.launch({executablePath: process.env.HOME+'/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'}); const errs = [];
  for (const [tag, vp] of [['d', { width: 1440, height: 900 }], ['m', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: tag === 'm' ? 2 : 1 });
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(tag + ' ' + m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push(tag + ' pageerror ' + e.message));
    const s = async n => { await p.waitForTimeout(700); await p.screenshot({ path: `screenshots/${tag}-${n}.png` }); };
    const sec = async id => { await p.evaluate(i => { const e = document.getElementById(i); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }, id); };
    await p.goto(url); await s('01-home');
    await sec('works'); await s('02-works');
    await p.click('.chip:has-text("霸总")'); await s('03-filter');
    await sec('ability'); await s('04-ability');
    await sec('trust'); await s('05-trust');
    await sec('voice'); await s('06-voice');
    await sec('join'); await s('07-join');
    await p.click('button:has-text("提交入驻申请")'); await s('08-join-err');
    await p.fill('#company', '示例影视'); await p.fill('#name', '张三'); await p.fill('#phone', '13800138000'); await p.fill('#email', 'a@b.com');
    await p.click('#count'); await p.click('.ant-select-item-option >> nth=0'); await p.click('#agree');
    await p.click('button:has-text("提交入驻申请")'); await p.waitForTimeout(1000); await sec('join'); await s('09-join-ok');
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await s('10-footer');
    await p.goto(url + '#/work/w1'); await s('11-detail');
    await p.evaluate(() => scrollTo(0, 700)); await s('12-detail-curve');
    if (tag === 'm') { await p.goto(url); await p.click('.burger'); await s('13-drawer'); await p.keyboard.press('Escape'); }
    await p.goto(url); await p.click('[aria-label="切换主题"]'); await s('14-dark');
    await sec('trust'); await s('15-dark-trust');
    await p.goto(url + '#/work/w3'); await s('16-dark-detail'); await p.click('[aria-label="切换主题"]');
    await p.close();
  }
  console.log(errs.join('\n') || 'NO CONSOLE ERRORS'); await b.close();
})();
