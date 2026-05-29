# 정식 규약 준수 검토 결과

**대상 문서**: `plan/in-progress/spec-draft-webhook-consistency.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-29

---

## 발견사항

### [CRITICAL] 대상 파일이 실제로 존재하지 않음

- **target 위치**: `plan/in-progress/spec-draft-webhook-consistency.md` (파일 자체)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §1` — "새 plan 은 항상 `plan/in-progress/` 에서 생성"
- **상세**: prompt_file 에는 target 문서 내용이 인라인으로 포함되어 있으나, 실제 파일 시스템에서 `plan/in-progress/spec-draft-webhook-consistency.md` 가 존재하지 않는다. Plan 문서는 반드시 실제 파일로 생성되어야 하고, `plan/in-progress/` 아래에 위치해야 한다. 현재 draft 상태이므로 파일이 아직 commit/write 되지 않은 상태로 보이지만, 이는 결국 규약상 파일이 없는 것과 동일하게 평가된다.
- **제안**: 문서를 `plan/in-progress/spec-draft-webhook-consistency.md` 로 실제 Write 한 뒤 worktree 에서 작업을 진행해야 한다.

---

### [CRITICAL] Frontmatter 에 필수 필드 `status` 누락

- **target 위치**: 문서 상단 frontmatter (라인 1-7)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마: `worktree`, `started`, `owner` 3필드 의무
- **상세**: 현재 frontmatter 에 `status: draft` 필드가 있으나, plan-lifecycle §4 의 의무 필드 스키마는 `worktree / started / owner` 3필드만 정의하고 있으며 `status` 는 plan-lifecycle 스키마에 없는 필드다. 반면 `spec-impl-evidence.md` 의 spec frontmatter 와 혼동될 수 있다. 문제의 핵심은 `owner: project-planner` 필드는 정상이나, `status: draft` 는 plan frontmatter 스키마에 없는 비정식 필드다. 그 자체가 직접 위반이라기보다는 spec frontmatter(`status: spec-only / partial / ...`) 와 혼동을 일으키는 비규약 필드다. 단, `source:` 필드는 인접 plan 파일(`webhook-url-env.md`)에도 동일하게 쓰이고 있어 실질적 패턴으로 보인다.
- **제안**: `status: draft` 를 제거하거나, 만약 plan 진행상태를 표시해야 한다면 plan-lifecycle 규약 자체에 `status` 필드를 추가하는 방향으로 규약 갱신을 제안한다. 현재 규약에 없으므로 불필요한 필드는 제거하는 것이 정합성 측면에서 바람직하다.

---

### [WARNING] 문서 제목이 CLAUDE.md 의 `spec-draft-` prefix 명명 컨벤션과 미정합

- **target 위치**: 파일명 `spec-draft-webhook-consistency.md` 및 문서 제목 `# spec-draft: webhook spec 정합화 ...`
- **위반 규약**: CLAUDE.md §정보 저장 위치 — `plan/in-progress/<name>.md`. `spec/` 의 `_product-overview.md`·`0-` prefix 컨벤션은 spec 문서에 적용. Plan 파일 자체는 별도 명명 제약 없음.
- **상세**: `spec-draft-` prefix 를 plan 파일명에 붙이는 패턴은 `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`, `spec-draft-chat-channel-error-notify.md`, `spec-draft-triggers-auth-column.md` 등 다수에서 일관적으로 사용되고 있어 실질적 프로젝트 컨벤션으로 정착한 상태다. 규약 문서(`plan-lifecycle.md`)에 명문화가 되어 있지 않다는 점이 경미한 경고이나, 본 문서의 파일명 자체가 잘못됐다기보다 규약 문서에 관행이 미기록된 gap 이다.
- **제안**: `plan-lifecycle.md` 에 `spec-draft-<slug>` 파일명 패턴을 관행으로 명시하거나, 기존 파일들과 일관성이 있으므로 현행 유지도 무방. 규약 문서 갱신 권장.

---

### [WARNING] `## 목적` 섹션 사용 — Overview / 본문 / Rationale 3섹션 구조 미적용

- **target 위치**: `## 목적` 섹션 (문서 초반)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
- **상세**: 본 문서는 plan 파일(`plan/in-progress/`)이지 spec 파일(`spec/`)이 아니다. 3섹션 구성 의무는 spec 문서에 적용되는 것으로, plan 문서에 직접 적용되는 규약은 아니다. 따라서 엄밀한 규약 위반은 아니나, 문서가 "spec draft" 를 plan 파일로 담고 있는 혼합 성격이라는 점에서 경고 수준으로 기록한다. 실제 spec 편집을 이 plan 기반으로 수행할 때, spec 파일들이 Overview / 본문 / Rationale 3섹션을 갖추는지 확인이 필요하다.
- **제안**: Plan 문서로서의 형식은 현재 패턴(`## 목적 / ## 코드 ground truth / ## 결정 테이블 / ...`)이 충분하다. spec 파일 편집 시 각 spec 에 Rationale 섹션 추가를 `## Rationale 기록 사항` 항목에서 의도하고 있으므로, 실행 단계에서 확인 필요.

---

### [WARNING] `## Rationale 기록 사항` 이 개별 spec 에 분산 반영되어야 함에도 집중 기술

