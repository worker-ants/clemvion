# 신규 식별자 충돌 검토 — `spec/5-system/` (SSE/fanout `nodeOutput` allowlist, impl-done)

## 컨텍스트 요약

이번 라운드(`23_29_27`, `--impl-done`)의 target 은 `spec/5-system/` 전체이며, 실제 diff(`origin/main...HEAD`)는 `14-external-interaction-api.md` §R17 과 `6-websocket-protocol.md` §4.4 wire caveat 두 곳만 건드린다. 구현 diff 는 `codebase/backend/src/shared/utils/node-output-allowlist.ts`(`NODE_OUTPUT_ALLOWED_KEYS` 에 wire 전용 4키 `payload`·`title`·`rendered`·`nodeType` 추가)와 `codebase/backend/src/modules/websocket/websocket.service.ts`(신규 private 함수 `allowlistFanoutNodeOutput`, `toFanoutEnvelope` 배선)다.

이 작업은 이미 같은 세션에서 두 라운드를 거쳤다 — consistency-check `22_26_33`(naming_collision 포함, WARNING 2건: W1 `nodeOutput.nodeType` vs `waitingNodeType`, W2 `nodeOutput.payload` vs webhook 봉투 `payload`)과 code-review `22_51_46`/`23_16_40`(2라운드, 최종 WARNING 0 수렴). 본 라운드는 그 위에서 **fresh 재검토**로, (a) 직전 W1·W2 가 실제로 해소됐는지 diff 로 재확인하고 (b) 이번 라운드에서 새로 편입된 식별자 중 아직 안 잡힌 충돌이 있는지를 본다.

## 발견사항

### [해소 확인] W1 `nodeOutput.nodeType` vs 외부-비노출 `waitingNodeType`/`node.type` — 반영됨

`spec/5-system/14-external-interaction-api.md` §R17 allowlist 절에 아래 disambiguation blockquote 가 실제로 추가돼 있다(diff 로 확인):

> `nodeOutput.nodeType` (카드 렌더 서브타입: `chart`/`table`/`carousel`, **외부 노출 대상**) 은 wire top-level `waitingNodeType`(= `node.type`, §6.2 가 *"외부 소비 매핑 없음"* 으로 못박은 WS 내부 부가 식별자)과 **다른 필드**다. 값 공간이 겹쳐 오독하기 쉬우나 담긴 객체가 다르다.

code-review `23_16_40` INFO #2 도 같은 결론(조치 불요)으로 독립 확인했다. **재지적 불필요.**

### [해소 확인] W2 `nodeOutput.payload` vs webhook 봉투 최상위 `payload` — 반영됨

같은 blockquote 에:

> `nodeOutput.payload` (핸들러가 만든 legacy 카드 렌더 데이터) 는 §6 이 정의하는 webhook 봉투 최상위 `payload` 와 **동일 키명이지만 중첩 레벨이 다른 별개 필드**다 — webhook wire 에서는 `<봉투>.payload.….nodeOutput.payload` 로 같은 이름이 두 층에 실린다.

**재지적 불필요.**

### [INFO] `nodeOutput.title`(신규 allowlist, chat-channel 카드 제목) vs `notification.new.title`(§4.4 알림 이벤트 payload 필드) — 동명이나 실질 충돌 아님

- **target 신규 식별자**: `NODE_OUTPUT_ALLOWED_KEYS` 에 추가된 wire 전용 키 `title`(= `nodeOutput.title`, telegram/discord/slack 렌더러가 carousel/table/chart 카드 제목으로 top-level 에서 읽음, `telegram-message.renderer.ts:204-205` 등).
- **기존 사용처**: 같은 target 문서 `spec/5-system/6-websocket-protocol.md` §4.4 "알림 이벤트" 표 — `notification.new` 이벤트 payload `{ id, type, title, message, resourceType, resourceId }` 의 `title` (알림 제목 문자열).
- **상세**: 두 `title` 은 서로 다른 이벤트(`execution.waiting_for_input`/`execution.node.completed` 의 `nodeOutput` 서브트리 vs `notification.new` 최상위)에 속한 별개 필드이며 런타임 키 충돌은 없다. 다만 "title" 은 매우 일반적인 UI 필드명이라, W1(`nodeType`)·W2(`payload`) 와 달리 같은 절/같은 표에서 정면으로 마주치지 않고(선언 위치가 §R17 대 §4.4 로 떨어져 있음) 값 도메인도 겹치지 않아(카드 제목 vs 알림 제목) 독자가 §R17 표만 보고 오독할 위험은 W1/W2 대비 낮다.
- **제안**: 조치 불요 — W1/W2 급의 disambiguation 각주를 추가할 필요는 없다고 판단한다(참고 기록 목적의 INFO). 향후 `notification.new` 도 `nodeOutput` 을 payload 로 실어야 하는 요구가 생기면(현재는 아님) 그때 재검토.

### [확인] 신규 함수명·상수명은 spec 이 이름으로 참조하지 않음 — 충돌 표면 없음

`allowlistFanoutNodeOutput`(신규 private 함수, `websocket.service.ts`)는 spec 본문이 함수명으로 직접 참조하지 않고 `allowlistNodeOutputKeys`/`toFanoutEnvelope` 만 인용한다. `NODE_OUTPUT_ALLOWED_KEYS` 자체도 기존 식별자(REST `getStatus` 라운드에서 이미 도입)의 원소 확장일 뿐 신규 상수가 아니다. 요구사항 ID·엔티티/DTO명·API endpoint·webhook/queue/SSE 이벤트명·ENV var·spec 파일 경로는 이번 diff 로 신규 도입된 것이 없다(§R17 은 기존 ID 유지, 신규 R-번호 없음; 신규 spec 파일 없음).

## 요약

target(`spec/5-system/`) 의 실제 변경분은 `14-external-interaction-api.md` §R17 과 `6-websocket-protocol.md` §4.4 caveat 두 곳이며, 이전 consistency-check(`22_26_33`)가 잡은 두 건(WARNING `nodeType`, `payload` 동명 충돌)은 이번 최종 diff 에서 명시적 disambiguation blockquote 로 반영·해소된 것을 직접 diff 로 재확인했다. 이번 라운드에서 새로 검토한 4번째 wire 전용 키(`title`)는 같은 target 문서(`6-websocket-protocol.md` §4.4 `notification.new.title`)와 동명이지만, 선언 위치·값 도메인이 갈려 있어 W1/W2 수준의 오독 위험은 없다고 판단해 INFO 로만 기록한다. 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로 층위에서 신규 충돌은 발견되지 않았다.

## 위험도

NONE
