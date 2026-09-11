# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(둘 다 테스트/문서 완결성 갭이며 프로덕션 동작 회귀 없음). `TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`을 신규 `ChatChannelBinderService`/`buildTriggerCallbackUrl`로 옮기는 3라운드째 순수 리팩터로, 14개 reviewer(강제 화이트리스트 7명 `documentation, maintainability, requirement, scope, security, side_effect, testing` 포함) 전원이 결과를 냈고 누락 없음 — "forced인데 결과 없음" 상황 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `TriggersService.remove()`가 `chatChannelBinder.teardownChatChannel(trigger)`를 호출한다는 배선 자체를 검증하는 테스트가 없다 — 그 호출을 통째로 삭제해도 관련 스위트(triggers.service.spec.ts 외 3개, controller spec 포함)가 전부 GREEN임을 뮤테이션으로 실증(원복 확인 완료). 대칭되는 `setupChatChannel` 호출부(`create`/`update`)는 실제 adapter mock 값까지 두껍게 단언하는 반면 `teardownChatChannel` 쪽만 비대칭으로 비어 있다. 리팩터가 새로 만든 결함은 아니나(이동 전부터 존재), 클래스 분리로 낮은 비용에 닫을 수 있는 시점이 됐다 | `codebase/backend/src/modules/triggers/triggers.service.ts:855` (`remove()` 내부 `await this.chatChannelBinder.teardownChatChannel(trigger);`) | `remove — deleteByPrefix 호출 검증` describe에 `chatChannel`이 있는 트리거로 `teardownChatChannel`이 정확한 인자로 호출됐음을 단언(또는 최소 `jest.spyOn`으로 호출 자체 고정)하는 케이스 추가 |
| 2 | Documentation | plan 설계 스케치에서 2라운드 리뷰가 지적한 옛 위치-인자 호출 예시 2곳 중 **한 곳만** 이름 인자로 정정됐다. 나머지 한 곳은 여전히 `buildTriggerCallbackUrl(this.configService.get('app.url'), path)` 형태(실제 시그니처는 `{ baseUrl, endpointPath }` 객체 1개)로 남아 있는데, 직전 수정의 RESOLUTION.md는 이를 "완전 해소"로 잘못 기록했다. 이 plan은 곧 `plan/complete/`로 영구 보존되므로 지금 정정하는 편이 싸다 | `plan/in-progress/impl-chat-channel-binder-t2.md:88` | `:88`의 인용문을 `buildTriggerCallbackUrl({ baseUrl: this.configService.get('app.url'), endpointPath: path })` 형태로 맞추거나, `:82-84`처럼 "착수 시점 판본" 각주를 붙인다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 외부 adapter(Slack/Discord/Telegram) 오류 메시지가 `chatChannelLastError`로 그대로 저장·노출된다 — 이동 전부터 있던 동작, 이미 트래커 등재 | `chat-channel-binder.service.ts` `setupChatChannel` catch 블록 | 조치 불요(트래킹됨). 후속으로 분류 코드 대체 고려 |
| 2 | Security/Architecture | `ChatChannelBinderService`가 `TriggersModule.exports`에 없어(providers만) 공개 표면이 넓어지지 않음 — 긍정 관찰 | `triggers.module.ts` | 조치 불요 |
| 3 | Performance/Concurrency | secret store 다중 쓰기(`secrets.rotate` 최대 3회)가 순차 `await`로 실행됨 — 이동 전부터 있던 설계(부분 실패 시 순서 보장 의도), 이미 트래커 등재(INFO 2) | `chat-channel-binder.service.ts` `setupChatChannel` (rotate 호출 3곳) | 조치 불요(트래킹됨) |
| 4 | Architecture/Maintainability | secret-ref 이름 리터럴(`buildSecretRef({scope,resourceId,name})`) 생성 패턴이 `chat-channel-binder.service.ts`와 `triggers.service.ts`(`rotateBotToken`) 양쪽에 독립적으로 반복됨 — 리팩터 이전부터 있던 중복, 클래스 분리로 가시성만 서비스 경계 너머로 이동 | 두 파일의 `botTokenRef`/`inboundSigningRef` 선언부 | 조치 불요(이 PR 범위 밖). 3번째 소비자 생기면 공유 헬퍼 고려 |
| 5 | Database/Concurrency | `trigger.config` JSONB 컬럼의 read-then-full-replace 갱신 패턴에 lost-update(TOCTOU) 가능성 — 이동 전부터 존재, 이미 트래커 등재 | `chat-channel-binder.service.ts` `setupChatChannel`(226~269행대), `triggers.service.ts` `rotateBotToken`(1088~1098행대) | 조치 불요(트래킹됨). 후속 시 낙관적 락 또는 `jsonb_set` 부분 병합 고려 |
| 6 | Database | secret store 다중 쓰기 + `triggerRepository.update`가 트랜잭션 경계 없이 순차 실행됨(best-effort 설계, 코드 주석이 인지·수용) — 이미 트래커 등재 | `chat-channel-binder.service.ts` `setupChatChannel` | 조치 불요(트래킹됨) |
| 7 | Maintainability | `setupChatChannel`이 약 189줄로 레지스트리 조회~성공/실패 병합까지 한 함수에서 담당 — 이동 전부터 존재, 이미 트래커 등재 | `chat-channel-binder.service.ts` `setupChatChannel` 전체 | 조치 불요(트래킹됨) |
| 8 | Dependency | `buildTriggerCallbackUrl`과 `common/utils/app-base-url.ts::getAppBaseUrl()`의 URL 조립 로직(fallback+슬래시 제거)이 논리적으로 중복 — 통합 보류 근거(ConfigService vs process.env, DI 변경 필요)가 JSDoc에 문서화, 이미 트래커 등재 | `trigger-callback-url.ts` JSDoc | 조치 불요(별도 PR로 분리 트래킹됨) |
| 9 | Requirement/Documentation | `chat-channel-binder.service.ts:18` JSDoc이 아직 `plan/in-progress/`에 있는 plan을 `plan/complete/impl-chat-channel-binder-t2.md`로 인용 — plan 체크리스트에 마무리 커밋 시 확인 항목으로 이미 명시된 known-temporary 상태 | `chat-channel-binder.service.ts:18` | 조치 불요 — `plan/complete/` 이동 시점에 체크리스트로 검증 |
| 10 | Requirement/Documentation/API Contract | spec 문서 3곳(`spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/14-chat-channel.md`)이 `setupChatChannel` 소유를 옛 `TriggersService`로 서술, `rotate-bot-token` 엔드포인트 OpenAPI 데코레이터 부재 — `--impl-prep` W2/W3가 이미 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재됨(developer 권한 밖, 자기-반증형 소정정 조건 1 불성립) | spec 3개 파일, `triggers.controller.ts` `rotateBotToken` | 조치 불요 — planner 인계 절차대로 처리 중 |
| 11 | Side Effect | `setupChatChannel`/`teardownChatChannel`이 `private`→`public`으로 바뀌어 모듈 내부 캡슐화 경계가 미세하게 넓어짐. 모듈 밖 export는 없고 현재 호출자는 `TriggersService` 하나뿐이라 즉각 위험은 없음 | `chat-channel-binder.service.ts` 클래스/메서드 시그니처 | 조치 불요 — 향후 `TriggersModule`에 provider 추가 시 우회 경로 상기 |
| 12 | Side Effect/Architecture | `Logger.prototype.warn` spy 복원을 `afterEach(jest.restoreAllMocks)`로, `rotateBotToken` `ConfigService` mock을 키-인식형으로 강화 — 직전 라운드 지적 해소 확인(긍정 관찰) | `chat-channel-binder.service.spec.ts`, `triggers.service.spec.ts` | 조치 불요 |
| 13 | Testing | `chat-channel-binder.service.spec.ts`가 `teardownChatChannel`만 다루고 `setupChatChannel`은 의도적으로 재커버 안 함 — 근거(`triggers.service.spec.ts`가 공개 진입점으로 이미 커버) 실측 확인, 결함 아님 | `chat-channel-binder.service.spec.ts:1-18` 헤더 | 조치 불요 |
| 14 | Testing | `buildTriggerCallbackUrl` 순수 함수 테스트가 연속 슬래시(`//hook-abc`)·baseUrl 빈 문자열+후행 슬래시 겹침 조합의 경계값을 다루지 않음(실무 위험 낮음) | `trigger-callback-url.spec.ts` | 급하지 않음 — 후속 캐너리 1개 추가 고려 |
| 15 | Scope | changeset 53개 파일 중 45개가 plan/review 프로세스 산출물(실질 코드는 8개) — CLAUDE.md 정보 저장 위치 규약에 정확히 부합하는 정상 경로, 결함 아님 | `git diff origin/main --stat` 전체 | 조치 불요 — 다음 리뷰어를 위한 참고 |
| 16 | Scope | plan 문서가 "병렬 reviewer의 워크트리 뮤테이션" 문제를 트래커에만 적고 실제 harness 코드(`.claude/skills/code-review-agents/**`)는 이 PR에서 건드리지 않음 — 스코프 경계를 정확히 지킨 긍정 사례 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |
| 17 | (프로세스 관측) | 리뷰 도중 architecture/requirement/database 3개 reviewer가 독립적으로 `triggers.service.ts` `remove()`의 `teardownChatChannel` 호출이 `// MUTATED-OUT: ...` 주석으로 일시 치환된 것을 관측 — 각자 확인 시점에 이미 자연 복구됨(`git status --short` clean). 이 PR의 코드 결함 아니며, 다른 병렬 reviewer의 뮤테이션 테스트 잔여물로 추정(같은 클래스의 재발 3회째, 트래커에 이미 등재) | `codebase/backend/src/modules/triggers/triggers.service.ts` (`remove()`) | 조치 불요 — SUMMARY 확정 전 최종 `git status --short`로 원상 복구 재확인 완료(clean) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | secret 쓰기 게이팅·PATCH 비밀 미기록 등 이동 전후 바이트 단위 동일. INFO 2건(adapter 에러 노출 사전존재, export 경계 긍정) |
| performance | NONE | 로직 이동 전후 완전 동일, 알고리즘/쿼리/캐싱 변화 없음. INFO 4건 전부 사전존재·영향 미미 |
| architecture | NONE | Extract-Class 구조 재변경 없음, 순환 의존 재발 없음. INFO 2건 + 워크트리 뮤테이션 관측(자체 해소) |
| requirement | NONE | spec(CCH-AD-02/03, R-CC-21, §5.4.1.1)과 line-level 일치, 신규 spec 불일치 없음. INFO 2건(JSDoc 경로, 뮤테이션 관측) |
| scope | NONE | 4번째 커밋은 직전 WARNING 3건만 정확히 겨냥한 최소 diff. INFO 2건(프로세스 산출물 비율, 스코프 경계 준수) |
| side_effect | LOW | 새 회귀 없음. `private`→`public` 캡슐화 경계 미세 확장(즉각 위험 아님), Logger/mock 격리 개선 확인 |
| maintainability | NONE | fix-only 커밋이 정확한 범위로 수정. INFO 3건 전부 사전존재(함수 길이, secret-ref 중복, 트리비아 빈 줄) |
| testing | LOW | **WARNING 1건**: `remove()`의 `teardownChatChannel` 호출 미검증(뮤테이션 실증). INFO 2건은 결함 아님/저위험 |
| documentation | LOW | **WARNING 1건**: plan 코드 스케치 2곳 중 1곳만 정정, RESOLUTION 오기재. `@param` 이슈는 완전 해소 확인 |
| dependency | NONE | 신규 외부 의존 0건, 매니페스트/락파일 변경 0건. INFO 1건(내부 유틸 중복, 트래킹됨) |
| database | LOW | 신규 쿼리/마이그레이션/트랜잭션 위험 없음, SQL 인젝션 없음. INFO 3건(다중쓰기 비-트랜잭션·lost-update·뮤테이션 관측, 전부 사전존재/자체해소) |
| concurrency | LOW | 새 동시성 결함 없음(신설 서비스 상태 없음, 순수함수). INFO 3건(lost-update·클래스 분리로 writer 가시성 저하·순차 await, 전부 사전존재) |
| api_contract | NONE | 엔드포인트/스키마/에러코드/URL 형태 변경 없음. INFO 1건(OpenAPI 갭, 사전존재·트래킹됨) |
| user_guide_sync | NONE | doc-sync-matrix 21행 전수 대조 매칭 0건, frontend/channel-web-chat/spec 파일 0개 |

