import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt'
import { PrismaService } from 'prisma/prisma.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor (
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        const user = await this.prisma.user.findUnique({
            where: { email: body.email}
        });

        if(!user) throw new UnauthorizedException('Wrong email or password!');

        const isMatch = await bcrypt.compare(body.password, user.password);
        if(!isMatch) throw new UnauthorizedException('Wrong email or password!')
        
        return this.authService.login(user);
    }
}