import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', // 또는 특정 프론트 URL만 허용 가능
    credentials: true,
  });

  // Swagger 설정 빌더
  const config = new DocumentBuilder()
    .setTitle('Moneymap API')
    .setDescription('Moneymap 백엔드 API 문서')
    .setVersion('1.0')
    // 인증이 필요한 경우 Bearer 토큰 인증 추가 (옵션)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access_token', // <- 이름 (밑에서 사용됨)
    )
    .build();

  // Swagger 문서 생성
  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI 엔드포인트 설정 (예: /api)
  SwaggerModule.setup('api', app, document);

  // 환경 변수에서 포트 번호를 불러오는 예시
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
