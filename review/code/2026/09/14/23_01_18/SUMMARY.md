# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 결함(`trigger.config` 동시 PATCH lost-update → 인입 웹훅 서명 검증 fail-open)은 9라운드에 걸쳐 advisory lock + 락 안 재읽기로 실제로 닫혔음을 다수 reviewer 가 소스 직접 대조로 확인했다. 다만 이번(9번째) 라운드에서 testing 리뷰어가 **CRITICAL 1건**(이 PR 이 스스로 세운 검증 기준에서 유일하게 빠진 자리 — `cleanupRotatedChatChannelTokens` 의 쓰기 전환에 회귀 테스트가 없고, 뮤테이션 실측 결과 이 PR 이 막으려는 것과 정확히 같은 클래스의 lost-update 를 그 자리에 재현해도 전건 GREEN)을 발견했다. 또한 concurrency 리뷰어가 같은 결함 클래스의 **잔여 두 갈래**(`rotateBotToken` 의 `chatChannel` 비-보안 필드, `SchedulesService.update()` 의 트리거 `isActive`/`name` 동기화)가 advisory lock 도메인 밖에 남아 있음을 지적했다 — 둘 다 보안 우회는 아니지만 사용자가 관측 가능한 설정을 좁은 창에서 조용히 잃을 수 있다. CRITICAL 은 국소적(테스트 1개 추가로 해소 가능)이지만, 이 PR 이 "일곱 자리 모두 닫혔다"고 선언한 완결 주장의 정확성에 영향을 주므로 완결 선언 전 해소를 권고한다.

