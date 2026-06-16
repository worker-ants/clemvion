---
worktree: .claude/worktrees/deps-backlog-residual
branch: worktree-deps-backlog-residual
spec_area: 7-channel-web-chat, auth/data-model
status: in-progress
---

# 07-dependency 잔여 8건 일괄 처리 (권장안대로, 단일 묶음)

원본 백로그: [`07-dependency.md`](./07-dependency.md). 사용자 승인 2026-06-16 — "전부 권장안대로 묶어서 진행".
m-9 는 plan 예상(단일 파일)과 달리 v13=complete async rewrite 로 드러나, 사용자 재확인 후 "이번 묶음에 그대로 포함" 결정.

## 결정 고정값

- **Node floor (m-1·m-8)**: 권장 C(이원화) — 내부 앱·내부 packages `>=24`, 외부 배포 SDK(`@workflow/sdk`·`@workflow/web-chat`) `>=20` 유지. README "20+" 는 "SDK 소비 기준" 으로 재정의.
- **m-9**: 권장 A(otplib `^13`), secret cross-version 호환 게이트 테스트 선작성 필수.

## 항목 체크리스트

- [x] **M-2** channel-web-chat: `@vitejs/plugin-react ^4→^6.0.1`, `jsdom ^25→^29.0.1` (편집 완료, 검증 대기)
- [x] **M-4** expression-engine: `dayjs ^1.11.13→^1.11.20` (편집 완료, 검증 대기)
- [x] **m-1/m-8** Node floor: `@types/node`(backend/frontend/web-chat→^24) + `engines.node`(내부 >=24 / 외부 SDK >=20) + README 동기화 (편집 완료, 검증 대기)
- [x] **m-2** PROJECT.md 테스트 프레임워크 이원화 정책
- [x] **m-6** PROJECT.md 버전 핀 정책 + 의도 핀 사유 주석(three tilde, web-chat/react exact)
- [x] **m-4** spec/7-channel-web-chat/4-security.md §1.1 sanitize 정책 매트릭스 + 양쪽 XSS unit 정렬 (frontend markdown-renderer.test 4/4 통과)
- [x] **m-9** otplib `^13` async-free 재작성(verifySync) + secret cross-version 게이트 테스트 11/11 통과 — totp.service.spec 신규

## 워크플로

- [~] consistency-check --impl-prep — 생략(변경 대부분 dep/doc, spec 무관). spec 연결 변경(m-4 매트릭스·m-9)은 --impl-done 으로 사후 검증.
- [x] TEST WORKFLOW — lint PASS · unit PASS(fe 4450 / be 7054 / cwc 188 / ee 123 / totp 11) · build PASS · e2e PASS(34 suites·202 tests, 41s)
  - 인프라 메모: e2e 1차 시도는 Docker VM 디스크 부족(build cache 33GB)으로 postgres initdb 실패 → `docker builder/image prune` 으로 회수 후 재실행 통과. backend jest open-handle quirk 로 runner self-exit 안 해 wrapper hang → 결과(202 pass) 확인 후 `make e2e-down`.
- [x] /ai-review + resolution — 1차(00_39_22) LOW/Critical 0/Warning 6 → 수정 4·검증후비이슈 2 처분 + 재테스트 PASS. 2차 재검토(01_01_29, 리뷰-픽스 델타) LOW/Critical 0/Warning 4 → 백로그1·FP1·수용2 (코드 변경 0)
- [x] consistency-check --impl-done — **BLOCK: NO** (LOW, Critical 0). WARNING 3건 검증: W-3(safe-html code:)·W-2(태그) = main-baseline FP, W-1(isolated-vm node>=22) = 비충돌
- [x] PR #624 생성 → origin/main #623 머지로 conflict → **rebase** (충돌 `4-security.md §1` 1곳 — #623 deny-by-default ↔ 내 §1.1, 양쪽 보존 병합)
- [x] **rebase 후 정석 재검증** (memory: 가드 우회 금지): TEST WORKFLOW 전부 PASS(e2e 202) · ai-review 07_59_58 LOW/Critical 0/Warning 3(전부 spec doc — W-2/W-3/I-1/I-4 수정, W-1 caret 정책정합 무변경) · consistency 07_59_58 **BLOCK: NO**(W 2건 pre-existing out-of-scope)

## Follow-up — 2026-06-17 처리 완료

- [x] **spec Rationale 등재**:
  - 4-security.md `### R4` sanitize deny-by-default(blacklist 기각) + 빈입력 경계 동작
  - 5-system/1-auth.md `### 1.4.J` otplib v12→v13 업그레이드 근거 + `### 1.4.K` 복구코드 SHA-256(KDF 미채택) 근거
  - 1-data-model.md `two_factor_secret` 표기 라이브러리 무관(`base32, RFC 6238`)으로 정정
- [x] **복구 코드 KDF 전환 — declined-with-rationale**: 복구코드는 `randomBytes(9)`(72비트) 고엔트로피 일회성 시크릿이라 SHA-256 으로 충분(KDF 는 저엔트로피 비밀번호용 — OWASP 정합). 또한 spec(1-auth §1.4)이 SHA-256 을 명시한 결정이고, 전환 시 totp·webauthn 양 풀 대칭 변경 + 로그인 검증을 순차 KDF compare 로 바꿔야 함 — 한계 이득 대비 과대. 결정을 §1.4.K 로 spec 에 명문화.
