# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 신규 발견 없음. `database`·`concurrency`·`requirement` 3개 reviewer 가 사전 존재하는(이 PR 이 만들지 않은) `trigger.config` JSONB read-merge-write lost-update 패턴을 재확인하며 LOW 로 판정했고, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 후속 항목으로 등재돼 이번 PR 의 조치 대상이 아니다. **forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.**

이번 라운드(4번째 `/ai-review`)는 직전 3라운드(`18_04_36`→`18_42_05`→`19_06_54`)가 CRITICAL 0 으로 수렴시킨 `TriggersService`→`ChatChannelBinderService`/`buildTriggerCallbackUrl` 리팩터에 대한 최종 test-hardening 확인 라운드다. 14개 reviewer 전원이 소스를 직접 열어 재검증했고, 신규로 도입된 CRITICAL/WARNING 급 결함은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency/Database/Security | `trigger.config` JSONB 컬럼에 대한 read-merge-write 가 여러 `await` 경계를 넘어 이뤄져 동일 `trigger.id` 동시 PATCH 간 lost-update 가능 (사전 존재, 이 PR 이 만든 것 아님 — TriggersService 원본에 있던 패턴을 그대로 이동) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel` 성공 경로(`newConfig` 조립 후 update, ~226-238행) 및 실패 경로(`fallbackConfig`, ~258-269행) | 이번 PR 범위 밖. 후속에서 row-level lock/낙관적 버전 컬럼 도입 시 쓰기 지점이 서비스 경계를 넘었다는 사실 반영. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 등재됨 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 코드가 `TriggersService.setupChatChannel` 대신 `ChatChannelBinderService.setupChatChannel` 을 소유하게 되면서 spec 3곳(`secret-store.md`, `chat-channel-adapter.md`, `data-flow/14-chat-channel.md`)의 귀속 서술이 옛 심볼 경로를 가리킴 — 내용 실질은 불변, 심볼 경로만 낡음 | spec 문서 3곳(`spec/5-system/*`) | developer 권한 밖(`spec/` 쓰기) — planner 항목으로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재. 코드 revert 아닌 spec 심볼 경로 갱신으로 처리할 것 |
| 3 | Maintainability | `chat-channel-binder.service.ts` 내 로그 경고 4곳이 여전히 `` `TriggersService: …` `` 리터럴로 시작 — 클래스명(`ChatChannelBinderService`)과 로그 문구 불일치 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:100,250,253,288` | 의도적 보존(JSDoc 명시: 리터럴 변경 시 관측 가능 출력이 달라져 "순수 이동" 주장이 약해짐). 이미 트래커 등재, 다음 편집 시 정정 |
| 4 | Maintainability | `setupChatChannel` 단일 함수가 189줄(83-271행)에 걸쳐 6~8개 관심사(레지스트리 조회·가드·URL 조립·secret ref 생성·3종 쓰기 게이팅·adapter 호출·config 병합)를 담당 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:83-271` | 사전 존재, 이번 diff 가 손대지 않음. 급하지 않다면 `resolveChatChannelSecrets()`/`mergeSetupResult()` 헬퍼 분리 고려. 이미 트래커 등재 |
| 5 | Maintainability/Dependency | `buildSecretRef`/config 캐스팅 패턴이 `chat-channel-binder.service.ts` 와 `triggers.service.ts`(`rotateBotToken`) 두 파일에 걸쳐 중복 — 서비스 경계를 넘으며 한쪽만 보면 다른 쪽 존재를 알아채기 어려움. `trigger-callback-url.ts` 는 `common/utils/app-base-url.ts` `getAppBaseUrl()` 과도 로직 중복(다른 값 출처: ConfigService vs process.env) | `chat-channel-binder.service.ts:118-127,278-280` vs `triggers.service.ts` `rotateBotToken` 부근; `trigger-callback-url.ts:25-32` | 통합 보류 근거가 JSDoc 에 문서화됨(14개 테스트 블록의 DI 통제권 상실). 후속 공유 헬퍼(`buildChatChannelSecretRefs`) 또는 값 출처 통일 후 통합 고려 |
| 6 | Security/API Contract | `rotate-bot-token` 엔드포인트의 OpenAPI 데코레이터 부재는 문서화 갭이며 이번 PR 이 만든 것 아님 | `codebase/backend/src/modules/triggers/triggers.controller.ts` (이번 diff 밖) | `--impl-prep` 산출물에 이미 등재, 별도 후속 PR 에서 응답/요청 DTO·에러 데코레이터 추가 |
| 7 | Performance | `setupChatChannel` 내 두 `secrets.rotate()` 호출(botToken/inboundSigning)이 서로 독립인데 순차 `await` — 병렬화 여지 (사전 존재) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:134-139, 154-158` | 두 rotate 의 독립성이 유지되는 한 후속 PR 에서 `Promise.all([...])` 로 지연 단축 가능 |
| 8 | Testing | `teardownChatChannel` 성공 경로 테스트가 `Logger.warn` 미호출을 명시적으로 단언하지 않음 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` (성공 경로 `it`) | 선택적: `expect(warn).not.toHaveBeenCalled()` 한 줄 추가. PR 을 막을 사유 아님 |
| 9 | Maintainability | `trigger-callback-url.ts` 클래스 JSDoc 상단에 내용 없는 빈 줄 1개 (스타일 트리비아) | `codebase/backend/src/modules/triggers/trigger-callback-url.ts:44` | 다음 편집 시 제거. 급하지 않음 |
| 10 | Documentation | `chat-channel-binder.service.ts` JSDoc 이 아직 `plan/in-progress/` 에 있는 plan 을 `plan/complete/impl-chat-channel-binder-t2.md` 경로로 선인용 (마무리 커밋 시 `plan/complete/` 이동과 함께 해소되도록 설계된 상태, plan 체크리스트에 이미 검증 항목 등재) | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:18` | 마무리 커밋에서 `plan/complete/` 이동 시 체크리스트 항목으로 실재 확인 |
| 11 | Testing/Documentation (프로세스 관측) | 리뷰 세션 도중 병렬 reviewer(추정)가 `triggers.service.ts:855` 를 뮤테이션 테스트(`MUTATION-TEST-REMOVED` 치환)한 상태가 documentation reviewer 종료 시점 일시 관측됨 — 세션 종료 시점 자연 복구되어 `git status --short` clean 확인. 워크트리 오염 재발 트래커에 이미 반영된 패턴(1~3라운드 각 1회 + 이번 1회) | `codebase/backend/src/modules/triggers/triggers.service.ts:855` | 코드 결함 아님, 리뷰 프로세스 위생 관측. `plan/in-progress/spec-draft-nullable-notation-followups.md` 재발 카운트에 반영 고려 |
| 12 | Scope | changeset 71개 파일 중 63개가 plan/review 프로세스 산출물, 실질 애플리케이션 코드는 8개 파일뿐 | 전체 diff | `CLAUDE.md` 정보 저장 위치 표에 부합하는 정상 경로, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 결함 없음. PATCH 비밀 차단(botToken/inboundSigningPlaintext) 타입+런타임 이중 검증 유지 확인 |
| performance | NONE | 순수 이동, 알고리즘/DB 접근/호출 횟수 이동 전후 동일. secrets.rotate 병렬화 여지(INFO) |
| architecture | NONE | 레이어/의존 방향·모듈 export 경계·순환 의존 재발 없음 유지 확인 |
| requirement | LOW | 기능 완전성·엣지케이스·spec fidelity 확인. [SPEC-DRIFT] 심볼 경로 3곳(이미 등재) |
| scope | NONE | 4라운드 diff 는 테스트 1파일(+25줄)뿐, 스코프 이탈 없음 |
| side_effect | NONE | 전역상태/이벤트/네트워크/파일시스템 신규 부작용 없음, DI 방향 단방향 확인 |
| maintainability | NONE | 3라운드 지적 전부 해소 확인. 잔여는 사전 존재 INFO(함수 길이·로그 리터럴·중복) |
| testing | NONE | 테스트 갭 전부 해소, `remove()` 배선 뮤턴트 RED 직접 재현 확인 |
| documentation | NONE | spec 인용 전수 실재 확인, 3라운드 WARNING 완전 해소. plan/complete 선인용은 known-temporary |
| dependency | NONE | package.json/lockfile 변경 0건, 순환 의존 없음, `getAppBaseUrl()` 중복은 사전 존재 |
| database | LOW | 신규 쿼리/마이그레이션/트랜잭션 위험 없음. lost-update 패턴 재확인(사전 존재) |
| concurrency | LOW | 신규 lock/Promise 조합 없음. 동일 lost-update 패턴 재확인(사전 존재) |
| api_contract | NONE | controller/DTO diff 0줄, 에러코드·URL 형태·인증 계약 불변 확인 |
| user_guide_sync | NONE | doc-sync-matrix 22행 전수 대조, 매칭 trigger 없음 |

## 발견 없는 에이전트

architecture, scope, user_guide_sync — 위 개별 INFO 표 항목에 해당하는 신규 발견 없음(재확인성 관측만 기록).

## 권장 조치사항

1. (선택, 급하지 않음) `plan/in-progress/impl-chat-channel-binder-t2.md` 를 `plan/complete/` 로 이동하는 마무리 커밋에서, `chat-channel-binder.service.ts:18` 의 plan 경로 인용이 실재 경로를 가리키는지 체크리스트로 확인.
2. (planner 턴 필요, 이번 PR 범위 밖) spec 3곳(`secret-store.md`, `chat-channel-adapter.md`, `data-flow/14-chat-channel.md`)의 `TriggersService.setupChatChannel` 심볼 경로 서술을 `ChatChannelBinderService.setupChatChannel` 로 갱신 — [SPEC-DRIFT], 이미 트래커 등재됨.
3. (후속 PR, 급하지 않음) `trigger.config` lost-update 패턴에 대해 row-level lock 또는 낙관적 버전 컬럼 도입 검토 — 사전 존재, 이미 별도 트래커 항목.
4. (선택) `secrets.rotate()` 2건이 서로 독립인 경로에서 `Promise.all` 로 병렬화해 지연시간 단축.
5. (선택) `teardownChatChannel` 성공 경로 테스트에 `warn` 미호출 단언 추가.
6. 이번 PR 을 막을 조치는 없음 — CRITICAL/WARNING 0건.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행(사유 미상세, prompt 상 `routing: skipped`로만 명시). forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 전원 정상 실행 및 결과 확보 확인.
