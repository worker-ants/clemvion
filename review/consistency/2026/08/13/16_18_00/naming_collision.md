# 신규 식별자 충돌 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 방법

target 은 `spec/5-system/14-external-interaction-api.md` §6 에 **번호 없는 도입부**를 신설해
종결 이벤트(`execution.completed`/`failed`/`cancelled`) payload 필드 집합을 단일 SoT 로 두고,
`6-websocket-protocol.md` §4.1 · `conventions/chat-channel-adapter.md` §1.2 ·
`3-workflow-editor/3-execution.md` §8.1 을 그 참조로 축약하는 **재구성(consolidation) 작업**이다.
프롬프트 번들이 EIA/WS/adapter 본문을 컨텍스트 예산 초과로 절단했으므로, 세 파일 + 관련 코드
(`websocket.service.ts`, `execution-engine.service.ts`, `chat-channel/types.ts`, `node-output.md`,
`spec-sync-*-gaps.md`)를 직접 `Read`/`grep` 하여 대조했다.

target 이 **새로 만드는** 식별자는 사실상 없다 — 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
env var·spec 파일 경로 어느 축에도 신규 도입이 없다. `status`/`error`/`result.cancelledBy`/
`result.outputs`/`durationMs` 는 모두 EIA §6.3~6.5 에 **이미 존재하는** 필드명을 한 곳으로 모으는
것이고, `EiaEvent`·`ChatChannelInternalEvent` 타입명도 그대로 유지된다. 따라서 아래는 "새 식별자가
기존과 다른 의미로 충돌"이라기보다, **재구성 지시가 기존에 이미 갈라져 있던 동의어 필드명을
어떻게 다룰지 명시하지 않아 구현 시점에 조용히 잘못된 이름으로 수렴할 위험**에 초점을 맞췄다.

## 발견사항

### [WARNING] `durationMs`(신설 도입부 canonical 필드명) vs WS 기존 필드명 `duration` — 참조 축약 지시가 이름 차이를 안 덮는다

- **target 신규 식별자**: EIA §6 도입부(신설)가 규범 필드 집합으로 못박는 `durationMs`
  (target 본문 "(1) 도입부가 소유하는 것" 표)
- **기존 사용처**:
  - `spec/5-system/6-websocket-protocol.md:177-179` — `execution.completed`/`failed`/`cancelled`
    행이 지금 `duration` (Ms 접미사 없음)으로 문서화돼 있다.
  - `spec/3-workflow-editor/3-execution.md:520-522` — 같은 이벤트를 `executionId, status, duration`
    으로 재서술(3중 사본 중 하나, target 이 "비-authoritative 표기"로 축약 예정인 바로 그 표).
  - 대조: `spec/2-navigation/14-execution-history.md:370,408`, `spec/3-workflow-editor/4-ai-assistant.md:228,243,1440,1444`,
    `spec/conventions/node-output.md:89-93`(`meta.durationMs`), EIA §6.3/6.4 자체(`"durationMs": 12345`) —
    이쪽은 전부 이미 `durationMs`. 즉 `duration`(Ms 없음)이 저장소 전체에서 **WS 관련 두 표만** 쓰는
    소수파 표기다.
- **상세**: target 은 (2)에서 "WS §4.1 — … **필드 열거를 버리고** '(1) 의 필드 집합이 flat 하게
  펼쳐진다' … 두 줄로" 라고만 지시한다. 문자 그대로 실행하면 WS §4.1 은 이제 "(1)의 필드 집합"을
  참조하게 되고 (1)의 그 필드는 `durationMs` 이므로, 실제로는 여전히 `duration` 을 쓰는(코드도
  아직 이 필드를 emit 하지 않아 실측 불가 — 미구현 상태) WS 표가 **암묵적으로 개명된 것처럼** 읽힐
  수 있다. 그런데 target 의 "비목표" 절은 "`duration` → `durationMs` 전역 개명 — … 반경이 목적을
  넘는다. 후속" 이라고 **명시적으로 이번 스코프에서 제외**한다. 지시(참조로 축약)와 비목표(개명
  안 함)가 같은 필드에 대해 서로 다른 결과를 함의한다 — 실제 §4.1 본문을 쓰는 시점에 "flat 하게
  펼쳐진다"를 문자 그대로 옮기면 비목표를 어기고, `duration` 을 그대로 남기면 "(1)의 필드 집합이
  펼쳐진다"라는 문장이 거짓이 된다(필드명이 다르므로).
