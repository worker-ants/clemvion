# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 완료(전문 확보), CRITICAL 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. WARNING 2건(같은 발단 리뷰의 후속 WARNING 3건 트래커 미등재가 plan_coherence 관점에서 가장 무겁고, 상위 문서 3-way 구현상태 불일치가 cross_spec 관점에서 그 다음) + INFO 4건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 target 자체가 이미 `project-planner` 소유 `--spec` draft 이며, 발견된 문제는 모두 target 의 스코프 결정(무엇을 등재/보류할지)에 관한 것으로 권한 밖 Critical 이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | target 을 촉발한 `review/consistency/2026/09/26/16_14_14` 세션의 `convention_compliance.md` WARNING 4건 중 target 이 처리하는 CRITICAL(ED-AI-19) 외 나머지 4건(①frontmatter status vs 본문 (계획) 3곳 불일치, ②Assistant 에러코드 8종 미등재, ③SSE `event: error` 페이로드 예외 미기재, ④도구 호출 배지 i18n 하드코딩 미등재) 중 ①은 "등재한다"는 의도만 적히고 ②③④는 언급조차 없음 — `spec-draft-nullable-notation-followups.md` 전수 grep 0건으로 실제 미등재 확인 | `plan/in-progress/spec-draft-ed-ai-19-status.md` "안 하는 것" 절 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (planner 후속 트래커), `review/consistency/2026/09/26/16_14_14/convention_compliance.md` | 같은 PR/draft 에서 `spec-draft-nullable-notation-followups.md` 에 ①②③④ 4건을 "planner, 2026-09-26 등재, `--impl-prep 16_14_14` convention_compliance W1~W4" 형식으로 체크리스트 항목 추가. 최소한 target "안 하는 것" 절에 ②③④ 존재를 명시적으로 스코프 밖이라 언급 |
| 2 | cross_spec | draft 적용 후에도 같은 기능(Workflow AI Assistant)을 "전체 구현 완료"로 무조건부 서술하는 두 문서가 그대로 남아 정정 폭 밖에서 3-way 모순 지속 | (target 은 `_product-overview.md` §10.4 행만 수정, 아래 두 문서는 미포함) | `spec/0-overview.md` §6.1 "구현 완료(✅)" 표의 Workflow AI Assistant 행 / `spec/4-nodes/3-ai/_product-overview.md:5,138` "3.1~3.6 AI 기능 모두 구현 완료(✅)" | 이번 PR 스코프 확대는 불필요(원 CRITICAL 은 §10.4 vs §12.2 쌍만 지적했고 draft 는 정확히 그것만 닫음). 다만 `0-overview.md §6.1` 과 `4-nodes/3-ai/_product-overview.md:5,138` 에 ED-AI-19 미구현 각주를 붙이는 후속 정정을 동일 `--impl-prep WARNING 3` 트래커(또는 신규 항목)에 등재 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 미착수 병렬 plan(`ai-agent-tool-connection-rewrite.md` §2)이 ED-AI-19 계열 요구사항 ID 에 "영향 확인" 체크박스를 갖고 있어 향후 착수 시 충돌 가능 지점 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` §2 | 별도 조치 불요. 해당 plan 착수자가 본 draft 병합 이후 상태를 재조회하도록 안내 |
| 2 | convention_compliance | "덧붙일 표기" 예시 스니펫에 이탤릭 마크업(`_..._`)이 산문 설명과 달리 생략됨 | target "변경안" 절 | 실제 반영 커밋에서 `_(미구현 — 계획, [§4-ai-assistant §12.2](...))_ ` 형태로 이탤릭 포함해 ED-DB-05 행과 시각적으로 동일하게 맞출 것 |
| 3 | plan_coherence | target 이 인용한 "`--impl-prep` WARNING 3" 이 실제 `convention_compliance.md` WARNING 개수(4건)·세션 전체 WARNING 합(6건) 어느 쪽과도 일치하지 않음 | target "안 하는 것" 절 | 트래커 등재 시 "WARNING 3" 대신 정확한 파일·섹션 인용(`convention_compliance.md` §1 `status: implemented`…)으로 교체 |
| 4 | naming_collision | 같은 §10.4 표 안에 "미구현 — 로드맵"(ED-DB-05, 기존)과 "미구현 — 계획"(ED-AI-19, target 신규) 두 어휘가 설명 없이 공존 — 실측상 서로 다른 상태 범주(backlog 로드맵 vs 추적 중인 partial 갭)를 정확히 반영한 의도된 구분이라 충돌 아님 | `spec/3-workflow-editor/_product-overview.md` §10.4 표 | 변경 불요. 표 상단/범례에 두 표기가 다른 상태를 가리킨다는 한 줄 각주 추가 시 향후 오인 통일 시도 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target 자체는 정확하나, `0-overview.md §6.1`·`4-nodes/3-ai/_product-overview.md` 가 여전히 "전체 구현 완료" 로 남아 정정 폭 밖 3-way 불일치 지속(WARNING). 미착수 병렬 plan 존재(INFO) |
| rationale_continuity | NONE | 신규 결정 없음, 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 우회 전무. 기존 Rationale 사실을 PRD 표기에 동기화만 함 |
| convention_compliance | NONE | frontmatter 제외 규칙·상태 라이프사이클·plan 명명/frontmatter·앵커 슬러그 전부 정합. 이탤릭 마크업 생략만 INFO |
| plan_coherence | MEDIUM | target 자체는 원 CRITICAL 을 정확히 처리하나, 같은 발단 리뷰의 WARNING 4건 중 3건(에러코드 카탈로그·SSE 봉투 예외·i18n 배지 하드코딩)이 트래커에 실제 등재되지 않고 누락(WARNING). 인용 개수 오류(INFO) |
| naming_collision | NONE | 신규 식별자(요구사항 ID/엔티티/endpoint/이벤트/ENV/파일경로) 전무. 어휘 구분(로드맵 vs 계획) 은 의도된 것으로 확인(INFO) |

## 권장 조치사항
1. (WARNING #1 해소 우선) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `16_14_14` convention_compliance WARNING ①frontmatter status 3곳 불일치·②Assistant 에러코드 8종 미등재·③SSE `event: error` 페이로드 예외 미기재·④도구 호출 배지 i18n 하드코딩 4건을 "planner, 2026-09-26 등재" 형식으로 체크리스트 추가. 트래커 인용은 부정확한 "WARNING 3" 대신 정확한 섹션명 사용(INFO #3 반영).
2. (WARNING #2) 후속 정정으로 `spec/0-overview.md §6.1` Workflow AI Assistant 행과 `spec/4-nodes/3-ai/_product-overview.md:5,138` 에 ED-AI-19 미구현 각주(또는 "실행 중 편집 거부 가드는 계획 단계" 단서)를 추가하는 항목을 위 트래커(또는 신규)에 등재. 이번 PR 자체를 막을 사유는 아님.
3. (INFO) 실제 반영 커밋에서 §10.4 표기에 이탤릭 마크업 포함(ED-DB-05 행과 스타일 통일).
4. (INFO, 선택) §10.4 표에 "로드맵" vs "계획" 어휘 차이를 설명하는 한 줄 각주 추가.
