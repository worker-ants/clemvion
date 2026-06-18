# Convention Compliance Review

- **Target**: `plan/in-progress/spec-update-engine-split.md`
- **Mode**: spec draft 검토 (--spec)
- **Date**: 2026-06-18

---

## 발견사항

### 1. **[INFO]** `started` 필드 누락

- **target 위치**: frontmatter (라인 1–8)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수**. build guard `plan-frontmatter.test.ts` 가 강제.
- **상세**: frontmatter 에 `started: 2026-06-18`·`created: 2026-06-18` 두 개가 있는데, guard 가 요구하는 표준 필드명은 `started` 이고 `created` 는 비표준 추가 필드다. `started` 가 존재하므로 guard 는 통과하겠지만, `created` 와 `started` 가 동일 날짜임에도 중복 표기되어 있어 잉여 필드다. plan-lifecycle §4 는 `priority`/`status`/`title` 등 추가 필드는 허용한다고 명시하므로 guard 위반은 아니나, `created` 라는 비표준 필드가 관례상 없는 필드라 혼란 가능성이 있다.
- **제안**: `created:` 필드 제거 또는 주석으로 처리. `started:` 하나로 족함.

---

### 2. **[WARNING]** `spec_impact` 필드 없음 (Gate C 대비)

- **target 위치**: frontmatter (라인 1–8)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §5 Gate C` + `spec/conventions/spec-impl-evidence.md §4.2` — `started ≥ 2026-06-04` 인 plan 은 `complete/` 이동 시 frontmatter 에 `spec_impact` 선언 필수. in-progress 단계에서는 의무 아니나, 본 draft 는 spec 변경이 전제된 plan 이므로 이동 시점에 선언 누락 위험이 높다.
- **상세**: 본 plan 의 `started: 2026-06-18` 은 grandfather cutoff(`2026-06-04`) 이후이므로 `complete/` 이동 시 `spec_impact` 선언이 build guard `spec-plan-completion.test.ts` 에 의해 강제된다. 본 plan 이 `spec/5-system/4-execution-engine.md` 등 여러 spec 파일을 건드리는 작업임이 본문에 명확히 기술되어 있으므로, 완료 이동 시 `spec_impact:` 목록 작성이 필요하다. 이 정보가 frontmatter 에 미리 draft 형태로 없으면 이동 시 누락 리스크가 있다.
- **제안**: 완료 이동 commit 에서 아래를 추가할 것을 명시 (in-progress 단계 의무 아님, 경고 수준):
  ```yaml
  spec_impact:
    - spec/5-system/4-execution-engine.md
    - spec/4-nodes/0-overview.md
    - spec/4-nodes/3-ai/1-ai-agent.md
    - spec/conventions/interaction-type-registry.md
    - spec/conventions/node-output.md
    - spec/4-nodes/6-presentation/0-common.md
    - spec/data-flow/3-execution.md
  ```

---

### 3. **[INFO]** `parent` 필드가 plan-lifecycle 비표준 필드

- **target 위치**: frontmatter, `parent: plan/in-progress/refactor/c1-engine-split.md …` (라인 5)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 필드는 `worktree`·`started`·`owner`. 추가 필드(`priority`/`status`/`title` 등)는 허용하지만, `parent` 는 관례 필드로 명시되지 않은 자유 확장.
- **상세**: `parent` 필드는 plan-lifecycle 에서 정식 정의된 필드가 아님. 그러나 추가 필드는 허용되므로 guard 위반은 없다. 다만 일관성 차원에서 여러 plan 이 제각각 parent 표현 방식을 쓰면 향후 plan-coherence 툴에서 파싱 실패 가능성이 있다.
- **제안**: 현재로선 INFO 수준. 향후 plan-lifecycle 에서 `parent:` 를 정식 필드로 정의하거나, 본문 내 참조 링크로 대체하는 방향이 더 표준적.

---

### 4. **[INFO]** 문서 구조 3섹션 (Overview / 본문 / Rationale) 패턴 부재

- **target 위치**: 본문 전체 구조
- **위반 규약**: CLAUDE.md `§정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장.
- **상세**: 본 문서는 `plan/in-progress/` 의 작업 plan 이므로 spec 문서 3섹션 규약의 **직접 적용 대상이 아니다** (CLAUDE.md 규약은 `spec/` 문서에 적용). plan 문서에는 plan-lifecycle §4 frontmatter 스키마가 적용되며 3섹션 구조는 의무가 아니다. 따라서 규약 위반 아님 — INFO 로만 기록.
- **제안**: 현 상태 유지. 본문에 "비고" 섹션이 있고 실행 절차·변경 내역이 명확히 분리되어 있어 plan 문서로서 적절한 구조임.

---

### 5. **[INFO]** `spec/conventions/interaction-type-registry.md` 변경 예고: `code:` 포인터 갱신 방향 확인 필요

- **target 위치**: `## 변경 (spec 파일별)` → `spec/conventions/interaction-type-registry.md §1.1·§1.2` 섹션
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `code:` 는 spec 이 약속한 surface 의 구현 경로이며 `status: implemented` 시 ≥1 매치 의무.
- **상세**: 현재 `interaction-type-registry.md` frontmatter 의 `code:` 에는 이미 `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 가 포함되어 있음(실제 파일 확인: 라인 7–8). 따라서 본 draft 가 "frontmatter `code:` 에 `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 추가" 라고 기술한 변경은 이미 반영된 상태일 가능성이 있다 — 중복 추가 시 guard 는 통과하지만 중복 항목이 생긴다.
- **제안**: spec 적용 전 현재 `interaction-type-registry.md` frontmatter 를 재확인하여 이미 추가된 항목은 변경 불요로 처리할 것.

---

## 요약

`plan/in-progress/spec-update-engine-split.md` 는 plan-lifecycle 규약의 필수 frontmatter 3개 필드(`worktree`·`started`·`owner`) 를 모두 보유하고 있으며, 문서 본문 구조·명명·섹션 패턴도 plan 문서로서 적절하다. 주요 규약 위반은 없다. 다만 (a) Gate C(`spec_impact`) 선언이 완료 이동 시 필수인데 frontmatter draft 가 없어 이동 시 누락 리스크가 있고(WARNING), (b) `created:` 중복 필드와 `parent:` 비표준 필드가 있으나 허용 범위 내다(INFO). `interaction-type-registry.md` `code:` 항목이 이미 최신화되어 있을 가능성이 있어 적용 전 확인이 권장된다(INFO).

## 위험도

LOW
