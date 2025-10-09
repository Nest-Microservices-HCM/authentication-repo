import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateAuthenticationDto } from './dto/create-authentication.dto';
import { PrismaClient } from '@prisma/client';
import { LoginAuthenticationDto } from './dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AuthenticationService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger('AuthenticationService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  authenticationUser(LoginAuthenticationDto: LoginAuthenticationDto) {
    return this.user.create({
      data: LoginAuthenticationDto,
    });
  }

  registerUser(createAuthenticationDto: CreateAuthenticationDto) {
    return `This action returns registered user`;
  }

  verifyUser(id: string) {
    return `This action returns a user id: #${id} authentication`;
  }

  async findOne(id: string) {
    const user = await this.user.findFirst({
      where: { id, isActive: true },
    });

    console.log('hola1');
    if (!user) {
      throw new RpcException({
        message: `User with ID ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return user;
  }
}
