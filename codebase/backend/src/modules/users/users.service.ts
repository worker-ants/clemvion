import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Service } from '../../common/services/s3.service';
import { User } from './entities/user.entity';
import {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from '../../common/utils/password.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * 아바타로 허용하는 확장자 → `Content-Type`.
   *
   * **확장자 화이트리스트로 판정한다** — 업로드 클라이언트가 보내는 `mimetype` 은 신뢰할
   * 수 없고(임의 지정 가능), 여기서 정한 값을 그대로 오브젝트의 `Content-Type` 으로 쓴다.
   * 공개 버킷에서 이 헤더가 곧 브라우저의 렌더 방식이므로, `image/*` 로 고정하는 것이
   * `text/html` 이 저장돼 같은 오리진에서 실행되는 경로를 원천 차단한다.
   *
   * SVG 는 **의도적으로 제외**한다 — 스크립트를 품을 수 있는 유일한 이미지 포맷이라
   * 공개 URL 로 서빙하면 저장형 XSS 표면이 된다.
   */
  // Swagger 산문의 확장자 목록과 동기화됐는지 테스트가 대조하므로 `public` 이다
  // (`users-avatar-swagger-sync.spec.ts`).
  static readonly AVATAR_CONTENT_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  /** 아바타 크기 상한. 컨트롤러의 multer 한도와 **같은 값이어야** 한다. */
  static readonly AVATAR_MAX_BYTES = 2 * 1024 * 1024;

  /**
   * 아바타 키 접두. **생성(`updateAvatar`)과 복원(`deletePreviousAvatarObject`)이 같은
   * 문자열을 봐야 한다** — 따로 하드코딩하면 레이아웃을 바꿀 때 한쪽만 고쳐지고, 그 결과는
   * 예외가 아니라 조용히 쌓이는 고아 객체다.
   */
  private static avatarKeyPrefix(userId: string): string {
    return `avatars/${userId}/`;
  }

  /**
   * 아바타 이미지를 업로드하고 `user.avatarUrl` 을 **공개 URL** 로 갱신한다.
   *
   * ## 공개 버킷 전제 (사용자 결정 2026-08-31)
   *
   * 이 경로가 만드는 오브젝트는 **URL 을 아는 누구나 읽을 수 있다.** 세 안(공개 URL /
   * 서명 URL / 백엔드 프록시) 중 공개 URL 이 선택됐고, 그 대가가 이것이다.
   *
   * 완화는 **키의 추측 불가능성**이다 — `avatars/{userId}/{uuid}.{ext}` 의 `uuid` 가
   * 없으면 userId 만으로 키가 완성돼 워크스페이스 멤버 목록을 아는 사람이 아바타를
   * 열거할 수 있다. 그래서 uuid 는 장식이 아니라 **접근 통제의 일부**다.
   *
   * @throws BadRequestException `FILE_REQUIRED` — 파일 부재.
   * @throws BadRequestException `INVALID_FILE_TYPE` — 허용되지 않는 확장자.
   * @throws NotFoundException `USER_NOT_FOUND` — 사용자 없음.
   */
  async updateAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<User> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        // 확장자 불허(`INVALID_FILE_TYPE`)와 **다른 코드**다 — 클라이언트가 취할 행동이
        // 다르다("파일을 고르세요" vs "다른 형식으로 바꾸세요"). 저장소 규약이 메시지
        // 문자열 파싱을 금지하므로 코드로 갈라야 분기할 수 있다.
        code: 'FILE_REQUIRED',
        message: 'Avatar image file is required',
      });
    }

    // `ext` 는 사용자가 보낸 **파일명**에서 나오므로 `constructor`·`__proto__`·
    // `toString` 같은 `Object.prototype` 상속 이름이 될 수 있다. 일반 객체 인덱싱은 그
    // 이름들에 truthy 를 돌려줘 화이트리스트를 통과시킨다(실측: 7개 전부 truthy).
    // **소유 프로퍼티인지 먼저 묻는다.**
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const contentType =
      ext &&
      Object.prototype.hasOwnProperty.call(
        UsersService.AVATAR_CONTENT_TYPES,
        ext,
      )
        ? UsersService.AVATAR_CONTENT_TYPES[ext]
        : undefined;
    if (!contentType) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: `Only ${Object.keys(UsersService.AVATAR_CONTENT_TYPES).join(', ')} images are allowed`,
      });
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user)
      throw new NotFoundException({
        // `message` 를 빼면 같은 `code` 를 쓰는 형제 엔드포인트(`getMe`·`updateMe`·
        // `changePassword`)와 응답 본문이 갈린다.
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });

    const previousUrl = user.avatarUrl;
    const key = `${UsersService.avatarKeyPrefix(userId)}${randomUUID()}.${ext}`;
    await this.s3Service.upload(key, file.buffer, contentType);

    // **`save(user)` 가 아니라 컬럼 단위 `update` 다.**
    //
    // `user` 는 S3 업로드 **앞에서** 읽은 스냅샷이다. 업로드는 네트워크 I/O 라 수백 ms~수 초
    // 걸리고, 그 사이 다른 요청이 같은 row 를 바꿀 수 있다(로그인 실패 카운터·계정 잠금·
    // 2FA 등록 — 전부 `usersService.update()` 의 부분 갱신 경로다). 그 뒤 이 스냅샷으로
    // 엔티티를 저장하면 **그 변경들이 조용히 옛 값으로 되돌아간다**(lost update).
    //
    // 아바타 교체가 건드려야 하는 컬럼은 `avatarUrl` 하나뿐이다. 컬럼을 지정해 쓰면 다른
    // 컬럼을 아예 UPDATE 문에 싣지 않으므로 이 경쟁 자체가 성립하지 않는다 — 락도
    // `@VersionColumn` 도 필요 없다.
    const avatarUrl = this.s3Service.getPublicUrl(key);
    await this.userRepository.update(userId, { avatarUrl });
    // 응답 봉투가 쓸 최신 상태. 업로드 도중 바뀐 다른 컬럼도 여기서 반영된다.
    const updated = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    // **DB 저장 뒤에** 옛 객체를 지운다. 순서를 뒤집으면 저장이 실패했을 때 사용자에게
    // 이미 지워진 아바타를 가리키는 URL 이 남는다 — 고아 객체(과금·용량)보다 나쁘다.
    await this.deletePreviousAvatarObject(userId, previousUrl);
    return updated;
  }

  /**
   * 교체된 아바타 객체를 best-effort 로 지운다.
   *
   * **URL 전체가 아니라 `avatars/{userId}/…` 조각으로 키를 복원한다** — 저장된 값은
   * `publicBaseUrl` 이 섞인 완성 URL 이고, 그 base 는 배포 환경에 따라(그리고 시간에
   * 따라) 달라진다. base 를 걷어내는 방식이면 도메인이 바뀐 뒤의 옛 URL 에서 키를 못
   * 찾는다. 자기 userId 접두로 앵커를 잡으면 base 와 무관하고, 남의 키를 지울 수도 없다.
   *
   * **버킷 세그먼트는 일부러 보지 않는다.** 앵커 앞부분(`{base}/{bucket}`)을 통째로
   * 버리므로, 옛 URL 이 지금과 다른 버킷을 가리켜도 삭제는 **현재 설정된 버킷**에서
   * 일어난다. 즉 버킷을 옮기면 옛 버킷의 객체는 남고(고아), 현재 버킷의 같은 키를
   * 지우려 시도한다 — 그 키는 **같은 userId 접두 아래**라 남의 객체를 건드릴 위험은
   * 없고, 없으면 그냥 실패해 아래 `warn` 으로 떨어진다. 버킷 이전은 별도 마이그레이션
   * 작업이지 이 best-effort 정리의 몫이 아니다.
   *
   * 실패는 삼킨다 — 아바타 교체는 이미 성공했고, 고아 객체 하나가 사용자 흐름을 깨뜨릴
   * 이유가 없다. 대신 `warn` 으로 관측 가능하게 남긴다.
   */
  private async deletePreviousAvatarObject(
    userId: string,
    previousUrl: string | null | undefined,
  ): Promise<void> {
    if (!previousUrl) return;
    const marker = UsersService.avatarKeyPrefix(userId);
    const at = previousUrl.indexOf(marker);
    // 우리가 올린 객체가 아니면(외부 URL 을 `PATCH /users/me` 로 넣은 경우) 건드리지 않는다.
    if (at < 0) return;

    // **파싱도 try 안이다.** 첫 판은 `decodeURIComponent` 를 밖에 두었는데, 옛
    // `avatarUrl` 에 깨진 퍼센트 인코딩(`%zz`)이 있으면 `URIError` 가 전파돼 — 업로드와
    // DB 저장이 **이미 성공한 뒤에** — 클라이언트가 500 을 받았다. 그 값은 사용자가
    // `PATCH /users/me` 로 직접 넣을 수 있고 `@IsUrl` 은 퍼센트 인코딩 유효성을 보지 않는다.
    // 바로 위 JSDoc 이 "실패는 삼킨다" 고 적고 있었으므로 **보장이 구현보다 넓었다**.
    try {
      const key = decodeURIComponent(previousUrl.slice(at));
      // 쿼리스트링·프래그먼트가 붙어 있으면 키가 아니다 — 잘라낸다.
      const cleanKey = key.split(/[?#]/)[0];
      await this.s3Service.delete(cleanKey);
    } catch (err) {
      this.logger.warn(
        `avatar cleanup failed (orphan object left): previousUrl=${previousUrl} — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

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

  /**
   * 부분 갱신. `avatarUrl` 이 페이로드에 있으면 **옛 S3 객체도 정리**한다.
   *
   * ## 왜 `'avatarUrl' in data` 로 가두는가
   *
   * 이 메서드의 호출부는 17곳이고 대부분 totp·webauthn·auth 의 뜨거운 경로다. 무조건
   * 사전 조회를 하면 그 전부가 SELECT 를 하나씩 더 낸다. 아바타를 담은 페이로드는
   * 프로필 수정과 OAuth 연동뿐이라, 그때만 조회한다.
   *
   * ## 왜 "값이 바뀐 경우에만" 인가
   *
   * OAuth 재연동은 **같은** `avatarUrl` 을 다시 넘긴다. 값 비교 없이 지우면 방금 저장한
   * — 즉 사용 중인 — 객체를 날린다. 정리의 조건은 "페이로드에 있다" 가 아니라 "달라졌다" 다.
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    const previousUrl =
      'avatarUrl' in data
        ? ((await this.userRepository.findOne({ where: { id } }))?.avatarUrl ??
          null)
        : null;

    await this.userRepository.update(id, data);
    const updated = await this.userRepository.findOneOrFail({ where: { id } });

    if (previousUrl && previousUrl !== updated.avatarUrl) {
      await this.deletePreviousAvatarObject(id, previousUrl);
    }
    return updated;
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

    const matches = await comparePassword(currentPassword, user.passwordHash);
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

  /**
   * 다른 사용자가 해당 이메일을 (대소문자 무시) 사용 중인지. 이메일 변경 흐름의
   * 신규 이메일 중복 검사용 (spec/5-system/1-auth.md §1.1.B). 본인(excludeUserId)은 제외.
   */
  async emailTakenByOther(
    email: string,
    excludeUserId: string,
  ): Promise<boolean> {
    const count = await this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.id != :id', { id: excludeUserId })
      .getCount();
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
