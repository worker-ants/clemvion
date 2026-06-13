import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import {
  hashPassword,
  validatePasswordStrength,
} from '../../common/utils/password.util';

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

  async findByOauth(
    provider: string,
    providerId: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { oauthProvider: provider, oauthProviderId: providerId },
    });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.userRepository.findOneOrFail({ where: { id } });
  }

  /**
   * 현재 비밀번호 검증 → 강도 검증 → 해시 → 저장. (refactor 04 B-2 — SRP)
   *
   * controller 에 흩어져 있던 bcrypt 검증·강도검증·해시·update 도메인 로직을 service 로
   * 모은다. 세션 회전·감사 기록은 액터 세션 컨텍스트(workspaceId·refresh 쿠키)가 controller
   * 에만 있어 controller 책임으로 남긴다(§Rationale 4.1.B·2.3.C). 본 메서드는 비밀번호
   * 교체만 담당한다.
   *
   * @throws NotFoundException `USER_NOT_FOUND` — 사용자 없음
   * @throws UnauthorizedException `INVALID_PASSWORD` — passwordHash 부재(OAuth-only) 또는 현재 비밀번호 불일치
   * @throws BadRequestException — 새 비밀번호 강도 정책 위반(`validatePasswordStrength`)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    validatePasswordStrength(newPassword);

    const passwordHash = await hashPassword(newPassword);
    await this.update(userId, { passwordHash });
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
