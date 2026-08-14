# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 방법

`_prompts/cross_spec.md` 번들은 컨텍스트 예산 초과로 target 파일(`14-external-interaction-api.md`
등)과 `<git diff origin/main...HEAD -- code_areas>` 자체가 절단되어 있었다. 번들에 의존하지
않고 워크트리에서 직접 `git diff origin/main...HEAD -- spec/ codebase/` 및 관련 spec 파일
전문을 Read/grep 했다. 이번 라운드의 실제 diff 범위는 작다 —

- `spec/1-data-model.md` §2.14 (`Execution.error` 구조에 `nodeId`/`code` nullable + `details?` 추가)
- `spec/5-system/6-websocket-protocol.md` §4.4 (`llmCalls` strip 범위를 "WS 이벤트 필드"→"WS
  fanout + EIA REST `getStatus()`, 깊이 무관"으로 확장)
- `spec/5-system/14-external-interaction-api.md` §6.2/§6.4/§R17 (동일 확장 + `payload` 봉투
  래퍼 추가 + `error.code` nullable)
- 대응 코드: `strip-external-only-fields.ts`(신설 공유 유틸) + `websocket.service.ts` +
  `interaction.service.ts` (REST `getStatus` 의 waiting/terminal 세 출구 모두에 동일 strip 적용)

직전 라운드(`15_20_28` cross_spec)가 이 변경(7개 항목)을 실측 검증해 BLOCK:NO 를 준 뒤,
같은 턴에 planner 가 커밋(`4b13ca5ae`)으로 반영했다. 본 라운드는 **반영된 결과**를 다시
다른 spec 영역과 대조했다.

## 발견사항

- **[WARNING]** `error.code`/`nodeId` nullable 정정이 EIA 자신의 "normative" 필드 SoT 표에는
  반영되지 않았다 — 문서가 스스로 경고한 바로 그 drift 패턴
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4 본문 (`"code": ... | null`,
    `"nodeId": "uuid" | null` — 이번 diff 로 추가됨) 및 그 아래 blockquote
  - 충돌 대상: 같은 파일의 `### 종결 이벤트의 필드 집합 (normative)` 절 (라인 562~573),
    `error` 행 — `목표는 {code, message, nodeId, details?}` (nullable 표기 없음, 이번 diff
    에서 **변경되지 않음** — `git show 4b13ca5ae -- spec/5-system/14-external-interaction-api.md`
    로 확인, 이 행에 대한 hunk 없음). 그리고 `spec/1-data-model.md` §2.14 (같은 diff 로
    `{ nodeId: "uuid" \| null, code: "ERROR_CODE" \| null, message, details?: {...} }` 로 갱신됨)
  - 상세: `종결 이벤트의 필드 집합 (normative)` 절은 스스로 "같은 필드를 여러 문서에
    나열하면 그 각각이 두 번째 SoT 가 되고, 실제로 그렇게 됐다"(L559)고 명시하며, 이 표를
    다른 영역(`spec/5-system/6-websocket-protocol.md` §4.1, L195-196 `[필드 집합](.../#종결-이벤트의-필드-집합-normative)`)이 **직접 가리키는 단일 SoT**로 설계됐다. 그런데 이번 커밋이
    "code/nodeId nullable" 을 §6.4 본문·`1-data-model.md`에는 반영하면서 정작 이 normative
    표는 갱신하지 않아, WS §4.1 을 경유해 이 표만 읽는 소비자는 `code`/`nodeId` 를 상시
    present 로 오해할 수 있다 — 정확히 이 표가 막으려던 종류의 drift가 이 표 자신에서
    재발했다. 커밋을 낳은 planner draft(`plan/in-progress/spec-draft-eia-62-waiting-payload.md`
    §"(4) `error.code` 를 옵셔널로 (**§6.4 + 필드 집합 표**)")도 정확히 이 두 곳을 갱신
    대상으로 명시했으나 실제 커밋(`4b13ca5ae`)은 §6.4 만 반영했다(diff에 이 표 hunk 없음).
  - 제안: `종결 이벤트의 필드 집합 (normative)` 표의 `error` 행 비고에 `code`/`nodeId` 가
    `null` 일 수 있음을 §6.4 와 동일하게 명시 (짧은 한 줄이면 충분 — "`code`/`nodeId` 는
    `null` 가능, §6.4 참조").

- **[WARNING]** `Execution.error.details?` 신설 필드가 스스로 지목한 "원본"(`NodeExecution.error`)
  에는 존재하지 않는 필드 — 실제 출처는 다른 엔티티/필드
  - target 위치: `spec/1-data-model.md` §2.14 "Execution.error ↔ NodeExecution.error 관계"
    표의 "구조" 행 (이번 diff): `{ nodeId: "uuid" \| null, code: "ERROR_CODE" \| null,
    message: "에러 설명", details?: {...} }` — 같은 표가 "원본"으로 `NodeExecution.error` 를
    지목한다
  - 충돌 대상: (a) 같은 파일 §2.14 "NodeExecution" 필드 표 (라인 552, 이번 diff로 변경되지
    않음): `error \| JSONB? \| 에러 정보 { code, message, stack? }` — `details` 없음, 대신
    `stack?`. (b) `spec/conventions/node-output.md` §3.2 `output.error` 표준 형태 — `details`
    는 이 문서가 정의하는 **`output.error.details`**(§3.2.1/§3.2.2, 노드 핸들러 결과 —
    `NodeExecution.output_data.error.details`) 소속이지 `NodeExecution.error`(DB 컬럼, 위
    552행) 소속이 아니다. 실제 코드(`execution-engine.service.ts:4828-4832` `finalizeFailedExecution`,
    `:4190`, `:629`, `retry-turn.service.ts:937`)도 `savedExecution.error`/`execution.error`
    를 `{ message, code? }` 로만 쓰고 `nodeId`·`details` 를 넣는 지점이 없다 — "복사"라고
    부르는 원본 자체가 `details` 를 가진 적이 없다.
  - 상세: "구조" 행은 `NodeExecution.error`(552행, `{code,message,stack?}`)를 원본으로
    선언하면서 그 원본에 없는 `details?` 를 복사본에만 추가했다. 실제 "노드 타입별 상세"
    데이터(EIA §6.4 예시 주석)의 진짜 출처는 `output_data.error.details`(node-output.md
    §3.2.2, 다른 영역 문서가 소유)이지 `NodeExecution.error` 가 아니다. "원본/복사" 프레이밍이
    두 개의 다른 필드(`NodeExecution.error` vs `NodeExecution.output_data.error.details`)를
    하나로 뭉뚱그려, `details` 가 어디서 오는지 찾는 다음 사람이 존재하지 않는
    `NodeExecution.error.details` 를 찾게 만든다. 또한 EIA 쪽은 이 표가 "목표"(아직
    코드가 못 미친 상태)임을 스스로 명시(§R17 등 도처의 "목표는" 표기 관례)하는 반면,
    data-model.md 의 "구조" 행은 그런 표기 없이 단정형으로 적혀 있어 두 영역이 같은
    미구현 상태를 서로 다른 확신도로 서술한다.
  - 제안: "구조" 행에서 `details?` 의 출처를 `NodeExecution.output_data.error.details`
    (node-output.md §3.2)로 명시하거나, 552행 `NodeExecution.error` 필드 설명에 `details`
    를 추가해 두 표가 같은 어휘를 쓰게 정정. `nodeId`/`details` 가 현재 엔진 코드에서
    실제로 채워지지 않는다면(위 4개 지점 실측) EIA 쪽처럼 "목표(Planned)" 표기를 병기.

## 검증되어 충돌이 아님으로 확인된 항목 (참고용)

- **`llmCalls` 필드명 기반 strip 이 다른 AI 노드 스펙과 의미 충돌하지 않음**: `stripExternalOnlyFields`
  는 필드명 `llmCalls` 를 깊이 무관으로 제거한다. `spec/4-nodes/3-ai/2-text-classifier.md`
  (`meta.llmCalls` = "LLM 호출 디버그 트레이스") · `spec/4-nodes/3-ai/0-common.md`
  (`meta.turnDebug[].llmCalls`)도 전부 동일하게 "디버그 트레이스" 로 규정하고 있어, 노드
  타입 불문 `llmCalls` 라는 이름은 spec 전역에서 예외 없이 "editor-only debug" 의미로
  쓰인다 — 필드명만으로 무차별 strip 해도 정당한 사용자 데이터를 오삭제할 위험이 없다.
- **sibling plan(`spec-draft-eia-notification-payload-contract.md`) 과의 §6.2 blockquote
  소유권 경합**(직전 라운드 `15_20_28` WARNING): 실측 결과 이미 해소돼 있다. 그 plan 자체가
  2026-08-14 자 "소급 정정" 절에서 자신의 §6.2 처리가 미완("payload 래퍼 누락")이며
  `spec-draft-eia-62-waiting-payload.md` 가 마저 닫을 것을 명시하고 있었고, 이번 커밋이
  정확히 그 누락(payload 래퍼)을 채웠다 — 두 plan 은 경합이 아니라 이어달리기였다.
- **`Execution.error.code === null` 의 chat-channel 수신측 처리**: `spec/5-system/15-chat-channel.md`
  CCH-ERR-04 가 이미 "`error.code === null` 은 `executionFailedInternal` 로 fallback" 을
  명시하고 있어(직전 라운드에서도 확인됨), 이번 nullable 변경과 정합한다.
- **`spec/5-system/3-error-handling.md` §1.4 엔진 에러코드 표**: EIA §6.4 의 `code` enum
  나열과 모순 없음 — nullable 은 "코드가 없을 수도 있다"는 부재 표현 추가일 뿐 기존
  enum 값 목록을 변경하지 않는다.
- **API 컨벤션 §5.4 (`null` vs 키 생략)**: `code`/`nodeId` 를 `null`(키 present) 로 택한
  근거가 data-model.md·EIA §6.4 양쪽에 명시돼 있어 §5.4 의 "필드별 근거 명시" 요건을
  충족한다 (단, `details?` 의 키-생략 선택 근거는 명시돼 있지 않다 — 다만 이 항목은
  convention_compliance 영역과 겹쳐 본 리포트에서는 위 두 번째 WARNING 의 부수로만 남긴다).

## 요약

이번 diff 는 llmCalls 외부 유출을 REST `getStatus()` 표면까지 막는 보안 수정과, 그에 따른
spec 서술(WS §4.4·EIA §6.2/§6.4/§R17·data-model §2.14) 동기화다. 핵심 보안 계약(strip 범위·
깊이 무관 제거)은 여러 영역(WS/EIA/AI 노드 스펙)에 걸쳐 일관되게 서술되어 새로운 CRITICAL
모순은 없다. 다만 이번 정정이 **부분적으로만** 퍼졌다 — (1) EIA 자신의 "종결 이벤트의 필드
집합(normative)" 표가 §6.4 본문의 nullable 정정을 못 따라가 다른 영역(WS §4.1)이 가리키는
단일 SoT 가 stale 해졌고, (2) data-model.md 의 `Execution.error.details?` 신설 필드가 자신이
지목한 "원본"(`NodeExecution.error`)에는 없는 필드라 데이터 계보 서술이 다른 영역
(`conventions/node-output.md`)의 실제 정의와 어긋난다. 둘 다 기능을 깨뜨리는 직접 모순은
아니지만, 이 PR 이 고치려던 것과 같은 클래스의 "정의가 여러 곳에 흩어져 한쪽만 갱신됨"
패턴이라 후속 정정 가치가 있다.

## 위험도

LOW
