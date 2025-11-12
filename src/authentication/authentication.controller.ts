import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthenticationService } from './authentication.service';
import { CreateAuthenticationDto } from './dto/create-authentication.dto';
import { LoginAuthenticationDto } from './dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

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

  @MessagePattern('verifyAuthenticationToken')
  verify(@Payload() token: string) {
    return this.authenticationService.verifyToken(token);
  }

  @MessagePattern('findUserById')
  findOne(@Payload('id') id: string) {
    return this.authenticationService.findOne(id);
  }

  @MessagePattern('requestPasswordReset')
  requestPasswordReset(
    @Payload() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    return this.authenticationService.requestPasswordReset(
      requestPasswordResetDto,
    );
  }

  @MessagePattern('resetPassword')
  resetPassword(@Payload() resetPasswordDto: ResetPasswordDto) {
    return this.authenticationService.resetPassword(resetPasswordDto);
  }

  @MessagePattern('validateResetToken')
  validateResetToken(@Payload() token: string) {
    return this.authenticationService.validateResetToken(token);
  }
}
