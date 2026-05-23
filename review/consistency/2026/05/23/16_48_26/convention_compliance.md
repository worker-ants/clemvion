# 정식 규약 준수 검토 결과

검토 모드: `--spec`
검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`
검토 일시: 2026-05-23

---

## 발견사항

### 1. 문서 구조 규약

- **[WARNING]** plan 문서가 spec 변경을 직접 기술하나 `## Overview` 섹션이 없음
  - target 위치: 문서 최상단 — `## 배경` 으로 시작
  - 위반 규약: `CLAUDE.md` 정보 저장 위치 표 / `project-planner/SKILL.md` §Spec 문서 구조 (3섹션 권장: Overview / 본문 / Rationale)
  - 상세: 본 파일은 `plan/in-progress/` plan 문서이므로 spec 3섹션 의무 대상은 아님. 그러나 `## 변경안` 섹션이 실질적으로 신규 spec(`spec/conventions/spec-impl-evidence.md`, `spec/conventions/user-guide-evidence.md`) 의 초안을 통째로 포함하고 있다. 이 초안은 별도 파일(`plan/in-progress/spec-draft-spec-impl-evidence.md` 등)에 분리하고 plan 본체는 "어떤 spec 을 신설한다" 수준의 요약만 담는 것이 CLAUDE.md 단일 진실 원칙에 부합한다.
  - 제안: 결정 A·B 의 스키마 정의·컴포넌트 코드 블록을 `plan/in-progress/spec-draft-<name>.md` 으로 분리하거나, `/consistency-check --spec` 호출 후 `spec/conventions/` 에 즉시 반영 예정임을 명시. 현재 구조는 기술적 위반은 아니나 plan 문서의 역할 경계가 흐림.

- **[INFO]** `## Rationale` 섹션 명칭 미사용
  - target 위치: 문서 끝부분 `## 의식적 결정 포인트 (Rationale 후보)` 절
  - 위반 규약: `project-planner/SKILL.md` §Spec 문서 구조 — 결정 배경·근거 섹션 제목은 `## Rationale` 권장
  - 상세: 이름이 `## Rationale 후보` 가 아닌 `## 의식적 결정 포인트 (Rationale 후보)` 로 되어 있어 3섹션 패턴의 표준 제목과 다름. plan 문서이기 때문에 엄격 적용 대상은 아니지만 spec 반영 시 `## Rationale` 로 통일해야 함.
  - 제안: plan 문서 내에서는 현행 유지 가능. 단 `spec/conventions/spec-impl-evidence.md` 등에 반영할 때는 반드시 `## Rationale` 제목을 사용.

---

### 2. 명명 규약

- **[WARNING]** `review/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 경로 신설 — CLAUDE.md 미등재
  - target 위치: 결정 C, `## 산출물 위치`
  - 위반 규약: `CLAUDE.md` 정보 저장 위치 표 — 코드 리뷰는 `review/code/`, 일관성 검토는 `review/consistency/`, 통합 검토는 `review/merge/`. `review/coverage/` 는 표에 없음.
  - 상세: `/spec-coverage` standing audit 결과를 `review/coverage/` 경로에 저장하도록 정의하고 있으나 CLAUDE.md 의 "정보 저장 위치 (단일 진실 원칙)" 표에 해당 경로가 정의되지 않음. 이 경로를 신설하려면 CLAUDE.md 표도 함께 갱신해야 한다. 갱신 없이 사용 시 다른 역할(agent)이 산출물 위치를 파악하지 못하는 invariant 깨짐이 발생.
  - 제안: 결정 E(`PROJECT.md` 갱신) 범위에 CLAUDE.md 표 갱신도 추가. 또는 `review/consistency/` 하위로 통합(`review/consistency/coverage/<timestamp>/`)하여 기존 경로 체계를 재사용. 사용자 결정 필요.

