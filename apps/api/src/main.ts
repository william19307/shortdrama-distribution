import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/http';
import { verifyRead } from './core/storage.service';
import { StorageService } from './core/storage.service';

export async function buildApp() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });
  const storage = app.get(StorageService);
  app.use('/api/storage/objects', async (req: Request, res: Response) => {
    try {
      const key = String(req.query.key || '');
      const exp = Number(req.query.exp || 0);
      const sig = String(req.query.sig || '');
      if (!verifyRead(key, exp, sig)) {
        res.status(403).json({ message: '链接已失效' });
        return;
      }
      const buf = await storage.getObject(key);
      const type = key.endsWith('.png') ? 'image/png' : key.endsWith('.jpg') || key.endsWith('.jpeg') ? 'image/jpeg' : key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.type(type).send(buf);
    } catch {
      res.status(404).json({ message: '文件不存在' });
    }
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'PUT' && /\/api\/storage\/uploads\/[^/]+\/(content|parts\/\d+)$/.test(req.path)) {
      return raw({ type: () => true, limit: '2gb' })(req, res, next);
    }
    return json({ limit: '4mb' })(req, res, next);
  });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(','), credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

async function bootstrap() {
  const app = await buildApp();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`API http://localhost:${port}`);
}

if (require.main === module) {
  void bootstrap();
}
