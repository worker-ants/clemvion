# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을 `ChatChannelBinderService`/`buildTriggerCallbackUrl` 로 옮기는 순수 이동 리팩터로, 14개 reviewer 전원이 로직 동일성을 라인 단위로 대조·확인했고 CRITICAL 은 0건이다. 다만 `testing` reviewer 가 실제 뮤테이션으로 검증한 결과, 이 diff 가 새로 만든 위험 표면(콜백 URL 공유 함수의 두 번째 호출부 인자 순서, `teardownChatChannel` 실제 adapter 호출 경로)이 테스트로 잡히지 않아 향후 회귀를 조용히 통과시킬 수 있는 실질적 커버리지 갭이 있다 — 이를 근거로 MEDIUM 으로 판정한다. forced(router_safety) 화이트리스트 7명 전원 결과 확보됨(누락 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `buildTriggerCallbackUrl` 두 번째 호출부(`rotateBotToken`)가 인자 순서(`baseUrl`, `endpointPath`)를 검증하는 단언이 없다 — 실제 뮤테이션(인자 순서 교체)이 124개 테스트 전량 GREEN 으로 살아남음 | `codebase/backend/src/modules/triggers/triggers.service.ts:1061` | `rotateBotToken` 테스트에 `expect(mockAdapter.setupChannel).toHaveBeenCalledWith(expect.anything(), '<기대 URL>')` 형태로 두 번째 인자 단언 추가 |
| 2 | Testing | `teardownChatChannel` 의 핵심 분기(`ChannelAdapterRegistry.has()===true` 일 때 실제 `adapter.teardownChannel()` 호출 + 실패 시 best-effort catch/warn)가 전체 백엔드 테스트 스위트에서 한 번도 실행되지 않음(`remove()` 관련 모든 describe 가 registry 를 `has: () => false` 로 고정) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:277-291` | `remove()` 경로에 registry `has=true` happy-path 1개 + adapter 실패 시 best-effort 로그 경로 1개 테스트 추가 |
| 3 | Testing | 신규 292줄 클래스 `ChatChannelBinderService` 를 직접 겨냥하는 독립 unit spec 파일이 없음 — 모든 커버리지가 `TriggersService`/`triggers.web-chat.spec.ts` 를 통한 간접 행사뿐이라 실패 메시지가 항상 `TriggersService` 시나리오로만 귀속됨. 클래스 자신의 JSDoc 이 선례로 든 `chat-channel-token-rotator.service.ts` 는 독립 spec(`new ChatChannelTokenRotatorService(...)` 직접 인스턴스화)을 갖고 있어 관례상 비대칭 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:49` | 필수는 아니나 후속 PR 에서 `chat-channel-binder.service.spec.ts` 신설 — 실패 메시지 귀속 정확화 + `TriggersService` 거대 spec 결합도 감소 |
| 4 | Documentation | 신규 클래스 JSDoc 이 아직 `plan/in-progress/` 에 있는 plan 파일을 `plan/complete/impl-chat-channel-binder-t2.md` 로 선반영 — 이 저장소의 기존 관례(완료·이동 후에만 그 경로를 인용, 예: `execution-engine.service.ts`)와 어긋남. 현재 시점엔 해당 경로에 파일 없음(깨진 링크) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18` | 마무리 커밋에서 `plan/complete/` 이동이 실제로 일어나는지 push 전 확인. 누락되면 JSDoc 참조가 깨진 채 남음 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `setupChatChannel` 소유 클래스를 현재형(`TriggersService`/`triggers.service.ts`)으로 서술하는 spec 문서 3곳이 이번 이동(`ChatChannelBinderService` 로 실제 이동 완료, 코드 확인됨)으로 stale 해짐. 코드는 의도된 순수 리팩터이므로 spec 갱신 누락이지 코드 결함 아님 | `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29` | 코드 유지 + spec 3곳을 `ChatChannelBinderService.setupChatChannel` 로 정정. **이미 `--impl-prep` consistency-check(W2)가 선제 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재됨(중복 처리 방지)** — 자기-반증형 소정정 조건1 불성립(문장을 이전 planner 턴이 썼음)이라 developer 직접 수정 불가 판단도 맞음 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `15-chat-channel.md` frontmatter `code:` 및 §7 구현 파일 구조 다이어그램이 신규 파일(`chat-channel-binder.service.ts`, `trigger-callback-url.ts`)을 반영하지 않음 — `code:` 미등재는 `--impl-done` spec-linked 게이트가 이 파일들을 대상에서 제외한다는 실질적 영향이 있음 | `spec/5-system/15-chat-channel.md` (frontmatter `code:`, §7) | 코드 유지 + spec 반영(`code:` 에 파일 추가 또는 glob 전환). **이미 W1/INFO#1 로 `spec-draft-nullable-notation-followups.md` 에 등재됨**(T1 의 `chat-channel-input-rules.ts` 에 이어 3번째 재발 — glob 전환 대안까지 근거와 함께 기록돼 있음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / Security / Maintainability / Scope | 이동된 로그 경고 4곳이 여전히 `TriggersService:` 리터럴 접두를 유지 — logger 컨텍스트(`ChatChannelBinderService`)와 메시지 본문이 불일치. "순수 이동 주장을 지키기 위해 의도적으로 남겼다"고 docstring·후속 트래커에 명시됨 | `chat-channel-binder.service.ts:100,250,253,288` | 조치 불요(이미 후속 트래커 등재). 다음에 이 파일을 손댈 때 리터럴 정정 |
| 2 | Performance | secret store 쓰기 2곳(botToken rotate, provider-issued inbound-signing rotate)이 서로 독립인데 순차 `await` — PATCH/POST 지연시간에 두 왕복이 누적됨. 이동 전부터 있던 패턴, 이번 diff 의 회귀 아님 | `chat-channel-binder.service.ts:133-160` | 후속 PR 에서 `storeUserSuppliedSecrets` 게이팅을 유지한 채 `Promise.all` 로 병렬화 고려 |
| 3 | Database / Concurrency | `trigger.config` JSONB 컬럼을 부분 병합이 아니라 통째로 교체(read-merge-write, 여러 `await` 경계를 넘음) — 동시 PATCH 간 lost-update 가능. 사전 존재 패턴이며 별도 트래커(lock 후보: advisory lock/`SELECT...FOR UPDATE`/낙관적 버전)에 이미 등재됨. 이번 이동으로 그 쓰기가 서비스 경계를 넘는 호출이 되어 향후 락 설계 시 "호출자가 잠그는지 vs binder 가 스스로 잠그는지" 축이 하나 늘어남 | `chat-channel-binder.service.ts:226-238,258-269` | 조치 불요(이미 트래킹됨). 락 설계 시 위 선택지 중 하나를 명시 |
| 4 | Architecture | `preservedInboundSigningRef` 파라미터가 "병합 전 캡처해 넘긴다"는 호출 순서 불변식에 타입 시스템이 아닌 JSDoc 산문으로만 의존 — 두 서비스 사이의 암묵적 계약이 됨. 지금은 테스트·문서·회귀 캐너리로 방어됨 | `chat-channel-binder.service.ts:83-96`, 호출부 `triggers.service.ts:500-505,565-568` | 지금 조치 불요. 3번째 호출 지점이 생기는 조짐이 보이면 `PreMergeChatChannelSnapshot` 같은 래핑 타입 고려 |
| 5 | Architecture / Maintainability | `setupChatChannel` 하나가 189줄에 6~8개 관심사(레지스트리 조회·가드·URL 조립·secret ref 생성·3종 쓰기 게이팅·adapter 호출·성공/실패 config 병합)를 담음 — 이번 PR 이 만든 게 아니라 이관된 기존 결함, 이미 백로그(`maintainability W6`, "133→186줄") 등재됨 | `chat-channel-binder.service.ts:83-271` | 조치 불요. 기존 백로그 처리 시 대상 파일 경로만 이 파일로 갱신 |
| 6 | Maintainability | secret ref 생성 로직과 `trigger.config` 캐스팅 패턴이 이동으로 인해 "같은 파일 내부 중복" → "서로 다른 두 파일(`chat-channel-binder.service.ts` ↔ `triggers.service.ts`) 간 중복"이 되어 발견 가능성이 소폭 낮아짐 | `chat-channel-binder.service.ts:118-127,279` vs `triggers.service.ts:1019-1037,997,1218` | 급하지 않음. `buildChatChannelSecretRefs(triggerId)` 같은 공유 헬퍼로 추출 고려 |
| 7 | Requirement / Dependency / Architecture | `buildTriggerCallbackUrl` 과 `common/utils/app-base-url.ts::getAppBaseUrl()` 이 같은 개념(APP_URL 기본값+trailing slash 제거)을 두 벌 유지 — 읽는 소스가 다름(`ConfigService` vs `process.env` 직접), 통합 시 9~14개 테스트 모듈의 mock 통제권이 깨진다는 근거로 통합 보류가 docstring 에 이미 문서화됨 | `trigger-callback-url.ts:37-43` | 조치 불요(이미 W4 로 등재, 별도 DI 변경 PR 대상) |
| 8 | Requirement / API Contract / Documentation | `rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터(`@ApiOkResponse` 등) 부재 — 이번 PR 범위 밖(`triggers.controller.ts` 는 diff 에 없음)의 사전 존재 갭, 이미 W3 로 등재됨 | `triggers.controller.ts` `rotateBotToken` | 조치 불요(이미 등재) |
| 9 | Architecture | `TriggersService` 단위 테스트 9개 이상 블록이 `ChatChannelBinderService` 를 mock 없이 실제 클래스로 주입 — "단언 diff 0줄" 증거 전략과 일치하는 의도된 선택이나, 클래스 경계가 생겼는데도 테스트 격리에 아직 활용되지 않음(향후 `ChatChannelBinderService` 내부 변경 시 무관한 `TriggersService` 테스트까지 실패할 표면) | `triggers.service.spec.ts` 다수 블록, `triggers.web-chat.spec.ts:80` | 지금 조치 불요. 다음에 손댈 때 chat-channel 무관 describe 블록은 `jest.fn()` stub 고려 |
| 10 | Security / Architecture / Dependency (긍정 관찰) | `ChatChannelBinderService` 가 `TriggersModule.providers` 에만 등록되고 `exports` 에는 없음 — secret store 에 직접 쓰는 협력자의 공개 표면이 오히려 좁아짐. `chat-channel↔triggers` 순환 의존(#676 에서 제거)도 재발하지 않음(모듈 wiring 직접 확인) | `triggers.module.ts` | 조치 불요(설계 의도와 일치) |
| 11 | Documentation / Dependency (프로세스 관측, 이미 해소됨) | 리뷰 세션 진행 중 공유 워크트리에서 `chat-channel-binder.service.ts` 에 대한 병렬 reviewer 의 뮤테이션 검증 흔적(미커밋 diff)이 일시적으로 관측됨 — SUMMARY 작성 시점 `git status --short` 재확인 결과 해당 파일 modified 표시 없이 클린 상태로 확인되어, 뮤테이션을 만든 reviewer가 정상적으로 원복 완료했음이 검증됨 | `chat-channel-binder.service.ts` | 조치 불요(해소 확인됨) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이동 전후 로직 바이트 단위 동일, 인젝션/인증/시크릿 하드코딩 없음. `ChatChannelBinderService` 미export 로 공개표면 오히려 축소(긍정) |
| performance | NONE | N+1 없음, 순수 이동. secret rotate 2건 순차 await(INFO, 병렬화 여지) |
| architecture | LOW | `chat-channel↔triggers` 순환 재발 없음(직접 확인). `preservedInboundSigningRef` 암묵적 호출-순서 계약, 응집도 문제 이관(둘 다 INFO) |
| requirement | LOW | 기능/로직 결함 없음(단언 diff 0줄, DI 배선 정합 재확인). SPEC-DRIFT 2건 발견(이미 planner 등재 확인) |
| scope | NONE | 스코프 이탈·불필요한 리팩토링·무관한 수정 전부 없음. 부수 함수 추출은 plan 에 근거 문서화됨 |
| side_effect | LOW | DB/secret/registry 쓰기 조건·순서·인자 전부 보존. 로그 컨텍스트 불일치(INFO)만 신규 관측 |
| maintainability | LOW | 함수 길이 이슈는 이관된 기존 결함. secret ref 패턴이 2파일 중복으로 전환(INFO) |
| testing | MEDIUM | 3개 지정 뮤테이션은 실제로 RED 재현(plan 주장 검증됨). 이 diff 가 새로 만든 인자순서 미검증 + teardown 실경로 미검증 + 독립 spec 부재(WARNING 3건) |
| documentation | LOW | JSDoc `plan/complete/` 경로 선반영(WARNING). spec 3곳 stale 은 교차 확인(이미 등재). 병렬 뮤테이션 흔적 투명 보고(해소됨) |
| dependency | NONE | 신규 외부 패키지·lockfile 변경 0건. 내부 의존 방향(단방향) 재확인 |
| database | LOW | 신규 쿼리/마이그레이션 없음. config 통째 교체로 인한 lost-update 가능성은 사전 존재(이미 트래킹) |
| concurrency | LOW | 신규 lock/Promise 조합 없음. config read-merge-write 비원자성은 사전 존재(이미 유예 처분됨) |
| api_contract | NONE | 요청/응답/에러코드/URL 형태 전부 이동 전후 동일. OpenAPI 갭은 스코프 밖 사전 갭(이미 등재) |
| user_guide_sync | NONE | doc-sync-matrix 21행 전수 대조 매칭 0건. frontend/i18n/docs/spec 파일 변경 없음 |

## 발견 없는 에이전트

- user_guide_sync (매트릭스 매칭 0건, 발견사항 "없음"으로 명시)

## 권장 조치사항

1. `rotateBotToken` 테스트에 `buildTriggerCallbackUrl` 두 번째 호출부의 인자(URL 문자열)를 단언하는 케이스 추가 — 현재 인자 순서를 바꿔도 전량 GREEN (WARNING #1)
2. `remove()` 경로에 `ChannelAdapterRegistry.has()===true` happy-path + adapter 실패 시 best-effort catch 경로 테스트 추가 — `teardownChatChannel` 핵심 분기가 현재 0% 커버 (WARNING #2)
3. 마무리 커밋에서 `plan/in-progress/impl-chat-channel-binder-t2.md` 가 실제로 `plan/complete/` 로 이동했는지 push 전 확인 — 신규 클래스 JSDoc 이 이미 그 경로를 인용 중 (WARNING #4)
4. (선택, 후속 PR) `ChatChannelBinderService` 독립 unit spec 신설로 실패 메시지 귀속 정확화 (WARNING #3)
5. SPEC-DRIFT 2건은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 인계 항목으로 정확히 등재돼 있으므로, `--impl-done` / 다음 planner 턴에서 spec 3곳(`secret-store.md`·`chat-channel-adapter.md`·`14-chat-channel.md`) 및 `15-chat-channel.md` frontmatter `code:`/§7 갱신 반영 여부만 확인
6. INFO 항목들은 대부분 이미 후속 트래커에 등재돼 있어 이번 PR 에서 추가 조치 불요 — 다음에 해당 파일을 손댈 기회에 일괄 반영 권장

## 라우터 결정

- `routing_status=skipped` — forced(router_safety) 화이트리스트를 포함해 **전체 14개 reviewer 실행**(제외 0명):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨**(누락 없음, whitelist 이행 정상)
