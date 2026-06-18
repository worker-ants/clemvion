# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 구현 자체의 spec 충돌 없음. 미등록 explicit code passthrough 정책이 spec 본문에 명시되지 않아 소규모 spec 정밀화 권장.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | 미등록 explicit code passthrough 테스트가 §10 "단일 LLM taxonomy 유지" 원칙과 부분 긴장 — passthrough 허용 범위(미등록 vendor 코드 포함)가 Rationale 에 미기록 | `ai-turn-orchestrator.service.spec.ts` 신규 테스트 (`LLM_PROVIDER_QUOTA` passthrough 케이스) | `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099` Rationale — "단일 LLM taxonomy 유지" | `§10 Rationale` 에 "미등록 explicit code 도 passthrough 허용 — retryable=false 강제" 결정 명시; 또는 미등록 코드를 `LLM_CALL_FAILED` 로 재매핑하도록 구현 수정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `LLM_API_ERROR`, `LLM_PROVIDER_QUOTA` 가 §10 표에 미등재 — passthrough 계약이 표에서 도출되지 않아 독자 혼동 가능 | spec §10 표 | §10 표/L1099 blockquote 에 passthrough 문구 추가 (project-planner) |
| 2 | Rationale Continuity | `details.status=429` 가 있어도 `LLM_RATE_LIMIT` 이 아닌 결과되는 이유(`extractHttpStatus` 가 top-level `.status` 만 읽음)가 spec 미기록 | §10 L1099 | "HTTP status 판단은 top-level `.status` 기준, `details.status` 무시" 한 줄 추가 |
| 3 | Plan Coherence | `c1-engine-split.md §후속 고려` L134–135 "passthrough 정규화 테스트 보강" 구현 완료됐으나 plan 완료 표기 없음 | plan §후속 고려 L134–135 | 완료 메모 추가 |
| 4 | Plan Coherence | §10 L1099 미등록 코드 passthrough 정책이 spec 본문 미명시 | 신규 테스트 | §10 L1099 주석에 한 줄 추가 (planner 위임) |
| 5 | Naming Collision | `LLM_API_ERROR` 픽스처가 등록 코드로 오해 여지 (실제 충돌 없음) | 픽스처 | 필요시 명확한 임의 문자열로 교체 (강제 불요) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 미등록 에러 코드 2종이 §10 표에 없어 passthrough 계약이 표로부터 도출 불가 (구현 충돌 아님, 문서 불완전성) |
| Rationale Continuity | LOW | 미등록 코드 passthrough 허용 범위가 §10 Rationale 미기록 |
| Convention Compliance | NONE | 규약 위반 없음 |
| Plan Coherence | LOW | c1-engine-split.md 후속 항목 완료 표기 누락. spec passthrough 정책 미명시 |
| Naming Collision | NONE | 신규 식별자 의미·표기 충돌 없음 |

## 권장 조치사항

1. (WARNING 해소 — planner) `spec/4-nodes/3-ai/1-ai-agent.md §10 Rationale` 에 "미등록 explicit code passthrough 허용 — retryable=false 강제" 결정 명시. developer 트랙이면 project-planner 위임.
2. (INFO 1·4 통합) §10 L1099 blockquote 에 "(a) §10 표 밖 미등록 explicit code 도 passthrough(retryable=false), (b) HTTP status 는 top-level `.status` 기준" 추가. 1번과 동일 spec PR 로 묶기 가능.
3. (INFO 3) `c1-engine-split.md §후속 고려` 완료 메모 추가.
4. (INFO 5 — 선택) 픽스처 코드를 명확한 임의 문자열로 교체.

> **item 2 disposition**: Warning/INFO 1·2·4 는 **spec-side SPEC-DRIFT**(impl 의 미등록-code passthrough 는 pre-existing 행위 — 기존 테스트가 이미 LLM_API_ERROR retryable:false 로 간접 검증) → §10 Rationale enrichment 는 **planner 위임**(developer spec read-only). impl·test 무변(행위변경=범위밖, test=재무장 회피+기존행위 정합). INFO 3 → plan 완료표기. BLOCK:NO.
