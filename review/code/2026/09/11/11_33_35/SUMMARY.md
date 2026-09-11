# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건 모두 "코드는 spec 계약을 정확히 구현했는데 spec 문서/유저가이드가 그 배선을 못 따라갔다"는 문서 drift 류이며, 코드 되돌림이 필요한 결함은 없다. Forced 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` 이번 PR(`triggers.service.ts` 13곳)이 `chatChannel`/`provider`/`botToken` 등 서비스 가드 분기에 `code: ErrorCode.INVALID_FIELD` 배선을 실제로 완료했는데, `spec/5-system/15-chat-channel.md` 는 여전히 "배선은 뒤따르는 developer PR 이 한다 … 아직 안 실린다"는 배선-전 시제 문단을 유지한다. 코드는 spec 이 선언한 계약(§5.3 「field 있으면 code 필수」)을 정확히 구현했으므로 코드가 아니라 spec 시제가 stale. **reviewer 간 정확한 잔존 범위에 이견 있음** — requirement.md 는 "§5.4.1(375행)은 이미 시제-중립으로 정정돼 있고 §5.4.1.2만 남았다"고 보고한 반면, documentation.md 는 "§5.4.1·§5.4.1.1·§5.4.1.2 세 곳 모두 미정정"이라고 보고했다. developer 자신이 그 문장을 쓴 것이 아니라 `#1316` planner 턴이 썼으므로 자기-반증형 소정정 조건 1이 불성립해 developer 가 직접 고칠 권한이 없다는 점은 두 reviewer 모두 일치. | `spec/5-system/15-chat-channel.md` §5.4.1~§5.4.1.2 (정확한 잔존 범위는 후속 세션에서 재확인 필요) | 코드는 유지. planner 턴에서 해당 문단을 "배선 전 관측값 → 2026-09-11 배선 완료, `code: 'INVALID_FIELD'`" 로 정정. 착수 전 §5.4.1 이 이미 정정됐는지부터 재확인해 정확한 잔존 문단 수를 특정할 것. |
| 2 | 문서화(User Guide Sync) | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`(429행)·`triggers.en.mdx`(418행)가 `chatChannel`/`provider` PATCH 거부 응답을 `details.field='chatChannel'`/`'provider'` 로만 인용하고, 이번 PR 이 그 응답에 새로 실은 `details.code='INVALID_FIELD'` 를 언급하지 않는다. 같은 문서 283/298행(KO)·272/287행(EN)은 이미 `{ field, message, code }` 3필드 인용 관례를 갖고 있어, 이 두 문장만 뒤처졌다. `doc-sync-matrix.json` 의 `backend-api-change`(semantic trigger, DTO glob 매치) 항목이 지목하는 target(b) "API 노출 변경 → user-guide 페이지" 동반 갱신 누락. `plan/in-progress/impl-details-code-wiring.md` 의 기존 메모(INFO 3)는 spec 등재 여부만 다뤘고 frontend user-guide MDX 는 다루지 않아 developer 의 blind spot. | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`, `triggers.en.mdx:418` | 같은 턴에 두 줄에 `details.code='INVALID_FIELD'` 언급 추가(예: `details.field='chatChannel', details.code='INVALID_FIELD'`). API 연동 개발자가 이 가이드만 보고 응답 파싱을 짜면 새 `code` 필드를 놓친다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `SecretResolverService.rotate()`/`store()` 자체는 여전히 빈 값(`newPlaintext`/`plaintext`)을 가드하지 않는다 — 이번 PR 이 닫은 것은 `ChatChannelConfigDto.botToken`(DTO 계층)뿐이라, 향후 다른 호출부가 추가되면 "빈 시크릿 먼저 저장" 결함이 재발할 수 있는 구조. plan 이 이미 별도 항목으로 분리해 둠(신규 발견 아님). | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` `rotate`/`store`(diff 밖) | 후속 항목으로 `rotate`/`store` 자체에 빈 값 거부 내재화 권장. |
| 2 | 보안/API계약 | `@MinLength(1)` 은 길이만 검사하므로 공백 전용 문자열(`'   '`)은 여전히 통과 — trim 정책은 코드 주석·plan·테스트 JSDoc 모두에 "별개 결정"으로 명시된 의도적 스코프아웃. | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192` | trim 정책(`@Transform`+trim 또는 공백-전용 거부) 결정을 별도 트래커에 등재. |
| 3 | 성능 | 신규 `[A]`/`[등가성]` 두 `it.each` 블록이 동일 5-tuple `BLOCKED_FIELD_CASES` 로 NestJS 테스트 모듈을 10회(5회가 아니라) 재컴파일 — 프로덕션 무관, CI 실행 시간에만 영향. | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` | 두 assertion(`details`·`message`)을 한 `it.each` 로 병합해 컴파일 5회로 절반 축소(비차단). |
| 4 | 유지보수성 | `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 5개 메시지 문체가 격식체(`botTokenRef` 등)와 해요체(`botToken`/`inboundSigningPlaintext`)로 혼재 — pre-existing 이나 한 객체 리터럴로 모이면서 더 눈에 띔. | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 별도 트래커에 "chatChannel 거부 메시지 문체 통일(해요체)" 항목 등재. |
| 5 | 아키텍처/유지보수성 | `TriggersService`(1868줄)·`triggers.service.spec.ts`(3422줄) 비대화가 이번 라운드에도 계속 누적 — plan 이 모듈 경계 추출(E)을 별도 PR 로 이미 명시적으로 분리, 실측 근거(`forwardRef` 순환 이력)까지 남아 있음. | `codebase/backend/src/modules/triggers/triggers.service.ts` | 후속 PR(E) 착지 여부만 추적. |
| 6 | 테스트 | PATCH 경로의 `details.code` wire-level(e2e) 증거가 없음 — 현재 e2e 커버리지는 POST 생성 경로 전용, 파일 헤더 주석·CHANGELOG 양쪽에 "후속 항목"으로 명시. | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` | 최소 1개 PATCH e2e 케이스에 `error.details` `toEqual` 단언 추가해 두 진입점 모두 wire 증거 확보. |
| 7 | 테스트 | `[C]` 테스트(`botToken: ''` 거부)가 `.toContain` 만 써서 "정확히 이 위반 하나만 발생"을 단언하지 않음 — 같은 파일의 `[등가성]`/`[A]` 테스트는 이미 `toHaveLength(1)` 을 갖춰 판별력 수준이 파일 내에서 불일치. | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` `[C]` | `expect(thrown.details).toHaveLength(1)` 추가해 엄격도 통일(실질 위험 낮음). |
| 8 | 문서화 | `ChatChannelConfigDto` 공개 Swagger JSDoc(`botTokenRef` 등)이 `details[].code` 를 언급하지 않음 — 필드 shape 차이는 정확히 서술하나 `code` 는 누락. 이전 라운드에서도 동일 INFO. | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`botTokenRef` JSDoc) | 여유 있을 때 "두 갈래 모두 `details[].code='INVALID_FIELD'` 를 함께 싣는다" 한 문장 추가(비차단). |
| 9 | 의존성 | `'INVALID_FIELD'` 값이 canonical `ErrorCode` enum·`validation.pipe.ts`(리터럴)·`password.util.ts`(이번 PR 신규 리터럴) 3곳에 분산 — `common/`→`nodes/` import 선례 0건이라는 실측 근거로 계층 경계를 의도적으로 지킨 결정(방치 아님). | `codebase/backend/src/common/utils/password.util.ts`, `common/pipes/validation.pipe.ts`, `nodes/core/error-codes.ts` | 상수의 `common/` 안전 위치 승격은 별도(9개 모듈 영향) 트래커로 이미 분리됨 — 추가 조치 불요. |
| 10 | API 계약 | `botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext` 5필드의 서로 다른 거부 사유가 여전히 동일한 generic `details[].code='INVALID_FIELD'` 로만 표현돼, 소비자가 프로그램적으로 사유를 가르려면 `message` 문자열 파싱에 의존해야 함 — CHANGELOG/상수 파일 주석에 스코프아웃이 이미 명시됨. | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 도메인 특화 세부 코드 신설은 별도 트래커 항목(이번 PR 스코프 밖). |
| 11 | 부작용 | `triggers.service.ts` 13곳이 `nodes/core/error-codes.ts` 의 `ErrorCode.INVALID_FIELD` 공유 상수에 결속되는 반면 `password.util.ts` 2곳은 리터럴 유지 — 값은 바이트 동일(회귀 없음)이지만, 향후 그 상수가 다른 소비자 요구로 바뀌면 `triggers.service.ts` 만 조용히 따라가는 비대칭 행동-거리 결합이 생긴다. | `codebase/backend/src/modules/triggers/triggers.service.ts`, `common/utils/password.util.ts` | (선택) `error-codes.ts` `INVALID_FIELD` 항목에 "이 값을 바꾸면 triggers chat-channel 응답도 바뀐다" 역참조 주석 추가. |
| 12 | 유저 가이드 동반 갱신 | 인접 provider 문서(`slack.mdx`/`.en.mdx`, `discord.mdx`/`.en.mdx`, `telegram.mdx`/`.en.mdx`)도 `botToken`/`inboundSigningPlaintext` PATCH 거부의 `details.code` 를 언급하지 않으나, 이 경로의 `code` 는 `validation.pipe.ts` 에 이번 PR 이전부터 이미 존재해 이번 diff 의 직접 trigger 는 아니다. | `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,discord,telegram}{,.en}.mdx` | `chat-channel-rejection-messages.const.ts` 신설을 계기로 같은 턴 또는 후속 정리로 6개 파일에 `code` 표기 추가 권장. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `rotate`/`store` 빈값 가드 부재(pre-existing)·공백전용 미차단·내부 경로 노출(INFO 3건), CRITICAL/WARNING 없음 |
| performance | NONE | 전 변경이 O(1)/예외(cold) 경로, `it.each` 10회 재컴파일만 INFO |
| architecture | NONE | 직전 라운드 WARNING 4건 전부 코드로 재검증해 해소 확인, `TriggersService` 비대화는 추적 중 |
| requirement | LOW | SPEC-DRIFT WARNING 1건(§5.4.1.2, 잔존 범위는 documentation과 이견) |
| scope | NONE | 두 커밋 모두 plan 이 선언한 A/B/C/D 범위 내, 숨은 변경·누락 변경 없음 |
| side_effect | LOW | `ErrorCode.INVALID_FIELD` 공유 상수 결속으로 행동-거리 표면 확대(INFO), wire 값 회귀 없음 |
| maintainability | NONE | 문체 혼재(pre-existing)·파일 비대화(추적중) 외 새 부채 없음, fixture 완전성 캐너리 신설은 양성 |
| testing | LOW | PATCH e2e 증거 부재, `[C]` 판별력 갭 — 뮤테이션 2건 직접 재현해 15/15 RED 주장 검증 |
| documentation | LOW | SPEC-DRIFT WARNING(3곳 주장) + DTO JSDoc `code` 미언급 INFO, 직전 WARNING 4건은 해소 확인 |
| dependency | NONE | 매니페스트 변경 없음, `INVALID_FIELD` 3곳 분산은 계층 경계 근거 실측 확인 |
| database | NONE | 해당 없음 — DB 관련 코드 변경 전무 |
| concurrency | NONE | 해당 없음 — 동시성 로직 변경 전무, router 도 제외 판단과 일치 |
| api_contract | LOW | `details[].code` additive 확장은 계약 준수, generic 코드 미분화·공백전용 미차단은 INFO |
| user_guide_sync | LOW | WARNING 1건(`triggers.mdx`/`.en.mdx` `code` 미반영), 인접 provider 문서 3쌍은 pre-existing INFO |

