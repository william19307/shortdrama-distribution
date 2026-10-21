import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'Demo123456';

const PLATFORMS = [
  { code: 'RS', name: 'ReelShort', region: '北美/欧洲', color: '#E8173A', syncLag: 'T1' as const, sort: 1 },
  { code: 'DB', name: 'DramaBox', region: '北美/东南亚', color: '#7C4DFF', syncLag: 'T1' as const, sort: 2 },
  { code: 'SM', name: 'ShortMax', region: '北美/中东', color: '#00A3A3', syncLag: 'T2' as const, sort: 3 },
  { code: 'FT', name: 'FlexTV', region: '东南亚/拉美', color: '#F59E0B', syncLag: 'T1' as const, sort: 4 },
  { code: 'GS', name: 'GoodShort', region: '北美/日韩', color: '#3B82F6', syncLag: 'T2' as const, sort: 5 },
  { code: 'NS', name: 'NetShort', region: '全球', color: '#EC4899', syncLag: 'T1' as const, sort: 6, first: false },
];

async function main() {
  if (process.env.SEED_DEMO !== 'true') {
    console.log('未设置 SEED_DEMO=true，跳过演示种子。');
    return;
  }
  const passwordHash = await hash(PASSWORD, 10);
  for (const platform of PLATFORMS) {
    await prisma.platform.upsert({
      where: { code: platform.code },
      create: {
        code: platform.code,
        name: platform.name,
        region: platform.region,
        color: platform.color,
        syncLag: platform.syncLag,
        syncMode: 'MANUAL',
        firstBatch: platform.first !== false,
        sort: platform.sort,
        enabled: true,
      },
      update: { name: platform.name, region: platform.region, color: platform.color, syncLag: platform.syncLag, sort: platform.sort, firstBatch: platform.first !== false },
    });
  }

  const ops = await upsertStaff('ops@studio.example', '林晓', 'OPS', passwordHash);
  const ops2 = await upsertStaff('ops2@studio.example', '王倩', 'OPS', passwordHash);
  const opsManager = await upsertStaff('ops-manager@studio.example', '孙悦', 'OPS_MANAGER', passwordHash);
  const bd = await upsertStaff('bd@studio.example', '陈宇', 'BD', passwordHash);
  const finance = await upsertStaff('finance@studio.example', '赵倩', 'FINANCE', passwordHash);
  await upsertStaff('admin@studio.example', '周岚', 'ADMIN', passwordHash);
  void ops2;
  void opsManager;
  void bd;
  void finance;

  await prisma.systemSetting.upsert({ where: { key: 'minWithdrawAmount' }, create: { key: 'minWithdrawAmount', value: '10000.00' }, update: {} });
  await prisma.systemSetting.upsert({ where: { key: 'deviationPct' }, create: { key: 'deviationPct', value: '5' }, update: {} });
  await prisma.systemSetting.upsert({ where: { key: 'syncDeadline' }, create: { key: 'syncDeadline', value: '06:00' }, update: {} });

  const rateDate = new Date('2026-09-30T00:00:00.000Z');
  const existingRate = await prisma.exchangeRate.findFirst({ where: { pair: 'USD->CNY', rateDate } });
  if (!existingRate) {
    await prisma.exchangeRate.create({ data: { pair: 'USD->CNY', rateDate, value: new Prisma.Decimal('7.1800'), source: '中国人民银行中间价', createdById: finance.id } });
  }

  await ensureDemoClients(passwordHash);
  await prisma.company.updateMany({
    where: { name: { in: ['星河影业（杭州）', '青柠文化'] }, bdId: null },
    data: { bdId: bd.id },
  });

  const already = await prisma.user.findUnique({ where: { email: 'client@xinghe.example' } });
  if (already) {
    await prisma.asset.updateMany({
      where: { type: { in: ['LICENSE', 'COPYRIGHT'] }, reviewStatus: 'PENDING' },
      data: { reviewStatus: 'APPROVED', reviewedAt: new Date() },
    });
    console.log('种子内容已存在，跳过剧目。已有账号的密码不会被重置。');
    return;
  }

  const xinghe = await prisma.company.create({
    data: {
      name: '星河影业（杭州）',
      creditCode: '91330100MA2XXXXX1X',
      legalPerson: '林可',
      contactName: '林可',
      contactPhone: '13800001111',
      certStatus: 'APPROVED',
      ownerId: ops.id,
      bdId: bd.id,
      bankAccounts: { create: { accountName: '星河影业（杭州）', bankName: '招商银行', branch: '杭州分行', accountNo: '6225880123456621', isDefault: true } },
      policy: { create: { cycleType: 'MONTH', anchorDate: new Date('2026-01-01T00:00:00.000Z'), note: '按自然月' } },
    },
  });
  await prisma.user.create({ data: { email: 'client@xinghe.example', passwordHash, name: '林可', role: 'CLIENT', companyId: xinghe.id } });

  const qingning = await prisma.company.create({
    data: { name: '青柠文化', creditCode: '91310000MA1YYYYY2Y', legalPerson: '周宁', contactName: '周宁', contactPhone: '13900002222', certStatus: 'PENDING', ownerId: ops.id, bdId: bd.id },
  });
  await prisma.user.create({ data: { email: 'client@qingning.example', passwordHash, name: '周宁', role: 'CLIENT', companyId: qingning.id } });
  await prisma.company.create({ data: { name: '远山文化', certStatus: 'UNVERIFIED' } });

  const platforms = await prisma.platform.findMany({ where: { firstBatch: true }, orderBy: { sort: 'asc' } });
  const titles = [
    ['闪婚后，豪门老公他藏不住了', 'Hidden Vows', '都市', 'LIVE'],
    ['重生之千金归来', 'Rebirth of the Heiress', '逆袭', 'LIVE'],
    ['龙王殿：战神归来', 'Return of the Dragon King', '战神', 'LIVE'],
    ['替嫁新娘的秘密', 'The Substitute Bride', '甜宠', 'DISTRIBUTING'],
    ['神医下山', 'Divine Doctor', '古装', 'NEEDS_REVISION'],
    ['我的冷面总裁是狼人', 'My Alpha CEO', '奇幻', 'IN_REVIEW'],
    ['离婚后前妻成了首富', 'Ex-Wife the Tycoon', '都市', 'SHARE_CONFIG'],
    ['萌宝驾到', 'Chase Mommy', '萌宝', 'APPROVED'],
    ['暗夜继承人', 'Night Heir', '复仇', 'PENDING_REVIEW'],
    ['假千金她不装了', 'True Heiress', '逆袭', 'IDLE'],
    ['王府小厨娘', 'Palace Cook', '古装', 'IDLE'],
    ['破镜重圆进行时', 'Mended', '虐恋', 'PRECHECK_FAILED'],
  ] as const;

  for (let i = 0; i < titles.length; i += 1) {
    const [title, titleEn, genre, state] = titles[i];
    const code = `D${10001 + i}`;
    const drama = await prisma.drama.create({
      data: {
        code,
        companyId: xinghe.id,
        title,
        titleEn,
        nameNorm: title.replace(/\s/g, '').toLowerCase(),
        genre,
        language: '英语',
        episodeCountExpected: 80,
        synopsis: '示例剧目，用于本地演示。',
        tags: i % 2 === 0 ? ['2026Q4'] : ['女频'],
        groups: i < 3 ? ['重点项目'] : [],
      },
    });
    const episodeCount = state === 'IN_REVIEW' || state === 'NEEDS_REVISION' ? 10 : 8;
    for (let n = 1; n <= episodeCount; n += 1) {
      const sampled = episodeCount <= 8 || n <= 3 || n >= episodeCount - 1 || n === 5;
      let reviewStatus: 'APPROVED' | 'PENDING' | 'REJECTED' | 'UNSAMPLED' = 'UNSAMPLED';
      if (['LIVE', 'DISTRIBUTING', 'APPROVED', 'SHARE_CONFIG'].includes(state)) reviewStatus = 'APPROVED';
      else if (state === 'NEEDS_REVISION') reviewStatus = n === 4 ? 'REJECTED' : sampled ? 'APPROVED' : 'UNSAMPLED';
      else if (state === 'IN_REVIEW' || state === 'PENDING_REVIEW') reviewStatus = sampled ? 'PENDING' : 'UNSAMPLED';
      else reviewStatus = 'PENDING';
      if (state !== 'PRECHECK_FAILED' && state !== 'IDLE') {
        await prisma.episode.create({
          data: {
            dramaId: drama.id,
            no: n,
            fileName: `EP${String(n).padStart(2, '0')}.mp4`,
            fileKey: `seed/${drama.code}/${n}.mp4`,
            fileSize: BigInt(80_000_000),
            contentType: 'video/mp4',
            fingerprint: `${drama.code}:${n}`,
            reviewStatus,
            rejectReason: reviewStatus === 'REJECTED' ? '字幕错位，片头含第三方水印' : null,
          },
        });
      }
    }
    if (state !== 'PRECHECK_FAILED') {
      await prisma.asset.create({ data: { companyId: xinghe.id, dramaId: drama.id, type: 'LICENSE', name: '授权书.pdf', fileKey: `seed/${drama.code}/license.pdf`, reviewStatus: 'APPROVED', reviewedAt: new Date() } });
    }
    if (state === 'IDLE' || state === 'PRECHECK_FAILED') continue;
    const planStatus = state === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : state === 'IN_REVIEW' ? 'IN_REVIEW' : state === 'NEEDS_REVISION' ? 'NEEDS_REVISION' : state === 'SHARE_CONFIG' ? 'SHARE_CONFIG' : state === 'APPROVED' ? 'APPROVED' : state === 'DISTRIBUTING' ? 'DISTRIBUTING' : 'LIVE';
    const plan = await prisma.distributionPlan.create({
      data: {
        code: `PL${10001 + i}`,
        dramaId: drama.id,
        companyId: xinghe.id,
        round: 'FIRST',
        status: planStatus,
        assigneeId: ops.id,
        submittedAt: new Date('2026-10-12T02:00:00.000Z'),
        slaDueAt: new Date('2026-10-16T02:00:00.000Z'),
        rejectSummary: state === 'NEEDS_REVISION' ? '第 4 集：字幕错位，片头含第三方水印' : null,
        platforms: {
          create: platforms.map((platform, index) => ({
            platformId: platform.id,
            platformName: platform.name,
            listingStatus: state === 'LIVE' ? (index === 4 ? 'PENDING_LISTING' : 'LISTED') : state === 'DISTRIBUTING' ? 'IN_CONTACT' : 'PENDING_CONTACT',
            platformDramaId: state === 'LIVE' ? `${platform.code}-${code}` : null,
            listedAt: state === 'LIVE' && index !== 4 ? new Date('2026-09-01T00:00:00.000Z') : null,
          })),
        },
      },
    });
    if (['SHARE_CONFIG', 'APPROVED', 'DISTRIBUTING', 'LIVE'].includes(state)) {
      for (const platform of platforms) {
        const mode = platform.code === 'DB' ? 'MG' : platform.code === 'SM' ? 'MG_OVER' : 'NO_MG';
        await prisma.shareConfig.create({
          data: {
            planId: plan.id,
            platformId: platform.id,
            mode,
            clientRate: new Prisma.Decimal(mode === 'MG_OVER' ? '40' : '50'),
            overRate: mode === 'MG_OVER' ? new Prisma.Decimal('60') : null,
            guaranteeAmount: mode === 'NO_MG' ? null : new Prisma.Decimal('80000'),
            guaranteeCurrency: 'USD',
            guaranteePeriodDays: 180,
            reviewStatus: state === 'SHARE_CONFIG' ? 'DRAFT' : 'APPROVED',
            submittedById: ops.id,
          },
        });
      }
    }
  }

  const live = await prisma.drama.findMany({ where: { companyId: xinghe.id, plans: { some: { status: 'LIVE' } } }, take: 3 });
  const rs = platforms.find((item) => item.code === 'RS')!;
  const db = platforms.find((item) => item.code === 'DB')!;
  for (const drama of live) {
    for (let d = 1; d <= 21; d += 1) {
      const statDate = new Date(Date.UTC(2026, 8, d));
      for (const platform of [rs, db]) {
        const views = 80000 + d * 1200 + drama.code.charCodeAt(4) * 50;
        await prisma.dailyStat.create({
          data: {
            recordId: `${platform.code}:2026-09-${String(d).padStart(2, '0')}:${drama.code}:英语`,
            companyId: xinghe.id,
            platformId: platform.id,
            dramaId: drama.id,
            statDate,
            statTimezone: 'America/Los_Angeles',
            titleLocal: drama.titleEn || drama.title,
            language: '英语',
            episodesOnline: 80,
            views,
            viewMetricDef: '播放次数',
            uniqueViewers: Math.round(views * 0.62),
            paidUnlocks: Math.round(views * 0.04),
            grossRevenue: new Prisma.Decimal((views * 0.002).toFixed(2)),
            netRevenue: new Prisma.Decimal((views * 0.0012).toFixed(2)),
            currency: 'USD',
            shareRate: new Prisma.Decimal('50'),
            mgAmount: platform.code === 'DB' ? new Prisma.Decimal('80000') : null,
            dealType: platform.code === 'DB' ? 'MG_SHARE' : 'NO_MG',
            dataSource: 'SCREENSHOT',
            evidenceSha256: 'seed-placeholder-sha256',
            status: 'LOCKED',
            enteredById: ops.id,
            reviewedById: finance.id,
            reviewedAt: new Date('2026-10-01T01:00:00.000Z'),
            lockedAt: new Date('2026-10-01T02:00:00.000Z'),
          },
        });
      }
    }
  }

  const settlement = await prisma.settlement.create({
    data: {
      code: 'JS10001',
      companyId: xinghe.id,
      periodStart: new Date('2026-09-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      status: 'PENDING_APPLY',
      amountCny: new Prisma.Decimal('186420.50'),
      referenceCny: new Prisma.Decimal('190112.30'),
      internalNote: '按 9 月平台对账单录入',
      clientNote: '含 DramaBox 补发',
      enteredById: ops.id,
      enteredAt: new Date('2026-10-03T02:00:00.000Z'),
      reviewedById: finance.id,
      reviewedAt: new Date('2026-10-04T06:00:00.000Z'),
      logs: {
        create: [
          { action: '录入应结金额', actorId: ops.id, after: { amountCny: '186420.50' } },
          { action: '复核通过', actorId: finance.id },
        ],
      },
    },
  });
  await prisma.settlement.create({
    data: {
      code: 'JS10002',
      companyId: xinghe.id,
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-31T00:00:00.000Z'),
      status: 'PAID',
      amountCny: new Prisma.Decimal('142210.00'),
      referenceCny: new Prisma.Decimal('140000.00'),
      internalNote: '8 月已打款',
      enteredById: ops.id,
      reviewedById: finance.id,
    },
  });
  void settlement;

  const firstDrama = live[0];
  if (firstDrama) {
    await prisma.contract.create({
      data: {
        code: 'HT10001',
        companyId: xinghe.id,
        title: `《${firstDrama.title}》海外发行合同`,
        type: 'DISTRIBUTION',
        status: 'EFFECTIVE',
        dramas: { create: [{ dramaId: firstDrama.id }] },
      },
    });
    await prisma.ticket.create({
      data: {
        code: 'GD10001',
        companyId: xinghe.id,
        type: 'REVIEW',
        status: 'PENDING_CLIENT',
        title: '《神医下山》审核还需要修改',
        body: '第 4 集：字幕错位，片头含第三方水印',
        dramaId: (await prisma.drama.findFirst({ where: { code: 'D10005' } }))?.id,
      },
    });
  }

  for (const prefix of ['D', 'PL', 'GD', 'HT', 'JS', 'TX', 'PF']) {
    await prisma.counter.upsert({ where: { id: prefix }, create: { id: prefix, value: 20000 }, update: { value: { set: 20000 } } });
  }
  console.log('种子数据已写入。已认证客户A client@xinghe.example / 未认证客户B client-b@weiren.example / 新客户（无数据）client-new@example.com / 运营专员甲 ops@studio.example / 运营专员乙 ops2@studio.example / 运营主管 ops-manager@studio.example / 商务 bd@studio.example / 财务 finance@studio.example / 管理员 admin@studio.example ，密码 Demo123456');
}

async function ensureDemoClients(passwordHash: string) {
  let clientB = await prisma.company.findFirst({ where: { creditCode: '91330100MA2BBBBB2B' } });
  if (!clientB) {
    clientB = await prisma.company.create({
      data: { name: '未仁文化（客户B）', creditCode: '91330100MA2BBBBB2B', legalPerson: '未仁', contactName: '未仁', contactPhone: '13700003333', certStatus: 'UNVERIFIED' },
    });
  }
  await prisma.user.upsert({
    where: { email: 'client-b@weiren.example' },
    create: { email: 'client-b@weiren.example', passwordHash, name: '未仁', role: 'CLIENT', companyId: clientB.id },
    update: { name: '未仁', companyId: clientB.id },
  });

  let newbie = await prisma.company.findFirst({ where: { name: '新星短剧（杭州）有限公司' } });
  if (!newbie) {
    newbie = await prisma.company.create({ data: { name: '新星短剧（杭州）有限公司', certStatus: 'UNVERIFIED' } });
  }
  await prisma.user.upsert({
    where: { email: 'client-new@example.com' },
    create: { email: 'client-new@example.com', passwordHash, name: '新客户', role: 'CLIENT', companyId: newbie.id },
    update: { name: '新客户', companyId: newbie.id },
  });
}

async function upsertStaff(email: string, name: string, role: 'OPS' | 'OPS_MANAGER' | 'BD' | 'FINANCE' | 'ADMIN', passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash },
    update: { name, role },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
