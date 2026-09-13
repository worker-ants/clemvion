# Plan 정합성 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main, 라운드 5)

## 개요

`spec/5-system/**` 델타는 이번에도 0(실측: `git diff --stat origin/main...HEAD -- spec/5-system` 무출력) — 이 PR(`guide-error-code-truth`, HEAD=`42680d5f9`)은 유저 가이드 MDX(`content/docs/**`)·`LlmService.testConnection` 계약·build-time 가드(`guide-error-code-*`, `guide-sanitized-message-parity`)·`PROJECT.md`·두 plan 트래커(`guide-error-code-truth.md`, `spec-draft-nullable-notation-followups.md`)만 건드렸다(`git diff --stat origin/main...HEAD -- codebase content spec plan` 실측: 23 파일).

이번 라운드는 직전 라운드(`11_33_51`, CRITICAL 1 · BLOCK:YES)를 해소한 커밋 `42680d5f9`가 그 라운드 자신이 낸 **cross_spec WARNING("도메인 카탈로그 §6 누락")까지 실제로 처리했는지**를 실측했다.

## 발견사항

- **[WARNING] "등재했다"는 처분 문구가 실제로는 등재되지 않았다 — 도메인 에러 코드 카탈로그 갭이 트래커에서 소실**
  - target 위치: `plan/in-progress/guide-error-code-truth.md` §J 처분 표
    (`| consistency W#1 | **등재** — 도메인 카탈로그 §6 누락(`spec/**`, 권한 밖) |`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (developer 등재 항목의 유일한 착지처)
  - 상세:
    - 직전 라운드(`review/consistency/2026/09/13/11_33_51/cross_spec.md` WARNING)가 지목한 것은
      `spec/4-nodes/4-integration/5-makeshop.md §6`·`4-cafe24.md §6` (도메인별 에러 코드 카탈로그, `spec/5-system/`이 아니라 `spec/4-nodes/`)에
      `MAKESHOP_UNRESOLVED_PATH_PARAM`·형제 `CAFE24_UNRESOLVED_PATH_PARAM`이 빠져 있고, 그 checker 는
      "기존 planner 항목(§1 카탈로그 누락)의 처리 범위에 이 두 §6 표 갱신을 추가하라"고 제안했다.
    - 이 PR 의 §J 처분 표는 이 항목을 "등재"로 표시했고, 커밋 메시지(`42680d5f9`)도
      "형제 엔드포인트의 와이어-레벨 계약 검증 부재 등재" 등 다른 3건은 명시했지만 이 항목은 언급하지 않는다.
    - 실측: `git show 42680d5f9 -- plan/in-progress/spec-draft-nullable-notation-followups.md` 는 41줄을 추가했고,
      그 내용은 (1) 가드의 존재≠방출 사각지대, (2) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`(선재),
      (3) `CAFE24_UNRESOLVED_PATH_PARAM`(가이드 미인용이라 오늘은 무해), (4) 형제 엔드포인트 와이어-레벨 계약 검증 부재
      — **4건뿐이다.** "§1 카탈로그 누락" 기존 항목(같은 파일 3204~3223줄)을 다시 읽어도 `§6`·`4-cafe24.md`·`5-makeshop.md`
      문자열은 등장하지 않는다.
    - `plan/in-progress/` 전체를 `"makeshop.md §6"`·`"cafe24.md §6"`로 grep 해도 (`plan/complete/` 제외) 0건이다.
    - 즉 직전 라운드가 잡은 spec 갭(도메인별 §6 카탈로그가 실재 코드를 누락)은 **어느 in-progress 트래커에도 살아있지 않다.**
      이 plan 이 `plan/complete/`로 이동하는 순간 그 갭을 되찾을 진입점이 없어진다 — 이 plan 문서 자신이
      §E·§G에서 반복 경고해 온 "체크박스만 바뀌고 근거 문장이 낡은 채 남는다" 패턴의 재발이다(이번이 같은 PR 안에서
      최소 세 번째 인스턴스: §G 6번 항목, §H user_guide_sync/convention 항목에 이은 세 번째).
  - 제안: `plan/in-progress/guide-error-code-truth.md` 를 `plan/complete/`로 옮기기 전에
    `spec-draft-nullable-notation-followups.md` 의 기존 "§1 카탈로그 누락" 항목(3204~3223줄) 범위를
    `5-makeshop.md §6`·`4-cafe24.md §6` 자체 갱신까지 명시적으로 확장하거나, 별도 체크박스 항목으로 등재할 것.
    두 파일 모두 `spec/**` 이라 developer 권한 밖 — planner 턴 필요.

## 다른 in-progress plan 과의 접점 재확인

- `spec-sync-auth-gaps.md`(`1-auth.md` frontmatter `pending_plans`) — WebAuthn/LDAP/SAML 축이라 이 PR 의
  LLM/통합 테스트 계약과 파일·주제 겹침 없음(재확인, 델타 없음).
- `spec-conventions-engine-error-code-surface.md` — 잔여 1건(`EngineErrorCode` JSDoc 이분법 프레이밍)은
  `error-codes.ts` 코드 주석 문제라 이 PR 의 대상(가이드 MDX·testConnection DTO·frontend 가드)과 파일이
  겹치지 않는다.
- `keyset-cursor-uuid-validation.md`(§C·§D)·`spec-update-node-cancellation-shutdown-classification.md`(§3 근처) —
  이 PR 이 `spec-draft-nullable-notation-followups.md`에 새로 등재한 "§1 카탈로그 누락" 항목이 인용하는
  교차 참조(`OAUTH_STATE_MISMATCH` :632 · Background Runs 4종 :128)를 각 파일에서 직접 열어 대조,
  내용·줄 위치 모두 실측과 일치한다 — 상호 참조 정확.
- `guide-error-code-truth.md` 자신의 라운드별 developer 등재 항목(가드 존재/방출 · MCP 3종 미선언 · 유령 필드 스캐너 ·
  와이어-레벨 계약)은 모두 `spec-draft-nullable-notation-followups.md`에 실재 확인됨 — 중복·선행조건 미해소 없음.

## 요약

`spec/5-system/**` 자체는 델타 0 이라 미해결 결정을 우회하는 유형의 충돌은 없다. 이 PR 이 스스로 처분표에 "등재"라고
적은 5건 중 4건은 실측으로 확인됐으나, "도메인 카탈로그 §6 누락"(`spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md`)
1건은 실제로 트래커에 반영되지 않았다 — 직전 라운드가 정확히 잡아낸 spec 갭이 이번 처리 사이클에서 조용히 소실될 위기에
있다. 그 외 cross-plan 참조(auth-gaps·engine-error-code-surface·keyset-cursor·node-cancellation)는 모두 정합하고
줄 단위로 정확하다.

## 위험도

LOW
