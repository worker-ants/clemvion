# Consistency Check 통합 보고서 (--spec) — **BLOCK: NO**

target: `plan/in-progress/workspace-membership-codes.md` (§1.9 신설 — workspace 직접-추가 코드 등재).
5 checker 중 convention_compliance·naming_collision 이 FS-flakiness 로 디스크 미기록 → **journal.jsonl 복구**로 전수 확보. CRITICAL 0.

## 판정: BLOCK: NO
- naming_collision **NONE** (UPPER↔lowercase 쌍은 이미 코드·error-codes.md §3·data-flow §1.9 에 사전 조율 — 신규 충돌 아님).
- rationale_continuity **NONE** ("#893 이 예약한 별도 완결성 pass 를 정확 이행하는 모범 사례").
- plan_coherence **NONE**.

## WARNING (cross_spec·convention) — 반영
| # | 위배 | 처분 |
|---|---|---|
| 1 | §1.9 note 가 `USER_NOT_FOUND`(404)를 "§1.1" 로 표기하나 §1.1(시스템 에러)엔 없음 | "§1.1" 제거, 섹션 비특정("전역 CRUD generic") 으로 수정 |
| 2 | `addMemberByEmail` 이 던지는 `WORKSPACE_NOT_FOUND`(404) 배제 사유 누락(USER_NOT_FOUND 와 비대칭) | note 에 `WORKSPACE_NOT_FOUND` generic 제외 사유 대칭 추가 |
| 3 | plan 파일명이 `spec-draft-` prefix 규약 미준수(project-planner SKILL) | **수용** — 세션 task-name 패턴(#893 `catalog-residual-codes` 등 선례)·worktree 명 일관. drift 실존(error-codes-catalog-sot 등). 비차단 |

## INFO — 처분
- cross_spec: 배경에 error-codes-catalog-sot cross-ref — 선택(미반영).
- rationale: 기존 완결성 bullet 에 "→ §1.9 완결" 후행 포인터 — append-only 관행상 신규 bullet 로 충분(미반영).
- plan_coherence: `error-codes-catalog-sot.md`(#893 로 전 항목 [x])가 in-progress 잔류 — target 무관 별건 housekeeping.

## Checker별
| Checker | 판정 | 비고 |
|---|---|---|
| cross_spec | MEDIUM→반영 | 3코드 status·트리거·모듈 구분 코드·error-codes.md·data-flow §1.9 완전 정합. USER_NOT_FOUND/WORKSPACE_NOT_FOUND 서술만 정정 |
| rationale_continuity | NONE | 모범 사례(#893 예약 이행) |
| convention_compliance | LOW(journal) | plan 파일명 prefix WARNING(수용). 표·명명·status 규약 준수 |
| plan_coherence | NONE | 충돌 plan 없음 |
| naming_collision | NONE(journal) | 신규 충돌 없음. UPPER/lowercase 사전 조율 확인 |

→ spec 반영 진행(BLOCK:NO + WARNING 반영).
