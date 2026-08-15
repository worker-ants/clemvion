# 요구사항(Requirement) 리뷰 — `22_13_48`

## 검토 방법

`origin/main...HEAD` 누적 diff(124개 항목)를 프롬프트로 받았으나, 실질 코드 변경은
`codebase/backend/src/**` 27개 파일(대부분 `websocket.service` → `websocket-events.types`
import 경로 재배선)과 `spec/5-system/6-websocket-protocol.md` frontmatter 1줄뿐이다. 나머지
95개 이상은 이 작업(`ws-event-types-extract`)이 거친 6라운드 `/ai-review` + 2라운드
`consistency-check` 산출물과 `plan/in-progress/**` 갱신이다.

프롬프트 diff 게이트가 아니라 실제 소스를 `Read`/`Grep`/`git diff origin/main...HEAD`로 직접
대조했고, 회귀 가드 테스트(`websocket-events.types.spec.ts`)와 관련 spec 을 직접 실행/열람했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전문 — 새 의존성-프리 모듈의
  값/타입 선언이 `websocket.service.ts`의 삭제분(`git diff` 대조)과 내용상 동일함(디스앰비규에이션
  JSDoc 1건 추가 외 신규 필드 변경 없음)을 확인.
- `codebase/backend/src/modules/websocket/websocket.service.ts` 전문 — re-export 블록(값 4 +
  타입 8)이 `websocket-events.types.ts`의 실제 export 12개와 1:1 대응, 구현부
  (`CREDENTIAL_KEY_PATTERN`/`sanitizePayloadForWs`/`SANITIZE_CACHE`)는 그대로 남아 있음을 확인.
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` —
  `TERMINAL_SHAPE`가 함수-지역 리터럴에서 모듈 스코프 `as const` 상수로 승격됐을 뿐, 참조 값·
  분기 로직(§6/§6.5 `wire.error`/`wire.result.cancelledBy` 조립)은 문자 그대로 보존.
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전문 — 6라운드에 걸친
  가드 자체 결함(FN×4, FP×1)이 이번 라운드가 보는 최종 상태(`importLeavesValueEdge`/
  `exportLeavesValueEdge`의 `ImportClause`/`export…from` 형태 전수 소진)에 실제로 반영됐는지
  코드로 직접 확인.
- `grep -rln`으로 전체 `codebase/backend/src`를 훑어 `ExecutionEventType`/`NodeEventType`/
  `BackgroundRunEventType`/`NotificationEventType`/`KbEventType`/`ExecutionChannelEvent` 등
  값·타입을 참조하면서 여전히 `websocket.service`를 import 경로로 쓰는 파일이 있는지 전수
  대조 — 남은 참조는 전부 `WebsocketService` 클래스(DI 주입) import뿐임을 확인(누락 0).
- `npx jest websocket-events.types.spec.ts`(6/6 PASS), `execution-event-emitter.service.spec.ts` +
  `websocket.service.spec.ts`(51/51 PASS)를 직접 실행해 RESOLUTION.md의 검증 주장을 재현.

## 발견사항

없음 — Critical/Warning 급 요구사항 결함을 찾지 못했다.

이 작업은 6라운드 `/ai-review`를 거치며 라운드 1(`19_27_37`)에서 발견된 유일한 제품 코드 결함
(`websocket.gateway.ts`가 순환 이탈에서 누락)이 즉시 수정된 뒤, 이후 5라운드는 전부 회귀 가드
테스트 자신의 FN/FP(정적 분석 커버리지 결함)였고 모두 반영·역재현·뮤테이션으로 검증됐다. 본
라운드에서 직접 소스·테스트를 재실행해 그 반영 상태가 실제로 최종 커밋(`eeaf9c3ba`)에
존재함을 재확인했으며, 이번 라운드가 보는 새 델타(`b5ef57c3a` → `eeaf9c3ba`) 안에서 새로운
요구사항/spec-fidelity 결함을 발견하지 못했다.

## 그 외 확인 — 참고용 (Critical/Warning 아님)

- **[INFO]** `plan/in-progress/ws-event-types-extract.md`의 "후속(이 PR 범위 밖)" 섹션에 등재된
  6곳의 spec 정본 위치 stale 서술(`10-graph-rag.md:552` 등)은 developer 권한(`spec/` read-only)
  밖이라 이번 diff 에서 손대지 않은 것이 맞다 — CLAUDE.md 규약대로 project-planner 턴으로
  넘겨야 하는 항목이며, 이번 코드 변경의 결함이 아니다.
  - 위치: `plan/in-progress/ws-event-types-extract.md` "후속" 섹션
  - 제안: 조치 불요(정책상 올바른 처리). planner 턴에서 spec 반영 예정임을 계속 추적.

- **[INFO]** `spec/5-system/6-websocket-protocol.md`의 frontmatter `code:` 목록에
  `websocket-events.types.ts` 1줄만 추가되고 본문(§4.4 필드 정의 등)은 무변경 — 이는 타당하다.
  이번 리팩터가 이벤트 payload 필드·이벤트명·행동 계약을 전혀 바꾸지 않았기 때문에(순수 모듈
  분리) spec 본문 갱신 대상이 아니며 `spec_impact: none` 선언과 무모순이다.
  - 위치: `spec/5-system/6-websocket-protocol.md:9` (frontmatter `code:`)
  - 제안: 조치 불요.

## 요약

이번 diff의 실질 코드 변경은 `websocket.service.ts`가 안고 있던 런타임 값(enum)·타입 선언을
의존성-프리 모듈(`websocket-events.types.ts`)로 추출하고 26개 소비 지점의 import 경로를
재배선한 **순수 리팩터**이며, 유일한 로직 변경(`TERMINAL_SHAPE` 모듈 스코프 승격)도 계산 결과가
기존과 동일함을 직접 소스 대조와 테스트 실행으로 확인했다. `spec/5-system/6-websocket-protocol.md`
§4.4가 정의하는 이벤트명·payload 필드·행동 계약은 이동 과정에서 문자 그대로 보존되어 있고,
`grep` 전수 검사로 마이그레이션 누락(값 심볼을 여전히 옛 경로에서 import하는 곳)이 없음을
확인했다. 6라운드에 걸쳐 발견된 결함 대부분은 이번 diff의 회귀 가드 테스트 자신의 판정 정확도
(FN/FP)였고 — 제품 코드가 아니라 방어 도구의 정교화 과정 — 그 최종 반영 상태를 이번 라운드가
직접 재실행/재대조해 확인했다. 요구사항·spec-fidelity 관점에서 병합을 막을 사유는 없다.

## 위험도

NONE
