# Consistency Check 통합 보고서

**BLOCK: YES** — `plan/in-progress/spec-draft-ws-types-canonical-location.md` 자신의 frontmatter 가
plan-lifecycle 필수 필드 스키마를 어겨 build 가드(`plan-frontmatter.test.ts`)가 실측 FAIL 상태다.

## 전체 위험도
**CRITICAL** — target plan 문서 자체의 frontmatter 누락이 다른 시스템(build 가드)의 invariant 를
깨고 있다(실측 확인). spec 본문 변경안(7곳 정본 위치 정정 + §4.4 Rationale 보완) 자체의 내용은
5개 checker 전원이 사실관계·Rationale 연속성·plan 선행조건·신규 식별자 충돌 어느 관점에서도
깨끗하다고 판정했다 — 결함은 오직 target 문서의 frontmatter 세 줄에 국한된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `plan/in-progress/*.md` 필수 frontmatter(`started`/`owner`) 누락 — `pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` 실측 결과 2개 테스트 FAIL (`started=null`, `owner=undefined`) | frontmatter 블록 라인 1~13 (`worktree:` 만 있고 `started:`/`owner:` 키 자체가 없음) | `.claude/docs/plan-lifecycle.md §4` (SoT 참조: `spec/conventions/spec-impl-evidence.md §4.2`) — top-level `plan/in-progress/*.md` 는 `worktree`/`started`/`owner` 3필드 필수, build guard 강제 | frontmatter 에 `started: 2026-08-15`, `owner: project-planner` 추가 (같은 worktree 의 자매 spec-draft 2건은 이미 3필드 모두 갖춤) |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 target 문서 자체의 frontmatter 세 줄 결함이며, target 은 애초에
project-planner 산출물(spec-draft 문서)이다. `developer` 턴에서 발견된 `spec/` drift 유형이
아니라 이번 턴(작성 주체)의 권한 범위 안에서 즉시 수정 가능한 국소 결함이므로 인계 대상이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `worktree:` 값이 스키마의 "bare directory 이름"이 아니라 `.claude/worktrees/` 전체 경로 — push 게이트는 정규화로 우연히 통과하지만 `plan-stale-audit.sh` 는 정규화 없이 그대로 이어붙여 항상 MISSING 오탐 유발 | frontmatter 라인 4 (`worktree: .claude/worktrees/eia-r8-cache-scope-4ae434`) | `.claude/docs/plan-lifecycle.md §4` 스키마 (`worktree: <task_name>-<slug>`) | `worktree: eia-r8-cache-scope-4ae434` (bare name) 로 정정 |
| 2 | plan_coherence | target 의 7+1개 변경안이 선행 plan `ws-event-types-extract.md` §"후속" 목록과 1:1 대응하지만, 적용 후 그 체크리스트를 닫는 역참조/절차가 target 에 없어 이미 해소된 항목이 계속 미해결로 남아 중복 조사 위험 | 문서 전체 (frontmatter 에 `pending_plans:` 없음, 본문에 역참조 없음) | `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)" (L299-334) | frontmatter 에 `pending_plans: [plan/in-progress/ws-event-types-extract.md]` 추가(자매 draft 관행과 동일) + "체크리스트" 절에 "적용 후 후속 목록 8항목 체크" 단계 명시 |
| 3 | cross_spec | §4.4 에 추가하는 새 문장("값·타입 선언 분리로 순환 참여자 집합이 줄어든다")이 바로 위 문장("현재는 두 기법으로 봉인 — 근본 축소는 별도 backlog 로 유예")과 개념적으로 인접해, "근본 축소가 이미 일부 진행됐다"는 오독 여지를 남김(정면 모순은 아님) | target 문서 `## ⑧` 절 추가 문장 | `spec/5-system/4-execution-engine.md:478` | 새 문장 서두에 "이는 DI 그래프가 아니라 모듈 그래프를 줄이는 별도 축" 임을 명시하거나, "두 기법으로 봉인" 문장에 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | target 목록 밖 7개 spec 파일은 전부 `WebsocketService.emit*`/`executionEvents$` 메서드·facade 참조라 대상 제외가 정확(코드 확인 결과 이 메서드들은 실제로 안 옮겨짐) | spec 전역 (`14-external-interaction-api.md` 등) | 조치 불필요 |
| 2 | cross_spec | `NodeEventType`/`ExecutionChannelEvent`/`KbEventType` 전수 grep 결과 target 의 7곳이 exhaustive set 과 정확히 일치 | `3-execution.md:657`, `data-flow/0-overview.md:110` 등 | 조치 불필요 |
| 3 | cross_spec | "§4.4 Rationale 말미"라는 표현이 문서-레벨 `## Rationale`(L1328, 유사 순환-DI 결정들이 모인 섹션)과 이름이 비슷해 patch 적용 시 착지점이 모호할 수 있음 | target `## ⑧` 절 지시문 | patch 적용 시 줄 번호 anchor 명시(예: "481행 근처 `근거:` 목록 말미") 권장 |
| 4 | convention_compliance | 첫 섹션 헤딩이 `## 왜` — 같은 worktree 자매 `spec-draft-*.md` 2건은 `## Overview` 로 시작하는 일관된 로컬 관행 | 라인 17 | 통일 원하면 `## Overview` 로 변경, 의도적 차별화면 무시 가능 |
| 5 | naming_collision | 신규 요구사항 ID·엔티티/타입명·endpoint·이벤트명·ENV var·spec 파일 경로 신설 전혀 없음 — 순수 포인터 정정. 코드 대조 결과 언급된 모든 식별자(`KbEventType`, `NodeEventType`, `ExecutionChannelEvent`, `WebsocketService`, `emitKbEvent`, R10 절)의 사실 주장이 전부 정확 | 문서 전체 | 조치 불필요 |
| 6 | plan_coherence | 선행 plan `ws-event-types-extract.md` 자체 체크리스트("push 게이트 통과"·"spec_impact 갱신")가 `[ ]`인데 실측상 이미 `origin/main` 에 병합됨 — target 결함은 아니고 선행조건은 사실로 확정 | `ws-event-types-extract.md` §체크리스트 (L293-297) | target 자체엔 조치 불요, 참고 |
| 7 | rationale_continuity | `## ⑧` 항목이 "§4.4 Rationale 말미"라 표현하지만 실제로는 §4.4 본문 안 인라인 "근거:" 목록 — §4.4 가 원래 갖던 패턴을 그대로 따르는 것이라 위반 아님 | target `## ⑧` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 7곳 스코프 exhaustive 확인(코드 대조), §4.4 문구 인접성 WARNING 1건 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회 전부 없음 |
| convention_compliance | CRITICAL | plan frontmatter 필수 필드(`started`/`owner`) 누락 — build 가드 실측 FAIL. `worktree:` 경로 형식도 WARNING |
| plan_coherence | LOW | 선행 plan 후속 목록과 1:1 대응 확인, 다만 역참조/체크리스트 종결 절차 부재 WARNING |
| naming_collision | NONE | 신규 식별자 도입 없음, 사실관계(코드 대조) 전부 일치 |

## 권장 조치사항
1. (BLOCK 해소 우선) target frontmatter 에 `started: 2026-08-15`, `owner: project-planner` 추가.
2. `worktree: eia-r8-cache-scope-4ae434` (bare directory 이름) 로 정정.
3. frontmatter 에 `pending_plans: [plan/in-progress/ws-event-types-extract.md]` 추가 + "체크리스트"
   절에 적용 후 `ws-event-types-extract.md` 후속 목록 8항목을 닫는 단계 명시.
4. (선택) §4.4 새 문장에 "DI 그래프가 아니라 모듈 그래프를 줄이는 별도 축" 임을 한 줄 보강하거나
   각주 추가.
5. (선택) `## 왜` → `## Overview` 로 자매 spec-draft 문서와 헤딩 패턴 통일.