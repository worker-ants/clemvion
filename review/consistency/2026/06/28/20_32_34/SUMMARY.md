# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — Warning 1건(naming_collision: `serviceType` vs `service` 필드명 비일관성), 나머지 4개 checker 전원 NONE. 모두 블로킹 미해당.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 동일 §9.2 API 표 내 `preview-test` body 가 `serviceType` 을 쓰고 `oauth/begin` body 가 동일 개념에 `service` 를 계속 사용 — 독자 혼동 유발 가능 | `spec/2-navigation/4-integration.md §9.2` line 809 (`preview-test` 행) | 동일 파일 line 804 (`oauth/begin` 행, `OAuthBeginDto.service`) | §9.2 표에 "※ `oauth/begin` 은 `service` 필드(OAuthBeginDto), `preview-test` 는 `serviceType` 필드(PreviewTestDto) — 동일 개념이나 두 DTO 가 독립적으로 발전해 필드명이 다름" 인라인 노트 추가. `OAuthBeginDto.service` rename 은 별도 breaking-change PR 범위. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `error-codes.md` 미등재 결정이 해당 문서 자기 선언(명명 규율 전용·§3=명명 위반 예외만)과 완전 일치 | draft §"error-codes.md 미등재 결정" | 추가 조치 불필요 |
| 2 | cross_spec | `preview-test` body `serviceType` 과 `oauth/begin` body `service` 는 별도 DTO — 모순 없음 | `spec/2-navigation/4-integration.md §9.2` | 추가 동기화 불필요 |
| 3 | cross_spec | `spec/5-system/11-mcp-client.md` 는 `preview-test` request body 필드명 미명시 — `serviceType` 정정 파급 없음 | `spec/5-system/11-mcp-client.md` lines 456, 522 | 추가 동기화 불필요 |
| 4 | rationale_continuity | `error-codes.md` 미등재 결정이 Rationale "왜 SoT 를 분리하는가" 및 §3 흡수 조건과 완전 정합 | draft §"error-codes.md 미등재 결정" + `spec/conventions/error-codes.md` Rationale | 추가 조치 불필요 |
| 5 | rationale_continuity | `service` → `serviceType` 은 코드 SoT(`PreviewTestDto`) 맞춤 오탈자 교정 — 별도 Rationale 항 불요. 단 §9.2 표 비고에 한 줄 명시 가능 | `spec/2-navigation/4-integration.md §9.2` | 선택적 개선 (필수 아님) |
| 6 | convention_compliance | draft 임시 파일에 plan-lifecycle §4 필수 frontmatter(`worktree`/`started`/`owner`) 부재 — 단 파일 본문에 "커밋 없이 폐기" 의도 명시, build gate 충돌 위험 낮음 | `plan/in-progress/spec-draft-m1-integration-errorcode.md` 최상단 | 커밋 전 폐기 또는 frontmatter 추가 |
| 7 | convention_compliance | `INTEGRATION_INVALID_SERVICE` 명명: UPPER_SNAKE_CASE·도메인 prefix·의미 기반 명명 전부 준수 | `spec/2-navigation/4-integration.md §9.4` | 추가 조치 불필요 |
| 8 | plan_coherence | `error-codes.md` 미등재 결정이 원래 plan 노트("planner 확인 요청") 표현과 달라지나, 02-architecture.md §m-1 `[x]` 인라인 주석에 정당화 근거 기재 — 추적 가능 | `plan/in-progress/refactor/02-architecture.md §m-1` | 추가 조치 불필요 |
| 9 | naming_collision | `INTEGRATION_INVALID_SERVICE` 가 §9.4 기존 `INTEGRATION_*` 코드들과 의미 영역 겹침 없음 | `spec/2-navigation/4-integration.md §9.4` | 충돌 없음 |
| 10 | naming_collision | `error-codes.md §3` 미등재 결정: `INTEGRATION_INVALID_SERVICE` 는 §1 준수 정상 코드라 historical-artifact 레지스트리 대상 아님 | `spec/conventions/error-codes.md §3` | 충돌 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 두 변경 모두 다른 spec 영역과 충돌 없음. error-codes.md 미등재 결정 정확. |
| rationale_continuity | NONE | 기존 Rationale 에서 기각된 대안 재도입 없음. Rationale 연속성 강하게 유지. |
| convention_compliance | NONE | 에러 코드 명명 전 규약 준수. draft 파일 frontmatter 부재는 임시 파일 특성상 실위험 낮음. |
| plan_coherence | NONE | plan `[x]` 완료 마킹과 실제 spec 반영 일치. 다른 in-progress plan 과 충돌 없음. |
| naming_collision | LOW | `serviceType` vs `service` 동일 개념 다른 필드명 비일관성이 spec 에 가시화. 기존 DTO 설계에서 비롯된 것으로 target 변경이 새로 만든 문제가 아님. |

## 권장 조치사항

1. (WARNING 해소) `spec/2-navigation/4-integration.md §9.2` 의 `preview-test` 행 또는 `oauth/begin` 행에 인라인 노트 추가: "※ `oauth/begin` 은 `OAuthBeginDto.service`, `preview-test` 는 `PreviewTestDto.serviceType` — 동일 개념이나 두 DTO 독립 발전으로 필드명 상이함". 블로킹 아님이나 추후 독자 혼동 예방.
2. (INFO, 선택적) `plan/in-progress/spec-draft-m1-integration-errorcode.md` 는 커밋 전 삭제 또는 `plan/complete/` 이동 처리. 커밋 의도 없음이 본문에 명시돼 있으면 현 상태 유지 가능.
3. (INFO, 선택적) `spec/2-navigation/4-integration.md §9.2` Rationale 에 "preview-test `serviceType` 은 코드 SoT(`PreviewTestDto`) 맞춤 교정, `oauth/begin` `service` 는 별도 DTO" 한 줄 명시 — 미래 혼동 예방.
