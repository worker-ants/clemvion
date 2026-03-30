import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.userRepository.findOneOrFail({ where: { id } });
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.userRepository.count({ where: { email } });
    return count > 0;
  }

  async incrementLoginAttempts(id: string): Promise<number> {
    const user = await this.userRepository.findOneOrFail({ where: { id } });
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    }
    await this.userRepository.save(user);
    return user.loginAttempts;
  }

  async resetLoginAttempts(id: string): Promise<void> {
    await this.userRepository.update(id, {
      loginAttempts: 0,
      lockedUntil: null as unknown as Date,
    });
  }

  async isLocked(user: User): Promise<boolean> {
    if (!user.lockedUntil) return false;
    if (new Date() > user.lockedUntil) {
      await this.resetLoginAttempts(user.id);
      return false;
    }
    return true;
  }
}
