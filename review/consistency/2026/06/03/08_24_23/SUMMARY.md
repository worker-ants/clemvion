# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — plan 문서 형식 규약 위반 2건(CRITICAL)이 있으며, 이는 worktree 추적·spec status 전이 가드를 무력화합니다. spec 내용 충돌은 없고, 내용 수준의 경고는 단순 보강으로 해소 가능합니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress/` 문서에 YAML frontmatter 전혀 없음 (`worktree`/`started`/`owner` 필드 의무) | `plan/in-progress/spec-draft-system-status-recent-failed.md` 최상단 | `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` | 문서 최상단에 `worktree: system-status-recent-failed-86831b`, `started: 2026-06-03`, `owner: planner` 를 포함한 YAML `---` 블록 추가 |
| 2 | Convention Compliance | draft 확정 시 대상 spec(`16-system-status-api.md`) 의 `status: implemented` → `partial` 전이 및 `pending_plans:` 등록 계획 부재 | `plan/in-progress/spec-draft-system-status-recent-failed.md` §A 전반 | `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` | draft 본문에 "spec 갱신 시 `status: partial` 로 전환 + `pending_plans:` 에 본 plan 경로 등록" 단계를 체크리스트로 명시 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `SYSTEM_STATUS_FAILED_THRESHOLD` env 의 의미가 "보관 중 누적 기준" → "최근 윈도우 기준" 으로 묵시적으로 바뀌나 spec 에 명시 없음 — 기존 설정 유지 배포 시 동작이 변함 | `spec-draft §3` health 파생 규칙 변경 | `spec/5-system/16-system-status-api.md §3` env 설명 | `16-system-status-api.md §3` env 설명에 "v2 이후 recentFailed 기준으로 의미 변경 — 기존 설정값 재검토 권장" 노트 추가 또는 R-5 에 명시 |
| 2 | Cross-Spec | `spec/2-navigation/_product-overview.md` NAV-SS 요구사항 목록이 병기 UI(최근 실패 주 지표 + 누적 부 지표) 를 커버하는 신규 ID 없음 | `spec-draft §B` 전반 | `spec/2-navigation/_product-overview.md §3.9 System Status` NAV-SS-01~06 | `NAV-SS-07` ("최근 윈도우 실패 주 지표 + 누적 보관 실패 부 지표 병기") / `NAV-SS-08` ("윈도우 길이 라벨 반영") 신규 추가 |
| 3 | Rationale Continuity | `getFailed()` 스캔 도입으로 "상수 비용" 원칙 번복 시, 기존 Rationale R-1~R-4 에 상수 비용이 왜 중요했는지 항목 없고 신규 R-5 도 맥락 연결 없음 | `spec-draft §A §2` 구현/비용 노트 변경 | `spec/5-system/16-system-status-api.md Rationale R-2` 전제 | R-5 에 "기존 상수 비용 전제(getJobCounts Redis counter 조회)와 이번 포기 이유(현재 상태 반영 우선, 스캔 캡 상한 보장)" 를 명시 연결하는 문장 추가 |
| 4 | Rationale Continuity | §3 규칙 3만 교체하면서 규칙 2(워커 미가동 판정, R-3) 와의 독립성·상호작용을 명시하지 않아 독자가 추론해야 함 | `spec-draft §A §3` health 파생 규칙 변경 | `spec/5-system/16-system-status-api.md §3 Rationale R-3` | R-5 또는 §3 변경 설명에 "규칙 1·2 는 변경 없음. 규칙 2 의 워커 미가동 판정(R-3)은 recentFailed 와 독립 동작" 한 줄 추가 |
| 5 | Convention Compliance | `SystemStatusOverviewDto`, `QueueStatusDto` 파일명이 swagger 규약 §5-1 `*-response.dto.ts` 패턴인지 spec draft 에서 명시 없음 | `spec-draft §A §2` DTO 변경 | `spec/conventions/swagger.md §5-1 응답 DTO 위치` | §A §2 에 "구현 시 DTO 파일명은 swagger 규약 §5-1 에 따라 `*-response.dto.ts` 패턴 적용" 노트 추가 |
| 6 | Convention Compliance / Naming Collision | draft 내 pseudo-code `FAILED_DEGRADED_THRESHOLD` 와 실제 env `SYSTEM_STATUS_FAILED_THRESHOLD` 혼용 — 기존 spec 불일치를 새 규칙 추가로 심화 | `spec-draft §3` health 규칙, §2 비용 노트 | `codebase/backend/.env.example` lines 253, 257 / `system-status.constants.ts` lines 84, 86 | draft §3 pseudo-code 를 `SYSTEM_STATUS_FAILED_THRESHOLD`(env) 로 통일하거나 "코드 상수 `FAILED_DEGRADED_THRESHOLD` ← env `SYSTEM_STATUS_FAILED_THRESHOLD`" 매핑 명시 |
| 7 | Convention Compliance | §B Rationale 보강 지시가 "R-3 류로 한 줄" 메모 수준 — 정식 Rationale 항목 형식(번호 소제목 + 근거 서술) 미충족 | `spec-draft §B Rationale 보강` | `CLAUDE.md §정보 저장 위치` spec Rationale 절 형식 권고 | "R-3: 최근 실패가 주 지표인 이유 — …" 형태의 정식 항목으로 draft 에 사전 작성 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/_product-overview.md §5 NF-OB-06` 설명이 "실패" 지표 분화를 반영하지 않음 (추상적 기술, 직접 충돌은 아님) | `spec/5-system/_product-overview.md §5` | draft 확정 시 NF-OB-06 설명을 "최근 윈도우 기준 주 지표, 누적 보관 부 지표" 로 동기화 |
| 2 | Cross-Spec | `spec/2-navigation/15-system-status.md §2.2` 의 `totalFailed` 단독 주 배지 기술이 draft 적용 후 부 배지로 격하 — 한쪽만 갱신 시 불일치 위험 | `spec/2-navigation/15-system-status.md §2.2` | draft §B §2.2 적용 시 기존 `totalFailed` 배지 문장을 두 필드 모두 서술하는 형태로 명시적 교체 |
| 3 | Cross-Spec | `spec/2-navigation/15-system-status.md §1` ASCII 다이어그램이 draft 적용 후 병기 표기를 반영해야 함 — 교체안 미포함 | `spec-draft §B §1` | draft 최종안에 §1 ASCII 다이어그램 교체안 명시 |
| 4 | Cross-Spec | `spec/5-system/16-system-status-api.md §2` 현행 "상수 비용" 구현 노트가 draft 적용 후 틀린 기술이 됨 — 삭제·대체 지시 없음 | `spec-draft §A §2` | draft §A §2 변경안에 현행 "상수 비용" 문장 삭제·대체를 명시 |
| 5 | Rationale Continuity | R-5 에 R-2(throughput 시계열 v1 제외)와의 대조 문장 누락 | `spec-draft §A Rationale R-5` | "R-2 의 throughput 시계열과 달리 recentFailed 는 별도 저장소 불필요" 1~2문장 추가 |
| 6 | Rationale Continuity | 15-system-status.md Rationale 보강에서 R-3 신설인지 R-1 inline 추가인지 모호 | `spec-draft §B Rationale 보강` | "R-3 신설" 또는 "R-1 마지막 note 추가" 로 구체화 |
| 7 | Convention Compliance | plan 문서에 진행 체크리스트(`[ ]` 기반) 없음 — plan-lifecycle 판단 기준 미충족 | `spec-draft` 전체 구조 | `## 진행 체크리스트` 섹션 추가 |
| 8 | Naming Collision | `R-5`(API spec) / `R-3`(UI spec) Rationale ID — 기존 번호와 충돌 없음, 순차 추가 안전 | `spec-draft §A R-5`, `§B R-3` | 없음 |
| 9 | Naming Collision | `totalRecentFailed`, `failedWindowMinutes`, `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP` — 기존 사용처 없음, 충돌 없음 | 신규 DTO 필드·ENV | 없음 |
| 10 | Naming Collision | `recentFailed` 가 `shadow-workflow.ts` 의 `recentFailedAddNodeLabels` 와 단어 공유 — 스코프·타입 완전 분리, 실질 충돌 없음 | `QueueStatusDto.recentFailed` vs `ShadowWorkflow.recentFailedAddNodeLabels` | 이름 변경 불필요. 구현 시 코드 검색 노이즈 유의 |
| 11 | Plan Coherence | `spec-sync-audit` worktree 가 target spec 2개 파일 포함하나 main 동일 커밋으로 stale 확인 — 충돌 없음 | `spec-sync-audit` worktree | 작업 완료·머지 후 정리 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | env 의미 변경 미명시(W-1), NAV-SS 신규 ID 부재(W-2); 내용 모순 없음 |
| Rationale Continuity | LOW | "상수 비용" 번복 근거 미연결(W-3), R-3 연속성 명시 누락(W-4); CRITICAL 없음 |
| Convention Compliance | HIGH | plan frontmatter 완전 누락(C-1), spec status 전이 계획 부재(C-2) — CRITICAL 2건 |
| Plan Coherence | NONE | 충돌·중복 작업·선행 미해소 없음 |
| Naming Collision | LOW | pseudo-code 토큰 vs env 명 혼용(기존 불일치 심화, W-6); 신규 식별자 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 우선)** `plan/in-progress/spec-draft-system-status-recent-failed.md` 최상단에 YAML frontmatter(`worktree: system-status-recent-failed-86831b`, `started: 2026-06-03`, `owner: planner`) 를 추가한다.
2. **(BLOCK 해소 우선)** draft 본문에 "spec 확정 시 `16-system-status-api.md` 와 `15-system-status.md` 의 `status: partial` 전이 + `pending_plans:` 등록" 체크리스트 단계를 명시한다.
3. `spec/2-navigation/_product-overview.md §3.9 System Status` 에 `NAV-SS-07`, `NAV-SS-08` 신규 요구사항 ID 를 추가하고 draft §B 에서 참조한다.
4. `16-system-status-api.md §3` env 설명에 `SYSTEM_STATUS_FAILED_THRESHOLD` 의미 변화(v2: recentFailed 기준) 주의 노트를 추가하거나 R-5 에 명시한다.
5. R-5 에 기존 "상수 비용" 전제 포기 이유, R-3 와의 독립성, R-2 와의 대조 문장을 추가해 Rationale 연속성을 완결한다.
6. draft §3 pseudo-code 내 `FAILED_DEGRADED_THRESHOLD` 를 env 명 `SYSTEM_STATUS_FAILED_THRESHOLD` 로 통일하거나 "코드 상수 ← env" 매핑을 명시한다.
7. draft §B Rationale 보강을 "R-3: …" 정식 Rationale 항목으로 사전 작성한다.
8. draft §A §2 비용 노트 변경안에 현행 "상수 비용" 문장 삭제 지시를 포함한다.
9. draft §A §2 에 swagger 규약 §5-1 `*-response.dto.ts` DTO 파일명 패턴 적용 노트를 추가한다.
10. draft 최종안에 §1 ASCII 다이어그램 교체안을 포함한다.
