# 정식 규약 준수 검토 — `codebase/backend/src/modules/auth`

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 대상: `codebase/backend/src/modules/auth` (기존 코드 베이스)
기준 규약: `spec/conventions/swagger.md`, `spec/conventions/node-output.md`, `spec/5-system/2-api-convention.md`, `CLAUDE.md`

---

### 발견사항

- **[CRITICAL]** `forgotPassword` 엔드포인트 — 응답 wrapping 누락
  - target 위치: `auth.controller.ts:379-381` — `async forgotPassword()` 메서드 본문
  - 위반 규약: `spec/conventions/swagger.md §2-5` "프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌉니다" / `§5-3` 래퍼 헬퍼 사용 패턴
  - 상세: `return this.authService.forgotPassword(dto.email)` 가 서비스의 raw 반환값 `{ message: '...' }` 를 그대로 반환한다. 다른 엔드포인트(예: `logout`, `register`, `resetPassword`)는 모두 `{ data: { ... } }` 로 명시 wrap 하지만 이 메서드만 누락됐다. Swagger 문서는 `@ApiOkWrappedResponse(AuthMessageDto, ...)` 로 `{ data: AuthMessageDto }` 를 선언하므로 실제 응답 구조와 문서가 불일치한다. `TransformInterceptor` 가 자동 wrap 한다면 외견상 무해할 수 있으나, 같은 컨트롤러 내 일관성이 깨진다.
  - 제안: `return { data: { message: result.message } }` 형태로 명시 wrap 하거나, 서비스 반환값을 분해해 `return { data: await this.authService.forgotPassword(dto.email) }` 로 통일한다.

- **[CRITICAL]** `checkEmail` 엔드포인트 — 응답 wrapping 누락
  - target 위치: `auth.controller.ts:411-413` — `async checkEmail()` 메서드 본문
  - 위반 규약: `spec/conventions/swagger.md §2-5` + `§5-3`
  - 상세: `return this.authService.checkEmail(dto.email)` 가 서비스의 `{ available: boolean }` 을 그대로 반환한다. Swagger 선언은 `@ApiOkWrappedResponse(CheckEmailResultDto, ...)` 로 `{ data: CheckEmailResultDto }` 를 약속하므로 선언-실체 불일치다. `forgotPassword` 와 동일한 패턴으로 wrap 누락.
  - 제안: `return { data: await this.authService.checkEmail(dto.email) }` 로 wrap.

- **[WARNING]** `AuthController` 클래스 레벨 `@ApiBearerAuth` — `@Public()` 전용 컨트롤러 처리 불일치
  - target 위치: `auth.controller.ts:81-83` — `@ApiTags('Auth')`, `@ApiBearerAuth('access-token')`, `@Controller('auth')`
  - 위반 규약: `spec/conventions/swagger.md §2-1` "`@Public()` 전용 컨트롤러(auth, health, hooks)는 `@ApiBearerAuth`를 **넣지 않습니다**. 혼합 컨트롤러는 클래스 레벨 `@ApiBearerAuth('access-token')`를 넣고, `@Public()` 엔드포인트에는 설명에서 '인증 불필요'를 명시합니다."
  - 상세: `AuthController` 는 대부분이 `@Public()` 엔드포인트이나 `2fa/setup`, `2fa/verify`, `2fa/disable` 세 엔드포인트는 `@UseGuards(JwtAuthGuard)` 보호가 필요하다. 따라서 "혼합 컨트롤러" 기준이 적용되어야 하고, 현재 클래스 레벨 `@ApiBearerAuth` 는 규약상 허용된다. 그러나 `@Public()` 엔드포인트 중 `@ApiUnauthorizedResponse` 데코레이터 없이 선언되지 않은 것들이 있어 혼합 컨트롤러라는 사실이 Swagger UI 에서 명확히 구분되지 않을 수 있다. 엄밀히 규약 위반은 아니지만 "혼합" 사실을 각 `@Public()` 메서드 description 에 명시하지 않은 경우들이 있다.
  - 제안: 규약 §2-1 에 따라 `@Public()` 엔드포인트의 `description` 필드에 "인증 불필요" 를 명시하거나, 별도 `PublicAuthController` 와 `ProtectedAuthController` 로 분리해 규약 적용을 단순화한다. 현재 상태에서는 WARNING 수준.

