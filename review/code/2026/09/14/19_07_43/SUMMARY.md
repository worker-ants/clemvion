# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 이전 라운드(18_17_44)가 지적한 두 CRITICAL(창 1 을 통한 `inboundSigningRef` fail-open 재현, 뮤테이션 미보호 unit 테스트)은 이번 diff(`567c82edb`, `12ed21ff1`)로 실측 확인상 정확히 닫혔다. 다만 이번 라운드에서 4개 reviewer(architecture·side_effect·database·concurrency)가 독립적으로 "이 PR이 막은 것과 같은 클래스의 lost-update 가 다른 자리(특히 `hooks.service.ts` 웹훅 처리 hot path, 창 1 자신의 나머지 컬럼, `revokePerTriggerToken` 등)에 여전히 열려 있다"는 MEDIUM 위험을 새로 지적했다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 강제 항목 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/부작용 | `hooks.service.ts`의 웹훅/채팅 인입 처리 hot path(`handleWebhook`, `handleChatChannelWebhook`)가 여전히 `trigger.save(entity)` 전체 저장을 씀 — 이 PR이 막은 것과 **동일한 `inboundSigningRef` fail-open 클래스**가 PATCH보다 훨씬 높은 빈도(인입 메시지마다)로 재발 가능. plan은 이를 일반적 "lastTriggeredAt hot path lost-update"로만 등재해 보안 영향이 과소평가돼 있음 | `codebase/backend/src/modules/hooks/hooks.service.ts:227-228, 687-688` | 후속 우선순위를 "관측성 lost-update"에서 "서명 검증 fail-open 재발 위험(보안)"으로 재분류. 최소 조치: `chatChannel` 설정된 트리거는 `lastTriggeredAt` 갱신을 `rewriteTriggerConfigLocked` 경유 또는 컬럼 한정 `repository.update(id, { lastTriggeredAt })`로 전환해 `config` 암묵적 재작성을 제거 |
| 2 | 데이터베이스 | "창 1"(`update()`의 `save(trigger)`)은 락 안에서 재읽은 값을 **`config` 필드에만** 반영하고, 그 밖 컬럼(`chatChannelHealth`/`chatChannelLastError`/`chatChannelSetupAt`/`chatChannelRotatedAt`/`chatChannelTokenV2`)은 여전히 락 이전(pre-lock) 스냅샷으로 전체 저장됨 — 같은 advisory lock 을 공유하는 `rotateBotToken`/`chat-channel-binder`의 부분 UPDATE 커밋을 창 1이 뒤따라와 조용히 되돌릴 수 있음(같은 락 안에서 발생하는 새로운 형태의 lost-update) | `codebase/backend/src/modules/triggers/triggers.service.ts:472`(pre-lock 로드), `:556-574`(`Object.assign(trigger, ...)` → `m.save(Trigger, trigger)`) | `Object.assign(fresh, defined, { config: mergedConfig })`처럼 재읽은 행을 베이스로 쓰거나, 창 1도 `columns` 방식 부분 UPDATE로 전환. plan §D 트래커에 "창 1: save(trigger)가 형제 창 부분 UPDATE 를 되돌릴 수 있음"으로 구체 등재 |
| 3 | 부작용 | 이 PR이 잠근 4자리 밖에 `trigger.config`를 락 없이 통째로 덮어쓰는 형제 write-site 최소 3곳(`revokePerTriggerToken`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`) — 그중 `revokePerTriggerToken`은 legacy 데이터와 무관하게 **지금도 상시 재현 가능한 라이브 엔드포인트**. plan §D가 이미 열거했으나 "컬럼만 고치는 6곳"과 같은 근거로 뭉뚱그려 유예해 우선순위가 흐려짐 | `codebase/backend/src/modules/triggers/triggers.service.ts:972-1006`(`revokePerTriggerToken`), `:735-766`(`normalizeNotificationSecretRef`), `:1189-1247`(`promoteRotatedNotificationSecrets`) | §D 표의 `config` 명시 수정 3행을 "컬럼만 고치는 6행"과 분리해 후속 우선순위 재검토, `revokePerTriggerToken` 최우선 |
| 4 | 아키텍처/유지보수성 | advisory lock 획득 SQL(`SELECT pg_advisory_xact_lock(hashtext($1))`)이 공용 헬퍼(`rewriteTriggerConfigLocked`)와 창 1 인라인 구현 두 곳에 손으로 중복 작성됨 — 이 파일 자신이 예고한 "향후 `lock_timeout` 추가" 시 한쪽만 반영될 drift 위험이 구조적으로 남음 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:81-83` vs `triggers.service.ts:551-553` | 락 획득 단계 자체를 `acquireTriggerConfigLock(manager, triggerId): Promise<void>` 같은 저수준 프리미티브로 뽑아 두 자리가 공유하게 하거나, 최소 상호 참조 주석으로 두 자리가 갈라져 있음을 명시 |
| 5 | 성능 | 창 1 추가로 `chatChannel`을 전혀 싣지 않은 PATCH를 포함한 **트리거 PATCH 전체**가 advisory lock + 재읽기 5단계(`BEGIN→lock→SELECT→save→COMMIT`)를 지게 됨 — 이전 라운드가 "hot path 영향 없음"으로 평가했던 전제(영향 범위=chatChannel/bot-token 관련 세 자리)가 깨짐 | `codebase/backend/src/modules/triggers/triggers.service.ts:549-576` | 새 결함은 아니나(lost-update 수정의 의도된 트레이드오프), `PATCH /api/triggers/:id` 호출 빈도 확인 및 P95/P99 모니터링 추가 권장 |
| 6 | 요구사항(SPEC 커버리지) | 신규 파일 `trigger-config-lock.ts`가 `spec/5-system/15-chat-channel.md`의 `code:` frontmatter glob 어디에도 걸리지 않음 — 이 문서 자신이 경계하던 "새 `triggers/` 파일이 glob 에서 누락되는" 패턴(#1317·#1319·#1320)의 네 번째 재발. `spec/` 편집은 developer 권한 밖이라 이 PR 단독으로 해소 불가하며, 해소 전까지 이 파일 단독 변경 시 spec-linked 리뷰 게이트(`--impl-done`)를 못 받음 | `spec/5-system/15-chat-channel.md`(frontmatter) / `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(전체) | planner 턴에서 `code:` 명시 추가 또는 glob 확장 — 이미 `plan/in-progress/trigger-config-lost-update.md` `--impl-prep` 인계 표에 등재돼 있으나 아직 미해소이므로 유지 |
| 7 | 유지보수성 | `{ chatChannel?: { inboundSigningRef?: string } }` 형태의 인라인 타입 캐스트가 같은 함수(`update()`) 안에서 두 번(512-514, 560-562), 다른 파일까지 합쳐 세 번 반복됨 — 직전 라운드가 지적한 중복(2건)이 이번 PR로 3번째 사본이 추가돼 악화 | `codebase/backend/src/modules/triggers/triggers.service.ts:512-514, 560-562`, `chat-channel-binder.service.ts:209-210` | `extractInboundSigningRef(config): string \| undefined` 같은 이름 있는 헬퍼로 세 자리(최소 같은 함수 안 두 자리) 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/테스트 | 이전 라운드 CRITICAL#1(창 1을 통한 `inboundSigningRef` fail-open 재현)과 CRITICAL#2·#3(뮤테이션으로 실측된 unit 미보호), WARNING("행 삭제됨" 분기 미검증)이 이번 diff의 신규 테스트(`triggers.service.spec.ts` lost-update describe, `trigger-config-lock.spec.ts`)로 정확히 닫혔음을 독립 재실측(뮤테이션 재실행) 확인 | `triggers.service.ts:549-576`, `triggers.service.spec.ts:3719-3777`, `trigger-config-lock.spec.ts` | 조치 불요 — 해소 기록 |
| 2 | 문서화 | 이전 라운드 WARNING(CHANGELOG 누락)이 `12ed21ff1`에서 정확한 서술로 해소됨 | `CHANGELOG.md` (Unreleased, Behavior change) | 조치 불요 |
| 3 | 아키텍처 | `previousInboundSigningRef`가 `manager.transaction()` 콜백 내부에서 바깥 스코프 `let` 변수를 재대입하는 방식으로 트랜잭션 밖으로 값 전달 — 현재는 안전하나 데이터플로우가 암묵적 | `triggers.service.ts:512-514, 560-562` | 트랜잭션 콜백이 `{ saved, previousInboundSigningRef }`를 명시적으로 반환하도록 리팩터 고려(급하지 않음) |
| 4 | 아키텍처 | `TriggersService`가 이번 PR로 락/트랜잭션 관리 책임을 추가 흡수하며 계속 커짐(이미 한 차례 `ChatChannelBinderService` 분리 선례 있음) | `triggers.service.ts` `update()`, `rotateBotToken()` | 다섯 번째 write-site 추가 시 창 1 인라인 패턴 복제 대신 프리미티브 추출 권장 |
| 5 | 유지보수성 | `update()`가 이미 긴 메서드(~160줄)인데 창 1(락+재읽기+게이트 재계산, ~40줄)이 그 안에 인라인됨 | `triggers.service.ts:466-626` | 보안 회귀 최우선 수정이 완료된 지금, 다음 편집 시 `private saveWithConfigLock(...)`로 분리 검토 |
| 6 | 테스트 | 창 1의 인라인 "락 → 재읽기" 순서를 직접 단언하는 unit 테스트가 없음(e2e가 간접 방어) — 헬퍼(`rewriteTriggerConfigLocked`)는 순서를 직접 단언하나 창 1은 순서 재구현만 하고 직접 검증 없음 | `triggers.service.ts:550-575` | `withTransactionMock` 확장해 창 1도 호출 순서 배열로 직접 단언 가능하게 하면 원인 특정이 빨라짐 |
| 7 | 테스트 | `withTransactionMock`/`freshFindOne`의 방어적 분기 2곳(idempotency 가드, 시퀀스 소진 시 마지막 값 반복)이 현재 어떤 테스트로도 실행되지 않는 죽은 커버리지 | `trigger-transaction-mock.ts:51`, `triggers.service.spec.ts:3669` | 조치 불요 수준 — 두 분기를 실제로 쓰는 테스트가 생기기 전까지 "검증된 동작"으로 인용하지 말 것 |
| 8 | 테스트 | e2e `SETTLE_MS = 300` 고정 대기가 느린 CI에서 `blockedBeforeRelease` 단언만 이론상 flaky해질 여지(핵심 보안 단언 ①②③은 이 값에 의존하지 않음) | `test/trigger-config-lost-update.e2e-spec.ts:58-59, 183-191` | 실제 flaky 관측 시 값 상향 또는 폴링 방식 전환 |
| 9 | 문서화/요구사항 | 원 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:2278`)과 본 plan `trigger-config-lost-update.md`의 마지막 체크리스트 항목이 아직 `[ ]`로 남아 있음 — 종결 커밋(`12ed21ff1`)로 볼 여지가 있는 시점인데 사무적 동기화 미완 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`, `plan/in-progress/trigger-config-lost-update.md`(체크리스트 마지막 줄) | 이 라운드가 Critical·Warning 0으로 수렴 시(또는 위 WARNING 항목들을 후속으로 이관 결정 시) `plan/complete/` 이동 전 두 체크박스를 `[x]` + 실측 각주("창이 넷이었다")로 동시 갱신 |
| 10 | 의존성 | 신규 공용 mock `trigger-transaction-mock.ts`의 JSDoc은 "provider가 6개 파일에 흩어져 있다"고 서술하지만 이번 diff가 실제 이관한 것은 1개 파일(`triggers.web-chat.spec.ts`)뿐 — 나머지 5개 중 `TriggersService`를 쓰지 않는 4개는 무관하나 서술 자체가 오해 소지 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`(JSDoc) | 조치 불요 수준 — maintainability/testing 후속 확인 대상으로만 기록 |
| 11 | 데이터베이스 | `remove()`가 `triggerConfigLockKey` advisory lock을 잡지 않아 삭제와 재작성 사이 좁은 레이스(고아 UPDATE 자체는 무해, 이미 이전 라운드에서 지적·수용) | `trigger-config-lock.ts:74-113` vs `triggers.service.ts:883-896` | 조치 불요(이미 트래커 대상) |
| 12 | 동시성/데이터베이스 | advisory lock 키의 32비트 해시 공간을 `trigger-config:*`와 `exec-cap:*`(execution-engine)가 공유 — 충돌 시 과직렬화만 발생, 데이터 손상 없음. 이미 consistency-check naming_collision INFO#8로 등재 | `trigger-config-lock.ts:6-18` | 조치 불요(planner 턴에서 처리될 항목) |
| 13 | API 계약 | `rewriteTriggerConfigLocked`의 재읽기가 `workspaceId`로 스코핑되지 않음 — 호출부가 이미 워크스페이스 소유권을 사전 검증해 현재는 안전(기존 관행의 연장, 회귀 아님) | `trigger-config-lock.ts`(`m.findOne(Trigger, { where: { id: triggerId } })`) | JSDoc에 "호출부가 소유권을 사전 검증했다고 가정" 전제를 한 줄 명시해 재사용 시 실수 방지 |
| 14 | API 계약 | PATCH 응답이 이제 "요청 시작 시점 스냅샷" 대신 "커밋 시점 최신 상태"를 반영 — 계약 위반이 아니라 REST 의미상 개선이며 CHANGELOG에 이미 명시됨 | `triggers.service.ts` `update()` (`baseConfig` 계산) | 조치 불요 |
| 15 | 성능 | `chatChannel`이 실린 PATCH 하나가 서로 다른 advisory-lock 임계구간을 순차로 두 번 통과(창 1 + binder 트랜잭션) — 순수 DB 왕복 수가 기존 대비 유의미하게 증가(대략 2~3왕복 → 7왕복 안팎) | `triggers.service.ts:549-576` → `chat-channel-binder.service.ts:266-280/303-317` → 응답용 재조회 | 조치 불요 — 이 조합 경로가 성능 모니터링 대상에 포함돼 있는지만 확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이전 CRITICAL#1(창 1 fail-open 재현) 해소 확인. 잔여는 전부 이전 라운드부터 수용된 INFO |
| performance | LOW | 창 1로 PATCH 전체가 lock 비용을 지게 돼 "hot path 영향 없음" 전제가 깨짐(WARNING) |
| architecture | MEDIUM | 락 획득 SQL 중복(헬퍼 vs 창1 인라인) — 향후 drift 위험 |
| requirement | LOW | 이전 CRITICAL 2건 해소 확인. `trigger-config-lock.ts` spec glob 미커버(WARNING, 기존 등재) |
| scope | NONE | 발견사항 없음 — 단일 결함에 정확히 수렴, 넓은 패턴(19건) 중 재현 가능 4개 창만 의도적으로 처리 |
| side_effect | MEDIUM | `revokePerTriggerToken` 등 락 없는 형제 write-site 3곳, 상시 재현 가능 |
| maintainability | LOW | 락 SQL 중복 + 인라인 타입 캐스트 3중복(둘 다 WARNING). `buildChannel` 통합은 긍정 평가 |
| testing | LOW | 이전 CRITICAL 2건+WARNING 1건을 뮤테이션 재실측으로 해소 확인. 잔여는 전부 INFO |
| documentation | LOW | CHANGELOG 누락 해소. 잔여 사무적 동기화(트래커 체크박스) 2건 INFO |
| dependency | NONE | 신규 외부 패키지/버전 변경 0건. 내부 테스트 mock 이관 범위 서술 INFO |
| database | MEDIUM | 창 1이 재읽은 `config` 외 컬럼은 pre-lock 스냅샷 그대로 저장해 형제 창 부분 UPDATE를 되돌릴 수 있음 |
| concurrency | MEDIUM | `hooks.service.ts` hot path가 여전히 락 없는 전체 저장 — 같은 보안 클래스 재발 위험 과소평가 |
| api_contract | NONE | 컨트롤러/DTO/라우트 변경 없음. PATCH 응답이 최신 커밋 반영으로 개선(INFO) |
| user_guide_sync | NONE | 발견사항 없음 — 매트릭스 21개 trigger 전수 매칭 0건(백엔드 서비스 내부 동시성 수정) |

## 발견 없는 에이전트

- scope
- user_guide_sync

## 권장 조치사항

1. **(최우선)** `hooks.service.ts`의 웹훅/채팅 인입 처리 hot path(`:227-228`, `:687-688`)가 이 PR이 막은 것과 동일한 `inboundSigningRef` fail-open 클래스를 더 높은 빈도로 재발시킬 수 있다는 점을 인지하고, plan의 후속 우선순위를 "관측성 lost-update"에서 "보안 재발 위험"으로 재분류할 것 — 최소 조치(컬럼 한정 update 또는 `rewriteTriggerConfigLocked` 경유)를 다음 착수 대상으로 등재.
2. `triggers.service.ts::update()`(창 1)가 `config` 외 컬럼(`chatChannelHealth` 등)을 pre-lock 스냅샷으로 전체 저장해 같은 락 안의 형제 창(rotateBotToken/binder) 부분 UPDATE를 되돌릴 수 있는 문제를 plan §D 트래커에 구체 항목으로 등재하고, 재읽은 행을 베이스로 쓰거나 부분 UPDATE로 전환하는 방안을 검토.
3. `revokePerTriggerToken`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`(§D의 `config` 명시 수정 3행)를 "컬럼만 고치는 6행"과 분리해 후속 우선순위를 재검토 — `revokePerTriggerToken`이 상시 재현 가능해 최우선.
4. advisory lock 획득 SQL을 저수준 프리미티브(`acquireTriggerConfigLock`)로 추출해 헬퍼와 창 1 인라인 구현의 중복·drift 위험 제거.
5. planner 턴에서 `spec/5-system/15-chat-channel.md`의 `code:` frontmatter에 `trigger-config-lock.ts`를 포함하도록 갱신(이미 등재된 항목, 미해소 상태 유지 확인됨).
6. 이 라운드 수렴 시 `plan/complete/` 이동 전, 원 트래커(`spec-draft-nullable-notation-followups.md:2278`)와 본 plan 체크리스트 마지막 항목을 `[x]` + 실측 각주로 동시 갱신.
7. `previousInboundSigningRef` 추출용 인라인 타입 캐스트 3곳(최소 같은 함수 안 2곳)을 이름 있는 헬퍼로 통합해 필드명 변경 시 누락 위험 제거.
8. (낮은 우선순위) 창 1 추가로 PATCH 전체가 advisory lock 비용을 지므로, `PATCH /api/triggers/:id`의 P95/P99 모니터링 추가를 고려.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: 명시되지 않음(prompt `routing: skipped`). 전체 reviewer(14명) 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인됨. 강제 화이트리스트 미이행 없음.