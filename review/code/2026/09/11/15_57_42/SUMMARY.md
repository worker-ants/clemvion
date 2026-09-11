# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. 실 코드 결함은 없으나(14개 reviewer 중 11개 NONE), `chat-channel-input-rules.spec.ts` 가 R-CC-21/`#1314` CRITICAL 가드의 절반(discord 분기·`inboundSigningPlaintext` 분기)을 실측 커버리지 미달로 남겨 testing reviewer 가 MEDIUM 을 냈다. forced whitelist(7명) 전원 결과 확보 확인됨 — 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `assertPatchCarriesNoSecrets` 의 `inboundSigningPlaintext` 차단 분기가 신규 단위 테스트에서 누락됨 — 이 함수는 R-CC-21/`#1314` CRITICAL 클래스를 직접 막는 가드인데, `botToken` 케이스만 검증되고 대칭 필드는 실측 커버리지(`--coverage`)상 미달로 확인됨 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:149-150`, 테스트 `chat-channel-input-rules.spec.ts` | `it('PATCH 는 inboundSigningPlaintext 도 거부한다', ...)` 형태로 대칭 케이스 추가 |
| 2 | Testing | `assertInboundSigningPlaintextByProvider` 의 discord(hex64) 분기가 신규 테스트에 전혀 등장하지 않음 — slack(hex32) 만 유효/무효 값으로 테스트됨. 두 provider 는 서로 다른 정규식을 쓰는 별개 분기라 slack 통과가 discord 안전을 보장하지 않음(정규식이 뒤바뀌는 뮤테이션도 GREEN) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:279-289` | `it('discord 는 hex64 를 요구한다', ...)` 를 slack 과 대칭으로 추가, `it.each` 로 두 provider 동시 커버 권장 |
| 3 | Documentation | 같은 fix 커밋 안에서 plan 체크리스트가 인용한 테스트 통과 수치(9,568)가 같은 커밋 메시지의 최종 수치(9,580, `+12`=이 커밋이 추가한 신규 테스트)와 어긋남 — "거짓 등재 주장을 바로잡는다"는 목적의 커밋 자체에서 같은 패턴(측정 시점 불일치)이 재발 | `plan/in-progress/impl-chat-channel-binder.md:163` | `9,568` → `9,580`(또는 재실행 확정치)으로 정정 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `assertInboundSigningPlaintextByProvider` 를 가리키는 `TriggersService.` 접두 귀속이 이동 후 문법적으로 성립하지 않음(함수가 이제 module-level export). 실질(검증 시점·에러 코드·필드)은 여전히 정확 — 코드가 아니라 spec 표기만 낡았다. 이미 durable 트래커(`spec-draft-nullable-notation-followups.md:2523`)에 등재 완료, developer 권한 밖이라 이번 라운드에서 코드/spec 조치 불필요 | `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297` | 다음 planner 턴에서 "Backend 의 `TriggersService` 가 `chat-channel-input-rules.assertInboundSigningPlaintextByProvider` 를 호출해 검증"으로 정정. 코드 revert 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | slack/discord "`inboundSigningPlaintext` 필드 자체 없음"(필수 위반) 분기 미검증 — label 조건이 틀려도 안 잡힘 | `chat-channel-input-rules.ts:249-262` | `it.each([['slack',...],['discord',...]])` 로 label 포함 여부 단언 |
| 2 | Testing | `assertChatChannelInputSafe` 의 `mode==='update'` 디스패치 분기가 공개 진입점 경유로 한 번도 실행되지 않음(`assertPatchCarriesNoSecrets` 는 직접 호출로만 검증) | `chat-channel-input-rules.ts:118-125` | update 모드로 캐스팅 호출하는 테스트 1건 추가 |
| 3 | Testing | `assertChatChannelAlreadySetUp` 의 "정상 통과"(양성) 경로 미검증 — 현재 두 테스트 모두 throw 케이스만 | `chat-channel-input-rules.ts:168-193` | provider 동일 시 `null` 반환 확인 케이스 추가 |
| 4 | Testing | `chatChannel===undefined` 조기 반환 분기(PATCH 바디에 키 자체 없는 흔한 실사용 경로) 미검증 | `chat-channel-input-rules.ts:95` | `assertChatChannelInputSafe(undefined,'create')` → `null` 단언 1줄 추가 |
| 5 | Documentation | `translateSetupChannelError` 의 JSDoc 이 discord verify_key 불일치 시 502 로 오분류되는(캐너리로 실측 고정된) 알려진 예외를 언급하지 않음 — 소스만 읽는 독자는 이 사실을 알 수 없음 | `chat-channel-input-rules.ts:293-303` (JSDoc) vs `chat-channel-input-rules.spec.ts:163-177`(캐너리) | JSDoc 에 한 줄 각주 추가(코드 변경 없음, 동작 보존과 무충돌) |
| 6 | API/Security (carry-forward, 신규 아님) | discord verify_key 불일치 시 의도한 400 `BOT_TOKEN_INVALID` 대신 502 `CHAT_CHANNEL_SETUP_FAILED` 반환 — 판별식 `/\b(401\|403)\b/` 이 숫자 없는 adapter 에러 메시지를 못 잡음. 보안 취약점 아님(양쪽 다 setup 거부), 이번 PR 이 만든 회귀 아님, 캐너리로 고정 + 트래커 등재 완료 | `chat-channel-input-rules.ts:304-318` | 이미 등재됨(근본 처방: adapter 가 status 를 메시지에 싣도록 통일), 이번 라운드 추가 조치 불요 |
| 7 | Security/Architecture (carry-forward) | provider 전용 검증 함수가 `private`→exported 로 캡슐화가 느슨해짐 — "`mode==='create'`에서만 호출" 불변식이 JSDoc 으로만 강제됨. 실제 오용 호출자는 0건(grep 재확인) | `chat-channel-input-rules.ts:227` | 신규 호출자 추가 시 `mode` 단일 진입점만 노출하는 관례 강제 |
| 8 | Security (carry-forward) | `translateSetupChannelError` 가 adapter `Error.message` 최대 256자를 `details.reason` 에 그대로 노출 — 현재 adapter 메시지는 정형 문자열뿐이라 즉시 유출 위험 없음, 구조적 관측만 | `chat-channel-input-rules.ts:304-317` | 별도 트래킹(이번 PR 범위 아님) |
| 9 | Maintainability | 이미 알려진 구조 정리 6건(에러 봉투 생성 반복 7회+ · 매직넘버 `256` · 이중 캐스팅 2곳 · 입력규칙 파일에 출력측 변환 혼재)이 이번 커밋에서 durable 트래커에 실제로 등재됨(grep 으로 실재 확인) — 이번 PR 스코프 밖, 새 조치 불필요 | `chat-channel-input-rules.ts` 전반, 트래커 `spec-draft-nullable-notation-followups.md` | 후속 라운드에서 트래커 처리 여부만 확인 |
| 10 | Maintainability | 신규 테스트 헬퍼(`thrown`/지역 `res`)가 같은 에러 봉투를 각자 다른 익명 타입으로 캐스팅 — 사소, 확장 시 세 번째 변형 유인 | `chat-channel-input-rules.spec.ts` | 공유 타입(`type ChatChannelErrorResponse`)으로 통합 검토(낮은 우선순위) |
| 11 | 전 reviewer 공통 | 이전 라운드(`15_31_54`) CRITICAL(등재 주장이 거짓)이 이번 fix 커밋(`6dc2b7d60`)에서 실측으로 완전히 해소됨 — durable 트래커 3항목 실재, plan 체크리스트 실제 완료 상태 반영, 신규 단위 테스트 12건 GREEN 재현 | `plan/in-progress/impl-chat-channel-binder.md:93-116`, `spec-draft-nullable-notation-followups.md:2523-2561` | 없음 — 해소 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 무변경, 비밀 차단/plaintext 방지/`#1314` 로직 전부 보존. INFO 2건 carry-forward(캡슐화, 에러 메시지 노출) |
| performance | NONE | 순수 이동, O(1) 함수뿐. 성능 영향 없음 |
| architecture | NONE | 이전 CRITICAL/WARNING(drift 미추적) 해소 확인, 순환 의존 재확인(0건) |
| requirement | LOW | 코드 결함 없음(NONE 급). SPEC-DRIFT 1건이 아직 spec 파일 미반영(트래킹만 완료) |
| scope | NONE | 두 커밋 모두 요청 범위(T1 이동 + 직전 CRITICAL 정정) 내로 국한 확인 |
| side_effect | NONE | 신규 테스트는 순수 함수 호출뿐, 부작용 표면 없음 |
| maintainability | LOW | 구조 정리 6건 트래커 등재 확인. 테스트 헬퍼 타입 중복 INFO |
| testing | MEDIUM | R-CC-21 가드 절반(discord 분기·`inboundSigningPlaintext`)이 신규 테스트에서 미검증 — WARNING 2건 |
| documentation | LOW | 이전 CRITICAL 해소, 신규로 plan 수치 불일치 1건 + JSDoc 갱신 여지 |
| dependency | NONE | 신규 외부 의존성 없음, 순환 없음 |
| database | NONE | DB 접근 코드 없음 |
| concurrency | NONE | 동기 순수 함수, 공유 가변 상태 없음. T2(진짜 동시성 표면)는 스코프 밖 |
| api_contract | NONE | DTO/컨트롤러/에러 봉투 무변경, 신규 테스트가 오히려 회귀 감지력 순증 |
| user_guide_sync | NONE | 매트릭스 21행 중 매칭 0건, MDX/i18n 변경 없음 |

