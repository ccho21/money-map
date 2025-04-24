import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
interface GoogleProfile {
  emails: { value: string }[];
  name: { givenName: string; familyName: string };
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID')!,
      clientSecret: config.get('GOOGLE_CLIENT_SECRET')!,
      callbackURL: '/auth/google/redirect',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): any {
    const { name, emails } = profile;
    const user = {
      email: emails[0].value,
      name: name.givenName,
      accessToken,
    };
    done(null, user); // req.user에 들어감
  }
}
