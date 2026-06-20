# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Scope**: `spec/5-system/1-auth.md`
**Diff base**: `origin/main`

---

## 발견사항

### 발견사항 없음 (PASS)

이번 diff(`refactor 02 C-3`)는 `AuthController.disable2fa` 에서 raw `bcrypt.compare` 를 직접 수행하던 코드를 `AuthService.verifyPasswordForUser` 로 이관한 리팩토링이다. 아래 관점별 분석 결과 정식 규약 위반 없음.

---

### 관점별 분석

#### 1. 명명 규약

- **메서드명 `verifyPasswordForUser`**: camelCase — NestJS/TypeScript 서비스 메서드 표준. spec/conventions 에 service 메서드 명명 규약이 별도 없으며, 기존 `comparePassword` 헬퍼 네이밍 패턴과 일관.
- **에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID`**: `UPPER_SNAKE_CASE` — `spec/conventions/error-codes.md §1` 의 명명 규약 준수. 의미 기반 명명 원칙도 충족(무엇이 잘못됐는지 기술).
- **테스트 `describe` 블록 `'verifyPasswordForUser (refactor 02 C-3)'`**: 테스트 파일 내부 설명이며 공개 계약이 아님. 규약 대상 외.

#### 2. 출력 포맷 규약

- **에러 응답 shape `{ code, message }` with `UnauthorizedException`**: 기존 컨트롤러 구현과 동일한 shape 을 보존. diff 코드 주석에 "에러 코드·메시지·401 shape 동일 보존" 명시. `spec/conventions/error-codes.md §1` 및 `spec/5-system/3-error-handling.md` 의 envelope 계약 유지.
- **`PASSWORD_REQUIRED` / `PASSWORD_INVALID`**: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 미등재 대상(신규 코드 아님, 이미 컨트롤러에 존재하던 코드). 규약 위반 없음.
- **`verifyPasswordForUser` 반환 타입 `Promise<void>`**: 성공 시 아무것도 반환하지 않고 실패 시 throw — 레이어 정렬 패턴 일치.

#### 3. 문서 구조 규약

- **`spec/5-system/1-auth.md` frontmatter**: 검토 대상 diff 는 spec 문서 자체를 변경하지 않는다. 기존 frontmatter `id: auth`, `status: partial`, `code: codebase/backend/src/modules/auth/**/*.ts` 는 이번 변경 후에도 glob 매치가 유효(`auth.service.ts` 가 포함 경로 내).
- **`data-flow/2-auth.md §1.2`**: diff 주석에서 참조하는 `data-flow/2-auth.md §1.2` 는 `AuthService` 가 `bcrypt.compare` 를 수행하는 것으로 시퀀스 다이어그램에 이미 명시(L73). 이 리팩토링은 컨트롤러에 있던 raw bcrypt 를 서비스로 이관해 기존 data-flow spec 과 정렬하는 것으로, 규약 적합.
- **spec 3섹션 구조(Overview / 본문 / Rationale)**: spec 문서 자체의 변경이 없으므로 해당 없음.

#### 4. API 문서 규약

- **`spec/conventions/swagger.md`**: 이번 diff 에 컨트롤러의 Swagger 데코레이터 변경이 없다. `disable2fa` 엔드포인트의 시그니처·응답 코드·DTO 가 변경되지 않아 Swagger 문서화 규약 영향 없음.

#### 5. 금지 항목

- **`bcrypt` 직접 사용 in controller**: 이번 diff 가 제거(`-import * as bcrypt from 'bcrypt'`)하고 있으므로, 컨트롤러에 raw bcrypt 를 둬서는 안 된다는 레이어 정렬 원칙에 부합. conventions 에 controller 내 bcrypt 금지를 명문화한 별도 규약 파일은 없으나, `data-flow/2-auth.md §1.2` 의 기존 spec 이 bcrypt 비교를 `AuthService` 에 배치하므로 이는 규약 정렬로 평가.
- **인라인 에러 코드 문자열**: diff 에 인라인 문자열 에러 코드 신규 도입 없음. `{ code: 'PASSWORD_REQUIRED' }` / `{ code: 'PASSWORD_INVALID' }` 는 기존 컨트롤러에서 이관된 것으로 신규 인라인 문자열 추가에 해당하지 않음.
- **`UsersService` import 제거**: 컨트롤러에서 `UsersService` 직접 의존 제거 — 레이어 규약상 컨트롤러가 다른 도메인의 service 를 직접 호출하지 않는 것이 관례에 부합.

---

## 요약

`refactor 02 C-3` diff 는 `AuthController.disable2fa` 내부의 raw bcrypt 비밀번호 검증을 `AuthService.verifyPasswordForUser` 로 이관한 순수 레이어 정렬 리팩토링이다. 에러 코드·HTTP shape·메서드 시그니처·테스트 커버리지 모두 `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/conventions/audit-actions.md` 등 정식 규약과 충돌 없으며, `spec/5-system/1-auth.md` frontmatter 의 코드 glob 커버리지도 유지된다. `data-flow/2-auth.md §1.2` 가 이미 bcrypt 비교를 AuthService 에 배치한 선언과 일치해 정합. 정식 규약 위반 발견 없음.

## 위험도

NONE
