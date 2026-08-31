# 유지보수성(Maintainability) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `S3_PUBLIC_BASE_URL → S3_ENDPOINT → 기본값` 3단 폴백 규칙이 서로 다른 세 파일에 **세 번** 따로 구현돼 있고, 그중 하나(`main.ts`)는 다른 두 곳의 주석이 언급조차 하지 않는다.
  - 위치:
    - `codebase/backend/src/common/config/s3.config.ts:23-26` (`publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || 'http://localhost:9000'`) — 이 파일의 주석이 스스로 "폴백 **규칙**의 SoT" 라고 선언한 자리.
    - `codebase/backend/src/common/services/s3.service.ts:40-41` (`this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;`) — 같은 파일 주석(31-39행)이 "SoT 는 s3.config.ts 다, 이건 그 규칙의 사본이 아니라 2차 방어" 라고 정정까지 해 둔 자리.
    - `codebase/backend/src/main.ts:159-161` (`const publicBase = process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || '';`) — 같은 우선순위를 **세 번째로** 재구현하지만, 위 두 파일의 "SoT/2차 방어" 논의 어디에도 이 자리가 언급되지 않는다.
  - 상세: `s3.config.ts`와 `s3.service.ts`는 이미 한 번 "SoT가 어디인가"를 두고 리뷰 라운드를 거쳐 스스로 정정한 이력이 있는 민감한 규칙이다(주석에 그 경위가 적혀 있음). 그런데 `main.ts`의 부팅 경고 로직이 같은 우선순위(`S3_PUBLIC_BASE_URL` 우선, 없으면 `S3_ENDPOINT`)를 **세 번째 독립 사본**으로 직접 `process.env`에서 재구현하면서, 그 사실이 어느 쪽 주석에도 교차 참조되지 않는다. 나중에 우선순위가 바뀌거나(예: 새 3차 폴백 추가) 변수명이 바뀌면, grep으로 찾아지는 두 곳(`s3.config.ts`, `s3.service.ts`)만 고치고 `main.ts`의 경고 로직은 조용히 낡은 규칙으로 남을 위험이 있다 — 이 PR이 반복해서 경계하는 바로 그 "동작은 하는데 잘못된 채로 동작" 패턴이 이 규칙 자체에도 해당될 수 있다.
  - 제안: `s3.config.ts`가 export하는 순수 함수(`resolvePublicBaseUrl(env): string`) 하나로 규칙을 추출해 `s3.service.ts`의 2차 방어와 `main.ts`의 부팅 경고 모두 그걸 호출하게 하거나, 최소한 `main.ts`의 이 블록에 "규칙 사본 위치는 `s3.config.ts`" 라는 교차 참조 주석을 추가해 두 문서가 서로를 가리키게 한다.

- **[INFO]** `UsersService.updateAvatar`의 사용자 부재 분기만 이 파일의 다른 다중행 `if` 블록과 달리 중괄호가 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:114` (`if (!user) throw new NotFoundException({...})`, 114~120행에 걸친 다중행 블록).
  - 상세: 같은 파일에서 다중 문장/다중행 조건 분기는 전부 중괄호를 쓴다 — `getMe`의 동일한 `USER_NOT_FOUND` 분기(컨트롤러 쪽, 대응 패턴), `changePassword`의 세 분기(266, 273, 281행), `incrementLoginAttempts`의 318행 등. 반대로 진짜 한 줄짜리 조기 반환(171·175·333행, `if (...) return;`)은 의도적으로 중괄호를 생략한 것으로 보여 일관성이 있다. 114행만 "다중행인데 중괄호 없음"이라 패턴에서 벗어난다 — 기능 결함은 아니지만, 나중에 이 분기에 문장을 하나 더 추가하는 사람이 중괄호 없이 이어 붙이면 그 문장이 `if` 밖으로 빠지는 전형적인 버그 소지를 만든다.
  - 제안: 다른 분기들과 같이 `{ }`로 감싼다.

- **[INFO]** `UsersService.update()`가 범용 부분 갱신 메서드에 아바타 전용 정리 로직을 얹으면서 SRP를 넘어섰다 — 단, 이미 팀이 인지하고 유예를 기록해 둔 항목이다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232-246` (`update()`가 `'avatarUrl' in data` 분기로 사전 조회 + 사후 `deletePreviousAvatarObject` 호출을 겸함).
  - 상세: 호출부 17곳(대부분 totp·webauthn·auth 뜨거운 경로)을 갖는 범용 CRUD 메서드가 이제 S3 정리 오케스트레이션까지 알아야 한다. 이 자체는 `plan/in-progress/spec-sync-user-profile-gaps.md`의 "리뷰 3라운드의 구조 제안 처분" 절(W8·W9 — `UserAvatarService` 분리 제안, 재개 신호까지 명시)에 이미 기록·유예돼 있으므로 새로운 지적이 아니라 **추적 상태의 확인**이다. 심각도를 올리지 않는다.
  - 제안: 없음(추적 문서의 재개 신호를 그대로 따른다). 병행 참고로만 남긴다.

