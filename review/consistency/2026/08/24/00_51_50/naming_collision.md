# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, `00_51_50` 라운드)

## 컨텍스트 요약

이번 라운드의 target scope 는 `spec/5-system/` 전체이나, `diff-base=origin/main` 기준 실제
변경분은 `git diff origin/main...HEAD -- spec/5-system/` 로 직접 재확인한 결과 여전히
`14-external-interaction-api.md`(§R17)와 `6-websocket-protocol.md`(§4.4 wire caveat) 두
파일뿐이다. 구현 diff 는 `codebase/backend/src/shared/utils/node-output-allowlist.ts`
(`NODE_OUTPUT_ALLOWED_KEYS` 에 wire 전용 4키 `payload`·`title`·`rendered`·`nodeType` 추가)와
`codebase/backend/src/modules/websocket/websocket.service.ts`(신규 private 함수
`allowlistFanoutNodeOutput`, `toFanoutEnvelope` 배선)다.

이 작업은 같은 세션에서 이미 naming_collision 관점으로 3라운드를 거쳤다:

- `22_26_33` — WARNING 2건: W1 `nodeOutput.nodeType` vs "외부 소비 매핑 없음"으로 못박힌
  `waitingNodeType`/`node.type`, W2 `nodeOutput.payload` vs §6 이 SoT 인 webhook 봉투 최상위
  `payload`.
- `23_29_27` — W1·W2 가 EIA §R17 disambiguation blockquote(*"이름이 겹치는 두 쌍을 갈라 둔다"*)로
  **반영·해소**됨을 diff 로 확인. 신규 4번째 키 `title` 은 `notification.new.title` 과 동명이나
  선언 위치·값 도메인이 갈려 있어 INFO(조치 불요). 위험도 NONE.
- `00_26_17` — target 이 `spec/conventions/` 로 좁혀진 라운드에서도 위 disambiguation 이
  HEAD 에 실존함을 재확인. 위험도 NONE.

본 라운드는 그 위에서 (a) `23_29_27` 이후 `spec/5-system/` 에 추가 커밋이 있었는지, (b) 그
커밋이 새 식별자 충돌을 만들었는지, (c) 전체 `spec/5-system/`(14개 파일)에서 4개 wire 키와
동명인 미검토 자리가 더 있는지를 재점검했다.

## 발견사항

### [해소 확인] `23_29_27` 이후 커밋(`fe4d58de7`)은 naming 이 아니라 보장 범위 정정 — 신규 식별자 충돌 없음