## 발견 없는 에이전트

security, performance, architecture, scope, side_effect, dependency, database, concurrency, api_contract, user_guide_sync — 전부 위험도 NONE, CRITICAL/WARNING 없음(일부 carry-forward INFO 만 존재).

## 권장 조치사항

1. `chat-channel-input-rules.spec.ts` 에 discord provider 분기(`assertInboundSigningPlaintextByProvider`)와 `inboundSigningPlaintext` PATCH 차단(`assertPatchCarriesNoSecrets`) 대칭 케이스를 추가한다 — R-CC-21/`#1314` 가드의 실제 커버리지 공백을 닫는다(WARNING 1·2).
2. `plan/in-progress/impl-chat-channel-binder.md:163` 의 테스트 통과 수치(9,568 → 9,580)를 정정한다(WARNING 3).
3. `slack.md:275`/`discord.md:297` 의 `TriggersService.` 귀속 표기는 다음 planner 턴에서 정정한다 — 이미 트래커 등재 완료, 이번 세션 조치 대상 아님(SPEC-DRIFT, WARNING 4).
4. (낮은 우선순위) INFO 목록의 나머지 테스트 커버리지 공백(양성 경로·조기 반환·필드 누락 분기)과 `translateSetupChannelError` JSDoc 각주는 여유 있을 때 처리.

## 라우터 결정

- `routing_status=skipped` — "라우터 미사용. 전체 reviewer(14명) 실행."
- **강제 포함(router_safety) 대상으로 지목된 목록**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- 라우터 자체가 사용되지 않았으므로 "제외된 reviewer"는 없다 — 14명 전원(`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`) 이 실행되어 결과를 반환했다.
