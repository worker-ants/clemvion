# 요구사항(Requirement) 리뷰 — ws-event-types-extract (fa1bca013 시점)

## 검토 방법

`git diff origin/main...HEAD --stat` (38개 파일)와 프롬프트 unified diff 를 대조하고, 프롬프트가
크기 제한으로 diff 를 생략한 핵심 파일(`websocket-events.types.ts`·`websocket.service.ts`·
`websocket-events.types.spec.ts`)은 `Read` 로 직접 열어 전문을 확인했다. `websocket.service.ts`
의 이동 전 원본은 `git show origin/main:...` 로 대조해 값·주석이 byte-identical 하게 옮겨졌는지
검증했다. 대조 대상 plan: `plan/in-progress/ws-event-types-extract.md`
(`spec_impact: none`) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`.

이 PR 은 이미 4라운드 `/ai-review`(19_27_37 → 20_05_17 → 20_27_08 → 20_50_49)를 거쳐 각 라운드
지적을 해소한 상태다. 아래는 그 이력 위에서 **새로 발견한 항목만** 보고한다 — 이미 처분된 항목
(gateway.ts 전환, require() 검출, 별칭 판정, 타입 표시 누락, "타입 9"→"타입 8" 정정 등)은 실제
코드에서 전부 반영을 재확인했고 재론하지 않는다.

## 발견사항

- **[WARNING]** 신설 회귀 가드가 "개별 `type` 태그를 단 named import" 전량을 `websocket.service` 로부터의 값(value) 간선으로 오탐할 수 있다 (per-specifier type-only 정보가 소실되는 경로)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:131` (`names` 계산 — `filter((el) => !el.isTypeOnly)` 로 개별 타입 전용 specifier 를 걸러낸다), `:138` (`value: !clause?.isTypeOnly` — **선언 전체**의 `isTypeOnly` 만 본다, 개별 specifier 는 반영 안 됨), `:272` (`if (!r.names.length) return true; // side-effect / default / '* as'` — names 가 빈 이유가 "정말 이름이 없어서"인지 "전부 개별 type 태그라 걸러져서"인지 구분하지 않음)
  - 상세: `import { type Foo } from '../websocket/websocket.service';` 처럼 유일한 named specifier 에 인라인 `type` 을 붙인 형태를 실제 TS 파서로 프로브했다 (`ts.createSourceFile` 로 직접 파싱, 결과: `{"declClauseTypeOnly":false,"value":true,"names":[]}`). `clause.isTypeOnly` 는 `export type {...}`/`import type {...}` **선언 전체** 형태만 참이 되고, 개별 specifier 의 `type` 태그는 `names` 계산에서만 반영되고 `value` 계산엔 반영되지 않는다. 그 결과 `names=[]` 가 되는데, 3번째 테스트("`websocket.service` 로의 eager 값 간선이 없다")는 `r.form !== 'import'` 만 통과하면(즉 import 형태면) `!r.names.length` 를 "side-effect/default/`* as`" 로 간주해 **무조건 offender 로 판정**한다(`:272`). 그런데 이 시나리오는 TS 컴파일 시 완전히 소거되는(runtime edge 가 0인) 순수 타입 참조이므로, 이 가드 자신이 명시한 판별 기준("모듈 평가 시점에 아직 안 채워진 값을 읽는 것")상 결함이 아니다. 즉 **정확히 태그된 올바른 코드가 CI 를 깬다** — 5번째 테스트("타입 전용 심볼을 `type` 표시 없이 import 하는 곳이 없다")가 권장하는 바로 그 스타일(inline `type` 태그)을 단일 specifier 로 쓰면 3번째 테스트가 충돌하는 자기모순이다. 오늘 코드베이스엔 이 형태가 없어 당장 CI 를 깨지는 않지만(실측: `grep` 으로 `websocket.service` 로부터의 모든 import 확인, 해당 패턴 없음), 이미 4라운드에 걸쳐 "형태를 하나씩 놓치는" 실패가 반복된 이 파일에서 반대 방향(과다 탐지·false positive)의 미검증 경계다. M1~M18/N1~N5 뮤테이션 표 어디에도 "단일 specifier 전부가 개별 `type` 태그인 import" 케이스는 없다.
  - 제안: `value` 계산을 선언 레벨이 아니라 실제 값으로 남는 specifier 유무로 정정한다. 예: `import` 분기에서 `value: !clause?.isTypeOnly && (!bindings || (ts.isNamedImports(bindings) ? bindings.elements.length === 0 || bindings.elements.some(el => !el.isTypeOnly) : true))` 처럼 "네임드 바인딩이 없거나(namespace/default/side-effect) 하나라도 값으로 남는 specifier 가 있다"로 재정의하거나, `ModuleRef` 에 `namedBindingsPresent: boolean` 같은 별도 플래그를 둬 `:272` 의 "이름 없음" 분기가 "정말 바인딩이 없음"과 "전부 타입이라 걸렀음"을 구분하게 한다. `export … from` 분기(`:151-157`)도 동일 패턴이라 함께 수정 필요.

