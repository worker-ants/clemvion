import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsBoolean()
  termsAccepted: boolean;
}
