# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이 PR 이 닫으려는 바로 그 결함(동시 PATCH → `inboundSigningRef` 유실 → 인입 서명 fail-open)이 개발자 자신이 "이 배치에서 고치지 않는다"고 명시한 창(window 1, `TriggersService.update()`의 `save(trigger)`)을 통해 **여전히 재현 가능**하다는 것을 security reviewer 가 구체 시나리오로 실증했다. 게다가 이 PR 이 실제로 고친 두 지점(`survivesWithFresh` 신규 OR항, `rotateBotToken` 의 락 안 재병합)은 **어느 unit 테스트로도 보호되지 않는다**는 사실이 뮤테이션 테스트로 실측됐고, 유일한 방어선인 e2e 의 보안 관련 단언은 이 환경에서 한 번도 RED 를 낸 적이 없다고 테스트 스스로 기록한다. 즉 "고쳤다"는 이 PR 의 핵심 주장 자체가 (a) 위험이 문서보다 넓게 남아 있고 (b) 실제로 고쳐졌는지 어떤 테스트도 확인해 주지 못하는 상태다.

> **forced(router_safety) 이행 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7개 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Window 1(`TriggersService.update()`의 `save(trigger)`)을 통해 이 PR 이 막으려는 fail-open 이 그대로 재현된다. `chatChannel` 필드를 전혀 포함하지 않는 PATCH(예: 이름 변경)도 `mergeExternalConfig()`가 `findById()` 시점의 stale in-memory 스냅샷으로 트리거 전체를 재구성해 `save()` 로 덮어쓴다. 재현: (1) 트리거가 telegram, `inboundSigningRef` 없음 → (2) 요청 A(`chatChannel` PATCH)가 락 안에서 ref 를 확립·커밋(이번 PR 로 보호됨) → (3) A 이전에 `findById()` 한 요청 B(`chatChannel` 무관 PATCH)가 A 이후에 `save()` 커밋 → B 가 A 의 ref 를 되돌린다. `Trigger` 엔티티에 낙관적 락(`@VersionColumn`)도 없어 막을 수단이 없다. `plan/in-progress/trigger-config-lost-update.md` §D 의 "창 2·3·4 를 닫으면 inboundSigningRef 의 **영속적** 유실은 사라진다"는 서술은 이 경로를 놓쳐 위험을 실제보다 좁게 서술한다. | `codebase/backend/src/modules/triggers/triggers.service.ts:517-547`(`update()`, `mergedConfig`+`save(trigger)`), `:814-825`(`mergeExternalConfig`) | plan §D 위험 서술 정정(인증-우회 축으로 재평가) + 완화책: (a) `chatChannel` 이 DTO 에 없을 때 락 안에서 재읽은 최신 `chatChannel` 사용, 또는 (b) `Trigger` 에 낙관적 락 도입 |
| 2 | 테스트 | 이 PR 의 핵심 수정(`survivesWithFresh` 의 신규 3번째 OR 항 — 락 안에서 재읽은 `chatChannel.inboundSigningRef` presence)을 unit 테스트가 검증하지 않는다. 뮤테이션으로 실측: 해당 항을 완전히 제거해도 `src/modules/triggers` 전체 unit 스위트(279건)가 100% GREEN. 원인은 모든 관련 테스트가 `triggerRepo.findOne.mockResolvedValue(...)`(고정값)을 써서 "최초 읽기"와 "락 안 재읽기"가 항상 동일한 값이 되기 때문. | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:206-252`(`survivesWithFresh`/`buildFallbackChannel`/`buildMergedChannel`) | `triggerRepo.findOne`을 `mockResolvedValueOnce` 두 번 체이닝(최초=ref 없음, 락 안 재읽기=동시 확립된 ref 있음)하는 unit 테스트를 성공/실패 경로 각 1건 이상 추가 |
| 3 | 테스트 | `rotateBotToken`의 락 안 재병합(다른 요청이 커밋한 `config` 나머지 키 보존)도 unit 테스트로 보호되지 않는다. 뮤테이션으로 실측: merge 콜백을 `freshConfig` 무시하고 `trigger.config`(스냅샷)로 되돌려도 `rotateBotToken` describe 14건 + 전체 129건 중 128 passed 그대로 통과. e2e 는 이 경로를 아예 다루지 않아(챗채널 PATCH-vs-PATCH 만 재현) unit 이 유일하게 가능한 방어선이다. | `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken`의 `rewriteTriggerConfigLocked` merge 콜백 | 위와 동일 패턴 — `findOne` 두 값 체이닝 + 락 안 재읽기에만 있는 키가 최종 `update()` 의 `config` 에 살아남는지 단언 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 위 CRITICAL 2·3과 합치면, 이 PR 이 고치는 두 회귀를 실측으로 지켜 주는 테스트가 **하나도 없다** — 유일한 e2e 캐너리의 보안 관련 단언(② `inboundSigningRef` 생존)은 이 환경에서 "실패가 늦은 환경을 위한 것이라 여기서는 실행되지 않았다"고 테스트 스스로 기록한다(①`rateLimitPerMinute` 유실만 실측 RED 확인됨). | `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`(상단 JSDoc "실측" 절, 검증 블록 ② 단언) | CRITICAL 2·3 의 unit 테스트를 먼저 추가하고, e2e 는 `setupChannel` 실패 지연을 결정적으로 늦추는 수단을 검토해 ② 인터리빙도 최소 1회 RED 로 확인 |
| 2 | 테스트 | `rewriteTriggerConfigLocked`의 "행이 삭제됐다"(`!fresh`) 분기가 unit·e2e 어디에도 커버되지 않는다 — 전용 테스트 파일 자체가 없다. | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75-76` | `EntityManager` 를 직접 mock 하는 전용 unit spec 신설 — `findOne → null` 시 `merge`/`update` 미호출 + `false` 반환 단언 |
| 3 | 동시성/부작용 | 트리거 단위 advisory lock 대기에 상한(timeout)이 없다 — 같은 트리거에 대한 동시 PATCH/rotate 요청이 서로를 무한정 대기시키는 새로운 공유 블로킹 자원이 생겼다. `execution-engine.service.ts`의 admission 락과 동일 패턴이지만, "트리거별 config" 자원에는 처음 적용됨. | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:64-67` | 짧은 `lock_timeout`을 `SET LOCAL`로 걸어 실패를 명시적으로 드러내거나, 최소한 JSDoc 에 "대기 상한 없음"을 명시 |
| 4 | 문서화 | 보안-관련 동작 수정인데 `CHANGELOG.md` 항목이 없다 — 이 저장소가 동급 fix 커밋들(`fad828884` 등, 같은 chat-channel/inboundSigning 보안 축 선례 포함)에서 일관되게 지켜 온 관행과 어긋난다. | `CHANGELOG.md`(신규 항목 부재) | `## Unreleased — **Behavior change**: 동시 PATCH 가 인입 서명 ref 를 지워 fail-open 이 되던 경로를 닫는다` 류 항목 추가 |
| 5 | 요구사항/문서화 | `[SPEC-DRIFT 아님 — 진짜 커버리지 갭]` 신규 파일 `trigger-config-lock.ts`(+ 신규 e2e spec)가 `spec/5-system/15-chat-channel.md`의 `code:` glob 과 §7 구현 파일 구조 어디에도 걸리지 않는다. 이 문서 자신의 R-CC-22 가 "명시 경로가 새 파일을 세 번(#1317·#1319·#1320) 놓쳤다"며 glob 전환을 한 바로 그 이유인데, `trigger-config-lock.ts`는 그 glob(`chat-channel-*`) 밖에 있어 **같은 결함 클래스가 네 번째로 재발**한다(빌드 가드는 안 깨짐, 추적성 갭). | `spec/5-system/15-chat-channel.md`(frontmatter `code:`, §7) | `spec/` 은 developer 권한 밖 — plan §D `--impl-prep` INFO 목록에 "code: 에 `trigger-config-lock.ts` 추가 또는 glob 확장 + §7 tree 갱신"을 planner 턴 항목으로 등재 |
| 6 | 유지보수성 | `buildFallbackChannel`/`buildMergedChannel` 클로저가 거의 동일한 스프레드-조건 패턴을 반복한다(차이는 `configUpdates` 스프레드와 `issuedInboundSigning` 조건 추가뿐) — 한쪽만 고치고 다른 쪽을 놓치는 drift 위험(이번 PR 자체가 두 자리를 함께 고쳐야 했던 사례). | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:213-218, :243-252` | `buildFallbackChannel`을 `buildMergedChannel`의 `extra`가 빈 특수 케이스로 흡수하거나, 최소한 두 함수를 나란히 배치해 "같은 술어를 공유한다"는 사실이 구조로 드러나게 함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/동시성/database | advisory lock key 의 32비트 해시 공간(`hashtext()`)을 `exec-cap:<workspaceId>` 계열과 공유 — 충돌해도 정확성 훼손 없이 과직렬화만 발생. 이미 `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 등재·수용됨. | `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` | 기존 등재로 충분, 여유 있으면 2-int 오버로드로 네임스페이스 분리 검토 |
| 2 | 아키텍처/부작용/requirement | `rewriteTriggerConfigLocked`의 `Promise<boolean>` 반환값(쓰기 skip 관측용)을 세 호출부 전부가 무시한다 — `chat-channel-binder`의 리스너 등록과 `rotateBotToken`의 감사 로그가 쓰기 성공 여부와 무관하게 실행됨. JSDoc 이 약속한 "관측 가능"이 실현되지 않은 상태. | `chat-channel-binder.service.ts:256,293`, `triggers.service.ts:1120` | 최소 한 곳(`rotateBotToken`)에서 `false` 시 `logger.warn` 고려(급하지 않음) |
| 3 | 아키텍처/database | 같은 `Trigger` 애그리게잇 안에 두 가지 쓰기 일관성 모델(락 재읽기 vs 창1 스냅샷 전체 저장)이 공존 — plan 문서에는 근거가 있지만 코드 docblock 수준에는 드러나지 않음. (CRITICAL#1 이 이 창을 통해 실제 보안 재현이 가능함을 지적했으니, 이 항목은 그 구조적 배경으로 참고) | `triggers.service.ts:525`(창1) vs `chat-channel-binder.service.ts:256,293`, `triggers.service.ts:1120` | `TriggersService` 클래스/`update()` 주석에 "chatChannel 하위 3곳만 락 재읽기, `save(trigger)` 자체는 아님" 한 줄 추가 |
| 4 | 아키텍처 | `rewriteTriggerConfigLocked`가 `Trigger` 타입에 하드코딩돼 재사용 불가 — plan §D 가 이미 예고한 후속(19곳)에서 제네릭화 필요 | `trigger-config-lock.ts:75,94` | 후속 착수 시 `rewriteTriggerConfigLocked<T>(manager, entityClass, id, merge, columns)` 형태로 매개변수화 |
| 5 | 부작용 | `chatChannelSetupAt`/`rotatedAt` 타임스탬프가 advisory lock 획득 **이전**에 캡처됨 — 컨텐션 시 "완료 시각"과의 괴리가 커질 수 있음 | `chat-channel-binder.service.ts:264`, `triggers.service.ts:1119` | 선택 사항 — 필요 시 `merge` 콜백 내부(락 획득 후)로 이동 |
| 6 | database | `remove()` 경로가 같은 advisory lock 을 잡지 않아, `findOne`과 `update` 사이 삭제 레이스의 좁은 창이 남음(고아 UPDATE, 데이터 손상 없음) | `trigger-config-lock.ts:75-94` | `remove()`도 같은 락을 잡거나 `affected` 카운트 확인 후 `false` 반환 |
| 7 | 동시성 | advisory lock 이 보호하는 건 `config` 뿐 — `chatChannelHealth`/`chatChannelLastError` 등 상태 컬럼은 이 diff 범위 밖 다른 경로에서 락 없이 동시 갱신 가능(관측성 lost-update, 보안 무관) | 여러 diff-범위-외 호출부 | plan §D 후속 목록에 "health 상태 컬럼도 같은 락이 필요한가" 항목 편입 |
| 8 | 동시성 | e2e 실패 경로에서 advisory lock 보유 커넥션(`lockDb`)과 `bPromise`가 정리되지 않고 남을 수 있음(unhandled rejection/Jest 종료 경고 가능성) | `trigger-config-lost-update.e2e-spec.ts:134-148, 182-196` | 실패 시 `bPromise`에 `.catch()` 부착 또는 `try/finally`로 명시적 정리 |
| 9 | 문서화 | `trigger-config-lock.ts` 자신에는 지배 plan 문서(`trigger-config-lost-update.md`)로의 포인터가 없음 — 이 파일만 단독으로 읽으면 창1 제외 이유가 드러나지 않음 | `trigger-config-lock.ts`(파일 상단 JSDoc) | 상단에 "상위 plan: ... §B·§D(창1 의도적 미배선)" 한 줄 추가 |
| 10 | 성능 | 단일 `UPDATE`(1왕복)가 트랜잭션+락+`SELECT`+`UPDATE`(4~5왕복)로 증가 — 사용자 트리거 PATCH/rotate 한정, hot path(웹훅 인입) 무관 | `trigger-config-lock.ts:63-96` 및 3개 호출부 | 조치 불요, P95 레이턴시 옵저버빌리티 반영 권고 |
| 11 | 유지보수성 | 동일한 익명 타입 shape(`{chatChannel?: {inboundSigningRef?: string}}`)가 두 파일에 독립 중복 선언 | `chat-channel-binder.service.ts:209` vs `triggers.service.ts:505`(기존 코드) | 공유 타입 alias(`Pick<ChatChannelConfig, 'inboundSigningRef'>`)로 통합 |
| 12 | 의존성 | TypeORM 비공개 서브패스(`typeorm/query-builder/QueryPartialEntity`) import — 기존 `workflows.service.ts` 선례 재사용, 신규 위험 아님 | `trigger-config-lock.ts:2` | typeorm 메이저/마이너 업그레이드 시 두 사용처 함께 검증 |
| 13 | user_guide_sync | "인증·권한·세션 흐름 변경" trigger 와 문자열상 그레이존이나 glob(`modules/auth/**`)·targets(`07-workspace-and-team/`) 모두 불일치 — 매칭 아님으로 판단 | 매트릭스 대조 | 조치 불요 |
| 14 | 보안 | `chatChannelLastError`에 provider 원문 에러 메시지 저장(기존 동작, 변경 없음) — provider SDK 에러가 URL 에 bot token 포함 시 유출 경로 될 수 있음(이번 PR 범위 아님) | `chat-channel-binder.service.ts:302` | 별도 트래커에서 redaction 검토(이번 PR 대상 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | Window 1 을 통해 fail-open 재현 가능 — plan 의 "닫혔다" 서술이 부정확 |
| testing | HIGH | 핵심 수정 2곳이 뮤테이션 테스트로 무방비임이 실측됨, e2e 도 보안 단언 미관측 |
| documentation | MEDIUM | CHANGELOG 누락, 신규 파일 2건이 spec code: glob/§7 미등재(추적성 갭 재발) |
| requirement | LOW | 기능 로직은 spec 요구와 정합, 신규 파일 커버리지 갭 1건(WARNING) |
| architecture | LOW | 설계 자체는 건전, 재사용성/가시성 관련 INFO 다수 |
| side_effect | LOW | 락 timeout 없음(WARNING), 반환값 미소비 등 INFO |
| maintainability | LOW | 두 클로저 중복(WARNING), 그 외 긍정적 리팩터 |
| concurrency | LOW | 락 배치·격리수준·데드락 검증 결과 문제 없음, INFO 다수 |
| database | LOW | 트랜잭션/인덱스/SQL 인젝션 문제 없음, INFO 다수 |
| performance | LOW | 왕복 증가는 의도된 트레이드오프, hot path 무관 |
| scope | NONE | 변경 범위가 목적에 정확히 부합, 확장 지점은 의도적으로 스코프 밖 유지 |
| dependency | NONE | 신규 패키지 없음, 순환 의존 없음 |
| api_contract | NONE | 컨트롤러/DTO/응답 계약 변경 없음 |
| user_guide_sync | NONE | 매트릭스 22행 전수 대조, 매칭 없음 |

## 발견 없는 에이전트

scope, dependency, api_contract, user_guide_sync — 모두 위험도 NONE 이며, INFO 수준의 "문제 없음" 확인 사항만 보고했다(신규 의존성 0건, API 계약 변경 0건, 문서 동기화 대상 매칭 0건, 범위 이탈 0건).

## 권장 조치사항

1. **(최우선, 병합 차단 권고)** security CRITICAL#1 — window 1 을 통한 fail-open 재현 경로를 인지한 상태로 병합할지 재결정한다. 최소한 `plan/in-progress/trigger-config-lost-update.md` §D 의 "영속적 유실은 사라진다" 서술을 정정하고, 위험을 "데이터 일관성"이 아니라 "인증 우회 재발 가능" 축으로 재평가한다. 가능하면 이번 배치에 (a) `mergeExternalConfig`가 락 안 최신 `chatChannel`을 쓰도록 최소 완화하거나 (b) `Trigger`에 낙관적 락을 추가한다.
2. testing CRITICAL#2·#3 — `triggerRepo.findOne`을 두 값으로 체이닝하는 unit 테스트를 성공/실패 경로 및 `rotateBotToken`에 각 1건 이상 추가해, 이 PR 이 실제로 주장하는 수정 효과를 결정적으로 고정한다(이 저장소 인프라(`withTransactionMock`)로 비용이 낮다).
3. WARNING#1 — 위 unit 테스트 확보 후, e2e 의 ② 단언(`inboundSigningRef` 생존)도 최소 1회 RED 로 실측되도록 인터리빙 지연 수단을 검토한다.
4. WARNING#3 — advisory lock 대기 상한 부재를 문서화하거나 `lock_timeout`을 도입해, 향후 커넥션 풀 잠식 가능성을 명시적으로 관리한다.
5. WARNING#4·#5 — `CHANGELOG.md` 항목 추가, 그리고 `spec/5-system/15-chat-channel.md`의 `code:`/§7 갱신을 planner 턴 항목(plan §D)에 명시 등재한다(developer 권한 밖).
6. WARNING#2 — `rewriteTriggerConfigLocked`의 삭제-레이스(`!fresh`) 분기에 대한 전용 unit spec을 신설한다(비용 낮음).
7. WARNING#6 및 INFO 항목들 — 여유가 있을 때 `buildFallbackChannel`/`buildMergedChannel` 중복 해소, 반환값 미소비 로깅 등을 후속 개선으로 처리한다(차단 사유 아님).

## 라우터 결정

- `routing=skipped` — 라우터 미사용. forced(router_safety) 전체가 강제 포함되어 14개 reviewer 전원 실행됨.
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)