## 그 외 확인한 항목 (신규 결함 없음)

- 값/타입 선언(enum·interface·type) 은 `websocket.service.ts`(이동 전, `git show origin/main:...`)와 `websocket-events.types.ts`(이동 후)를 라인 단위로 대조해 값·JSDoc 이 byte-identical 함을 확인했다(유일한 의도적 추가는 `NotificationEventType` disambiguation JSDoc, plan `18_53_27` naming W3 로 사전 계획됨). Wire 이벤트명 문자열(`execution.completed` 등)·필드 타입·optional 여부 전부 불변.
- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 승격은 함수-지역 리터럴에서 값만 그대로 끌어올린 것으로, 파생 로직(`emitTerminalExecution`)의 `wire` 조립 — `error`/`result.cancelledBy` 분기, user cancel 시 `error` 키 부재 등 — 은 diff 전후 동일. spec SoT(`spec/5-system/14-external-interaction-api.md` §6/§6.5) 대비 필드 계약 변경 없음.
- `websocket.gateway.ts` 는 이번 fa1bca013 직전 커밋(65da1a9d7)에서 이미 `websocket-events.types` 직접 import 로 전환 완료(이전 라운드 architecture WARNING 해소 재확인, 라인 `websocket.gateway.ts:23`).
- 22개 순수 import-path 치환 파일(chat-channel dispatcher, ai-turn-orchestrator, button/form-interaction, execution-engine.service, background-execution.processor, retry-turn, interaction-stream/sse-adapter/notification-fanout, embedding/graph-extraction, ai-turn-executor 등)은 전부 1:1 기계적 치환이며 로직 변경 없음. TODO/FIXME/HACK/XXX 주석 grep 결과 diff 전체에서 0건.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 `websocket-events.types.ts` 1줄 추가 — spec 본문 변경 없음, `spec_impact: none` 과 무모순.
- plan 체크리스트의 미완료 항목(`fresh /ai-review`, `--impl-done`, `push 게이트`)은 본 리뷰 자체가 그 "fresh /ai-review" 수행 중이므로 결함이 아니라 정상 진행 상태다.

## 요약

38개 변경 파일 중 프로덕션 동작에 영향을 주는 것은 사실상 `execution-event-emitter.service.ts`
한 곳(모듈 스코프 상수 복원, plan 이 사전 계획한 성공 기준)뿐이고 나머지는 import 경로의 기계적
재배선이다. 이동 전후 값·타입 선언을 라인 단위로 대조한 결과 wire 계약·spec 필드 정의에 변경이
없음을 확인했다. 이번 라운드에서 새로 찾은 유일한 항목은 신설 회귀 가드
(`websocket-events.types.spec.ts`) 자체의 좁은 논리 결함이다 — 선언 레벨 `isTypeOnly` 만 보고
개별 specifier 의 인라인 `type` 태그를 반영하지 않아, "단일 named specifier 를 개별 `type` 태그로
가져오는" 올바른 코드를 값 간선으로 오탐할 수 있다(TS 파서로 직접 프로브해 재현). 오늘 코드베이스엔
해당 패턴이 없어 당장 깨지지 않지만, 이 가드가 이미 4라운드에 걸쳐 "식별 형태를 한 칸 좁게 잡는"
실패를 반복한 파일이라는 점에서 반대 방향(과다탐지)의 미검증 경계로 기록해 둔다. Critical 은 없다.

## 위험도

LOW
