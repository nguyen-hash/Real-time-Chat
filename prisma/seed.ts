import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient();

async function main() {
    

    const passwordHash = await bcrypt.hash('pw123', 10);

    const alice = await prisma.user.create({
        data: {
            email: 'alice@example.com',
            password: passwordHash,
            name: 'Alice'
        }
    });

    const bob = await prisma.user.create({
        data: {
            email: 'bob@example.com',
            password: passwordHash,
            name: 'Bob'
        }
    });

    const generalRoom = await prisma.room.create({
        data: {
            name: 'General',
            isPrivate: false,
            ownerId: alice.id
        }
    });

    await prisma.roomMemberShip.createMany({
        data: [
            { userId: alice.id, roomId: generalRoom.id },
            { userId: bob.id, roomId: generalRoom.id}
        ]
    });

    await prisma.message.createMany({
        data: [
            {
                content: 'Hello everyone',
                senderId: alice.id,
                roomId: generalRoom.id
            },
            {
                content: 'Hi Alice!',
                senderId: bob.id,
                roomId: generalRoom.id
            }
        ]
    });

    console.log('Database seeded with users, rooms and messages')

}

main()
    .catch(e=> {
        console.error(e);
        process.exit(1);
    })
    .finally(async () =>  {
        await prisma.$disconnect();
    });