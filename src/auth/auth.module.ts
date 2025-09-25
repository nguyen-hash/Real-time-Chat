import { Global, Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConstants } from './constants';
import { AuthService } from './auth.service';
import { PrismaService } from 'prisma/prisma.service';
import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [
    PassportModule, 
    JwtModule.register({ 
      secret: jwtConstants.secret, 
      signOptions: { expiresIn: '1h'}
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService]
})
export class AuthModule {}
