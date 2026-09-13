# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — `spec/5-system/` 델타는 0(정상, 코드·유저가이드 전용 PR). 실제 코드/가이드 변경(LLM testConnection 필드 정정, 유저 가이드 5종 에러코드 정정, 신규 build-time 가드)은 SoT 와 대체로 정합하나, 가이드 자체 내 잔존 결함 2건과 이미 열려 있는 spec 공백 관련 WARNING 다수가 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 유저 가이드가 새로 도입한 "노드 종류별 vs 엔진 수준" 2단 구조에서 `LLM_RATE_LIMIT` 를 양쪽 표에 중복 배치 — 가이드 자신의 새 주장과도, SoT 의 계층 구분과도 모순 | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`·`.en.mdx` "에러 메시지 해석" 절 | `spec/5-system/3-error-handling.md §1.4`(엔진 수준 표에는 `LLM_RATE_LIMIT` 미등재) | 엔진-레벨 `<FieldTable>` 에서 `LLM_RATE_LIMIT` 행 제거(노드-종류별 `AI·LLM` 행에 이미 있음) |
| 2 | rationale_continuity | 실행 에러 응답 예시 JSON 이 이미 정정 확정된 필드명을 여전히 옛 이름으로 서술 — 이번 PR 이 바로 옆(`code`) 필드를 고치면서 지나침 | `run-results.mdx:173`, `run-results.en.mdx:163` (`"nodeName"`) | `spec/5-system/3-error-handling.md §2.2` Rationale(2026-08-17, `nodeName`→`nodeLabel` 정정 확정, 코드베이스 emit 0건 실측 완료) | `nodeName` → `nodeLabel` 1줄 정정(§2.2 이 이미 결정한 내용이므로 신규 Rationale 불요) |
| 3 | convention_compliance / plan_coherence | LLM·통합 도메인 에러 코드(`CAFE24_*`·`MAKESHOP_*`·`OAUTH_*`·`LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED`)가 `3-error-handling.md §1` 카탈로그에 여전히 미등재(§1.5~§1.12 관행에서만 이 도메인들이 빠짐) | `spec/5-system/3-error-handling.md §1` | `spec/conventions/error-codes.md`(카탈로그 SoT), 및 동일 절을 각각 독자적으로 겨냥한 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(OAuth 서브섹션 설계 완료분) · `plan/in-progress/keyset-cursor-uuid-validation.md` §D#1(Background Runs 4종) | 이미 `spec-draft-nullable-notation-followups.md` 에 planner 항목 등재됨 — **단** 이 항목과 위 두 plan 파일 간 상호 포인터가 없어 절 번호·서브섹션 위치가 3곳에서 제각각 제안된 상태. planner 턴에서 세 항목을 한 번에 묶어 처리하도록 상호 참조를 추가할 것 |
| 4 | convention_compliance | `testConnection` 실패 응답 shape(`{success:false, message}`)이 spec 어디에도 문서화돼 있지 않음(코드는 이번 PR 이 이미 통일) | `spec/5-system/7-llm-client.md §8.3`(성공 케이스만 서술) | `spec/conventions/swagger.md §5-5`(선언=실제 요구) | 이미 planner 백로그 등재됨. §8.3 에 실패 행 추가(8갈래 문장 SoT=`sanitize-error.util.ts`) |
| 5 | convention_compliance / naming_collision / cross_spec | 신규 build-time 가드(`guide-error-code-existence`/`guide-error-code-scan`)가 자신이 SoT 로 지목한 문서에 아직 미등재 — "가드 3건" 카운트가 stale | `spec/conventions/user-guide-evidence.md §2`·§2.1 관계표·frontmatter `code:` | 신규 가드 코드 자체(주석·plan 문서가 "가드 가족 합류" 로 명시) | 이미 planner 백로그 등재됨. §2 카운트 4건으로, §2.1 에 행 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `TestConnectionResultDto` 가 실제로 응답에 싣는 `code` 필드가 DTO 선언에 없음(과소 선언 — `latencyMs` 과잉 선언과 정반대 방향, 이번 PR 범위 밖 pre-existing gap) | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` vs `spec/2-navigation/4-integration.md §9.1` | 급하지 않음 — 다음 spec/DTO 정합 라운드에서 `code?: string` 추가 또는 §9.1 서술 정정 |
| 2 | rationale_continuity | 가이드의 에러코드 정정 내용(은퇴 코드 제거, `MAKESHOP_404` 치환, 8갈래 문장표)이 기존 Rationale·카탈로그와 전수 대조로 정합 확인됨 — 기각된 대안 재도입 없음 | `run-results/error-handling/integrations/models.mdx`(ko/en) | 조치 불요(양성 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `LLM_RATE_LIMIT` 이중 배치 자기모순 1건 WARNING + `TestConnectionResultDto.code` 미선언 등 INFO 2건(1건은 WARNING#5 와 중복 확인 성격) |
| rationale_continuity | LOW | `nodeName` 잔존 1건 WARNING(§2.2 기결 Rationale 위반) + 기존 이관/정합 확인 INFO 2건 |
| convention_compliance | LOW | 3건 WARNING(§1 카탈로그 공백·§8.3 shape 미문서·가드 카운트 stale) — 전부 developer 가 권한 경계를 지켜 이미 planner 백로그 등재, JSDoc/`<ImplAnchor>`/로케일쌍 등 다수 규약은 정확히 준수 확인 |
| plan_coherence | LOW | `3-error-handling.md §1` 카탈로그 완결성을 겨냥한 plan 3건이 상호 참조 없이 독립 등재 — 절 위치·서브섹션 제안이 서로 어긋남 |
| naming_collision | NONE | 신규 식별자(타입 4종·파일 2개·필드명 정정)는 전부 "지어낸 이름→실재 이름 정정" 성격이라 충돌 표면 자체가 없음. 인접 stale 이슈는 이미 추적 중(신규 아님) |

## 권장 조치사항
1. `run-results.mdx`/`.en.mdx` 엔진-레벨 `<FieldTable>` 에서 `LLM_RATE_LIMIT` 행 제거 (WARNING#1)
2. `run-results.mdx:173`, `run-results.en.mdx:163` 의 `nodeName` → `nodeLabel` 정정 (WARNING#2, §2.2 기결 Rationale 단순 적용)
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `3-error-handling.md §1` 관련 신규 항목에 `spec-update-node-cancellation-shutdown-classification.md`(OAuth) 및 `keyset-cursor-uuid-validation.md`(Background Runs) 로의 상호 포인터 추가 (WARNING#3)
4. planner 턴에서 이미 백로그에 등재된 3건(§1 카탈로그 보강, §8.3 실패 shape, `user-guide-evidence.md §2` 가드 카운트)을 한 번에 처리 (WARNING#3~#5)
5. (급하지 않음) `TestConnectionResultDto` 에 `code?: string` 추가 또는 `spec/2-navigation/4-integration.md §9.1` 서술을 실제 선언에 맞춰 정정 (INFO#1)
