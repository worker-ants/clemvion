# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — refactor M-6 서비스 계층 ConfigService 중앙화에 따른 spec 표기 동기화. 기능 충돌 없음, 명명 비일관성 및 plan 체크박스 갱신 누락 수준.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `1-auth.md §Rationale Production fail-closed 가드`가 raw env 변수명 표기 유지 — 세 변경 파일과 표기 방식 불일치 (기능 충돌 아님) | `spec/5-system/1-auth.md §Rationale` L645~668 | 하단에 `(refactor M-6 이후 각 플래그는 ConfigService namespace 경유 — mcp.*, llm.*, oauth.*)` 한 줄 주석 추가 또는 namespace 표기 병기. 별도 작업 단위 처리 가능 |
| 2 | Cross-Spec | `14-external-interaction-api.md §8.3` "셋 다 미설정" 표현이 현재 2-source 기술과 불일치 | `spec/5-system/14-external-interaction-api.md §8.3` L661~662 | "두 source(`INTERACTION_JWT_SECRET`, `JWT_SECRET`) 모두 미설정이면" 으로 수정 또는 구 3-source 구조 주석 제거 |
| 3 | Rationale Continuity | `14-external-interaction-api.md §8.3` "셋 다 미설정" 문맥 — 새 2-tier 표현에서 "셋"의 지칭 대상이 명시적이지 않음 (의미 일관성은 유지됨) | `spec/5-system/14-external-interaction-api.md §8.3` L661 | "두 env 모두 미설정이면 dev ephemeral 로 폴백" 식으로 L661 함께 갱신 권장 |
| 4 | Rationale Continuity | 3개 파일에 분산된 refactor M-6 env 접근 중앙화 근거 — 공통 Rationale 항목 부재 | `spec/5-system/11-mcp-client.md`, `7-llm-client.md`, `14-external-interaction-api.md` 인라인 주석 | `spec/0-overview.md` 또는 `spec/conventions/` 에 공통 Rationale 항목으로 통합하면 향후 동일 패턴 조각화 방지 |
| 5 | Convention Compliance | `11-mcp-client.md`, `7-llm-client.md` `## Overview` 섹션 부재 (이번 PR 도입 위반 아님, 기존 상태) | `spec/5-system/11-mcp-client.md`, `spec/5-system/7-llm-client.md` 상단 | 향후 대규모 개정 시 `## Overview` 섹션 분리 |
| 6 | Convention Compliance | `16-system-status-api.md` `## Overview` 섹션 누락 (이번 diff 외 기존 파일) | `spec/5-system/16-system-status-api.md` | 향후 개정 시 Overview 섹션 추가 권장 |
| 7 | Convention Compliance | `10-graph-rag.md` 문서 구조 4단 중첩 (Overview/본문/Rationale 3섹션 권장과 불일치, 기존 상태) | `spec/5-system/10-graph-rag.md` | 향후 개정 시 3단 분리 권장. 이번 PR 범위 밖 |
| 8 | Plan Coherence | `plan/in-progress/refactor/02-architecture.md` M-6 "planner spec-sync (7-llm-client.md §7.1)" 체크박스가 `[ ]`(미완료)이나 spec 본문은 이미 갱신 완료 | `plan/in-progress/refactor/02-architecture.md` L288 | 체크박스를 `[x]` 로 갱신 후 다음 단계(`/ai-review`) 진행 |
| 9 | Plan Coherence | `11-mcp-client.md` refactor M-6 동기화 완료이나 plan 체크리스트에 `mcp` 미열거 (`llm/oauth/EIA`만) | `plan/in-progress/refactor/02-architecture.md` L290 | `--impl-done` 실행 시 mcp 변경도 diff-base 에 포함됨 — 추가 항목 신설 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `1-auth.md §Rationale` raw env 표기 잔재(INFO), `14-EIA.md §8.3` "셋 다" 표현 비일관성(INFO). 기능 충돌 없음 |
| Rationale Continuity | NONE | 3개 파일 변경 모두 기존 Rationale 와 충돌 없음. "셋 다" 문맥 표현 명확화 권장(INFO) |
| Convention Compliance | NONE | 변경 파일 3개 모두 규약 위반 없음. Overview 섹션 누락은 기존 파일 상태(INFO) |
| Plan Coherence | LOW | `7-llm-client.md §7.1` spec 갱신 완료이나 plan 체크박스 미완료(INFO). 운영 차단 아님 |
| Naming Collision | NONE | 신규 namespace(`mcp`, `oauth`, `interaction`), 타입명, 파일 경로 모두 기존과 충돌 없음 |

## 권장 조치사항

1. (즉시 — plan 정합) `plan/in-progress/refactor/02-architecture.md` L288 체크박스를 `[x]` 로 갱신.
2. (권장 — 표기 동기화) `spec/5-system/14-external-interaction-api.md §8.3` L661 "셋 다 미설정이면" 을 "두 env(`INTERACTION_JWT_SECRET`, `JWT_SECRET`) 모두 미설정이면" 으로 수정.
3. (선택 — 표기 동기화) `spec/5-system/1-auth.md §Rationale Production fail-closed 가드` 하단에 ConfigService namespace 경유 한 줄 주석 추가.
4. (선택 — 향후) refactor M-6 env 중앙화 근거를 `spec/0-overview.md` 또는 `spec/conventions/` 공통 Rationale 항목으로 통합.
5. (향후 — 구조) `spec/5-system/` 파일 대규모 개정 시 `## Overview` 섹션 분리.