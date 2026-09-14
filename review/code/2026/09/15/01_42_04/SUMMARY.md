# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(두 삭제 경로의 "락→삭제→실패로깅→재던짐" 블록 복제, 유지보수성 관점 비차단), 나머지는 전부 INFO. 이 PR 자체가 실질 보안 결함(동시 PATCH로 인한 `chatChannel.inboundSigningRef` 유실 → 인입 웹훅 서명 검증 fail-open)을 닫는 수정이며, 11개 reviewer(강제 7명 포함) 전원이 결과를 정상 반환했다 — forced 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 트리거 행 삭제의 "락 획득 → 삭제 → 실패 로깅·재던짐" 블록이 `TriggersService.remove()`와 `SchedulesService.remove()`에 거의 동일하게 복제됨. 이 PR 자신이 "복제가 drift를 부른다"는 근거로 `acquireTriggerConfigLock`을 뽑아냈는데, 그 근거가 그대로 적용되는 한 단계 위 패턴은 여전히 손으로 복제돼 있음 | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()`(~1025-1039) / `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()`(~313-331) | `deleteTriggerRowLocked(manager, id, { onRemove, logger, contextLabel })` 류 공용 헬퍼로 통합. 이미 촘촘한 회귀 테스트가 있어 즉시 차단 사유는 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `rewriteTriggerConfigLocked`의 락 안 재읽기가 `id` 단일 조건이라 `workspaceId` 스코프가 없음 — 현재 모든 호출부가 사전에 워크스페이스 소유권을 검증한 뒤라 실질 우회는 없으나, 향후 다른 자리에서 재사용 시 실수 위험 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:162` | JSDoc에 "호출부가 워크스페이스 소유권을 이미 검증했음을 전제한다" 명시 |
| 2 | 보안/DB | `SET LOCAL lock_timeout = '${Math.trunc(timeoutMs)}ms'`가 파라미터 바인딩 없는 문자열 보간 — 현재 호출부는 전부 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)만 전달해 익스플로잇 불가 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:57` | 방어 심도로 `Number.isFinite`/상한 clamp 검증 추가(차단 아님) |
| 3 | 성능 | cron 루프(`promoteRotatedNotificationSecrets`)에서 트리거당 쓰기가 `save()` 1회 → 트랜잭션+락+재조회+update(4~5x 라운드트립)로 증가. 24h grace 필터로 배치 크기 제한돼 현재는 문제 아님 | `codebase/backend/src/modules/triggers/triggers.service.ts:1385,1438`(`promoteRotatedNotificationSecrets`) | 배치가 커지면 동시성 상한 있는 병렬화 검토 |
| 4 | 성능 | config를 건드리는 모든 쓰기 경로가 라운드트립 1회→4~5회로 증가(advisory lock+재읽기). 저빈도 관리 엔드포인트라 실무 영향 작음 | `trigger-config-lock.ts` 전 호출부 | 고빈도 경로로 승격 시 재관찰 |
| 5 | 성능/동시성 | advisory lock 대기 상한 없음(삭제 제외) — 같은 트리거 동시 쓰기가 몰리면 커넥션이 순차 대기로 묶일 수 있음. 설계 의도(임계구간이 DB 왕복 2회로 유계)는 문서화돼 있음 | `trigger-config-lock.ts` `acquireTriggerConfigLock` | 커넥션 풀 대비 동시 PATCH 빈도 모니터링 |
| 6 | 요구사항/동시성 | `rotateNotificationSecret`/`cleanupRotatedChatChannelTokens`/`SchedulesService.update()`의 trigger 컬럼 동기화가 advisory lock 도메인 밖에서 컬럼만 `update()`함 — `TriggersService.update()`의 전체-엔티티 `save()`와 이론적 TOCTOU 창 존재. **이미 plan §후속(8/9라운드)에 등재되고 의도적으로 스코프 밖으로 유예된 항목**이며 이번 diff의 신규 결함 아님 | `triggers.service.ts`(`rotateNotificationSecret`, `cleanupRotatedChatChannelTokens`), `schedules.service.ts`(`update()`) | 조치 불요(플랜 트래킹 유지). CHANGELOG 표제가 "모든 자리를 닫았다"로 과대해석되지 않게 "fail-open 축 한정" 명시 권고 |
| 7 | 동시성 | `SchedulesService.update()`의 trigger 컬럼 갱신이 동시 삭제와 경합하면 매치 0건 UPDATE로 조용히 no-op 될 수 있음(선재 결함, 이 PR 스코프 밖 — config JSONB를 건드리지 않아 fail-open 재발 아님) | `schedules.service.ts` `update()` | 별도 항목으로 트래킹, `affected` 체크 또는 같은 advisory lock 재사용 검토 |
| 8 | 동시성 | `SchedulesService.remove()`가 CASCADE(`onDelete:'CASCADE'`)로 이미 지워진 스케줄 행을 `scheduleRepository.remove(schedule)`로 다시 호출 — harmless no-op이나 의도가 코드에 안 드러남(이 PR 이전부터 있던 패턴) | `schedules.service.ts:333` | 의도(고아 스케줄 방어 등) 주석 한 줄 추가 |
| 9 | 동시성 | e2e 재현 테스트의 고정 `SETTLE_MS=300`이 `blockedBeforeRelease` 최종 단언의 신뢰도에 영향 — CI 부하 시 flake 가능성(재현 자체는 타이밍과 무관하게 정확) | `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:59,183,231` | 현재는 문제 삼을 정도 아님, flake 발생 시 1차 용의선으로 기록 |
| 10 | 부작용 | `SchedulesService.update()`가 patch 빈 값(name/isActive 변경 없음)이면 트리거 행 쓰기를 완전히 생략 — 종전엔 매 PATCH마다 무조건 `updated_at` 갱신됐으나 이제 안 됨. 응답 DTO(`ScheduleTriggerRefDto`)가 `updatedAt`을 노출하지 않아 이 엔드포인트 계약엔 안 드러나고, 이 컬럼을 소비하는 하위 로직도 발견 안 됨 | `schedules.service.ts` `update()` | CHANGELOG에 이 부수효과 한 줄 추가 권고(차단 아님) |
| 11 | 유지보수성 | `TriggersService.update()`가 이미 길었던 메서드(~180줄)에 트랜잭션 콜백 한 단계를 더 얹어 중첩·로컬 상태 증가 | `triggers.service.ts` `update()`(540-721) | "락 안 재읽기+병합+save" 구간을 private 메서드로 추출(급하지 않음) |
| 12 | 유지보수성 | `ChatChannelBinderService.setupChatChannel()`이 클로저 중복은 통합됐으나 함수 길이(~237줄) 자체는 그대로 | `chat-channel-binder.service.ts` `setupChatChannel()`(87-323) | presence-gate/config 조립을 모듈 레벨 순수 함수로 분리(급하지 않음) |
| 13 | 유지보수성 | `SchedulesService.update()`의 patch가 `dto.name`이 아니라 방금 대입한 `trigger.name`을 재조회해 담는 간접 경로 — 동작엔 문제없으나 불필요한 의문 유발 | `schedules.service.ts` `update()`(~248-250) | `dto.name`/`dto.isActive` 직접 사용 또는 이유 주석 |
| 14 | 유지보수성 | `withTransactionMock()`의 5개 위임 클로저가 거의 동일한 캐스트-후-위임 패턴 반복(테스트 전용 유틸) | `__test-utils__/trigger-transaction-mock.ts`(107-135) | 제네릭 `delegate()` 헬퍼로 축약(급하지 않음) |
| 15 | 테스트 | 상한 값(`'5000ms'`)이 상수 참조 대신 리터럴로 하드코딩(형제 테스트와 동일한 기존 관례) | `schedules.service.spec.ts:627` | 여력 있으면 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 참조로 통일 |
| 16 | 테스트 | `SchedulesService.remove()`의 `schedule.triggerId` falsy 분기가 이번 PR 신규 테스트 3건 모두에서 미커버(이 가드절 자체는 선재 코드, 회귀 아님) | `schedules.service.ts` `remove()` | `triggerId: null` 케이스 1건 추가 권고 |
| 17 | 문서화 | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc의 "정리 3종(provider teardown·secret 삭제·BullMQ 해제)" 나열이 원래 `TriggersService.remove()` 전용 서술인데, 이번 CHANGELOG 정정(W3 해소)이 같은 나열을 `SchedulesService.remove()`(실제로는 BullMQ 해제만 함)에도 적용되는 것처럼 복제함. 안전 방향 과대 서술이라 위험은 없음 | `trigger-config-lock.ts:65-76`, `CHANGELOG.md` | 소비자 비특정 표현으로 일반화하거나 "경로마다 다르다" 한 줄 추가 |
| 18 | DB | cron 스윕 2곳(`promoteRotatedNotificationSecrets`, `cleanupRotatedChatChannelTokens`)의 무-페이지네이션 배치 조회 자체는 선재 구조(이번 diff가 만든 것 아님) | `triggers.service.ts` | 후보 집합 커지면 LIMIT+cursor 검토 |
| 19 | DB | `rewriteTriggerConfigLocked`가 `update()`의 affected count를 확인하지 않아 이론적 삭제 레이스 여지 — 삭제 경로 2곳이 같은 advisory lock을 공유해 실무적으로 닫혀 있음 | `trigger-config-lock.ts:147-184` | 후속에서 `affected` 카운트로 계약 명확화(차단 아님) |
| 20 | DB | 32비트 advisory lock 키 공간을 `exec-cap:*`과 `trigger-config:*`이 공유 — 이미 별도 consistency 리뷰(naming_collision WARNING#2)에서 수용됨 | `trigger-config-lock.ts:1-18` | 조치 불요(수용됨) |
| 21 | 범위/문서 | 워킹트리에 이 리뷰 세션이 만들지 않은 미커밋 plan 변경 2건 관찰(`trigger-config-lost-update.md`, `spec-draft-nullable-notation-followups.md`) — 내용상 이 PR이 스스로 약속한 트래커 종결 작업이라 스코프 이탈 아님 | `plan/in-progress/*.md` | 다음 커밋에서 코드와 분리해 plan-only 커밋으로 포함 권고 |

## 긍정적으로 확인된 사항 (참고, 별도 분류)

- 이전 라운드 CRITICAL(`rotateBotToken`이 델타 대신 전체 스냅샷을 patch로 넘겨 lost-update 방지 무력화)과 WARNING(`SchedulesService.remove()` 반쯤-삭제 로깅 부재)이 최신 커밋(`6ebc760d1`)에서 실제로 수정됨을 코드 대조로 재검증(side_effect, requirement, testing, scope, documentation 다수 reviewer 일치).
- 핵심 요구사항(동시 PATCH로 인한 `chatChannel.inboundSigningRef` 유실 → 인입 서명 fail-open 차단)이 4개 쓰기 창·삭제 경로 2곳·웹훅 인입 hot path 2곳까지 전부 구현되어 있고 대응 단위/e2e 테스트가 뮤테이션으로 검증됨(requirement, testing 뮤테이션 실측: 상한 인자 제거 → RED 확인).
- SQL 인젝션 표면 없음(전부 파라미터 바인딩 또는 TypeORM criteria API), 트랜잭션/advisory lock 경계 일관, 외부 HTTP 호출이 항상 임계구간 밖(security, database, concurrency 일치).
- `hooks.service.ts`의 `touchLastTriggeredAt`(hot path)이 `save()`→컬럼 한정 `update()`로 전환되어 오히려 쓰기 비용 감소, `findByIdForUpdate`가 중복 JOIN 제거(performance).
- 최신 커밋이 직전 라운드 지적(schedules 삭제 락 상한 뮤턴트 생존, CHANGELOG 문단 불일치, mock JSDoc 낡은 숫자)을 정확히 해소(testing, documentation, scope 일치).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음, fail-open 결함을 닫는 수정. workspaceId 미스코프 재읽기·lock_timeout 문자열 보간은 현재 익스플로잇 불가 |
| performance | LOW | cron 루프 라운드트립 증가, 쓰기 경로 전반 4~5x 증가하나 저빈도라 영향 작음. hot path는 오히려 개선 |
| requirement | NONE | 핵심 기능 완전 구현 확인, 잔여는 이미 스코프 밖 유예 항목 |
| scope | NONE | 최신 커밋이 예고 범위와 정확히 일치, 누적 diff도 단일 결함 클래스에 국한 |
| side_effect | LOW | 이전 CRITICAL/WARNING 수정 재확인. schedules `update()` 빈 patch 시 `updated_at` 미갱신 신규 발견(낮은 위험) |
| maintainability | LOW | 두 remove() 블록 복제(WARNING). 함수 길이 증가·간접 경로 등 INFO 다수 |
| testing | NONE | 직전 WARNING(상한 뮤턴트 미검증) 해소를 실측 재현으로 확인. 전체 스위트 회귀 없음 |
| documentation | LOW | JSDoc/CHANGELOG "정리 3종" 나열이 두 번째 소비자에 과대 적용(안전 방향 과대 서술) |
| database | LOW | 트랜잭션/락/파라미터 바인딩 적절. cron 배치 왕복 증가, cascade 후 중복 삭제 호출 등은 선재/저위험 |
| concurrency | LOW | 락 순서·외부호출 위치·삭제 경합 전부 적절히 닫힘. schedules update의 선재 TOCTOU는 스코프 밖 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 대조, 매칭 0건(백엔드 내부 동시성 수정, 사용자 가시 표면 변경 없음) |

## 발견 없는 에이전트

user_guide_sync (매칭 대상 없음), requirement/scope/testing (위험도 NONE — 실질 차단 발견 없음, INFO만 존재).

## 권장 조치사항

1. (선택, 비차단) 두 `remove()`의 "락→삭제→실패로깅→재던짐" 블록을 공용 헬퍼(`deleteTriggerRowLocked` 류)로 통합해 향후 drift 방지.
2. (선택) CHANGELOG/`TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc의 "정리 3종" 나열을 소비자 비특정 표현으로 완화.
3. (선택) `SchedulesService.update()`의 빈 patch 시 `updated_at` 미갱신 부수효과를 CHANGELOG에 한 줄 명시.
4. (플랜 트래킹 유지) `rotateNotificationSecret`/`cleanupRotatedChatChannelTokens`/`SchedulesService.update()`의 컬럼 단위 TOCTOU 잔여 항목은 기존 plan 후속 백로그(8/9라운드 W4/W2)에서 계속 추적.
5. (다음 커밋) 워킹트리의 미커밋 plan 파일 2건을 코드와 분리한 plan-only 커밋으로 포함.
6. 위 항목 전부 비차단(INFO/단일 WARNING) — 이번 배치를 막을 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단(프롬프트에 개별 사유 미기재) — 이번 diff가 백엔드 서비스 계층 내부 동시성 수정으로 아키텍처 경계/모듈 구조 변경 없다고 판단된 것으로 추정 |
  | dependency | 라우터 판단(프롬프트에 개별 사유 미기재) — 신규 외부 의존성 추가 없음 |
  | api_contract | 라우터 판단(프롬프트에 개별 사유 미기재) — 공개 API 시그니처/응답 계약 변경 없음(side_effect 리뷰도 동일하게 확인) |