- **제안**: (2)의 WS §4.1 지시문에 한 줄 caveat 추가 — 예: "필드 **의미**는 (1)과 동일하되 WS 는
  현재 `duration`(Ms 없음) 표기를 유지한다(개명은 별건 후속)". 이렇게 하면 §6.3/6.4/6.5 캐노니컬
  이름(`durationMs`)과 WS wire 표기(`duration`)가 **의도적으로 다르다**는 사실이 도입부 자체에
  드러나 향후 구현자가 어느 쪽을 emit 해야 하는지 헷갈리지 않는다. `3-execution.md §8.1` 축약 시도
  동일 caveat 필요(그 표도 `duration` 표기).

### [INFO] `nodeCount`(삭제 대상) 와 이미 구현된 동명 계열 식별자 — 충돌은 아니지만 인접

- **target 신규 식별자**: 없음(오히려 삭제) — target (1)표가 `nodeCount`(WS §4.1 의
  `execution.completed` 행)를 "삭제 — 엔진에 개념이 없다"로 명시.
- **기존 사용처**: `spec/2-navigation/14-execution-history.md:92,448` — `ExecutionDto` 의
  `totalNodeCount`/`completedNodeCount`/`failedNodeCount` (배치 집계, **구현됨**,
  `executions.service.ts` `nodeCountMap`). `spec/3-workflow-editor/4-ai-assistant.md:766` —
  UI 카피 placeholder `{nodeCount}` (별도 문맥, 실행 상세 안내 문구).
- **상세**: 식별자 문자열 자체는 다르므로(`nodeCount` vs `totalNodeCount` 등) 직접 충돌은 아니다.
  다만 삭제 사유("엔진에 개념이 없다")가 정확히는 "**단일 execution.completed 이벤트 payload**에
  없다"는 뜻이지 "시스템 어디에도 없다"는 뜻이 아니다 — 매우 근접한 개념(노드 개수 집계)이 REST
  `ExecutionDto` 경로에는 이미 실재한다. 후속(§6 도입부 최종 문구 작성 시)에서 "삭제"를 "이 이벤트
  payload 범위 밖(§9 REST 로 조회)"처럼 한정하면 향후 재도입 논의 시 오해를 줄인다.
- **제안**: 필수 수정 아님 — (1)표의 `nodeCount` 삭제 사유 각주에 "REST `GET /executions/:id` 의
  `nodeCount` 계열과는 별개(그쪽은 구현됨)"를 한 구절만 덧붙이면 충분.

## 나머지 5개 관점 — 충돌 없음 확인

- **요구사항 ID**: target 은 신규 `EIA-*`/`WS-*` 류 ID 를 발급하지 않는다(기존 CRITICAL 번호
  `14_18_42` 등은 review 세션 타임스탬프이지 spec ID 가 아님).
- **엔티티/타입명**: `EiaEvent`(코드 `chat-channel/types.ts:313` 의 `export type EiaEvent`)·
  `ChatChannelInternalEvent` 모두 이름 유지, 필드 열거만 참조로 축약 — 신규 타입명 없음.
- **API endpoint**: 신규 endpoint 없음. 기존 §5.x REST/SSE 경로 불변.
- **이벤트/메시지명**: `execution.completed`/`failed`/`cancelled` 그대로 재사용, 신규 이벤트명 없음.
- **환경변수·설정키**: 없음.
- **파일 경로**: 신규 spec 파일 생성 없음(기존 4개 파일 내부 수정). `## 6.`→`### 6.1` 사이에
  번호 없는 본문을 두는 패턴은 **동일 문서 `## 4. Trigger 등록 페이로드 확장`**(161-236행, `### 4.1`
  전에 코드블록·설명 문단이 이미 존재)에 선례가 있어 이 문서 자체의 기존 컨벤션과 충돌하지 않는다.

## 요약

target 은 신규 식별자를 만드는 문서가 아니라 기존에 4곳(EIA/WS/adapter/execution.md)에 흩어져
재서술되던 **같은 필드들을 한 곳으로 모으는** 재구성 작업이라, 요구사항 ID·엔티티·API·이벤트·
환경변수·파일 경로 6축 중 5축은 충돌 표면 자체가 없다. 유일한 실질 리스크는 EIA 쪽(및 대다수
spec)이 이미 `durationMs` 로 통일돼 있는데 WS §4.1/§8.1 요약표만 `duration` 을 쓰는 기존 분기가
있고, target 의 "필드 집합을 참조로 펼친다"는 지시가 이 이름 차이를 명시적으로 봉인하지 않아
구현 단계에서 조용히 개명되거나(비목표 위반) 참조 문장이 거짓이 될(이름 불일치) 소지가 있다는
점(WARNING 1건)이다. `nodeCount` 삭제는 인접 개념과 이름이 달라 직접 충돌은 아니다(INFO 1건).

## 위험도

LOW
