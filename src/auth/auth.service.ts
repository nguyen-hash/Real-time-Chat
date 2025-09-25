import {  Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { access } from "fs";

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService) {}

    async login(user: { id: string; email: string }) {
        const payload = { sub: user.id, email: user.email };

        return {
            access_token: this.jwtService.sign(payload)
        };
    }
}
