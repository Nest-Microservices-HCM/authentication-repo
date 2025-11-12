import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateAuthenticationDto } from './dto/create-authentication.dto';
import { PrismaClient } from '@prisma/client';
import { LoginAuthenticationDto } from './dto';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { envs } from 'src/config';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthAction } from './enum/auth-log.enum';

@Injectable()
export class AuthenticationService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger('AuthenticationService');
  private readonly TOKEN_EXPIRATION_HOURS = 5;

  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async singnJWT(payload: JwtPayload) {
    return this.jwtService.signAsync(payload);
  }

  private async registerAuthLog(
    tx: any,
    userId: string,
    action: AuthAction,
    ipAddress: string = '127.0.0.1',
  ): Promise<boolean> {
    try {
      const authLog = await tx.authLog.create({
        data: {
          userId,
          action,
          ipAddress,
          success: true,
        },
      });

      this.logger.log(`Auth log created: ${action} for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to create auth log for user ${userId}, action: ${action}`,
        error.stack,
      );
      return false;
    }
  }

  async authenticationUser(LoginAuthenticationDto: LoginAuthenticationDto) {
    try {
      const user = await this.user.findUnique({
        where: {
          email: LoginAuthenticationDto.email,
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        throw new RpcException({
          message: `User with email:'${LoginAuthenticationDto.email}' not registered`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      const isPasswordValid = bcrypt.compareSync(
        LoginAuthenticationDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new RpcException({
          message: `Invalid credentials`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      const { password: __, userRoles, ...rest } = user;

      // Extraer roles en formato más limpio
      const roles = userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      }));

      const userWithRoles = {
        ...rest,
        roles,
      };

      return {
        user: userWithRoles,
        token: await this.singnJWT(userWithRoles),
      };
    } catch (error) {
      throw new RpcException({
        status: 400,
        message: error.message,
      });
    }
  }

  async registerUser(createAuthenticationDto: CreateAuthenticationDto) {
    console.log('createAuthenticationDto', createAuthenticationDto);
    try {
      return await this.$transaction(async (tx) => {
        // 1. Verificar si el usuario ya existe
        const existingUser = await tx.user.findUnique({
          where: { email: createAuthenticationDto.email },
        });

        if (existingUser) {
          throw new RpcException({
            message: `User with email:'${createAuthenticationDto.email}' already exists`,
            status: HttpStatus.BAD_REQUEST,
          });
        }

        const rolesToAssign = await this.validateAndGetRoles(
          createAuthenticationDto.userRole || [],
        );

        // 2. Crear nuevo usuario
        const newUser = await tx.user.create({
          data: {
            email: createAuthenticationDto.email,
            password: bcrypt.hashSync(createAuthenticationDto.password, 10),
            isActive: true,
            name: createAuthenticationDto.name,
            avatar: createAuthenticationDto.avatar,
            userRoles:
              rolesToAssign.length > 0 ? { create: rolesToAssign } : undefined,
          },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        console.log('new user registered', newUser);

        // 3. Registrar auth log llamando a la función auxiliar
        const logSuccess = await this.registerAuthLog(
          tx,
          newUser.id,
          AuthAction.REGISTER,
        );

        if (!logSuccess) {
          this.logger.warn(
            'Auth log creation failed, but user was created successfully',
          );

          throw new RpcException({
            message: `User created but failed to register auth log`,
            status: HttpStatus.BAD_REQUEST,
          });
        }

        // 4. Preparar respuesta
        const { password: _, userRoles, ...userWithoutPassword } = newUser;

        const roles = userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
        }));

        const userWithRoles = {
          ...userWithoutPassword,
          roles,
        };

        return {
          user: userWithoutPassword,
          token: await this.singnJWT(userWithRoles),
        };
      });
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: 400,
        message: error.message,
      });
    }
  }

  async verifyToken(token: string) {
    try {
      const { sub, iat, exp, ...user } = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      return {
        user: user,
        token: await this.singnJWT(user),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Invalid token',
      });
    }
  }

  async findOne(id: string) {
    const user = await this.user.findFirst({
      where: { id, isActive: true },
    });

    if (!user) {
      throw new RpcException({
        message: `User with ID ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return user;
  }

  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto) {
    try {
      const { email } = requestPasswordResetDto;

      const user = await this.user.findUnique({ where: { email } });

      if (!user) {
        throw new RpcException({
          message: `There is no registered user with that email: ${email}`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      if (!user.isActive) {
        throw new RpcException({
          message: 'User account is not active',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      const expiresInSeconds = this.TOKEN_EXPIRATION_HOURS * 60 * 60;
      const token = this.jwtService.sign(
        { email: user.email, id: user.id },
        {
          secret: envs.jwtSecret,
          expiresIn: expiresInSeconds,
        },
      );

      await this.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
          used: false,
        },
      });

      this.logger.log(`Password reset JWT generated for: ${user.email}`);
      this.logger.debug(`Reset token (dev only): ${token}`);

      return {
        message: 'Password reset email sent successfully',
        status: HttpStatus.OK,
        token: process.env.NODE_ENV === 'development' ? token : undefined,
      };
    } catch (error) {
      this.logger.error(`Error requesting password reset: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error processing password reset request',
      });
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    try {
      const { token, newPassword } = resetPasswordDto;

      // Verificar JWT
      const payload = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      const user = await this.user.findUnique({
        where: { id: payload.id },
      });

      const pastPasswordResets = await this.passwordReset.findFirst({
        where: {
          used: true,
          token: token,
        },
      });

      if (pastPasswordResets) {
        throw new RpcException({
          message: 'This reset token has already been used',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      if (!user || !user.isActive) {
        throw new RpcException({
          message: 'Invalid or inactive user',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      await this.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      await this.passwordReset.updateMany({
        where: { token },
        data: { used: true },
      });

      this.logger.log(`Password successfully reset for: ${user.email}`);

      return {
        message: 'Password has been successfully reset',
        status: HttpStatus.OK,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'Reset token has expired',
        });
      }

      if (error instanceof RpcException) {
        throw error;
      }

      this.logger.error(`Error resetting password: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid reset token',
      });
    }
  }

  async validateResetToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      return {
        valid: true,
        email: payload.email,
        message: 'Token is valid',
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new RpcException({
          message: 'Reset token has expired',
          status: HttpStatus.BAD_REQUEST,
        });
      }

      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid reset token',
      });
    }
  }

  async validateAndGetRoles(
    roleIds: string[] = [],
  ): Promise<Array<{ role: { connect: { id: string } } }>> {
    if (!roleIds?.length) {
      return [];
    }

    const roles = await this.role.findMany({
      where: {
        id: { in: roleIds },
        isActive: true, // Opcional: validar que el rol esté activo
      },
    });

    // Verificar que todos los roles solicitados existen
    if (roles.length !== roleIds.length) {
      const existingRoleIds = roles.map((role) => role.id);
      const missingRoleIds = roleIds.filter(
        (id) => !existingRoleIds.includes(id),
      );

      throw new RpcException({
        message: `Los siguientes roles no existen: ${missingRoleIds.join(', ')}`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // Retornar la estructura para la creación de relaciones
    return roles.map((role) => ({
      role: { connect: { id: role.id } },
    }));
  }
}
