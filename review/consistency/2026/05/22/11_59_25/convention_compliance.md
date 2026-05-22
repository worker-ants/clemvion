# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-triggers-edit-delete.md`

검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-22

---

## 발견사항

### [INFO] plan 내부에 삽입된 plan A/B draft 의 `worktree` 값에 slug 가 미확정
- target 위치: plan A (`plan/in-progress/trigger-list-row-actions.md`) frontmatter `worktree: trigger-list-row-actions-<slug>`, plan B (`plan/in-progress/trigger-detail-edit-meta.md`) frontmatter `worktree: trigger-detail-edit-meta-<slug>`
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마에서 `worktree` 는 **실제 worktree 디렉토리 이름**(`<task_name>-<slug>` 의 완성된 형태) 이어야 한다.
- 상세: plan A/B 의 `worktree` 필드에 `<slug>` 가 placeholder 로 남아 있다. plan-lifecycle 규약은 worktree 키가 실제 디렉토리 이름을 담도록 요구하며, placeholder 는 동시 작업 추적 및 `plan_coherence` checker 에서 오판을 유발할 수 있다.
- 제안: plan A/B 가 별도 ensure-worktree 를 실행한 뒤 실제 slug 가 확정되면 채워야 한다. 본 draft 문서가 "spec PR merge 후 즉시 진행할" 계획임을 감안할 때, worktree 가 아직 미생성 단계이면 `worktree: (미확정 — spec merge 후 생성)` 처럼 명시하거나, 실제 생성 후 갱신 예정임을 명기하는 것이 추적성에 유리하다.

### [INFO] plan A/B 의 `started` 날짜가 spec draft 와 동일 (2026-05-22)
- target 위치: plan A frontmatter `started: 2026-05-22`, plan B frontmatter `started: 2026-05-22`
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `started` 는 plan 파일이 **실제 생성되는 시점**의 ISO 날짜를 기록한다.
- 상세: plan A/B 는 "spec PR merge 후 즉시 진행" / "plan A 완료 다음 단계" 로 명시되어 있어, spec draft 와 동일 날짜(2026-05-22) 가 사전 선언이다. 실제 파일 생성 시점에 날짜가 다를 수 있으므로 "작성 예정" 임을 명확히 구분하거나, 실제 생성 시 날짜를 보정해야 한다. 엄밀한 위반은 아니나 추적성 관점의 주의 사항.
- 제안: plan A/B 본문 상단의 블록 쿼트에 "아래 frontmatter 는 실제 파일 생성 시 재입력" 안내를 추가하거나, spec draft 는 plan A/B 의 skeleton 만 제공하고 실제 frontmatter 는 생성 시점에 채우도록 명시한다.

### [INFO] plan A/B 가 spec draft 문서 내에 인라인 코드 블록으로 포함됨
- target 위치: `## plan A 신설 — plan/in-progress/trigger-list-row-actions.md` 이하 전체, `## plan B 신설 — plan/in-progress/trigger-detail-edit-meta.md` 이하 전체
- 위반 규약: CLAUDE.md 정보 저장 위치 원칙 — 진행 중 작업은 `plan/in-progress/<name>.md` (별 파일)에 존재해야 한다.
- 상세: CLAUDE.md 는 "단일 진실 원칙" 을 규정하고 있으며, plan 문서는 `plan/in-progress/<name>.md` 에 독립 파일로 위치한다. 본 draft 는 plan A/B 내용을 spec draft 의 일부 코드 블록으로 인라인 삽입하고 있다. spec draft 가 "신설 예정 plan 의 초안을 포함한다" 는 점을 감안하면, 실제 spec merge 전에 plan A/B 파일을 별도로 생성하지 않는 한 규약 위반은 아니다. 그러나 spec merge 이후 별도 파일 신설 없이 이 인라인 내용만 존재한다면 규약에 어긋난다.
- 제안: 본 draft 의 성격(spec merge 후 참조용 청사진)을 명확히 하고, spec merge PR 에 plan A 파일 신설을 체크리스트 항목으로 포함시킨다.

