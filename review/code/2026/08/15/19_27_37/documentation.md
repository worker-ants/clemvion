# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `NotificationEventType` 위에 JSDoc 블록이 두 개 연속으로 쌓여 첫 블록이 고아(orphaned) 문서가 된다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-220`
  - 상세: gate 209-212 (`사용자 알림 도메인 이벤트. 채널: notifications:<userId>. 권위 정의: spec/5-system/6-websocket-protocol.md §4.4`)와 gate 213-219 (이번 PR 에서 naming_collision WARNING #3 대응으로 새로 추가한 disambiguation 주석 — "인앱 알림 벨 전용... `18_53_27` naming W3")가 사이에 코드 한 줄 없이 연속으로 `export enum NotificationEventType`(gate 220) 위에 쌓여 있다. TS/TSDoc 은 선언에 바로 붙는 **가장 가까운** 블록 하나만 그 선언의 doc comment 로 인식한다 — 즉 gate 213-219 만 `NotificationEventType` 의 문서로 남고, gate 209-212(채널명·권위 spec 출처)는 IDE hover·TypeDoc 등 어떤 tooling 에서도 노출되지 않는 죽은 문서가 된다.
    이는 바로 이 파일·같은 diff 안에서 스스로 경고하고 있는 결함 클래스와 동일하다 — `websocket.service.ts:126-127` 의 주석이 정확히 "블록 JSDoc 으로 두었더니 붙을 선언이 없어 바로 아래 KB union 문서로 읽혔다 (`14_55_29` maintainability W4)" 라고 명시한다. 그 교훈이 209 줄 떨어진 같은 파일에서 재발했다.
  - 제안: 두 블록을 하나의 JSDoc 으로 병합한다 (채널/권위 출처 설명 + disambiguation 경고를 한 블록 안에 문단으로 구성). 별도 설명이 필요하면 `//` 라인 주석으로 분리하고 `/** */` 는 선언 바로 위 하나만 남긴다.

- **[WARNING]** WARN #10(credential 마스킹) JSDoc 블록이 선언 없이 떠 있다 — 직전에 고쳤던 정확히 같은 버그의 재발
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:239-246` (바로 아래 `export type KbEventType`은 gate 248-264)
  - 상세: gate 239-246 은 `sanitizePayloadForWs`/`CREDENTIAL_KEY_PATTERN` 의 credential 마스킹 동작(WARN #10, Security)을 설명하는 JSDoc 블록인데, 그 구현 자체(`sanitizePayloadForWs`, `CREDENTIAL_KEY_PATTERN`)는 이 파일에 없다 — 이 파일은 "값·타입 정의 전용, 의존성 0" 모듈이고, 구현 세부는 의도적으로 `websocket.service.ts` 에 남겼다("아래는 **구현 세부**다 — 타입 모듈이 아니라 이 파일에 남는다", 동일 diff `websocket.service.ts:48-50` 주석). 그 결과 이 블록은 어떤 선언에도 진짜로 속하지 않은 채 `KbEventType`(gate 248-264) 바로 위에 얹혀 tooling 상 `KbEventType` 의 문서로 오인식된다.
    바로 같은 diff 의 `websocket.service.ts:121-127` 에 남아 있는 주석이 이 정확한 패턴("WARN #10 을 block JSDoc 으로 두면 붙을 선언이 없어 바로 아래 KB union 문서로 읽힌다")을 지적하며 그래서 그 파일에서는 `//` 라인 주석으로 바꿔 뒀다고 설명한다. 그런데 `KbEventType` 을 새 파일로 옮기면서 WARN #10 블록을 (line-comment 로 변환된 버전이 아니라) 예전 `/** */` 블록 형태 그대로 새 파일에 복사해 넣은 것으로 보인다 — 고쳤던 버그가 새 파일에서 그대로 되살아났다.
  - 제안: WARN #10 노트는 실제 구현(`sanitizePayloadForWs`)이 있는 `websocket.service.ts` 에만 두거나(이미 121-127 에 line-comment 형태로 존재), 이 파일에 남기려면 `//` 라인 주석으로 바꿔 `KbEventType` 의 JSDoc 과 분리한다.

- **[INFO]** `websocket.service.ts` 의 stale-context 주석 — "바로 아래 KB union 문서" 가 더는 이 파일에 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:121-127`
  - 상세: 이 주석("여기 두지 않는 이유... 블록 JSDoc 으로 두었더니 붙을 선언이 없어 **바로 아래 KB union 문서로 읽혔다**")은 `14_55_29` 라운드에서 WARN #10 을 line-comment 로 바꾼 이유를 설명하는데, 그 근거였던 "바로 아래 KB union 문서"(`KbEventType`)가 이번 PR 로 `websocket-events.types.ts` 로 완전히 이동해 이 파일에서 사라졌다. 지금 이 주석 바로 아래엔 `TERMINAL_EXECUTION_EVENTS` 문서가 온다 — 이력적 근거로는 여전히 유효하지만, 새로 읽는 개발자가 "바로 아래 KB union 문서"를 찾다가 못 찾아 혼동할 수 있다.
  - 제안: 급하지 않음(차단 사유 아님). 후속 정리 시 "바로 아래 KB union 문서" 대신 "이 클래스의 다른 export 문서"처럼 파일-불변적 표현으로 다듬거나, 위 두 WARNING 항목을 고치는 김에 함께 정리.

## 그 외 확인 — 문제 없음

- 신설 모듈 `websocket-events.types.ts` 의 모듈 헤더 JSDoc(gate 1-21)은 분리 이유(#1174 회귀, ES-module 순환, 72 suites 붕괴, 캐너리 설계)를 구체적 근거와 함께 명확히 서술하고, `4-execution-engine.md` §4.4 Rationale 과의 관계("봉인 기법을 대체하지 않는 보완 조치")도 명시해 향후 오독을 방지한다.
- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 상수 JSDoc(gate 68-84)은 "왜 모듈 스코프에 둬도 안전한가"를 이전 회귀(#1174)와 대비해 정확히 설명하고, 이 상수가 그 자체로 회귀 캐너리 역할을 한다는 의도까지 문서화했다 — 인라인 주석 품질이 높다.
- 다른 in-progress plan 3개(`node-output-redesign/background.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)의 `websocket.service.ts:<라인번호>` 인용이 이번 구조적 이동으로 stale 화될 것을 이 PR 이 스스로 찾아 심볼 기준으로 갱신했다(consistency-check `18_53_27` plan_coherence WARNING #2 대응) — 코드 리팩터가 다른 문서의 라인 인용을 깨뜨리는 흔한 실패 모드를 이 PR 자체가 처리했다.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 신설 파일이 추가되어(`ws-event-types-extract.md` 조치 항목·INFO4 대응) spec-coverage 류 grep 기반 audit 이 새 파일을 놓치지 않는다.
- `plan/in-progress/ws-event-types-extract.md` 자체는 "왜"·"실측"·"역재현"·"구현 중 잡은 것" 섹션이 모두 구체적 수치(25→13, 12곳→66 suites 실패→9곳 분리→425/425)로 근거를 남겨 plan 문서로서 모범적이다.
- README/CHANGELOG/API 문서: 이 저장소는 CHANGELOG.md 를 쓰지 않고 spec Rationale + plan 으로 변경 이력을 관리하는 컨벤션이며, 이번 변경은 순수 내부 리팩터(신규 API/env var/공개 인터페이스 변경 없음)라 README·API 문서·CHANGELOG 갱신 대상이 아니다.

## 요약

이 PR 은 순수 코드 리팩터(`websocket.service.ts` 의 값/타입 선언을 의존성-프리 모듈로 추출)이며 문서화 수준이 전반적으로 이례적으로 높다 — 신설 모듈의 모듈 헤더, plan 문서, 3개 하위 plan 의 stale 라인 인용 정정, spec frontmatter 갱신까지 이 PR 자체가 처리했다. 다만 신설 파일 `websocket-events.types.ts` 안에서 JSDoc 고아화(orphaned-doc) 버그가 두 곳 발견됐다 — 하나는 `NotificationEventType` 위에 JSDoc 블록이 두 개 겹쳐 첫 블록이 tooling 에서 사라지는 경우, 다른 하나는 WARN #10 credential 마스킹 노트가 실제 구현이 없는 이 파일에 선언 없이 떠서 `KbEventType` 문서로 오인식되는 경우다. 두 사례 모두 바로 같은 diff 안(`websocket.service.ts:121-127`)에 "직전 세션이 정확히 이 패턴을 찾아 고쳤다"는 자기-지시적 주석이 남아 있어, 신설 파일로 내용을 옮기는 과정에서 그 교훈이 적용되지 않았다는 점이 뚜렷하다. 기능·컴파일에는 영향 없는 문서-전용 결함이라 병합을 막을 사유는 아니지만, 이 저장소가 이미 한 번 비용을 들여 발견한 결함 클래스이므로 이번 턴에 함께 정리하는 편이 싸다.

## 위험도

LOW
