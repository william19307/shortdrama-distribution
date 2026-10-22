-- 0005 按当前分支吸收：不改已有技术校验列，只补认证向导草稿和驳回原因字典。
ALTER TABLE "Company" ADD COLUMN "certWizard" JSONB;
ALTER TABLE "Company" ADD COLUMN "certWizardStep" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RejectReason" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RejectReason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RejectReason_code_key" ON "RejectReason"("code");
CREATE INDEX "RejectReason_enabled_sort_idx" ON "RejectReason"("enabled", "sort");

INSERT INTO "RejectReason" ("id", "code", "category", "title", "template", "sort") VALUES
  ('rr_quality',   'QUALITY',   '画质', '画质不达标',       '画面模糊/分辨率不足/压缩痕迹明显，请提供不低于 720P 的成片。', 10),
  ('rr_audio',     'AUDIO',     '音频', '音频问题',         '存在无声、爆音、音画不同步等问题，请修复后重新上传。', 20),
  ('rr_subtitle',  'SUBTITLE',  '字幕', '字幕缺失或错误',   '字幕缺失、错别字较多或与目标语言不符，请修正。', 30),
  ('rr_content',   'CONTENT',   '内容', '内容合规风险',     '存在暴力、色情、政治敏感等不符合海外平台规范的内容，请删改。', 40),
  ('rr_watermark', 'WATERMARK', '内容', '含第三方水印/台标', '画面含第三方平台水印、台标或二维码，请提供干净版本。', 50),
  ('rr_episodes',  'EPISODES',  '完整性', '集数不全或顺序错误', '分集缺失、重复或顺序错误，请核对后补齐。', 60),
  ('rr_license',   'LICENSE',   '资质', '授权材料不符',     '授权书/版权证明与剧目信息不符或已过期，请补充有效材料。', 70),
  ('rr_metadata',  'METADATA',  '资料', '剧目资料不完整',   '剧名、简介、封面等资料缺失或不规范，请完善。', 80),
  ('rr_other',     'OTHER',     '其他', '其他',             '请根据补充说明修改。', 999);
