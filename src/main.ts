import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

import * as dotenv from 'dotenv';
dotenv.config();

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [
        'https://money-map-prod.vercel.app',
        'https://money-app-front-ecru.vercel.app',
      ]
    : ['http://localhost:3000', 'http://localhost:3001'];

console.log('### process.env.NODE_ENV', process.env.NODE_ENV);
console.log('### allowed origin', allowedOrigins);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Swagger 설정 빌더
  const config = new DocumentBuilder()
    .setTitle('Moneymap API')
    .setDescription('Moneymap 백엔드 API 문서')
    .setVersion('1.0')
    // 인증이 필요한 경우 Bearer 토큰 인증 추가 (옵션)
    .addCookieAuth('access_token') // 이건 단순 Swagger 문서용
    .build();

  // Swagger 문서 생성
  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI 엔드포인트 설정 (예: /api)
  SwaggerModule.setup('api', app, document);

  // 환경 변수에서 포트 번호를 불러오는 예시
  const port = process.env.PORT ?? 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('앱 시작 중 오류 발생:', err);
});