- **[INFO]** 후속 plan 파일명 중 `spec-frontmatter-rollout.md` — 접두어 패턴
  - target 위치: `## 후속 구현 plan (별 PR 5건)` 표, 순서 2
  - 위반 규약: `plan-lifecycle.md` §1 — 파일명 규약은 `plan/in-progress/<name>.md`. 특정 prefix 강제 없음.
  - 상세: 위반은 아님. `spec-` 접두어 사용은 일관성 있음 (기존 `spec-drift-*.md`, `spec-overview-*.md` 등과 동일 패턴). 문제 없음.
  - 제안: 현행 유지.

- **[INFO]** `.claude/agents/spec-impl-coverage-auditor.md` 경로 언급 — 실제 agents 디렉토리 구조와 정합 확인 필요
  - target 위치: 결정 C `## 변경안` — `/spec-coverage` 설명
  - 위반 규약: 직접 위반 아니나 `.claude/agents/` 가 현재 존재하는 경로인지 확인 불가 (검토 범위 밖). 후속 구현 plan 에서 경로 검증 필요.
  - 제안: 후속 plan 5(`spec-coverage-slash-command.md`) 작성 시 실제 경로 패턴 검증.

---

### 3. Frontmatter 스키마 규약

- **[CRITICAL]** plan frontmatter 에 `name:` 필드 포함 — `plan-lifecycle.md` 스키마 미정의 필드
  - target 위치: 문서 상단 frontmatter `name: spec-harness-impl-coverage`
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마 — 정의된 키: `worktree`, `started`, `owner`. `name:` 은 없음.
  - 상세: `plan-lifecycle.md` §4 의 스키마는 `worktree` / `started` / `owner` 세 키만 정의한다. 현재 target 문서에는 `name: spec-harness-impl-coverage`, `status: spec-only`, `created: 2026-05-23` 가 추가되어 있다. 이 중 `name:` 과 `status:` 는 plan-lifecycle 스키마 비정의 필드다. `created:` 는 `started:` 의 동의어로 보이나 키 이름이 다르다.
    - `status: spec-only` 는 결정 A 에서 정의하려는 *spec 파일* frontmatter 의 `status` enum 값과 동일 이름을 plan 문서에 적용한 것으로, plan 과 spec frontmatter 의 `status` 의미가 혼재될 우려가 있음.
    - `created:` vs `started:` 키 불일치.
  - 제안: plan frontmatter 를 `plan-lifecycle.md` §4 스키마 준수로 정정:
    ```yaml
    ---
    worktree: .claude/worktrees/harness-spec-impl-coverage-befc2f/
    started: 2026-05-23
    owner: lusiaz@gmail.com
    ---
    ```
    `name:`, `status:`, `created:` 제거. `status` 가 plan 문서의 상태 추적용으로 필요하다면 `plan-lifecycle.md` 스키마 자체를 갱신해야 한다.

- **[WARNING]** `worktree:` 값이 절대경로 형식 아닌 상대 경로 형식
  - target 위치: frontmatter `worktree: .claude/worktrees/harness-spec-impl-coverage-befc2f/`
  - 위반 규약: `plan-lifecycle.md` §4 — `worktree: <task_name>-<slug>` (디렉토리 이름만, 경로 아님)
  - 상세: `plan-lifecycle.md` §4 예시는 `worktree: <task_name>-<slug>` 로 이름만 기재함. 현재 문서는 전체 경로(`.claude/worktrees/harness-spec-impl-coverage-befc2f/`)를 기재. 일관성 체커의 `plan_coherence` checker 가 이 값을 파싱해 worktree 충돌을 검출하므로 형식 불일치는 파싱 오동작 위험이 있음.
  - 제안: `worktree: harness-spec-impl-coverage-befc2f` 로 수정 (디렉토리 이름만, trailing slash 없음).

---

### 4. 출력 포맷 / 산출물 경로 규약