**router 강제 화이트리스트 이행 확인**: `forced` 로 지목된 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원의 결과가 확보되었다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `cleanupRotatedChatChannelTokens` 의 `save()`→`update()` 전환(이 PR 의 핵심 수정과 동일한 결함 클래스)에 동작 테스트가 전혀 없다. 뮤테이션 실측: `update()` 형태는 유지한 채 patch 에 `config: trigger.config`(스냅샷)만 몰래 추가해도 — 즉 이 PR 이 막으려는 fail-open 을 정확히 이 자리에서 재현해도 — `npx jest src/modules/triggers src/repo-guards` 25 suites 전건 GREEN. 정적 래칫(`EXPECTED_UNWRAPPED_TRIGGER_SAVES`)은 `.save(` 호출 자체만 스캔해 `save()` 로의 완전 회귀는 잡지만 `.update(` patch 내용물은 보지 않는다 | `codebase/backend/src/modules/triggers/triggers.service.ts:1474-1480` (`cleanupRotatedChatChannelTokens`); 대응 테스트 부재 — `triggers.service.spec.ts` 에 이 메서드를 호출하는 `describe`/`it` 0건 (grep 실측) | 형제 6개 전환 자리와 동일한 패턴으로 `describe('TriggersService.cleanupRotatedChatChannelTokens', ...)` 추가: ① `triggerRepo.save` 미호출 단언 ② `triggerRepo.update` 의 patch 가 `{chatChannelTokenV2, chatChannelRotatedAt}` 두 키만 갖는다는 `Object.keys(patch)` 단언 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `rotateBotToken()` 이 `chatChannel` 을 락 안에서 통째로 교체하는데, 그 값(`mergedChannel`)이 **락 획득 이전에 읽은 스냅샷** 기반이다. `inboundSigningRef` 축은 닫혔지만 `uiMapping`/`rateLimitPerMinute`/`languageLocale`/`languageHints` 등 사용자가 PATCH 로 바꿀 수 있는 다른 필드는 여전히 lost-update 노출 — 이 PR 이 이미 세 자리(`mergeIntoFreshSubKey`)에서 고친 것과 같은 축의 결함이 네 번째 자리에 남아 있다 | `triggers.service.ts` `rotateBotToken()` — `mergedChannel` 계산부 및 `(freshConfig) => ({ ...freshConfig, chatChannel: mergedChannel })` 병합 콜백 | `mergeIntoFreshSubKey` 와 같은 원리로 재읽은 `freshConfig.chatChannel` 을 베이스로 삼고 그 위에 이번 회전 산출 필드만 얹도록 변경. 회귀 테스트는 `chatChannel` 에 `rateLimitPerMinute` 같은 차별화 필드를 넣어 두 상태가 다르게 판정되도록 설계 |
| 2 | concurrency | `SchedulesService.update()` 의 trigger `name`/`isActive` 컬럼 동기화(`triggerRepository.update`)가 `trigger-config` advisory lock 도메인 **밖**에 있어, `TriggersService.update()` 창 1의 전체 엔티티 저장(`m.save(Trigger, target)`)과 경합하면 방금 커밋된 `isActive` 변경이 조용히 되돌아갈 수 있다(스케줄에서 비활성화했는데 무관한 트리거 PATCH 가 거의 동시에 오면 활성 상태로 복원) | `codebase/backend/src/modules/schedules/schedules.service.ts` `update()`; `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 창 1 | plan 8라운드 후속 표(`rotateNotificationSecret` W4 항목)와 같은 클래스로 `SchedulesService.update()` 의 이 write 를 명시 등재. 근본 수정은 이 write 도 `acquireTriggerConfigLock` 을 잡거나, 창 1을 컬럼 단정 갱신으로 전환하는 후속에서 함께 닫기 |
| 3 | side_effect | `update()` 가 `chatChannel` 없이 `normalization` 만 도는 경로에서, API 응답이 **DB 에 실제로 커밋된 값보다 오래된 `notification` 서브키**를 돌려줄 수 있다 — `mergeIntoFreshSubKey` 가 DB 쓰기값은 정확히 병합하지만, 응답에 실리는 in-memory 값(`trigger.config.notification`)은 락 이전 스냅샷 그대로다. lost-update 를 DB 레벨에서 닫으면서 "응답은 항상 방금 쓴 값과 같다"는 이전의 암묵적 불변식이 깨졌다(read-after-write 불일치, 보안 영향 없음, 발생 빈도 낮음) | `codebase/backend/src/modules/triggers/triggers.service.ts` `normalizeNotificationSecretRef`(852-874) 및 호출부 `update()` 648-650/674 | (a) 모든 config-쓰기 헬퍼 호출 뒤 재조회 통일, (b) `normalizeNotificationSecretRef` 가 병합된 `notification` 값을 반환하도록 시그니처 변경, 또는 (c) 최소한 plan 후속 표에 등재 |
| 4 | performance | 24h grace 승격/정리 cron 스윕(`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)이 행마다 `rewriteTriggerConfigLocked` 로 새 트랜잭션+lock+재조회를 열어 행당 DB 왕복이 최소 5회(기존 대비 약 1.7~2배)로 늘었고, 순차 처리 구조는 그대로라 배치 크기에 비례해 스윕 소요 시간이 커진다(대량 회전 이벤트 시 체감) | `triggers.service.ts:1352`(`promoteRotatedNotificationSecrets`), `:1441`(`cleanupRotatedChatChannelTokens`) 루프 | 급하지 않음. 후속으로 (a) 트리거 간 소규모 동시성 제한(5~10개)으로 병렬화, (b) 후보 집합이 임계치를 넘으면 로그로 백로그 관측 가능하게 하는 것을 고려 |
| 5 | maintainability, documentation | `mergeIntoFreshSubKey` 삽입 과정에서 기존 `throwTriggerNotFound()` JSDoc 이 그 함수와 분리되어 엉뚱하게 `mergeIntoFreshSubKey()` 위에 붙는 **orphan JSDoc** 이 됐다 — 이 PR 이 이미 두 차례(1라운드 `createBaseProviders`, 6라운드 `touchLastTriggeredAt`/`CCH-NF-03`) 자인·수정한 결함 클래스의 **세 번째 재발** | `codebase/backend/src/modules/triggers/triggers.service.ts:361-367`(orphan JSDoc), `:386`(`mergeIntoFreshSubKey` 실제 선언), `:400`(`throwTriggerNotFound` — JSDoc 없음) | JSDoc 블록을 `throwTriggerNotFound()` 정의(:400) 바로 위로 이동. 세 번째 재발이므로 "새 private 헬퍼는 파일 끝/관련 함수 바로 옆에 추가하고 기존 함수 사이에 끼워 넣지 않는다"는 편집 규칙을 체크리스트에 명시 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `promoteRotatedNotificationSecrets` 의 `promoted` 카운터가 삭제 경합으로 쓰기가 skip 돼도 증가한다 — cron 로그 문구만 영향, 데이터 무결성 무관 | `triggers.service.ts` `promoteRotatedNotificationSecrets`, `rewriteTriggerConfigLocked(...)` 반환값 미확인 | `if (wrote) promoted++;` 로 좁히기. 급하지 않음 |
| 2 | testing | `SchedulesService.update()` 의 "trigger 필드가 전혀 안 바뀌는 PATCH" 빈 patch 가드가 테스트로 행사되지 않음 | `schedules.service.ts:241-246` | `expect(triggerRepo.update).not.toHaveBeenCalled()` 대조군 테스트 추가. 급하지 않음 |
| 3 | maintainability | `mergeIntoFreshSubKey` JSDoc 이 `@param freshConfig` 누락 | `triggers.service.ts:382-384` | `@param freshConfig` 한 줄 추가 |
| 4 | maintainability | `trigger-config-lock.spec.ts` 의 이중 JSDoc 이 3라운드 연속 미병합 (이번 라운드 신규 결함 아님, 재확인) | `trigger-config-lock.spec.ts:27-33` | 두 블록 병합. 급하지 않음 |
| 5 | api_contract | `ChatChannelBinderService.setupChatChannel()` 성공/실패 두 경로가 삭제-경합 신호(`false`)를 관측하지 않아, `chatChannel` 포함 PATCH 가 극히 좁은 경합 창에서 이미 삭제된 리소스에 200+구버전 바디를 반환할 수 있음 — plan 에 이미 "수용·부분 수정"으로 명시적으로 기록된 팀의 의도적 판단 | `chat-channel-binder.service.ts:266-291`, `:310-321`; 호출부 `triggers.service.ts:700-717` | 배치를 막을 사유 아님. plan 서술에 "`create()` 와 달리 `update()` 는 대상 id 가 이미 공개돼 있어 근거 문구가 문언 그대로 성립하지 않는다"는 한 줄 보강 권고 |
| 6 | side_effect | `normalizeNotificationSecretRef` 가 `rewriteTriggerConfigLocked` 반환값(삭제 경합 시 `false`)을 관측하지 않음 — 형제 동기 경로(`revokePerTriggerToken`/`rotateBotToken`)와 다른 취급. 이미 더 넓은 후속 항목(5라운드 W1, secret store 원자성)에 사실상 포함되나 대상 목록에 이 함수가 명시되어 있지 않음 | `triggers.service.ts:864-874` | 후속 착수 시 그 항목 대상 목록에 `normalizeNotificationSecretRef` 추가 |
| 7 | documentation | `create()` 안의 두 주석("setupChatChannel 은 별도 triggerRepository.update 로...")이 실제 쓰기 경로(이 PR 로 `rewriteTriggerConfigLocked` 로 변경됨)를 더 이상 정확히 서술하지 않음 — 핵심 결론은 여전히 참이라 낮은 우선순위 | `triggers.service.ts:511`, `:705` | 다음 편집 시 "별도 rewriteTriggerConfigLocked (락 안 컬럼 갱신)" 으로 갱신 |
| 8 | security, performance, database (다수 라운드 누적 확인, 재확인만) | `SET LOCAL lock_timeout` 문자열 보간(인젝션 경로 없음, 호출부가 상수만 사용) · advisory lock 무제한 대기(설계상 임계구간이 짧다는 근거 명시) · 락 안 재조회가 `workspaceId` 미필터(호출부가 이미 인가 검증한 id 만 넘겨 실질 위험 없음) · cron 스윕 대상 컬럼에 인덱스 없음(pre-existing) | `trigger-config-lock.ts:39-63,107-117,151`; `trigger.entity.ts` 컬럼 정의 | 전부 조치 불요(실측상 착취 불가 또는 이미 인가된 범위, pre-existing). 후속 확장 시에만 고려 |
| 9 | dependency | 신규 외부 패키지·매니페스트 변경 0건. `typeorm` 비공개 서브패스 type import(`QueryDeepPartialEntity`)는 기존 선례(`workflows.service.ts`) 재사용, type-only 라 런타임 영향 없음 | `trigger-config-lock.ts:2` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | CRITICAL | `cleanupRotatedChatChannelTokens` 쓰기 전환에 회귀 테스트 부재 — 뮤테이션으로 실증 |
| concurrency | MEDIUM | `rotateBotToken`/`SchedulesService.update()` 두 자리에 같은 lost-update 클래스 잔존 |
| security | LOW | 핵심 fail-open 취약점 해소 확인, 잔여는 전부 실측상 착취 불가 |
| performance | LOW | cron 스윕 행당 DB 왕복 증가(WARNING), 그 외 hot path 개선 확인 |
| side_effect | LOW | `update()` 응답의 신선도 갭(WARNING) 신규 발견, 그 외 항목은 기수용 |
| maintainability | LOW | orphan JSDoc 세 번째 재발(WARNING), `mergeIntoFreshSubKey` 자체는 좋은 리팩터 |
| documentation | LOW | 동일 orphan JSDoc 재확인, CHANGELOG/plan 정확도는 높음 |
| database | LOW | "일곱 자리 전부 닫혔다" 주장 소스 대조로 검증 완료 |
| api_contract | LOW | 삭제-경합 200 반환 잔여(기수용 트레이드오프), 그 외 계약 변경 없음 |
| architecture | LOW | 8라운드 누적 검증 결과 재확인, 신규는 정적 가드 특수케이스 누적 정도 |
| requirement | NONE | CHANGELOG·코드 line-level 일치, typecheck/jest 전건 통과 확인 |
| scope | NONE | 이번 라운드 델타는 전부 직전 CRITICAL 수정 범위 내 |
| dependency | NONE | 신규 의존성·매니페스트 변경 없음 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 대조 매칭 0건 |

