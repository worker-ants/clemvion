# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** typed 폼 위젯의 object/array 처리가 계획 서술에는 있지만 코드 diff 상 "JSON 위젯"(textarea 등 전용 컴포넌트)이 아니라 fallback 문자열 처리로만 구현됨
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` — `displayValue`/`coerceInput`, JSX 분기(boolean 분기 vs 기본 `<Input>` 분기)
  - 상세: JSX 렌더 분기는 `boolean`(checkbox)과 그 외(default `<Input type={number|text}>`) 둘뿐이다. `object`/`array` 타입은 `type` 속성이 `text`가 되어 문자열 `<Input>`으로 렌더되고, `displayValue`/`coerceInput` 이 JSON 문자열 표시/파싱을 담당한다. CHANGELOG 서술("object/array→JSON 위젯")과 정확히 어긋나진 않으나(단일 `<Input>` 로 JSON 문자열을 편집하게 한 것도 "JSON 위젯"으로 볼 여지가 있음), 별도 textarea 등 전용 컴포넌트를 기대했다면 표현이 다소 과장됐을 수 있다. 다만 이는 구현 완성도 이슈이지 범위 이탈은 아니다.
  - 제안: 별도 조치 불필요. 문서 표현이 실제 렌더(단일 line `<Input>`)와 일치하는지만 확인 권장.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 체크박스 갱신은 정상 범위
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L1436-1439
  - 상세: V-14 항목을 `[ ]` → `[x]` 로 갱신하고 완료 서술을 추가한 것은 plan 라이프사이클 규약(완료 항목 체크 + 근거 기록)에 정확히 부합한다. 무관한 다른 항목(V-12/V-13/V-18)은 건드리지 않고 "잔여: V-12·V-13·V-14·V-18" → "잔여: V-12·V-13·V-18" 로만 최소 수정했다. 범위 이탈 아님.

- **[INFO]** `review/consistency/2026/07/05/18_21_17/**` 신규 파일 8개는 `--impl-prep` 의무 절차의 산출물
  - 위치: `review/consistency/2026/07/05/18_21_17/{SUMMARY.md,_retry_state.json,meta.json,convention_compliance.md,cross_spec.md,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: CLAUDE.md 규약상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 를 의무 수행해야 하며, 그 산출물은 `review/consistency/**` 에 저장하는 것이 SoT 규정이다. 이번 PR 의 실제 기능 변경(Re-run 모달)과 직접 관련된 필수 게이트 산출물이므로 "무관한 파일 수정"으로 볼 수 없다.
  - 제안: 없음 — 정책상 필수 동반 파일.

- **[INFO]** CHANGELOG.md 항목 추가는 diff 로 보이는 것보다 큰 "전체 파일 컨텍스트"를 포함하고 있으나 실제 diff 는 상단 11줄 삽입뿐
  - 위치: `CHANGELOG.md` L31-39 (diff), 이하는 기존 항목(비변경)의 컨텍스트 노출
  - 상세: diff hunk 는 신규 "V-14" 섹션 삽입 1건뿐이며, 그 아래 나열된 다른 Unreleased 섹션들(V-10, V-05, V-09 등)은 이미 존재하던 항목으로 실제 변경분이 아니다. 리뷰 payload 상 전체 파일 컨텍스트로 노출된 것일 뿐 실제 변경은 요청 범위(V-14) 로 정확히 한정된다.
  - 제안: 없음 — 오탐 방지 차원의 확인 사항.

## 요약

핵심 변경(`rerun-modal.tsx`, `rerun-modal.test.tsx`)은 plan(V-14)·spec(`13-replay-rerun.md §10.2`)이 명시한 두 가지 요구사항 — (a) 원본 실행 ID 새 탭 링크, (b) manual_trigger `config.parameters` 스키마 기반 typed 동적 폼 — 에만 정확히 대응하며, 관련 없는 리팩토링·포맷팅·불필요한 임포트·기능 확장은 발견되지 않았다. 기존 `paramKeys`/`handleParamChange` 를 `fields`/`setParam` 으로 이름을 바꾼 것도 스키마 기반 필드 도출이라는 의미 변화에 부합하는 자연스러운 리네이밍이지 무관한 리팩토링이 아니다. `CHANGELOG.md`·`plan/in-progress/spec-code-cross-audit-2026-06-10.md` 갱신은 프로젝트 표준 워크플로(완료 기록)이고, `review/consistency/2026/07/05/18_21_17/**` 신규 파일들은 CLAUDE.md 가 의무화한 `--impl-prep` 게이트 산출물로 이번 작업과 직접 연관된 필수 동반 파일이다. 범위를 벗어난 수정은 확인되지 않는다.

## 위험도

NONE
