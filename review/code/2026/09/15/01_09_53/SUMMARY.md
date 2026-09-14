# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 은 없고 핵심 lost-update(인입 웹훅 서명 검증 fail-open) 수정 자체는 14라운드에 걸친 검증 끝에 견고하게 닫혔다. 다만 이번 라운드에서 새로 검토된 마지막 커밋(`2a87eb2f0`, 스케줄 cascade 삭제에도 config 락 확장)에서 **뮤테이션 실측으로 확인된 회귀 테스트 갭**(lock timeout 인자를 제거해도 25/25 전건 GREEN)과, 형제 코드 대비 **진단 로깅 비대칭**(BullMQ 제거 후 트랜잭션 실패 시 "반쯤 삭제됨" 로그 누락) 이 새로 발견돼 WARNING 5건으로 집계된다. 모두 병합을 막을 사유는 아니지만 후속 커밋에서 정리가 필요하다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트(회귀 커버리지) | 스케줄 cascade 삭제의 `acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` 에서 `timeoutMs` 옵션을 제거하는 뮤턴트가 **실측(25/25 전건 GREEN)** 으로 생존한다. 새 테스트가 `onLock`(락 키)만 관측하고 `onLockTimeout` 훅을 provider 에 연결하지 않아, 삭제 경로가 무한 대기로 조용히 되돌아가도 감지되지 않는다. sibling(`TriggersService.remove()`)은 같은 PR 안에서 이미 이 클래스의 갭을 "순서 배열" 단언으로 막아 뒀다. | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:594-609` (`'삭제 — trigger 행을 config 락 안에서 지운다'`), 대상 코드 `schedules.service.ts:311-313` | `triggers.service.spec.ts:3899-3920` 패턴대로 `onLockTimeout` 훅을 연결하고 `["timeout:SET LOCAL lock_timeout = '5000ms'", "lock:trigger-config:trig-del", ...]` 형태의 순서 배열 단언 추가 |
| 2 | 관측성/아키텍처(동시성) | `SchedulesService.remove()` 가 새로 도입한 lock-timeout 실패 경로에, 이미 실행된 되돌릴 수 없는 부수효과(`scheduleRunnerService.removeJob()` — BullMQ 제거)가 있음에도 형제 코드(`TriggersService.remove()`)가 갖춘 `.catch(logger.error('반쯤 삭제된 상태…'))` 진단 로그가 없다. 원인은 "락 안에서 Trigger 행을 지운다"는 개념이 두 모듈에 공용 프리미티브 없이 각자 손으로 복제돼 있어 이미 갈라진 것 — 이번 PR 의 버그(삭제 경로 하나만 락 누락)도 이 복제 구조에서 비롯됐다. | `codebase/backend/src/modules/schedules/schedules.service.ts:294-318` (`remove()`) vs `codebase/backend/src/modules/triggers/triggers.service.ts:1025-1039` (대조) | `SchedulesService.remove()` 트랜잭션에도 동일한 `.catch` 로깅 추가. 근본적으로는 `trigger-config-lock.ts` 에 "락 안에서 Trigger 삭제" 공용 프리미티브(예: `deleteTriggerLocked`)를 추출해 두 호출부가 공유하게 하고, 이 불변식을 스캔하는 정적 가드(`endpoint-path-conflict-wrap-guard.ts` 선례처럼)를 백로그에 추가 |
| 3 | 문서화(CHANGELOG 자기모순) | `CHANGELOG.md` 안에서 "삭제 경로 둘 다 같은 락을 잡는다"(25행)는 최신 커밋으로 정정됐는데, 23줄 뒤 "삭제(`DELETE /api/triggers/:id`)만 5초 상한을 둔다"(48행)는 갱신되지 않았다. 실제 코드는 스케줄 cascade 삭제에도 같은 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 상수로 5초 상한을 건다 — 코드는 정합적인데 문서 두 문단이 서로 다른 사실을 말한다. | `CHANGELOG.md:48` (대조: `CHANGELOG.md:25`) | "삭제(`DELETE /api/triggers/:id`) 와 스케줄 삭제의 trigger cascade 둘 다 5초 상한을 둔다"로 정정 |
| 4 | 의존성(문서 drift) | `trigger-transaction-mock.ts` JSDoc 이 "`withTransactionMock` 사용처 2개(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`), 나머지 4개(`schedules` 포함)는 트랜잭션 경로를 안 타 안전하다"고 서술하는데, 바로 이 changeset 의 최신 커밋이 `schedules.service.spec.ts` 를 실제로 `withTransactionMock` 으로 갱신했다. 기능은 올바르지만 산문이 "3 wrapped / 3 unwrapped" 실제 상태를 반영 못해 다음 사람이 `schedules`를 "아직 안전하다"고 오판할 위험. | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:43-47` | 해당 문단을 "3개 wrapped(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·`schedules.service.spec.ts`) / 3개 unwrapped(`auth-configs`·`external-interaction`·`hooks`)"로 갱신 |
| 5 | 유지보수성 | `TriggersService.update()` 가 이미 163줄이던 다중 책임 메서드였는데, 이번 PR 이 "락 획득→재읽기→보존 게이트 재계산→병합→저장" 트랜잭션 블록을 익명 콜백으로 그대로 인라인해 182줄로 늘렸다. 같은 PR 이 `mergeIntoFreshSubKey`·`assertTriggerFound`·`findByIdForUpdate` 등은 private 메서드로 뽑았으면서 가장 새롭고 복잡한 이 블록만 남겨 일관성이 깨졌다. | `codebase/backend/src/modules/triggers/triggers.service.ts:540-721`(`update()`), 특히 `606-671` | 트랜잭션 블록을 `rewriteTriggerConfigLocked` 처럼 별도 private 메서드(예: `saveUpdatedTriggerLocked(...)`)로 추출 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | "Trigger 삭제는 항상 config 락을 동반한다"는 불변식이 정적 가드 없이 JSDoc 주석에만 의존 — 자매 불변식(`save()` 래핑)은 이미 AST 가드로 승격돼 비대칭. 이번 PR 안에서 실제로 한 번 깨진 채(삭제 경로 하나 누락) 한 라운드를 통과한 이력이 있음. | `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (delete/remove 스캔 없음) | 삭제 호출 지점이 `acquireTriggerConfigLock` 을 동반하는지 스캔하는 정적 가드를 백로그에 추가 |
| 2 | 보안 | `rewriteTriggerConfigLocked` 재읽기가 `workspaceId` 로 스코프되지 않음 — 현재 모든 호출부가 사전에 워크스페이스 검증을 마친 뒤 부르므로 악용 불가하나, 헬퍼 계약 자체가 그 전제를 강제하지 않음 | `trigger-config-lock.ts:162` | JSDoc에 "호출부가 소유권을 사전 검증했다고 가정"을 명시 |
| 3 | 보안/데이터베이스/동시성 | `SET LOCAL lock_timeout` 문자열 보간은 파라미터 바인딩 불가 구조적 제약 — `Math.trunc()` 로 정수만 허용하고 유일한 호출부는 모듈 상수만 넘겨 인젝션 경로 없음(3개 관점에서 교차 확인) | `trigger-config-lock.ts:56-58` | 조치 불요, 향후 사용자 입력 연결 시 가드 유지 확인 |
| 4 | 성능 | 락+재읽기 도입으로 쓰기 경로별 DB 왕복이 대략 2배로 증가 — 정합성을 위한 의도된 트레이드오프, 임계구간 짧고 외부 HTTP 호출은 락 밖 | `trigger-config-lock.ts:147-184`, `triggers.service.ts` 여러 자리 | 조치 불요, 프로덕션 지표로 tail latency 모니터링 권장 |
| 5 | 성능/데이터베이스 | 두 cron 배치(`promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens`)의 순차 루프가 행당 DB 왕복을 최대 3배로 늘림(락+재읽기 추가) — 여전히 O(n), 병렬화 없음, 페이지네이션 없음(기존 구조, plan 후속 백로그에 이미 등재) | `triggers.service.ts:1373-1453`, `:1464-1507` | 후보 수 급증 시 `p-limit` 병렬화 또는 cursor 페이지네이션 검토 |
| 6 | 성능/동시성 | 삭제 경로(5초)를 제외한 대부분의 락 획득 자리는 대기 상한이 없어, 동일 트리거 PATCH 폭주 시 커넥션 풀 소모·지연 누적 가능 — 이미 8라운드 전 plan 후속 표(W6)에 등재된 기존 추적 항목 | `trigger-config-lock.ts:39-63` | 조치 불요(추적 중), PATCH 동시성 실측 확인되면 `lock_timeout` 확대 검토 |
| 7 | 문서화 | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 근거 예시("provider teardown·secret 삭제·BullMQ 해제")가 `TriggersService.remove()` 하나에만 정확 — 이제 같은 상수를 쓰는 `SchedulesService.remove()` 의 선행 정리(BullMQ 해제뿐)와는 불일치 | `trigger-config-lock.ts:65-76` | 예시를 소비자 비특정 표현으로 완화 |
| 8 | 의존성 | 신규 내부 의존 엣지 `schedules.service.ts` → `triggers/trigger-config-lock.ts`(단방향, 순환 없음) 발생 — "트리거 config 락" 개념을 두 모듈이 공유하게 됨 | `schedules.service.ts` import, `triggers.module.ts` | 조치 불요, 세 번째 소비 모듈 생기면 공용 위치 이동 검토 |
| 9 | 데이터베이스 | `scheduleRepository.remove(schedule)` 가 FK `onDelete: CASCADE` 로 이미 지워진 Schedule 행을 다시 지우려는 중복 호출(무해한 no-op) — 이 PR 이전부터 있던 패턴, 신규 결함 아님 | `schedules.service.ts:314-317`, `schedule.entity.ts:28` | 조치 불요, 필요 시 cascade 의존 사실을 주석으로 남김 |
| 10 | 데이터베이스 | `rewriteTriggerConfigLocked` 의 `update()` 가 affected count 를 확인하지 않아, `findOne` 직후 삭제되면 이론적으로 0-row UPDATE 가 성공으로 보고될 여지(데이터 손상 없음, 삭제 경로들이 이제 같은 락을 잡아 실질 창은 사실상 닫힘) — 이전 라운드부터 추적된 항목 | `trigger-config-lock.ts:162-181` | 조치 불요(범위 밖), 후속에서 affected 카운트로 좁히면 더 정확 |
| 11 | 동시성 | `SchedulesService.update()` 의 트리거 `name`/`isActive` 컬럼 동기화가 advisory lock 도메인 밖에 있어, 창 1(`TriggersService.update()`)의 전체 엔티티 저장과 좁은 창에서 경합해 방금 커밋된 값이 되돌아갈 이론적 여지 — `config`/`inboundSigningRef` 축은 이 PR 이 닫았으나 `name`/`isActive` 축은 의도적으로 스코프 밖(plan 9라운드 W2 항목에 이미 등재, developer 범위 후속) | `schedules.service.ts:237-250` vs `triggers.service.ts:621-670` | 조치 불요(이미 추적/이월됨), 근본 수정은 후속 PR에서 |
| 12 | API 계약 | 스케줄 삭제의 신규 lock-timeout 실패(`55P03`)는 기존 전역 예외 필터의 일반 500 마스킹 경로를 그대로 타 에러 응답 포맷 불일치나 정보 유출 없음. `endpointPath` 409/트리거 404 매핑도 트랜잭션 콜백 전환 후에도 정적 가드로 보존됨 | `common/filters/http-exception.filter.ts`, `triggers.service.ts` `rethrowEndpointPathConflict` | 조치 불요 |
| 13 | 유지보수성 | `ChatChannelBinderService.setupChatChannel()` 이 이전 라운드 지적(중복 클로저)은 해소했으나 신규 게이트 클로저 추가로 237줄까지 길어짐(순감소 아님) | `chat-channel-binder.service.ts:87-323` | 조치 불요, presence-gate 재계산을 모듈 레벨 순수 함수로 추출하는 안 계속 추적 |

