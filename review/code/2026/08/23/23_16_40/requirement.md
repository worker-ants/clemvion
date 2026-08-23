# 요구사항(Requirement) 충족 리뷰

## 검토 범위 및 방법
핵심 로직 변경(4파일: `node-output-allowlist.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`) +
`interaction.service.spec.ts` 캐너리 추가 + spec 문서 2건(`14-external-interaction-api.md` §R17,
`6-websocket-protocol.md` §4.4) + plan 문서 2건 + `CHANGELOG.md` 정정. 나머지(파일 9~29)는
직전 리뷰 라운드(`22_51_46`)와 consistency-check(`22_26_33`) 산출물이 그대로 diff 에 실린 것으로,
이번 라운드가 그 라운드의 WARNING 4건을 어떻게 반영했는지 대조하는 데 사용했다.

실측: `node-output-allowlist.ts` 전체 열람(allowlistNodeOutputKeys 의 null/array/object 분기),
`websocket.service.ts` 의 `allowlistFanoutNodeOutput`/`toFanoutEnvelope`/`attachRoutingContext`
전체 열람, `interaction.service.ts` 가 같은 `allowlistNodeOutputKeys` import 를 실제로 쓰는지 grep 확인,
`spec/5-system/15-chat-channel.md` 의 인용 SoT(§R-CC-17 (c) `renderPresentationByType` shape 처리
우선순위, line 703)가 실재하고 인용 취지(top-level flat 은 마지막 fallback)와 일치함을 대조.

## 발견사항

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md:119` — 취소선/재작성 처리
  중 markdown 볼드 마크가 어긋났다: `**wire-only ~~4키~~ **8키**가 ...**` 형태로 외부 `**` 가 닫히기
  전에 내부 `**8키**` 가 또 열려 렌더러에 따라 볼드 범위가 의도(전체 제목 굵게 + "8키"만 별도 강조)와
  다르게 보일 수 있다. 기능/spec 정합성과 무관한 plan 문서 서식 문제.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:119`
  - 제안: `**wire-only ~~4키~~8키가 ...**` 처럼 안쪽 `**` 를 제거하거나 별도 span 으로 분리. 차단 사유
    아님.

