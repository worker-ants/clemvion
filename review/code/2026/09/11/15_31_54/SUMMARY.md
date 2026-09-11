# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 코드 자체(`chat-channel-input-rules.ts` 추출)는 6개 함수를 문자 그대로 옮긴 순수 이동으로 14개 reviewer 전원이 로직 회귀 없음을 실측으로 확인했다. 그러나 이 이동이 깨뜨린 spec 귀속 표기(`slack.md:275`, `discord.md:297`)에 대해 커밋 메시지가 "planner 항목으로 등재했다"고 주장하지만, 그 등재는 plan 체크리스트·`spec_impact`·어떤 트래커에도 실재하지 않는다 — `plan/in-progress/impl-chat-channel-binder.md` 가 `plan/complete/` 로 이동하는 순간 이 지식이 영구 유실될 위험이 있다(documentation reviewer CRITICAL, architecture/requirement/scope reviewer 3명이 같은 실체를 WARNING 으로 corroborate). 14명 reviewer(강제 7명 포함) 전원의 결과가 확보되어 있어 누락으로 인한 거짓 음성은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/프로세스 | plan 문서의 "처방"(얇은 delegator 로 spec drift 0)이 실제 구현(delegator 미보존)과 정반대인데 plan 파일 자체는 정정되지 않았고, 커밋이 주장한 "planner 항목으로 등재했다"가 plan 체크리스트·`spec_impact`(`none`으로 기재)·어떤 트래커에도 실재하지 않는다. `plan/complete/` 이동 시 spec drift 정정 지식이 증발할 위험 | `plan/in-progress/impl-chat-channel-binder.md:93-98`(철회된 처방), `:7`(`spec_impact: none`), `:142`(관련 체크박스 미체크); 커밋 `2ae81077c` 본문 "planner 항목으로 등재했다" 문단 | `plan/in-progress/impl-chat-channel-binder.md` §93-98 을 취소선 처리하고 실제 결정(delegator 미보존, 사유)으로 정정. `spec_impact` 를 `[spec/4-nodes/7-trigger/providers/slack.md, spec/4-nodes/7-trigger/providers/discord.md]` 로 갱신. 실재하는 트래커(예: `spec-draft-nullable-notation-followups.md`)에 "slack.md:275/discord.md:297 의 `TriggersService.X` 귀속 표기 정정 — planner 턴" 항목을 실제로 추가한 뒤 `plan/complete/` 이동 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `assertInboundSigningPlaintextByProvider` 가 `TriggersService` private 메서드에서 module-level 함수로 이동하며, 두 spec 문서가 문자 그대로 인용하던 클래스 귀속(`TriggersService.assertInboundSigningPlaintextByProvider`)이 이제 존재하지 않는 심볼을 가리킨다. 코드 쪽 판단(delegator 미보존)은 합리적이고 이번 PR 은 로직을 바꾸지 않았다 — spec 표기만 낡았다 | `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297` | spec 문구를 "`TriggersService` 가 `chat-channel-input-rules.assertInboundSigningPlaintextByProvider` 를 호출해 검증" 형태로 정정 (planner 턴 필요 — 이 문장은 이전 planner 턴이 작성했으므로 developer 자기-반증형 소정정 조건1 불성립). 코드 revert 아님. (참고: 같은 함수를 클래스 접두 없이 함수명만 인용하는 3곳 — `2-trigger-list.md:155`, `discord.md:76`, `15-chat-channel.md:432` — 은 이동 후에도 여전히 참이라 drift 없음) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 3 | 테스트 | `translateSetupChannelError` 의 401/403 정규식 판별이 discord adapter 의 실제 verify_key 불일치 에러(`"BOT_TOKEN_INVALID: ..."`, 숫자 없음)와 어긋난다 — 실제로 재현한 결과 의도한 400 `BOT_TOKEN_INVALID` 대신 fallback 502 `CHAT_CHANNEL_SETUP_FAILED` 로 응답된다. 이번 PR 이 만든 회귀는 아니고(이동 전부터 테스트 0건) 순수 함수로 분리된 지금이 가장 싸게 테스트를 붙일 시점 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:304-318` (`translateSetupChannelError`), 원인: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:93-94` | `translateSetupChannelError` 전용 유닛 테스트 추가 — (a) "...401/403..." 포함 메시지 매핑, (b) 그 외 fallback, (c) discord 의 실제 리터럴(`"BOT_TOKEN_INVALID: ..."`, 숫자 없음)을 넣어 의도한 매핑 여부 검증(현재 RED 예상) → 정규식 확장 또는 adapter 메시지에 실제 status 포함 여부 결정 |
| 4 | 유지보수성 | `BadRequestException({code:'VALIDATION_ERROR', message, details:{field, code}})` 에러 봉투 구성 패턴이 한 파일 안에서 7회 이상 거의 동일하게 반복 — 파일 자체 docstring 이 이 봉투 형태를 계약으로 선언하고 있어, 신규 필드 추가 시 복붙하다 `details.code` 를 빠뜨리면 컴파일 타임에 안 잡히고 계약이 조용히 깨질 수 있다 | `chat-channel-input-rules.ts:98-102,105-109,112-116,143-147,150-157,235-243,254-262,268-276,279-288` | `throwValidationError(field, message, code?)` 헬퍼로 봉투 생성을 한 곳에 모아 신규 provider/필드 추가 시 누락 위험을 원천 차단 (후속 커밋, 이번 PR 범위 밖) |
| 5 | 문서화 | plan 체크리스트가 이 커밋에서 이미 완료된 T1 단계("T1 이동 + 테스트 diff 0줄 확인")를 미체크 상태로 남겼다 — 커밋 메시지 자신이 `git diff --numstat -- '*.spec.ts'` = 0줄을 증거로 제시했음에도 체크박스는 갱신되지 않음 | `plan/in-progress/impl-chat-channel-binder.md:142` | 체크리스트 항목 1·2 를 체크하고 `status: in-progress` 는 T2 잔존으로 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 6 | 보안 | `assertInboundSigningPlaintextByProvider` 가 private→exported 로 바뀌며, "생성 전용" 불변식이 더 이상 캡슐화로 보장되지 않는다 — 신규 호출자가 `assertChatChannelInputSafe` 를 거치지 않고 PATCH 경로에서 직접 호출하면 provider-issued 값 검증을 우회할 수 있다(현재 import 자는 1곳뿐이라 오늘 시점 악용 경로 없음) | `chat-channel-input-rules.ts:227` | 신규 호출자 추가 시 단일 진입점(`assertChatChannelInputSafe`)만 노출하도록 코드리뷰 체크리스트/ESLint 규칙 고려 |
| 7 | 보안 | `translateSetupChannelError` 가 adapter 에러 메시지 최대 256자를 `details.reason` 에 그대로 노출 — 현재는 정형화된 문자열만 가정해 위험 낮음이나, adapter 구현이 바뀌면 원본 응답 유출 경로가 될 수 있음(이동 전과 동일 로직, 이번 PR 신규 아님) | `chat-channel-input-rules.ts:304-317` | adapter 에러 메시지 포맷을 화이트리스트/전용 에러 클래스로 강제해 향후 유출 구조적 차단 |
| 8 | 아키텍처 | 파일명·docstring 이 "chat-channel **입력 규칙**"으로 스코프를 좁게 선언하지만, 출력측 에러 변환 함수(`translateSetupChannelError`)가 섞여 있어 파일 책임 경계가 이름보다 흐리다 | `chat-channel-input-rules.ts:15-16` vs `:304-318` | 파일명/docstring 을 "입력 검증 + 외부 에러 변환"으로 넓히거나 `translateSetupChannelError` 를 별도 파일로 분리 |
| 9 | 아키텍처 | `assertPatchCarriesNoSecrets` 가 외부 소비자·spec 앵커 없이 export 되어 공개 표면이 불필요하게 넓다(같은 파일 내부에서만 호출됨, 유일하게 두 근거 다 없는 함수) | `chat-channel-input-rules.ts:138-140` | `export` 제거해 내부 헬퍼로 강등하거나 재사용 계획을 docstring 에 기록 |
| 10 | 아키텍처 | provider 분기 확장성 안전장치가 주석 규율에만 의존 — 신규 provider 추가 시 컴파일러/런타임이 강제하지 못해 형식 검증 없이 통과할 위험(이동 전부터 존재하는 알려진 부채, docstring 이 명시적으로 경고) | `chat-channel-input-rules.ts:222-225,233-289` | 다음 provider 추가 PR 에서 `switch`+`assertNever` 패턴으로 컴파일 타임 강제 승격 |
| 11 | 유지보수성 | 에러 메시지 절단 길이 `256` 이 매직 넘버로 두 번 하드코딩되어 있어 의도("왜 256인가")가 코드에서 드러나지 않음 | `chat-channel-input-rules.ts:310,316` | `MAX_ERROR_REASON_LENGTH` 상수로 명명 |
| 12 | 유지보수성 | `chatChannel as unknown as Record<string, unknown>` 이중 캐스팅 패턴이 두 함수에서 반복 — 신규 필드 검사 시 세 번째 캐스팅이 늘어날 위험 | `chat-channel-input-rules.ts:96,141` | `hasField(obj, key)` 헬퍼로 캐스팅 지점 통합 |
| 13 | 테스트/요구사항 | 신규 순수 함수 모듈에 전용 단위 테스트 파일이 없다 — 전 커버리지가 `TriggersService` 경유 간접 테스트에만 의존해, 이동의 이차 동기(DI 없이 직접 테스트 가능해짐)가 아직 실현되지 않음 | `chat-channel-input-rules.ts` 전체 (대응 `*.spec.ts` 부재) | `chat-channel-input-rules.spec.ts` 신설해 6개 함수를 mock 없이 직접 호출하는 단위 테스트로 보완(항목#3 케이스 포함) |
| 14 | 테스트 | 커밋이 인용한 "뮤테이션 5/5 RED" 검증이 1회성 수동 절차로 보이며 재현 가능한 스크립트/명령으로 저장소에 남지 않음 | 커밋 `2ae81077c` 본문 "## 증거" 섹션 | 재현 명령(어떤 가드를 어떻게 무력화했는지)을 plan/커밋에 남겨 다음 리뷰가 재현 가능하게 함 |
| 15 | 문서화 | 이번 diff 밖의 기존 주석 `chat-channel-rejection-messages.const.ts:8`("TriggersService 가드")가 이동의 결과로 한 단계 더 부정확해짐(가드 로직은 이제 클래스 밖에 있고 TriggersService 는 호출만 함) | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:8` | 후속 커밋에서 "TriggersService 가 호출하는 chat-channel-input-rules 가드"로 정정 |
| 16 | 요구사항 | `dto/chat-channel-config.dto.ts` 클래스 docstring("provider별 추가 검증은 TriggersService 가 수행")도 이동으로 아키텍처적으로 부정확해짐 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:36` | 후속 정리 시 함께 갱신 |

## 점검했으나 문제 없음 (참고, 확인된 항목)

- 비밀 필드 차단(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/PATCH 의 `botToken`/`inboundSigningPlaintext`), plaintext DB 잔류 방지(`stripChatChannelPlaintext`), provider 형식 검증 정규식, provider 전환 차단 — 이동 전후 로직 100% 동일 (security)
- `#1314` CRITICAL 이었던 `inboundSigningRef` fail-open 방지 로직은 이번 PR 범위(T2) 밖으로 그대로 보존 (security)
- 테스트 diff 0줄 실측, `triggers.service.spec.ts` 123 passed / 1 skipped 재실행 GREEN, private 메서드 직접 접근/spy 패턴 없어 은닉 결합 파손 위험 없음 (requirement, testing, side_effect)
- 타입체크 baseline 유지(`tsc --noEmit` 대상 파일 관련 신규 에러 0건) (requirement)
- 새 외부 의존성/lockfile 변경 없음, 내부 모듈 의존 방향 단방향 유지(`#676` 순환 재발 없음) (dependency, side_effect)
- API 계약(요청 검증·에러 응답 형식·라우팅·인증/인가) 무변경, DTO/컨트롤러 changeset 밖 (api_contract)
- DB 쿼리·트랜잭션·스키마·마이그레이션 무관 (database)
- 동시성 표면(락·TOCTOU·secret rotation) 무관 — 실제 동시성 표면(T2, setupChatChannel/teardownChatChannel)은 이번 PR 범위 밖 (concurrency)
- 유저 가이드 MDX·i18n dict·backend-labels.ts 갱신 트리거 매칭 0건 (user_guide_sync)
- 클래스 메서드→모듈 함수 전환에 따른 성능 영향 없음, ReDoS 위험 없는 고정 정규식 (performance)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | CRITICAL | plan 처방 vs 실구현 모순 + "planner 등재" 미확인 → spec drift 유실 위험 |
| testing | MEDIUM | `translateSetupChannelError` 401/403 정규식이 discord 실제 에러와 불일치(사전 존재), 전용 유닛 테스트 부재 |
| architecture | LOW | 공개 계약 변화(spec 귀속) 추적 공백, 파일 스코프/공개표면 관련 INFO 다수 |
| requirement | LOW | 기능 회귀 없음(순수 이동 재현·검증 완료), SPEC-DRIFT 2곳 + 등재 미확인 |
| scope | LOW | plan 문서가 반전된 설계를 정정 없이 서술, 그 외 스코프 이탈 없음 |
| maintainability | LOW | 에러 봉투 구성 패턴 반복(7+회), 매직넘버/캐스팅 반복 — 전부 이동 전부터 존재 |
| security | NONE | 순수 이동, 비밀 차단/plaintext 방지 로직 보존 확인. INFO 2건(캡슐화, 에러메시지 노출 관행) |
| performance | NONE | 알고리즘/복잡도/N+1/블로킹 I/O 변화 없음 |
| side_effect | NONE | 상태·전역·I/O 부작용 없음, 순환 의존 재발 없음 |
| dependency | NONE | 새 외부 의존성 없음, 의존 방향 단방향 유지 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음(실제 동시성 표면은 범위 밖 T2) |
| api_contract | NONE | 계약 변경 없음 |
| user_guide_sync | NONE | 매칭 트리거 0건 |

## 발견 없는 에이전트

- database — DB 쿼리·트랜잭션·스키마·마이그레이션 관련 발견사항 없음
- concurrency — 공유 가변 상태·락·비동기 흐름 변경 없음
- performance — 확인 사항만 존재(전부 "조치 불필요"), 실질 발견 없음
- dependency — 확인 사항만 존재(전부 "제안 없음"), 실질 발견 없음
- api_contract — 확인 사항만 존재(전부 "조치 불필요"), 실질 발견 없음
- user_guide_sync — 매칭되는 doc-sync-matrix 트리거 행 0개

## 권장 조치사항

1. (Critical) `plan/in-progress/impl-chat-channel-binder.md` §93-98 을 실제 결정으로 정정하고, `spec_impact` 를 `slack.md`/`discord.md` 경로로 갱신하며, 실재 트래커에 "TriggersService.X 귀속 표기 정정 — planner 턴" 항목을 실제로 추가한 뒤 `plan/complete/` 이동.
2. (SPEC-DRIFT) `spec/4-nodes/7-trigger/providers/slack.md:275`, `discord.md:297` 의 `TriggersService.assertInboundSigningPlaintextByProvider` 귀속 문구를 실제 호출 구조(`TriggersService` 가 `chat-channel-input-rules` 함수를 호출)로 정정 — planner 턴.
3. (Warning) `translateSetupChannelError` 전용 유닛 테스트를 추가하고, discord adapter 의 실제 에러 리터럴을 넣어 401/403 정규식 매핑이 의도대로 동작하는지 검증 — 현재 502 fallback 으로 오분류될 것으로 예상됨.
4. (Warning) 에러 봉투 생성 헬퍼(`throwValidationError`)로 7곳 이상의 반복을 통합해 향후 필드 추가 시 계약 누락을 원천 차단.
5. (Warning) plan 체크리스트의 완료된 T1 항목을 체크.
6. (Info, 선택) `chat-channel-input-rules.spec.ts` 신설, `assertPatchCarriesNoSecrets` export 축소, provider 분기 `switch`+`assertNever` 승격 등은 다음 관련 커밋에서 처리.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행(fallback 전체 실행).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- 전문 확보 실패 reviewer: 없음 (14/14 전원 인라인 전문 확보).