- **target 위치**: `## Rationale 기록 사항 (각 spec ## Rationale)` 섹션
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 결정의 배경과 근거는 "해당 spec 문서 끝의 `## Rationale`" 에 있어야 한다. 본 plan 문서가 4개 spec 파일(`12-webhook.md`, `2-trigger-list.md`, `2-api-convention.md`, `10-triggers.md` + `0-overview.md`) 에 걸쳐 적용될 Rationale 내용을 일괄 정리하는 것은 draft 단계의 임시 집중 기록으로 이해될 수 있으나, 최종 적용 후 각 spec 의 `## Rationale` 에 분산 기록되지 않으면 단일 진실 원칙을 위반하게 된다.
- **제안**: 적용 완료 후 plan 의 Rationale 기록 사항을 각 spec 파일 끝 `## Rationale` 에 반영하고, plan 내 해당 섹션은 "각 spec 에 반영됨" 으로 처리하도록 `## 진행 메모` 의 적용 절차에 명시하면 좋다.

---

### [WARNING] `갱신 파일` 목록에서 `spec/0-overview.md` 가 CLAUDE.md 명명 컨벤션과 상충되는 표기

- **target 위치**: `## 갱신 파일` 섹션, 항목 4
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "`spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"; `spec/0-overview.md` 는 "루트, `0-` prefix" 로 cross-cutting 진입 문서
- **상세**: `spec/0-overview.md` 는 CLAUDE.md 에서 "제품 전체 개요·시스템 아키텍처·cross-cutting 진입" 문서로 명확히 정의되어 있다. 이 파일에 webhook URL 표기를 수정하는 것(`#3 /api/hooks/`, `#12 workspaceSlug 제거`)은 내용 측면에서 적절하나, 갱신 항목이 `0-overview.md` 임을 명시하면서 단순히 cross-cutting 정보 수정임을 확인할 수 있어 규약 범위 내 작업이다. 위반이라기보다 참고 차원 경고.
- **제안**: 특이사항 없음. `spec/data-flow/10-triggers.md + 0-overview.md` 가 한 줄로 묶인 것은 혼동을 줄이기 위해 별도 항목으로 분리 표기를 권장한다.

---

### [INFO] `source:` frontmatter 필드 — plan-lifecycle 스키마 비정식 필드

- **target 위치**: frontmatter `source:` 필드
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 정식 스키마는 `worktree / started / owner` 3필드
- **상세**: `source: webhook-url-env P0 / review/consistency/...` 는 plan-lifecycle §4 스키마에 없는 필드다. 인접 plan 파일 `webhook-url-env.md` 도 `source:` 를 사용하고 있어 프로젝트 내 관행으로 보이나 규약 문서에 명시되지 않아 비정식 상태다.
- **제안**: 관행으로 정착한 필드라면 `plan-lifecycle.md §4` 에 optional 필드로 추가하거나, 그렇지 않으면 본문에 이동시켜 규약 불일치를 해소한다.

---

### [INFO] `## 코드 ground truth` 섹션이 plan 본문에 있는 것이 단일 진실 원칙에 맞는가

- **target 위치**: `## 코드 ground truth (실제 read 검증 완료 — 2차 정정)` 섹션
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "기술 명세: `spec/<영역>/*.md` 본문"
- **상세**: 코드 read 검증 결과를 plan 문서에 담는 것은 draft 작업 과정의 중간 기록으로 적절하다. 단, 이 내용 중 정식 사실(`/api/hooks/:endpointPath`, `TransformInterceptor`, rate limit `100/min` 등)은 최종적으로 spec 본문에 반영되어야 하며 plan 에만 남으면 단일 진실 원칙 위반이 된다. 현재는 draft 단계이므로 INFO 수준.
- **제안**: 적용 완료 후 plan 의 ground truth 내용이 spec 4파일에 모두 반영되면, plan 은 `complete/` 로 이동해 참조 기록으로 남기면 된다. 미반영 상태로 plan 이 장기 `in-progress` 에 남지 않도록 주의.

---

## 요약

`plan/in-progress/spec-draft-webhook-consistency.md` 는 webhook spec 정합화를 위한 draft plan 문서로, 내용의 정합성은 높으나 정식 규약 관점에서 몇 가지 문제가 있다. 가장 심각한 것은 **파일 자체가 실제로 존재하지 않는다는 점**으로, plan-lifecycle 규약상 plan 은 `plan/in-progress/` 에 실제 파일로 존재해야 한다. Frontmatter 에 plan-lifecycle 스키마에 없는 `status: draft` 필드가 포함된 것도 비정식이다. 경고 수준으로는 Rationale 내용이 plan 에 집중 기술되어 있어 최종 적용 시 각 spec 파일 `## Rationale` 에 분산 반영이 이루어지지 않으면 단일 진실 원칙이 깨질 위험이 있다. 문서 구조와 의사결정 기록 자체는 충실하며, draft 단계의 임시 기록 성격에 비추어 전반적 완성도는 양호하다.

---

## 위험도

**MEDIUM**

> 실제 파일 미존재(CRITICAL) + frontmatter 비정식 필드(CRITICAL 경계) 가 있으나, 내용 자체는 코드 검증 기반으로 정합하고 spec 적용 전 게이트(`/consistency-check --spec`)가 별도로 설계되어 있어 시스템 invariant 즉각 파괴 수준은 아님. 파일 write + frontmatter 정리 후 MEDIUM → LOW 로 완화 가능.