- **[INFO]** `allowlistFanoutNodeOutput`(top-level `nodeOutput`) 과 `bc.nodeOutput`(중첩) 두 분기가
  "narrow → 참조 비교 → 병합" 동일 idiom 을 반복하는 구조는 직전 라운드 maintainability 리뷰가 이미
  INFO 로 남기고 "3번째 소비 지점이 생기면 재검토" 조건을 명시했다(`22_51_46/maintainability.md`,
  RESOLUTION.md #7·#8 넘김). 이번 라운드에도 소비 지점은 여전히 2곳(top-level·`buttonConfig`)이라
  그 재개 조건이 아직 성립하지 않는다 — 재지적하지 않음, 조건 유지만 확인.

## 관점별 확인

1. **기능 완전성** — SSE/webhook/chat-channel fanout 이 공유하는 단일 chokepoint
   `WebsocketService.toFanoutEnvelope`(`websocket.service.ts:468`)에 `allowlistFanoutNodeOutput`
   을 배선해 top-level `nodeOutput` 과 `buttonConfig.nodeOutput` 두 자리 모두 REST `getStatus` 와
   동일한 fail-closed allowlist(`NODE_OUTPUT_ALLOWED_KEYS`, 13키)를 지나게 했다. `interaction.service.ts`
   와 `websocket.service.ts` 가 **같은 배열/함수**를 import 해 두 표면이 실제로 한 SoT 를 공유함을
   grep 으로 확인 — "REST 와 SSE 강도가 같다" 는 spec/CHANGELOG 서술과 코드가 일치한다.
2. **엣지 케이스** — `allowlistNodeOutputKeys`(`node-output-allowlist.ts:121`)는 `null`/비객체/배열을
   그대로 반환(변형 없음)하고, `allowlistFanoutNodeOutput` 은 `top`/`bc`/`inner` 각각에 대해
   `!== null && typeof === 'object'` 가드를 앞세워 `undefined`(폼/버튼 waiting 이 아닌 대다수 이벤트)
   에서 안전히 스킵한다. `buttonConfig` 는 있는데 `buttonConfig.nodeOutput` 이 없는 경우도 `inner`
   가 `undefined` 라 가드에 걸려 크래시하지 않는다. `__proto__` 오염 방지는 `delete` 사용으로 기존
   자매 유틸과 같은 방어를 유지(신규 테스트로 고정은 안 됐으나 `node-output-allowlist.spec.ts` 의
   기존 `__proto__` 캐너리가 같은 함수를 커버).
3. **TODO/FIXME** — 신규/변경 코드에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — `allowlistFanoutNodeOutput` 의 JSDoc("두 자리 모두 emit 하는 곳이
   여럿이지만 `toFanoutEnvelope` 이 유일한 외부 출구")과 실제 배선(`emitExecutionEvent`/
   `emitNodeEvent` 양쪽이 `toFanoutEnvelope` 를 호출)이 일치. "내부 WS 는 안 바뀐다" 주장도
   `broadcastToChannel(channel, eventType, wireEnvelope)` 가 `toFanoutEnvelope` 호출보다 **먼저**
   실행되고 `toFanoutEnvelope` 는 그 `wireEnvelope` 를 입력으로 새 파생을 만드는 순수 함수라는
   점에서 구조적으로 보장된다 — 캐너리 3건(`websocket.service.spec.ts`)이 이를 직접 단언.
5. **에러 시나리오** — 별도 예외 경로 없음(순수 동기 변환). `stripExternalOnlyFields` 실패/예외
   전파는 이 diff 범위 밖(기존 함수 재사용).
6. **데이터 유효성** — 입력 형태 검증은 `typeof`/`Array.isArray` 가드로 충분히 방어적. allowlist
   키 목록 자체의 컴파일타임 결속(`assertAllowlistCoversHandlerContract`)은 `NodeHandlerOutput`
   공개 5키만 덮고, 신규 8개 wire-전용 키(위젯 4 + chat-channel 4)는 리터럴 테스트가 유일한 방어라는
   점을 코드 주석·spec·plan 이 일관되게 명시 — 은폐 없음.
7. **비즈니스 로직** — EIA §R17 표(3갈래: 핸들러 공개키/위젯 wire/chat-channel wire)와
   `NODE_OUTPUT_ALLOWED_KEYS` JSDoc 표·배열 인라인 주석 3그룹이 **line-level 로 일치**
   (`payload`·`title`·`rendered`·`nodeType` 동일 4키, 동일 근거 서술). `spec/5-system/15-chat-channel.md`
   가 인용한 SoT(§R-CC-17 (c), line 703)를 직접 열람한 결과 "payload → output → config → flat" 우선
   순위 중 flat 이 최후 fallback 이라는 취지가 allowlist 4키 추가 근거와 정확히 부합한다(지어낸
   인용 아님).
8. **반환값** — `allowlistNodeOutputKeys`/`allowlistFanoutNodeOutput` 모두 모든 분기에서 값을
   반환(변경 없으면 원본 참조, 변경 있으면 새 객체) — 누락 경로 없음.
9. **spec fidelity** — `spec/5-system/14-external-interaction-api.md` §R17 표의 SSE/fanout 행이
   "deny-list 유지(잔여)" → "fail-closed allowlist(2026-08-23 추가)" 로 flip 되고 "REST 와 SSE 는
   같은 강도" 로 정정된 서술이 코드 구현과 정확히 일치. `spec/5-system/6-websocket-protocol.md` §4.4
   에 추가된 "`nodeOutput` 의 키 집합은 공유하지 않는다"(내부 WS 는 원문 유지, 외부 clone 만 좁힘)
   단서도 `toFanoutEnvelope` 의 실제 순서(broadcast 먼저 → 이후 파생)와 일치. 동명 필드
   disambiguation 각주(`nodeOutput.nodeType` vs `waitingNodeType`, `nodeOutput.payload` vs webhook
   봉투 `payload`)도 실제 소스(`button-interaction.service.ts`/`form-interaction.service.ts`)의
   필드 분리와 부합(직전 라운드 security.md 가 실측 확인, 이번 diff 에서 변경 없음 재확인).

## 직전 라운드(`22_51_46`) WARNING 4건 반영 여부 대조

- **W1 (REST 표면 확장 의도 고정)** → `interaction.service.spec.ts` 캐너리 추가로 반영 확인. 5키
  정렬 비교(`meta`/`nodeType`/`payload`/`rendered`/`title`)와 `_retryState` 미포함을 한 테스트가
  함께 단언 — 구현대로.
- **W2 (`buttonConfig` 분기 copy-on-change 미검증)** → `websocket.service.spec.ts` 신규 캐너리
  + 뮤테이션 M5 로 반영. `attachRoutingContext` 가 미등록 컨텍스트에 대해 원본 참조를 반환하는
  구조(실측)와 맞물려 `fanout.payload === wire`, `fanout.payload.buttonConfig === wire.buttonConfig`
  단언이 실제로 성립하는 경로임을 코드 대조로 확인.
- **W3 (CHANGELOG 거짓 서술)** → 취소선 + 정정 블록으로 반영. "9키→13키" 수치도 실제 배열
  (기존 9 + 신규 4 = 13)과 일치.
- **W4 (하위 호환 공지)** → CHANGELOG 정정 블록에 "외부 수신자에게는 동작 변경" 명시. 운영 로그
  감사는 "수행 불가"로 명시적으로 미이행 상태를 밝힘 — 은폐 없이 한계를 기록한 방식으로 수용 가능.

## 요약
`toFanoutEnvelope` 단일 chokepoint 에 `allowlistFanoutNodeOutput` 을 배선해 SSE/webhook/chat-channel
fanout 의 `nodeOutput`(top-level)·`buttonConfig.nodeOutput` 두 자리를 REST `getStatus` 와 동일한
fail-closed allowlist(공유 `NODE_OUTPUT_ALLOWED_KEYS`, 13키)로 좁힌 변경이다. 직전 리뷰 라운드가 지적한
WARNING 4건(REST 확장 의도 미고정, `buttonConfig` 분기 copy-on-change 미검증, CHANGELOG 거짓 서술,
하위 호환 공지 누락)이 이번 diff 에 전부 반영됐고, 각 반영이 실제 코드/테스트/spec 과 line-level 로
정합함을 독립적으로 재확인했다. 함수는 모든 입력 형태(null/array/object/undefined)에서 안전하게
분기하며 반환값 누락 경로가 없고, JSDoc 이 주장하는 설계 근거(단일 chokepoint, 내부 WS 불변,
copy-on-change)가 실제 호출 순서·코드 구조로 뒷받침된다. spec 문서(EIA §R17, WS §4.4) 는 코드와
정확히 동기화됐고, chat-channel wire 4키의 근거로 인용된 spec SoT(§R-CC-17 (c))도 실재하며 취지가
부합한다. 발견된 사항은 plan 문서 markdown 서식 오류 1건(INFO, 기능 무관)뿐이며 기능적 결함이나
spec 불일치는 발견되지 않았다.

## 위험도
NONE
