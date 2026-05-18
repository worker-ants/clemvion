# Code Review 통합 보고서

리뷰 세션: `review/code/2026/05/18/23_44_26`
대상: 2FA WebAuthn 도입 — `origin/main..HEAD` 누적 5 commit (spec → backend → backend test → frontend → docs)
작성일: 2026-05-18
조치 결과: 본 세션 디렉토리의 [`RESOLUTION.md`](./RESOLUTION.md) 참고.

## 전체 위험도

**리뷰 시점 HIGH** — 단, 모든 reviewer 가 첫 commit (spec 갱신) 시점만 평가한 경향이 강하며, 실제 코드를 다시 검증한 결과 Critical 14건 중 대부분은 후속 commit (105215f6 등) 에서 이미 구현된 상태였다. 본 RESOLUTION 에서 4건 (C-3, W-3, W-6, I-5) 을 본 PR 내에서 추가 강화했다.

## 라우터 결정

- 라우터 미사용 (`--route=all` 강제) — 전체 13개 reviewer 실행.
- `concurrency` reviewer 는 검토 시점의 diff 가 .md/.json 위주로 분류되어 ISSUES=0 반환.

## Critical 14건

| # | Reviewer | 위배 요약 | 처리 |
|---|----------|----------|------|
| C-1 | security/requirement/side-effect | loginWithTotp() WebAuthn 우회 | Already-Implemented (`auth.service.ts:396`) |
| C-2 | security/requirement/side-effect | login() WebAuthn 분기 + DTO 진화 | Already-Implemented |
| C-3 | security | counter 역행 시 refresh-token family revoke | **Done — 본 RESOLUTION** |
| C-4 | security | 복구 코드 응답 로깅 위험 | Already-Mitigated (Nest 기본 미들웨어) |
| C-5 | architecture/side-effect | login 반환 타입 3계층 부작용 | Already-Implemented (동일 commit) |
| C-6 | architecture | login() SRP | Follow-up |
| C-7 | architecture | JWT 클레임 패턴 불일치 | Already-Mitigated (challengeToken 에 method 포함) |
| C-8 | architecture | AuthModule 비대화 | Follow-up |
| C-9 | requirement/api_contract | LoginHistoryEvent 타입 | Already-Implemented |
| C-10 | requirement | WebAuthn 서비스·엔티티·컨트롤러 미존재 | Already-Implemented |
| C-11 | requirement/api_contract | forgotPassword·checkEmail wrap | Follow-up (기존 버그) |
| C-12 | requirement | requiresTotp 제거 두 조건 | Already-Implemented (spec §1.4.2) |
| C-13 | testing | WebAuthn 단위 테스트 | Already-Implemented (24 케이스) |
| C-14 | testing | TOTP/WebAuthn 복구 코드 교차 오염 | Already-Implemented |

## Warning 26건 / Info 23건 — 주요 처리

| 항목 | 처리 |
|------|------|
| W-3 counter=0 인증기 UV 강제 | **Done** — requireUserVerification: true |
| W-6 production 시 ENV 미설정 fallback | **Done** — throw + WEBAUTHN_ALLOW_FALLBACK escape |
| W-8 verify 병렬 race | Documented + Follow-up |
| W-12 응답 코드 400 vs 401 | Done (이미 plan 정정) |
| W-15 device_name @MaxLength | Already-Implemented |
| W-22 @simplewebauthn 버전 | Already-Implemented (^13.3.0) |
| I-5 timingSafeEqual | **Done** |
| I-12 counter 역행 단위 테스트 + revoke 검증 | **Done — 강화** |

## 빌드·테스트

- backend build PASS
- backend test 3956/3956 PASS
- frontend type-check / lint clean
- frontend test 1495/1495 PASS

## Follow-up (`plan/in-progress/2fa-webauthn.md §8`)

- `requiresTotp` deprecated 제거 (두 마이너 버전 + 신규 프론트엔드 배포 확인 후)
- 백엔드 e2e (`webauthn-2fa.e2e-spec.ts`) — SoftWebAuthnDevice 합성
- mobile Safari 실기기 검증
- WebAuthn-only 계정 비밀번호 재설정 흐름
- `forgotPassword`·`checkEmail` 응답 wrap (기존 버그)
- `SessionListDto.data` / `LoginHistoryPageDto.data` → `items`
- WebAuthn verify 트랜잭션 + pessimistic lock (W-8 강화)
- AuthModule 분리 (WebAuthnModule 서브모듈)
- LoginChallengeDto union 분리 (W-9)
- V058 NOT VALID 2-step 마이그레이션 (W-23)

리뷰 산출물 13개 reviewer 별 상세는 같은 디렉토리의 `<reviewer>.md` 참고.