- **[WARNING]** `LoginChallengeDto` — Swagger 문서와 실제 응답 스키마 불일치
  - target 위치: `dto/responses/auth-response.dto.ts:11-17` / `auth.controller.ts:178-204`
  - 위반 규약: `spec/conventions/swagger.md §5-2` "응답 DTO 위치: 엔티티를 그대로 노출하지 말고, API 응답 형태에 맞춰 별도 DTO를 만든다" + §2-5 wrapping 일관성
  - 상세: `POST /auth/login` 의 성공 응답은 실제로 두 가지 분기다: (a) 정상 로그인 시 `{ data: { accessToken } }`, (b) 2FA 필요 시 `{ data: { requiresTotp: true, challengeToken } }`. 현재 Swagger 선언은 `@ApiOkWrappedResponse(AccessTokenDto, ...)` 만 달려 있어 (b) 분기가 문서화되지 않는다. `LoginChallengeDto` 가 정의는 되어 있으나 컨트롤러에서 참조되지 않는다(미사용 export). 응답 분기를 모두 표현하려면 Swagger `oneOf` 또는 두 개의 분리된 `@ApiOkResponse` + `schema: { oneOf: [...] }` 구성이 필요하다.
  - 제안: `@ApiOkWrappedResponse` 대신 `@ApiOkResponse({ schema: { oneOf: [{ $ref: getSchemaPath(AccessTokenDto) }, { $ref: getSchemaPath(LoginChallengeDto) }] } })` 혹은 분기 조건을 description 에서 명시한다. 또는 규약 §5-4 체크리스트에 맞게 union 응답 DTO 를 별도로 정의한다.

- **[WARNING]** `SessionListDto.data` 필드 — 응답 wrapping 이중 중첩 가능성
  - target 위치: `dto/responses/session.dto.ts:53-57` — `SessionListDto` 클래스
  - 위반 규약: `spec/conventions/swagger.md §2-5` 및 `§5-3` — `{ data: <Dto> }` 단일 래핑 구조
  - 상세: `SessionListDto` 가 내부에 `data: SessionDto[]` 필드를 갖고 있다. 컨트롤러(`sessions.controller.ts:63`)에서 `@ApiOkWrappedResponse(SessionListDto, ...)` 로 래핑하면 실제 응답 구조는 `{ data: { data: SessionDto[] } }` 가 된다. 컨트롤러의 실제 반환(`return { data: sessions }`)은 `{ data: SessionDto[] }` 이므로 Swagger 스키마와 구현이 불일치한다. 유사하게 `LoginHistoryPageDto.data` 도 동일한 이중 중첩 구조다.
  - 제안: `SessionListDto` 의 `data` 필드를 제거하고 `sessions` 또는 `items` 필드로 변경하거나, `@ApiOkWrappedArrayResponse(SessionDto, ...)` 를 사용해 래퍼를 단일화한다. `LoginHistoryPageDto` 는 커서 페이지네이션이므로 `@ApiOkWrappedResponse` 에 `{ data: LoginHistoryItemDto[], nextCursor: string | null }` 구조가 명확히 표현되어야 한다.

- **[WARNING]** `LoginHistoryPageDto` — 커서 기반 페이지네이션 구조 불일치
  - target 위치: `dto/responses/login-history.dto.ts:41-51`
  - 위반 규약: `spec/conventions/swagger.md §5-2` `ApiOkPaginatedResponse` 사용 권장 + `spec/5-system/2-api-convention.md §8.2` 커서 기반 응답 구조
  - 상세: `LoginHistoryPageDto` 는 `{ data: LoginHistoryItemDto[], nextCursor: string | null }` 구조를 정의하나, 컨트롤러에서 `@ApiOkWrappedResponse(LoginHistoryPageDto, ...)` 로 래핑되면 실제 응답은 `{ data: { data: [...], nextCursor: '...' } }` 가 되어 이중 `data` 중첩이 발생한다. `ApiOkPaginatedResponse` 는 offset 기반 페이지네이션용이라 커서 기반에는 직접 적용 불가하므로 커스텀 응답 DTO 설계가 필요하다.
  - 제안: `LoginHistoryPageDto` 의 `data` 필드를 `items` 로 개명하고 Swagger 스키마에서 실제 반환 구조 `{ data: { items: [...], nextCursor } }` 를 명확히 표현한다.

- **[WARNING]** `spec/5-system/2-api-convention.md §3` — `PUT` 메서드 미사용 원칙 vs 코드 미해당
  - target 위치: 기존 auth 모듈 전체 (controller/service)
  - 위반 규약: `spec/5-system/2-api-convention.md §3` "PUT: 사용하지 않음 (PATCH 선호)"
  - 상세: auth 모듈 현재 코드에서는 `PUT` 을 사용하지 않으므로 위반은 아니다. 다만 2FA/WebAuthn 구현 시 설정 업데이트 엔드포인트 추가 예정이라면 이 원칙을 미리 인식해야 한다. 정보 차원에서 기록.
  - 제안: 신규 auth 엔드포인트 추가 시 PATCH 를 사용하고 PUT 을 쓰지 않는다.