`git log --oneline -- spec/5-system/14-external-interaction-api.md` 상 `23_29_27` 라운드
이후 이 파일에 실제로 반영된 마지막 커밋은 `fe4d58de7`("보장을 구현에 맞춰 좁혔다 —
`envelope.output` 은 안 닫혔다, `23_29_27` CRITICAL")이다. 내용은 `23_29_27` 의 cross_spec
CRITICAL(§R17 이 "REST 와 SSE 는 같은 강도" 라 넓게 서술한 것을 `execution.node.*` 의
`envelope.output` 잔여로 좁힘)에 대한 정정이며, 여기서 참조하는 식별자
(`envelope.output`·`execution.node.completed`/`.failed`·`NodeExecution.outputData`) 는 전부
기존 식별자 재인용이다. 신규 명명 없음 — naming_collision 관점에서 재지적 대상 아님.

### [재확인] W1(`nodeType`)·W2(`payload`) disambiguation 은 현재 HEAD 에도 실존

`git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md` 로 직접
재확인한 현재 diff 에 아래 blockquote 가 그대로 있다:

> **이름이 겹치는 두 쌍을 갈라 둔다** (`22_26_33` naming W1·W2) — 이 절의 관례대로 근접한
> 이름은 별개 표면임을 명시한다.
> - `nodeOutput.nodeType`(카드 렌더 서브타입, **외부 노출 대상**)은 wire top-level
>   `waitingNodeType`(= `node.type`, 외부 비노출)과 **다른 필드**다.
> - `nodeOutput.payload`(핸들러가 만든 legacy 카드 렌더 데이터)는 §6 webhook 봉투 최상위
>   `payload`와 **동일 키명이지만 중첩 레벨이 다른 별개 필드**다.

**재지적 불필요.**

### [확인] `nodeType`/`title`/`rendered`/`payload` — target scope(`spec/5-system/` 14개 파일) 전수 재sweep, 미검토 잔여 없음

이전 라운드는 `14-external-interaction-api.md`/`6-websocket-protocol.md` 두 파일과
`notification.new.title` 한 건만 대조했다. 이번 라운드는 target 이 `spec/5-system/`
전체이므로 나머지 12개 파일까지 확장해 grep 으로 재sweep했다:

- `nodeType` — `3-error-handling.md`(예시 payload `"nodeType": "ai_agent"`),
  `5-expression-language.md`(`resolveConfig` 세 번째 인자), `4-execution-engine.md`
  (`NodeRegistry.register/get/getMetadata`, `UNKNOWN_NODE_TYPE`, timeline row 예시)에 등장.
  전부 **엔진 레벨 "노드의 타입"** 이라는 기존 개념(=W1 에서 이미 "외부 비노출"로 못박힌
  `node.type`/`waitingNodeType` 와 동일 개념 계열)의 재사용이며, 이번 작업이 새로 편입한
  "`nodeOutput` 내부의 렌더 서브타입" 의미와는 이미 W1 disambiguation 이 가른 대로 분리돼
  있다. 새 충돌 아님.
- `title` — `13-replay-rerun.md` 에 `history.rerun.modal.title`(i18n 키)로 1건 등장. 값
  도메인·네임스페이스가 완전히 달라(UI 라벨 i18n 키 vs wire 필드) 오독 위험이 없다.
- `rendered` — `14-external-interaction-api.md`/`6-websocket-protocol.md`/`15-chat-channel.md`
  세 파일에만 등장(`output.rendered` snapshot, `extractRendered` 헬퍼)하며 셋 다 같은 개념
  (chat-channel 렌더 파이프라인)을 가리킨다. 나머지 11개 파일에는 등장하지 않는다.
- `payload` — 매우 일반적인 용어라 전 파일에 다수 등장하지만(모든 이벤트 payload 서술),
  W2 에서 이미 다룬 "webhook 봉투 vs `nodeOutput.payload`" 3중 동명 충돌 외에 새로 좁혀
  대조해야 할 동일-레벨 충돌은 발견되지 않았다.

### [확인] 신규 함수/상수 식별자는 codebase 전체에서 단일 정의·단일 참조

`allowlistFanoutNodeOutput`(신규 private 함수, `websocket.service.ts`)는 `git grep` 결과
정의부 1곳·호출부 1곳(같은 파일 `toFanoutEnvelope` 내부)만 존재해 기존 다른 식별자와
충돌하지 않는다. `NODE_OUTPUT_ALLOWED_KEYS` 는 `22_26_33` 라운드 이전에 이미 도입된 기존
상수의 원소 확장이며 신규 상수가 아니다. 요구사항 ID(§R17 은 기존 번호 유지, 신규 R-번호
없음)·엔티티/DTO명·API endpoint·webhook/queue/SSE 이벤트명·ENV var·spec 파일 경로 층위에서
이번 diff 로 신규 도입된 식별자는 없다.

## 요약

target(`spec/5-system/`) scope 로 확장해 재검토했으나, `23_29_27` 라운드 이후 이 영역에
반영된 유일한 커밋(`fe4d58de7`)은 보장 범위를 구현에 맞춰 좁히는 정정이라 신규 식별자를
도입하지 않는다. 선행 라운드가 발견한 두 건(W1 `nodeType`, W2 `payload`)의 disambiguation
은 현재 HEAD 에도 실존함을 diff 로 재확인했고, 이번 라운드에서 처음으로 전체
`spec/5-system/`(14개 파일)에 대해 4개 신규 wire 키를 전수 재sweep 했지만 기존에 다른
의미로 쓰이는 자리와의 미해소 충돌은 추가로 발견되지 않았다. 신규 함수/상수 식별자
(`allowlistFanoutNodeOutput`)도 codebase 전체에서 단일 정의·단일 참조로 충돌 없음을
확인했다.

## 위험도

NONE
