# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 프로필 응답 DTO 매핑 리터럴이 컨트롤러에 3중 복제됐다 (이번 변경으로 3번째 사본 추가)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:94-105`(`getMe`), `:129-138`(`updateMe`), `:183-192`(`uploadAvatar`, 신규)
  - 상세: `{ id, email, name, avatarUrl, locale: … ?? 'ko', theme: … ?? 'light' }` 형태의 객체 리터럴이 `getMe`/`updateMe`에 이미 두 번 있었고, 이번 PR 이 `uploadAvatar` 에 동일한 6줄을 그대로 세 번째로 복제했다(`updateMe` 블록과 완전히 동일 — `pendingEmail` 만 없음). 필드가 하나 더 늘거나(`avatarUrl` 응답 형태 변경 등) 필드 기본값 로직이 바뀔 때마다 세 곳을 동시에 고쳐야 하고, 실제로 이번 PR 이 그 갱신을 누락하지 않고 정확히 복붙한 것 자체가 이 패턴이 "복사해서 새 엔드포인트를 만드는" 관행으로 굳어지고 있음을 보여준다.
  - 제안: `private toProfileResponseData(user: User)` 같은 헬퍼로 뽑아 세 메서드가 공유하게 한다. `getMe` 만 `pendingEmail` 을 추가로 얹으면 되므로 스프레드(`{ ...this.toProfileResponseData(user), pendingEmail: … }`)로 자연스럽게 표현 가능.

- **[WARNING]** `Express` 네임스페이스 shadowing 회피용 `ExpressModule` 리네임이 저장소 전체가 아니라 이 파일에만 적용돼 명명 관례가 갈라졌다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:52-56`(신규 import 및 주석), `:213-214`, `:300-301`(사용처)
  - 상세: `import Express from 'express'` → `import ExpressModule from 'express'` 로 바꾼 근거(전역 `Express` 네임스페이스를 가려 `@types/multer` 의 `Express.Multer.File` 증강을 못 쓴다)는 타당하지만, 동일 패턴(`import Express from 'express'`)이 저장소에 4곳 더 남아 있다 — `codebase/backend/src/modules/auth/auth.controller.ts:74`, `codebase/backend/src/modules/auth/sessions.controller.ts:38`, `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:58`, `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:18`. 결과적으로 저장소 안에 "`Express.Request`" 를 쓰는 파일과 "`ExpressModule.Request`" 를 쓰는 파일이 공존하게 됐다 — 다음 사람이 grep 으로 패턴을 찾거나 컨벤션을 따라 쓸 때 어느 쪽이 표준인지 판단할 근거가 없다. 또한 `ExpressModule` 이라는 이름 자체가 NestJS 의 `@Module()` 데코레이터 클래스(`UsersModule` 등)와 표기가 겹쳐, "DI 로 등록된 NestJS 모듈"로 오독될 여지가 있다(실제로는 `express` npm 패키지의 default export 를 가리키는 타입 전용 임포트일 뿐).
  - 제안: (a) 리네임을 전역 컨벤션으로 승격해 나머지 4곳도 함께 바꾸거나, (b) 이번 파일만 필요한 최소 범위로 좁혀 `Multer.File` 타입이 필요한 `uploadAvatar` 한 곳만 전역 `Express` 네임스페이스를 유지하고, `Request`/`Response` 가 필요한 나머지 메서드(`changePassword`, `verifyEmailChange`)는 `import type { Request, Response } from 'express'` named import 로 바꿔 전역 네임스페이스를 가리지 않는 편이 더 흔한 해법이다. 이름도 `ExpressModule` 대신 `ExpressNS`/`expressTypes` 등으로 "NestJS Module 아님"을 드러내는 편이 안전하다.

- **[INFO]** `S3Service.publicBaseUrl` 폴백이 주석의 주장과 달리 사실상 두 번째 폴백 지점이다
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-35`
  - 상세: 주석은 "미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면 폴백 규칙이 두 곳이 되어 갈라진다" 고 적었지만, 바로 아래 코드는 `this.configService.get<string>('s3.publicBaseUrl') ?? endpoint` 로 정확히 그 폴백을 다시 수행한다. `s3.config.ts` 의 `publicBaseUrl` 은 `S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'` 체인이라 런타임에는 항상 truthy 문자열을 반환하므로 이 `?? endpoint` 분기는 정상 부팅 경로에서는 도달하지 않는다(테스트에서 `ConfigService` 를 부분 스텁할 때만 의미가 있다). 주석의 "두 곳이 되어 갈라진다" 는 우려와 실제 코드의 방어적 재폴백이 서로 다른 얘기를 하고 있어, 다음 사람이 "정말 여기서 폴백 로직이 갈렸나?" 를 판단하려 할 때 혼란을 준다.
  - 제안: 주석을 "이 `?? endpoint` 는 `s3.config.ts` 값이 항상 채워진다는 전제가 테스트 더블 등에서 깨질 때의 방어적 fallback이며, `S3_ENDPOINT` 자체를 재해석하지는 않는다" 정도로 명확히 하거나, 그 전제가 확실하면 `?? endpoint` 를 제거해 단일 진실 지점을 유지한다.

