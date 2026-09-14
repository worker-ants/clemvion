# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `rotateBotToken` 의 "네 번째 자리(lost-update)" 수정이 실제로는 닫히지 않았다: `mergeIntoFreshSubKey` 에 델타가 아니라 함수 시작 시점 전체 스냅샷을 `patch` 로 넘겨, 락 안에서 재읽은 `chatChannel` 의 다른 서브필드(`rateLimitPerMinute`·`uiMapping`·`languageLocale`)가 동시 PATCH 값을 잃고 스냅샷으로 되돌아간다 — 이 PR 전체가 닫으려는 것과 **같은 클래스의 lost-update** 가 재발한다. 다만 `inboundSigningRef`(웹훅 서명 검증, 이 PR 의 핵심 보안 목표)는 `buildSecretRef` 가 입력 3요소만으로 결정되는 **결정적 계산**이라 두 경로가 우연히 같은 값을 내어 실제로는 어긋나지 않는다 — 즉 fail-open 재발이라는 최초 보안 결함 자체는 재현되지 않으나, "네 번째 자리를 닫았다"는 커밋·plan 의 완결 주장은 비-보안 필드에 대해 사실이 아니다. 신규 회귀 테스트도 두 상태에 겹치는 키를 두지 않아 이 결함을 못 잡는 vacuous 케이스다. side_effect·maintainability 두 리뷰어가 독립적으로 코드 추적(및 순수 로직 재현 실측)으로 확인했다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Maintainability | `rotateBotToken()` 이 `mergeIntoFreshSubKey(freshConfig, 'chatChannel', mergedChannel, mergedChannel)` 처럼 `patch` 와 `fallback` 에 **같은 전체 스냅샷 객체**(`mergedChannel`, 함수 시작 시점 `chatChannelCfg` 를 스프레드한 것)를 넘긴다. 정상 호출부(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`)는 모두 `patch` 를 이번 요청이 실제로 바꾼 필드만으로 좁히는데 이 자리만 그렇지 않아, 락 안 재읽기로 얻은 `chatChannel` 의 다른 필드(요청 시작 이후 동시 PATCH 가 바꾼 값)가 무조건 스냅샷 값으로 덮인다. 순수 로직 재현 실측: 시작 시점 `rateLimitPerMinute=30`→동시 PATCH 로 `99`→최종 저장값 `30`(되돌아감). 신규 회귀 테스트(`triggers.service.spec.ts:4082-4110`)는 시작 시점 스냅샷에 아예 그 키가 없는 구성이라 "필드가 새로 생긴" 경우만 검증해 이 실패 모드를 못 잡는 vacuous fixture다. | `codebase/backend/src/modules/triggers/triggers.service.ts:1314-1320`(`rotateBotToken` 의 `mergeIntoFreshSubKey` 호출), 대조군 `:868-874`·`:1149-1154`·`:1432-1437`; 테스트 `triggers.service.spec.ts:4082-4110` | `patch` 를 이번 회전이 실제로 산출한 필드만으로 좁힌다 — 예: `{ botTokenRef, ...(result.configUpdates ?? {}), ...(issuedInboundSigning ? { inboundSigningRef } : {}) }`, `fallback` 자리에만 `mergedChannel` 유지. 회귀 테스트는 시작 시점 스냅샷과 락 안 재읽기 양쪽에 **같은 키를 다른 값**(예: `rateLimitPerMinute: 30` vs `99`)으로 채워 최종값이 `99`(동시 PATCH 값)를 보존하는지 단언해야 "네 번째 자리"가 실제로 닫혔다고 주장할 수 있다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `rotateNotificationSecret()` 이 advisory lock 도메인 밖에서 컬럼 한정 `update()` 만 수행한다. `TriggersService.update()`(창 1)가 advisory lock 안에서 재읽은 행(`notificationSecretV2`/`notificationRotatedAt` 포함)을 `m.save(Trigger, target)` 로 통째로 저장하는 시점과 경합하면, 방금 회전시킨 알림 서명 시크릿이 옛 값으로 조용히 원복될 수 있다 — 이 PR 이 `inboundSigningRef` 에 대해 닫은 것과 같은 형태의 결함이 인접 보안 컬럼에 남아 있다. plan `§후속` 표가 "보안 성격" 잔여 gap 으로 이미 등재해 둔 항목(새 발견 아님, 재확인). | `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateNotificationSecret()` 의 `triggerRepository.update()` 호출부 vs `update()` 창 1 의 `m.save(Trigger, target)` | 후속 PR 에서 `rotateNotificationSecret()` 도 같은 advisory lock 을 잡거나, 창 1 의 `m.save` 가 `notificationSecretV2`/`notificationRotatedAt` 를 재대입하기 전에 그 두 컬럼만 다시 읽어 보존하도록 좁힌다. plan 후속 우선순위에서 이 항목이 밀리지 않도록 가시성 유지 권고. |
| 2 | Performance | `promoteRotatedNotificationSecrets` cron 이 트리거당 advisory lock+재읽기 트랜잭션(왕복 ~4회)을 새로 추가했는데, 여전히 `getMany()` 로 후보 전체를 상한 없이 적재해 순차(`for...await`) 처리한다 — 기존 N+1 형태 루프에 상수 배 비용이 곱해져, 백로그가 커지면 사이클 실행 시간이 더 가파르게 증가한다. | `codebase/backend/src/modules/triggers/triggers.service.ts:1363-1443`(`promoteRotatedNotificationSecrets`) | 지금 막을 사유는 아님. 사이클 실행 시간이 관측되면 `getMany()` 에 `take(N)` 상한을 걸거나, 트리거마다 락 키가 달라 병렬 처리를 막는 것은 락이 아니므로 `Promise.allSettled` 배치 병렬화를 후속 검토. |
| 3 | Documentation | `create()`/`update()` 의 주석이 `setupChatChannel` 의 쓰기 메커니즘을 "별도 `triggerRepository.update`" 로 서술하는데, 이번 PR 로 실제로는 `rewriteTriggerConfigLocked()`(advisory lock + 트랜잭션 + 락 안 재읽기)로 완전히 바뀌었다. 재조회가 필요하다는 결론 자체는 참이라 동작 결함은 아니나, 메커니즘 서술이 코드와 어긋나 다음 사람이 락/트랜잭션 유무를 오판할 수 있다. plan `§D` INFO#7 로 이미 "결론은 참, 낮은 우선순위"로 등재됨(재확인). | `codebase/backend/src/modules/triggers/triggers.service.ts:512-514`(`create()`), `:706-708`(`update()`) | `별도 triggerRepository.update` → `rewriteTriggerConfigLocked (advisory lock 안 재읽기·머지)` 로 문구 갱신. 이 배치를 막을 사유는 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Concurrency | `cleanupRotatedChatChannelTokens` cron 이 조건 없이 `chatChannelTokenV2`/`chatChannelRotatedAt` 을 `null` 로 쓴다 — 동시 `rotateBotToken` 이 커밋한 새 v2 토큰을 지울 수 있다(발생 창 좁음). plan §후속(8라운드 W2)에 조건부 `WHERE` 해법과 함께 이미 등재, 재확인. | `triggers.service.ts:1487-1493`(`cleanupRotatedChatChannelTokens`) | 조치 불요(추적됨). |
| 2 | Security | `SET LOCAL lock_timeout = '${Math.trunc(...)}ms'` — 파라미터 바인딩 불가 자리의 문자열 보간. 실호출부는 모듈 상수 하나뿐이라 현재 인젝션 위험 없음. 향후 임의 값이 들어오는 재사용에 대비 방어적 가드 권고. | `trigger-config-lock.ts` `acquireTriggerConfigLock()` | 조치 불요(현재 안전). 재사용 확대 시 `Number.isInteger` 가드 또는 JSDoc 경고 추가 검토. |
| 3 | Concurrency / Database | `SchedulesService.update()`(`name`/`isActive` 컬럼 한정 update) · `rotateNotificationSecret()` 은 advisory lock 도메인 밖이라, `TriggersService.update()` 창 1(전체 엔티티 `save`)과 경합하면 그 커밋을 되돌릴 수 있다. plan §후속(8·9라운드)에 이미 실측·등재되어 "이 PR 로 넓히지 않는다"로 유예된 상태 재확인. | `schedules.service.ts:234-246`, `triggers.service.ts:1085-1093`(`rotateNotificationSecret`) | 조치 불요(추적됨, 유예 유효). |
| 4 | Database | `SchedulesService.update()` 의 trigger 컬럼 갱신과 schedule 저장이 여전히 하나의 트랜잭션으로 묶여 있지 않아, schedule 저장 실패 시 trigger 쪽만 반영된 부분 커밋이 남을 수 있다(이번 PR 이전부터의 상태, 영향 낮음). | `schedules.service.ts` `update()` | 급하지 않음. 후속 정리 시 `dataSource.transaction()` 으로 두 쓰기를 묶는 것을 고려. |
| 5 | Architecture | `Trigger` 애그리게잇에 대한 "락 도메인 참여 여부" 판단이 `TriggersService` 내부뿐 아니라 `SchedulesService` 라는 다른 모듈까지 걸쳐 각자 판단으로 흩어져 있다(9라운드 지적의 범위 확장 재확인). 현재는 침해 필드가 없어 안전하나 판단 기준이 산문 주석에만 존재. `schedules.service.ts:241` 의 `Partial<Pick<Trigger,'name'\|'isActive'>>` 타입 좁히기는 이를 부분적으로 컴파일 타임에 강제하는 좋은 사례. | `schedules.service.ts:33-34, 216-247` | 조치 불요. 장기적으로 `TriggersService` 를 `Trigger` 의 유일한 쓰기 관문으로 만드는 것을 plan §후속에 추가할 만함. |
| 6 | API Contract | `chatChannel` 포함 PATCH 가 극히 좁은 삭제-경합 창에서 200+구(stale) 바디를 반환할 수 있다(이월된 저위험 항목, 이미 팀이 수용). | `chat-channel-binder.service.ts` `setupChatChannel()` 두 경로, `triggers.service.ts` `update()` 재조회 폴백 | 조치 불요(이월). 다음에 이 표면을 손댈 때 binder 반환값을 관측해 404/409 로 드러낼지 재검토. |
| 7 | API Contract | `DELETE /api/triggers/:id` 에 신규 실패 모드(advisory lock 5초 타임아웃)가 추가됐고, 기존 관례대로 일반 500 `INTERNAL_ERROR` 로 마스킹돼 클라이언트가 "재시도 가능 경합"과 "진짜 오류"를 구분할 수 없다(의도적 트레이드오프, 문서화됨). | `trigger-config-lock.ts`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`), `triggers.service.ts` `remove()` | 조치 불요. 관측되면 `55P03` 을 409 `RESOURCE_CONFLICT` 로 명시 매핑하는 것을 백로그에 등재할 만함. |
| 8 | Testing | `withTransactionMock` 의 idempotence 이른-반환 분기(`if (triggerRepoMock.manager) return`)가 어떤 테스트에서도 도달하지 않는 dead branch. | `__test-utils__/trigger-transaction-mock.ts` | 전용 테스트 1개 추가하거나 JSDoc 에 "사용처 없음" 명시. |
| 9 | Testing | `SchedulesService.update()` 의 `name`+`isActive` **동시** 변경 조합이 테스트되지 않는다(단독 케이스만 존재). | `schedules.service.spec.ts` (490~533행 부근) | `{ name, isActive }` 동시 변경 케이스 1개 추가해 두 필드가 함께 patch 에 실리는지 단언. |
| 10 | Testing | 동일 테스트 제목("lastTriggeredAt 갱신이 config 를 다시 쓰지 않는다 (컬럼 한정 update)")이 서로 다른 `describe` 블록에 중복돼 있어, 제목만 평평하게 나열하는 CI 도구에서 두 실패가 구분되지 않는다. 과거 라운드가 "한쪽만 회귀 테스트를 가져 다른 쪽이 되돌려져도 GREEN" 이라고 지적한 바로 그 두 자리라 추적 중요도가 높다. | `hooks.service.spec.ts:201, :810` | 제목에 `(handleWebhook)`/`(chat-channel)` 구분자 추가. |
| 11 | Dependency | 신규 서브패스 import `typeorm/query-builder/QueryPartialEntity` 는 typeorm 의 공식 public export 가 아닐 수 있어, 향후 `^0.3.31` 범위 내 minor/patch 업그레이드 시 경로가 이동하면 빌드가 깨질 수 있다. `withTransactionMock` 은 6개 대상 파일 중 2개에만 적용됨(저자 문서화, 나머지 4개가 트랜잭션 경로를 타는 순간 결합점 발생). | `trigger-config-lock.ts` import 문; `trigger-transaction-mock.ts` JSDoc | 즉각 조치 불요. 다음 typeorm 업그레이드 시 import 경로 유효성 확인 체크리스트에 추가. |
| 12 | User Guide Sync | 웹훅 서명 검증(`inboundSigningRef`) 관련 수정이 `auth-session-flow-change` 매트릭스 행과 "인증"이라는 단어로 표면적으로 인접하나, 실제로는 로그인/팀 권한 흐름이 아니라 채널별 웹훅 서명 검증의 동시성 버그 수정이라 미매칭 판정. | `chat-channel-binder.service.ts`, `triggers.service.ts` | 별도 조치 불요. 웹훅 서명/채널 설정 UI 자체가 바뀌는 후속 PR 이 나오면 그때 동반 갱신 여부 재판정. |
| 13 | Scope | 이번 PR 전체가 원 스코프("동시 PATCH lost-update")에서 "같은 결함 클래스의 21개 후보 중 8개 write-site + 웹훅 hot path 2자리"로 확장됐으나, 매 확장이 자체 실측 또는 리뷰 라운드 지적으로 강제된 것이며 plan 문서에 근거가 남아 있다. 최신 커밋(`833bb745a`)의 diff 도 커밋 메시지 주장과 정확히 일치. | `plan/in-progress/trigger-config-lost-update.md` §"같은 클래스의 자리가 넷보다 많다" | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `rotateNotificationSecret` 락 도메인 밖(WARNING, 추적됨), cleanup null-write(INFO, 추적됨) |
| performance | LOW | 인입 hot path/schedule 편집 쓰기 폭 축소(개선), cron 루프 상수 비용 증가(WARNING) |
| architecture | LOW | Trigger 애그리게잇 단일 쓰기 관문 부재가 모듈 경계까지 확장(INFO) |
| requirement | NONE | 직전 라운드 Critical/Warning 이 코드상 닫힌 것으로(표면적으로) 확인 — 단, 아래 side_effect/maintainability 가 그 확인이 불완전했음을 실측으로 반증 |
| scope | NONE | 확장된 범위 전부 같은 근본원인의 정당한 발현, 무관한 변경 없음 |
| side_effect | **CRITICAL** | `rotateBotToken` 의 lost-update 수정 미완성 — 델타 대신 전체 스냅샷을 patch 로 사용 |
| maintainability | MEDIUM | 위와 동일 결함, narrow-patch 계약 위반으로 서술(WARNING) + 긍정 확인(orphan JSDoc 해소 등) |
| testing | LOW | 미행사 분기·조합 케이스 누락·제목 중복 등 INFO 다수, 핵심 경로 커버리지 갭 없음 |
| documentation | LOW | 주석 1건이 실제 쓰기 메커니즘과 어긋남(WARNING, 추적됨), 그 외 JSDoc/CHANGELOG 품질 우수 |
| dependency | NONE | 신규 외부 의존성 0건, 서브패스 import 1건 INFO |
| database | LOW | 삭제 레이스 해소 확인, schedules 두 쓰기 비원자성(INFO) |
| concurrency | LOW | advisory lock 설계 데드락 위험 없음, 잔여 경합 전부 plan 에 유예 등재 재확인 |
| api_contract | LOW | 컨트롤러/DTO/라우트 미변경, 이월된 저위험 항목 2건(INFO) |
| user_guide_sync | NONE | 매트릭스 21개 trigger 중 매칭 0건 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 1건 이상의 INFO/WARNING/CRITICAL 관찰을 보고함. `requirement`·`scope`·`dependency`·`user_guide_sync` 는 위험도 NONE 이나 확인 목적의 INFO 를 남김)

## 권장 조치사항

1. **[최우선]** `rotateBotToken()` 의 `mergeIntoFreshSubKey` 호출을 다른 세 정상 호출부와 같은 narrow-patch 패턴으로 고친다 — `patch` 를 이번 회전이 실제로 산출한 필드(`botTokenRef`, `result.configUpdates`, 조건부 `inboundSigningRef`)만으로 좁히고 `mergedChannel` 은 `fallback` 자리에만 남긴다.
2. 위 수정에 맞춰 회귀 테스트(`triggers.service.spec.ts:4082-4110`)를 "시작 시점 스냅샷과 락 안 재읽기 양쪽에 같은 키를 다른 값으로" 채우는 판별 가능한 fixture 로 다시 작성해, 패치를 다시 전체 스냅샷으로 되돌리는 뮤테이션이 RED 가 되는지 확인한다.
3. (후속, 이번 배치 비차단) `rotateNotificationSecret()` 을 advisory lock 도메인에 포함시키거나 창 1 의 `m.save` 가 알림 시크릿 컬럼을 재대입 전에 재보존하도록 좁힌다 — plan 이 이미 "보안 성격" 으로 표시해 둔 항목.
4. (후속, 이번 배치 비차단) `create()`/`update()` 의 stale 주석(`별도 triggerRepository.update`)을 `rewriteTriggerConfigLocked` 로 갱신.
5. (후속, 저위험) `promoteRotatedNotificationSecrets` cron 의 순차 처리에 상한(`take(N)`) 또는 배치 병렬화를 백로그에 등재.
6. (후속, 저위험) 테스트 INFO 3건(`withTransactionMock` dead branch, schedules 동시 변경 조합, hooks 테스트 제목 중복) 정리.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success, 전원 결과 파일 확보)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)