# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-audit-resource-type-count.md`

## 발견사항

- **[INFO]** `동반 정정` 섹션이 이미 실행된 작업을 미해결로 서술
  - target 위치: `## 동반 정정 (spec 밖 — 같은 오기산이 전파된 3곳)` 전체
  - 위반 규약: 직접적인 `spec/conventions/**` 위반은 아님 — CLAUDE.md 플랜 라이프사이클(`plan/` 이 실제 상태를 반영해야 한다)과 인접
  - 상세: 현재 워킹트리를 실측하면 나열된 3건이 **이미 전부 반영돼 있다**.
    1. `codebase/backend/src/modules/metrics/business-metrics.service.ts:172-183` JSDoc 은 이미 "distinct 10종" 으로 정정돼 있고 producer 파일 수(12)와 라벨 카디널리티(10)를 구분해 설명한다.
    2. `plan/in-progress/spec-sync-auth-gaps.md` 에는 더 이상 "17개 감사 producer" 문구가 없다("12개 모듈"만 존재) — 이미 정정됨. 같은 파일 §129-133 은 이 항목을 `[x]` 로 체크하고 target 문서를 "경위와 실측 근거" 링크로 인용한다.
    3. `plan/complete/spec-draft-audit-write-failed-metric.md` 에는 이미 `## 정정 (2026-09-01, --impl-done consistency 16_02_03 WARNING)` 섹션이 원문 보존 + 정정 노트 형태로 추가돼 있으며, 정정 경위로 바로 이 target 문서를 인용한다.

    즉 target 문서 자신이 "정정 경위" 로 인용되고 있는 산출물이 이미 존재하는데, target 문서의 §동반 정정은 그 3건을 아직 하지 않은 일처럼 "함께 고친다" 로 서술한다. target 자신의 Rationale ("거짓 근거를 남기면 다음 사람이 그걸 믿고 같은 판단을 반복한다") 이 정확히 이 상황(스테일한 to-do 로 인한 중복 작업 유발)에 해당한다.
  - 제안: §동반 정정을 재실측해 이미 완료된 항목은 체크 표시(`- [x]`)로 전환하거나 섹션을 축소한다. (병렬 세션이 먼저 반영했을 가능성 — 사용자 메모 "백로그 착수 전 병렬 세션 머지 확인" 절차 적용 권장.) 이 항목의 사실관계 재확인은 본 리뷰의 1차 관심사(conventions)가 아니라 별도 consistency/staleness 리뷰의 소관일 수 있으므로 참고용으로만 표기.

- **[INFO]** `worktree:` frontmatter 값이 plan-lifecycle 문서의 예시 형식과 다름
  - target 위치: frontmatter 3행 `worktree: .claude/worktrees/audit-record-factory`
  - 위반 규약: [`​.claude/docs/plan-lifecycle.md §4`](../../../../../.claude/docs/plan-lifecycle.md) — 스키마 예시는 `worktree: <task_name>-<slug>` (디렉토리 **basename** 만)
  - 상세: 문서화된 예시는 `audit-record-factory` 처럼 basename 만 기대하나 target 은 `.claude/worktrees/` 전체 경로를 넣었다. 다만 `.claude/hooks/_lib/plan_guard.py::_normalize_worktree_value` 가 `.claude/worktrees/x → x` 정규화를 명시적으로 처리하므로 **push-gate 연결 판정은 깨지지 않는다** — 기능적 결함은 아니다. 같은 날 생성된 자매 문서 `plan/in-progress/spec-draft-avatar-storage-key.md` 도 동일하게 전체 경로를 쓰고 있어, 이 저장소에서 이미 자리잡은 변형 관행으로 보인다.
  - 제안: 문서화된 스키마 예시와 실제 관행이 갈렸다면 두 방향 중 하나로 수렴 — (a) target·자매 문서를 basename 만으로 정정, 또는 (b) `plan-lifecycle.md §4` 예시를 "basename 또는 `.claude/worktrees/` 전체 경로 모두 허용(정규화됨)" 으로 갱신. 기능 결함이 아니므로 CRITICAL/WARNING 은 아니고 문서 일관성 차원의 제안.

## 준수 확인 (위반 없음, 참고용)

