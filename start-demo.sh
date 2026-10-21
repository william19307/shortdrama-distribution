#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .env.demo ]; then
  cp .env.demo.example .env.demo
  echo "已生成 .env.demo，可按需改端口和密码。"
fi
set -a
. ./.env.demo
set +a
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d --build
echo ""
echo "演示已启动。浏览器打开 http://localhost:${WEB_PORT:-8080}"
echo "密码都是 Demo123456"
echo "客户 client@xinghe.example  运营 ops@studio.example  主管 ops-manager@studio.example"
echo "商务 bd@studio.example  财务 finance@studio.example  管理员 admin@studio.example"
