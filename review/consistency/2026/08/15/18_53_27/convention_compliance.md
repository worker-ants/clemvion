# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 방법론 caveat

`_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 `spec/5-system/` 19개 파일 중
3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문이 실렸고 나머지 15개
(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md` 등)와
`spec/conventions/` 대부분(`error-codes.md`·`node-output.md`·`redis-keys.md`·`swagger.md`·
`execution-context.md` 등)이 "본문 생략됨" 스텁으로만 존재했다. 이는 기존에 기록된 구조적
갭([`feedback_consistency_spec_mode_budget.md`](../../../../../../.claude/../CLAUDE.md) 계열 —
"consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다")의 재현이다.

이번 turn 은 이 갭을 메우기 위해 (a) 번들에 실린 3개 파일 전문을 검토하고, (b) 현재
진행 중인 `plan/in-progress/ws-event-types-extract.md` (websocket.service 리팩터) 와 가장
직접 관련된 `spec/5-system/6-websocket-protocol.md` 를 파일시스템에서 직접 Read 했으며,
(c) 그 문서들이 참조하는 정식 규약 원본(`spec/conventions/swagger.md`·`error-codes.md`·
`redis-keys.md`·`audit-actions.md`)도 직접 Read 해 실제 SoT 대조로 교차검증했다. 나머지
truncated 파일(특히 `4-execution-engine.md`·`14-external-interaction-api.md`)은 검토하지
못했다 — 여기 발견사항이 없다는 것을 "위반이 없다"의 근거로 삼지 말 것.

## 발견사항

검토한 범위 내에서 CRITICAL·WARNING 수준의 정식 규약 위반은 발견되지 않았다. 오히려
`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`6-websocket-protocol.md` 는 규약
이탈(예: 초대 API 의 `lower_snake_case` 에러 코드, WS ack 이벤트명 `execution.form_submitted`
historical artifact, `{data:{items}}` 비-페이징 pass-through)을 전부 `error-codes.md §3`·
`swagger.md §6` 등 SoT 조항을 명시 인용하며 **스스로 예외로 등재**하고 있어, 신규 위반이라기보다
이미 정합화된 상태로 판단된다.

- **[INFO] `## Overview` 섹션 부재 — 3섹션 구조 권장과 부분 불일치**
  - target 위치: `spec/5-system/2-api-convention.md`(frontmatter 직후 `## 1. 기본 원칙`으로
    바로 진입), `spec/5-system/6-websocket-protocol.md`(동일하게 `## 1. 연결`로 바로 진입)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 —
    `spec/conventions/` 자체 문서(`error-codes.md`·`audit-actions.md`·`redis-keys.md`)는 모두
    명시적 `## Overview` 헤더로 시작한다.
  - 상세: `grep -L "^## Overview" spec/5-system/*.md` 로 실측하면 19개 중 7개
    (`2-api-convention.md`·`6-websocket-protocol.md`·`5-expression-language.md`·
    `7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md`·`_product-overview.md`)가
    `## Overview` 헤더가 없다. 이 중 6개는 `## Rationale` 은 갖고 있어 3섹션 중 2섹션만
    충족한다(`_product-overview.md` 는 태생적으로 다른 구조라 제외). `1-auth.md`·
    `3-error-handling.md` 는 정상적으로 `## Overview` 를 갖는다.
  - 제안: 이는 이번 작업(`ws-event-types-extract`, `spec_impact: none`)이 새로 만든 상태가
    아니라 **기존부터 7개 문서에 걸쳐 있던 패턴**이다. "권장"(mandatory 아님) 수준이고 이번
    turn 의 spec 변경 계획도 없으므로 이 turn 을 막을 사유는 아니다. 다만 `6-websocket-protocol.md`
    는 이번 작업이 직접 다루는 코드(`websocket.service`)의 SoT 문서이므로, 후속 spec 정리
    시점에 `## Overview` 절 추가를 고려할 만하다 — 별도 `project-planner` turn 소관.

- **[INFO] `execution.node.*` 이벤트 표의 `nodeName`/`nodeLabel` 불일치는 문서가 이미 self-flag**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 표 L177~L188 하단 note
  - 위반 규약: 해당 아님 (참고용) — `node-output.md`/명명 규약 위반이 아니라 spec-구현 drift.
  - 상세: 표는 `nodeName` 필드로 표기돼 있으나 실제 엔진/프론트는 `nodeLabel` 을 쓴다고 문서
    스스로 "spec drift, 본 PR scope 밖" 이라 명시하고 있다. 이는 convention_compliance 가 아니라
    cross_spec/spec-coverage 축의 기존 인지 항목으로 보이며, 여기서는 참고로만 남긴다(내 등급
    판정에는 포함하지 않음 — 이미 문서가 스스로 스코프 밖으로 선언했다).

## 요약

번들 예산 초과로 `spec/5-system/` 대부분과 `spec/conventions/` 대부분이 생략된 상태에서
진행한 제한적 검토다. 실제로 읽을 수 있었던 범위(`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 전문 + `6-websocket-protocol.md` 파일시스템 직독 + 대조 대상
`swagger.md`·`error-codes.md`·`redis-keys.md`·`audit-actions.md` 전문)에서는 명명·출력
포맷·에러 코드·API 문서화 규약 위반이 발견되지 않았고, 오히려 각 문서가 자신의 규약 이탈
사례를 `error-codes.md §3`/`swagger.md §6` 등 SoT 조항까지 인용하며 명시적으로 예외 등재해
두는 등 규약 준수 관리가 이례적으로 엄격하다. 유일한 발견은 일부 문서(7/19, 이번 작업이
직접 건드리는 `2-api-convention.md`·`6-websocket-protocol.md` 포함)에 `## Overview` 헤더가
없다는 구조적 INFO 이며, 이는 기존부터 있던 패턴이라 이번 turn 을 차단할 사유는 아니다.
truncated 파일(`4-execution-engine.md`·`14-external-interaction-api.md` 등 15개 spec 파일,
`error-codes.md`·`node-output.md`·`execution-context.md` 등 대부분의 conventions 파일)은
검토하지 못했으므로 "발견 없음"을 그 파일들의 완전한 준수로 해석하지 말 것.

## 위험도

NONE
