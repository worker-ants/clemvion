import { IsEmail } from 'class-validator';

export class CheckEmailDto {
  @IsEmail()
  email: string;
}
