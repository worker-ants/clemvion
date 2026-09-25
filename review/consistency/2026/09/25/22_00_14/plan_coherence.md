# Plan 정합성 검토 — spec-draft-integration-personal-owner-assistant.md

## 발견사항

- **[WARNING]** developer plan `integration-personal-owner.md` 의 `spec_impact` 가 이번 보강 대상 spec 을 누락
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner-assistant.md` 변경안 (1)(2)(3) — `spec/3-workflow-editor/4-ai-assistant.md` §4.2 · §4.3.1 · Rationale ED-AI-39 에 "남의 personal 제외(§8)" 를 명문화
  - 관련 plan: `plan/in-progress/integration-personal-owner.md` frontmatter `spec_impact: [spec/2-navigation/4-integration.md]` (단일 항목) — 본문 `## 요구` 1번의 다섯 번째 불릿 "워크플로우 어시스턴트 — `list_integrations` 도구 · 노드 후보(integration-selector · mcp-server-selector)" 와 `## 설계` "어시스턴트 도구가 같은 규칙을 쓴다"
  - 상세: 이 target 이 반영되면 `spec/3-workflow-editor/4-ai-assistant.md` 에 §8 판정 규칙을 인용하는 명시적 계약(§4.2 `list_integrations` 행, §4.3.1 `integration-selector`/`mcp-server-selector` 필터 표, Rationale ED-AI-39 1번)이 새로 생긴다. `plan/in-progress/integration-personal-owner.md` 는 바로 이 표면(워크플로우 어시스턴트 후보 필터링)을 같은 PR 에서 구현하겠다고 이미 적어 두었는데, 그 plan 의 frontmatter `spec_impact` 는 여전히 `spec/2-navigation/4-integration.md` 하나뿐이다. 이 plan 이 `plan/complete/` 로 이동할 때 `spec-plan-completion.test.ts`(Gate C, `spec-impl-evidence.md` R-8)가 `spec_impact` 실존만 검증하고 완전성은 강제하지 않으므로 하드 실패는 아니지만, 이 draft 가 만드는 새 계약 문구를 developer 가 실제로 지켰는지 추적할 SoT 목록에서 `4-ai-assistant.md` 가 빠지는 결과가 된다 — `--impl-done` 스코프 판단이나 완료 시점 정합 감사에서 이 파일이 조용히 제외될 위험.
  - 제안: `plan/in-progress/integration-personal-owner.md` frontmatter `spec_impact` 에 `spec/3-workflow-editor/4-ai-assistant.md` 를 추가한다. 이 target draft 의 "동반 산출물" 절 또는 착지 커밋에서 같이 처리하는 것이 재작업이 가장 적다 (원 draft `spec-draft-integration-personal-owner.md` 가 `integration-personal-owner-followup.md` 를 "동반 산출물"로 함께 생성한 선례와 같은 패턴).

- **[INFO]** developer plan 체크리스트의 테스트 항목 문구가 어시스턴트 필터링(비-404) 케이스를 명시하지 않음
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner-assistant.md` 변경안 (1)(2) — `list_integrations` 결과·후보 목록에서 "빠진다"/"제외" (조용한 필터링, 에러 아님)
  - 관련 plan: `plan/in-progress/integration-personal-owner.md` `## 체크리스트` — "테스트 선작성(unit) — 경로별 «남의 personal → 404 · 역할 무관», «Organization 변경 → 비Admin 403», «본인 personal → 통과»"
  - 상세: 체크리스트가 나열한 세 패턴은 모두 HTTP 에러 응답(404/403) 기준이다. 반면 워크플로우 어시스턴트의 `list_integrations` · `integration-selector`/`mcp-server-selector` 후보 필터링은 에러가 아니라 **목록에서 조용히 빠지는** 형태라 이 문구 그대로는 테스트 작성자가 놓치기 쉽다 (요구 1번 다섯 번째 불릿엔 이미 포함돼 있어 완전히 빠진 것은 아니지만, 체크리스트의 테스트 패턴 나열에는 반영되지 않았다).
  - 제안: 체크리스트 테스트 항목에 "어시스턴트 도구·후보 필터는 남의 personal 을 목록에서 제외(에러 아님)" 한 줄을 추가하거나, 요구 1번 불릿을 참조하도록 명시.

## 요약
target(`spec-draft-integration-personal-owner-assistant.md`)은 이미 merge 된 `spec/2-navigation/4-integration.md §8` 판정 규칙을 그대로 따르는 보강으로, `--impl-prep` 리뷰(`21_49_24`)의 WARNING 1·3 을 정확히 겨냥해 세 자리(§4.2/§4.3.1/Rationale)를 고친다. plan 이 "결정 필요"로 남긴 다른 항목(예: `integration-personal-owner-followup.md`의 노드 실행·Viewer·pending 재사용)과는 충돌하지 않고, 선행 조건(§8 판정 규칙)도 이미 충족돼 있다. 다만 이 target 이 만드는 새 spec 계약의 소비자인 developer plan(`integration-personal-owner.md`)의 `spec_impact` 목록과 테스트 체크리스트 문구가 그 확장을 아직 반영하지 않아, 완료 시점 추적에서 조용히 빠질 여지가 있다 — 하드 블로커는 아니지만 같은 PR 안에서 갱신을 권한다.

## 위험도
LOW