## 발견 없는 에이전트

- database — 이번 diff 에 DB 관련 코드(쿼리·ORM·마이그레이션·트랜잭션) 전무
- concurrency — 이번 diff 에 동시성 관련 코드(락·async 흐름·공유 가변 상태) 전무

## 권장 조치사항

1. `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`, `triggers.en.mdx:418` 에 `details.code='INVALID_FIELD'` 언급을 추가해 유저 가이드를 실제 응답 스키마와 맞춘다(WARNING #2, 이번 PR 이 직접 만든 gap).
2. planner 턴에서 `spec/5-system/15-chat-channel.md` §5.4.1~§5.4.1.2 의 "배선 전" 시제 문단을 정정한다 — 착수 전 §5.4.1 이 이미 정정됐는지(requirement.md 주장) 먼저 재확인해 정확한 잔존 범위를 특정할 것(WARNING #1).
3. (여유 시) PATCH 경로에 대한 `details.code` e2e 증거 1건 추가, `[C]` 테스트에 `toHaveLength(1)` 추가해 판별력 통일(INFO #6, #7) — 비차단.
4. (후속 트래커, 비차단) `SecretResolverService.rotate`/`store` 자체의 빈 값 가드, 공백-전용 trim 정책, 거부 메시지 문체 통일, `TriggersService` 모듈 경계 추출(E), 인접 provider 문서 6곳 `code` 표기는 이미 별도 항목으로 추적 중이므로 이번 PR 의 병합을 막지 않는다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유 미제공(프롬프트에 `routing_skip_reason` 없음). 전체 14개 reviewer 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 강제 목록 미이행 없음
