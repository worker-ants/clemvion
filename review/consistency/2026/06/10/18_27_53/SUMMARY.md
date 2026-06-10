# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 2건(타임존 불일치, 문서 구조 중복), INFO 다수. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 타임존 기본값 불일치 — schedule spec 은 `'Asia/Seoul'` 하드코딩 + "워크스페이스 timezone 미존재"로 기술, data-model 은 `settings.timezone`(NAV-SC-06 ✅) 구현 완료 + Schedule 이 이를 참조하며 fallback 은 `UTC` 로 명시 | `spec/2-navigation/3-schedule.md §2.2` | `spec/1-data-model.md §2.2 Workspace.settings` | (a) `SchedulesService.create` 가 실제로 `workspace.settings.timezone` 을 읽는지 코드 확인, (b) 결과에 따라 schedule spec §2.2 또는 data-model 의 "참조" 표현을 정정. `plan/in-progress/spec-sync-schedule-gaps.md` 의 "타임존 미지정 시 워크스페이스 설정 기반 기본값 (§2.2)" 항목으로 이미 추적 중 |
| 2 | Convention Compliance | `14-execution-history.md` 문서 구조 — `## Overview (제품 정의)` 와 `## 1. 개요` 이중 중첩. 동일 영역 다른 파일들은 Overview 없이 번호 있는 기술 섹션으로 시작하는 패턴 | `spec/2-navigation/14-execution-history.md` 라인 17, 91 | `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` 및 `spec/2-navigation/_product-overview.md` 위임 패턴 | `## Overview` 내용을 `_product-overview.md` 로 통합하거나, 번호 없는 단일 배경·목표 섹션으로 정리 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `parameter_values` 필드가 schedule spec 생성/수정 다이얼로그에 미노출 | `spec/2-navigation/3-schedule.md §2.2` | UI 제공 여부 확인 후 "Planned" 표기 추가 또는 필드 명시 |
| 2 | Cross-Spec | 워크플로우 링크 미구현 표기 — 스케줄 목록은 단순 텍스트, 트리거 목록은 에디터 이동 링크 구현 완료 | `spec/2-navigation/3-schedule.md §2.1` | 스케줄 화면 링크 구현 완료 시 schedule spec §2.1 과 plan 체크박스 함께 갱신 |
| 3 | Cross-Spec | `trigger-list.md §4.3/§4.4` 는 이미 역방향 동기화 완료를 정확히 반영 중 — plan 의 "검토 후 필요 시 추가 수정" 항목 닫기 필요 | `plan/in-progress/spec-update-trigger-schedule-sync.md §3` | 해당 항목을 "검토 완료 — 추가 수정 불필요"로 닫기 |
| 4 | Rationale Continuity | `1-workflow-list.md` 상태 필터 경고 제거에 대한 Rationale 기록 미비 | `spec/2-navigation/1-workflow-list.md §2.3` | `## Rationale` 에 "상태 필터 파라미터 불일치 수정 완료(날짜)" 항목 추가 |
| 5 | Convention Compliance | `16-agent-memory.md` frontmatter `id: nav-agent-memory` — 파일명 기반 `agent-memory` 가 영역 내 일관성에 부합 | `spec/2-navigation/16-agent-memory.md` | 타 영역에 `agent-memory` 동명 id 없다면 `id: agent-memory` 로 변경 권장 |
| 6 | Convention Compliance | `14-execution-history.md §5` 목록 API 응답 예시가 `TransformInterceptor` 감싸기 전 형태인지 명시 없음 | `spec/2-navigation/14-execution-history.md §5` | 예시 앞에 `// HTTP 실제 응답은 { data: { data: [...], pagination: {...} } }` 주석 추가 권장 |
| 7 | Convention Compliance | `10-auth-flow.md §2.6` 의 `invitation_*` lowercase 에러 코드는 historical artifact 예외 레지스트리 등재 확인 — 현행 준수 | `spec/2-navigation/10-auth-flow.md §2.6` | 신규 에러 코드 추가 시 `UPPER_SNAKE_CASE` 요건 주석 권장 |
| 8 | Plan Coherence | MERGED PR 의 `spec-sync-audit-998544` worktree 정리 안 됨 | `.claude/worktrees/spec-sync-audit-998544` | `cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 9 | Plan Coherence | `trigger-schedule-reverse-sync.md`, `spec-update-trigger-schedule-sync.md` 두 파일 모두 체크리스트 완료 상태로 `in-progress` 잔류 | `plan/in-progress/trigger-schedule-reverse-sync.md`, `plan/in-progress/spec-update-trigger-schedule-sync.md` | 두 파일 모두 `plan/complete/` 로 이동 검토 |
| 10 | Naming Collision | 충돌 없음 — `syncScheduleActivation()`, 앵커 추가 참조, `TriggerStateChangedEvent`(기각 대안 언급만), plan 신규 4파일 모두 기존 식별자와 충돌 없음 | (전체 diff) | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 타임존 기본값 불일치(WARNING 1건): schedule spec 의 `'Asia/Seoul'` 하드코딩 vs data-model 의 UTC + workspace.settings.timezone 참조. 나머지 2건 INFO |
| Rationale Continuity | NONE | 3건 변경 모두 기존 결정과 일치. workflow-list.md 경고 제거의 Rationale 기록 미비는 INFO 수준 |
| Convention Compliance | LOW | `14-execution-history.md` 이중 Overview 구조(WARNING 1건), `16-agent-memory.md` id 불일치(INFO). 나머지 허용 범위 |
| Plan Coherence | NONE | plan 파일과 충돌 없음. stale worktree 1건 skip 정상. 완료 plan 이동 권장(INFO) |
| Naming Collision | NONE | 신규 식별자 4건 모두 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소 — 높은 우선순위)** `SchedulesService.create` 가 실제로 `workspace.settings.timezone` 을 읽는지 코드 확인 후, `spec/2-navigation/3-schedule.md §2.2` 와 `spec/1-data-model.md §2.2` 의 상충 표현을 정정. `plan/in-progress/spec-sync-schedule-gaps.md` 타임존 항목도 함께 체크아웃.
2. **(WARNING 해소 — 낮은 우선순위)** `spec/2-navigation/14-execution-history.md` 의 `## Overview (제품 정의)` 섹션을 `_product-overview.md` 로 통합하거나 구조를 동일 영역 다른 파일과 일치하도록 정리.
3. **(INFO — plan 정리)** 체크리스트 완료 plan 파일 2건(`trigger-schedule-reverse-sync.md`, `spec-update-trigger-schedule-sync.md`)을 `plan/complete/` 로 이동.
4. **(INFO — plan 항목 닫기)** `spec-update-trigger-schedule-sync.md §3` 의 `trigger-list §4.3/§4.4` 검토 항목을 "추가 수정 불필요"로 닫기.
5. **(INFO — 문서 보강)** `spec/2-navigation/1-workflow-list.md ## Rationale` 에 상태 필터 버그 수정 완료 이력 항목 추가.
6. **(INFO — worktree 정리)** MERGED된 `spec-sync-audit-998544` worktree 제거.