- **[INFO]** `LoginChallengeDto` — 미사용 export
  - target 위치: `dto/responses/auth-response.dto.ts:11-17`
  - 위반 규약: `spec/conventions/swagger.md §5-4` 새 엔드포인트 체크리스트 — DTO 가 실제 컨트롤러에서 참조되어야 함
  - 상세: `LoginChallengeDto` 는 정의되어 있으나 `auth.controller.ts` 에서 import/참조되지 않는다. dead export 로 빌드 결과물에 포함되나 Swagger 에 등록되지 않는다.
  - 제안: 컨트롤러 `POST /auth/login` 의 Swagger 선언에서 참조하거나(WARNING 항목과 연계), 참조 계획이 없으면 삭제한다.

- **[INFO]** `totp.dto.ts` — JSDoc 대신 `@ApiProperty` 직접 사용
  - target 위치: `dto/totp.dto.ts:5-27`
  - 위반 규약: `spec/conventions/swagger.md §1-1` "DTO에서는 JSDoc 주석을 추가하고, 설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 보강합니다"
  - 상세: `LoginTotpDto`, `Verify2faDto`, `Disable2faDto` 의 모든 필드가 JSDoc 없이 `@ApiProperty` 만 사용한다. CLI 플러그인(`introspectComments: true`) 이 JSDoc 을 `description` 으로 자동 변환하는 규약을 역행해 `@ApiProperty` 를 주 문서화 수단으로 쓴다. 다른 DTO(`login.dto.ts`, `register.dto.ts`) 는 JSDoc + `@ApiProperty` 병용이 혼재되어 일관성이 부족하다.
  - 제안: `totp.dto.ts` 필드에 JSDoc 주석(`/** ... */`)을 추가하고, 이미 `@ApiProperty({ description: '...' })` 에서 담고 있는 내용과 중복을 정리한다. 단, 기능적 오류는 아니므로 INFO 등급.

- **[INFO]** `refresh-token.dto.ts` — 파일 존재하나 내용 미확인
  - target 위치: `dto/refresh-token.dto.ts`
  - 위반 규약: `spec/conventions/swagger.md §5-1` 응답 DTO 위치 관례
  - 상세: `dto/refresh-token.dto.ts` 는 `dto/` 최상위에 위치하며, 내용에 따라 요청 DTO 인지 응답 DTO 인지 불분명하다. 요청 DTO 라면 `dto/requests/`, 응답 DTO 라면 `dto/responses/` 에 두는 것이 규약 §5-1 의 취지와 일치한다. 다만 인증 토큰 자체는 httpOnly 쿠키로 전달되므로 실제 용도를 확인해야 한다.
  - 제안: 파일 내용을 확인해 성격에 맞는 하위 폴더(`requests/` 또는 `responses/`)로 이동하거나, 현재 위치가 의도적이라면 주석으로 이유를 명시한다.

---

### 요약

`codebase/backend/src/modules/auth` 는 `spec/conventions/swagger.md` 의 응답 wrapping 규약(`{ data: ... }`)을 전반적으로 준수하고 있으며, 응답 DTO 의 `dto/responses/` 위치 분리, `@ApiOkWrappedResponse` / `@ApiCreatedWrappedResponse` 래퍼 헬퍼 사용, `@ApiTags` + `@ApiBearerAuth` 클래스 레벨 선언 등 주요 Swagger 문서화 패턴을 충실히 따른다. 그러나 `forgotPassword` 와 `checkEmail` 두 엔드포인트에서 `{ data: ... }` wrap 없이 서비스 반환값을 직접 리턴해 Swagger 스키마 선언(`@ApiOkWrappedResponse`)과 실제 구현이 불일치하는 CRITICAL 위반이 발견됐다. 또한 `SessionListDto` 와 `LoginHistoryPageDto` 가 내부에 `data` 필드를 중첩 보유해 `@ApiOkWrappedResponse` 와 결합 시 `{ data: { data: [...] } }` 이중 중첩이 발생하는 WARNING 이 있다. 2FA 구현 착수 전에 이 두 CRITICAL 을 수정하고, 커서 페이지네이션 DTO 의 이중 중첩 구조를 정리하는 것이 선행되어야 한다.

---

### 위험도

MEDIUM
