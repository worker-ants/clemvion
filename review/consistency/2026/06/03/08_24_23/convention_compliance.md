# 정식 규약 준수 검토 — spec-draft-system-status-recent-failed.md

target: `plan/in-progress/spec-draft-system-status-recent-failed.md`
검토 기준: `spec/conventions/**` + `CLAUDE.md` 명명 컨벤션 + `.claude/docs/plan-lifecycle.md`

---

## 발견사항

### [CRITICAL] plan 문서에 frontmatter 누락
- **target 위치**: 문서 최상단 (라인 1)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- **상세**: `plan/in-progress/` 문서는 `worktree`, `started`, `owner` 필드를 포함한 YAML frontmatter 가 의무다. 해당 문서에는 frontmatter(`---` 블록)가 전혀 없다. `consistency-checker` 의 `plan_coherence` checker 가 worktree 충돌 검출에 이 필드를 사용하므로 생략 시 동시 작업 추적이 불가능해진다.
- **제안**: 문서 최상단에 다음을 추가한다.
  ```yaml
  ---
  worktree: system-status-recent-failed-86831b
  started: 2026-06-03
  owner: planner
  ---
  ```

### [CRITICAL] spec 변경 대상 문서(`16-system-status-api.md`)의 `status` 미갱신 계획 부재
- **target 위치**: 문서 전체 (특히 §A)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` — `partial` 상태는 `pending_plans:` 의무화
- **상세**: 현재 `spec/5-system/16-system-status-api.md` 의 frontmatter 는 `status: implemented` 다. 이 spec draft 가 승인되면 DTO 필드 추가(`totalRecentFailed`, `failedWindowMinutes`, `recentFailed`) 및 health 규칙 변경이 발생한다. 구현 전 spec 이 갱신되면 spec 은 `status: spec-only` 또는 `status: partial` 로 전이해야 하며, `partial` 시 `pending_plans:` 에 본 plan 경로를 등록해야 한다. spec draft 문서 어디에도 이 전이 계획이 기술되어 있지 않다.
- **제안**: draft 본문에 "spec 갱신 시 `status: partial` 로 전환 + `pending_plans: plan/in-progress/spec-draft-system-status-recent-failed.md` 등록" 단계를 명시하거나, 별도 체크리스트 섹션을 추가한다.

### [WARNING] DTO 명칭이 swagger 규약의 응답 DTO 위치 규약에서 벗어날 가능성
- **target 위치**: §A §2 API — DTO 변경 (라인 10–29)
- **위반 규약**: `spec/conventions/swagger.md §5-1 응답 DTO 위치` — `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
- **상세**: spec draft 는 `SystemStatusOverviewDto`, `QueueStatusDto` 라는 이름을 제안하고 있으나, swagger 규약 §5-1 에 따르면 응답 DTO 클래스 파일은 `*-response.dto.ts` 패턴을 따라야 한다. 기존 구현에 이미 동명 DTO 가 있을 수 있으므로 명명 충돌/불일치 여부를 확인해야 한다. `SystemStatusOverviewDto` 는 `system-status-overview-response.dto.ts`, `QueueStatusDto` 는 `queue-status-response.dto.ts` 패턴이 규약에 부합한다. spec draft 단계에서 파일명 패턴을 명시해 두는 것이 구현 혼선을 줄인다.
- **제안**: §A §2 에 "구현 시 DTO 파일명은 swagger 규약 §5-1 에 따라 `*-response.dto.ts` 패턴 적용" 노트를 추가한다.

