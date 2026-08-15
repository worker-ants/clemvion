# 요구사항(Requirement) 리뷰 — `websocket.service` 값/타입을 의존성-프리 모듈로 분리

## 검토 방법

- 프롬프트에 실린 unified diff(파일 1~38) 전수 확인 + 다수 파일이 truncated 되어 `Read`/`Grep`으로 실제 소스를 직접 대조.
- `websocket-events.types.ts`(신규)와 `websocket.service.ts`에서 제거된 블록을 Python으로 텍스트 추출해 **byte-level diff** — 이동된 15개 export(선언 순서·JSDoc·본문)가 의도된 추가분(disambiguation JSDoc, `18_53_27` W3) 한 곳을 빼면 완전히 동일한지 확인.
- `npx tsc --noEmit`, `npx eslint`(대상 16개 소스 파일), `npx jest`(직접 대상 spec 7개 → 171/171, 인접 도메인 광역 131 suites/3021 tests) 실행 — 전부 GREEN, import 경로 관련 컴파일/런타임 오류 없음.
- `grep -rn 'websocket\.service\.ts:[0-9]' plan/in-progress/ spec/` — 0건, plan이 주장한 "하위 3개 in-progress plan의 절대 라인 인용 심볼 전환"이 실측으로 완결됨을 확인.
- `spec/5-system/4-execution-engine.md` §4.4 Rationale 원문을 직접 열어 plan의 인용("두 기법(forwardRef/ModuleRef strict:false)으로 봉인 유지", "PR #638")이 실제 spec 문구와 일치함을 대조.

## 발견사항

