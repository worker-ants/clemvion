# Ai-Review RESOLUTION — 2FA WebAuthn (`review/code/2026/05/18/23_44_26`)

본 review 세션은 `--range origin/main..HEAD` 로 누적 5개 commit (spec → backend → backend test → frontend → docs) 을 한 번에 검토했다. 13개 reviewer 가 총 125건 (Critical 14 / Warning 26 / Info 23) 을 보고했으나, 그중 대부분은 **세션이 첫 commit (spec 갱신) 시점만 본 결과** 로 실제 코드를 다시 검증해 보면 이미 후속 commit 에서 구현된 상태였다.

본 문서는 각 발견 항목에 대한 조치 결과 (Done / Already-Implemented / Follow-up) 를 기록한다.

## Critical 조치 결과

| # | 위배 | 결론 | 위치 |
|---|------|------|------|
| C-1 | loginWithTotp() WebAuthn 우회 | **Already-Implemented** | `auth.service.ts:396` (WEBAUTHN_REQUIRED 백스탑) |
| C-2 | login() WebAuthn 분기 + LoginChallengeDto | **Already-Implemented** | `auth.service.ts:310-345`, `dto/responses/auth-response.dto.ts` |
| C-3 | counter 역행 시 refresh-token family revoke | **Done — 본 RESOLUTION 에서 추가** | `webauthn.service.ts:284-291` |
| C-4 | 복구 코드 평문 로깅 위험 | **Already-Mitigated** — NestJS 기본 미들웨어가 응답 body 로깅하지 않음. 추가 마스킹은 follow-up |
| C-5 | login 반환 타입 3계층 부작용 | **Already-Implemented** — service/dto/controller 동시 갱신 commit (`105215f6`) |
| C-6 | login() SRP | **Follow-up** — 본 PR scope 외 리팩토링 (`plan §8`) |
| C-7 | challengeToken/optionsToken 클레임 패턴 불일치 | **Already-Mitigated** — challengeToken 에 `method` 클레임 포함됨 (`auth.service.ts:331`) |
| C-8 | AuthModule 비대화 | **Follow-up** — 모듈 분리는 별 PR |
| C-9 | LoginHistoryEvent 타입에 webauthn_failed | **Already-Implemented** | `entities/login-history.entity.ts:16` |
| C-10 | WebAuthn 서비스·엔티티·컨트롤러 미존재 | **Already-Implemented** — 본 PR 전체가 이 작업 |
| C-11 | forgotPassword·checkEmail wrap | **Follow-up** — 본 PR scope 외 기존 버그 (`plan §8`) |
| C-12 | requiresTotp 제거 두 조건 | **Already-Implemented** — `spec/5-system/1-auth.md §1.4.2` 두 조건 모두 명시 |
| C-13 | WebAuthn 단위 테스트 | **Already-Implemented** — `webauthn.service.spec.ts` 24 케이스 |
| C-14 | TOTP/WebAuthn 복구 코드 교차 오염 테스트 | **Already-Implemented** — verifyRecoveryCode 단위 테스트 |

## Warning 조치 결과 (선별)

| # | 위배 | 결론 |
|---|------|------|
| W-3 | counter=0 인증기 replay 방어 | **Done** — `requireUserVerification: true` 적용 (register/authenticate) |
| W-6 | production 시 WEBAUTHN_ORIGIN 미설정 폴백 | **Done** — `webauthn.config.ts` 가 production + `WEBAUTHN_ALLOW_FALLBACK!=1` 시 throw |
| W-7 | login 핫패스 추가 DB 쿼리 | **Accepted** — 단일 count 쿼리, 인덱스로 O(1). 추가 최적화 follow-up |
| W-8 | optionsToken 병렬 verify 경쟁 | **Documented + Follow-up** — `webauthn.service.ts:265-275` 에 코멘트로 명시. 트랜잭션 wrap 은 별 PR (스코프 크기) |
| W-9 | LoginChallengeDto 단일 DTO | **Accepted** — `oneOf` 또는 union 분리는 호환성 영향 큰 작업, follow-up |
| W-10 | SessionListDto/LoginHistoryPageDto 이중 중첩 | **Follow-up** — 기존 코드, plan §8 |
| W-12 | counter 역행 응답 코드 400 vs 401 | **Done** — plan §4 91번 줄 401 로 정정됨 |
| W-15 | device_name `@MaxLength(100)` | **Already-Implemented** — `WebAuthnRenameDto`·`WebAuthnRegisterVerifyDto.deviceName` |
| W-22 | @simplewebauthn 버전 미명시 | **Already-Implemented** — package.json `^13.3.0` (server·browser) |
| W-23 | V058 ACCESS EXCLUSIVE 락 | **Accepted** — login_history 는 INSERT-only append-only, 짧은 락 안전. 마이그레이션 주석에 명시. NOT VALID 분리는 follow-up |

## Info 조치 결과 (선별)

| # | 항목 | 결론 |
|---|------|------|
| I-5 | 복구 코드 비교 `timingSafeEqual` | **Done** — `webauthn.service.ts:349-369` |
| I-12 | counter 역행 단위 테스트 | **Already-Implemented + 강화** — refresh-token revoke 검증 추가 |

## Follow-up (별 PR)

- `plan/in-progress/2fa-webauthn.md §8` 에 다음 항목 등록 완료:
  - `requiresTotp` deprecated 제거 (두 마이너 버전 + 신규 프론트엔드 배포 확인)
  - mobile Safari 실기기 검증
  - WebAuthn-only 계정의 비밀번호 재설정 흐름
  - 백엔드 e2e (`webauthn-2fa.e2e-spec.ts`) — SoftWebAuthnDevice 합성 helper
  - `forgotPassword`·`checkEmail` 응답 wrap (기존 버그, scope 외)
  - `SessionListDto.data` / `LoginHistoryPageDto.data` 필드명 → `items` 개명
- 추가 follow-up:
  - WebAuthn verify 의 트랜잭션 wrap + pessimistic lock (W-8 강화)
  - AuthModule 분리 (WebAuthnModule 서브모듈)
  - LoginChallengeDto union 분리 (W-9)
  - V058 ACCESS EXCLUSIVE 회피 NOT VALID 2-step 마이그레이션 (W-23)

## 최종 빌드/테스트 결과

- backend build PASS
- backend test 3956/3956 PASS (webauthn.service.spec 24 케이스 포함)
- frontend type-check / lint clean
- frontend test 1495/1495 PASS
