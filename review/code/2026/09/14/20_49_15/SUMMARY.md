# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — trigger.config lost-update(인입 웹훅 서명 검증 fail-open) 자체는 5라운드에 걸쳐 advisory lock + 락 안 재읽기로 완전히 닫혔음을 다수 reviewer 가 소스 대조로 확인했다. 다만 이번 라운드가 새로 추가한 `remove()` 의 config-lock 배선이 (a) 그 "순서 보증"을 지키는 테스트 없이 138건 전건 GREEN, (b) 상한 없는 락 대기를 되돌릴 수 없는 정리 작업 뒤에 신설, (c) secret store/외부 provider 상태까지는 원자성이 미치지 않아 삭제-동시-rotate 경합 시 고아 자원을 만들 수 있음 — 이 셋이 겹쳐 신규 WARNING 4건(concurrency·side_effect·testing×2)을 만들어 냈다. forced 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `remove()` 의 config-lock 참여로 **trigger 행**의 삭제-경합은 닫혔지만, 그보다 먼저(락 밖에서) 실행되는 **secret store 쓰기**(`secrets.rotate`)와 **provider 쪽 webhook 등록**(`adapter.setupChannel`)은 advisory lock 의 보호 범위 밖이다. `rotateBotToken`/`setupChatChannel` 이 이 두 부작용을 만드는 도중 동시 `DELETE` 가 `teardownChatChannel`+`deleteByPrefix`(정리, 락 밖에서 한 번만 실행)를 먼저 끝내면, 그 뒤에 생성된 secret row 와 provider 등록은 영구히 고아로 남는다 — `config` 컬럼 자체는 보호되지만 원자성 경계가 다른 자원으로 옮겨갔을 뿐. | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:138,158,244,257` / `triggers.service.ts:945,950(teardown/deleteByPrefix, 락 이전) vs :1146-1192(rotate 쓰기, 락 이전)` | 후속 등재. (a) `rewriteTriggerConfigLocked`가 `false` 반환 시 방금 쓴 secret ref 를 스스로 정리, 또는 (b) `remove()` 가 정리 작업보다 먼저 락을 잡아 "삭제 결정"을 커밋한 뒤에만 정리 진행하도록 순서 재설계(단, 외부 호출을 락 밖에 두는 기존 제약과 상충 — 별도 설계 검토 필요) |
| 2 | side_effect | `remove()`(`889c93cd9`)가 되돌릴 수 없는 외부 부작용(`teardownChatChannel`·listener unregister·`secrets.deleteByPrefix`)을 **먼저** 끝낸 뒤에야, **상한 없는(lock_timeout 미설정)** advisory lock 대기를 마지막 DB 삭제 단계에 새로 추가했다. 락 보유자의 트랜잭션이 예기치 못하게 길어지는 사고(커넥션 풀 고갈·GC 정지 등) + 그 사이 삭제 요청 타임아웃/프로세스 재시작이 겹치면, 리소스는 다 뜯겼는데 trigger 행은 DB 에 남는 "반쯤 삭제된" 상태가 될 수 있다. | `codebase/backend/src/modules/triggers/triggers.service.ts:932-963` | 삭제 경로에 한해 `SET LOCAL lock_timeout` 적용, 또는 (2)~(4)의 외부/영구 부작용을 (5) DB 삭제 성공 확인 뒤로 순서 변경. 최소한 실패 시 반쯤-삭제 상태를 감사 로그에 남길 것 |
| 3 | testing | `remove()` 의 "락을 먼저 잡고 삭제한다"는 순서 자체를 검증하는 테스트가 없다 — 뮤테이션으로 락 획득과 `m.remove()` 순서를 뒤집어도 스위트 138건 전건 GREEN(원복 확인 완료). 존재만 확인하는 단언(`lockKeys` 포함 여부, `repo.remove` 호출 여부) 뿐이라 이 커밋의 핵심 보증(순서)을 안 지킨다. | `codebase/backend/src/modules/triggers/triggers.service.ts:960-963` / `triggers.service.spec.ts:3823-3834` | `onLock`/`onRemove` 콜백을 공유 순서 배열에 함께 기록하거나 `mock.invocationCallOrder` 로 lock→remove 순서를 직접 단언하는 테스트 추가 |
| 4 | testing | binder 성공 경로의 `if (wrote) { channelListenerRegistry.register(...) }` 게이트(삭제 경합 시 유령 listener 등재 방지용, 4라운드에서 도입)가 어떤 테스트로도 행사되지 않는다 — 게이트를 통째로 제거해도 302건 전건 GREEN(원복 확인 완료). `.register(` 호출 자체를 단언하는 테스트가 프로젝트 전체에 0건. | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:286-291` | `makeService([withRef, () => undefined as never])` 조합으로 binder 재읽기만 삭제된 상황을 만들어 `patchChatChannel` 호출 후 `register` 미호출을 단언하는 테스트(양성 케이스 포함) 추가 |
| 5 | maintainability | `{ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' }` 에러 리터럴이 이번 델타로 2곳→4곳으로 늘었다(`findByIdForUpdate` 신설, `rotateBotToken` 삭제-경합 방어) — 이 PR 스스로 반복 문서화한 "복제가 drift 를 부른다"는 교훈과 정면 배치. | `codebase/backend/src/modules/triggers/triggers.service.ts:352-357, 482-487, 616-621, 1224-1229` | `assertTriggerFound<T>(row: T \| null): T` 같은 소형 헬퍼로 네 자리 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 같은 클래스(무가드 full-entity `save()`)의 lost-update 위험이 `rotateNotificationSecret` 등 7개 자리에 더 있음 — 이번 PR 은 미해결이나 plan 문서가 이미 전수 스캔(21건 중 8곳)으로 투명하게 추적·유예 중 | `triggers.service.ts` (`rotateNotificationSecret` 등) | 후속 PR 에서 순회 |
| 2 | requirement | `rotateBotToken` 의 secret-store 쓰기가 `rewriteTriggerConfigLocked` 삭제 가드보다 먼저 실행 — 동시 `remove()` 와 겹치면 고아 secret row 가능(데이터 손상·보안 영향 없음) | `triggers.service.ts:1159` vs `:960-963` | 후속에서 `deleteByPrefix` 도 config 락 안으로 고려 |
| 3 | architecture | `rewriteTriggerConfigLocked` 가 `Trigger` 엔티티에 하드코딩돼 plan 이 예고한 다른 엔티티(hooks/schedules) 재사용 불가 | `trigger-config-lock.ts:106-143` | 후속 착수 시 제네릭화(`rewriteEntityConfigLocked<T>`) |
| 4 | architecture | 같은 `Trigger` 애그리게잇에 두 가지 쓰기 동시성 스타일(lock-only 인라인 2곳 vs `rewriteTriggerConfigLocked` 위임 3곳)이 공존 | `triggers.service.ts:572-624,960-963,1208` / `chat-channel-binder.service.ts:266,310` | `withTriggerConfigLock(manager, id, cb)` 소형 헬퍼로 락 획득 지점 통합 검토 |
| 5 | architecture | 정적 가드 `isManagerTriggerSave` 가 엔티티 식별을 문자열 이름 매칭으로 확장(타입체커 미사용) — 별칭 import 시 false negative/positive 가능 | `repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:160-170` | 조치 불요, `TRIGGER_ENTITY` 옆에 한계 주석 권고 |
| 6 | architecture | `ChatChannelBinderService.setupChatChannel` 이 로컬 클로저 2개(`survivesWithFresh`,`buildChannel`) 추가로 단일 메서드 책임 증가(236줄) | `chat-channel-binder.service.ts:87-323` | 순수 로직을 `chat-channel-input-rules.ts` 로 이동 검토 |
| 7 | architecture | 트랜잭션 mock 헬퍼가 6개 소비처 중 2곳에만 배선, 나머지 4곳은 주석으로만 안전성 예고 | `trigger-transaction-mock.ts:27-40` | 조치 불요(문서화됨), 여유 있으면 선제 적용 |
| 8 | performance | trigger.config 쓰기 경로 전부에 advisory-lock 왕복이 추가돼 PATCH/rotate 요청당 DB 왕복 약 2배(4회→8회) — 구조적으로 필요한 비용, 관리 작업 빈도상 수용 가능 | `trigger-config-lock.ts:39-46`, 각 호출부 | 대량 동시 PATCH 유입 경로 생기면 용량 계획에 반영 |
| 9 | performance/database/concurrency | advisory lock 에 `lock_timeout` 없음(무한 대기) — 이미 여러 라운드에 걸쳐 수용된 트레이드오프, 임계구간이 짧다는 전제로 감당 가능(단, WARNING#2 가 지적한 삭제 경로는 예외) | `trigger-config-lock.ts:39-46` | 향후 임계구간에 외부호출/긴 계산 추가 시 `lock_timeout` 적용 |
| 10 | security | `rewriteTriggerConfigLocked` 가 `triggerId` 만 받고 workspace 소유권을 자체 검증하지 않음 — 현재 호출부 전량 안전(사전 검증된 id 만 전달) | `trigger-config-lock.ts` (`m.findOne` where 절에 workspaceId 없음) | 여력 있으면 선택적 `workspaceId` 파라미터 추가 또는 JSDoc 전제 명시 |
| 11 | maintainability | `findByIdForUpdate` 가 `findById` 와 거의 동일 몸체 반복(관계 유무만 차이) | `triggers.service.ts:347-359 vs 475-489` | WARNING#5 헬퍼와 함께 통합 |
| 12 | maintainability | 테스트 유틸 `withTransactionMock` 의 "위임 아니면 fallback" 클로저가 3→4개로 증가 | `trigger-transaction-mock.ts:89-112` | 급하지 않음, 5번째 메서드 필요 시 팩토리화 검토 |
| 13 | testing | `hooks.service.spec.ts` 두 회귀 테스트 제목이 서로 다른 describe 안에서 글자 그대로 동일 | `hooks.service.spec.ts:201, 810` | 필수 아님, call site 명시 권고 |
| 14 | testing | repo-guard `isManagerTriggerSave` 가 `Entities.Trigger` 같은 네임스페이스 한정 식별자는 못 잡음 | `endpoint-path-conflict-wrap-guard.ts` | 조치 불요, 실제 관례 생기면 fixture 추가 |
| 15 | documentation | plan 체크리스트 마지막 세 항목 + 원 트래커 항목이 여전히 `[ ]` — plan 자체 정지 규칙(codebase 수정 0 라운드) 미충족이 이유, 결함 아님 | `plan/in-progress/trigger-config-lost-update.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md:2278` | clean 라운드 도달 시 `plan/complete/` 이동 전 체크박스 갱신 |
| 16 | dependency | 리뷰 중 리뷰 대상과 무관한 워킹트리 dirty 변경(`chat-channel-binder.service.ts`, `wrote` 가드 제거 뮤테이션으로 추정) 관측 — 커밋 diff 에는 미포함, 본 리뷰어는 원복 시도 안 함 | `chat-channel-binder.service.ts` (untracked) | push 전 `git status --short` 로 이 dirty 상태 해소 여부 확인 필요 |
| 17 | api_contract | `update()` 가 특정 삭제-경합 race 에서 이제 404(RESOURCE_NOT_FOUND) 반환 — 이전엔 삭제된 행을 조용히 부활시켰음. 기존 에러 형태 재사용, breaking change 아님 | `triggers.service.ts` (`if (!fresh) throw NotFoundException`) | 별도 조치 불요, 여유 있으면 spec §5.4 에 race 경로 한 줄 추가 |
| 18 | scope/user_guide_sync/dependency/api_contract | 스코프 이탈·매트릭스 미매칭·신규 의존성·계약 파괴 없음 확인(각 reviewer 개별 확인, 상세는 각 보고서 참조) | — | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 삭제 레이스도 이번 라운드에 락으로 닫힘, workspace 소유권 검증 전량 유지, 신규 시크릿/인젝션 없음 |
| performance | LOW | 이전 WARNING(중복 JOIN) 해소 확인, PATCH당 DB 왕복 2배 증가는 구조적 트레이드오프 |
| architecture | LOW | 이전 4라운드 지적 대부분 코드 구조로 흡수, 남은 것은 후속 확장성 관찰뿐 |
| requirement | LOW | 핵심 불변식(inboundSigningRef 보존) 실제 구현과 정확히 일치, 남은 갭은 스코프 밖 후속 |
| scope | NONE | 93개 파일 전수 대조, 스코프 이탈 없음 |
| side_effect | MEDIUM | 신규: `remove()` 의 되돌릴 수 없는 부작용 뒤 무한 락 대기 (WARNING#2) |
| maintainability | LOW | 이전 WARNING 2건 해소, 신규 에러 리터럴 복제 4곳으로 증가 (WARNING#5) |
| testing | MEDIUM | 신규 두 보증(remove 락 순서, wrote 게이트)이 존재만 검증되고 동작 미검증, 뮤테이션으로 실증 (WARNING#3,4) |
| documentation | NONE | 4라운드 전체 WARNING 해소 확인, 신규 결함 없음 |
| dependency | NONE | 신규 외부 의존성 0건, 단 무관 dirty 워킹트리 변경 관측(INFO#16) |
| database | LOW | 삭제 레이스·웹훅 hot path 갭 모두 해소, PK 기반 쿼리 적절 |
| concurrency | MEDIUM | 신규: trigger 행 lost-update는 닫혔으나 secret store/provider 상태로 원자성 경계 이동 (WARNING#1) |
| api_contract | NONE | 컨트롤러/DTO/라우트 변경 없음, 신규 404는 버그 수정 성격 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 검토, 매칭 0건 |

## 발견 없는 에이전트

없음(전 에이전트가 최소 INFO 이상 기록).

## 권장 조치사항
1. (WARNING#1, concurrency) secret store/provider 상태까지 걸친 삭제-동시-rotate 경합의 고아 자원 문제를 후속 plan 항목으로 등재 — 이번 배치는 막지 않되 누락 없이 트래커에 기록.
2. (WARNING#3, #4, testing) `remove()` 락 순서와 binder `wrote` 게이트에 대한 동작 검증 테스트를 추가해 이번 라운드가 만든 두 신규 보증이 다음 리팩터에 조용히 되돌려지지 않도록 한다.
3. (WARNING#2, side_effect) 삭제 경로의 무한 락 대기 문제 — `lock_timeout` 적용 또는 부작용 순서 변경을 검토.
4. (WARNING#5, maintainability) `RESOURCE_NOT_FOUND` 에러 리터럴 4곳 중복을 헬퍼로 통합해 이 PR 이 스스로 강조한 "복제가 drift 를 부른다" 교훈을 코드에 반영.
5. (INFO#16, dependency) push 전 워킹트리에 무관한 dirty 변경(`chat-channel-binder.service.ts`)이 남아있지 않은지 `git status --short` 로 재확인.
6. (INFO#15, documentation) 이번 라운드가 codebase 수정 없이 clean 하게 끝나면(즉 다음 라운드부터), plan 체크리스트와 원 트래커의 잔여 `[ ]` 를 갱신하고 `plan/complete/` 이동을 진행.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer 실행(14명 전원 성공, forced 화이트리스트 7개 — documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 확인됨. forced 인데 결과 없는 항목 없음).