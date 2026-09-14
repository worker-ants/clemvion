# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. `remove()`/삭제-경합 관련 잔여 레이스(WARNING 3건)와 `hooks.service.ts`/`CHANGELOG.md` 의 유지보수성 결함(WARNING 2건)이 남아 있으나, 핵심 lost-update/fail-open 결함(동시 PATCH·설정·회전·웹훅 인입이 `trigger.config` 를 스냅샷으로 덮어써 `inboundSigningRef` 를 지우고 인입 서명 검증을 fail-open 시키던 것)은 advisory lock + 락 안 재읽기로 14개 reviewer 전원이 독립 확인(코드 대조 + 뮤테이션 재현 5건 + 유닛 209 passed)했다. **forced 화이트리스트(7명: documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 강제 화이트리스트 미이행 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `TriggersService.update()` 가 PATCH 요청마다 `relations: ['workflow']` JOIN 을 가진 SELECT 를 **두 번** 실행한다 — `findById()`(트랜잭션 진입 전 검증용)의 결과는 `trigger.workflow` 를 전혀 참조하지 않는데도 소비되지 않은 채 버려지고, 락 안 재읽기가 같은 조인을 다시 실행 | `codebase/backend/src/modules/triggers/triggers.service.ts:473`(`findById` 호출), `:557-560`(락 안 `m.findOne` 재읽기) | 트랜잭션 진입 전 검증에는 `relations` 없는 가벼운 조회를 쓰고, `workflow` 조인은 응답 구성에 실제로 쓰이는 락 안의 두 번째 읽기에만 남긴다 |
| 2 | database, concurrency | `TriggersService.remove()` 가 이번에 도입된 `trigger-config:<id>` advisory lock 프로토콜에 전혀 참여하지 않아 삭제와 config 재작성 사이에 레이스가 남는다. 특히 창 1(`update()`)은 `m.save()` 를 쓰므로 읽기 시점 가드(`!fresh`)만으로는 "읽었을 땐 있었는데 저장 직전에 삭제되는" **쓰기 시점** 부활을 못 막는다(`save()` 의 insert-on-missing-row 시맨틱) — `m.update()` 를 쓰는 형제 세 창(조용한 no-op)보다 위험이 크다. plan 문서의 "지금은 네 창 모두 «행이 없으면 쓰지 않는다»" 서술이 이 차이를 가린다. `Trigger.workflow`/`workspace` 의 `onDelete: 'CASCADE'` 도 애플리케이션 락으로 못 막는 같은 창을 연다 | `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()`(락 획득 없음), `update()` 트랜잭션 블록(`:548-601`, `m.save(Trigger, fresh)` at `:599`) | `remove()` 도 같은 트랜잭션 안에서 `acquireTriggerConfigLock` 을 잡거나, 창 1 의 `m.save()` 를 `m.update()`+`affected` 확인으로 바꿔 형제 세 창과 같은 "조용한 no-op" 실패 모드로 낮춘다(단, `save`→`update` 전환은 계약 변화가 있어 사전 테스트 고정 필요). plan 의 "네 창 동일 보장" 서술을 창 1 한정으로 정정 |
| 3 | api_contract | 삭제-경합 시 형제 3개 쓰기 경로(`setupChatChannel` 성공/실패, `rotateBotToken`)가 `rewriteTriggerConfigLocked` 의 반환값(`false`=쓰기 스킵됨)을 무시하고 계속 진행해, 이미 삭제된 트리거에 대해 **200 성공 응답 + 조작된 audit 로그**(`TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 등)를 남긴다 — 같은 삭제-경합 조건에 대해 창 1(404)과 형제 3창(200+거짓 성공)이 다르게 응답하는 비대칭이 이번 커밋으로 새로 두드러졌다 | `codebase/backend/src/modules/triggers/triggers.service.ts:1174-1201`(`rotateBotToken`), `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266`,`:303`(`setupChatChannel`) | 최소 `rotateBotToken` 이라도 반환값을 확인해 `false` 면 `recordAudit` 를 건너뛰고 404(`RESOURCE_NOT_FOUND`)로 통일. 데이터 손상은 없고 경합 창도 좁아 이번 배치를 막을 사유는 아니나 plan 후속 항목의 우선순위를 "관측성"에서 "형제 엔드포인트 응답 일관성"으로 상향 권고 |
| 4 | maintainability | `hooks.service.ts` 두 호출부(`handleWebhook`, chat-channel 인입)에 `lastTriggeredAt` 컬럼 갱신 5줄 주석 + 4줄 코드가 문자 그대로 복제됨 — 이 PR 자신이 이미 한 번 겪은 "두 자리 중 한쪽만 고쳐 회귀 테스트 없는 자리가 fail-open 으로 남았다"는 drift 위험을 그대로 재현 가능한 형태 | `codebase/backend/src/modules/hooks/hooks.service.ts:227-236`(`handleWebhook`), `:695-704`(chat-channel 인입) | `private async touchLastTriggeredAt(trigger: Trigger)` 같은 헬퍼로 통합, 근거 주석은 한 곳에만 남긴다(`chat-channel-binder.service.ts` 의 `buildChannel` 통합과 같은 처방) |
| 5 | maintainability | `CHANGELOG.md` 편집 시 advisory-lock 설계 근거 문장("외부 provider 호출은 락 밖에 남는다 — Cafe24 토큰 갱신에서...")이 문단 구분(빈 줄) 없이, 락을 전혀 쓰지 않는 **웹훅 컬럼 갱신 단락** 뒤에 그대로 붙어 근거가 잘못 귀속됨 | `CHANGELOG.md:19` | 두 문장을 원래 단락(advisory-lock 재읽기 단락)으로 되돌리거나 두 단락 사이에 빈 줄을 넣어 서로 다른 두 수정의 근거가 섞이지 않게 한다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 은 `triggerId` 만으로 재읽기·잠금을 수행하고 workspace 소유권을 자체 검증하지 않는다 — 현재 호출부 3곳 모두 이미 workspace 검증된 id 만 넘겨 실제 악용 경로는 없음 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`rewriteTriggerConfigLocked`) | JSDoc 에 "호출자가 이미 workspace 소유권을 검증한 id 만 넘겨야 한다" 전제 명시, 또는 선택적 `workspaceId` 파라미터 추가 |
| 2 | performance | advisory lock 에 `lock_timeout` 이 없어 같은 트리거에 대한 동시 요청이 무기한 대기 — 임계구간이 짧아 개별 영향은 낮지만 비정상 폭주 시 커넥션 풀 고갈로 번질 수 있는 용량 리스크(이미 JSDoc·타 리뷰에서 설계 트레이드오프로 수용됨) | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46` | 조치 불요(이미 수용) — 향후 임계구간 확장 시 JSDoc 예고대로 `lock_timeout` 추가 |
| 3 | architecture | 삭제-레이스 처리 방식이 창 1(404 `NotFoundException`)과 창 2~4(`false` 반환, 조용히 무시)로 갈리는데, `trigger-config-lock.ts` JSDoc·CHANGELOG·plan 모두 이 차이를 "쓰지 않는다"는 한 문장으로 뭉뚱그려 다음 확장자가 판단 기준을 못 얻는다 (architecture/requirement/documentation/api_contract 공통 관찰, WARNING#3 의 근본 원인과 동일하나 여기서는 서술 정밀도 관점) | `CHANGELOG.md:14`, `triggers.service.ts:592-596` vs `trigger-config-lock.ts:113-114` | JSDoc/CHANGELOG 에 "창 1 은 404 로 드러내고(동기 요청), 이 함수는 false 로 감춘다(best-effort 후속 작업)"는 판단 기준 한 줄 추가 |
| 4 | side_effect | `setupChatChannel` 성공 경로가 `rewriteTriggerConfigLocked` 반환값을 무시하고 `channelListenerRegistry.register()` 를 무조건 호출 — 삭제-경합 시 해제되지 않는 유령 listener entry 가 in-memory registry 에 남을 수 있음. `ChatChannelDispatcher.handle()` 이 registry-DB 불일치를 warn+skip 으로 이미 관대하게 처리해 크래시·오배달로는 안 이어짐. PR 신규 결함 아님(기존 gap) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266-284` | 여유 있으면 `if (await rewriteTriggerConfigLocked(...)) { register(...) }` 로 유령 등록 자체를 방지 |
| 5 | maintainability | `TriggersService.update()`가 이번 델타로 한 단계 더 길어졌고(~185줄), `previousInboundSigningRef` 클로저 경계가 선언→트랜잭션 내 재대입→커밋 후 소비로 3단을 넘는 문제는 여전히 plan 후속 표에만 있는 미해결 상태(기존 지적 재확인, 새 이슈 아님) | `codebase/backend/src/modules/triggers/triggers.service.ts:467-651` | 이미 트래킹 중, 다음 확장 시 `saveWithConfigLock(...)` 류 private 메서드 분리 검토 |
| 6 | testing | `trigger-transaction-mock.ts` JSDoc 의 "실측 13개 RED" 서술이 이번 세션 재측정(43건, `src/modules/triggers` 전체 기준)보다 좁다 — 방향(장식이 아니라 배선)은 정확하나 수치가 특정 describe 한정으로 보임 | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`(파일 상단 JSDoc) | "13개"를 "(특정 describe 한정)"으로 좁혀 적거나 파일 전체 기준으로 갱신 |
| 7 | testing | 신규 `extractInboundSigningRef`(보안 관련 presence 게이트 입력)에 대한 격리 unit 테스트가 없음 — 현재는 `triggers.service.spec.ts` 통합 테스트로만 간접 커버 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:247` | `chat-channel-input-rules.spec.ts`에 `config: null/undefined/{}/{chatChannel:null}`/정상 값 다섯 갈래 표 단언 추가 |
| 8 | dependency | `withTransactionMock`이 `triggers.service.spec.ts`·`triggers.web-chat.spec.ts` 2곳에만 이관됐고 `auth-configs`·`external-interaction`·`hooks`·`schedules` 4개 스펙은 아직 미적용(현재는 트랜잭션을 안 타 안전, 명시된 기술 부채) | `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` | 백로그 성격, 문서에 이미 명시됨 — 추가 조치 불요 |
| 9 | database | advisory lock 키가 32bit `hashtext()` 해시 공간을 `execution-engine.service.ts` 의 `exec-cap:<workspaceId>` 와 전역 공유 — 충돌 시 과직렬화(정확성 문제 아님), 이미 planner 후속(`redis-keys.md §4`)으로 등재됨 | `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(`TRIGGER_CONFIG_LOCK_PREFIX`) | 이미 등재됨, 추가 조치 불요 |
| 10 | requirement | 이 작업 자신의 plan 체크리스트 마지막 3항목(트래커 `[x]`+실측 각주, run-test-all, `/ai-review`+`--impl-done`)이 아직 미완 — 코드 결함 아님, self-tracked 정지 규칙 미충족 상태 | `plan/in-progress/trigger-config-lost-update.md:423-425` | 이번 라운드가 Critical/Warning 수렴 시 정지 규칙대로 마무리 커밋 진행 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-open 결함이 advisory lock 으로 정확히 닫힘. 인젝션·시크릿·인가 이상 없음 |
| performance | LOW | `update()` JOIN 중복 실행(WARNING), lock_timeout 부재로 인한 용량 리스크(INFO) |
| architecture | LOW | 부재 처리 계약 창별 비대칭 미문서화(INFO), hooks 복제(WARNING 로 승격, maintainability 참조) |
| requirement | LOW | CHANGELOG 서술 정밀도, plan 체크리스트 잔여(둘 다 INFO) — 요구사항 충족 자체는 확인 |
| scope | NONE | 실질 코드 4파일에 집중, 부수 리팩터 3건 모두 이 PR 자신의 리뷰 라운드에 대한 대응으로 추적 가능 |
| side_effect | LOW | listener registry 유령 entry(INFO), 이전 라운드 CRITICAL 2건 해소 확인 |
| maintainability | LOW | hooks.service.ts 복제(WARNING), CHANGELOG 문단 오귀속(WARNING) |
| testing | NONE | 5개 독립 뮤테이션으로 이전 CRITICAL 해소 재확인, 새 회귀 없음 |
| documentation | NONE | 이전 3라운드 WARNING/INFO 전부 실측 해소 확인, 신규는 저비용 INFO 1건 |
| dependency | NONE | 신규 외부 의존성 0건, 내부 모듈 그래프 단방향 유지 |
| database | LOW | `remove()` 미락(WARNING), lock 설계 트레이드오프 재확인(INFO) |
| concurrency | LOW | 창1 `save()` 특유의 쓰기-시점 부활 레이스(WARNING), lock 무상한 대기(INFO 재확인) |
| api_contract | LOW | 형제 3경로의 반환값 무시로 인한 API 응답/audit 로그 비일관(WARNING) |
| user_guide_sync | NONE | 매트릭스 21개 trigger 행 매칭 0건 — 순수 내부 동시성 수정 |

## 발견 없는 에이전트

없음 (모든 reviewer 가 최소 1건 이상의 관찰을 남김; NONE 판정 에이전트도 확인/재확인 사항을 보고).

## 권장 조치사항
1. `remove()` 를 `trigger-config:<id>` advisory lock 프로토콜에 포함시키거나, 창 1(`update()`)의 `m.save()` 를 `m.update()`+`affected` 확인으로 바꿔 형제 세 창과 동일한 안전 수준으로 낮춘다 (database/concurrency WARNING).
2. `rotateBotToken`(최소한이라도)이 `rewriteTriggerConfigLocked` 반환값을 확인해 `false` 시 `recordAudit`를 건너뛰고 404 로 응답을 통일한다 (api_contract WARNING).
3. `hooks.service.ts` 두 자리의 `lastTriggeredAt` 갱신 로직을 `touchLastTriggeredAt` 헬퍼로 통합해 drift 위험을 제거한다 (maintainability WARNING).
4. `CHANGELOG.md` 의 advisory-lock 근거 문장을 올바른 단락으로 되돌리거나 문단 구분을 추가한다 (maintainability WARNING).
5. `TriggersService.update()` 의 트랜잭션 진입 전 `findById()` 호출에서 불필요한 `relations: ['workflow']` JOIN 을 제거해 PATCH 요청당 중복 SELECT 를 없앤다 (performance WARNING).
6. (저비용, 급하지 않음) CHANGELOG/JSDoc 에 "창 1=404, 창 2~4=조용한 skip" 비대칭을 한 줄로 명시하고, plan 체크리스트 잔여 3항목을 이번 라운드 수렴 후 마무리한다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 명시된 skip 사유 없이 전체 14개 reviewer 실행됨(fallback 전량 실행 경로).
- **강제 포함(router_safety) 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 완료, 누락 없음.**
- **실행**: 위 14명 전원 (security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync)
- **제외**: 없음 (routing 미사용이므로 router 에 의한 제외 자체가 없음)