- **[INFO]** `INVALID_FILE_TYPE` 에러 코드가 "파일 누락"과 "허용되지 않는 확장자" 두 개의 다른 사유에 재사용된다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (updateAvatar 내 두 `BadRequestException` 블록, `!file?.buffer?.length` 분기와 `!contentType` 분기)
  - 상세: 두 분기 모두 `code: 'INVALID_FILE_TYPE'` 을 던진다. 파일이 아예 없는 것과 파일은 있는데 형식이 틀린 것은 클라이언트 UX 상 구분할 이유가 있을 수 있는데(예: "파일을 선택하세요" vs "이 형식은 지원하지 않습니다"), 코드값만으로는 프런트에서 두 케이스를 가를 수 없다. 컨트롤러 Swagger 문서(`ApiBadRequestResponse`)도 "파일 누락 또는 허용되지 않는 이미지 형식" 을 한 응답으로 뭉뚱그려 이 결합을 그대로 반영하고 있다.
  - 제안: 필요하다면 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 로 분리한다(다만 API 계약 변경이라 필요성이 낮으면 현행 유지도 무방 — 유지보수성보다 계약 안정성이 우선일 수 있음).

## 요약

이번 PR(아바타 업로드 공개 URL 서빙)의 신규 코드(`s3.config.ts`, `s3.service.ts`, `users.service.ts` `updateAvatar`/`deletePreviousAvatarObject`, 신규 테스트 파일)는 각 결정(UUID 키·확장자 화이트리스트·저장-후-삭제 순서·base URL 앵커 복원)에 대해 "왜" 를 설명하는 JSDoc·인라인 주석이 촘촘히 달려 있고, 함수 길이·중첩·순환 복잡도 모두 낮아 개별 함수 단위의 가독성은 높다. 매직 넘버는 이름 있는 상수(`AVATAR_MAX_BYTES`)로 처리됐고, 확장자 화이트리스트도 단일 맵(`AVATAR_CONTENT_TYPES`)에서 파생돼 에러 메시지와 매핑이 갈라지지 않는다. 다만 컨트롤러 계층에서는 두 가지 유지보수 부채가 보인다 — ① 프로필 응답 DTO 매핑이 세 메서드에 걸쳐 완전히 동일한 코드로 복제되어 있고 이번 PR 이 그 복제를 한 번 더 늘렸으며, ② `Express` 네임스페이스 shadowing 회피 리네임(`ExpressModule`)이 저장소 전역이 아니라 이 파일에만 적용돼 동일 패턴이 4개 파일에 여전히 다른 이름으로 남아 있다. 둘 다 즉각적인 버그는 아니지만 다음 사람이 "표준이 무엇인가" 를 판단하기 어렵게 만드는 종류의 결함이라 WARNING 으로 잡았다.

## 위험도

LOW