## 발견 없는 에이전트

- api_contract, dependency, user_guide_sync — 위험도 NONE, INFO도 실질적으로 사전존재 트래킹 항목 재확인뿐
- (나머지 NONE 에이전트도 신규 결함은 없음 — 표 참고)

## 권장 조치사항

1. `TriggersService.remove()` describe에 `chatChannelBinder.teardownChatChannel` 호출/인자 단언 케이스를 추가해 WARNING 1(테스트 커버리지 비대칭)을 닫는다.
2. `plan/in-progress/impl-chat-channel-binder-t2.md:88`의 잔여 위치-인자 스케치를 정정하거나 "착수 시점 판본" 각주를 붙여 WARNING 2(문서 완결성)를 닫는다 — plan이 `plan/complete/`로 이동되기 전에 처리.
3. (급하지 않음, 이번 PR 비차단) 마무리 커밋 시 plan을 `plan/complete/`로 이동하고 `chat-channel-binder.service.ts:18`의 JSDoc 경로 참조가 실재하는지 체크리스트로 재확인.
4. (급하지 않음, 이번 PR 비차단) INFO로 이미 트래킹된 항목(lost-update 가능성, secret store 비-트랜잭션 다중쓰기, secret-ref 이름 리터럴 중복, `buildTriggerCallbackUrl`/`getAppBaseUrl` 중복)은 별도 후속 작업에서 처리 — 이번 PR 범위 재확대 불필요.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, 프롬프트에 `routing: skipped`로만 명시). 전체 14개 reviewer 실행됨: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`.
- **강제 포함(router_safety) 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음, "forced인데 결과 없음" 상황 아님).
- 제외된 reviewer 없음(routing skipped이므로 전원 실행).
