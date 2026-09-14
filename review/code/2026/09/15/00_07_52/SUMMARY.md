# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 11라운드째 반복 수정된 `trigger.config` lost-update 방지 changeset. 신규 CRITICAL 없음. WARNING 3건 중 가장 무거운 것은 이 PR의 핵심 안전장치(`mergeIntoFreshSubKey`의 `fallback` 분기)가 4개 호출부 어디서도 실행되지 않는다는 testing 지적(뮤테이션 실측으로 확증) — 이 자체가 코드 결함은 아니지만 "판별 못 하는 fixture" 클래스의 다섯 번째 미해결 자리다. forced(router_safety) 화이트리스트 7개(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 모두 확보되어 있어 화이트리스트 미이행은 없다.

## Critical 발견사항

없음 (0건). 14개 reviewer 전원이 CRITICAL 급 발견 없음으로 보고.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `mergeIntoFreshSubKey`의 `fallback` 매개변수(락 안 재읽기 결과에 해당 하위 키가 없을 때 쓸 기준값)가 4개 호출부(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`rotateBotToken`·`promoteRotatedNotificationSecrets`) 어디의 fixture 에서도 행사되지 않음 — 리뷰 중 직접 뮤테이션(`fallback` 분기 제거)해 `triggers.service.spec.ts` 를 실행한 결과 147개 테스트 전건 GREEN | `codebase/backend/src/modules/triggers/triggers.service.ts:380-392`(정의), 호출부 `:869, :1149, :1321, :1442` | 4곳 중 최소 1곳에 "락 안 재읽기 결과가 해당 서브키를 아예 갖고 있지 않다" fixture 를 추가해 `fallback` 값이 실제로 patch 에 반영되는지 단언. 같은 헬퍼를 쓰는 나머지 3곳도 같은 패턴으로 보강 |
| 2 | performance | `promoteRotatedNotificationSecrets` cron 의 정상 승격 경로가 이번 커밋으로 `save(entity)` 단일 왕복에서 트리거 후보마다 `트랜잭션+advisory lock+재읽기`(약 5왕복)로 바뀌었고, 후보 조회에 `LIMIT` 이 없어 순차 루프 비용이 후보 수에 선형 × 5배로 증가 — 이전 라운드들이 "반복문 안 호출 없음"으로 확인했던 전제가 이번 커밋으로 깨짐 | `codebase/backend/src/modules/triggers/triggers.service.ts:1377-1383`(후보 조회, LIMIT 없음), `:1385`(루프), `:1438`(`rewriteTriggerConfigLocked` 호출) | 정상 운영 조건에서는 후보 수가 적어 영향 낮음. cron 실행 시간·과거 후보 수 분포 관측 권장, 필요 시 `take(N)` 배치 상한 추가 |
| 3 | documentation | `trigger-config-lock.ts` 자신의 JSDoc이 "이 함수(`rewriteTriggerConfigLocked`)를 쓰는 곳은 창 2·3·4다"라고 배타적으로 못박아 두었는데, 7라운드에서 호출부가 3곳(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`) 더 늘어 실제로는 6곳이다. "부재 처리 방식" 표도 3행뿐이라 나머지 세 갈래(관측 안 함/404/조용히 skip)가 빠짐 — 이 파일 자신이 과거 세 라운드에 걸쳐 "다음 사람이 오해한다"는 이유로 이 문구를 다듬어 온 자리라는 점에서 반대 방향(과소 서술) 재발 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:83`(배선 문장), `:126-134`(부재 처리 표) | "이 함수를 쓰는 곳은 **최소** 창 2·3·4 + 7라운드에 전환된 3곳" 으로 갱신하거나, 호출부 열거에 의존하지 않는 표현("창 1을 제외한 모든 config 재작성 자리")으로 교체. 표에 나머지 세 갈래 행 추가 또는 "대표 사례만" 면책 문구 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / concurrency / database / side_effect / dependency / api_contract | `SET LOCAL lock_timeout` 이 파라미터 바인딩 불가 자리라 문자열 보간(`Math.trunc` 로 정수화)으로 조립됨 — 현재 유일한 호출부(`remove()`)가 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS=5000`)만 전달해 인젝션 경로 없음. 다만 `timeoutMs: number` 시그니처 자체는 임의값을 허용 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`acquireTriggerConfigLock`) | 여유 있으면 타입을 좁히거나 함수 내부에 `Number.isInteger && > 0` 방어 검증 추가 |
| 2 | security | `rewriteTriggerConfigLocked` 헬퍼가 `id` 단일 조건으로만 재읽어 `workspaceId` 로 스코프되지 않음 — 3개 호출부 전수 확인 결과 모두 호출 전에 `findById(id, workspaceId)` 로 소유권을 이미 검증해 신규 인가 우회는 아님 | `trigger-config-lock.ts`(`rewriteTriggerConfigLocked`) | JSDoc에 "호출부가 소유권을 사전 검증한다"는 전제를 한 줄 명시 |
| 3 | database / concurrency | `SchedulesService.update()`의 trigger `name`/`isActive` 컬럼 동기화가 advisory lock 도메인 밖에 있어, `update()` 창1(엔티티 전체 저장)과 경합하면 방금 커밋된 `isActive` 가 락 안 재읽기 시점의 값으로 되돌아갈 수 있음 — 이미 9라운드 W2로 실측·등재되어 이 PR 스코프 밖으로 명시 이월됨 | `codebase/backend/src/modules/schedules/schedules.service.ts:216-265` vs `triggers.service.ts` `update()` | 후속 PR: 이 write 도 advisory lock 편입 또는 창1 자체를 컬럼 한정 갱신으로 전환 |
| 4 | concurrency | `cleanupRotatedChatChannelTokens` 의 무조건 `null`-write 가 그 사이 커밋된 `rotateBotToken` 의 새 v2 회전을 지울 수 있는 좁은 창 — 데이터 손상 아닌 고아 secret row 수준, 이미 8라운드 W2로 등재됨 | `triggers.service.ts`(`cleanupRotatedChatChannelTokens`) | 후속 PR: 조건부 `WHERE chatChannelTokenV2 = <읽은 값>` 낙관적 확인으로 전환 |
| 5 | database | advisory lock 네임스페이스(`trigger-config:*`)가 `exec-cap:*` 과 `hashtext` 의 32비트 키 공간을 공유 — 우연 충돌 시 무관한 자원끼리 불필요하게 직렬화(정확성 훼손 아님), 이미 추적됨 | `trigger-config-lock.ts:1-18`(`TRIGGER_CONFIG_LOCK_PREFIX`) | `redis-keys.md §4` 등재는 planner 항목으로 이미 추적 중 |
| 6 | architecture | 같은 급의 lost-update 방지 로직인데 `mergeIntoFreshSubKey`(순수 함수)는 `TriggersService` 의 `private` 메서드로 남아 전용 단위 테스트가 없고, 자매 함수 `extractInboundSigningRef` 는 모듈 레벨 export + `it.each` 7케이스 전용 테스트를 가짐 — 추출 규율 비대칭 | `triggers.service.ts:380`(`mergeIntoFreshSubKey`) vs `chat-channel-input-rules.ts:247`(`extractInboundSigningRef`) | `mergeIntoFreshSubKey` 를 모듈 레벨 순수 함수로 export 하고 전용 `it.each` 테스트 추가(위 WARNING#1 과 결합해 처리 가능) |
| 7 | architecture | 락+재읽기+머지+쓰기 골격이 재사용 함수(`rewriteTriggerConfigLocked`, 창 2·3·4)와 인라인 사본(창1 `update()`, `save` 계약 보존을 위해 손으로 재작성) 두 형태로 공존 — JSDoc이 스스로 근거를 남긴 의도된 트레이드오프 | `trigger-config-lock.ts:136-173` vs `triggers.service.ts:621-651` | 향후 이 골격을 다시 손댈 때 `save`/`update` 를 전략 함수로 주입받는 공통 템플릿으로 통합 검토 |
| 8 | architecture | 제네릭 병합 유틸리티(`Record<string, unknown>` 기반)가 타입 소거 경계를 만들어 `ChatChannelConfig` 같은 구체 타입 값에 이중 캐스트(`as unknown as Record<string, unknown>`)가 필요 — 정확히 이 PR이 고친 버그가 발생했던 자리와 동일선상, 단위 테스트가 캐너리로 고정함 | `triggers.service.ts:1329` | 제네릭화(`rewriteTriggerConfigLocked<T>`) 기회가 오면 캐스트 축소 검토 |
| 9 | architecture / dependency | 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)의 `Trigger` 엔티티 판별이 타입 체커가 아니라 식별자 텍스트 매칭 — 별칭 import(`Trigger as TriggerEntity`, 현재 코드베이스에 없음)가 생기면 조용히 스캔 대상에서 빠짐(fail-open) | `endpoint-path-conflict-wrap-guard.ts:35`(`TRIGGER_ENTITY`), `:156-172` | `TRIGGER_ENTITY` 주석에 "별칭 import 시 이 판정이 빠진다" 한 줄 추가 |
| 10 | maintainability | `TriggersService.update()` 가 182줄로 트랜잭션 클로저 한 겹만큼 중첩 증가 — plan 트래커에 "다음 편집 때 `mergeAndSaveLocked` 로 분리" 로 이미 등재된 항목 | `triggers.service.ts:540-721` | 트래커 계획대로 후속 편집 시 트랜잭션 클로저를 사설 헬퍼로 분리 |
| 11 | maintainability / dependency | 테스트 헬퍼 `withTransactionMock` 이 Trigger-repo-mock 을 쓰는 6개 spec 파일 중 2개(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)에만 적용됨 — 나머지 4개는 지금은 안전하나 향후 트랜잭션 경로를 호출하면 즉시(loud) 실패할 잠재 자리, JSDoc에 이미 명시됨 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` | 새 Trigger repo mock 추가 시 이 헬퍼 사용을 요구하는 짧은 후속 트래킹 항목만으로 충분 |
| 12 | api_contract / side_effect | `chat-channel-binder.service.ts` `setupChatChannel()` 의 성공/실패 두 경로가 `rewriteTriggerConfigLocked` 반환값(`wrote`)을 호출자에 전파하지 않아, 창1 커밋 뒤 좁은 삭제-경합 창에서 200 + 이미 삭제된 리소스의 스냅샷 바디가 나갈 수 있음(뒤이은 GET은 정확히 404, 데이터 손상 없음) — plan에 "best-effort 후속 작업이라 의도적으로 감춘다"로 이미 수용·기록됨 | `chat-channel-binder.service.ts`(`setupChatChannel`), `triggers.service.ts` `update()` | 후속 검토: `update()` 경로에 한해 binder 반환값을 관측해 폴백 대신 404/409 로 드러낼지 재검토 |
| 13 | api_contract / side_effect | `DELETE /api/triggers/:id` 의 5초 lock-timeout(`55P03`) 실패가 `GlobalExceptionFilter` 의 기존 관례대로 일반 500 `INTERNAL_ERROR` 로 마스킹돼, 클라이언트가 "정상 경합(재시도 가능)"과 "진짜 버그"를 구분할 근거가 없음 — 의도적 트레이드오프("조용한 지연보다 드러나는 오류")로 문서화됨 | `trigger-config-lock.ts`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`), `triggers.service.ts` `remove()` | 이 실패가 실제 관측되면 `55P03` 을 409(`RESOURCE_CONFLICT`)로 명시 매핑하는 백로그 항목으로 고려 |
| 14 | requirement | `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 신규 `trigger-config-lock.ts`(이름이 `chat-channel-`로 시작하지 않음)를 여전히 안 문다 — developer 가 스스로 실측해 plan §D 에 "planner 범위, 이 브랜치에서 고치지 않는다"로 이미 등재, developer 는 `spec/` 쓰기 권한 없음 | `spec/5-system/15-chat-channel.md:4-20` | `project-planner` 가 §7 tree 갱신 시 glob 정정 반영 |
| 15 | requirement | `normalizeNotificationSecretRef` 가 락 재쓰기 결과(`false`=삭제 경합)를 관측하지 않음 — 형제 동기 경로(`revokePerTriggerToken`·`rotateBotToken`)와 취급 비대칭, 영향은 인증 fail-open 이 아니라 좁은 창의 고아 시크릿 수준. 이미 9라운드 INFO#6 으로 "5라운드 W1(secret store 원자성) 대상 목록에 포함" 후속 등재됨 | `triggers.service.ts:830-876` | 후속 등재 유지, 이번 배치 조치 불요 |
| 16 | testing | `acquireTriggerConfigLock` 의 `Math.trunc(timeoutMs)` 정수화가 직접 단위 테스트되지 않음 — 유일한 호출부가 정수 상수만 넘겨 실질 위험 낮음 | `trigger-config-lock.ts:44-58` | `trigger-config-lock.spec.ts` 에 소수점 입력(`1500.9`)이 `'1500ms'` 로 정확히 잘리는지 보는 케이스 1개 추가 |
| 17 | scope | `review/code/2026/09/14/*` 11라운드분 + `review/consistency` 산출물(178개 파일)이 코드 변경과 같은 changeset 에 포함 — 이 저장소가 강제하는 fix-review 반복 루프의 정상 축적물이지 scope creep 아님 | `review/code/2026/09/14/**` | 조치 불요. 다른 관점 리뷰어가 "비대한 diff"로 재지적하지 않도록 SUMMARY 집계 시 감안 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 전부 파라미터 바인딩, 인가 경계 유지. lock_timeout 문자열 보간·workspaceId 미스코프는 INFO |
| performance | LOW | cron 승격 경로가 후보당 트랜잭션+락+재읽기로 확장(WARNING), 나머지는 이전 라운드 트레이드오프 반복 |
| architecture | LOW | 이전 라운드 WARNING 다수 해소. `mergeIntoFreshSubKey` 추출 비대칭·락 골격 이중화는 INFO |
| requirement | LOW | CHANGELOG/plan 의 정량 주장 grep 재검증 전부 일치. spec glob 미포함·`normalizeNotificationSecretRef` skip 은 이미 추적된 잔여 항목 |
| scope | NONE | 실제 코드/plan 변경 19개 파일로 국한, 전부 단일 결함에 직접 종속 |
| side_effect | LOW | 새 advisory lock 공유 상태 도입은 의도된 설계, registry 조건부 등록·remove() 신규 에러 로그는 문서화된 개선 |
| maintainability | LOW | 10라운드 지적 중복 대부분 공용 함수로 수렴. `update()` 182줄은 이미 트래커 등재 |
| testing | MEDIUM | `mergeIntoFreshSubKey` `fallback` 분기 미검증(WARNING, 뮤테이션 실측). 그 외 판별 fixture(30 vs 99) 는 견고 |
| documentation | LOW | 대부분 이전 지적 해소. `trigger-config-lock.ts` JSDoc 호출부 열거가 실제(6곳)보다 좁음(WARNING) |
| dependency | NONE | `package.json`/lockfile 변경 0건, 신규 외부 의존성 없음 |
| database | LOW | 락 배치·트랜잭션 범위·SQL 파라미터화 견고. schedules 비원자적 쓰기·cron 무제한 후보는 이미 추적된 INFO |
| concurrency | LOW | 핵심 프리미티브(락 순서·재읽기·데드락 부재) 재검증 통과. 잔여 항목 전부 이전 라운드 등재분 재확인 |
| api_contract | LOW | 컨트롤러·DTO·라우트 변경 0건. 신규 404 는 기존 문서화된 응답과 동일 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 전부 불일치(매칭 0건) |

## 발견 없는 에이전트

- **user_guide_sync**: `.claude/config/doc-sync-matrix.json` 21개 trigger 전수 대조 결과 매칭 0건(글로브·semantic 모두). 유저 가이드 동반 갱신 대상 아님.
- **dependency**: `package.json`/`pnpm-lock.yaml` 변경 0건, 신규 외부 패키지·라이선스·CVE 이슈 없음. 기록한 INFO 는 전부 긍정 확인 또는 이미 다른 관점(architecture/maintainability)과 중복되는 내부 결합 관찰.

## 권장 조치사항

1. **(WARNING#1)** `mergeIntoFreshSubKey` 의 `fallback` 분기를 실제로 판별하는 fixture 를 최소 1개 호출부(`revokePerTriggerToken` 또는 `rotateBotToken`)에 추가한다 — "락 안 재읽기 결과에 해당 서브키가 없음" 케이스. 이 PR 이 스스로 10라운드에 걸쳐 반복 지적해 온 "판별 못 하는 fixture" 클래스의 다섯 번째 자리이며, 이 함수는 이 PR 의 핵심 방벽이다.
2. **(WARNING#3)** `trigger-config-lock.ts` JSDoc 의 호출부 열거 문구·부재 처리 표를 실제 6개 호출부에 맞게 갱신하거나 열거-비의존 표현으로 교체한다 — 이 파일 자신이 과거 세 차례 같은 이유로 문구를 다듬어 온 자리라 다음 재발을 막을 가치가 크다.
3. **(WARNING#2)** `promoteRotatedNotificationSecrets` cron 의 후보 수 분포·실행 시간을 운영 관측하고, 필요 시 배치 상한(`take(N)`)을 추가한다. 정상 운영 조건에서는 낮은 우선순위.
4. (INFO#16, 저비용) `acquireTriggerConfigLock` 의 `Math.trunc` 정수화에 소수점 입력 단위 테스트 1개 추가.
5. 나머지 INFO 항목(schedules 비원자적 쓰기, cleanupRotatedChatChannelTokens 무조건 null-write, advisory lock 네임스페이스 공유, binder 반환값 미전파, DELETE lock-timeout 마스킹, spec glob 미포함 등)은 전부 developer 가 이미 실측해 `plan/in-progress/trigger-config-lost-update.md` §후속 표에 "이 PR 로 넓히지 않는다"로 명시 등재된 것과 일치 — 별도 후속 PR/planner 턴에서 처리.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: prompt 에 `routing_skip_reason` 이 별도로 제공되지 않음(routing 자체가 이번 세션에서 스킵됨). 전체 14개 reviewer 실행.
- **강제 포함(router_safety) 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(라우팅이 skip 되어 전체 reviewer 가 어차피 실행되었으므로 강제 화이트리스트 미이행 없음).
- **실행**: 전체 14명 — `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`
- **제외**: 없음 (0명)