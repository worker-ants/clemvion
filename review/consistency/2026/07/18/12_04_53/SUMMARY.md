# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 사전 경고 — 리뷰 payload 번들링 결함 (harness, 이미 추적 중)

5개 checker 중 3개(rationale_continuity, convention_compliance, plan_coherence)가 독립적으로
동일한 문제를 보고했다: 이번 세션에 전달된 "Target 문서" 페이로드가 `spec/conventions/` 를
alphabetic 순회하며 번들링하다가 `cafe24-api-catalog/**` (222개 field-level 파일) 대용량 덤프에
예산이 소진되어, **이번 작업의 실제 target인 `spec/conventions/interaction-type-registry.md` 를
전혀 포함하지 못하고** `audit-actions.md` + `cafe24-api-catalog/**` 무관 내용으로 완전히 치환됐다.

이는 신규 결함이 아니라 `plan/in-progress/interaction-type-guard-comment-false-negative.md`
후속 항목 "[harness, 비차단]" 으로 이미 추적 중인 known failure pattern 이며, 이번 호출에서
"일부 누락"이 아니라 "target 전체 치환" 수준으로 재현되었다(plan_coherence 신규 관찰 — 심각도
격상 권장).

각 checker 는 이를 우회해 worktree 파일시스템을 직접 조사(`git diff`, 실제 spec/plan 파일 Read)했고,
그 결과 **5개 checker 전원이 전문을 확보**했으므로(재시도 필요 checker 없음) 이 보고서의 BLOCK
판정은 유효하다. 다만 번들러 자체는 여전히 고쳐야 할 결함으로 남아 있다.

