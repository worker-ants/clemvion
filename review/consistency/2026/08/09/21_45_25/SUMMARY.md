# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건 · WARNING 0건.

> **1차 실행에서 `plan_coherence` 가 API 연결 끊김으로 죽어 리포트가 나오지 않았고, 그
> checker 만 재실행해 확보했다.** 1차 SUMMARY 는 "BLOCK:NO 는 4/5 기준이며 `plan_coherence`
> 가 찾았을 수 있는 Critical 은 반영되지 않았다" 고 명시했다 — 4/5 로 통과 처리하지 않았다.
> 재실행 결과 전문: [`SUMMARY-plan-coherence-retry.md`](SUMMARY-plan-coherence-retry.md) ·
> [`plan_coherence.md`](plan_coherence.md). **본 문서는 5/5 확보 후의 최종 판정이다.**

## 전체 위험도

**NONE** — target(`spec-draft-canary-count-relation.md`)은 `spec/5-system/1-auth.md` §부트 캐너리
Rationale 에 기존 두 수치("캐너리가 세는 집합" ⊇ "`@Roles()` 부재 73건")의 **포함관계**를
명문화하는 순수 서술 보강이다. 신규 엔티티·API·요구사항 ID·상태 전이·RBAC 도입이 없다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 삽입 문장의 포함관계("캐너리 ⊇ 73건")가 두 원문과 정합함을 직접 대조로 확인 | `spec/5-system/1-auth.md:773-778`, `spec/data-flow/12-workspace.md:319` | 없음(확인만) |
| 2 | cross_spec | `§Rationale` 인용 앵커·삽입 지점이 실제 문서 구조와 일치 | `spec/5-system/1-auth.md:791-795` | 없음 |
| 3 | cross_spec | `auth-guard-reflection-hardening.md` §후속 미체크 항목을 문구까지 그대로 집행 | 그 plan §후속 | 적용 후 backlog 체크(target 체크리스트에 이미 포함) |
| 4 | cross_spec | "73건" 인용 문서 6건과 정의 충돌 없음(전수 스캔) | 관련 plan 6건 | 없음 |
| 5 | rationale_continuity | 과거 기각 대안("라우트별 opt-in 마커") 재도입 없음, 숫자 비하드코딩 원칙과 정합 | `1-auth.md` §부트 캐너리 | 없음 |
| 6 | rationale_continuity | 단일 SoT 선택 근거(`#1112`/`#1113` 복제-drift 실패 이력)가 **지어낸 것이 아니라 실제 이력에 기반**함을 대조 확인 | `auth-guard-reflection-hardening.md` | 없음 |
| 7 | convention_compliance | plan frontmatter(`spec_impact` 리스트) 규약 준수, 삽입 위치가 CLAUDE.md "결정의 배경·근거 → `## Rationale`" 원칙 그대로 | target frontmatter · `1-auth.md` | 없음 |
| 8 | convention_compliance | 링크 무결성·게이트 명칭(`spec-link-integrity`/`Gate C`/`plan-frontmatter`) 정확 | target Overview | 없음 |
| 9 | naming_collision | 신규 식별자 전혀 도입 안 함, 기존 용어(`handlerConsumesWorkspaceId`·"73건") 재인용만 | `1-auth.md` · `12-workspace.md` | 없음 |
| 10 | naming_collision | "부트 캐너리"/"73건" grep 전수 확인 — 의미 충돌 없음 | `spec/` · `plan/in-progress/` 전체 | 없음 |
| 11 | plan_coherence | 미해결 결정 우회 없음, 선행 조건(관계가 코드 주석에만 존재) 실측 참, 후속 항목 누락 없음 | `auth-guard-reflection-hardening.md` §후속 | backlog 체크 시 **"1-auth.md 단독 채택, 12-workspace.md 에는 중복 기재 안 함"** 한 줄 동반 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 인용 사실관계·앵커 전부 원문과 정합, backlog 문구와 일치 |
| rationale_continuity | NONE | 기존 backlog 항목의 집행이며 새 결정 아님. 기각 대안 재도입 없음, 근거의 실제 이력 기반 확인 |
| convention_compliance | NONE | frontmatter·링크·삽입위치·게이트명 전부 규약 준수. API·DTO 미변경이라 §1·§2·§4 N/A |
| plan_coherence | LOW | (재실행 확보) 우회·누락 없음. 유일 권고는 backlog 체크 시 근거 한 줄 기록(INFO 11) |
| naming_collision | NONE | 신규 식별자 없음, 기존 용어 재인용만 |

## 권장 조치사항

1. target 적용 시 `auth-guard-reflection-hardening.md` §후속의 "73건(subset)/142건(superset)
   관계를 spec Rationale 에도 미러링" 항목을 체크하면서, **"`1-auth.md` 단독 채택,
   `data-flow/12-workspace.md` 에는 중복 기재하지 않음(`#1112`/`#1113` 복제-drift 재발 방지)"**
   한 줄을 함께 남길 것 (INFO 11).
2. 그 외 조치 불요 — Critical·Warning 0.
