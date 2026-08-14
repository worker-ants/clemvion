# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

`origin/main...HEAD` diff 는 `spec/**` 를 전혀 건드리지 않는다. 실제 코드 변경은
`codebase/backend/src/modules/websocket/websocket.service.ts`(+ 그 spec 테스트) 단
한 곳 — `stripExternalOnlyFields`/`stripDeep` 를 depth-1 shallow delete 에서 **깊이
무관 strip** 으로 교체한 보안 수정이다(커밋 `81f2c60d6`·`5df89cda6`). `plan/in-progress/
eia-terminal-payload.md` 가 선언한 `error`/`durationMs`/`result.outputs` 작업은 여전히
`--impl-prep BLOCK: YES` 로 막혀 **코드에 반영되지 않았음**을 `git diff --stat -- 'codebase/**'`
로 확인했다 — 그 plan 의 범위는 이번 diff 와 무관.

## 교차 검증 내용

`stripExternalOnlyFields` 의 JSDoc 이 SoT 로 지목하는 3개 spec 지점을 모두 직접 열어
대조했다:

1. **`spec/5-system/6-websocket-protocol.md` §4.4** (`llmCalls[]` 필드 표 하단 노트,
   L519) — "**모든** 외부 fanout 수신자 — SSE·webhook·chat-channel — 에서는 strip 된다"
   고 선언하며 깊이를 특정하지 않는다. 종전 구현(top-level 전용)은 이 선언을 어기고
   있었고(§Rationale L1056-1562 "strip-only 결정"), 이번 수정이 선언과 구현을 **일치**시켰다.
2. **`spec/5-system/14-external-interaction-api.md` §6.5** (L754) — "debug 전용 `llmCalls`
   필드는 … fanout seam 에서 제거되어 외부 수신자(본 SSE 스트림 포함)에는 전달되지 않는다"
   — 동일 선언, 동일 방향.
3. **`spec/5-system/15-chat-channel.md` CCH-MP-01** (L76) — "debug 전용 `llmCalls` 필드는
   … fanout seam 에서 strip 되어 어댑터(`ChatChannelDispatcher`)에 도달하지 않는다" — 동일.

세 문서 모두 "필드명 기준 전면 제거"를 요구할 뿐 depth-1 한정을 요구하지 않으므로, 이번
구현 변경(이름 매칭 + 재귀 순회)은 세 문서와 **모순되지 않고 오히려 기존 불일치(코드가
spec 보다 좁게 strip)를 해소**한다.

내부/외부 채널 분리도 spec 문구("인증된 내부 WS 채널에만 포함")와 일치함을 코드로 확인했다
(`websocket.service.ts:561-571`, `:627-642`) — `wireEnvelope` 는 `gateway.broadcastToChannel`
로 그대로(strip 없이) 내부 WS 에 나가고, `stripExternalOnlyFields(wireEnvelope)` 결과만
`executionEventSubject`(SSE/webhook/chat-channel fanout 의 공용 소스)로 흘러간다.

DB 영속 경로(`NodeExecution.output_data.meta.turnDebug[i].llmCalls`)는 이번 strip 대상이
아니며, WS §4.4 L519 의 "strip 대상은 본 WS 이벤트 필드뿐이며 DB 영속 경로는 영향 없음"
과도 일치한다 — `stripExternalOnlyFields` 는 emit 직전 wire envelope 사본에만 적용되고
DB 저장 경로는 별도.

`4-nodes/3-ai/*`·`conventions/conversation-thread.md` 등 AI 노드/에디터 표면 쪽 spec 의
`llmCalls` 서술(전부 편집기·영속 관점, L105/L354 등)도 "형제 필드 `llmCalls` 는 debug 탭
전용"이라는 동일한 경계를 반복할 뿐이며 이번 변경과 충돌하지 않는다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 해당 사항 없음. 이번 diff 는 신규 spec 서술을 도입하지
않고(§ spec/** 무변경), 이미 3개 spec 문서가 공유하던 "필드명 기준 strip" 계약을 구현이
비로소 충족시킨 보안 수정이라 cross-spec 관점에서 정합성을 오히려 강화한다.

> 참고(범위 밖): `stripDeep` 에 추가된 `Object.defineProperty` 기반 `__proto__` 방어가
> 형제 함수 `sanitizeInner`(동일 파일, credential 마스킹)에는 적용되지 않았다. 다만
> `sanitizeInner` 도 `{ ...obj }` 스프레드로 결과 객체를 만들어 동일한 "own 데이터 속성이
> 상속 접근자를 가린다" 방어를 이미 갖고 있어(스프레드가 `__proto__` 를 own literal 로
> 복사) 오염 경로 자체가 없다 — 이는 spec/** 서술과 무관한 코드 내부 방어-심층화 비대칭이라
> code-review(security) 영역이지 cross-spec 영역이 아니다. 참고용으로만 남긴다.

## 요약

이번 diff 는 `spec/5-system/` 자체를 변경하지 않고, 이미 3개 spec 문서(WS §4.4·EIA
§6.5·chat-channel CCH-MP-01)가 공유하던 "llmCalls 는 이름 기준으로 모든 외부 fanout 에서
strip" 계약을 구현이 처음으로 온전히 충족시킨 보안 수정이다. 세 문서를 직접 대조한 결과
어떤 모순도 없고, 내부/외부 채널 분리·DB 영속 불변 등 spec 이 명시한 세부 조건도 코드에서
그대로 확인된다. Cross-spec 관점에서 이번 변경으로 인한 새로운 충돌·중복 정의는 없다.

## 위험도

NONE