- **[INFO]** `ExpressNS`라는 새 네이밍 컨벤션이 이 컨트롤러에만 도입됐다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:53-57` (`import ExpressNS from 'express';`), 사용처 217·218·304·305행.
  - 상세: `Express` default import가 전역 `Express` 네임스페이스를 가려 `Express.Multer.File`을 못 쓰게 만드는 실제 문제(실측: `Namespace 'e' has no exported member 'Multer'`)를 고친 것 자체는 타당하고 주석·plan 문서 모두 근거가 충분하다. 다만 저장소의 다른 4개 컨트롤러는 여전히 `import Express from 'express'`를 쓰고 있어(같은 plan 문서가 "그쪽은 `Express.Multer`를 안 쓰니 안 건드렸다"고 명시), 이 하나의 파일만 `ExpressNS`라는 새 표기를 쓰게 됐다. 다음에 다른 컨트롤러가 같은 문제를 밟으면 `ExpressNS`를 따라갈지, 또 다른 이름을 고를지 정해진 컨벤션이 없다.
  - 제안: 지금 당장 바꿀 필요는 없다(단일 파일에서는 문제 없음). 다만 이 패턴이 두 번째 파일에서 재발하면, 그때는 `common/types`류에 공용 alias를 하나 두고 이름을 고정하는 편이 낫다.

- **[INFO]** `users-avatar.service.spec.ts`의 S3 mock(`upload`/`getPublicUrl`/`delete`) 3-메서드 리터럴이 파일 전체에서 6번 독립적으로 반복된다(총 18개 `jest.fn()` 선언).
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` — `setup()` 헬퍼(49-55행) 외에 `describe('UsersService.updateAvatar — 정리 실패는...')`(214-219행 부근), `describe('...PATCH 로 아바타를...')`의 `build()`(261-265행 부근), `describe('...lost update')`(319-323행 부근), `describe('...프로토타입 체인')`(395-399행 부근), `describe('...사용자 부재 응답')`(433-438행 부근) 각각이 자체 mock을 새로 만든다.
  - 상세: 팩토리 통합은 `plan/in-progress/spec-sync-user-profile-gaps.md`의 "조치하지 않음" 절에서 "지금 크기에서 읽기가 나빠지지 않는다"는 이유로 이미 검토·유예된 항목(W6)이라 새 지적이 아니다. 다만 파일 크기가 482줄까지 자란 지금 시점 기준으로는 리터럴 반복이 6곳까지 늘어난 것도 사실이라, 다음에 7번째 describe가 추가되는 시점에는 이 유예를 재검토할 근거가 될 수 있다.
  - 제안: 지금 당장은 조치 불필요. 참고용으로만 남긴다.

## 요약

핵심 변경(`UsersService.updateAvatar`/`deletePreviousAvatarObject`, `S3Service.getPublicUrl`, `UsersController.uploadAvatar`)은 함수 길이·중첩·네이밍·매직넘버 면에서 전반적으로 양호하다 — 상수는 이름이 붙어 있고(`AVATAR_MAX_BYTES`, `AVATAR_CONTENT_TYPES`), `avatarKeyPrefix`/`toProfileData` 같은 작은 헬퍼로 중복을 걷어냈으며(3개 엔드포인트가 공유하는 프로필 봉투를 한 곳으로 모은 것은 특히 좋은 리팩터다), 매 분기마다 "왜"를 설명하는 주석이 코드 옆에 붙어 있어 가독성이 높다. 가장 눈에 띄는 실질적 위험은 `S3_PUBLIC_BASE_URL`→`S3_ENDPOINT` 폴백 우선순위가 세 파일(설정·서비스·부팅 경고)에 독립 사본으로 흩어져 있고, 그중 부팅 경고 쪽 사본은 나머지 두 곳의 "SoT는 어디인가" 논의에서 아예 빠져 있다는 점이다 — 이 PR 자체가 "SoT 드리프트"를 여러 번 스스로 잡아낸 이력이 있는 규칙이기에, 이 세 번째 사본도 같은 계열의 위험으로 봐야 한다. 나머지는 스타일 일관성(중괄호 생략 1곳)과 이미 plan 문서에 유예로 기록된 두 항목(범용 `update()`의 책임 확장, 테스트 mock 보일러플레이트)의 확인 수준으로, 즉각 차단할 사안은 아니다.

## 위험도

LOW
