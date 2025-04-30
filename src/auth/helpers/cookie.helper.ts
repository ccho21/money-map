// 📄 src/auth/helpers/set-cookie.helper.ts
import { Response } from 'express';
const isProd = process.env.NODE_ENV === 'production';

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken?: string,
) => {
  console.log('### IS PROD', isProd);
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd, // ✅ prod: true, dev: false
    sameSite: isProd ? 'none' : 'lax', // ✅ prod: none, dev: lax
    maxAge: 60 * 60 * 1000, // 1시간
    path: '/',
  });

  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });
  }
};

export const clearCookie = (res: Response) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
};
