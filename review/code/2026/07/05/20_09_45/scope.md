# 변경 범위(Scope) 리뷰 — V-12 Switch switchValue required asterisk

## 검토 대상 요약

작업 의도: `spec/4-nodes/1-logic/2-switch.md §8.1` 이 명시한 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` asterisk 정책을, auto-form 이 아닌 override-track bespoke `SwitchConfig` 컴포넌트에서도 렌더되도록 재현.

12개 변경 파일 중 핵심 코드 변경은 2개뿐이며, 나머지는 프로젝트 규약상 의무화된 프로세스 산출물(plan 체크박스, CHANGELOG, consistency-check 아티팩트)이다.

## 발견사항

- **[INFO]** 핵심 코드 변경은 정확히 의도 범위와 일치
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` (`SwitchConfig`, `ExpressionInput`)
  - 상세: 실질 diff 는 `required={mode === "value"}` prop 1줄과 스펙 인용 주석 3줄이 전부다. 다른 필드(`cases`, `mode` select 등)나 `IfElseConfig`/`LoopConfig`/`VariableDeclarationConfig` 등 동일 파일 내 인접 컴포넌트는 전혀 건드리지 않았다. 불필요한 리팩토링·포맷팅 변경·임포트 변경이 없다.
  - 제안: 없음 (모범적으로 최소 범위).

- **[INFO]** 신규 테스트 파일도 의도 범위 내
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/switch-config.test.tsx` (신규)
  - 상세: mode=value / mode 미지정(기본값) / mode=expression 3가지 케이스만 검증하며 `SwitchConfig`의 다른 필드(cases, operator 등)는 건드리지 않는다. 코드 변경 범위와 1:1 대응.

- **[INFO]** CHANGELOG.md 추가 항목은 해당 변경만 서술
  - 위치: `CHANGELOG.md` — "Switch switchValue 필수 표시(asterisk) (V-12)" 항목
  - 상세: 신규 섹션 1개만 삽입(기존 다른 Unreleased 섹션들은 diff 대상이 아니라 "전체 파일 컨텍스트"로만 표시된 것 — 실제 diff hunk 는 `@@ -1,5 +1,11 @@`로 최상단 11줄 삽입 1건뿐). 서술 내용도 실제 코드 변경(1-line prop)과 정확히 일치하며 과장이나 추가 주장 없음.

- **[INFO]** plan 체크박스 갱신은 프로젝트 라이프사이클 규약에 따른 필수 동반 변경
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-12 항목 `[ ]` → `[x]` + 완료 서술 갱신
  - 상세: CLAUDE.md/`.claude/docs/plan-lifecycle.md` 규약상 작업 완료 시 plan 체크박스 갱신은 의무이며, "plan 체크박스 = 실제 상태" 원칙(사용자 memory)에도 부합한다. 이 diff 는 V-12 라인과 "cross-audit 코드-구현 항목 전량 종결" 요약 라인 2곳에 한정되어 있고, 다른 항목(V-13, V-18 등)의 상태는 이미 완료 표시된 채로 유지되어 있어 이번 변경이 임의로 다른 항목을 건드리지 않았다.

- **[INFO]** `review/consistency/2026/07/05/19_55_49/**` (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md) 전량은 프로세스 의무 산출물
  - 위치: 신규 폴더 `review/consistency/2026/07/05/19_55_49/`
  - 상세: CLAUDE.md는 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무"라고 명시한다. 이 아티팩트들은 그 의무 절차의 표준 출력 경로(`review/consistency/<날짜>/<시각>/`)에 정확히 위치하며, 내용도 이번 V-12 변경 범위(switch asterisk)에 국한해 검토한 결과다. `convention_compliance.md`가 지적한 `10-parallel.md` stale drift(WARNING)는 검토자가 스스로 "V-12 무관, 별도 후속"이라 명시했고 실제 코드/spec 변경으로 이어지지 않았다 — 즉 이번 PR이 그 이슈를 건드리지 않았다.
  - 참고: 이 산출물들 자체가 "무관한 파일 수정"처럼 보일 수 있으나, 리뷰 대상 diff에 포함된 이유는 협업 규약상 필수 프로세스 아티팩트이기 때문이며 실제 프로덕션 코드나 spec 문서를 변경하지 않는다.

- **[INFO]** spec 문서 변경 없음
  - 상세: `spec/4-nodes/1-logic/2-switch.md §8.1`은 이미 요구 동작을 명시하고 있어(cross_spec.md·SUMMARY.md가 확인) 이번 변경 범위에 spec 수정이 포함되지 않는다. "spec 변경 불요" 판단이 실제 diff와 일치.

## 요약

핵심 변경은 `SwitchConfig`의 `switchValue` `ExpressionInput`에 `required={mode === "value"}` 1줄과 스펙 인용 주석을 추가하는 것이 전부이며, 새 테스트 파일도 그 3가지 분기(값 모드/기본값/표현식 모드)만 검증해 의도한 범위와 정확히 일치한다. CHANGELOG·plan 체크박스·consistency-check 아티팩트는 모두 프로젝트 규약(CLAUDE.md 의무 절차, plan lifecycle)이 요구하는 동반 산출물이며 내용도 이번 변경 스코프에 한정되어 있다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 뒤섞임, 임포트 정리, 기능 확장(over-engineering) 등 스코프 이탈 징후는 발견되지 않았다. `convention_compliance.md`가 언급한 `10-parallel.md` stale drift는 이번 변경과 무관함이 검토자 스스로에 의해 명시되었고 실제로 손대지 않았다.

## 위험도

NONE
