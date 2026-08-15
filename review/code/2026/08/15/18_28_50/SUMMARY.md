# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(API 계약 문서화 갭). 9개 reviewer(강제 7 + router 선정 2) 전원 결과 확보, forced 화이트리스트 미이행 없음. `scope.md` 는 디스크에 없어 인라인 전문으로 재영속화했으며 내용 손실은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | `CHANGELOG.md` 의 "수신자 영향" 분석이 저장소 내부 소비자(grep 가능한 `chat-channel.dispatcher.ts`)로만 스코프돼 있다. 그러나 `failRetryExecution` cancelled 분기가 신규로 emit 하는 `result.cancelledBy`는 EIA outbound webhook(EIA-NX-02 화이트리스트, spec §3.3)과 SSE 스트림(`GET /api/external/executions/:id/stream`, spec §5.2)을 통해 동일 payload 로 **외부 제3자 통합사**에게도 그대로 전달된다 — CHANGELOG 가 이 외부 계약 표면을 언급하지 않는다. | `CHANGELOG.md`(신규 섹션 "수신자 영향" 문단) ↔ `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`, `sse-adapter.service.ts` | CHANGELOG 에 "이 이벤트는 EIA outbound webhook·SSE 로 외부 제3자에게도 동일 payload 로 전달된다. 필드 **추가**이며 spec §6 이 원래 요구하던 값을 채우는 결함 수정이라 breaking 은 아니지만, `result` 부재를 신호로 쓴 외부 통합사가 있다면 관측 가능한 변화" 정도로 외부 소비자 존재를 명시. 코드 수정은 불필요(방향은 spec 정합). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / api_contract | `failRetryExecution` cancelled 분기의 `cancelledBy: 'user'` 고정값은 실제 취소 주체(user/system/timeout)를 구분하지 못한다. `ExecutionCancelledError` 는 "DB 가 이미 CANCELLED" 관측 시에만 던져져 실제 원인을 알 수 없다. 외부 API 소비자가 `cancelledBy` 로 재시도/알림 로직을 분기한다면 system/timeout 취소도 `'user'` 로 오인될 수 있다. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution`(cancelled 분기) | 조치 불요 — `plan/in-progress/eia-terminal-emit-facade.md` 에 기지 한계로 명시됨(§6.5 규칙상 `error` 미동행과 자기정합). 후속 `error.code` 기반 원인 파생은 별도 항목으로 추적 중. |
| 2 | requirement / api_contract | `TerminalEventPayload.cancelled.error.message` 가 spec §6.5 의 "optional" 명시보다 코드가 더 엄격(필수)하다. 시스템/타임아웃 취소 3개 호출부는 전부 리터럴로 `code`+`message` 를 채우므로 런타임 결함은 아니며, spec 보다 느슨한 게 아니라 더 좁히는 방향이라 CRITICAL 대상이 아니다. 신규 아님 — 이전 라운드가 이미 식별·"무조치" 처분한 항목의 잔존 재확인. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:48` | 코드 유지. spec 갱신 여부는 `project-planner` 재량. |
| 3 | maintainability | `cancelled.error` 가 이름 없는 인라인 타입(`{code: string; message: string}`)이라, 같은 파일의 `failed` variant 가 쓰는 named export 타입 `TerminalErrorPayload` 와의 "축소판" 관계가 타입 선언만으로 드러나지 않는다(JSDoc 으로는 근거가 남아 있음). | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:48` | `SystemCancelErrorPayload` 등으로 명명 export 하거나 `Pick<TerminalErrorPayload, 'code'\|'message'>` 형태로 관계를 표현. 급하지 않음. |
| 4 | architecture | `emitTerminalExecution` 의 조립 결과가 `wire: Record<string, unknown>` 이라, 판별 union 이 강조하는 "컴파일 타임 강제"가 입력(`TerminalEventPayload`)에만 적용되고 출력 조립부(`wire.eror` 같은 오타를 `tsc` 가 못 잡음)까지는 이어지지 않는 비대칭이 있다. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:126-138` | 조치 불요(현재도 테스트로 방어됨). 종결 필드가 더 늘어나면 `toTerminalWirePayload` 같은 헬퍼로 분리해 조립부까지 타입 보호를 확장하는 편이 이 리팩터 취지에 부합. |
| 5 | architecture | ES-module 순환(`websocket.service`↔`websocket.gateway`↔`execution-engine`/`retry-turn`↔`execution-event-emitter`)이 이번에도 근본 해소가 아니라 함수 스코프 지연 평가로 우회된 상태로 유지된다. 다만 무기한 방치가 아니라 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 명시적 백로그 항목(체크박스 미완료)으로 정직하게 등재돼 있다. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:108-125` | 조치 불요(이미 백로그 등재). 후속 세션에서 `ExecutionEventType`/`NodeEventType` 등을 의존성-프리 모듈로 추출하는 작업 착수 여부만 추적. |
| 6 | maintainability | `failRetryExecution` 의 if/else 두 분기 모두에 `durationMs: resolveTerminalDurationMs(execution)` 계산이 그대로 중복된다(`resolveTerminalDurationMs` 자체는 self-memoizing 이라 값이 갈릴 위험은 없음). | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:984`(cancelled), `:999`(failed) | 분기 진입 전 `const durationMs = resolveTerminalDurationMs(execution);` 한 번만 계산해 재사용. |
| 7 | maintainability | `retry-turn.service.spec.ts` 에 종결 이벤트 종류를 검증하는 두 스타일(원시 문자열 비교 vs `TYPE_TO_EVENT` 경유 enum 비교)이 공존해 어느 쪽이 표준인지 헷갈릴 수 있다. | `retry-turn.service.spec.ts:712` vs `:797`, `:966` | 급하지 않음. 후속에 이 파일을 다시 만질 일이 있으면 한쪽으로 통일 고려. |
| 8 | testing | `retry-turn.service.spec.ts` 의 `mockEventEmitter.emitExecution` 이 이번 diff 이후 어떤 테스트에서도 호출·단언되지 않는 죽은 mock 이 됐다(`retry-turn.service.ts` 가 이제 `emitExecution` 을 직접 호출하지 않음). | `retry-turn.service.spec.ts:105` | mock 필드 제거(권장) 또는 남긴다면 이유를 주석으로 남김. |
| 9 | testing | `cancelled` variant 의 `cancelledBy: 'system'` 리터럴과 `durationMs: null` 조합이 emitter spec 의 wire-형태 테스트에 문자 그대로 등장하지 않는다(로직이 값에 분기하지 않아 실질 위험은 낮음). | `execution-event-emitter.service.spec.ts` (`'종결 payload wire 형태'` describe 블록) | 급하지 않음. 여유가 있으면 `cancelledBy: 'system'` 케이스 1건 추가해 3값 union 전체를 wire 레벨에서 최소 1회씩 실측. |
| 10 | side_effect | 신규 value import `ExecutionStatus`(`execution.entity.ts`)가 이미 `forwardRef` 순환 위에 있는 `execution-event-emitter.service.ts` 의 의존 그래프를 한 겹 넓힌다. 함수 스코프 지연 평가(모듈 스코프 아님)로 안전하게 처리됐고, import 체인이 websocket 쪽을 역참조하지 않아 순환이 확대되지 않았음을 직접 확인. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:8` | 조치 불요. 향후 이 파일에 value import 추가 시 동일하게 함수 스코프 지연 평가 원칙 유지. |
| 11 | SCOPE | [SPEC-DRIFT 아님, 일반 스코프 관찰] 순수 리팩터 커밋(`219d1c2d2`)에 기존 결함 수정(`retry-turn-terminal-guard.md` #2, `cancelledBy` 누락)이 함께 흡수됐다. 은폐된 확장이 아니라 plan("다른 plan 과의 관계" 절)·CHANGELOG(⚠️ wire 변화 고지)·spec §6 각주·자매 plan 취소선 4곳에서 명시적으로 교차 참조·정당화되어 있다. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:978-1003` | 조치 불요(투명하게 문서화됨). 향후 유사 패턴에서는 커밋 메시지 제목에도 혼합 사실(`refactor` + 실질 `fix`)을 드러내는 편이 추적에 유리. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 내부 리팩터, 인증/인가·암호화·시크릿 무변경. 유일 관측(`cancelledBy` 고정값)은 INFO#1 로 통합 |
| architecture | LOW | 이전 라운드 WARNING(클래스 JSDoc 삭제·`TYPE_TO_EVENT` 중복) 소스 직접 재검증으로 해소 확인. 신규 INFO 2건(wire 타입 비대칭, ES-module 순환 잔존) |
| requirement | NONE | spec §6/§6.4/§6.5 와 line-level 정합, 판별력이 jest 아닌 `tsc` 래칫으로 실제 강제됨을 재실행 확인. 이전 WARNING 7건 전부 재검증 완료 |
| scope | LOW | 31개 변경 파일 전량이 4개 축(파사드+이관/결함흡수/문서동기화/의무 산출물)으로 설명됨. 결함 흡수가 투명하게 문서화됨(INFO#11) |
| side_effect | LOW | 종결 감지·라우팅 해제가 payload 형태와 무관, 호출 이관 완전성 grep 재확인. 신규 관측 가능한 wire 변화(`result.cancelledBy`)는 문서화되고 내부 소비자는 방어적 처리 확인 |
| maintainability | LOW | 핵심 변경은 가독성·단일 책임 양호. 잔여 INFO 3건(계산 중복, 익명 타입, 테스트 스타일 혼재) 모두 사소 |
| testing | LOW | 이전 라운드 WARNING(판별력 회귀 테스트 부재) 신규 테스트로 해소, 실행 재확인(54/54, 454/454 GREEN). 잔여 INFO 2건(죽은 mock, 커버리지 조합 갭) |
| documentation | NONE | 이전 라운드 WARNING/INFO 6건(CHANGELOG 누락, plan 취소선, SoT 표, JSDoc, 상수 중복, 메서드명 드리프트) 전부 소스 직접 대조로 해소 확인. 신규 결함 없음 |
| api_contract | LOW | 내부 emit 리팩터가 실제로는 EIA outbound webhook·SSE 외부 계약 표면에 도달함을 지적, WARNING 1건(CHANGELOG 영향 분석 범위 협소) |

## 발견 없는 에이전트

- **documentation** — 이전 라운드 지적사항(CHANGELOG 누락, plan 취소선, SoT 표 미갱신, 클래스 JSDoc 삭제, 테스트 상수 중복, plan 메서드명 드리프트) 전부 소스 직접 열람으로 해소 확인. 신규 CRITICAL/WARNING 급 문서화 결함 없음.

## 권장 조치사항

1. `CHANGELOG.md` "수신자 영향" 문단에 EIA outbound webhook(EIA-NX-02)·SSE 스트림(§5.2)을 통한 외부 제3자 소비자 도달 사실을 명시한다(WARNING#1). 코드 수정은 불필요.
2. (선택, 급하지 않음) `failRetryExecution` 의 `durationMs` 계산을 분기 진입 전 1회로 통합하고, `mockEventEmitter.emitExecution` 죽은 mock 을 정리하는 등 INFO 항목들은 다음 관련 작업 시 함께 정리한다.
3. ES-module 순환 해소(`ExecutionEventType`/`NodeEventType` 의존성-프리 모듈 추출)는 이미 백로그(`spec-sync-external-interaction-api-gaps.md`)에 등재돼 있으므로 그 트래커에서 진행 상황만 추적한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음.
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(내부 emit 파사드 리팩터)와 무관 |
  | dependency | 신규/변경 외부 패키지 의존성 없음 |
  | database | 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 제어 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 영향 없음(내부 리팩터) |