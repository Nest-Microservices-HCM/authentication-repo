import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthenticationService } from './authentication.service';
import { CreateAuthenticationDto } from './dto/create-authentication.dto';
import { LoginAuthenticationDto } from './dto';

@Controller()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @MessagePattern('loginAuthentication')
  login(@Payload() LoginAuthenticationDto: LoginAuthenticationDto) {
    return this.authenticationService.authenticationUser(
      LoginAuthenticationDto,
    );
  }

  @MessagePattern('registerAuthentication')
  register(@Payload() createAuthenticationDto: CreateAuthenticationDto) {
    return this.authenticationService.registerUser(createAuthenticationDto);
  }

  @MessagePattern('verifyAuthentication')
  verify(@Payload('id') id: string) {
    return this.authenticationService.verifyUser(id);
  }

  @MessagePattern('findUserById')
  findOne(@Payload('id') id: string) {
    return this.authenticationService.findOne(id);
  }
}
