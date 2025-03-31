export type UserPayload = {
  id: string;
  email: string;
  timezone?: string | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  timezone?: string | null;
};
