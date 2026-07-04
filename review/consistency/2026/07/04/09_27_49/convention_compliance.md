# 정식 규약 준수 검토 — spec-draft-c3-context-drift.md

검토 모드: spec draft (`--spec`)
Target: `plan/in-progress/spec-draft-c3-context-drift.md`

## 발견사항

- **[CRITICAL]** draft frontmatter 누락 (`worktree`/`started`/`owner`)
  - target 위치: 문서 최상단 (frontmatter 없음, 1행부터 바로 제목)
  - 위반 규약: [`.claude/docs/plan-lifecycle.md` §4](../../../../../.claude/docs/plan-lifecycle.md#4-frontmatter-스키마) — "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다."
  - 상세: `plan/in-progress/spec-draft-c3-context-drift.md` 는 하위 그룹 폴더(예: `refactor/06-concurrency.md` 의 부속 material)가 아니라 top-level `plan/in-progress/*.md` 이므로 면제 대상이 아니다. 현재 frontmatter 자체가 없어 `worktree`(연결 worktree 귀속) · `started`(착수일) · `owner`(역할) 를 전혀 특정할 수 없다. 이는 push gate(`guard_review_before_push.py`)의 "연결 plan" 판정(§3 "연결 판정: in-progress plan frontmatter 의 `worktree:` 가 현재 worktree 와 매칭")을 무력화하고, `plan-stale-audit.sh` 의 worktree 존재 확인 대상에서도 누락시킨다. 실제 선례(`plan/complete/spec-draft-cron-to-bullmq.md`)는 `worktree`/`created`(=started 대응)를 frontmatter 로 명시하고 있어, 본 draft 의 누락은 규약과 실제 관행 양쪽에서 벗어난다.
  - 제안: frontmatter 에 `worktree: refactor-06-c3-a1b2c3` (현재 worktree 명), `started: 2026-07-04`, `owner: project-planner` (또는 실제 작성 역할) 를 추가한다.

- **[CRITICAL]** draft 본문에 `## Rationale` 섹션 부재 (SKILL.md 지정 draft 형식 위반)
  - target 위치: 문서 전체 — `## Δ4 — §Rationale 신규 "..."` 섹션만 존재하고 draft 자체의 `## Rationale` 섹션 없음
  - 위반 규약: [`.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번](../../../../../.claude/skills/project-planner/SKILL.md) — "**draft 작성**: `plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. **본문 끝에 `## Rationale` 로 결정 근거 명시.**"
  - 상세: `Δ4` 는 **spec 본문(`4-execution-engine.md`)에 삽입될 Rationale 텍스트의 초안**이지, "이 draft 를 이렇게 작성하기로 한 근거"(draft 자체의 결정 배경 — 왜 이 방식으로 정정하는지, 기각한 대안이 있는지, `/consistency-check --spec` 결과 반영 여부 등)를 다루는 draft-level `## Rationale` 이 아니다. 실제 완료 선례(`plan/complete/spec-draft-cron-to-bullmq.md`)는 draft 본문 끝에 별도 `## Rationale` 섹션을 두어 "신규 설계 결정·기각 대안 없음", "consistency-check --impl-prep 이 동일 변경으로 이미 BLOCK:NO 판정" 등 draft 자체의 근거를 기술한다. target draft 에는 이런 draft-level 근거 섹션이 없다 — `/consistency-check --spec` 수행 여부·BLOCK 판정 결과도 draft 안에서 확인 불가능하다.
  - 제안: 본문 끝(§Δ5 무결성/side-effect 뒤)에 draft 자체의 `## Rationale` 을 추가한다. 예: "본 draft 는 신규 설계 결정이 아니라 이미 구현된 상태(§6.2/§7.5/§9.1/§9.2/Rationale 모두 PR #795 등에서 이미 반영됨 — 아래 참고)의 spec 정직화다. `/consistency-check --spec` 실행 여부·결과를 명시." — 단, 아래 WARNING 참조(이미 반영 여부 확인 필요).

- **[WARNING]** target draft 의 Δ1–Δ4 내용이 이미 `spec/5-system/4-execution-engine.md` 에 실질적으로 반영되어 있음 (stale draft 가능성)
  - target 위치: Δ1(§6.2 저장 전략 표), Δ3(§9.2 Redis 키 표), Δ4(§Rationale 신규 항목)
  - 위반 규약: 직접적인 `spec/conventions/` 항목 위반은 아니나, [`.claude/docs/plan-lifecycle.md` §2 분류 기준](../../../../../.claude/docs/plan-lifecycle.md#2-분류-기준) 및 SoT 원칙("정보 저장 위치 단일 진실")과 충돌 — 실제로 이미 완료된 작업이 `in-progress/` 에 미완료 draft 로 남아 SoT 혼선을 유발한다.
  - 상세: `spec/5-system/4-execution-engine.md` 를 직접 읽은 결과, 다음이 이미 존재한다.
    - §9.2 표 아래에 "**실행 상태는 Redis 키가 아니다 (Phase-1 설계 대체)**" note 가 이미 존재하며 draft Δ3 이 요구하는 내용(제거된 6개 키 나열 + 대체 모델 서술 + `#rationale` cross-ref)과 사실상 동일하다.
    - `## Rationale` 섹션에 "### 실행 컨텍스트 in-memory + DB durable — Redis context store 미채택 (§6.2/§9.2, 2026-07-04)" 항목이 이미 존재하며, draft Δ4 가 요구하는 3근거(park-release 이중화/cross-instance 해소/성능·복잡도)와 `segmentStartMs` PR4 이연 언급까지 동일 내용으로 이미 서술돼 있다.
    - §6.2 저장 전략 표의 각 행("실행 중"/"노드 완료 시"/"waiting_for_input 진입 시"/"실행 완료 시")도 이미 `in-memory` / `PostgreSQL` 표기로 정정돼 있고 Redis 언급이 남아있지 않다.
    - Δ5 가 지목한 `execution-context.service.ts:55` 코드 주석도 이미 "**Segment-local in-memory execution context — by design (Redis store 미채택)**" 로 정정된 상태다.
  - 이는 draft 가 (a) 실제로는 이미 다른 작업(PR #795 "PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 등)에서 반영이 끝난 뒤에도 `in-progress/` 에 방치된 stale 문서이거나, (b) 애초에 코드 조사 시점 이후 문서가 이미 갱신됐는데 draft 재작성이 이를 놓친 경우로 추정된다. 어느 쪽이든 `plan/in-progress/refactor/06-concurrency.md` C-3 항목("미착수")과 실제 spec 상태 사이의 불일치를 방치하면, 다른 checker/개발자가 "아직 반영 안 됨" 으로 오판해 중복 작업을 유발할 위험이 있다.
  - 제안: 먼저 `4-execution-engine.md` 의 현재 §6.2/§7.5/§9.1/§9.2/Rationale 을 draft 의 Δ1–Δ5 각 항목과 라인 단위로 대조해, 이미 반영된 항목은 draft 에서 "적용 완료" 로 표시하거나 draft 자체를 폐기(→ `06-concurrency.md` C-3 를 완료로 갱신)한다. 실제 잔여 작업이 없다면 이 draft 문서는 `plan/in-progress/` 에 남겨두지 않고 `06-concurrency.md` 의 체크박스 갱신 + plan 전체 `complete/` 이동(Δ 무결성 섹션이 이미 "06-concurrency C-3 = 마지막 항목 → plan 전체 complete 이동" 이라고 명시한 대로)으로 마무리해야 한다.

- **[INFO]** §7.5 rehydration 관련 Δ2 내용의 반영 여부 별도 확인 필요
  - target 위치: Δ2 — §7.5 rehydration 절차
  - 위반 규약: 해당 없음 (사실 확인 권고)
  - 상세: 위 WARNING 과 동일한 맥락으로, §7.5 본문에서 "Redis context 가 살아있으면 그것 우선" 구식 문구가 남아있는지는 §9.2/§6.2/Rationale 만큼 명확히 확인하지 못했다(§7.5 전체 재확인이 이번 검토 범위상 부분적). Δ2 가 언급하는 `rehydrateContext` 의 `getContext` hit 최적화 문구가 실제로 반영됐는지 별도로 점검할 가치가 있다.
  - 제안: §7.5 rehydration 절차 원문을 Δ2 문구와 대조해, 미반영이면 그 부분만 실제 남은 작업으로 draft 에 좁혀 남긴다.

## 요약

target draft(`plan/in-progress/spec-draft-c3-context-drift.md`)는 두 가지 정식 규약을 직접 위반한다 — (1) top-level in-progress plan 필수 frontmatter(`worktree`/`started`/`owner`)가 완전히 누락돼 있어 plan-lifecycle 의 push-gate/연결판정 메커니즘을 무력화하고, (2) `project-planner` SKILL.md 가 지정한 "draft 본문 끝 `## Rationale`" 형식이 없다 — `Δ4` 는 spec 본문에 삽입할 텍스트 초안일 뿐 draft 자체의 결정 근거 섹션이 아니다. 더 중요하게는, draft 가 변경하려는 §6.2/§9.1/§9.2/Rationale 내용이 실제 `spec/5-system/4-execution-engine.md` 및 `execution-context.service.ts` 코드 주석에 **이미 거의 동일하게 반영되어 있음**을 확인했다 — 이는 규약 위반이라기보다 draft 의 stale 여부(이미 완료된 작업을 다시 in-progress 로 들고 있는 상태) 문제로, SoT 혼선과 중복 작업 위험을 낳는다. 실제 spec/코드 적용을 진행하기 전에 draft 내용과 현재 spec 상태를 라인 단위로 재대조하는 것이 우선이다.

## 위험도

HIGH