### [INFO] plan A/B 의 `owner: developer` 가 spec draft 의 `owner: project-planner` 와 혼재
- target 위치: 외부 plan A/B frontmatter `owner: developer`
- 위반 규약: CLAUDE.md Skill 체계 — `plan/**` 쓰기 권한은 project-planner 와 developer 모두에게 있으므로 엄밀한 위반은 아님.
- 상세: 규약 위반은 아니나, 본 spec draft 문서 자체(`owner: project-planner`) 와 내포된 plan A/B(`owner: developer`) 의 owner 가 다르다. developer 가 본 draft 를 읽고 plan A/B 를 생성할 것임이 명확하므로 의도된 것으로 보인다. 혼선 방지를 위해 한 줄 설명을 추가하면 좋다.
- 제안: 변경 불필요 또는 draft 본문에 "plan A/B 는 developer 가 spec merge 후 직접 생성" 을 명기.

### [WARNING] 에러 코드 명명이 spec 에서 직접 정의됨 — 공식 에러 처리 spec 과의 정합성 확인 필요
- target 위치: Change 4 `PATCH /api/triggers/:id` fine-print, Change 5 §4.4 결과·에러 — `TRIGGER_ENDPOINT_PATH_CONFLICT`, `TRIGGER_NOT_FOUND`, `VALIDATION_FAILED`
- 위반 규약: spec draft 가 cross-link 하는 `spec/5-system/3-error-handling.md` (에러 처리 spec) 의 에러 코드 enum 규약. 구체적으로 `spec/conventions/` 에는 에러 코드 명명 규약이 별도 파일로 없으나, `spec/conventions/node-output.md` Principle 3.2 는 `code` 가 `UPPER_SNAKE_CASE` 임을 규정하고 있으며 시스템 에러 코드 SoT 는 `spec/5-system/3-error-handling.md` 가 담당한다.
- 상세: `TRIGGER_ENDPOINT_PATH_CONFLICT`, `TRIGGER_NOT_FOUND`, `VALIDATION_FAILED` 는 모두 `UPPER_SNAKE_CASE` 형식으로 규약을 만족한다. 단, 이 에러 코드들이 실제로 `spec/5-system/3-error-handling.md` 에 등재되어 있는지 혹은 신규 추가가 필요한지가 본 draft 에서 명시되지 않았다. 에러 코드를 신규 정의한다면 `spec/5-system/3-error-handling.md` 에도 동일 PR 안에서 등재해야 한다.
- 제안: Change 4 / Change 5 에 "에러 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `TRIGGER_NOT_FOUND` 가 `spec/5-system/3-error-handling.md` 에 신규 등재 필요 여부를 확인" 항목을 명기하거나, 이미 등재된 범용 코드라면 그 근거를 cross-link 로 보완한다.

### [WARNING] API endpoint 명명에서 RPC-style sub-channel 패턴의 spec 참조가 v1.1 후속으로만 유예
- target 위치: Change 4 `POST /api/triggers/:id/auth/rotate-secret` 행 — "본 spec PR 에서는 약속만, 실제 endpoint 신설은 별 spec PR"
- 위반 규약: `spec/5-system/2-api-convention.md §2.2` (RPC-style sub-channel action 허용) — 본 draft 의 "의존·side-effect 메모" 에서 "이미 허용된 패턴에 부합. 별도 변경 없음" 이라고 명시하고 있어 위반은 아님. 단, 이 endpoint 를 §3 API 표에 v1.1 행으로 등재하면서 "약속만" 한다는 패턴이 spec 표에 미확정 행을 남긴다.
- 상세: 확정되지 않은 endpoint 를 spec 표에 placeholder 로 등재할 때, 카탈로그 규약(`spec/conventions/cafe24-api-catalog/_overview.md`) 은 `planned` status 를 사용하도록 정의한다. 트리거 API 표는 Cafe24 카탈로그 형식을 따르지 않지만, "약속만 등재" 패턴에 명시적 `(v1.1 후속)` 레이블링이 이를 대체하고 있다. 동일 spec 파일 안에 상태가 다른 행이 혼재하는 것이 독자 혼란을 줄 수 있다.
- 제안: v1.1 후속 행에 `> **NOTE**: 본 행은 예약 선언이며 실제 구현·spec 확정은 별도 spec PR 에서 이루어진다.` 블록 쿼트를 추가하거나, 아예 §3 표에서 제외하고 Rationale / 의존 메모에서만 언급하는 방식으로 정제를 권장한다.

