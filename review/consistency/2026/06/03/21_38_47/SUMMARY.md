# Consistency Check (--impl-prep) 통합 보고서

**checker 원판정: BLOCK: YES** → **main 반증 후 실질 판정: BLOCK 해소 (NO)**

## ⚠️ Critical #1 은 검증된 거짓양성 (main-baseline FP)

원 Critical: "`spec/5-system/17-agent-memory.md` 파일 부재 — dangling 참조 다수".

**git 반증 (2026-06-03)**:
- 파일 존재: `spec/5-system/17-agent-memory.md` (10681B, working tree)
- HEAD 추적: `git ls-files --error-unmatch` ✓, 커밋 `2273f310` (Phase A)
- `origin/main` 에는 미존재 → **checker 가 origin/main 기준 비교해 feature 브랜치 신규 파일을 "부재" 로 오판**
- 참조 resolve: `spec/1-data-model.md §2.23 AgentMemory`(line 723) 존재, 6개 spec 의 `17-agent-memory` 링크 모두 실파일로 resolve

근거: reference 메모리 [consistency-check main-baseline FP] — feature 브랜치 커밋 후 재실행 시
checker 가 origin/main 과 비교해 "미갱신/dead link" false Critical 을 낸다. git 으로 반증.

→ **유일한 Critical 이 FP 이므로 실질 BLOCK 없음. 구현 착수 가능.**

---

## WARNING (구현 시 반영)

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | memoryStrategy v1 schema 노출 노드 범위(ai_agent만) 불명확 | spec 보강 항목(planner) — 구현 차단 아님 |
| 2 | Cross-Spec | memoryStrategy↔contextScope 무효화 관계가 conversation-thread §5 에 cross-ref 부재 | spec 보강 항목(planner) |
| 3 | Convention | `0-common.md` pending_plans 경로 — **이미 디스크에서 해소**(파일 실존) | 조치 불필요 |
| 4 | Convention | text_classifier status:implemented v2 미구현 note 부재 | 본 작업 범위 밖(별도) |
| **5** | **Naming** | `memoryStrategy:'manual'` ↔ `Trigger.type:'manual'` 단어 중복 | **구현 반영: TS 타입 `MemoryStrategy` 별도 선언(Trigger 타입 재사용 금지)** |
| **6** | **Naming** | `scope_key` ↔ `Integration.scope` 유사 | **구현 반영: `AgentMemoryEntity.scopeKey` 명확 타입** |

## INFO (주요)
- Plan #10: plan §5 미해결 3항(시스템 spec 번호·요약 모델·추출 스키마)은 Phase A 에서 확정 → 체크박스 갱신.
- Plan #11: stale worktree 4개 — 본 작업 무관(별도 grooming).

---

## Checker별 위험도 (반증 후)
| Checker | 원위험도 | 반증후 |
|---------|--------|--------|
| Cross-Spec | HIGH(Critical) | **LOW** — Critical 은 baseline FP, WARNING 2건은 spec 보강(구현 차단 아님) |
| Rationale Continuity | LOW | LOW |
| Convention Compliance | LOW | LOW |
| Plan Coherence | NONE | NONE |
| Naming Collision | LOW | LOW (W#5·W#6 구현 시 타입 분리로 해소) |

## 결정
**BLOCK: NO** (Critical 은 main-baseline FP 로 git 반증). Phase B 구현 착수.
naming W#5·W#6 은 구현 시 TS 타입 분리(`MemoryStrategy`, `scopeKey`)로 해소.
