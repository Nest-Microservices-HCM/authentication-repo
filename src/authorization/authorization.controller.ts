import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthorizationService } from './authorization.service';
import { CreateAuthorizationDto } from './dto/create-authorization.dto';
import { UpdateAuthorizationDto } from './dto/update-authorization.dto';

@Controller()
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @MessagePattern('getUserPermissions')
  async getUserPermissions(
    @Payload() data: { userId: string; roleId: string },
  ) {
    return this.authorizationService.getEffectivePermissions(
      data.roleId,
      data.userId,
    );
  }

  @MessagePattern('createAuthorization')
  create(@Payload() createAuthorizationDto: CreateAuthorizationDto) {
    return this.authorizationService.create(createAuthorizationDto);
  }

  @MessagePattern('findAllAuthorization')
  findAll() {
    return this.authorizationService.findAll();
  }

  @MessagePattern('findOneAuthorization')
  findOne(@Payload() id: number) {
    return this.authorizationService.findOne(id);
  }

  @MessagePattern('updateAuthorization')
  update(@Payload() updateAuthorizationDto: UpdateAuthorizationDto) {
    return this.authorizationService.update(
      updateAuthorizationDto.id,
      updateAuthorizationDto,
    );
  }

  @MessagePattern('removeAuthorization')
  remove(@Payload() id: number) {
    return this.authorizationService.remove(id);
  }
}
