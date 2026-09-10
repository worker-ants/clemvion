# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. 14개 reviewer(전원 forced whitelist 포함) 전원이 결과를 확보했고 forced 미이행 없음. 최고 개별 위험도는 LOW(architecture·security·requirement·side_effect·testing·database·concurrency)이며, 남은 WARNING 3건은 전부 (a) 이 PR 이 새로 만든 결함이 아닌 사전 존재 설계이거나 (b) 즉시 조치를 요구하지 않는 구조적 관찰이다. 이 PR 이 닫으려던 두 CRITICAL(bot token 회전 single-path 우회, `inboundSigningRef` fail-open)은 여러 라운드에 걸쳐 코드·테스트로 검증 완료된 상태로 재확인됐다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/database | 동시 `chatChannel` PATCH(또는 PATCH ↔ `rotateChatChannelBotToken`) 인터리빙 시 `Trigger.config`(JSONB) lost update 가능 — `update()`→`setupChatChannel()` 의 read-modify-write 가 트랜잭션·행 잠금·낙관적 버전 없이 2단계로 커밋됨. 나중 커밋이 먼저 요청의 `config`(특히 이 PR 이 보존하려는 `inboundSigningRef`)를 되돌릴 수 있음. 사전 존재 설계(CCH-SE-01)이며 이번 diff 는 이 구조를 바꾸지 않음 — 새로 만든 결함 아님, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:2161` 에 미해결 항목으로 등재됨 | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`(491~556행), `setupChatChannel()`(1075~1260행), `rotateChatChannelBotToken()` | 후속 PR 에서 advisory lock / `SELECT ... FOR UPDATE` / `config` 낙관적 버전 비교 중 하나로 세 지점 직렬화. 이번 PR 을 막을 사유 아님(재등재 불요, 이미 트래커에 있음) |
| 2 | 아키텍처 | chat-channel 도메인 규칙(타입 별칭 2개, 검증 메서드 2개 신설 포함)이 계속 제네릭 `TriggersService`(1855줄) 안에 축적되고 있어 모듈 경계가 `chat-channel/` 하위 adapter 분리와 어긋남 | `codebase/backend/src/modules/triggers/triggers.service.ts:60,73,636-687,695-713,722-747,1075-` | 이번 PR 에서 즉시 분리 요구 아님. 같은 백로그 항목(`setupChatChannel` 분리 트래커)에 "모듈 경계" 관점 추가만 권고 |
| 3 | 아키텍처 | DTO `@IsEmpty()` 데코레이터와 서비스 `assertPatchCarriesNoSecrets` 가 동일한 실패 메시지 리터럴을 공유 상수 없이 복붙(5필드 모두 해당, 이번 PR 이 2필드로 컨벤션 확장) — 한쪽만 수정되면 값의 형태에 따라 다른 문구가 반환되는 drift 위험 | `chat-channel-config.dto.ts:390-407` ↔ `triggers.service.ts:697-711` | 5개 실패 메시지를 `chat-channel-config.dto.ts` 의 `export const` 맵으로 추출해 두 레이어가 import 하도록 다음 편집 시 정리 권장. 차단 사유 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 이 `details.field` 를 "미확정" placeholder 로 남겨 두는데, 이번 PR 의 구현·테스트가 이미 두 갈래(비어있지 않은 값→중첩 배열 / `null`·`''`→flat 단일 object)로 확정했다. 코드가 틀린 게 아니라 spec 이 낡음. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:2034-2071` 에 planner 인계 항목으로 등재돼 있고, `git blame` 상 해당 placeholder 문구는 developer 가 쓴 것이 아니라 자기-반증형 소정정 예외(조건 1) 대상도 아님 | `spec/5-system/15-chat-channel.md:375,392` | 코드 변경 불요. 다음 planner 턴에서 §5.4.1/§5.4.1.1 을 실측표 내용으로 정정 |
| 2 | 보안 | create 경로 `botToken` 에 하한 길이 검증 없음(`@MinLength`/`@IsNotEmpty` 부재) — 빈 문자열 토큰이 `secrets.rotate()` 로 저장될 수 있음(가용성 문제, 비밀 유출 아님). 여러 라운드에서 이미 식별·중앙 트래커 등재·스코프 밖 확정된 사전 존재 결함 | `chat-channel-config.dto.ts` `ChatChannelConfigDto.botToken` | 등재된 후속 항목 유지, 이번 PR 차단 사유 아님 |
| 3 | 테스트 | 내부 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)의 `null`/`''` 회귀 방어가 서비스 계층(`assertChatChannelInputSafe`, 이번 커밋으로 뮤테이션 검증 완료)에서만 고정됐고, DTO 계층 "5필드 대칭" 주장을 고정하는 테스트는 없음 | `trigger-dto-validation.spec.ts` (`[실측] 차단 5필드의 details.field...`) | DTO 레벨 `it.each` 에 내부 3필드 추가해 5필드 대칭을 명시적으로 닫는 것을 권장. 차단 사유 아님(실질 방어는 이미 검증됨) |
| 4 | 테스트 | `assertChatChannelInputSafe` 의 mode-DTO 오버로드(컴파일 타임 짝 결속)에 대한 타입 레벨 회귀 테스트(`@ts-expect-error` 류) 없음 — private 메서드·호출부 2곳뿐이라 실제 위험 낮음 | `triggers.service.ts` 오버로드 시그니처 | 우선순위 낮음. 호출부가 늘어나는 시점에 타입 전용 테스트 고려 |
| 5 | API 계약 | 신규 400 사유 2가지("chatChannel 최초 부착 금지", "provider 전환 금지")가 프로젝트의 400/422 분류 기준상 422(비즈니스 로직 오류/상태 전이 불가)에 더 가까울 수 있음 — 다만 같은 컨트롤러의 기존 선례(스키마 타입별 `disallowed` 필드 400)와 형태가 일치해 완전한 일탈은 아님 | `triggers.service.ts` `assertChatChannelAlreadySetUp` | 즉시 차단 사유 아님. spec 정정 필요 시 개발자 권한 밖이므로 트래커에만 검토 항목으로 등재 |
| 6 | API 계약 | `ChatChannelUpdateConfigDto` 의 금지 필드 2개가 여전히 OpenAPI 상 `writeOnly: true` 로 선언돼 스펙만 보는 코드젠 도구가 "쓸 수 있는 필드"로 오인할 수 있음(여러 라운드에서 이미 조치 불요로 확정, 상태 변화 없음 재확인) | `chat-channel-config.dto.ts` `ChatChannelUpdateConfigDto.botToken`/`.inboundSigningPlaintext` | 별도 조치 불요(SDK 코드젠 계획 생기기 전까지) |
| 7 | 아키텍처 | `setupChatChannel` 의 create/update 분기가 boolean flag(`storeUserSuppliedSecrets`) 하나로 함수 내부 여러 지점에 산개 — Boolean Blindness 유사 패턴. `maintainability.md` 가 이미 함수 길이(186줄)를 별도로 WARNING(LOW) 지적 | `triggers.service.ts:1075-1089,1122,1135,1190` | 이번 PR 에서 즉시 리팩터 불요. 다음 기회에 `resolveSecretWritePolicy()` 순수 함수 추출 검토 |
| 8 | 요구사항 | `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` 조건절이 사실상 상수 참(DTO 상 `provider` 필수라 항상 truthy) — 방어 코드로서 실효 없음, 해 없음 | `triggers.service.ts` `assertChatChannelAlreadySetUp` | 조치 불요 |
| 9 | 성능 | PATCH 경로가 `storeUserSuppliedSecrets: false` 게이팅으로 오히려 secret-store 외부 I/O 왕복(최대 2회/요청)을 조건부로 줄임 — 개선 방향 | `triggers.service.ts` `setupChatChannel()` `[쓰기 ①][쓰기 ②]` | 조치 불요(긍정적 관찰) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | create 경로 빈 토큰 허용, 동시 PATCH 이론적 fail-open 재현 가능성(둘 다 사전 존재, 스코프 밖) — 방어 심층화(DTO+서비스 이중 게이트) 정상 동작 재확인 |
| performance | NONE | N+1·블로킹 I/O·O(n²) 없음. PATCH 가 secret-store 왕복을 오히려 줄임 |
| architecture | LOW | chat-channel 규칙의 TriggersService 축적(모듈 경계), DTO/서비스 에러 메시지 리터럴 중복 — 둘 다 WARNING, 차단 사유 아님 |
| requirement | LOW | `[SPEC-DRIFT]` details.field placeholder 가 구현이 확정한 두 갈래를 미반영(planner 인계 완료), D-1/D-2/D-3 핵심 요구사항 소스+테스트 재검증 완료 |
| scope | NONE | 스코프 이탈 없음. 마지막 델타(`84a6aeaa8`)는 직전 WARNING 2건에 정확히 대응하는 최소 수정 |
| side_effect | LOW | PATCH 계약의 3축 breaking change(비밀 필드 거부·최초 부착 거부·provider 전환 거부)는 의도된 수정이며 유일한 소비자 영향 없음 |
| maintainability | NONE | 마지막 델타는 JSDoc 정정 3곳 + 테스트 fixture 확장뿐, 새 결함 없음 |
| testing | LOW | 직전 WARNING(내부 3필드 null/'' 무방비)이 뮤테이션 재검증으로 실제로 닫힘 확인. DTO 계층 대칭 테스트 부재는 INFO |
| documentation | NONE | CHANGELOG·Swagger·mdx·JSDoc 정정 전부 최신 소스에 반영 확인, 신규 결함 없음 |
| dependency | NONE | 신규 패키지/버전 변경 0건, 순환 의존 없음 |
| database | LOW | 스키마/마이그레이션/쿼리 변경 없음. lost update 는 concurrency WARNING 과 동일 사안(중복 병합) |
| concurrency | LOW | 동시 PATCH lost update(WARNING #1, 사전 존재·이미 트래커 등재) 외 신규 동시성 표면 없음 |
| api_contract | NONE | breaking change 3축은 의도됨·문서화됨. 400/422 분류·writeOnly 마커는 INFO |
| user_guide_sync | NONE | 매칭된 유일한 trigger(backend-api-change)의 두 target(swagger jsdoc·MDX ko/en) 모두 이미 동일 changeset 에서 갱신 완료 |

## 발견 없는 에이전트

scope, maintainability, documentation, dependency, performance, user_guide_sync — 전원 위험도 NONE, 실질 결함 없이 확인/긍정적 관찰만 보고.

## 권장 조치사항

1. (선택, 비차단) 동시 PATCH lost update 방지를 위해 후속 PR 에서 advisory lock / `SELECT ... FOR UPDATE` / `config` 낙관적 버전 비교 도입 — 이미 트래커 등재, 이번 PR 병합을 막지 않음.
2. (선택, 비차단) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 SPEC-DRIFT(`spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 details.field placeholder)를 다음 planner 턴에서 실측표 내용으로 정정.
3. (선택, 비차단) DTO/서비스 간 중복된 5개 실패 메시지 리터럴을 공유 상수로 추출, chat-channel 도메인 규칙의 `TriggersService` 축적을 다음 리팩터 기회에 모듈 분리 검토.
4. 위 3가지 모두 이번 PR 의 병합을 막을 사유가 아니다 — CRITICAL 0건, 모든 WARNING 이 사전 존재 설계이거나 즉시 조치 불요로 확정됨.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용. prompt 상 `routing: skipped` 로 명시됨 — 전체 reviewer(14명) 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (forced 미이행 없음)
