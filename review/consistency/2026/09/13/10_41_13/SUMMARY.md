# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. WARNING/INFO만 발견.

## 전체 위험도
**LOW** — Critical 없음. developer 권한 내(codebase/**, plan/**)에서 바로 고칠 수 있는 WARNING 2건과, 이미 planner 백로그에 등재되어 처분 대기 중인 pre-existing WARNING 2건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `TestConnectionResultDto.code` JSDoc이 내부 서사(latencyMs 정반대 방향 결함 설명, 내부 plan 파일 경로)를 담아 `swagger.md §3`("JSDoc은 공개 OpenAPI로 나간다 — 내부 서사 금지") 위반. 같은 커밋 같은 파일의 `meta` 필드 제거 설명은 정확히 `//`로 처리해 자기모순 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:464-477` | `spec/conventions/swagger.md §3` | JSDoc을 "실패 분류 코드(MCP_*·EMAIL_CONNECT_FAILED·INTEGRATION_INCOMPLETE 등). 성공 시 부재." 한 문단으로 축소하고, 경위 설명은 위 `meta` 필드 처리와 동일하게 `//`로 이동. developer 권한 내(`codebase/**`)에서 즉시 수정 가능 |
| 2 | convention_compliance | `user-guide-evidence.md §2.1` 갱신을 요청하는 planner 백로그 등재 항목이 이번 라운드에 신설된 `guide-sanitized-message-parity.test.ts`를 누락 — 등재 범위가 diff보다 좁음(스냅샷 시점 이후 항목 미반영) | `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 등재 항목, ~3234행) | 신규 가드 `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` | 해당 plan 항목에 `guide-sanitized-message-parity.test.ts`를 `guide-error-code-existence.test.ts`와 병기(가드 4→5건). `plan/**` 갱신은 developer 권한 내이므로 이번 라운드에서 바로 고칠 수 있음(spec 본문 자체는 여전히 planner 소관) |
| 3 | cross_spec, convention_compliance, plan_coherence | `3-error-handling.md §1` 에러 코드 카탈로그가 통합(Cafe24/Makeshop)·OAuth 도메인 코드 계열을 누락 — 이번 PR이 새로 만든 결함은 아니며 pre-existing gap | `spec/5-system/3-error-handling.md §1.1~§1.12` (Integration 전용 §1.13 부재) | `spec/conventions/error-codes.md`, `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`, `spec/2-navigation/4-integration.md` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재되어 있고 3개 plan 상호참조까지 완료됨(plan_coherence 확인). 별도 조치 불요 — planner 턴 대기 |
| 4 | cross_spec, rationale_continuity, convention_compliance | `testConnection` 실패 응답 shape(`{success:false, message}`)이 `7-llm-client.md`·`6-config.md` 어느 spec 표에도 미문서화 — 코드에는 이미 배선 완료(3회 연속 checker 지적) | `spec/5-system/7-llm-client.md §8.3` (성공 케이스만 서술) | `codebase/backend/src/modules/llm/llm.service.ts`(실제 반환값), `spec/2-navigation/4-integration.md §9.1`(형제 엔드포인트는 실패 shape 문서화됨) | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 등재됨. 별도 조치 불요 — planner 턴에서 §8.3 표에 실패 행 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity | 라운드1 WARNING("`LLM_RATE_LIMIT` 엔진/노드 두 표 중복")이 이번 HEAD에서 해소 확인 — 노드 수준 표 1곳에만 유지, spec §1.4 구조와 합치 | `run-results{,.en}.mdx` | 없음(양성 확인) |
| 2 | rationale_continuity | `nodeName`→`nodeLabel` 정정이 spec §2.2(2026-08-17 정정)와 일치, backend 실측(emit nodeLabel 57건·nodeName 0건)과도 일치 | `run-results{,.en}.mdx` | 없음(양성 확인) |
| 3 | rationale_continuity, naming_collision | `TestConnectionResultDto.code` 신설·`latencyMs`/`meta` 제거는 신규 식별자 도입이 아니라 기존 생산자(`integrations.service.ts`)가 이미 내던 값의 뒤늦은 DTO 선언 — spec §9.1과 정합 | `integration-response.dto.ts`, `model-config-response.dto.ts` | 없음(양성 확인). MCP 전용 3필드(capabilities/serverInfo/preview) 미선언은 별도 developer 항목으로 이미 등재됨 |
| 4 | plan_coherence | 이전 라운드 WARNING("§1 카탈로그 관련 plan 3건 상호참조 부재")이 이번 라운드에 파일·줄 단위 실측 인용으로 해소 확인 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3204-3223` | 없음(양성 확인) |
| 5 | naming_collision | `guide-sanitized-message-parity.test.ts` 신설이 기존 가드 가족(`guide-error-code-*`, `impl-anchor-*`) 명명 관례와 병존, 신규 endpoint/이벤트/ENV 키 없음 — 충돌 0건 | `codebase/frontend/src/lib/docs/__tests__/` | 없음(양성 확인, 등재 누락은 위 WARNING #2 참조) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 라운드1 WARNING(LLM_RATE_LIMIT 중복) 해소 확인. 남은 3개 gap은 모두 planner 백로그 등재됨(신규 아님) |
| rationale_continuity | LOW | 이전 WARNING·자기모순 모두 해소 확인. 새 DTO 필드 변경은 기존 마스킹 원칙과 정합. testConnection shape 미문서는 3회 연속 동일하게 정상 처리 중 |
| convention_compliance | LOW | 신규 WARNING 2건 — JSDoc/`//` 분리 위반(swagger.md §3), planner 백로그 등재 범위가 diff보다 좁음. 둘 다 CRITICAL급 invariant 파괴 아님 |
| plan_coherence | NONE | Critical 0·Warning 0. 이전 라운드 WARNING(plan 3건 상호참조 부재)이 실측 인용으로 해소 확인 |
| naming_collision | NONE | 신규 식별자 도입 없음(뒤늦은 선언·기존 관례 준수·자기모순 정정뿐). 인접 이슈(가드 관계표 staleness)는 이미 등재됨 |

## 권장 조치사항
1. `TestConnectionResultDto.code` JSDoc을 소비자용 한 문단으로 축소하고 경위 설명은 `//`로 이동 (`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:464-477`, developer 권한 내 즉시 가능)
2. `plan/in-progress/spec-draft-nullable-notation-followups.md`의 `user-guide-evidence.md §2.1` 갱신 요청 항목에 `guide-sanitized-message-parity.test.ts`를 병기 (developer 권한 내 즉시 가능)
3. (참고, 이미 등재 완료 — planner 턴 대기) `3-error-handling.md §1` 카탈로그에 CAFE24/MAKESHOP/OAUTH 도메인 코드 계열 보강, `7-llm-client.md §8.3`에 testConnection 실패 shape(`{success:false, message}`) 행 추가, `user-guide-evidence.md §2` 가드 카운트(3→5건) 갱신 — 세 plan이 한 planner 턴에 통합 처리하도록 이미 상호참조 완료됨