### [INFO] spec draft 문서 구조 — "Overview / 본문 / Rationale" 3섹션 권장 구조 부분 미충족
- target 위치: 문서 전체 구조 (`## 배경`, `## 변경안`, `## plan A 신설 ...`, `## plan B 신설 ...`, `## 의존·side-effect 메모`, `## Rationale (draft 자체의)`)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 — 단, 본 문서는 spec 본문이 아니라 **plan 문서** 이므로 이 규약은 spec 파일(`spec/**/*.md`) 에 직접 적용된다. plan 문서 자체에는 명시적 3섹션 강제 규약이 없다.
- 상세: plan 문서에는 spec 3섹션 규약이 적용되지 않으므로 위반이 아니다. 단, 본 draft 가 "spec 본문에 반영될 변경안" 을 담고 있으므로, **변경안으로 제안된 spec 텍스트 자체**(`## 4. 삭제 정책`, `## Rationale` 신설)는 3섹션 권장을 잘 따르고 있어 긍정적으로 평가된다.
- 제안: 현 구조 유지. spec 변경안 자체(`## Rationale`)가 3섹션 구조를 충족하고 있어 추가 조치 불필요.

### [INFO] i18n 키 명명 — `triggers.rowActions.*` 계층 구조와 기존 사전 parity 확인 필요
- target 위치: plan A §3 i18n — `triggers.rowActions.viewDetails`, `triggers.rowActions.viewHistory`, `triggers.rowActions.editInSchedule`, `triggers.rowActions.delete`, `triggers.delete.*`, `triggers.deleted`, `triggers.deleteFailed`; plan B §3 i18n — `triggers.detail.*`, `triggers.webhook.*`, `triggers.schedule.*`
- 위반 규약: `spec/conventions/i18n-userguide.md` Principle 2 — ko/en 사전 leaf key parity. Principle 1 — UI 문자열은 dict 키 경유.
- 상세: 본 draft 는 신규 i18n 키 목록을 plan A/B 에 명기하고 있으며 "KO/EN parity 의무" 를 plan A §3 에서 명시하고 있다. 이는 i18n 규약 Principle 2 를 정확히 인식하고 있는 것이다. 단, 키들이 실제 `dict/ko` 와 `dict/en` 에서 기존 `triggers` section 에 추가될 때, 기존 `triggers.*` 키와 구조적 충돌이 없는지(한쪽이 branch, 다른 쪽이 leaf 인 경우)를 구현 착수 전에 점검해야 한다.
- 제안: plan A/B 구현 착수 직전 `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` (또는 해당 section 파일)의 기존 구조를 확인하고, `triggers.rowActions`·`triggers.detail`·`triggers.webhook`·`triggers.schedule` 등의 신규 branch 가 기존 구조와 충돌하지 않는지 검증을 추가한다.

### [INFO] `spec/2-navigation/2-trigger-list.md` 에 `## Rationale` 신설 — 문서 기존 구조 미확인
- target 위치: Change 6 — "본 문서는 현재 Rationale 섹션이 없다"
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: Change 6 는 이 규약을 정확히 이행하는 제안이다. "본 문서는 현재 Rationale 섹션이 없다" 고 명시하며 신설을 제안하는 것은 규약 이행을 위한 올바른 접근이다. 위반이 아니라 오히려 규약을 따르고 있다.
- 제안: 변경 불필요. Change 6 의 Rationale 신설은 CLAUDE.md 규약을 적극 이행하는 것으로 긍정 평가.

---

## 요약

`plan/in-progress/spec-draft-triggers-edit-delete.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. plan frontmatter 의 `worktree`·`started`·`owner` 형식, i18n 키 parity 의무 명시, Rationale 섹션 신설, 에러 코드 `UPPER_SNAKE_CASE` 준수 등 핵심 규약 항목을 충족한다. 주의가 필요한 부분은 두 가지다: (1) 신규 에러 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `TRIGGER_NOT_FOUND`)가 `spec/5-system/3-error-handling.md` 에 등재되어야 하는지를 본 draft 가 명시하지 않아 구현 착수 시점에 spec consistency 이슈가 될 수 있고, (2) v1.1 후속 API endpoint 를 §3 표 안에 약속 행으로 등재하는 패턴이 spec 표의 확정성을 낮출 수 있다. 두 항목 모두 CRITICAL 수준은 아니며, spec PR 작성 시 체크리스트 항목으로 다루면 충분하다.

---

## 위험도

LOW
