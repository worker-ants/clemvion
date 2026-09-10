# Code Review 통합 보고서

## 전체 위험도
**LOW** — 14개 reviewer(강제 포함 7명 전원 결과 확보) 전원이 NONE 또는 LOW 로 수렴했고 CRITICAL 발견은 0건. 이 PR 이 목표로 한 두 개의 사전 CRITICAL(비밀 회전 single-path 우회, `inboundSigningRef` fail-open)이 실제로 해소됐음을 다수 reviewer 가 코드·테스트 실행으로 교차 확인했다. 남은 WARNING 4건은 (a) 사전 존재 설계 부채 재확인, (b) 이번 라운드에서 새로 발견된 테스트 커버리지 갭 1건, (c) 소소한 JSDoc 불일치 1건이며 이 PR 을 막을 사유는 없다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/아키텍처 | `TriggersService` 가 여러 바운디드 컨텍스트(CRUD·notification·schedule·audit·chat-channel secret 라이프사이클)를 계속 흡수해 God Object 경향(1855줄). `update()`(~123줄, 8개 관심사)와 `setupChatChannel()`(186줄, 6~8개 관심사)이 특히 크다 — 사전 존재 부채이며 이 영역이 반복적으로 보안 결함(R-CC-10, inboundSigningRef fail-open)의 발생지였다는 점이 우려 요인 | `codebase/backend/src/modules/triggers/triggers.service.ts:259,485,1075` | chat-channel 전용 검증·secret 쓰기·ref 보존 로직을 별도 협력자(예: `ChatChannelTriggerBinder`/`resolveChatChannelSecretWrites`)로 추출. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재된 후속 스코프 — 이번 PR 착수 불요 |
| 2 | 테스팅 | `assertChatChannelInputSafe`가 무조건 차단하는 내부 필드 5개 중 3개(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)는 `null`/`''` 입력에 대한 테스트가 DTO·서비스 어느 층에도 없음. 직접 뮤테이션(`typeof x !== 'undefined'` → falsy 체크로 완화)으로 182개 테스트 전부 GREEN 유지됨을 실증 — 회귀 무방비. 더 문제인 것은 이 정확한 갭을 조사하던 트래커 항목이 "테스트로 고정됐다"고 이미 종결했는데, 그 근거로 인용된 테스트는 실제로는 `botToken`/`inboundSigningPlaintext` 2필드만 커버하고 이 3필드는 하나도 걸지 않음 | `codebase/backend/src/modules/triggers/triggers.service.ts:650,658,665`; 테스트 갭: `trigger-dto-validation.spec.ts:822`, `triggers.service.spec.ts:3242`; 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md:2088-2090` | `triggers.service.spec.ts`의 `it.each`에 3필드×2값(`null`/`''`) 조합 추가(또는 최소 DTO 통과 여부만이라도 `trigger-dto-validation.spec.ts`에 고정). 트래커의 종결 근거 문장도 실측대로 재정정(developer 권한 내 — 자기 자신이 쓴 실측을 실측으로 반증하는 경우) |
| 3 | 문서화 | `SecretResolver.rotate()`로 실제 구현된 경로를 여전히 `SecretResolver.store()`라고 서술하는 JSDoc이 이번 PR이 무겁게 편집한 codebase 파일 2곳(+연관 파일 1곳)에 남아 있음. 트래커가 같은 결함 클래스를 `spec/**` 9곳만 등재하고 이 `codebase/**` 위치들을 놓침 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:252`, `codebase/backend/src/modules/triggers/triggers.service.ts:755`, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:65` | JSDoc의 `store(`를 `rotate(`로 정정(사소한 한 단어 수정). 또는 최소한 트래커의 대상 목록에 이 3개 codebase 위치 추가 |
| 4 | 동시성 | 동시 PATCH(또는 PATCH와 `rotateChatChannelBotToken()`의 동시 실행)가 `trigger.config`(JSONB)에 대해 트랜잭션·행 잠금·낙관적 버전 비교 없이 read-modify-write 2단계 커밋을 밟아 lost update 가능 — 이번 PR이 단일 요청 범위에서 닫은 `inboundSigningRef` fail-open이 동시성 경로로 재발할 수 있음. 사전 존재 설계(CCH-SE-01, best-effort)이며 이미 이전 라운드가 발견·트래커에 등재(security 리뷰도 같은 지점을 독립 INFO로 재확인) | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`(485-607행, 특히 526-528행 `previousInboundSigningRef` 캡처), `setupChatChannel()`(1075-1259행), `rotateChatChannelBotToken()`(1456-1580행) | 후속 PR에서 트리거 단위 advisory lock / `SELECT ... FOR UPDATE` / `config` 낙관적 버전 비교 중 하나로 세 지점을 함께 닫을 것. 이번 PR을 막을 사유는 아님(재등재 불필요, 이미 트래커에 있음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1의 `details.field` "미확정 — 후속 e2e 확인 대기" placeholder가, 이번 PR의 `[실측]` 테스트로 이미 확정됨(비어있지 않은 값=중첩 경로, `null`/`''`=flat/서비스 레이어 거부). 코드는 규약을 지키고 있고 spec의 flat 표기가 낡았음이 실측으로 증명됨 | `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 표; 근거: `trigger-dto-validation.spec.ts` `[실측]` 케이스 2건 | `project-planner` 턴에서 표를 실측대로 정정(코드 변경 불요, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 위임 등재됨) |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` 이번 PR이 신설한 검증 분기 2건(최초 `chatChannel` 부착 차단, provider 전환 차단)이 R-CC-21의 필연적 귀결이나 §5.4.1 표·`2-trigger-list.md` PATCH 에러 표 어디에도 미등재 | `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelAlreadySetUp`; 대응 spec: `spec/5-system/15-chat-channel.md` §5.4.1 | `project-planner` 턴에서 두 표에 신규 행 추가(이미 트래커에 위임 등재됨) |
| 3 | 보안/테스팅 | create 경로 `ChatChannelConfigDto.botToken`에 하한 검증(`@MinLength(1)`)이 없어 빈 문자열 토큰이 활성 저장될 수 있음(가용성 문제, 비밀 유출 아님) — 사전 존재, 스코프 밖, 이미 트래커 등재 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` `ChatChannelConfigDto.botToken` | 후속 PR에서 `@MinLength(1)` 또는 provider별 정규식 검토(이미 등재, 이번 PR 착수 불요) |
| 4 | 문서화 | 사용자 가이드(mdx, `triggers.mdx`/`.en.mdx`, `telegram.mdx`/`.en.mdx`, discord/slack 6.5·5.5절)가 `details.field`를 항상 nested path로만 서술 — `null`/`''` 입력 시 실제로는 flat 이름이 온다는 이번 PR의 실측을 반영하지 않음. CHANGELOG·Swagger는 이미 정확히 반영 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:431`(+`.en`), `06-integrations-and-config/{discord,slack,telegram}.{mdx,en.mdx}` | 우선순위 낮음 — 다음 절 편집 시 한 문장 추가("값이 null/빈 문자열이면 details.field는 flat botToken") |
| 5 | 아키텍처 | `setupChatChannel`의 `storeUserSuppliedSecrets: boolean` 옵션이 현재는 2-state로 적절하나 향후 컨텍스트가 늘면 boolean-trap으로 확장될 소지 | `codebase/backend/src/modules/triggers/triggers.service.ts:1075` | 즉시 조치 불요, 3번째 상태 필요 시 정책 객체로 승격 검토 |
| 6 | 아키텍처 | `ChatChannelUpdateConfigDto extends OmitType(...)`가 `botToken`/`inboundSigningPlaintext`를 "필수"에서 "금지"로 반전시켜 명목상 서브타입이 행위적으로 상위 타입과 치환 불가(LSP 함정) — 판별 유니온+오버로드로 이미 완화됨, 실제 위험 낮음 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:378` | 문서화 수준으로 이미 충분. 향후 두 DTO를 다형적으로 섞어 쓰는 코드가 등장하면 재검토 |
| 7 | 의존성/아키텍처 | 신규 외부 의존성 없음(`package.json`/lock 변경 0). `@nestjs/swagger`의 `OmitType`을 이 저장소에서 처음 사용, `ChatChannelInput` union 신규 내부 결합 도입 — 순환 의존 없음, 방향 명확 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`, `triggers.service.ts` (`type ChatChannelInput`) | 조치 불요. 향후 3번째 provider별 DTO 변형 추가 시 discriminated union/오버로드 재정리 고려 |
| 8 | 아키텍처 | `chat-channel`·`triggers` 모듈 간 양방향 참조(엔티티/레지스트리 상호 import) 존재 — 사전 존재, 이번 PR이 넓히거나 좁히지 않음 | `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:5`, `chat-channel.dispatcher.ts:9` | 이번 PR 범위 밖, 별도 트래킹만 |
| 9 | 데이터베이스/보안 | chatChannel PATCH의 트리거 본체 저장 + secret-store 쓰기 + 2차 DB 갱신이 하나의 트랜잭션이 아님(CCH-SE-01 best-effort, degraded 폴백) — 사전 존재 설계, 상단 동시성 WARNING #4와 동일 근본 원인 | `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`/`setupChatChannel()` | 상단 WARNING #4 조치와 통합 처리, 별도 신규 등재 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이전 CRITICAL 2건(single-path 우회, 인입 서명 fail-open) 해소 확인. 잔여 INFO 2건(빈 토큰, 동시 PATCH lost update)은 사전 존재·트래커 등재됨 |
| performance | NONE | N+1·블로킹 I/O·비효율 자료구조 없음. secret-store 왕복 오히려 감소 |
| architecture | LOW | `TriggersService` God Object 경향(WARNING), boolean-trap/LSP/양방향참조 소지(INFO, 낮은 우선순위) |
| requirement | LOW | R-CC-21/D-1/D-2/D-3 정확히 구현·테스트 확인(181 passed). SPEC-DRIFT 2건은 이미 트래커 위임 |
| scope | NONE | 신규 델타(`c817a44c4`)는 `codebase/**` 미접촉, CHANGELOG+plan 동기화만 |
| side_effect | LOW | PATCH 계약 breaking change 3건은 의도된 것. JSDoc→공개 OpenAPI 유출은 이미 해소 확인 |
| maintainability | LOW | `setupChatChannel`/`update()` 길이·관심사 다중(WARNING, 사전 존재+트래커 등재). JSDoc 재배치 등 개선 확인 |
| testing | LOW | 핵심 회귀 3종 GREEN. 신규 발견: 3필드 null/'' 테스트 갭 + 트래커 종결 근거 불일치(WARNING) |
| documentation | LOW | `store()`/`rotate()` JSDoc 불일치 codebase 2곳 미등재(WARNING). mdx flat/nested 갈래 미언급(INFO) |
| dependency | NONE | 신규 의존성 없음. `OmitType` 최초 사용은 기존 패키지 export |
| database | NONE | 스키마/마이그레이션 변경 0. 비원자적 2단계 커밋은 사전 존재(INFO) |
| concurrency | LOW | 동시 PATCH lost update로 inboundSigningRef fail-open 재발 가능(WARNING, 사전 존재·트래커 등재) |
| api_contract | NONE | CHANGELOG-코드 정합 확인. 이전 WARNING(CHANGELOG 미기재) 이번 라운드에서 해소 |
| user_guide_sync | NONE | backend-api-change·integration-provider-change 두 trigger 모두 동일 changeset 내 ko/en parity 충족 |

## 발견 없는 에이전트

scope, dependency, database, api_contract, user_guide_sync, performance — CRITICAL/WARNING 없음(위 INFO 표에 참고용 기록 일부 포함).

## 권장 조치사항

1. (테스팅 WARNING #2) `triggers.service.spec.ts`의 `it.each`에 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 3필드 × `null`/`''` 조합을 추가해 falsy-체크 회귀를 잡는 테스트를 신설하고, `plan/in-progress/spec-draft-nullable-notation-followups.md`의 관련 종결 문장을 실측대로 재정정한다(developer 권한 내 자기-반증 정정).
2. (문서화 WARNING #3) `chat-channel-config.dto.ts:252`, `triggers.service.ts:755`, `slack.adapter.ts:65`의 JSDoc `SecretResolver.store()` → `.rotate()`로 정정.
3. (SPEC-DRIFT #1, #2) `project-planner` 턴에서 `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1과 `spec/2-navigation/2-trigger-list.md`를 이번 PR의 실측(details.field 형식, 신규 검증 분기 2건)으로 갱신.
4. (동시성 WARNING #4 / 아키텍처 WARNING #1) 후속 스코프로 트리거 단위 advisory lock 도입과 `TriggersService`의 chat-channel 전용 로직 분리를 백로그에 유지(이미 트래커 등재, 이번 PR 착수 불요).
5. 그 외 INFO 항목(빈 토큰 하한 검증, mdx flat/nested 갈래 언급, boolean-trap/LSP 소지)은 우선순위 낮음 — 다음 관련 파일 편집 시 함께 처리.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. `forced`(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 전체 14명 reviewer 실행, 전원 결과 확보(success). 제외된 reviewer 없음.
