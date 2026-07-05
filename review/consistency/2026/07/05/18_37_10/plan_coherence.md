# Plan 정합성 검토 — V-14 Re-run 모달 (원본 ID 링크 + typed 동적 폼), impl-done

## 검토 대상
- Target: `spec/5-system/` (impl-done), 실질 초점 `spec/5-system/13-replay-rerun.md §10.2`
- 실제 diff(`origin/main...HEAD`): `codebase/frontend/src/components/executions/rerun-modal.tsx`(+144/-21) · `rerun-modal.test.tsx`(신규) · `CHANGELOG.md` · `plan/in-progress/spec-code-cross-audit-2026-06-10.md`(V-14 체크박스 갱신)
- Context: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-14 항목 완료 처리

## V-14 체크박스 검증

`plan/in-progress/spec-code-cross-audit-2026-06-10.md:42` 이 `[x]` 로 마킹되어 있고 내용은 다음과 같다:

> **V-14** (Re-run 모달 원본 ID 링크 + typed 동적 폼, minor) — `rerun-modal-typed-form` 브랜치(본 PR)에서 코드 구현(plan 권장 채택, 사용자 확정 2026-07-05). `rerun-modal.tsx` 가 (a) 원본 ID 를 `/workflows/:wid/executions/:id` 새 탭 링크로, (b) 입력 폼을 워크플로 manual_trigger 노드 `config.parameters` 스키마 기반 typed 필드(string→text·number→number·boolean→checkbox·object/array→JSON, 타입 coerce)로 렌더. 스키마 부재 시 원본 키 text fallback. backend `resolveTriggerParameters` native-typed 수용(cross_spec 확인). spec 변경 불요(§10.2 이미 명시). TEST WORKFLOW+ai-review+impl-done.

실제 diff 와 대조한 결과 체크박스 서술과 코드가 정확히 일치한다:
- `original.id` → `<a href="/workflows/${original.workflowId}/executions/${original.id}" target="_blank" rel="noopener noreferrer">` 로 교체 (diff 확인).
- `fields` useMemo 가 `workflowNodes.find(n => n.type === "manual_trigger")?.config?.parameters` 스키마를 우선 사용, 배열이 비었거나 없으면 `Object.keys(originalParameters)` text fallback으로 하향 — 서술과 일치.
- `coerceInput`/`displayValue` 로 number/boolean/object/array 타입별 위젯·coerce 구현.
- 같은 줄(`:43`)에서 "잔여: V-12·V-13·V-18 (minor — 결정 대기)" 로 정확히 갱신 — V-14 가 목록에서 빠졌다.

## 발견사항

해당 결정·선행조건·후속 항목 충돌 없음. 근거:

- **미해결 결정과의 충돌 없음.** V-14 는 plan 이 "① 코드 구현(권장, 약) / ② spec 하향" 양자택일로 남겨둔 항목(`:108-113`)이었고, 채택된 코드 구현은 plan 이 이미 제시한 옵션의 실행이다. spec §10.2(`13-replay-rerun.md:337-340`) 자체에 TBD/미정 마커가 없고, 표 문구("ID 클릭 시 새 탭 원본 상세" · "manual_trigger 노드 config 기반 typed 동적 폼")가 구현과 정확히 일치 — spec 이 이미 이 결과를 명시하고 있었으므로 일방적 결정 우회가 아니다.
- **선행 plan 미해소 없음.** 구현이 의존하는 사전조건(§6.1.1 트리거 입력 파라미터 seeding, backend `resolveTriggerParameters`/`coerceToType`)은 이미 구현되어 있고 이를 막는 미해소 선행 plan 항목이 없다(`execution-engine-residual-gaps.md` 등에 관련 blocking 항목 없음, 18_21_17 impl-prep 리뷰에서도 동일하게 확인됨).
- **후속 항목 누락 없음.** `spec-code-cross-audit-2026-06-10.md` 내 인접 항목(V-12·V-13·V-18)은 V-14 와 독립적 스코프(Switch asterisk, 캔버스 요약 template, 위젯 재로드)라 이번 변경이 이들을 무효화하거나 새 후속 항목을 요구하지 않는다. `spec-sync-structural-followups.md` C-14(dryRun DTO description stale)는 re-run 도메인 인접 항목이나 이미 별도 PR 에서 `✅ FIXED` 처리되어 있고 코드도 정정 반영 상태 — V-14 완료와 충돌·재작업 필요 없음. `http-ssrf-all-auth-followups.md` 의 re-run 언급(dry-run SSRF 노트)도 무관 스코프.
- **"결정 옵션" 섹션 헤더 표기의 사소한 불일치 (INFO 수준).** `:48` 헤더가 여전히 "잔여 위반 V-04·V-05·V-09~V-14·V-18" 로 V-14 를 포함해 표기하고, `### V-14` 서브섹션(`:108`)도 V-11 처럼 "✅ 해소 (PR ..., 아래는 결정 당시 기록)" 라벨을 추가하지 않아 완료 표시가 없다. V-04·V-05·V-09·V-10 은 이미 완료되었음에도 헤더가 갱신되지 않은 것과 같은 패턴(선례상 이 헤더는 애초에 "결정 시점 스냅샷"으로 유지되는 것으로 보임 — V-11 만 예외적으로 해소 라벨을 추가함). Plan 정합성 관점의 충돌은 아니며, 문서 일관성(convention/가독성) 차원의 INFO.

## 요약

V-14 는 `spec-code-cross-audit-2026-06-10.md` 가 "결정 대기"로 명시해 둔 항목이었고, plan 이 이미 code-impl 을 권장 옵션으로 제시했으며 target spec(`13-replay-rerun.md §10.2`)에는 미해결 마커 없이 구현과 동일한 문구가 이미 존재했다. 실제 diff(`rerun-modal.tsx` 변경분)는 체크박스 서술(`:42`)과 정확히 일치하고, 같은 줄의 잔여 목록(`:43`)도 V-14 제거로 올바르게 갱신되었다. 인접 plan 항목들과도 스코프 충돌·후속 누락이 없다. `### V-14` 서브섹션에 완료 라벨이 붙지 않은 점은 문서 일관성 차원의 사소한 INFO 이며 정합성 위험은 아니다.

## 위험도
NONE
