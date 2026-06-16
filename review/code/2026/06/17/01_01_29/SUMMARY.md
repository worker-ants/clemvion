# Code Review 통합 보고서

## 전체 위험도
**LOW** — 의존성 업그레이드 후속 ai-review Warning 처분 커밋. 프로덕션 코드 변경 최소(로그 메시지 1줄), 나머지는 테스트 보강·리팩터·리뷰 산출물 기록. Critical 발견 없음; 소수의 WARNING 은 테스트 커버리지 보완 및 문서 정리 수준.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 복구 코드 저장에 KDF 미사용 (이월 확인) — SHA-256 단순 해시 사용 중. 72비트 엔트로피 + 일회성 소비로 단기 위험 낮으나 DB 유출 시 GPU 가속 공격 장기 리스크 존재 | `codebase/backend/src/modules/auth/totp.service.ts` `hashRecoveryCode` | argon2id/scrypt 전환 백로그 등재 권장. 즉각 수정 불필요 |
| 2 | 테스트 | `disable()` 테스트가 정상 경로만 단언하며 idempotency 케이스(이미 비활성 사용자 재호출) 미커버 | `codebase/backend/src/modules/auth/totp.service.spec.ts` `describe('disable')` | `twoFactorEnabled:false` 상태 사용자에 대해 `usersService.update` 호출 인자를 단언하는 케이스 추가 권고 |
| 3 | 테스트 | 빈 html 입력 테스트 `expect(result).toBe("")` 가 DOMPurify 특정 버전 동작에 의존. 업그레이드 시 false negative 위험 | `codebase/channel-web-chat/src/lib/safe-html.test.ts` `it("빈 문자열 html → throw 없이 빈 string")` | `expect(result).not.toContain('<script')` 또는 `typeof result === 'string'` 단언으로 완화 검토 (선택) |
| 4 | 문서 | `spec/7-channel-web-chat/4-security.md` 에 미커밋 변경 존재 — 입력 sanitize 정책 구체화가 워킹트리에만 있고 커밋에 미포함 | `spec/7-channel-web-chat/4-security.md` | 이번 리팩터링 범위라면 커밋 포함, 아니라면 별도 spec-only 커밋으로 분리해 spec↔구현 정합성 확보 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | TOTP `verifyCode` 에러 로깅 `.message` → `.name` 개선 — OWASP A09 대응 완료 | `totp.service.ts` `verifyCode` catch 블록 | 추가 조치 불요 |
| 2 | 보안 | `disable()` 테스트에서 3 필드 초기화 검증 추가 — 잔류 인증 벡터 방지 | `totp.service.spec.ts` `describe('disable')` | 추가 조치 불요 |
| 3 | 보안 | `verifyAndEnable` user=null 분기 `BadRequestException` 검증 테스트 추가 | `totp.service.spec.ts` | 추가 조치 불요 |
| 4 | 보안 | safe-html 빈/공백 입력 경계값 XSS sanitize 안정성 테스트 추가 | `safe-html.test.ts` | 추가 조치 불요 |
| 5 | 유지보수성 | `jwtService.sign.mock` 캐스팅 제거 — `jest.Mocked<T>` 패턴으로 통일 | `auth.service.spec.ts` line ~1055 | 추가 조치 불요 |
| 6 | 유지보수성 | `null as unknown as string` 이중 캐스팅 — `UsersService.update` 타입이 nullable 필드 미허용으로 인한 우회 | `totp.service.ts` `disable()` L1493 | `UsersService.update` 파라미터 타입에 nullable 반영하여 캐스팅 제거 (타입 부채) |
| 7 | 유지보수성 | `bootstrapSecret` 헬퍼가 파일 끝에 선언되어 사용 위치와 멀리 떨어짐 | `totp.service.spec.ts` L1312-1323 | `describe('TotpService')` 블록 상단으로 이동 권장 |
| 8 | 유지보수성 | describe 레이블에 내부 리뷰 티켓 참조 노출 (`ai-review m-4 W5`) | `safe-html.test.ts` L1562 | `describe("빈/공백 입력 경계값")` 으로 티켓 참조 제거 |
| 9 | 유지보수성 | 로그 언어 혼재 (내부 로그=영문, 예외 메시지=한국어) — 컨벤션 미문서화 | `totp.service.ts` | `spec/conventions/` 에 로그 언어 컨벤션 정리 권장 |
| 10 | 문서 | `TotpService` 클래스 레벨 JSDoc 없음 — OWASP A09 로깅 정책·SHA-256 복구코드 해시 설명 위치 부재 | `totp.service.ts` 클래스 선언부 | 클래스 레벨 JSDoc 추가 고려 |
| 11 | 문서 | `disable()` JSDoc 에 초기화 필드 목록 및 `null as unknown as string` 캐스팅 이유 미기술 | `totp.service.ts` L1490 | 초기화 필드 목록·캐스팅 이유 보강 |
| 12 | 문서 | `safe-html.test.ts` 파일 상단 커버리지 주석이 신규 케이스(빈/공백 입력 경계값) 미반영 | `safe-html.test.ts` L1586-L1597 | 커버리지 목록에 항목 추가 |
| 13 | SPEC-DRIFT | [SPEC-DRIFT] `spec/7-channel-web-chat/4-security.md §1` 입력 sanitize 정책에 "빈 입력(empty/whitespace-only)은 throw 없이 안전한 string 반환(SSR 환경에서는 null)" 동작이 미기술 — 코드는 합리적이나 spec 이 구현보다 미흡 | `spec/7-channel-web-chat/4-security.md §1` | spec §1 "입력 sanitize" 행에 빈 입력 동작 1행 추가 (project-planner 위임) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | SHA-256 복구코드 저장 이월 WARNING(수용), OWASP A09 로깅 개선 INFO |
| requirement | LOW | disable() idempotency 테스트 미커버 WARNING, SPEC-DRIFT 1건(빈입력 처리 spec 미기술) |
| scope | (출력파일 없음) | 재시도 필요 |
| side_effect | NONE | 전 변경이 refactor/test 범위, 공유 상태 변경 없음 |
| maintainability | LOW | null as unknown as string 이중 캐스팅 타입 부채, describe 티켓 참조, bootstrapSecret 위치 |
| testing | (출력파일 없음) | 재시도 필요 |
| documentation | LOW | spec 미커밋 변경 WARNING, 커버리지 주석 미갱신·describe 티켓 참조 |

