import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [UsersModule, PrismaModule,JwtModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatGateway]
})
export class ChatModule {}
