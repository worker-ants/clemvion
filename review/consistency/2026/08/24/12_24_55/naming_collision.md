# 신규 식별자 충돌 검토 — node-output-envelope (spec/conventions/)

## 검토 범위 확인

`--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`. 프롬프트에 번들된
`spec/conventions/` 전체(대부분 "컨텍스트 예산 초과"로 절단)를 신뢰하지 않고,
`git diff origin/main...HEAD --stat -- spec/conventions/` 로 실제 변경 파일을 먼저 확정한 뒤
diff 전문을 직접 대조했다:

- `spec/conventions/chat-channel-adapter.md` (+13/-2)
- `spec/conventions/conversation-thread.md` (+1/-1)

(참고용 인접 diff — scope 밖이나 상호참조 검증에 사용: `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/15-chat-channel.md`, `spec/5-system/6-websocket-protocol.md`,
`codebase/backend/src/modules/websocket/websocket.service.ts`)

이 PR 은 **기존에 이미 정의돼 있던 wire 필드 `output`(= `NodeExecution.outputData` /
`NodeHandlerOutput` 래퍼)에 대한 주석·spec 서술 정정**이다 — `#1208`(sse-nodeoutput-allowlist)
에서 developer 자신이 남긴 유예 근거("`envelope.output` 은 이종 payload 라 같은 목록을
걸 수 없다")를 실 DB 조회로 반증하고, CLAUDE.md §자기-반증형 소정정 절차(취소선 보존 +
정정 블록)로 고친 것. 완전히 새로운 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec
파일을 도입하지 않는다.

## 점검 결과 (관점별)

### 1. 요구사항 ID 충돌
없음. 새 `R-*`/`CCA-*`/`CCH-*` ID 발번 없음 — diff 는 기존 `CCH-MP-06` 행(§3 표)과
§1.3 `ChatChannelInternalEvent` JSDoc 의 **본문 서술만** 정정한다. `git grep -n "R-CCA-9"`
등 신규 rationale ID 후보로 grep 했으나 diff 안에 없음(기존 `R-CCA-1~8` 그대로).

### 2. 엔티티/타입명 충돌
새 interface/DTO 없음. diff 가 인용하는 식별자(`NodeHandlerOutput`, `NodeExecution.outputData`,
`extractRendered`, `nodeOutputCache`)는 전부 diff 이전부터 코드에 존재하던 것을 정확히
재인용한 것이다. 실측:

```
codebase/backend/src/modules/chat-channel/providers/{discord,slack,telegram}-message.renderer.ts
  → extractRendered() 기존 함수, rendered → payload.rendered → output.rendered 3후보 순회
codebase/backend/src/modules/execution-engine/context/execution-context.service.ts
  → nodeOutputCache 기존 필드
codebase/backend/src/modules/nodes/core/node-handler.interface.ts (참조처 다수)
  → NodeHandlerOutput 기존 타입
```

새로 만든 이름 없음 → 충돌 대상 자체가 없음.

**참고 (INFO, 조치 불요)** — 표기 `output.output.<field>` 자체는 `spec/conventions/node-output.md`
§Principle 8.1 이 명시적으로 **금지 패턴**으로 등재한 `output.output.extracted.*`
(현재 `information_extractor`, 핸들러 반환값 내부의 불필요한 이중 중첩) 와 토큰 형태가
겹친다. 다만 두 문서가 가리키는 층위가 다르다:
  - node-output.md Principle 8.1: **핸들러가 스스로 구성하는** `NodeHandlerOutput.output`
    필드 *내부*에 또 다른 `output` 키를 넣는 것 (동일 층위 내 이중 중첩) — 안티패턴.
  - chat-channel-adapter.md (본 diff): **WS wire envelope** 의 최상위 `output` 필드가
    `NodeHandlerOutput` 래퍼 전체이고, 그 밑의 `.output` 이 도메인 값 — 서로 다른 층위
    (envelope layer vs domain layer) 간의 정상적인 경로 표기.
  둘 다 diff 자신이 JSDoc·표 셀에서 "래퍼 전체" vs "도메인 값" 을 명시적으로 구분해
  설명하고 있어(§1.3 JSDoc, §3 표 셀), 실제 혼동 위험은 낮다. 다만 `output.output` 이라는
  동일 리터럴이 "금지 패턴"(node-output.md) 과 "정상 wire 경로"(chat-channel-adapter.md)
  양쪽에 등장하므로, 향후 두 문서를 grep 만으로 대조하는 독자는 헷갈릴 수 있다 — 상호
  참조 각주(예: "이 `output.output` 은 Principle 8.1 의 핸들러-내부 이중중첩과 다른 층위"
  1문장)를 chat-channel-adapter.md §1.3 JSDoc 에 추가하면 더 명확해지지만, 현재도 문맥상
  충분히 구분되어 CRITICAL/WARNING 사유는 아니다.

### 3. API endpoint 충돌
없음. REST/WS endpoint 신설·변경 없음.

### 4. 이벤트/메시지명 충돌
없음. `execution.node.completed`(§1.3 `ChatChannelInternalEvent`, §3 표)는 diff 이전부터
존재하던 chat-channel-internal 이벤트명 그대로. EIA §6.1 outbound 5종 화이트리스트도
diff 대상 두 파일 안에서 변경 언급 없음(§3 표 헤더 서술 유지).

### 5. 환경변수·설정키 충돌
없음. 두 diff 파일 안에 `process.env`/ENV var/config key 신규 언급 없음.

### 6. 파일 경로 충돌
없음. `git diff origin/main...HEAD --name-status -- spec/` 확인 결과 두 파일 모두 상태
`M`(수정)이며 신규(`A`) spec 파일 생성 없음. 파일명·경로 자체의 변경도 없음(같은 경로에서
본문만 수정).

### 상호 참조 정합성 (부가 확인)

- `spec/conventions/conversation-thread.md` 의 정정문이 인용하는 "EIA §R17 재정정 블록"은
  `spec/5-system/14-external-interaction-api.md:1765~1798`("2026-08-24 해소 — 아래
  재정정", "재정정 (2026-08-24)")에 실제로 존재 — dangling 참조 아님.
- `spec/conventions/chat-channel-adapter.md` 의 `output.output.rendered` 표기는
  `spec/5-system/15-chat-channel.md:81`(CCH-MP-06)과 이미 동일 표현으로 정합화되어
  있음(양쪽 다 `output.output.rendered` + "래퍼 전체" 설명) — 형제 문서 간 표현 불일치 없음.

## 요약

이번 target(diff: `chat-channel-adapter.md` +13/-2, `conversation-thread.md` +1/-1)은
새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일 경로를 전혀 도입하지
않는다. `#1208`이 남긴 유예 근거(실측으로 반증됨)를 CLAUDE.md 자기-반증형 소정정 절차에
따라 정정하는 문서 전용 변경이며, 재인용하는 식별자(`NodeHandlerOutput`, `nodeOutputCache`,
`extractRendered`)는 모두 diff 이전부터 코드에 실재하던 것을 정확히 가리킨다. 유일하게
기록할 가치가 있는 점은 `output.output` 표기가 `node-output.md` Principle 8.1의 금지
패턴과 토큰이 겹친다는 것이나, 두 문서 모두 층위(핸들러 내부 이중중첩 vs wire envelope
래퍼/도메인 구분)를 이미 자체 설명하고 있어 CRITICAL/WARNING 급 충돌로 보지 않는다
(INFO). 직전 라운드(`review/consistency/2026/08/24/12_13_36/naming_collision.md`, 동일
scope·동일 diff)의 결론(NONE)과도 일치한다.

## 위험도

NONE
