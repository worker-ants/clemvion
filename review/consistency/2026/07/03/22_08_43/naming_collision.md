### 발견사항

이번 diff(`websocket.gateway.ts`/`.spec.ts`, `use-execution-events.ts`/`.test.ts`, `ws-client.ts`/`.test.ts`)는 `plan/in-progress/refactor/06-concurrency.md`의 잔여 배치(M-3/M-6/m-3/m-5)를 구현한 코드 전용 변경으로, `spec/5-system/6-websocket-protocol.md` 자체는 변경되지 않았다(`git diff origin/main...HEAD -- spec/` 결과 없음, target 문서 본문도 "(없음)"으로 표시됨). 즉 이번 변경은 **새로운 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로를 전혀 도입하지 않는다** — 신규 식별자 충돌 관점에서 점검할 대상 자체가 없다.

세부 확인:

- 이벤트명: diff 에서 사용/재사용된 이벤트는 `subscribed`, `unsubscribed`, `connect`, `disconnect`, `execution.*` 전부 기존 spec(`spec/5-system/6-websocket-protocol.md:134,138,153,894,957`)에 이미 정의된 이름 그대로다. 새 이벤트명 없음.
- 식별자 후보로 보였던 `M-3`/`M-6`/`m-3`/`m-5`는 요구사항 ID가 아니라 `plan/in-progress/refactor/06-concurrency.md`의 기존 내부 작업 추적 라벨(`plan/in-progress/refactor/README.md:25`에 이미 등재)이며, spec 요구사항 ID 네임스페이스(`NAV-*`, `ED-*`, `ND-*` 등)와 다른 별도 체계라 충돌 여지가 없다.
- 코드 레벨에서 새로 생긴 이름(`bind` 지역 헬퍼 함수 in `use-execution-events.ts`, mock socket 의 `active` 필드, `pending 가드` 주석)은 spec·타 도메인에서 사용 중인 공개 식별자와 겹치지 않는 파일-scoped 구현 디테일이다. `active` 는 socket.io 자체 프로퍼티를 그대로 참조한 것으로 신규 도입이 아니다.
- 새 파일 생성 없음 — 기존 파일 4개(`websocket.gateway.ts`, `use-execution-events.ts`, `ws-client.ts`와 대응 `.spec/.test.ts`)에 대한 수정뿐이라 파일 경로 컨벤션 충돌도 해당 없음.

해당 없음 — CRITICAL/WARNING/INFO 발견 없음.

### 요약
target 문서(`spec/5-system/6-websocket-protocol.md`)는 이번 diff 로 변경되지 않았고, 구현 변경 자체도 기존 WebSocket 이벤트·엔드포인트 이름을 그대로 재사용하는 동시성 하드닝(join/leave await+롤백, 이중 리스너 등록 방어, connect pending 가드, dismiss hysteresis)일 뿐 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV var·spec 파일을 도입하지 않는다. 따라서 신규 식별자 충돌 관점에서 검토할 표면적이 없으며 충돌 위험도 없다.

### 위험도
NONE
