# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이번 라운드가 "«모든 자리» 를 참인 문장으로 만든다"며 닫으려던 lost-update 결함이, 바로 그 커밋(`a92bce095`)이 새로 손댄 두 자리(`normalizeNotificationSecretRef`/`promoteRotatedNotificationSecrets`)에서 **실제로 재발**했고(database), 그 재발을 잡을 테스트도 없으며(testing), 같은 커밋이 쓴 CHANGELOG 문장은 자기모순이다(documentation). forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과는 확보됐으므로 "강제 항목 누락"은 없다 — 위험도는 결과가 확보된 reviewer들의 실제 CRITICAL 발견에 근거한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database / testing | `normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets` 의 `rewriteTriggerConfigLocked` 병합 콜백이 락 획득 **이전** 스냅샷으로 만든 `notification` 객체를 `freshConfig` 무시하고 그대로 대입한다 — 동시에 커밋된 `notification.url` 등 다른 필드를 조용히 되돌릴 수 있는, 이 PR이 닫으려는 것과 **같은 클래스의 lost-update**. testing이 뮤테이션으로 실측(락 재읽기를 옛 스냅샷 병합으로 되돌려도 141개 테스트 전부 GREEN)해 이를 잡는 테스트가 없음도 확인. | `codebase/backend/src/modules/triggers/triggers.service.ts:820-838`(`normalizeNotificationSecretRef`), `:1359-1379`(`promoteRotatedNotificationSecrets`) | 두 함수 모두 `merge: (freshConfig) => {...}` 콜백에서 `freshConfig.notification` 을 기준으로 `secretRef`/`signing` 만 얹도록 재작성(예: `chat-channel-binder.service.ts`의 `buildChannel` 패턴 재사용). `triggers.service.spec.ts` 의 "락 안 재읽기가 동시 확립분을 본다" suite 패턴을 이 두 함수에도 적용해 회귀 테스트 추가 |
| 2 | testing | `revokePerTriggerToken()` 의 삭제-경합 404 게이트(`if (!wroteInteraction) this.throwTriggerNotFound();`, 이번 라운드 신규 코드)를 지키는 테스트가 없다 — 이 줄을 지워도 141개 테스트 전부 GREEN(뮤테이션 실측, 원복 완료) | `codebase/backend/src/modules/triggers/triggers.service.ts` — `revokePerTriggerToken()` | `rotateBotToken — 그 사이 삭제되면 404 + 감사 미기록` 테스트와 같은 패턴으로 `revokePerTriggerToken — 그 사이 삭제되면 404` 테스트 추가 |
| 3 | testing | `SchedulesService.update()` 의 trigger 컬럼 한정 `update()` 전환(이번 PR 핵심 수정 대상)이 `save(trigger)` 로 되돌아가도 `schedules.service.spec.ts` 21개 전부 GREEN — 유일한 관련 단언이 in-memory 재부착만 검사하고 실제 DB 쓰기 방식은 검증하지 않음(뮤테이션 실측) | `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` | `expect(triggerRepo.update).toHaveBeenCalledWith({id:...}, {isActive:false})` + `expect(triggerRepo.save).not.toHaveBeenCalled()` 단언 추가. name-only/둘다-없음 분기도 커버 |
| 4 | documentation | `CHANGELOG.md` 가 같은 항목 안에서 자기모순 — 16번째 줄 "기존 행에 `save(entity)` 하는 자리는 한 곳도 남지 않는다(정적 래칫이 고정한다)" vs 21줄 뒤 "저장 동사(`save`)는 그대로 두고". 실제 코드(`triggers.service.ts:636` `m.save(Trigger, target)`)와도 어긋나고, 인용된 정적 래칫은 "래핑 여부"만 고정할 뿐 "save() 존재 여부"는 보증하지 않음. lost-update/fail-open 보안 수정을 서술하는 문장이라 향후 감사·회귀 판단을 오도할 위험 | `CHANGELOG.md:16`, `:37-38` | 16번째 줄을 "컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를 저장하던 경로는 한 곳도 남지 않는다 … `update()`(창 1) 자체는 여전히 `save(entity)` 를 쓰지만 락 안 재읽은 최신 행을 저장 대상으로 삼아 lost-update 를 막는다" 로 정정 (plan 문서 §D 327-331행의 정확한 서술과 일치시킬 것) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `UpdateTriggerDto.config`(raw 필드)를 PATCH 에 실으면 락 안 재읽기 병합 자체를 우회한다 — `baseConfig` 가 `fresh?.config` 대신 요청 바디의 `config` 그대로가 되어, 동시에 커밋된 `chatChannel.inboundSigningRef`/`interaction`/`notification` 서브키가 조용히 사라질 수 있음. 이 경로는 어느 라운드 표에도 등재되지 않음 | `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의 `baseConfig` 계산, DTO `config?: Record<string,unknown>` | §D 창1과 같은 규율로 닫거나(설계 판단 필요), 최소한 "모든 자리를 닫았다" 선언 옆에 이 잔여 경로를 명시적으로 등재 |
| 2 | database | `cleanupRotatedChatChannelTokens` 의 무조건 null-write 가 동시에 커밋된 `rotateBotToken` 의 새 v2 회전을 지울 수 있음 — secret_store row 영구 orphan, old bot token 영구 미-revoke (심각도 낮음: 좁은 동시 경합 필요) | `codebase/backend/src/modules/triggers/triggers.service.ts:1406-1433` | `update({id, chatChannelTokenV2: v2Ref}, {...})` 조건부 WHERE 로 낙관적 확인 추가 |
| 3 | database | `revokePerTriggerToken` 도 같은 스냅샷-대입 패턴이지만 동기 요청이라 창이 훨씬 좁음 — 패턴 반복이 향후 복제될 위험 | `codebase/backend/src/modules/triggers/triggers.service.ts:1084-1110` | CRITICAL #1 수정 시 같은 헬퍼로 통일 |
| 4 | concurrency | `rotateNotificationSecret` 이 advisory lock 에 참여하지 않아, 창1(`update()`)의 전체-엔티티 저장이 그 사이 커밋된 `notificationSecretV2`/`notificationRotatedAt` 회전을 되돌릴 수 있음 — API·감사 로그는 회전 성공을 보고하지만 DB 엔 구 secret 이 남을 수 있어 관측용(`lastTriggeredAt`)과 달리 보안 성격 | `codebase/backend/src/modules/triggers/triggers.service.ts:588-637`(창1), `:1026-1056`(`rotateNotificationSecret`) | `rotateNotificationSecret` 에도 `acquireTriggerConfigLock` 적용해 같은 락 도메인으로 편입, 또는 최소한 plan 후속 표에 위험도 구분 명시 |
| 5 | performance | `promoteRotatedNotificationSecrets` cron 루프가 후보마다 순차 트랜잭션(락+재조회+UPDATE, 최소 3~4 왕복)을 반복 — 종전 1왕복 대비 배치가 커지면 cron 실행시간이 비례 이상 증가 가능 | `codebase/backend/src/modules/triggers/triggers.service.ts:1308`(루프), `:1371-1379`(`rewriteTriggerConfigLocked`) | 배치 크기 제한(`.take(N)` + 이월) 또는 청크 처리, 소요시간 로그/메트릭 등재 |
| 6 | performance | advisory lock 대기가 삭제 경로 외엔 상한이 없고(`lock_timeout` 미설정), 기본 커넥션 풀(10) 하에서 같은 트리거에 동시 쓰기가 몰리면 풀 고갈로 번질 수 있음 — 이 PR 이 이 패턴을 쓰는 자리를 1곳(exec-cap 선례)에서 7곳 이상으로 확대 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`, `:107-117`; 풀 설정 `app.module.ts:114-125` | 삭제 이외 경로에도 짧은 `lock_timeout` 도입 고려, 풀 대기시간 모니터링 등재 |
| 7 | maintainability | 테스트 헬퍼(`makeService`) 안 provider 검색 술어 인라인 중복 — **3라운드 연속** 지적됐고 plan 후속 표에도 여전히 미등재 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3757-3768` | `const at = (token) => ...` 선언을 함수 상단으로 올려 `ChannelListenerRegistry` 교체도 통일. 유예 시 plan 후속 표에 명시 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `SET LOCAL lock_timeout` 문자열 보간 — 사용자 입력 닿지 않는 모듈 상수만 사용해 현재 위험 없음 | `trigger-config-lock.ts` `acquireTriggerConfigLock` | 호출부가 늘어날 경우를 대비해 계약을 JSDoc에 명시 |
| 2 | architecture | `rewriteTriggerConfigLocked` 가 `Trigger` 엔티티에 하드코딩 — 의도적 유예, plan 후속 표 등재됨 | `trigger-config-lock.ts:136-141` | 다른 엔티티에 같은 클래스 결함 발견 시 제네릭화 |
| 3 | database | 두 cron 후보 쿼리(`notification_secret_v2`/`chat_channel_token_v2` IS NOT NULL)에 지원 인덱스 없음, `getMany()` 페이지네이션 없음 | `triggers.service.ts:1312-1318`, `:1398-1404` | 트리거 총량 증가 시 부분 인덱스/배치 처리 백로그 등재 |
| 4 | dependency | 신규 외부 패키지·매니페스트 변경 0건, 신규 import 전량 기존 의존성 재사용 | `package.json`/lockfile diff 전수 확인 | 없음 |
| 5 | documentation | `spec/5-system/15-chat-channel.md` 의 `code:` glob 추적성 갭 — 여러 라운드째 지적, plan §D "planner 범위" 표에 이미 등재된 기존 이슈 | `spec/5-system/15-chat-channel.md` | 없음(추적됨) |
| 6 | requirement | 정적 래칫(`endpoint-path-conflict-wrap`)의 스캔 범위가 `modules/triggers/` 뿐이라 CHANGELOG "한 곳도 남지 않는다" 문구의 함의보다 보증 범위가 좁음(현재는 실측상 참, 문서 정밀도 문제) | `endpoint-path-conflict-wrap.spec.ts`, `CHANGELOG.md` | 래칫 스캔 범위 한정 사실을 문서에 명시 |
| 7 | scope | 정적 가드(`endpoint-path-conflict-wrap-guard.ts`) 확장은 트리거 도메인 밖 파일이지만 이번 저장 형태 변화의 직접 파생 결과 — 무관한 변경 아님 | `endpoint-path-conflict-wrap-guard.ts:26-35`,`:108-121`,`:156-171` | 없음(이미 커밋 메시지에 인과관계 명시) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | CRITICAL | 이번 라운드가 새로 닫은 7자리 중 3곳(`revokePerTriggerToken`·`normalizeNotificationSecretRef`·`SchedulesService.update`)이 뮤테이션 실측상 회귀 테스트로 보호되지 않음 |
| documentation | CRITICAL | CHANGELOG.md 자기모순 (save(entity) 존재 여부 서술) |
| database | HIGH | `normalizeNotificationSecretRef`/`promoteRotatedNotificationSecrets` 병합 콜백이 `freshConfig` 무시 — 실제 lost-update 재발 가능. 그 외 2 WARNING, 2 INFO |
| side_effect | MEDIUM | `UpdateTriggerDto.config` raw 필드 경로가 락 안 재읽기 병합을 우회 |
| performance | LOW | cron 배치 순차 트랜잭션 증가, advisory lock 무제한 대기+풀 고갈 잠재 위험 |
| architecture | LOW | 헬퍼 `Trigger` 하드코딩 등 이전부터 추적된 의도적 트레이드오프만 |
| maintainability | LOW | 테스트 헬퍼 중복 3라운드 연속 미해소(WARNING), 그 외 등재된 유예 항목 |
| concurrency | LOW | `rotateNotificationSecret` 이 advisory lock 도메인 밖 — 창1 저장이 되돌릴 수 있음 |
| security | NONE | 신규 보안 이슈 없음, 인증 우회 수정 자체를 검증·확인 |
| requirement | NONE | write-site 13곳 전수 배선 확인, 요구사항 결함 없음 |
| scope | NONE | 모든 diff가 결함 수정과 직접 연관, 무관한 변경 없음 |
| dependency | NONE | 매니페스트 변경 0건 |
| api_contract | NONE | 컨트롤러/DTO/라우트 변경 0건 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 대조 매칭 0건 |

## 발견 없는 에이전트

api_contract, dependency, user_guide_sync (실질 발견 0건, 전부 비-이슈/해당없음으로 판정)

## 권장 조치사항

1. **(최우선)** `normalizeNotificationSecretRef`/`promoteRotatedNotificationSecrets` 의 병합 콜백을 `freshConfig.notification` 기준으로 재작성해 실제 lost-update 재발을 닫는다 (database CRITICAL #1).
2. `revokePerTriggerToken`·`SchedulesService.update()` 에 뮤테이션으로 검증 가능한 회귀 테스트를 추가한다 (testing CRITICAL #2, #3).
3. `CHANGELOG.md:16`을 코드·plan 문서와 일치하도록 정정해 자기모순을 해소한다 (documentation CRITICAL #4).
4. `UpdateTriggerDto.config` raw 필드 PATCH 가 락 안 재읽기 병합을 우회하는 경로를 설계 검토 후 닫거나 최소한 잔여 경로로 명시 등재한다 (side_effect WARNING #1).
5. `rotateNotificationSecret`을 advisory lock 도메인에 편입하거나 위험도 차이를 plan에 문서화한다 (concurrency WARNING #4).
6. `cleanupRotatedChatChannelTokens`의 무조건 null-write에 낙관적 확인을 추가한다 (database WARNING #2).
7. 나머지 WARNING(cron 배치 성능, lock_timeout 부재, 테스트 헬퍼 중복)은 후속 라운드에서 plan 후속 표에 명시적으로 등재해 유실을 방지한다.

## 라우터 결정

- `routing=skipped` — 라우터 미사용. 전체 14개 reviewer 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 확인됨(누락 없음)