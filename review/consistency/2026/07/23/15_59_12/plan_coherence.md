# Plan 정합성 검토 — presentation-previousoutput-spec-drift.md

## 발견사항

- **[WARNING]** `node-output-redesign` plan(같은 `plan/in-progress/`)이 target 이 정정하려는 바로 그 오류를 그대로 서술 — target 갱신 후 즉시 재-모순
  - target 위치: `plan/in-progress/presentation-previousoutput-spec-drift.md` §"대상 4곳" 전체 + §체크리스트 (`previousOutput` 4곳 정정 / 동반 정정 A·B)
  - 관련 plan: `plan/in-progress/node-output-redesign/chart.md:46`, `plan/in-progress/node-output-redesign/form.md:73-77`, `plan/in-progress/node-output-redesign/README.md:263`
  - 상세: `node-output-redesign` 은 별도의 진행 중(in-progress) plan 폴더로, 28개 노드 spec ↔ 구현 정합성을 진단한다. 그 안의 `chart.md:46`("옛 `output.type…` / `output.previousOutput` 모두 폐기")과 `form.md:73-77`(`output.previousOutput` 을 "금지 필드" 목록에 나열)는 target 이 지금 "완전 폐기 → 신규 소비 금지(과도기 보존)"로 **정정하려는 바로 그 문구**를 그대로 반복한다. `README.md:263` 은 한 걸음 더 나아가 "`output.previousOutput` 폐기 … 1차 초안의 핵심 정리 항목은 모두 spec 본문에 반영 완료"라고 **완료로 단정**한다. 이 세 지점은 target 이 실측한 code(`button-interaction.service.ts` `buildResumedStructuredOutput`)·`node-output.md §4.2`(과도기 예외 SoT)와 정면 모순되며, target 의 chart.md 6차 갱신(2026-06-25) 조차 "chart 노드 디렉터리 커밋 없음"이라고 적어 이 drift 를 못 잡았다 — 즉 node-output-redesign 의 "구현 분석" 단면이 정작 재개 출력을 만드는 `ButtonInteractionService` 를 점검 대상에서 놓쳤다.
    target 의 체크리스트(§체크리스트)는 `spec/4-nodes/6-presentation` 4곳 + `0-common.md` 동반 정정 A/B만 다루고, 이 sibling plan 문서 3곳은 다루지 않는다. target 이 머지된 후에도 `node-output-redesign/chart.md`·`form.md`·`README.md` 는 "폐기됨/완료"로 계속 서술하게 되어, 정정한 spec(§4.2 링크·"신규 소비 금지" 각주)과 이 plan 문서가 다시 어긋난다 — target 이 고치려는 것과 동일한 유형의 drift 가 plan/ 레이어에 재생산된다.
  - 제안: target 의 체크리스트에 항목 추가 — `node-output-redesign/chart.md:46`·`form.md:73-77`·`README.md:263` 를 "폐기(완료)" 서술에서 "신규 소비 금지 — 과도기 보존, `node-output.md §4.2` 참조"로 동기 정정(각주 형태로 충분). 최소한 각 파일 상단에 1줄 stale-notice 라도 남겨 이번 조사 결과와 어긋나지 않게 한다.

- **[INFO]** target 이 참조하는 "Phase 3" 이 `plan/in-progress/**` 어디에도 실제로 추적되지 않음 — dangling 참조에 서술만 더해짐
  - target 위치: target §"개선 방침" 제안 문구 ("Phase 3 정리 시 코드·spec 동시 제거") — `spec/4-nodes/6-presentation` 4곳에 신규 삽입 예정
  - 관련 plan: 없음(정확히 이 지점이 문제) — `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:290` 의 코드 주석이 "Phase 3 precondition in `memory/node-specs-improvement-progress.md`"를 가리키지만, 그 경로는 저장소에 **존재하지 않는다**(`find` 0건). 이미 `review/code/2026/06/19/03_32_59/documentation.md`·`review/code/2026/06/19/03_51_29/documentation.md` 가 이 dangling 참조를 INFO 로 지적했으나 미해결로 남아 있다. `node-output-redesign` plan 은 "Phase 3"라는 명명 자체를 쓰지 않고 previousOutput 을 이미 완료된 것으로 취급하므로(위 WARNING), 이 코드 주석이 가리키는 실제 추적 plan 은 현재 어느 `plan/in-progress/*.md` 에도 대응하지 않는다.
  - 상세: target 은 "Phase 3 자체(코드에서 previousOutput 제거)"를 명시적으로 비목표로 남기면서도, "Phase 3 정리 시 코드·spec 동시 제거"라는 문구를 `node-output.md §4.2`(기존)뿐 아니라 presentation 4개 파일에 신규로 반복 삽입한다. 이는 존재하지 않는 추적처를 참조하는 표현을 4곳으로 늘리는 것과 같다 — 향후 독자가 "Phase 3 plan" 을 `plan/`에서 찾다가 없다는 것을 알게 된다.
  - 제안: 필수는 아니나, 이번 배치에서 (a) 코드 주석의 죽은 경로(`memory/node-specs-improvement-progress.md`)를 실제 추적 plan(예: 신규 `plan/in-progress/presentation-previousoutput-removal-phase3.md` stub, 또는 이 target plan 자체를 그 추적처로 지정)으로 갱신하거나, (b) 최소한 target 의 Rationale 에 "Phase 3 는 아직 별도 plan 으로 존재하지 않으며 코드 주석의 참조가 dangling 임을 인지한다"는 1줄을 남겨 두면 향후 혼란을 줄인다.

## 요약

target 문서 자체의 정정 방향(완전 폐기 → 신규 소비 금지/과도기 보존, `node-output.md §4.2` 를 SoT 로 링크)은 실측(코드·기존 SoT)과 정합하며, `plan/in-progress/**` 의 다른 진행 중 작업(`ai-agent-tool-connection-rewrite`, `cafe24-backlog-residual`, `chat-channel-*`, `execution-engine-residual-gaps` 등)과는 충돌하는 미해결 결정이나 선행 조건이 없다. 다만 같은 `plan/in-progress/node-output-redesign/` 폴더(README.md·chart.md·form.md)가 target 이 지금 고치는 것과 **동일한 오류**("previousOutput 완전 폐기·완료")를 여전히 서술하고 있어, target 의 체크리스트에 이 sibling plan 의 동기 정정이 빠지면 정정 직후 plan 레이어에서 같은 drift 가 재발한다. 추가로 target 이 반복 인용하는 "Phase 3" 는 실제 추적 plan 이 없는 dangling 참조(기존 code review 에서 이미 INFO 로 지적)이며, target 이 이 표현을 4곳으로 확산시키는데도 그 갭을 메우지 않는다. 두 사항 모두 target 을 막을 필요는 없으나(현재 spec 정정 자체는 옳다) 같은 PR 또는 즉각 후속에서 반영하는 것이 바람직하다.

## 위험도

MEDIUM