- **[WARNING] `ExecutionEventEmitter` 클래스 JSDoc이 새로 삽입된 `TERMINAL_SHAPE` 상수 때문에 클래스 선언에서 분리되어 고아(orphan) 상태가 됨 — 이 저장소가 이미 겪은 패턴(`14_55_29` maintainability W4)의 재발**
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:51`(클래스 JSDoc 시작) ~ `:67`(`*/`) 바로 뒤에 `:68`(새 `TERMINAL_SHAPE` JSDoc 시작) ~ `:84`(`*/`) ~ `:85`(`const TERMINAL_SHAPE = {`) ~ `:98`(`} as const;`) ~ 빈 줄 `:99` ~ `:100`(`@Injectable()`) ~ `:101`(`export class ExecutionEventEmitter {`)
  - 상세: 리팩터 이전에는 `실행 엔진이 발행하는 도메인 이벤트의 단일 진입점...` JSDoc(현재 :51-67)이 `@Injectable()`/`export class ExecutionEventEmitter` 바로 위에 있어 클래스 문서로 정상 부착돼 있었다(`git show aedea7d63^:...` 로 원본 확인). 이번 diff가 그 사이에 **새 JSDoc 블록 + `const TERMINAL_SHAPE` 선언**(원래 `emitTerminalExecution` 메서드 본문 안에 있던 인라인 주석+객체 리터럴을 모듈 스코프로 끌어올린 것)을 끼워 넣으면서, 클래스 JSDoc과 클래스 선언 사이에 코멘트+선언+빈 줄이 끼게 됐다. TypeScript/IDE의 JSDoc attach 규칙은 "바로 위, 공백 없이 인접한 주석"만 해당 심볼에 붙이므로, 이제 `ExecutionEventEmitter` 클래스에는 hover-doc이 뜨지 않고(직전에 빈 줄만 있음), 대신 원래 클래스를 설명하던 장문 JSDoc은 어디에도 attach되지 않는 고아 코멘트가 됐다. 정확히 같은 클래스의 결함이 이 PR이 참조하는 자매 파일 `websocket.service.ts`에서 이미 한 번 발생해 `14_55_29 maintainability W4`로 지적·수정된 바 있다(현재 그 파일 121-127행에 "블록 JSDoc 으로 두었더니 붙을 선언이 없어 바로 아래 KB union 문서로 읽혔다"는 경고 주석까지 남아 있음) — 같은 PR 계열 작업에서 같은 실수가 다른 파일에 새로 생겼다.
  - 제안: `TERMINAL_SHAPE` JSDoc+상수를 클래스 JSDoc **앞**(또는 클래스 선언과 완전히 분리된 위치, 예: import 문 바로 다음)으로 옮기거나, 클래스 JSDoc을 `@Injectable()` 바로 위로 다시 이동시켜 인접성을 복원할 것. 기능에는 영향 없음(런타임 동작 불변, 테스트 전부 GREEN)이므로 CRITICAL은 아니지만, 문서 탐색성 회귀이며 저장소가 이미 학습한 패턴의 재발이라 WARNING으로 남긴다.

- **[INFO] `spec/5-system/10-graph-rag.md:552`가 `KbEventType` union의 정본 위치를 여전히 `websocket.service.ts`로 서술 — re-export 덕에 문장 자체는 참이나 canonical 선언 위치는 `websocket-events.types.ts`로 이동**
  - 위치: `spec/5-system/10-graph-rag.md:552`
  - 상세: 이번 PR의 consistency-check(`cross_spec.md`)가 이미 동일 항목을 INFO로 자체 식별하고 "developer/planner 재량"으로 후속 처리 여지를 남겨 뒀다. `websocket.service.ts`가 `export type { KbEventType }`로 재-export하므로 이 문장은 여전히 기술적으로 참이라 차단 사유는 아니다.
  - 제안: 별도 `project-planner` turn에서 "canonical 위치"를 `websocket-events.types.ts`로 갱신할지 검토(이번 PR 범위 밖).

## 기능 완전성 / 정합성 확인 (문제 없음)

- **동작 무변경 확인**: `websocket.service.ts`의 `emitExecutionEvent`/`emitNodeEvent`/`emitKbEvent`/`emitBackgroundRunEvent`/`emitNotificationEvent`/`attachRoutingContext`/`sanitizePayloadForWs` 등 실제 비즈니스 로직은 diff 전후로 1바이트도 바뀌지 않았다 — 값/타입 선언만 새 파일로 옮기고 `export`/`export type`으로 재-export.
- **이동 내용의 무결성**: `websocket-events.types.ts`(신규, import 0줄)로 옮겨간 15개 export(인터페이스 3·enum 4·payload 타입 4·union 1·기타)를 원본 `websocket.service.ts`에서 제거된 블록과 텍스트 diff한 결과, `NotificationEventType` disambiguation JSDoc 추가(의도된 변경, consistency-check WARNING #3 반영) 한 곳을 제외하면 완전히 동일 — 오타·필드 누락·JSDoc 유실 없음.
- **호출부 마이그레이션 완전성**: `websocket.service`를 import하던 25곳 중 타입만 필요한 12곳 + 서비스와 타입을 동시에 쓰던 9곳(예: `execution-event-emitter.service.ts` — 정확히 `#1174` 버그가 났던 파일) 전부 `websocket-events.types`로 분리 완료. `grep`으로 재확인한 결과 `websocket.service`에 여전히 남아 있는 import는 실제로 `WebsocketService` 클래스(값)가 필요한 파일뿐(`chat-channel.dispatcher.ts`, `websocket.gateway.ts`, `websocket.module.ts`, `notifications.service.ts` 등)이며, `websocket.gateway.ts`가 `ExecutionEventType`을 여전히 `./websocket.service`에서 가져오는 것도 해당 참조가 클래스 메서드 본문(`emitExecutionSnapshot`, 지연 평가) 안에서만 쓰여 `#1174`류 모듈-스코프 평가 문제와 무관함을 코드로 확인 — 리팩터 범위(모듈 스코프 값 평가 안전화) 밖의 정상 케이스.
- **회귀 캐너리의 정당성**: `TERMINAL_SHAPE`를 모듈 스코프 상수로 되돌린 것은 의도된 캐너리(주석에 명시)이며, enum이 이제 의존성-프리 모듈에서 오므로 안전하다는 주장은 `tsc`/`jest` 실행으로 뒷받침됨(순환 재발 시 즉시 대량 실패하는 구조 유지).
- **spec fidelity**: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 신규 파일 추가(plan의 INFO #4 조치, `spec_impact: none`과 무모순), `spec/5-system/4-execution-engine.md` §4.4 인용은 원문과 정확히 일치, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 체크리스트 갱신도 실제 완료 상태(425/425, 66-suite 역재현)와 부합.
- **TODO/FIXME**: 신규 미완성 표식 없음.
- **에러 시나리오/데이터 유효성/반환값**: 순수 선언 재배치라 해당 표면 자체가 바뀌지 않음 — 기존 가드(`registerExecutionRouting`의 `if (!executionId) return`, `emitBackgroundRunEvent`의 `if (!backgroundRunId) return`, `emitNotificationEvent`의 `if (!userId) return` 및 try/catch)는 문자 그대로 보존.

## 요약

`websocket.service.ts`의 값·타입 선언을 의존성-프리 모듈 `websocket-events.types.ts`로 추출하는 순수 리팩터로, 실제 비즈니스 로직·emit 경로·에러 처리·반환값은 바이트 단위로 보존되었고 25곳의 호출부 마이그레이션도 컴파일·린트·타깃 테스트(171/171) 및 인접 도메인 광역 테스트(131 suites/3021 tests) 전부 GREEN으로 확인된다. spec 측 변경(frontmatter `code:` 추가)과 in-progress plan들의 라인 인용 심볼 전환도 실측 검증됐고 §4.4 Rationale 인용도 원문과 일치한다. 유일한 실질 결함은 `execution-event-emitter.service.ts`에서 새로 삽입한 `TERMINAL_SHAPE` 선언이 기존 클래스 JSDoc을 클래스 선언에서 분리시켜 고아로 만든 것 — 이 저장소가 같은 PR 계열(`websocket.service.ts`)에서 이미 겪고 문서화한 패턴이 자매 파일에서 재발한 것으로, 기능에는 영향 없으나 WARNING으로 수정을 권고한다. `spec/5-system/10-graph-rag.md`의 canonical-location 서술 갱신은 이미 자체 식별된 INFO다.

## 위험도

LOW