## 전체 위험도
**LOW–MEDIUM** — Critical 없음. 실제 target(`interaction-type-registry.ts` 의 "grep 가드"→"AST 가드"
주석 정정)은 spec Rationale 과 완전히 정합. 우발 포함된 `audit-actions.md`/`cafe24-api-catalog`
서브트리에서 실 규약 위반(WARNING) 1건 + 리뷰 프로세스 자체의 harness 결함(WARNING) 1건 + plan
체크박스 미갱신(WARNING) 1건 발견.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 리뷰 payload 번들러가 실제 target(`interaction-type-registry.md`)을 100% 치환 — known harness 결함의 심화 재현 | 본 호출 "Target 문서" 전체 | `plan/in-progress/interaction-type-guard-comment-false-negative.md` 라인 125-128 `[harness, 비차단]` | 이미 등재된 항목에 "일부 누락"이 아니라 "target 전체 치환"까지 발생함을 추가 기록. 번들러의 파일 선택/크기 예산 로직 점검(카탈로그 서브트리 파일수·depth 상한 등) 우선순위 상향 권장 |
| 2 | plan_coherence | plan 후속 체크박스가 실제 구현 완료 상태를 반영 못함 (미체크 상태로 커밋 예정) | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (JSDoc 3곳), `interaction-type-exhaustiveness.test.ts` (fixture 보강) — 둘 다 미커밋 작업트리 변경 | `plan/in-progress/interaction-type-guard-comment-false-negative.md` 라인 118, 121 (`[developer, 선택]` `- [ ]`) | 이번 커밋에 라인 118·121 을 `[x]` 로 갱신 + 해소 근거 기록. `.claude/docs/plan-lifecycle.md` 관례("체크박스=실제 상태, 수행 후 같은 커밋에 포함")에 따름 |
| 3 | convention_compliance | 검증 규칙 번호 오인용 (규칙8 → 규칙9) | `spec/conventions/cafe24-api-metadata.md:119`, `:373` (둘 다 "검증 규칙 8 참고") | `spec/conventions/cafe24-api-catalog/_overview.md §4` — 규칙8="planned row↔planned.ts mirror", 규칙9="restricted 컬럼↔restrictedApproval 동기(level='program' 제외 포함)" | `cafe24-api-metadata.md:119,373` 의 "검증 규칙 8" → "검증 규칙 9" 로 정정 (`spec/` 쓰기 권한은 project-planner 소관) |
| 4 | naming_collision | `store` resource 의 `privacy_*` id 접두어가 별도 `privacy` resource 와 프리픽스 오인 소지 (target 문서가 이미 인지·defer, 미해결) | `spec/conventions/cafe24-api-catalog/store.md` 의 `privacy_*` id | `spec/conventions/cafe24-api-catalog/privacy.md` (독립 top-level resource) | `_overview.md §5` 각주에 이미 follow-up 트랙으로 defer 명시됨 — 블로커 아님. `store` field-level 문서 후속 배치 시 "이 id 는 privacy resource 아님" 명시 재확인 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 실제 diff(`interaction-type-registry.ts` "grep 가드"→"AST 가드" 주석 3곳)는 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 충돌 어느 것도 아님. spec §5 Rationale 이 이미 확정한 "AST 가드" 용어에 코드 주석을 뒤늦게 맞추는 순수 wording 동기화이며, 실제 가드 구현(`ts.createSourceFile` AST 순회)과도 일치 | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`, `spec/conventions/interaction-type-registry.md §1.2/§2.1/§5` | 조치 불요 — 참고 기록 |
| 2 | cross_spec | `scope` 필드/컬럼명이 Cafe24 OAuth 스코프(read/write)와 Integration 공유범위(개인/조직)로 중복 사용, 이미 문맥상 낮은 혼동 위험 | `spec/conventions/cafe24-api-catalog/_overview.md §2` vs `spec/1-data-model.md §2.10` | 필요 시 `_overview.md §2` 표에 각주 1줄 추가 (선택) |
| 3 | cross_spec | `status: planned` 값이 카탈로그(엔드포인트 미구현)와 spec frontmatter lifecycle(spec-impl-evidence.md) 두 도메인에서 재사용, 이미 §3 표에서 부분 disambiguate | `spec/conventions/cafe24-api-catalog/_overview.md §3` | 현행 유지, 대칭 주석 추가는 선택 |
| 4 | convention_compliance | `_overview.md §2` 의 `id` 컬럼 명명 규칙 예시(`product_list` 등)가 `application.md`/`category.md` 등 실제 다수 카탈로그의 sub-resource 기반 명명 패턴을 대표 못함 (강제 가드 없음) | `spec/conventions/cafe24-api-catalog/_overview.md §2` | 이질적 sub-resource 파일 예시 추가 또는 "resource가 entity 단위를 가리킬 수 있음" 명시 (선택) |
| 5 | convention_compliance | field-level entity id 의 `__`(이중 언더스코어) 표기(`categories__decorationimages.md`)가 §7.1 명명 규칙 본문에 미문서화 | `spec/conventions/cafe24-api-catalog/_overview.md §7.1` | "중첩 anchor(`--`)는 파일명에서 `__`로 치환" 한 줄 추가 (선택) |
| 6 | naming_collision | frontmatter 키 `entity:` (Cafe24 sub-resource 식별자)가 `spec/1-data-model.md` Graph RAG `Entity` 모델과 용어(토큰) 중복, 코드 노출 없어 실질 충돌 없음 | `spec/conventions/cafe24-api-catalog/<resource>/<entity_id>.md` frontmatter vs `spec/1-data-model.md §2.12.2` | 조치 불요(선택적으로 `sub_resource:` 리네임 고려 가능하나 비용 대비 실익 낮음) |
| 7 | plan_coherence | 우발 포함된 target(`audit-actions.md`, `cafe24-api-catalog`) 자체는 관련 plan(`cafe24-backlog-residual.md` G-1~G-4)과 완전히 정합, 실질 충돌 없음 | `spec/conventions/audit-actions.md §3`, `_overview.md §5` Coverage Matrix | 조치 불요 — 참고 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | scope/status 용어 저강도 중복 2건(INFO), 나머지 6개 교차검증 항목 전부 일치 확인 |
| rationale_continuity | NONE | 실제 diff는 spec Rationale 과 완전 정합인 순수 용어 정정, 위반 없음 |
| convention_compliance | LOW | 규칙 번호 오인용 1건(WARNING), 명명 규칙 문서화 갭 2건(INFO), 번들링 결함(INFO) |
| plan_coherence | MEDIUM | payload 100% 치환(harness, WARNING), plan 체크박스 미갱신(WARNING); 실제 구현은 plan 후속 항목과 정확히 일치 |
| naming_collision | LOW | privacy_* 프리픽스 오인 소지(이미 defer, WARNING), entity: 용어 중복(INFO); application↔app_type 은 모범적으로 선제 disambiguate 확인 |

## 권장 조치사항

1. (WARNING #2, BLOCK 무관이나 lifecycle 준수 필수) 이번 커밋에 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 라인 118·121 체크박스를 `[x]` 로 갱신 — plan 관례("체크박스=실제 상태, 같은 커밋에 포함") 위반 방지.
2. (WARNING #3) `spec/conventions/cafe24-api-metadata.md:119,373` 의 "검증 규칙 8" → "검증 규칙 9" 오인용 정정 (project-planner 소관, 이번 target 과는 별도 spec 편집 필요).
3. (WARNING #1, 프로세스 개선) consistency-check 오케스트레이터의 target 번들링 로직에 `cafe24-api-catalog/**` 파일수/depth 상한 캡핑 도입 검토 — 이번처럼 실제 target 이 100% 치환되는 재발을 방지. `plan/in-progress/interaction-type-guard-comment-false-negative.md` 해당 항목에 심각도 격상 기록.
4. (WARNING #4, 비차단) `store` resource `privacy_*` id 프리픽스 오인 소지는 기존 defer 트랙 유지, 후속 배치 시 명시 주석만 추가.
5. INFO 항목들은 모두 선택적 문서 명확성 개선이며 이번 target 승인을 막지 않음.
