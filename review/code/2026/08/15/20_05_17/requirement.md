# 요구사항(Requirement) 리뷰 — `websocket.service` 값/타입 분리 (fresh review, `19_27_37` 수정 반영 후)

## 검토 방법

- 이번 프롬프트는 이전 라운드(`19_27_37`)의 리뷰 산출물·RESOLUTION.md 자체가 diff 로 다시 포함된 형태다 — 즉 이번 턴은 그 라운드의 W1~W5 수정이 **실제로 코드에 반영됐는지**를 검증하는 fresh review다.
- `git log --oneline -15` 로 커밋 계보 확인: `aedea7d63`(1차 구현) → `65da1a9d7`(W1~W5+INFO3 fix) → `dc565afbf`(RESOLUTION 문서 커밋, 코드 无변경).
- RESOLUTION.md 가 주장하는 5개 수정 각각을 `Read`로 현재 소스에서 직접 대조:
  - W1(gateway import 누락) → `websocket.gateway.ts:23` 확인
  - W2(클래스 JSDoc orphan) → `execution-event-emitter.service.ts` 전문 확인
  - W3(NotificationEventType JSDoc 중복) → `websocket-events.types.ts:209-221` 확인
  - W4(WARN #10 orphan) → `websocket-events.types.ts` 전문(WARN #10 부재) + `websocket.service.ts:51-60` 확인
  - W5(회귀 가드 부재) → `websocket-events.types.spec.ts` 전문 확인 + 실행
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 및 `npx jest src/modules/websocket src/modules/execution-engine/events` 직접 실행(8 suites/152 tests, 4 tests 별도) — 전부 GREEN.
- `npx nest build` 직접 실행 — 에러 없음(성공). (`npx tsc --noEmit -p tsconfig.json` 이 별도로 보고하는 다수 에러는 이번 diff 대상 파일과 무관한 기존 스펙 파일들의 사전 존재 타입 에러로, 실제 빌드 게이트인 `nest build` 는 통과함을 직접 확인 — 오탐 배제.)
- `grep -rE "from '(\.\./)*websocket/websocket\.service'"` 로 저장소 전수 재확인 — `WebsocketService` 클래스 외의 값을 이 경로에서 가져오는 곳은 `websocket.service.spec.ts`(의도된 facade 커버리지) 뿐임을 재확인.
- `spec/5-system/14-external-interaction-api.md` §6 필드 표(status/durationMs/result.cancelledBy/error) 원문과 `TERMINAL_SHAPE`/`emitTerminalExecution` 구현을 대조 — 일치.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 `websocket-events.types.ts` 등재 확인.

## 발견사항

- **[INFO]** `spec/5-system/10-graph-rag.md:552` 가 `KbEventType` 정본 선언 위치를 여전히 `websocket.service.ts` 로 서술 — canonical 위치는 이제 `websocket-events.types.ts`
  - 위치: `spec/5-system/10-graph-rag.md:552`
  - 상세: `websocket.service.ts` 가 `export type { KbEventType }` 로 재-export 하므로 문장 자체는 여전히 참이라 차단 사유는 아니다. 이미 `18_53_27` consistency-check 와 `19_27_37` requirement 리뷰(INFO1)가 동일 항목을 식별했고, `plan/in-progress/ws-event-types-extract.md` "후속(이 PR 범위 밖)" 섹션에 planner 턴 항목으로 등재돼 있다 — spec 본문 수정은 developer 권한 밖이라 그대로 유효한 처분이다.
  - 제안: 별도 `project-planner` 턴에서 canonical 위치 서술을 `websocket-events.types.ts` 로 갱신. 이번 PR 을 막을 사유 아님.

## 기능 완전성 / 정합성 확인 (WARNING 이상 없음 — 이전 라운드 수정 5건 전부 코드에 반영됨을 직접 확인)

- **W1 (순환 노드 누락) 반영 확인**: `websocket.gateway.ts:23` 이 `import { ExecutionEventType } from './websocket-events.types';` 로 전환됨. 저장소 전수 재-grep 결과 `websocket.service` 경로에서 `WebsocketService` 클래스 외의 값을 가져오는 곳은 `websocket.service.spec.ts`(의도된 facade 검증) 하나뿐 — "타입/enum 만 쓰는 소비자 12곳 + 서비스·타입 동시 사용 9곳, 총 22곳 전환" 완료 주장이 이제 실제와 일치한다.
- **W2 (클래스 JSDoc orphan) 반영 확인**: `execution-event-emitter.service.ts` 에서 `TERMINAL_SHAPE` 상수+JSDoc(:51-84)이 클래스 JSDoc(:86-102) **앞**으로 이동해, 클래스 JSDoc 이 다시 `@Injectable()`(:103)/`export class ExecutionEventEmitter`(:104) 바로 위에 인접 — hover-doc 이 정상 attach 된다.
- **W3 (JSDoc 중복) 반영 확인**: `websocket-events.types.ts:209-218` 에서 채널/권위-출처 설명과 disambiguation 경고가 한 블록으로 병합돼 `NotificationEventType`(:219) 위 JSDoc 블록이 하나뿐.
- **W4 (WARN #10 orphan) 반영 확인**: `websocket-events.types.ts` 전문에 더는 WARN #10 블록이 없고, `websocket.service.ts:51-58` 의 `CREDENTIAL_KEY_PATTERN` 구현 바로 위로 이동 — 리뷰가 제안한 "삭제" 대신 RESOLUTION 이 스스로 검증한 "저장소 유일 출처이니 삭제 시 보안 근거 소실" 판단에 따라 이동 처분한 것이 실측(WARN #10 문자열 저장소 grep 1건)과 일치.
- **W5 (회귀 가드 부재) 반영 확인**: `websocket-events.types.spec.ts`(신규, 169줄) 가 TS 파서로 `import`/`export...from`/`import=require`/동적 `import()`/`require()` 다섯 종의 module specifier 를 전수 탐지 — 4 tests 직접 실행 결과 전부 GREEN. 세 번째 테스트가 정확히 W1 이 실제로 겪은 결함 형태(gateway 가 값 import 를 `websocket.service` 경로로 되돌리는 것)를 잡는 회귀 가드로 동작함을 코드 레벨에서 확인(`offenders` 배열에 `WebsocketService` 를 제외한 값 import 가 남으면 실패).
- **동작 무변경 재확인**: `emitExecution`/`emitTerminalExecution`/`emitNode`/`registerExecutionRouting`/`releaseExecutionRouting` 시그니처·반환 타입·early-return 가드(`if (!executionId) return` 류) 전부 diff 전후 동일. `TERMINAL_SHAPE[payload.type]` 로의 치환은 계산 결과(shape)가 이전 인라인 리터럴과 100% 동일 — 값 변경 없음.
- **호출부 마이그레이션 완전성**: 22개 소비 파일 전부 `websocket-events.types` 직접 import 로 전환 완료(gateway 포함). `WebsocketService` 클래스가 실제로 필요한 파일(chat-channel.dispatcher, notification-fanout, embedding/graph-extraction, background-execution.processor, sse-adapter, notifications.service, websocket.module 등)만 `websocket.service` 경로를 유지 — 정확히 의도된 구분.
- **테스트 검증**: `npx jest src/modules/websocket/websocket-events.types.spec.ts` → 4/4 PASS. `npx jest src/modules/websocket src/modules/execution-engine/events` → 8 suites/152 tests 전부 PASS. `npx nest build` → 에러 없이 성공.
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §6 필드 표(`status` 3종/`durationMs`(null 허용)/`result.cancelledBy` 닫힌 3값 union/시스템·타임아웃 취소만 `error` 동행)가 `TERMINAL_SHAPE`+`emitTerminalExecution` 구현과 정확히 일치(이번 diff 로 새로 어긋난 곳 없음 — 순수 위치 이동이므로 당연하나 명시 확인). `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 신규 파일 등재 확인.
- **TODO/FIXME**: `git diff origin/main...HEAD -- 'codebase/**/*.ts'` 전수 grep 결과 TODO/FIXME/HACK/XXX 신규 도입 없음.
- **에러 시나리오/반환값**: 순수 선언 재배치+2건의 문서 위치 조정뿐이라 기존 표면(early-return 가드, try/catch)이 문자 그대로 보존됨을 재확인.

## 요약

이번 라운드는 직전 리뷰(`19_27_37`)가 지적한 Warning 5건(순환 노드 누락(gateway) · 클래스 JSDoc orphan · JSDoc 중복 · WARN #10 orphan · 회귀 가드 부재)이 커밋 `65da1a9d7`에서 **실제로 코드에 반영됐음을 소스 레벨에서 직접 대조·재실행하여 확인**했다 — RESOLUTION.md 의 주장이 소스 상태와 정확히 일치한다. 특히 유일한 실질 결함이었던 W1(순환의 두 핵심 노드 중 `websocket.gateway.ts` 가 전환 대상에서 누락)은 gateway import 전환 + AST 기반 회귀 가드(4 tests, RESOLUTION 이 문서화한 M5 뮤테이션과 정확히 같은 형태를 잡는 것을 코드로 확인)로 닫혔다. 비즈니스 로직·emit 경로·에러 처리·spec 계약(EIA §6 필드 표)은 바이트 단위로 보존되며, 신규 결함이나 TODO/FIXME, 반환값 누락은 발견되지 않았다. 유일한 잔여 항목은 `spec/5-system/10-graph-rag.md:552` 의 `KbEventType` canonical 위치 서술이 여전히 구 경로를 가리키는 INFO(재-export 로 문장 자체는 참, developer 권한 밖, 이미 planner 턴 항목으로 추적 중)뿐이다.

## 위험도

NONE
