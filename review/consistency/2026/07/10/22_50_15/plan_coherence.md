# Plan 정합성 검토 — EIA `getStatus.context` 스키마화 (--impl-prep)

## 검토 대상

- 구현 예정: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts`
  (`ExecutionStatusDto.context` → closed oneOf, envelope-only) +
  `codebase/channel-web-chat/src/lib/eia-types.ts` (`currentNode` 타입 정정) + 테스트
- 구동 plan: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md`

## 발견사항

- **[INFO]** 구동 plan 체크리스트 항목 2–4 가 이미 완료됐는데도 `[ ]` 로 남아 있음
  - target 위치: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` §체크리스트 (line 165–168)
  - 관련 커밋: `a02db4f9a` (`docs(spec): EIA context 닫힌 union 스키마화 규약 + 부재 표현...`) — 현재 브랜치 HEAD
  - 상세: 체크리스트의
    - `swagger.md §1-4 개정 + §5-2 각주 + Rationale 2항목`
    - `api-convention.md §5.4 신설(소급 미적용 캐리브 포함) + Rationale 1항목`
    - `14-external-interaction-api.md §5.3 예시 JSON 정정(+seq:0) + cross-ref`
    - `spec-sync-external-interaction-api-gaps.md 의 cross-ref 1줄`

    네 항목 모두 `a02db4f9a` 에서 이미 반영되어 있음을 직접 확인했다: `swagger.md:85-117` 가 정확히 draft 의 `oneOf`/`ButtonsContextDto`/`NodeOutputContextDto` 예시와 discriminator 가드 문구를 담고 있고, `api-convention.md:172` 에 `### 5.4 부재 표현` 이 신설돼 번호 충돌 없이 자리 잡았으며, `spec-sync-external-interaction-api-gaps.md:18` 에 "축 분리 주의" cross-ref 문단이 이미 존재한다. 즉 이번 --impl-prep 시점에 실제로 남은 체크리스트 항목은 **"구현 위임 (developer)"** 한 줄뿐이다.
  - 제안: 이번 구현 커밋(또는 같은 PR)에서 plan 의 항목 2–4 를 `[x]` 로 정정해 "체크박스 = 실제 상태" 를 회복할 것. 구현을 막는 사안은 아니며, target spec 이 이미 확정 텍스트를 제공하므로 오히려 구현의 근거는 더 튼튼하다.

## 점검 관점별 결론

**(a) 파일/DTO 소유권 충돌** — `plan/in-progress/**` 전체를 `responses.dto.ts` / `eia-types.ts` / `ExecutionStatusDto` 문자열로 검색한 결과 `spec-draft-eia-context-schema-absence-convention.md` 외 어떤 plan 도 이 두 파일이나 DTO 를 언급하지 않는다. 특히:
  - `spec-sync-external-interaction-api-gaps.md` 의 `getStatus currentNode/context 실값` 항목은 이미 `[x]` 로 종결돼 있고, 본문에 "본 항목은 런타임 실값만 종결한다... OpenAPI 스키마 표현/부재 표현 컨벤션은 별도 축이며 spec-draft-eia-context-schema-absence-convention.md 에서 진행한다" 는 명시적 축-분리 문구가 있다 — 충돌이 아니라 이미 조율된 분업이다.
  - `node-output-redesign/` 27개 노드 파일 중 어느 것도 `getStatus`/EIA 응답 DTO 를 다루지 않는다(예외: `README.md` 의 ai-agent `output.error` 항목이 EIA §6.3 SSE payload 에 cross-ref 하나, 그건 `execution.failed` notification payload 이지 본 작업의 `getStatus.context` 가 아니다).

  결론: 소유권 충돌 없음.

**(b) `node-output-redesign/` 의 `nodeOutput` 관련 미해결 결정과의 충돌** — `node-output-redesign/` 은 노드별 `output` 필드가 `spec/conventions/node-output.md` 11개 Principle 을 얼마나 따르는가에 대한 진단/개선안 모음이다. 검토 결과 이 폴더 어디에도 **"EIA 봉투에서 `nodeOutput` 을 닫힌 스키마로 만든다"** 는 방향의 결정이나 요구는 없다 — 반대로 여러 노드 문서(`carousel.md` 의 `buttonConfig` 위치, `README.md` 의 Parallel `branches[i]` envelope CRITICAL 갭, ai-agent P0 error contract 잔여 등)가 각 노드의 실제 output 형태를 **현재도 계속 조정 중**임을 보여준다. 만약 target 이 `nodeOutput` 을 지금 닫힌 DTO 로 스키마화했다면, 이 진행 중인 노드별 조정마다 DTO 를 갱신해야 하는 결합이 생겼을 것이다. target 이 `nodeOutput`(과 `buttonConfig.buttons`)을 open map 으로 남기고 `spec/conventions/node-output.md` 를 내부 SoT 로 cross-ref 하는 결정은 이 진행 중인 노드별 churn 과 **정합**하며, 오히려 그 churn 을 흡수하기 위한 의도적 설계로 읽힌다. 미해결 결정을 선점하거나 무효화하는 지점 없음.

  참고로 `node-output-redesign/` 자체가 `spec/conventions/node-output.md` 는 "본 plan 은 conventions 자체는 변경하지 않는다" 고 명시하므로, 설령 향후 이 plan 이 마무리돼도 EIA 봉투 스키마(오직 `interactionType`/`waitingNodeId`/`conversationThread`/variant 키만 닫음)에는 영향이 없다.

**(c) 미해소 선행 plan** — `conversation-thread.md` 관련 plan(§1.3 자료구조 SoT)은 `plan/in-progress/`·`plan/complete/` 어디에도 별도 문서로 남아있지 않다(관련 후속은 `plan/complete/followup-conversation-reconcile.md` 로 이미 종결). target 의 Rationale 이 `conversation-thread.md` §1.3 을 `conversationThread` open-object 의 shape SoT 로 지목하는 것은 안전하다 — 이미 확정된 spec 문서를 가리킬 뿐, 진행 중인 plan 에 기대지 않는다. 그 외 target 이 전제하는 사전 조건(§1-4 개정, §5.4 신설, §5.3 예시 정정, `discriminator` 미사용 근거, 명명 가드)은 모두 이미 커밋된 spec 텍스트로 충족돼 있다. 구현을 막는 미해소 선행 조건 없음.

## 요약

Plan 정합성 관점에서 이번 --impl-prep 구현(EIA `ExecutionStatusDto.context` closed-oneOf DTO + `eia-types.ts` 타입 정정)은 다른 `plan/in-progress/**` 문서와 파일/DTO 소유권 충돌이 없고, `node-output-redesign/` 의 진행 중인 노드별 output 조정과도 상충하지 않으며(오히려 `nodeOutput` 을 open map 으로 남긴 설계가 그 churn 을 의도적으로 흡수함), 구현이 의존하는 spec 변경(swagger.md §1-4, api-convention.md §5.4, EIA §5.3 예시, 명명 가드, cross-ref)은 이미 커밋 `a02db4f9a` 로 확정돼 있어 선행 조건도 모두 충족됐다. 유일한 흠은 구동 plan 자신의 체크리스트가 이미 끝난 spec 항목 4개를 `[ ]` 로 남겨둔 hygiene 갭으로, 구현을 막지는 않지만 같은 PR 에서 정정을 권한다.

## 위험도

LOW
STATUS: SUCCESS
