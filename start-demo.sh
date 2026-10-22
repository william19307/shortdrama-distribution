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
echo "已认证客户A client@xinghe.example  未认证客户B client-b@weiren.example  新客户 client-new@example.com"
echo "运营专员甲 ops@studio.example  专员乙 ops2@studio.example  主管 ops-manager@studio.example"
echo "财务 finance@studio.example  商务 bd@studio.example  管理员 admin@studio.example  密码 Demo123456"
echo "商务 bd@studio.example  财务 finance@studio.example  管理员 admin@studio.example"
