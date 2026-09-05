# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 CRITICAL 을 보고하지 않았다. 전문 확보 실패 checker 없음(전원 success + 인라인 전문 확보, 디스크 파일도 이미 존재 확인).

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(영역 내 `## Overview` 절 유무 불일치, plan 잔여 체크리스트 항목이 이미 해소된 target 을 여전히 미해소로 지목)은 모두 실행 가능한 소규모 정정 대상.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/` 내 `## Overview` 섹션 유무가 파일마다 불일치 — 12개 파일은 공유 `_product-overview.md` 와 별개로 로컬 `## Overview` 를 두는데 6개 파일(`2-api-convention.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md`)은 없음 | `spec/5-system/2-api-convention.md` 외 5개 파일 frontmatter 직후 | `.claude/skills/project-planner/SKILL.md` 3섹션(Overview/본문/Rationale) 관례, `spec/5-system/_product-overview.md` | (a) 6개 파일에 로컬 Overview 1~2문단 추가해 영역 내 일관성 맞추거나, (b) `project-planner/SKILL.md` 에 "영역 공유 Overview 존재 시 파일별 로컬 Overview 권장/생략 여부" 명시. CLAUDE.md 상 "권장" 항목이라 CRITICAL 아님 |
| 2 | Plan Coherence | `spec-conventions-engine-error-code-surface.md` 의 미체크 항목이 지목한 3곳 중 2곳(`spec/5-system/3-error-handling.md` §1.4, `spec/1-data-model.md:474`)이 같은 plan 문서의 바로 위 체크 완료 항목·실측 확인 결과 **이미 해소**됐는데도 여전히 "미해소"로 남아 있음 | `spec/5-system/3-error-handling.md` §1.4 (이미 앵커 열 보유), `spec/1-data-model.md:474` (이미 등재처별 구분 서술) — target 자체는 문제 없음 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` 잔여 체크리스트 하위 불릿 | plan 쪽의 해당 불릿에서 두 spec 파일 하위 항목을 제거하거나 "해소됨 — `spec-draft-scope-and-anchor-drift.md ④` 참조"로 갱신하고, 잔여 범위를 `codebase/backend/src/nodes/core/error-codes.ts` `EngineErrorCode` JSDoc(122행) 한 곳으로 좁힐 것. 방치 시 다음 착수자가 이미 고쳐진 spec 을 재편집해 중복 작업 유발 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 프롬프트 예산 초과로 `4-execution-engine.md`, `6-websocket-protocol.md`, `14-external-interaction-api.md`, `15-chat-channel.md` 등 15개 파일은 표본 교차 참조만 수행, 전문 통독 미완료 | `spec/5-system/` 절단된 15개 파일 | 해당 파일에 실제 draft 변경이 생기는 다음 라운드에서 변경 절 주변을 전문 통독 스코프로 지정 |
| 2 | Rationale Continuity | §7 Rate Limiting 표 "인증 API(IP 기준)" 행과 각주("인증 보호 라우트는 사용자 기준") 문면이 상충해 보임(실제 구현 대조 결과 모순 아님 — "인증 API"=미인증 단계 엔드포인트, "인증 보호"=JWT 보호 라우트로 용어가 다름) | `spec/5-system/2-api-convention.md` §7 표 및 각주 | 각주에 "(로그인·회원가입 등 인증 API 행 자체는 미인증 상태라 IP 폴백 대상, 그 외 JWT 보호 라우트가 사용자 기준)" 한 구절 추가 |
| 3 | Convention Compliance | 프롬프트 예산 초과로 15개 파일(`4-execution-engine.md` 외) 이번 라운드 미검증 | `spec/5-system/` 절단 파일 전체 | 구현 대상 코드 경로와 겹치는 파일만 후속 라운드에서 별도 `Read` 로 좁혀 검증 |
| 4 | Plan Coherence | `status: implemented` 인 `10-graph-rag.md`, `8-embedding-pipeline.md` 가 `spec-impl-evidence.md §3` 규정과 달리 `pending_plans:` 를 비우지 않고 `update-returning-tuple-shape.md` 를 계속 나열(빌드 가드는 `implemented`/`archived` 상태엔 미검사라 안 깨짐) | `spec/5-system/10-graph-rag.md`, `spec/5-system/8-embedding-pipeline.md` frontmatter | `pending_plans:` 를 비우거나, "구현 완료 후에도 남는 cross-cutting 추적"용 예외를 `spec-impl-evidence.md §3` 에 명시. `update-returning-tuple-shape.md` complete 이동 시 이 정리를 그 plan 의 후속 항목으로 등재 권장 |
| 5 | Naming Collision | `PATCH /notifications/:id/read` 가 §12.1(Boolean 토글 필드 패턴)과 §2.2 신규 "자원 액션"(전용 동사 경로) 두 명명 패턴의 경계에 걸쳐 있음(문서 스스로 인지·판정 보류 중, 신규 충돌은 아님) | `spec/5-system/2-api-convention.md` §12.1 vs §2.2 | 향후 `is_read` 류 필드에 신규 전용 액션 엔드포인트를 추가하는 plan 은 이 각주를 인용해 어느 패턴을 따르는지 명시하도록 권고 |
| 6 | Naming Collision | 초대(invitation) 에러 코드의 `lower_snake_case`(`invitation_not_found` 등)는 전역 `UPPER_SNAKE_CASE` 규약과 표기가 다르나 `error-codes.md §3` historical-artifact 레지스트리에 "초대 API 한정" 예외로 이미 등재된 기존 항목 — 신규 충돌 아님 | `spec/5-system/1-auth.md` §1.5.4 | 조치 불요. 신규 코드 작성 시 이 lowercase 표기를 선례로 삼지 말라는 문구 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 전문 검토 3개 파일(1-auth/2-api-convention/3-error-handling) + 표본 교차추적 전 영역에서 CRITICAL/WARNING 없음. RBAC·에러코드·데이터모델 모두 정합. 15개 파일 미통독 한계만 INFO |
| Rationale Continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. §7 표기상 모호함(실제 무모순) 1건만 INFO |
| Convention Compliance | LOW | 명명·출력포맷·에러코드·frontmatter 스키마 전반 높은 준수도. `## Overview` 유무 불일치 1건 WARNING(CLAUDE.md "권장" 항목이라 비-CRITICAL) |
| Plan Coherence | LOW | 30여 개 관련 plan 대조 결과 target-vs-plan 충돌(CRITICAL) 없음. 이미 해소된 spec 을 미해소로 지목하는 stale plan 체크리스트 1건 WARNING |
| Naming Collision | NONE | 최근 2개 커밋 diff 상 신규 식별자 도입 0건(전부 기존 표면 재분류/명시화). 표면상 동일 에러코드는 문서가 명시적으로 "별개 표면" 각주로 구분 — 실질 충돌 없음 |

## 권장 조치사항

1. `plan/in-progress/spec-conventions-engine-error-code-surface.md` 잔여 체크리스트에서 이미 해소된 두 spec 항목(§1.4 앵커 열, `1-data-model.md:474`)을 제거/갱신하고 잔여 범위를 `error-codes.ts` JSDoc 한 곳으로 좁힌다 (WARNING #2, 다음 착수자의 중복 작업 방지).
2. `spec/5-system/` 의 `## Overview` 절 유무를 6개 파일 기준으로 통일하거나, `project-planner/SKILL.md` 에 공유 Overview 존재 시 로컬 Overview 요구 여부를 명시한다 (WARNING #1).
3. (선택) `10-graph-rag.md`/`8-embedding-pipeline.md` 의 `pending_plans:` 정리 또는 예외 규정 추가, §7 Rate Limiting 각주 명확화 — 둘 다 INFO 로 당장 차단 사유 아님, 여유 있을 때 처리.
