import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from 'src/auth/constants';

@WebSocketGateway({
  cors: { origin: '*' }, // allow all origins for now
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();
  private roomUsers = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  private broadcastRoomPresence(roomId: string) {
    const users = Array.from(this.roomUsers.get(roomId) || []);
    this.server.to(roomId).emit('room:presence', { roomId, users });
  }

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers['authorization']?.toString()?.replace('Bearer ', '');

      if (!token) {
        socket.emit('error', 'Authorization token missing');
        socket.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, { secret: jwtConstants.secret }) as any;
      const userId = payload.sub;

      if (!userId) {
        socket.emit('error', 'Invalid token');
        socket.disconnect(true);
        return;
      }

      // fetch username from DB
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });

      if (!user) {
        socket.emit('error', 'User not found');
        socket.disconnect(true);
        return;
      }

      (socket as any).userId = user.id;
      (socket as any).username = user.name;

      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      this.broadcastGlobalPresence();
      socket.emit('connected', { userId: user.id, username: user.name });
    } catch (error) {
      socket.emit('error', 'Authentication failed');
      socket.disconnect(true);
    }
  }

  private async broadcastGlobalPresence() {
    // get all usernames of online users
    const onlineUsers = Array.from(this.userSockets.keys());

    const users = await this.prisma.user.findMany({
      where: { id: { in: onlineUsers } },
      select: { id: true, name: true },
    });

    this.server.emit('presence:global', {
      count: onlineUsers.length,
      users,
    });
  }


  async handleDisconnect(socket: Socket) {
    const userId = (socket as any).userId as string;
    if (!userId) return;

    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) this.userSockets.delete(userId);
    }

    for (const [roomId, users] of this.roomUsers.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        this.broadcastRoomPresence(roomId);
      }
    }

    this.broadcastGlobalPresence();
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @MessageBody() body: { roomId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = (socket as any).userId as string;
    const { roomId } = body;

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      socket.emit('room:join:error', 'Room not found');
      return;
    }

    if (room.isPrivate) {
      const membership = await this.prisma.roomMemberShip.findUnique({
        where: { userId_roomId: { userId, roomId } },
      }).catch(() => null);

      if (!membership) {
        socket.emit('room:join:error', 'Not allowed to join private room');
        return;
      }
    }

    socket.join(roomId);

    if (!this.roomUsers.has(roomId)) this.roomUsers.set(roomId, new Set());
    this.roomUsers.get(roomId)!.add(userId);

    socket.emit('room:joined', { roomId });
    this.broadcastRoomPresence(roomId);
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() data: { roomId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = (socket as any).userId as string;
    const { roomId, content } = data;

    const message = await this.prisma.message.create({
      data: { roomId, senderId: userId, content },
      include: { sender: true },
    });

    this.server.to(roomId).emit('message:new', message);
  }

  @SubscribeMessage('room:create')
  async createRoom(
    @MessageBody() body: { name: string; isPrivate?: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = (socket as any).userId as string;

    try {
      
      const room = await this.prisma.room.create({
        data: {
          name: body.name,
          isPrivate: body.isPrivate ?? false,
          ownerId: userId, 
        },
      });

      
      await this.prisma.roomMemberShip.create({
        data: { userId, roomId: room.id },
      });

      
      socket.join(room.id);

      if (!this.roomUsers.has(room.id)) this.roomUsers.set(room.id, new Set());
      this.roomUsers.get(room.id)!.add(userId);

      
      socket.emit('room:created', room);
      this.broadcastRoomPresence(room.id);
    } catch (e) {
      console.error(e);
      socket.emit('room:create:error', 'Failed to create room');
    }
  }

}
