# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보(전문 인라인 authoritative, 파일도 이미 디스크에 존재). CRITICAL 0건.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(문서 자기서술 stale화 1건 + plan frontmatter 표기 오류 1건) 모두 기능적 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity(INFO로도 중복 지적) | `exec-cap:<workspaceId>` 를 `redis-keys.md §4` 에 신규 등재하면서, 같은 파일 §2("워크스페이스 세그먼트를 가진 키는 없다")와 `spec/5-system/4-execution-engine.md §9.2`("저장소 전체의 관례"라며 §2 인용)의 보편 서술을 정정하지 않아 두 문서가 서로 모순되게 남음. 기능 결함은 아니나 이 저장소가 스스로 정한 "예외는 명시적으로 각주 처리한다" 관례를 이번만 어김 | 변경안 B1/B2, `spec/conventions/redis-keys.md §4` 표 + B2 문단 (draft L132 부근) | `spec/conventions/redis-keys.md §2` 본문·Rationale ("현재 실재하는 키 중 workspaceId 세그먼트를 가진 것은 없다") / `spec/5-system/4-execution-engine.md §9.2` ("워크스페이스 세그먼트 없음"이 "저장소 전체의 관례"라며 §2 인용) | B2 문단에 "§2의 «워크스페이스 세그먼트 없음»은 §4(advisory lock)에는 적용되지 않는다" 또는 "exec-cap 은 §2가 명시한 예외 조건(워크스페이스별 쿼터)에 해당" 한 줄 추가. `4-execution-engine.md`를 `spec_impact`에 추가(권장)하거나 최소 B2에서 그 인용도 함께 무효화하는 문장을 남길 것 |
| 2 | convention_compliance | plan frontmatter `worktree:` 값이 규약 스키마(basename)와 달리 full-path(`.claude/worktrees/spec-trigger-lock-gaps-836689`) 형태 — in-progress plan 34개 중 유일. push-gate(`plan_guard.py`)는 정규화로 안전하지만 `.claude/tools/plan-stale-audit.sh`가 이중 접두 경로로 오탐(`MISSING`) 실측 확인 | `plan/in-progress/spec-draft-trigger-lock-gaps.md` frontmatter `worktree:` 필드 | `.claude/docs/plan-lifecycle.md §4` 스키마 주석 + 다른 33개 in-progress plan 의 bare-slug 관행 | `worktree: spec-trigger-lock-gaps-836689` (bare slug)로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `2-trigger-list.md §4.3` cascade 표 신설 행이 기존 행들과 반대 방향(하류 영향 아닌 상류 원인)을 담아 열 의미축 반전 | 변경안 A3, cascade 표 신규 행("상류 — workflow·workspace 삭제") | 컬럼 헤더에 방향 표기 추가 또는 표 위에 "하류 영향 + 상류 원인을 함께 담는다" 한 줄 안내 |
| 2 | naming_collision | 신규 락 키 리터럴 `trigger-config:<triggerId>`가 기존 프론트엔드 타입명 `TriggerConfig`와 표기상 인접(같은 대상을 가리키므로 의도된 상관관계, 충돌 아님) | 변경안 B1, `redis-keys.md §4` 신규 행 | 조치 불필요. 필요시 "TriggerConfig 타입과는 별개 표현" 한 문장 추가 가능 |
| 3 | plan_coherence | 트래커 항목 1의 편집 대상을 `15-chat-channel.md`가 아닌 `2-trigger-list.md`로 재배정(Rationale에 자체 정당화됨, 은폐 아님) | 변경안 A1 | 트래커 항목 1 체크 시 재배정 사유 한 줄 남기면 추적 용이 |
| 4 | plan_coherence | 트래커 developer 항목 7(창1 FK CASCADE 창 미검증)이 결정 없이 `⚠️` 잔여로 정직하게 승계됨 | 변경안 A2 말미 | 조치 불필요 — 표현 일치 확인됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `exec-cap` 워크스페이스 세그먼트 등재가 인접 보편 서술과 미정합(WARNING). 나머지 사실 관계(락 타임아웃·CASCADE 전수·PATCH 차단 경로 등) 전부 코드/마이그레이션과 일치 |
| rationale_continuity | LOW | 동일 stale화 이슈를 INFO로 중복 지적(§2만). Cafe24 advisory-lock 기각 사유 흡수 등 연속성 처리는 모범적 |
| convention_compliance | LOW | plan frontmatter `worktree:` 표기 오류(WARNING, audit 도구 오탐 실측). spec 본문 자체는 규약 위반 없음 |
| plan_coherence | NONE | 트래커 6항목 재실측 결과 전부 일치. 은폐된 결정 우회 없음, 미해결 항목은 정직하게 승계 |
| naming_collision | NONE | 신규 식별자는 advisory lock 키 2계열뿐이며 선점·재정의 없음. 새 spec/endpoint/이벤트/env 없음 |

## 권장 조치사항
1. `redis-keys.md §2`(및 가능하면 `4-execution-engine.md §9.2`)에 "advisory lock(§4)은 워크스페이스 세그먼트 없음 관례의 예외" 명시 문장 추가 — B1/B2 반영과 함께 처리.
2. plan frontmatter `worktree:` 값을 bare slug(`spec-trigger-lock-gaps-836689`)로 정정.
3. (선택) cascade 표 신규 행에 방향 축 안내 한 줄 추가.