- **frontmatter 필수 3필드**(`worktree`/`started`/`owner`) 모두 존재 — `plan-frontmatter.test.ts` 대상 스키마 충족.
- **`spec_impact`**: 리스트 형식(`- spec/5-system/_product-overview.md`), 대상 경로 실존 확인됨. Gate C 는 `complete/` 이동 시점에만 강제되므로 in-progress 단계 선언은 의무는 아니지만 금지도 아니며, 같은 날짜의 자매 draft(`spec-draft-avatar-storage-key.md`)도 동일 패턴 — 이 저장소의 `spec-draft-*` 관행과 일치.
- **파일 위치·명명**: `plan/in-progress/spec-draft-<name>.md` — `project-planner` SKILL.md §draft 작성 규칙과 정확히 일치.
- **문서 구조 (3섹션 권장)**: `## Overview` → 본문(`## 실측`, `## 변경 제안`, `## 동반 정정`) → `## Rationale` 순서로, 기존 `spec-draft-*` 선례(`plan/complete/spec-draft-audit-write-failed-metric.md` 등)와 동형. `## Overview (제품 정의)` 대신 단순 `## Overview` 를 쓰는 것도 draft 문서의 일관된 관행(정식 spec 문서가 아니므로 SKILL.md 의 spec 3섹션 표 그대로 적용 대상 아님).
- **`_product-overview.md` 대상 지정**: CLAUDE.md 정보 저장 위치 표의 "제품 정의·요구사항 | `spec/<영역>/_product-overview.md`" 명명 규칙과 일치, 실제로 해당 파일에 NF-OB-07 카탈로그가 존재함을 확인.
- **CLAUDE.md §자기-반증형 소정정 인용**: 조건 2("예고·트리거"에 한정, 제품 정의·요구사항·API 계약은 해당 없음)를 정확히 인용해 "이 카운트 값은 사실 서술이자 spec 카탈로그 항목이라 developer 단독 정정 예외에 해당하지 않는다"는 결론을 도출 — CLAUDE.md 원문과 어긋나지 않음.
- **쓰기 권한 경계**: `codebase/**`(business-metrics.service.ts JSDoc) 변경은 "developer 권한 안에서" 별도 처리한다고 명시해 CLAUDE.md 의 `spec/` = planner / `codebase/` = developer 경계를 스스로 존중.
- **설계 근거(클램핑 vs 닫힌 유니온) 일관성**: [`spec/data-flow/9-observability.md §Rationale`](../../../../../spec/data-flow/9-observability.md)의 "소스 시그니처가 이미 `string` 인 라벨은 클램핑으로 방어한다"는 기존 정식 결정과 target 의 "설계 결론은 바뀌지 않는다" 서술이 완전히 일치. 카운트 정정이 그 근거를 훼손하지 않는다는 판단도 타당.
- **`resourceType` 후보 배제(`workspace_invitation`, `alert_rule`)**: `spec/data-flow/9-observability.md:158` 의 `resource_type='alert_rule'` (알림 이벤트 로그) 이 감사(`AuditLogsService.record()`) 와 별개 도메인이라는 target 의 판단과 실제 spec 서술이 부합.
- **에러/명명 규약(`audit-actions.md`) 과의 관계**: `resourceType` 값(`user`/`trigger`/`workflow`/…)은 `audit-actions.md §1` 의 `<resource>.<verb>` 액션 명명에 쓰이는 동일 resource 어휘와 스타일이 일치(snake_case, 단수 명사) — 별도 도메인이지만 어휘 충돌 없음.

## 요약

target 문서는 `spec/conventions/**` 이 규정하는 명명·출력 포맷·문서 구조·API 문서 규약 어느 것도 직접 위반하지 않는다. `plan/in-progress/spec-draft-*.md` 파일 위치·frontmatter 필수 3필드·3섹션(Overview/본문/Rationale) 구조·`_product-overview.md` 명명·CLAUDE.md `spec/`↔`codebase/` 쓰기 권한 경계·§자기-반증형 소정정 인용까지 기존 확립된 관행과 정확히 정렬돼 있다. 다만 두 가지는 참고할 만하다 — (1) `worktree:` frontmatter 값이 plan-lifecycle 문서에 적힌 예시 형식(basename)과 다르게 전체 경로를 쓰는데 기능적으로는 정규화돼 문제가 없고 자매 문서에도 같은 패턴이 있어 CRITICAL 은 아니다, (2) §동반 정정에 나열된 3건이 실측 결과 이미 워킹트리에 전부 반영돼 있어 문서가 스스로의 최신 상태를 반영하지 못하고 있다 — 이는 엄밀히는 conventions 위반이 아니라 stale 서술 문제이므로 INFO 로만 표기한다.

## 위험도
LOW