## 발견 없는 에이전트

scope, dependency, user_guide_sync — 전부 "검토했으나 문제 없음" 또는 매칭 0건으로만 판정.

## 절차 참고 (이슈 아님)

architecture·testing·documentation·database·concurrency·user_guide_sync 리뷰어가 각자 검토 도중 `triggers.service.ts` 가 일시적으로 다른 상태(예: `cleanupRotatedChatChannelTokens` 의 `update()` 가 구버전 `save()` 로 되돌아간 모습)로 관측됐다고 기록했다 — 병렬 fan-out 규약이 경고한 "다른 reviewer 가 같은 워킹트리에서 뮤테이션 검증 중" 상황으로 보인다. 모든 리뷰어가 `git status --short`/`git diff HEAD`/해시 대조로 최종 시점에는 저장소가 HEAD 와 완전히 일치하는 클린 상태임을 재확인했다. 위 CRITICAL(testing)의 뮤테이션 실측 자체는 이 절차를 거쳐 도출된 결과이며, 그 CRITICAL 리뷰어는 자신의 사고(다른 세션의 stale 백업을 잘못 복원)를 직접 원복까지 마쳤다고 명시했다.

## 권장 조치사항

1. **[CRITICAL 해소]** `cleanupRotatedChatChannelTokens` 에 형제 6개 자리와 동일한 회귀 테스트(저장 동사 부재 + patch 키 집합 단언) 추가.
2. **[WARNING]** `rotateBotToken()` 의 `chatChannel` 병합을 `mergeIntoFreshSubKey` 패턴으로 전환해 락 이전 스냅샷 필드가 살아남지 않도록 수정.
3. **[WARNING]** `SchedulesService.update()` 의 trigger `name`/`isActive` 동기화를 advisory lock 도메인에 포함시키거나, plan 8라운드 후속 표에 W4 와 같은 클래스로 명시 등재.
4. **[WARNING]** `update()` 응답이 최신 `notification` 값을 반영하도록 재조회/반환값 통일 검토(급하지 않음, plan 등재만이라도).
5. **[WARNING]** `throwTriggerNotFound()` JSDoc 위치를 원래 함수 위로 되돌려 orphan 을 해소 — 이 PR 세 번째 재발이므로 편집 규칙화 검토.
6. cron 스윕 성능 저하(항목 4)는 급하지 않으나 대량 회전 이벤트 대비 소규모 병렬화를 후속으로 트래킹.
7. INFO 항목들은 대부분 조치 불요이거나 plan 후속 표 등재만으로 충분 — 위 표 참조.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용(prompt 에 `routing_skip_reason` 명시 없음) — 전체 14개 reviewer 실행(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync).
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음.
- 제외된 reviewer 없음(routing 미사용이므로 전수 실행).