## 발견 없는 에이전트

- **scope** — 범위 이탈(무관한 리팩토링·설정 변경·과잉 엔지니어링) 없음. 실제 코드/문서 변경 19개 파일 전수 확인, 전부 단일 결함 클래스 폐쇄에 직접 대응. 위험도 NONE.
- **api_contract** — 컨트롤러·DTO·라우트·인증 미들웨어 변경 없음. 위 INFO#12 외 계약 위반 없음. 위험도 NONE.
- **user_guide_sync** — doc-sync-matrix 20행 전수 대조 결과 매칭 trigger 없음(순수 backend 동시성 수정, `spec_impact: none`). 위험도 NONE.

## 권장 조치사항

1. **(최우선, 실측된 갭)** `schedules.service.spec.ts` 에 `onLockTimeout` 훅을 연결하고 락 타임아웃 순서를 단언하는 회귀 테스트 추가 — 뮤테이션 테스트로 현재 갭이 실측 확인됨(WARNING#1).
2. `SchedulesService.remove()` 트랜잭션에 `TriggersService.remove()` 와 대칭인 `.catch(logger.error)` 진단 로깅 추가해 관측성 비대칭 해소(WARNING#2). 여력이 되면 "락 안에서 Trigger 삭제" 공용 프리미티브 추출 + 정적 가드 백로그 등재(INFO#1).
3. `CHANGELOG.md:48` 문장을 두 삭제 경로 모두 5초 상한 대상임을 반영하도록 정정(WARNING#3).
4. `trigger-transaction-mock.ts` JSDoc 의 wrapped/unwrapped 소비자 목록을 현재 상태(3/3)로 갱신(WARNING#4).
5. `TriggersService.update()` 의 트랜잭션 블록을 별도 private 메서드로 추출해 일관성·가독성 개선(WARNING#5, 급하지 않음).

## 라우터 결정

`routing_status=skipped` — 라우터 미사용. 전체 14개 reviewer 전원 실행(제외 0명). forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 전원 결과 확보됨 — 누락 없음.