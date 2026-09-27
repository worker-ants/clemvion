# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 검토 범위와 방법

target 은 spec 문서 자체가 아니라 **project-planner 의 spec draft plan 문서**(`plan/in-progress/spec-draft-cross-workspace-refs-2.md`)다. 적용되는 정식 규약은 (a) `spec/conventions/spec-impl-evidence.md` (frontmatter `pending_plans`/`status`/EXCLUDE_BASENAMES 등 lifecycle 규약), (b) `.claude/docs/plan-lifecycle.md` (plan frontmatter 스키마), (c) `.claude/skills/project-planner/SKILL.md` (draft 문서 구조 규약)이다. 각 주장을 실제 가드 구현·현재 spec 파일 상태와 대조했다.

## 대조 결과 (검증된 사실)

- **frontmatter 스키마**: `title`/`status`/`owner`/`worktree`/`spec_impact`/`started` 6필드 — `plan-lifecycle.md` §4 필수 3필드(`worktree`/`started`/`owner`) 충족 + 허용된 추가 필드(`title`/`status`/`spec_impact`). 같은 작업의 1차 draft(`plan/complete/spec-draft-cross-workspace-refs.md`)·다른 in-progress draft(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-nullable-notation-followups.md`)와 동일한 패턴 — 선례 일치.
- **문서 구조**: intro 산문 + `## 변경안` + `## Rationale`. `project-planner/SKILL.md` §"draft 작성" 규정("본문 끝에 `## Rationale` 로 결정 근거 명시")과 정확히 일치한다. (CLAUDE.md 의 Overview/본문/Rationale 3섹션 규칙은 `spec/` 문서 대상이며, plan draft 문서엔 별도로 `## 변경안`+`## Rationale` 구조가 적용된다 — 혼동 없음.)
- **plan 경로 표기(마크다운 링크 금지)**: target 은 `plan/in-progress/cross-workspace-refs.md` 를 백틱으로만 인용하고 마크다운 링크로 걸지 않는다. `spec-impl-evidence.md` §4 `spec-link-integrity.test.ts` 서술("spec 문서가 쓴 `plan/**` 링크도 검사 대상이라, plan 이동 시 갱신하지 않으면 build 가 깨진다")과 정확히 부합 — 이전 라운드 WARNING(20_35_40 W1)의 올바른 반영.
- **`pending_plans` in-progress↔complete 동치 검증** 주장(§4 가드가 in-progress 경로를 complete 로 치환해서도 찾음)을 `spec-pending-plan-existence.test.ts` 실제 코드로 대조 — `planRel.replace("/in-progress/", "/complete/")` 로 정확히 일치.
- **`1-data-model.md` EXCLUDE_BASENAMES 주장**을 `spec-impl-evidence.md` §1 원문("basename `1-data-model.md`·`6-brand.md`...`EXCLUDE_BASENAMES`에 등재")과 대조 — 정확. 해당 파일이 실제로 `id`/`status: implemented` frontmatter 를 갖고 있음(가드 미검증 대상이라 frontmatter 존재 자체는 무방)도 확인.
- **`1-workflow-list.md`/`0-canvas.md` 현재 `pending_plans` 목록에 `cross-workspace-refs` plan 이 없음**(문제로 지목한 상태)을 실제 파일에서 확인 — 정확.
- **`plan/complete/cross-workspace-refs.md` 미존재 + 현재 `1-workflow-list.md` Rationale §3 이 그 경로를 과거형으로 인용**하는 결함을 실제 파일 텍스트("`plan/complete/cross-workspace-refs.md` 가 생성에도 소속 검사를 더했다")로 확인 — target 의 문제 진단이 정확하고 처방(현재형 + in-progress 경로로 정정)이 규약과 일치.
- **`spec/1-data-model.md §1.1 참조의 소속`** 절 실존 확인 — 인용 앵커가 정확.
- 트래커(`spec-draft-nullable-notation-followups.md`)에 W3 항목이 실제로 등재돼 있음을 확인 — Rationale 의 "트래커 등재" 주장이 사실과 부합.

## 발견사항

- **[INFO]** `1-workflow-list.md` 정정 문장의 스펙-간 링크 보존 여부가 명시적이지 않음
  - target 위치: `## 변경안` 항목 3
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §4 `spec-link-integrity.test.ts` (spec↔spec 링크는 plan 링크와 달리 안정적이라 제한 대상이 아님)
  - 상세: 현재 `1-workflow-list.md` Rationale §3 원문은 규칙 인용부를 `[데이터 모델 §1.1](../1-data-model.md#11-참조의-소속)` 마크다운 링크로 건다. target 의 처방 문장("...규칙은 데이터 모델 §1.1.")은 이 부분을 그대로 유지하는지 평문화하는지 명시하지 않는다. item 3 의 지시("경로는 위 `pending_plans` 와 같은 표기, 시제는 현재형")는 plan 경로 표기·시제만 겨냥하므로 스펙 간 링크는 원래 형태(마크다운 링크) 유지가 합리적 해석이나, 구현 시 모호할 수 있다.
  - 제안: 규약 위반은 아니며 단순 명확화 제안 — 최종 spec 반영 시 "데이터 모델 §1.1 링크는 기존 마크다운 링크 형식 유지" 를 한 번 더 못박으면 다음 사람이 임의로 평문화할 여지가 줄어든다.

## 요약

target 문서는 project-planner 의 spec-draft plan 문서 표준 구조(frontmatter 3+필드, `## 변경안`+`## Rationale`)를 정확히 따르며, 앞선 라운드(20_21_21·20_35_40·20_45_35)에서 지적된 WARNING(«(Planned)» 라벨 금지, plan 경로 마크다운 링크 금지, marketplace 부정확 인용)을 모두 규약에 맞게 반영했다. `pending_plans`/`EXCLUDE_BASENAMES`/`spec-link-integrity`/`spec-pending-plan-existence` 등 target 이 인용하는 가드 동작을 실제 소스로 하나씩 대조한 결과 전부 사실과 일치했고, 수정 대상 spec 파일들의 현재 상태(누락된 `pending_plans` 항목, 존재하지 않는 `plan/complete/` 경로를 과거형으로 인용한 결함)도 실측과 부합했다. CRITICAL·WARNING 급 규약 위반은 발견되지 않았다.

## 위험도
NONE
