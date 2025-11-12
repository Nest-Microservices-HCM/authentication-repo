export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

export interface UserRole {
  id: string;
  name: string;
}
