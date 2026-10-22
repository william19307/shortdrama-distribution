const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://shortform:shortform@localhost:5432/shortform_test',
    },
    stdio: 'inherit',
  });
};
