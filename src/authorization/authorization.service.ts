import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateAuthorizationDto } from './dto/create-authorization.dto';
import { UpdateAuthorizationDto } from './dto/update-authorization.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AuthorizationService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('AuthorizationService');
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async getEffectivePermissions(roleId: string, userId: string) {
    try {
      // Validaciones básicas
      if (!roleId || typeof roleId !== 'string' || roleId.trim().length === 0) {
        throw new RpcException({
          message: `Invalid role ID provided: ${roleId}`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        throw new RpcException({
          message: `Invalid user ID provided: ${userId}`,
          status: HttpStatus.BAD_REQUEST,
        });
      }

      //  Verificar si existe el rol
      const role = await this.userRoleAssignment.findFirst({
        where: {
          userId,
          roleId,
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: {
                    include: { action: true, module: true, subModule: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!role) {
        throw new RpcException({
          message: `Role with ID '${roleId}' not found`,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Obtener permisos directos del usuario
      const userPerms = await this.userPermission.findMany({
        where: { userId },
        include: {
          permission: {
            include: { action: true, module: true, subModule: true },
          },
        },
      });

      // Construir el mapa de permisos
      const resultMap = new Map<string, string>();

      // 🔹 1. Agregar permisos del rol
      for (const rp of role.role.rolePermissions) {
        const perm = rp.permission!;
        const code =
          `${perm.module.name}:${perm.subModule?.name ?? ''}:${perm.action.code}`.replace(
            /:+$/,
            '',
          );
        resultMap.set(perm.id, code);
      }

      // 🔹 2. Aplicar overrides del usuario (granted = true o false)
      for (const up of userPerms) {
        const perm = up.permission!;
        const code =
          `${perm.module.name}:${perm.subModule?.name ?? ''}:${perm.action.code}`.replace(
            /:+$/,
            '',
          );
        if (up.granted) resultMap.set(perm.id, code);
        else resultMap.delete(perm.id);
      }

      // Retornar permisos efectivos combinados
      return Array.from(resultMap.values());
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

  create(createAuthorizationDto: CreateAuthorizationDto) {
    return 'This action adds a new authorization';
  }

  findAll() {
    return `This action returns all authorization`;
  }

  findOne(id: number) {
    return `This action returns a #${id} authorization`;
  }

  update(id: number, updateAuthorizationDto: UpdateAuthorizationDto) {
    return `This action updates a #${id} authorization`;
  }

  remove(id: number) {
    return `This action removes a #${id} authorization`;
  }
}
