# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 반환했고, CRITICAL 등급 발견은 없음.

## 전체 위험도
**LOW** — 실질 작업(`terminal-duration-sql-safety-net`, `spec_impact: none`, e2e 세이프넷 신설)은 `spec/5-system/` 을 변경하지 않으며, target 영역 자체는 이미 다수의 과거 라운드를 거쳐 성숙한 상태. WARNING 1건(문서 구조 규약, pre-existing)과 INFO 다수만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `## Overview (제품 정의)` 표준 헤딩 미사용 — `spec/5-system/` 내 6개 파일(`2-api-convention.md`·`5-expression-language.md`·`6-websocket-protocol.md`·`7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md`)이 `## Overview` 대신 바로 `## 1. 개요`(또는 동급)로 시작 | `spec/5-system/2-api-convention.md` L21, `5-expression-language.md` L18, `6-websocket-protocol.md` L26, `7-llm-client.md` L26, `11-mcp-client.md` L19, `16-system-status-api.md` L14 | `CLAUDE.md` "Spec 문서 3섹션 구성" / `project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" | pre-existing(이번 worktree 는 `spec/5-system/` 미변경, `terminal-duration-sql-safety-net` 착수를 막을 사유 아님). 다음에 이 파일들을 편집하는 planner 턴에서 (a) `## Overview (제품 정의)` 헤딩 소급 추가, 또는 (b) "기술 규약/프로토콜 참조" 성격 파일의 예외를 SKILL.md 에 명문화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `9-user-profile.md §4.2` RBAC 요약 표에 `1-auth.md §3.2` SoT 포인터 부재(내용은 현재 정합) | `spec/2-navigation/9-user-profile.md §4.2` ↔ `spec/5-system/1-auth.md §3.2` | `9-user-profile.md §4.2` 상단에 "권한 세부의 SoT 는 [1-auth.md §3.2]" 한 줄 추가 (spec 변경이므로 project-planner 소관) |
| 2 | Rationale Continuity | 직전 라운드가 지적한 R14(토큰 검증 실패 status 통일) drift 는 이미 스펙 본문에 반영·해소됨 | `spec/5-system/14-external-interaction-api.md §Rationale R14` | 조치 불요(기록 목적) |
| 3 | Rationale Continuity | 컨텍스트 예산 절단으로 `4-execution-engine.md`·`6-websocket-protocol.md`·`15-chat-channel.md`·`12-webhook.md` 등의 EIA 인용 정본 문서 전문은 이번 라운드에서 미검증 | 위 파일들 본문(§Rationale 이외) | 해당 파일들 본문에 걸친 구현이 시작되면 좁은 스코프의 `rationale_continuity` 재검토 1회 권고 |
| 4 | Rationale Continuity | `2-api-convention.md`·`3-error-handling.md`·`2-navigation/2-trigger-list.md` 교차 검증 — 정합 확인(에러 코드 매핑, secret rotation 항목 구분 명확) | 해당 문서 각 Rationale | 조치 불요 |
| 5 | Convention Compliance | `_product-overview.md` 는 `## Rationale` 미보유 — 설계대로(위반 아님) | `spec/5-system/_product-overview.md` | 조치 불요(오탐 방지 기록) |
| 6 | Plan Coherence | `1-auth.md` §Rationale `1.1.B-4` 가 "WebAuthn step-up 재인증 일반화는 별도 plan 필요"라 명시했으나, `spec-sync-auth-gaps.md` 를 포함한 어떤 in-progress plan 에도 등재되지 않음 | `spec/5-system/1-auth.md §Rationale 1.1.B-4` | 다음에 `1-auth.md` 를 편집하는 planner 턴에서 `spec-sync-auth-gaps.md` 에 한 줄 추가하거나 `webauthn-stepup-reauth.md` plan 신설 |
| 7 | Plan Coherence | 신규 e2e(`terminal-duration-sql.e2e-spec.ts`)가 `TERMINAL_DURATION_MS_SQL` 을 verbatim 고정 — 동일 트래커의 미해결 "duration_ms 필드 분리" 항목과 향후 결합 가능(정상 test coupling) | `plan/in-progress/terminal-duration-sql-safety-net.md` ↔ `spec-sync-external-interaction-api-gaps.md` "duration_ms 필드 분리" | `terminal-duration-sql-safety-net.md` 완료 시 트래커의 "필드 분리" 미해결 항목 옆에 "이 SQL 은 e2e 세이프넷이 원문 고정 중, 필드 분리 시 함께 갱신" 한 줄 남길 것 |
| 8 | Naming Collision | `1-auth.md §1.5.4` 의 `invitation_*`/`forbidden`/`rate_limited` lower_snake_case 에러 코드는 기존에 이미 조정된 historical-artifact 예외(신규 도입 아님) | `spec/5-system/1-auth.md §1.5.4` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문) + 직접 대조한 6개 관련 spec 에서 CRITICAL/WARNING 급 충돌 없음. INFO 1건(RBAC 요약 표 SoT 포인터 부재). 컨텍스트 예산으로 target 12개·related 94개는 미검증 |
| Rationale Continuity | LOW | EIA 및 관련 Rationale 에서 기각 대안 재도입·무근거 번복 없음. 직전 라운드 지적(R14) 이미 해소 확인. `4-execution-engine.md` 등 truncated 파일은 인용 지점만 대조, 전문 미검증 |
| Convention Compliance | LOW | `spec/conventions/**` 대조 결과 CRITICAL 위반 없음. WARNING 1건(Overview 헤딩 미사용 6개 파일, pre-existing) |
| Plan Coherence | LOW | 진행 중 plan(`terminal-duration-sql-safety-net.md`)과 target 간 결정 충돌·선행 미해소 없음. INFO 2건(WebAuthn step-up plan 미등재, e2e verbatim SQL 결속) |
| Naming Collision | NONE | `spec_impact: none`, `spec/5-system/` diff 0. 신설 e2e 가 쓰는 심볼 전부 기존 SoT(`terminal-duration.ts`) import, 신규 식별자 도입 없음 |

## 권장 조치사항
1. (선택, 차단 아님) 다음에 `spec/5-system/2-api-convention.md` 등 6개 파일을 편집하는 planner 턴에서 `## Overview (제품 정의)` 헤딩 소급 추가 또는 예외 명문화.
2. (선택) `9-user-profile.md §4.2` 에 `1-auth.md §3.2` SoT 포인터 한 줄 추가 (project-planner 소관).
3. (선택) `1-auth.md` WebAuthn step-up 재인증 일반화를 `spec-sync-auth-gaps.md` 또는 신설 plan 에 등재.
4. (선택) `terminal-duration-sql-safety-net.md` 완료 시 트래커의 "duration_ms 필드 분리" 항목에 e2e 결속 메모 추가.
5. 이번 작업(`terminal-duration-sql-safety-net`, `spec_impact: none`)은 구현 착수를 진행해도 무방함 — CRITICAL 없음, BLOCK: NO.