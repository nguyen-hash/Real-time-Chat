export class CreateRoomDto {
    name: string;
    isPrivate?: boolean;
    allowedUserId?: string[];
}