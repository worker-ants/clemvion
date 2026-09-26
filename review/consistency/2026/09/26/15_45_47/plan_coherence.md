# Plan 정합성 검토 — forbidden-helper-sentences (--impl-done)

## 검토 범위 메모

target 으로 지정된 spec 영역(`impl-done-scope-fhs/spec`)의 델타는 0개 — 이 PR 은 spec 을 바꾸지 않는 순수 코드 리팩터(`plan/in-progress/forbidden-helper-sentences.md` 가 명시하는 대로 `spec/conventions/swagger.md §5-4` 규칙에 코드를 맞추는 작업). 따라서 이번 검토는 (a) target 코드 diff(7파일/262줄)가 `plan/in-progress/**` 의 미해결 결정·선행 조건과 충돌하지 않는지, (b) 이 plan 을 언급하거나 이 plan에 의존하는 다른 in-progress plan 의 후속 항목이 diff 로 무효화·누락되지 않았는지를 중심으로 확인했다.

확인한 교차 참조:
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커, L5077-5087) — 이 plan 이 닫으려는 항목 «403 설명 3곳이 공용 헬퍼를 거치지 않고 코드를 손으로 보간한다» 원문과 대조. diff 의 `switchWorkspace`(`FORBIDDEN_NOT_A_MEMBER`) · `reRun`/`getChain`(`forbiddenWithService`) 치환이 트래커가 적시한 3곳과 정확히 일치.
- `plan/in-progress/integration-personal-owner-followup.md` (Viewer 항목, L184-191, "(2026-09-26 보탬)") — `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 상수가 `forbiddenWithService(forbiddenForRole('editor'), …)` 형태로 바뀔 것을 미리 반영해 뒀고, diff 의 `integrations.controller.ts` 변경(`FORBIDDEN_EDITOR_OR_ORG_ADMIN = forbiddenWithService(forbiddenForRole('editor'), ...)`)과 정확히 일치. `forbidden-helper-sentences.md` 자신의 검토 경고 처리 표 INFO4 처분이 이 동기화를 만든 것으로 확인됨 — 새 결함 아님.
- `spec/5-system/13-replay-rerun.md` (RR-PL-06, `RERUN_PERMISSION_DENIED`) — diff 의 `reRun`/`getChain` 설명 문구가 현재 spec 표(L244-246)의 코드·조건과 일치. 이 영역에 "결정 필요" 로 남은 항목 없음.
- `spec/conventions/swagger.md §5-4`(L511-512) 및 Rationale "§5-4 403 설명의 거부 코드"(L712-740, 특히 L739 "서비스 거부는 세지 않는다") — plan 의 "안 하는 것" 절이 인용하는 근거와 문구가 정확히 일치. plan 이 spec 을 바꾸지 않고 "어긋난 자리만 맞춘다"는 주장이 실제로 성립.
- 새/변경 상수명(`FORBIDDEN_EDITOR_OR_ORG_ADMIN` · `FORBIDDEN_MEMBER_OR_ORG_ADMIN` · `FORBIDDEN_MEMBER_OR_ADMIN` · `FORBIDDEN_OWNER_OR_PERSONAL` · `FORBIDDEN_EDITOR_OR_NOT_OWNER`)을 전 `plan/in-progress/**` 에서 grep — `integration-personal-owner-followup.md` 외에 참조하는 plan 없음. 다른 plan 이 옛 문자열 포맷(`, 또는`)을 전제로 한 곳도 없음.
- `auth-guard-reflection-hardening.md` · `deps-guard-hardening.md` · `harness-review-gate-followups.md` · `spec-sync-external-interaction-api-gaps.md` 등 예산 절단된 plan 은 `forbidden`/`RR-PL-06`/`getChain` grep 상 이 diff 와 겹치는 미해결 결정을 갖고 있지 않음.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

- **[INFO]** 마무리 절차(체크리스트 잔여 2건)는 plan 자신이 이미 추적 중
  - target 위치: (해당 없음 — 코드 diff 자체에는 잔여 작업 없음)
  - 관련 plan: `plan/in-progress/forbidden-helper-sentences.md` 체크리스트 `[ ] --impl-done` · `[ ] 트래커 항목 닫기` (L138-139); `plan/in-progress/spec-draft-nullable-notation-followups.md` L5077 항목은 아직 `[ ]`(미닫힘)
  - 상세: 이 `--impl-done` 통과 후 남는 절차는 (1) `spec-draft-nullable-notation-followups.md` L5077 항목에 다른 닫힌 항목들과 같은 형식의 "닫힘" 주석을 달고 체크, (2) `forbidden-helper-sentences.md` 를 `plan/complete/` 로 이동. `integration-personal-owner-followup.md` 의 Viewer 항목이 이미 `plan/complete/forbidden-helper-sentences.md` 경로를 선행 인용하고 있어(`/ai-review` 15_36_42 에서도 Warning 1 로 이미 지적·수용됨), 이동을 빠뜨리면 그 인용만 거짓이 된다.
  - 제안: 새로운 조치 불필요 — plan 자체의 체크리스트가 이미 이 순서를 명시하고 있으므로, 마무리 커밋에서 두 항목을 함께 처리하면 된다.

## 요약

`forbidden-helper-sentences.md` 는 spec 을 바꾸지 않고 `swagger.md §5-4` 규칙에 코드를 맞추는 좁은 리팩터이며, 이 plan 이 닫으려는 트래커 항목(`spec-draft-nullable-notation-followups.md`)·이 plan 을 미리 참조해 둔 후속 plan(`integration-personal-owner-followup.md`)·관련 spec 정본(`13-replay-rerun.md`, `swagger.md` Rationale) 모두와 실제 diff 내용이 정확히 맞아떨어진다. 미해결 결정을 우회하거나 다른 plan 의 전제를 깨는 지점은 발견되지 않았고, 유일하게 남는 것은 plan 자신이 이미 체크리스트로 추적 중인 마무리 이동(트래커 닫기 · `plan/complete/` 이동) 뿐이다.

## 위험도

LOW
