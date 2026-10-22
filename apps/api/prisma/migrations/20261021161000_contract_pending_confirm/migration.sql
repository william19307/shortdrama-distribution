-- 合同增加「待确认」：签署扫描件上传后进入该状态，确认后才生效。
ALTER TYPE "ContractStatus" ADD VALUE 'PENDING_CONFIRM';