- **[INFO]** `## 산출물 위치` 의 `spec 갱신:` 항목에 `.claude/docs/plan-lifecycle.md` 포함
  - target 위치: `## 산출물 위치` — `spec 갱신:` 줄
  - 위반 규약: CLAUDE.md 경로별 권한 표 — `.claude/docs/` 는 `project-planner` 쓰기 권한 표에 명시되지 않음 (`spec/**`, `plan/**` 만 명시)
  - 상세: `.claude/docs/plan-lifecycle.md` 갱신(§audit 절 추가)이 산출물로 포함되어 있으나 CLAUDE.md Skill 체계 표에서 `project-planner` 의 쓰기 권한은 `spec/**`, `plan/**` 이다. `.claude/docs/` 는 이 범위 밖. 현실적으로 `.claude/docs/` 변경은 프로젝트 운영 문서이므로 `project-planner` 가 수행하되, 사용자 명시 지시가 있어야 함. plan 에 이를 명시하거나 별 처리 경로 확인이 필요.
  - 제안: plan 에 "`.claude/docs/plan-lifecycle.md` 갱신은 사용자 승인 후 수행" 과 같은 주석 추가 또는 해당 파일의 편집 권한 정책을 사용자와 확인.

---

### 5. 금지 항목 점검

- **[INFO]** `spec-only` 30일 만료 → build fail 설계가 CI 강제성과의 균형
  - target 위치: 결정 A `status` 라이프사이클 — `spec-only` 항목
  - 위반 규약: 직접 금지 항목 없음. 단 기존 build-time 가드 설계 패턴 (`data-hydration-surfaces.md`, `interaction-type-registry.md`) 은 모두 "등록부 enumeration → 매칭 없음 fail" 패턴이며, 30일 TTL 기반 fail 은 신규 패턴.
  - 상세: 결정 A 에서 스스로 `## 의식적 결정 포인트 (2)` 에 이 trade-off 를 인정함. 규약 위반이 아니라 설계 선택이므로 INFO 등급. Rationale 에 명시된 것으로 충분.
  - 제안: 현행 유지 (이미 Rationale 후보로 포함됨).

- **[INFO]** `<ImplAnchor>` MDX 컴포넌트 신설이 기존 `i18n-userguide.md` 와의 정합
  - target 위치: 결정 B 전체
  - 위반 규약: `spec/conventions/i18n-userguide.md` — MDX 가이드 작성 규약 존재. `<ImplAnchor>` 컴포넌트가 `display: none` hidden 처리되는 것은 i18n 규약과 무관하나, MDX 작성 패턴 추가 시 기존 user-guide 작성 컨벤션과 충돌 없는지 신설 spec(`user-guide-evidence.md`) 에서 명시 필요.
  - 제안: 신설 `spec/conventions/user-guide-evidence.md` 에 "본 컨벤션은 `i18n-userguide.md` 와 직교: `<ImplAnchor>` 는 렌더 대상이 아닌 빌드 타임 가드 전용" 한 문장 추가.

---

## 요약

정식 규약 준수 관점에서 가장 중요한 위반은 plan frontmatter 스키마 불일치(CRITICAL: `name`·`status`·`created` 비정의 필드, `worktree` 형식 오류) 와 신규 산출물 경로 `review/coverage/` 가 CLAUDE.md 단일 진실 표에 미등재된 것(WARNING)이다. 나머지는 INFO 수준의 형식 일관성 제안이다. plan 문서에 spec 본문이 직접 내재된 구조는 기술적 규약 위반이라기보다 역할 경계 모호성 경고(WARNING)이며, consistency-check 완료 후 `spec/conventions/` 에 반영되면 자연스럽게 해소된다. 신규 규약 자체(결정 A–E)의 설계는 기존 conventions 와 정면 충돌하는 항목이 없으나, `review/coverage/` 경로와 CLAUDE.md 갱신, plan frontmatter 정정을 선행해야 invariant 를 유지한다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건: plan frontmatter 스키마 위반 — 운영 도구 파싱 오동작 가능. WARNING 2건: `review/coverage/` 경로 미등재, `worktree:` 값 형식 오류. 구현 차단 수준은 아니나 spec 반영 전 frontmatter 정정 필요.)