## 발견 없는 에이전트

- **side_effect**: 의도치 않은 부작용 없음 — 전 변경이 refactor·test 범위에 국한.

## 권장 조치사항

1. **spec/7-channel-web-chat/4-security.md 미커밋 변경 처리** (WARNING #4) — 워킹트리에 남아 있는 spec 개선 내용을 커밋에 포함하거나 별도 spec-only 커밋으로 분리.
2. **복구 코드 KDF 전환 백로그 등재** (WARNING #1) — argon2id/scrypt 전환을 별도 보안 개선 task 로 등재. 즉각 수정 불필요.
3. **`disable()` idempotency 테스트 케이스 추가** (WARNING #2) — 이미 disabled 사용자에 대한 `disable()` 재호출 동작 단언 추가.
4. **`safe-html.test.ts` 파일 헤더 커버리지 목록 갱신** (INFO #12) — 빈/공백 입력 경계값 항목 추가.
5. **describe 레이블 정리** (INFO #8) — `ai-review m-4 W5` 티켓 참조 제거.
6. **`null as unknown as string` 캐스팅 해소** (INFO #6) — `UsersService.update` 타입 정의에 nullable 필드 반영.
7. **SPEC-DRIFT 처리** — `spec/7-channel-web-chat/4-security.md §1` 빈 입력 동작 1행 추가를 project-planner 에 위임.

## 라우터 결정

라우터 미사용 — 전체 reviewer 강제 실행 (`routing=all`). 실행: security, requirement, scope, side_effect, maintainability, testing, documentation (7명 전원 강제 포함). 제외된 reviewer 없음.

> 비고: `scope.md`, `testing.md` 는 manifest 에 `success` 로 등재되었으나 출력 파일이 존재하지 않아 해당 에이전트 결과는 통합에서 제외됨 (재시도 필요 2건).