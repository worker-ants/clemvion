# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 개요

이번 배치의 실제 변경은 `spec/5-system/` 델타 0(코드 전용, `spec_impact: none`)이며, 핵심은
`plan/in-progress/keyset-cursor-uuid-validation.md` 가 `login-history.service.ts` ·
`background-runs.service.ts` 의 keyset 커서 `id` 성분에 `isUuidShaped` 검증을 추가하고,
동시에 선행 트래커 항목(`GlobalExceptionFilter` 에 22P02→400 분기 추가)을 **won't-do 로
종결**한 것이다. 아래는 `plan/in-progress/**` 전수 대비 정합성 확인 결과다.

## 확인한 것

- `spec-draft-nullable-notation-followups.md` 의 해당 트래커 항목이 실제로 취소선 처리 +
  각주(종결 근거)로 정정됐음을 `git diff origin/main...HEAD` 로 직접 확인했다 — plan 체크리스트의
  "[x] A: … won't-do 로 종결" 주장과 diff 가 일치한다.
- 같은 diff 에서 새로 만든 결정 대기 항목 3건(planner 소관: `3-error-handling.md` 카탈로그
  미등재, `2-api-convention.md §8.2` cursor 표준과 `login_history` 예외 미문서화, §1.6 각주
  분류 불일치)이 실제로 그 문서에 신규 등재됐고, 다른 in-progress plan 에 동일/중복 항목이
  없음을 `plan/in-progress/**` 전수 grep(`§1.13`, `카탈로그`, `keyset`, `INVALID_CURSOR`)으로
  확인했다.
- `spec/5-system/2-api-convention.md §8.2` 를 직접 열어 opaque base64 cursor + 400 표준만
  서술하고 `login_history` 예외가 어디에도 없음을 실측 확인 — 등재된 WARNING 이 실재한다.
- 두 디코더의 실패 계약 비대칭(무시 vs 400)을 **통일하지 않고 유지**한 선택은
  `spec-draft-nullable-notation-followups.md` 에 "제품 결정 필요" 로 명시 등재돼 있고, 코드
  주석에도 "형제는 다르게 동작한다 — 통일은 제품 결정" 이 박혀 있다. 이는 미해결 결정을
  **우회한 것이 아니라 그대로 열어 둔 것**이므로 CRITICAL 기준(미해결 결정 우회)에 해당하지
  않는다.
- `isUuidShaped` 를 원래 문맥(워크스페이스 헤더 인가)과 다른 문맥(커서 리소스 지목)에
  확장 적용한 것은 그 술어를 정의한 선행 plan(`auth-guard-reflection-hardening.md`)의
  Rationale과 충돌하지 않는지 대조했다 — 원 Rationale 의 핵심 질문("Postgres 가 파싱하는가")은
  컨텍스트 불변이라 확장이 원칙을 어기지 않으며, `keyset-cursor-uuid-validation.md` 자신이
  "적용 범위가 넓어진다" 는 사실을 별도로 명시해 다음 사람이 인지하도록 했다.
  `auth-guard-reflection-hardening.md` 의 미해결 항목(메모이제이션 후속, `- [ ]`)은 이번 변경과
  무관한 축이라 선행조건 충돌 없음.
- `uuid.ts`/`uuid.spec.ts` 의 "호출부 3곳" 주장을 실제 grep 으로 재현해 정확함을 확인했다
  (`workspace-context.util.ts` · `login-history.service.ts` · `background-runs.service.ts`).
- `spec-sync-auth-gaps.md`(login-history 감사 관측성 항목) · `spec-sync-external-interaction-api-gaps.md`
  (background-runs 마스킹/주석 동기 항목)에도 같은 파일명이 언급되지만, 다루는 축(감사 로그
  관측성·민감정보 마스킹)이 이번 diff(커서 `id` 검증)와 겹치지 않아 충돌·무효화 없음.

## 발견사항

- **[INFO]** 완료된 선행 plan 이 `in-progress/` 에 잔존
  - target 위치: 해당 없음 (target 자체 변경 아님)
  - 관련 plan: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (PR #1328, 이미
    `origin/main` 에 머지됨 — `git log origin/main` 확인)
  - 상세: 체크리스트 전 항목이 `[x]`(6라운드 리뷰·`--impl-done` BLOCK:NO 까지 완료)이고
    후속 결정 대기 항목도 없다. 라이프사이클상 `plan/complete/` 로 이동됐어야 하나 아직
    `in-progress/` 에 있다. 이번 PR 의 `keyset-cursor-uuid-validation.md` 가 같은 22P02/UUID
    검증 계열이라 grep 시 이 문서와 계속 섞여 나오고(같은 이름 계열 "trigger"+"uuid"), 실제로
    그 문서 자신도 서두에 "이름이 가까운 문서와 무관하다" 는 스코프 고지를 이미 달아 두고 있다
    — 즉 혼동 위험이 이미 한 번 실현된 자리다.
  - 제안: 이번 PR 범위는 아니지만, plan 위생 차원에서 `trigger-uuid-and-guide-error-codes.md`
    를 `plan/complete/` 로 이동할 것을 다음 정리 배치에 등재 권고. (target/이번 diff 의
    정합성 자체에는 영향 없음 — CRITICAL/WARNING 아님.)

발견된 CRITICAL/WARNING 없음 — 확인한 3개 관점(미해결 결정 우회·선행 plan 미해소·후속 항목
누락) 모두 이번 배치 자신의 plan 문서가 이미 실측 기반으로 스스로 점검·등재를 마쳤고, 그
등재 내용이 실제 diff·spec 상태와 어긋나지 않음을 직접 대조로 확인했다.

## 요약

이번 배치(`keyset-cursor-uuid-validation.md`)는 선행 트래커 항목(필터 22P02→400)을 실측으로
반증하고 근거를 남긴 채 won't-do 로 정확히 종결했고, 새로 생긴 3개 planner 결정 항목과 1개
"통일 여부 결정 필요" 항목을 모두 `spec-draft-nullable-notation-followups.md` 에 중복 없이
등재했다. `spec/5-system` 델타가 0인 것은 코드 전용 변경이라는 전제와 일치하며, 다른
in-progress plan 이 다루는 동일 파일(login-history·background-runs)들은 축이 달라(감사
관측성·마스킹 vs 커서 id 검증) 충돌하지 않는다. Plan 정합성 관점에서 이 배치는 결정 우회나
선행조건 무시, 후속 항목 누락 없이 깨끗하게 처리됐다.

## 위험도

NONE