### [WARNING] 신규 env 변수 명명이 기존 임계값 env 명명 패턴과 일부 불일치
- **target 위치**: §A §2 구현/비용 노트 변경 (라인 38), §3 health 파생 규칙 변경 (라인 47)
- **위반 규약**: 직접적인 정식 규약은 없으나 기존 spec 에서 확립된 naming 패턴이 있음 (`spec/5-system/16-system-status-api.md §3`)
- **상세**: 기존 spec 은 `SYSTEM_STATUS_FAILED_THRESHOLD` + `SYSTEM_STATUS_DELAYED_THRESHOLD` 패턴을 사용한다. 신규 env 로 `SYSTEM_STATUS_FAILED_WINDOW_MINUTES` 와 `SYSTEM_STATUS_FAILED_SCAN_CAP` 이 도입되는데, `SYSTEM_STATUS_FAILED_DEGRADED_THRESHOLD` 라는 표현(§3 규칙 본문)이 등장하는 반면 §3 마지막 줄에서는 "임계 env `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1) 재사용" 이라 하여 같은 env 를 두 이름으로 지칭하는 것처럼 읽힌다. 이름 일관성이 결여되어 있다.
- **제안**: spec draft 에서 재사용 env 는 기존 이름 `SYSTEM_STATUS_FAILED_THRESHOLD` 로 일관되게 표기하고, `FAILED_DEGRADED_THRESHOLD` 라는 별칭 표기를 제거하거나 명확히 "기존 `SYSTEM_STATUS_FAILED_THRESHOLD` env 재사용" 으로 통일한다.

### [WARNING] B 파트(UI spec) Rationale 표기가 규약 권고 형식에서 벗어남
- **target 위치**: §B Rationale 보강 (라인 100–102)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — spec 문서의 Rationale 은 해당 spec 문서 끝의 `## Rationale` 섹션에 위치해야 함
- **상세**: `§B Rationale 보강` 항목이 "R-3 류로 ... 한 줄 추가 또는 R-1 인근에 노트. (API R-5 참조)" 로만 기술되어 있다. 이는 spec draft 내 변경안 설명으로서 적절하나, 표기 방식이 spec 문서의 정식 Rationale 절 형식(번호 붙은 소제목 + 구체적 근거 서술)을 따르지 않고 메모 수준으로 남아있다. spec 을 직접 갱신할 때 적용 방식이 불명확하다.
- **제안**: Rationale 보강 내용을 "R-3: 최근 실패가 주 지표인 이유 — ..." 형태의 정식 Rationale 항목으로 사전 작성해 draft 에 포함한다. 이렇게 하면 spec 갱신 시 그대로 붙여넣기 가능하다.

### [INFO] spec draft 문서 제목에 `_product-overview.md` 나 `0-` prefix 규약은 해당 없으나, plan 문서 본문 구조 섹션 분리 부재
- **target 위치**: 문서 전체 구조
- **위반 규약**: 직접 위반은 아니나 `CLAUDE.md §정보 저장 위치` 의 plan 관련 기술 방식 참고
- **상세**: 이 문서는 spec draft 이면서 plan 문서의 역할도 겸하고 있다. 그러나 plan 문서로서의 진행 상태를 추적하는 체크리스트나 작업 단계 구분이 없어, plan-lifecycle 에서 요구하는 체크박스 기반 진행 추적 구조(`[ ]` → `[x]`) 가 없다. `plan/in-progress/` 문서에서는 진행 항목을 체크박스로 기술하는 것이 lifecycle 판단의 기준이 된다.
- **제안**: `## 진행 체크리스트` 혹은 `## 작업 단계` 섹션을 추가해 spec 갱신 항목(A-1. 16-system-status-api.md 갱신, A-2. 15-system-status.md 갱신 등)을 체크박스로 나열한다.

---

## 요약

target 문서(`plan/in-progress/spec-draft-system-status-recent-failed.md`)는 spec 변경 내용(DTO additive 추가, health 규칙 변경, UI 병기)을 내용 면에서 잘 기술하고 있으나, plan 문서로서의 형식 규약 준수에 두 가지 CRITICAL 위반이 있다. 첫째, `plan-lifecycle.md §4` 에서 의무화하는 YAML frontmatter(`worktree`/`started`/`owner`)가 전혀 없어 동시 작업 추적 및 worktree 충돌 검출이 불가능하다. 둘째, 이 draft 가 확정되면 대상 spec 문서들의 `status` 전이 계획(`partial` + `pending_plans:` 등록)이 명시되어야 하나 언급이 없어 `spec-impl-evidence.md` 의 가드가 작동하지 않는 상태로 spec 갱신이 진행될 위험이 있다. WARNING 수준으로는 swagger 규약상 응답 DTO 파일 명명 패턴 미명시, env 변수 명칭 혼용, Rationale 작성 형식 부재가 지적된다.

## 위험도

HIGH
