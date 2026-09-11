# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 라운드(`81d2a8c18`)는 실행 로직 변경이 없는 테스트 커버리지 보강 + JSDoc 주석 추가 커밋이다. CRITICAL 없음, WARNING 2건(둘 다 실질은 1건 — plan 체크리스트 수치 stale 중복 지적, `as never` 불필요 캐스팅)만 확인됨. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 완료 — 누락된 forced reviewer 없음(거짓 음성 위험 없음).

> 참고(코드 결함 아님): 이번 라운드 리뷰 도중 5개 이상의 reviewer(performance, architecture, scope, maintainability, database, testing, documentation, api_contract)가 공유 워킹트리에서 **자신이 만들지 않은 일시적 뮤테이션**(`mode==='create'` 가드 추가, provider 정규식 스왑, `incoming.provider &&` 제거, `as never` 제거 등)을 관측했다고 보고했다. 전원 `git checkout`/`restore` 를 쓰지 않고 관측만 했으며, 리포트 작성 시점에는 저장소가 `HEAD`(`81d2a8c18`)와 일치하는 clean 상태로 자체 해소됐음을 각자 재확인했다. 모든 판정은 committed 상태 기준이라 이 트랜지언트의 영향을 받지 않는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation/requirement | plan 체크리스트의 테스트 통과 수치(`9,580`)가, 그 값을 정정한 바로 이 커밋(`81d2a8c18`) 자신이 이후 추가한 테스트 7개를 반영하지 못해 다시 stale. 커밋 메시지 `## 검증` 절 자신은 이미 정확한 최종값(`9,587`)을 적고 있음(`npx jest`로 19 passed 실측, 12+7=19 일치) | `plan/in-progress/impl-chat-channel-binder.md:163` | `9,580` → `9,587` 로 정정. 향후 같은 커밋에서 plan 수치는 diff 확정 후 마지막에 채우는 순서 권장 |
| 2 | maintainability | 신규 테스트의 `as never` 캐스팅이 이 파일이 스스로 강조하는 오버로드 방어기제를 우회하는 것처럼 보이나, `tsc --noEmit` 실측 결과(캐스팅 유무 무관 진단 197건 동일) 애초에 불필요한 캐스팅 — 다음 사람에게 "오버로드는 캐스팅 없이 못 부른다"는 오해를 줄 수 있음 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:104` | `as never` 제거, `cfg({ botToken: '1:a' }), 'update'` 로 교체(구조적 서브타이핑으로 컴파일 통과 확인됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement/api_contract | 정규식 스왑 뮤테이션 검출 테스트가 실제로 유효함을 직접 재현 확인(3건 RED, 커밋 메시지 주장과 일치) — 회귀 방지력 실측 강화 | `chat-channel-input-rules.spec.ts:127-162`, `chat-channel-input-rules.ts:267,279` | 조치 불필요, 확인 기록 |
| 2 | requirement/documentation/api_contract | discord verify_key 불일치 시 spec 기대(400 `BOT_TOKEN_INVALID`) 대신 502 `CHAT_CHANNEL_SETUP_FAILED` 로 떨어지는 기존 결함 — 이번 라운드는 이를 수정하지 않고 JSDoc 각주 + 캐너리 테스트로 현재 동작을 고정만 함(트래커에 이미 등재됨, 신규 결함 아님) | `chat-channel-input-rules.ts:299-323`, `spec/5-system/15-chat-channel.md:362` | 없음 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에서 별도 처리 예정 |
| 3 | testing | `assertChatChannelInputSafe` 내부 3개 필드 차단(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)이 유닛 스펙에서 `mode:'update'` 조합으로 테스트되지 않음 — `triggers.service.spec.ts`(통합 레벨)가 이미 회귀를 잡고 있어 실질 위험은 낮으나, 이 파일 단독으로는 R-CC-21 표면 전체를 못 덮음 | `chat-channel-input-rules.ts:95-117` | `it.each(['botTokenRef','inboundSigningRef','inboundSigning'])` 로 `mode:'update'` 조합 추가 권장(저비용) |
| 4 | testing | `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard 미검증(뮤테이션 시 142건 GREEN) — 다만 DTO 검증(`class-validator`)이 선행 차단해 사실상 도달 불가능한 방어 코드로 보임 | `chat-channel-input-rules.ts:186` | 급하지 않음, 후속에 저비용 테스트 1건 추가 가능 |
| 5 | testing | `translateSetupChannelError` 의 non-Error 입력 분기(`err instanceof Error ? ... : String(err)`)와 `details.reason` 실제 값이 테스트에서 단언되지 않음 | `chat-channel-input-rules.ts:311,316,322` | 우선순위 낮음, 후속에 `details.reason` 값 단언 추가 권장 |
| 6 | requirement | 신규 "필드 부재" 테스트가 provider별 에러 `label` 문구를 단언하지 않아 label 스왑 뮤턴트는 여전히 통과 — 이번 라운드가 닫으려던 목록에 없던 잔여 공백 | `chat-channel-input-rules.spec.ts:164-176`, `chat-channel-input-rules.ts:250-253` | 급하지 않음, `message` 단언 추가로 확장 가능 |
| 7 | side_effect/architecture | private 메서드 6개가 module-level export 함수로 승격되어 캡슐화 경계가 넓어짐(현재 외부 호출자 0, 즉각적 위험 없음) — 이전 두 라운드부터 이어지는 carry-forward 항목, 트래커 등재됨 | `chat-channel-input-rules.ts` (전체 export 함수 6곳) | 향후 신규 호출자 발생 시 서비스 계층 사전조건 재검토 |
| 8 | security | `translateSetupChannelError` 가 adapter 에러 메시지 최대 256자를 `details.reason` 에 그대로 노출하는 기존 관행 — carry-forward, 이번 라운드 무변경 | `chat-channel-input-rules.ts:310-323` | 별도 트래킹, 이번 PR 범위 아님 |
| 9 | dependency | 신규 외부 패키지·lockfile 변경 없음, 내부 모듈 의존 방향 단방향 유지(`#676` 순환 재발 없음) | 전체 3파일 | 조치 불필요, 확인 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 로직 무변경, 비밀 필드 차단·provider 정규식 분기 재확인. INFO 2건 carry-forward |
| performance | NONE | 순수 이동 + 테스트 보강, 성능 영향 없음 |
| architecture | NONE | SOLID/결합도/순환의존 재검증 통과, 새 아키텍처 문제 없음 |
| requirement | LOW | plan 수치 stale WARNING 1건(위 #1), INFO 4건(discord 502 caveat, label 미단언 등) |
| scope | NONE | 커밋 범위가 plan/커밋 메시지 주장과 정확히 일치, 스코프 이탈 없음 |
| side_effect | LOW | 시그니처/전역상태 영향 없음, 캡슐화 경계 확대 INFO 1건 |
| maintainability | LOW | `as never` 불필요 캐스팅 WARNING 1건(위 #2) |
| testing | LOW | 이전 6개 커버리지 공백 전부 폐쇄 확인(뮤테이션 재현 완료), 잔여 INFO 3건 |
| documentation | LOW | plan 수치 재-stale WARNING 1건(위 #1과 동일 이슈), 그 외 문서화 품질 견고 |
| dependency | NONE | 신규 의존성 0, 순환 없음 |
| database | NONE | DB 관점 해당 없음 |
| concurrency | NONE | 동시성 표면 무변경, 순수 동기 함수 |
| api_contract | NONE | 라우트/DTO/에러 응답 계약 무변경 |
| user_guide_sync | NONE | 매트릭스 21행 전수 미매칭, 유저 가이드/i18n 갱신 불필요 |

## 발견 없는 에이전트

scope, database, concurrency, api_contract, dependency, user_guide_sync, security(신규 발견 없음, INFO carry-forward만), performance, architecture — 위 표의 NONE 판정 참고.

## 권장 조치사항

1. `plan/in-progress/impl-chat-channel-binder.md:163` 의 테스트 통과 수치를 `9,580` → `9,587` 로 정정한다(커밋 메시지 자신의 `## 검증` 절 값과 일치, 재실행 불필요).
2. `chat-channel-input-rules.spec.ts:104` 의 `as never` 캐스팅을 제거하고 `cfg({ botToken: '1:a' }), 'update'` 로 교체한다(`tsc --noEmit` 실측상 불필요, 오도성 코드 제거).
3. (급하지 않음) `mode:'update'` 조합의 내부 필드 차단 3종을 유닛 스펙에도 추가해 이 파일 단독 커버리지를 통합 스펙과 중복되더라도 완전하게 만든다.
4. (트래커 유지) discord verify_key → 502 fallback 은 이번 PR 범위 밖으로 이미 등재됨 — 별도 후속 PR 에서 HTTP 상태 코드 정정 시 클라이언트 재시도 로직 영향까지 함께 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 완료(누락 없음).
- **제외**: 없음(전체 실행).
