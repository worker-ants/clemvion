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
- [ ] /ai-review + resolution
- [ ] consistency-check --impl-done (spec 연결: 7-channel-web-chat §1.1, auth totp)
- [ ] plan complete 이동 + 원본 07-dependency.md 체크박스 갱신
