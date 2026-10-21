process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://shortform:shortform@localhost:5432/shortform_test';
process.env.STORAGE_DRIVER = 'memory';
process.env.JWT_SECRET = 'test-secret-please-change-now';
process.env.WEB_ORIGIN = 'http://localhost:5173';
process.env.PORT = '0';
