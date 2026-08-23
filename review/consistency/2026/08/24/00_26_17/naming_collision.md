# 신규 식별자 충돌 검토 — `spec/conventions/` (impl-done, 00_26_17 라운드)

## 컨텍스트 요약

이번 라운드의 target scope 는 `spec/conventions/` 이고 `diff-base=origin/main` 기준 실제
변경분은 `git diff --name-only origin/main...HEAD -- spec/conventions/` 로 직접 재확인한 결과
**`spec/conventions/conversation-thread.md` 단 1개 파일, 6줄**뿐이다(§8.4 "소비처 갱신
(2026-07-09)" 문단의 자기-반증형 소정정 — CLAUDE.md §자기-반증형-소정정 절차를 따라
developer 가 `#1205`에서 자신이 쓴 예고 문장 *"SSE·fanout 이 잔여다"* 를 취소선으로 남기고,
같은 날 `sse-nodeoutput-allowlist` 작업의 실측(`redactThreadForPublic`·`emitExecutionEvent`/
`emitNodeEvent`→`WebsocketService.toFanoutEnvelope` 공유 chokepoint·버튼 재개 record 를 넣으면
`{}` 가 되는 실측)으로 반증하는 정정 블록을 추가).

이 정정 블록이 참조하는 식별자(`redactThreadForPublic`·`emitExecutionEvent`·`emitNodeEvent`·
`WebsocketService.toFanoutEnvelope`·`envelope.output`·`NodeExecution.outputData`)는 전부
**이미 존재하는 식별자의 재인용**이며, 본 diff 로 새로 도입되는 요구사항 ID·엔티티/타입명·
API endpoint·이벤트/메시지명·ENV var·설정키·spec 파일 경로는 없다.

## 발견사항 (이번 라운드 scope 한정)

없음 — `spec/conventions/` diff 6줄은 기존 식별자를 재인용하는 정정문일 뿐, 신규 식별자를
도입하지 않는다.

## 참고 (out-of-scope 이지만 교차검증 목적으로 재확인함)

같은 작업(`sse-nodeoutput-allowlist`)의 실제 신규 식별자 도입 지점은 `spec/conventions/` 가
아니라 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 의
`NODE_OUTPUT_ALLOWED_KEYS` 4키 추가(`payload`·`title`·`rendered`·`nodeType`)와
`spec/5-system/14-external-interaction-api.md` §R17 / `6-websocket-protocol.md` §4.4 갱신이다.
이 부분은 **이번 라운드 target 밖**(target=`spec/conventions/`)이지만, 같은 세션의 선행
consistency-check 라운드에서 이미 전수 검토됐음을 diff 로 교차 확인했다:

- `review/consistency/2026/08/23/22_26_33/naming_collision.md` — WARNING 2건 발견:
  (W1) `nodeOutput.nodeType` vs "외부 소비 매핑 없음"으로 못박힌 `waitingNodeType`/`node.type`,
  (W2) `nodeOutput.payload` vs §6 이 SoT 인 webhook 봉투 최상위 `payload`.
- `review/consistency/2026/08/23/23_29_27/naming_collision.md` — W1·W2 가 EIA §R17 에 추가된
  disambiguation blockquote(*"이름이 겹치는 두 쌍을 갈라 둔다"*, `22_26_33` naming W1·W2 인용)로
  **반영·해소**됐음을 diff 로 재확인. 신규 4번째 키 `title` 은 `notification.new.title` 과 동명이나
  선언 위치·값 도메인이 갈려 있어 INFO(조치 불요).
- 위 disambiguation blockquote 는 현재 HEAD 의 `spec/5-system/14-external-interaction-api.md`
  §R17 에 실제로 존재함을 본 라운드에서도 직접 재확인했다(`git diff origin/main...HEAD --
  spec/5-system/14-external-interaction-api.md` 로 W1·W2 disambiguation 문구 재검증).

즉 `payload`/`title`/`rendered`/`nodeType` 4키의 식별자 충돌 검토는 이미 종결됐고, 이번
`spec/conventions/` 라운드에서 재지적할 새 충돌은 없다.

## 요약

이번 라운드 target(`spec/conventions/`)의 실제 diff 는 `conversation-thread.md` 의 6줄
자기-반증형 소정정 블록 하나이며, 여기서 새로 도입되는 식별자(요구사항 ID·엔티티/DTO명·API
endpoint·이벤트/메시지명·ENV var·설정키·spec 파일 경로)는 없다 — 전부 기존에 이미 존재하고
문서화된 식별자(`redactThreadForPublic` 등)를 재인용해 앞선 예고 문장을 정정할 뿐이다. 같은
작업이 실제로 신규 도입한 4개 wire 키(`payload`·`title`·`rendered`·`nodeType`, allowlist 확장)는
`spec/conventions/` 밖(`spec/5-system/`)에서 발생했고, 그 충돌 검토는 이미 선행 라운드
(`22_26_33`, `23_29_27`)에서 수행·해소가 diff 로 확인됐다.

## 위험도

NONE
