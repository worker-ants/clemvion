# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**CRITICAL** — `spec/data-flow/8-notifications.md §1.1` 의 `integration_expired` 발사 조건이 `spec/2-navigation/4-integration.md §11` 과 정반대로 기술되어 있음. 동일 스캐너 로직에 대해 두 문서가 상충하는 정의를 가지고 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `integration_expired` 발사 조건 직접 모순 — target 은 refresh-capable provider(cafe24·makeshop)를 7d/3d/0d 알림 전부 제외하나, notifications spec 은 "refresh_token 보유 provider 도 발사 대상" 이라고 기술 | `spec/2-navigation/4-integration.md` §11, §11.2, 의사코드 블록 | `spec/data-flow/8-notifications.md` §1.1 `integration_expired` 행 | `spec/data-flow/8-notifications.md §1.1` 의 `integration_expired` 행을 target 정의에 맞춰 갱신. "후보 필터에서 `isRefreshCapable` provider 제외 (7d/3d/0d 임계 알림 모두 미발사), refresh_token 없는 provider 만 발사 대상" 으로 수정 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 해소된 구현 갭 주석 잔존 — `spec/data-flow/5-integration.md §1.4` Rationale 에 "V-01·V-07 fix 로 해소" 라고 명시됐으나 §2.2 큐 카탈로그 `makeshop-token-refresh` 행의 괄호 주석이 "스캐너 0d 격하 제외 분기도 아직 없음" 상태로 남아 있어 §1.4 와 모순 | `spec/data-flow/5-integration.md` §2.2 `makeshop-token-refresh` 행 | `spec/data-flow/5-integration.md` §1.4 Rationale | 해당 괄호 주석을 삭제하거나 "해소됨 — §1.4 Rationale 참조" 로 교체 |
| 2 | Cross-Spec | cafe24 §8.6 근거 단락이 `§11.1 cafe24 분기` 로 참조하고 있어 `isRefreshCapable` 일반화(cafe24+makeshop)를 반영하지 않음 | `spec/4-nodes/4-integration/4-cafe24.md` §8.6 | `spec/2-navigation/4-integration.md` §11.1 | §8.6 참조를 "§11.1 `isRefreshCapable` 분기" 로 업데이트 |
| 3 | Convention-Compliance | `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)` 내부 `### 1~3` 번호와 본문 `## 1~7` 번호가 중복되어 3섹션 구조 모호화, 앵커 링크 충돌 위험 | `spec/2-navigation/14-execution-history.md` 라인 18~91 (`## Overview`) 및 라인 92 (`## 1. 개요`) | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | Overview 내부 소절을 번호 없이(`### 개요` 등) 또는 `### O-1` 등 별도 prefix 로 구분 |
| 4 | Convention-Compliance | `spec/2-navigation/14-execution-history.md` — `## Rationale` 섹션 누락. 설계 근거가 본문 인라인에만 분산 | `spec/2-navigation/14-execution-history.md` 말미 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` | 파일 말미에 `## Rationale` 절 추가; Re-run chain·LLM Usage 탭 평탄화 등 설계 결정 근거 이전 |
| 5 | Convention-Compliance | `spec/2-navigation/16-agent-memory.md` — frontmatter `id: nav-agent-memory` 가 basename 기반 권장(`agent-memory`)에서 이탈 | `spec/2-navigation/16-agent-memory.md` 라인 2 | `spec/conventions/spec-impl-evidence.md §2.1` | `id: agent-memory` 로 수정하거나, 의도적 이탈이라면 Rationale 에 근거 기록 |
| 6 | Naming-Collision | `token_expired` (DB `status_reason` 슬러그)가 기존 JWT 만료 REST 에러 코드 `TOKEN_EXPIRED` 및 계획 중인 WS 이벤트 `auth.token_expired` 와 표기 유사 — 코드 검색·로그 분석 시 혼동 가능 | `spec/1-data-model.md` `status_reason` 컬럼 (별개 네임스페이스 주석 이미 추가됨) | `spec/5-system/3-error-handling.md` `TOKEN_EXPIRED` 행; `spec/5-system/6-websocket-protocol.md:739` `auth.token_expired` | `spec/5-system/3-error-handling.md` 에러 코드 표에도 동일 크로스-링크 추가 권장 (필수 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/5-integration.md §3.4` 상태 전이 설명에서 `expired` 경로를 "(refresh-capable cafe24 제외)" 로 표기해 makeshop 누락 | `spec/data-flow/5-integration.md` §3.4 | "(refresh-capable provider 제외 — cafe24·makeshop, §1.4)" 로 수정 |
| 2 | Rationale-Continuity | `spec/2-navigation/14-execution-history.md` Rationale 섹션 부재 — LLM 탭 평탄화 결정 배경이 인라인 주석으로만 존재 | `spec/2-navigation/14-execution-history.md` | `## Rationale` 신설 및 "하위 탭 구조 → 평탄화" 결정 근거 ADR 형태 기록 |
| 3 | Rationale-Continuity | `spec/2-navigation/2-trigger-list.md` Rationale 번호 R-9~R-11 공백 — 삭제인지 미작성인지 불명확 | `spec/2-navigation/2-trigger-list.md §Rationale` | 연속 번호 재매핑하거나 삭제 근거 주석 추가 |
| 4 | Convention-Compliance | `spec/2-navigation/7-statistics.md`, `8-marketplace.md` — `## Rationale` 섹션 누락 (이번 diff 직접 대상 아님) | 두 파일 말미 | 향후 해당 파일 수정 시 Rationale 추가 |
| 5 | Convention-Compliance | `spec/2-navigation/13-user-guide.md` — `## Overview` 섹션 없이 `## 1.` 로 시작 (영역 전반 패턴, 이번 PR 직접 관련 없음) | `spec/2-navigation/13-user-guide.md` 라인 23 | 의도적 패턴이라면 규약에 `_product-overview.md` 대체 패턴 명시 추가 |
| 6 | Plan-Coherence | `spec-sync-workflow-list-gaps.md`, `spec-sync-integration-common-gaps.md` worktree stale — branch MERGED, plan frontmatter 미정리 | `plan/in-progress/` 해당 파일들 | worktree cleanup 및 plan frontmatter `worktree:` 값 정리 권장 |
| 7 | Plan-Coherence | `spec-code-cross-audit-2026-06-10.md` V-01·V-07 결정 이미 정식 반영 확인 — stale worktree cleanup 권장 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 두 worktree 모두 MERGED — stale cleanup |
| 8 | Plan-Coherence | `integration-expiry-fixes.md` 의 "범위 밖 WARNING" 항목이 spec-sync-* backlog plan 에 크로스 레퍼런스로 등록됐는지 확인 필요 | `plan/in-progress/integration-expiry-fixes.md` | 본 plan 완료 처리 전 후속 backlog 크로스 레퍼런스 확인 |
| 9 | Naming-Collision | `spec/2-navigation/4-integration.md:488` 의 DB 연결 테스트 에러 코드 `unknown` 이 `INTEGRATION_STATUS_REASONS` 의 `unknown_error` 와 미정렬 잔존 (이번 branch 범위 밖 기존 이슈) | `spec/2-navigation/4-integration.md` 라인 488 | `unknown` → `unknown_error` 로 통일하거나 "DB 연결 테스트 전용 코드" 주석 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | CRITICAL | `spec/data-flow/8-notifications.md §1.1` 과 target `spec/2-navigation/4-integration.md §11` 의 `integration_expired` 발사 조건 정반대 기술. 추가로 data-flow/5-integration.md 큐 카탈로그 잔존 갭 주석, cafe24 §8.6 참조 미갱신 |
| Rationale-Continuity | LOW | 구조적 일관성 위반 없음. `14-execution-history.md` Rationale 섹션 부재, `2-trigger-list.md` Rationale 번호 공백(R-9~R-11) |
| Convention-Compliance | LOW | `14-execution-history.md` 섹션 번호 중복·Rationale 누락, `16-agent-memory.md` id 기반 이탈 |
| Plan-Coherence | NONE | CRITICAL·WARNING 충돌 없음. V-01·V-07 정식 결정 후 구현 확인. stale worktree cleanup 권장 항목만 |
| Naming-Collision | LOW | `token_expired` 슬러그 표기 유사성 — spec 주석으로 의도 선언됨. `unknown`/`unknown_error` 미정렬 잔존(범위 밖) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/data-flow/8-notifications.md §1.1` `integration_expired` 행 갱신 — "후보 필터에서 `isRefreshCapable` provider(`service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token` 존재) 제외, 7d/3d/0d 임계 알림 모두 미발사. refresh_token 없는 provider 만 발사 대상" 으로 수정.
2. `spec/data-flow/5-integration.md §2.2` `makeshop-token-refresh` 행의 구(舊) 갭 주석 삭제 또는 "해소됨 — §1.4 Rationale 참조" 로 교체.
3. `spec/4-nodes/4-integration/4-cafe24.md §8.6` 참조 텍스트를 "§11.1 `isRefreshCapable` 분기" 로 업데이트.
4. `spec/2-navigation/14-execution-history.md` — Overview 내부 번호체계 정비 및 `## Rationale` 절 추가 (후속 정비 가능하나 이번 diff 에 포함 권장).
5. `spec/2-navigation/16-agent-memory.md` frontmatter `id` 를 `agent-memory` 로 수정하거나 Rationale 에 의도 명기.
6. `spec/data-flow/5-integration.md §3.4` 의 "(refresh-capable cafe24 제외)" 를 "(refresh-capable provider 제외 — cafe24·makeshop, §1.4)" 로 수정.
7. stale plan/worktree cleanup: `spec-sync-audit`, `spec-sync-audit-998544` 브랜치 관련 plan frontmatter `worktree:` 값 정리.