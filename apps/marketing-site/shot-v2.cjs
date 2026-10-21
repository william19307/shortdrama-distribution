const { chromium } = require('playwright');
const url = 'file://' + __dirname + '/营销站-v2.html';
(async () => {
  const b = await chromium.launch({executablePath: process.env.HOME+'/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'}); const errs = []; const reqs = [];
  for (const [tag, vp] of [['d', { width: 1440, height: 900 }], ['m', { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: tag === 'm' ? 2 : 1 });
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(tag + ' ' + m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push(tag + ' pageerror ' + e.message));
    p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) reqs.push(r.url()); });
    const s = async (n, w = 900) => { await p.waitForTimeout(w); await p.screenshot({ path: `screenshots-v2/${tag}-${n}.png` }); };
    const sec = async (id, off = 0) => { await p.evaluate(([i, o]) => { const e = document.getElementById(i); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY + o, behavior: 'instant' }); }, [id, off]); };
    await p.goto(url); await s('01-hero', 2000);
    await sec('originals', -80); await s('02-rows');
    if (tag === 'd') { await p.hover('.row-s .card >> nth=2'); await s('03-hover', 700); await p.mouse.move(5, 5); }
    await sec('top10', -40); await s('04-top10', 1500);
    await p.evaluate(() => { const e = document.querySelector('.stats'); scrollTo({top: e.getBoundingClientRect().top + scrollY - 60, behavior:'instant'}); }); await s('05-stats', 2600);
    await sec('global', 0); await s('06-map', 2500);
    await sec('platform', -20); await s('07-bento', 1500);
    await sec('platform', vp.height - 100); await s('08-bento2', 1500);
    if (tag === 'm') { await sec('platform', vp.height*2 - 200); await s('08b-bento3', 1500); }
    await p.evaluate(() => { const e = document.querySelector('.flow'); scrollTo({top: e.getBoundingClientRect().top + scrollY - 250, behavior:'instant'}); }); await s('09-flow', 1600);
    await sec('partners', -40); await s('10-partners-voices', 1500);
    await sec('contact', 0); await s('11-join', 1200);
    await p.click('button[type=submit]'); await sec('contact', tag==='m'? 500:0); await s('12-join-err', 500);
    await p.fill('#company', 'Sample Films'); await p.fill('#name', 'Jane'); await p.fill('#email', 'a@b.com'); await p.selectOption('#titles', '6–20'); await p.click('.chk');
    await p.click('button[type=submit]'); await s('13-join-ok', 900);
    await p.evaluate(() => scrollTo({top: document.body.scrollHeight, behavior:'instant'})); await s('14-footer', 600);
    await sec('originals', -80); await p.waitForTimeout(500); await p.click('.row-s .card >> nth=0'); await s('15-modal', 900); await p.keyboard.press('Escape');
    await p.evaluate(() => scrollTo({top:0, behavior:'instant'})); await p.click('.lang button >> nth=1'); await s('16-zh-hero', 1800);
    await sec('platform', -20); await s('17-zh-bento', 1500); await p.click('.lang button >> nth=0');
    if (tag === 'm') { await p.evaluate(() => scrollTo({top:0, behavior:'instant'})); await p.click('.burger'); await s('18-menu', 700); }
    await p.close();
  }
  console.log(errs.join('\n') || 'NO CONSOLE ERRORS'); console.log('EXTERNAL REQS:', reqs.length ? reqs : 'none'); await b.close();
})();
