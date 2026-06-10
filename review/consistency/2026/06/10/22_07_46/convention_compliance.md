# 정식 규약 준수 검토 — spec-draft-health-probe-status

**검토 대상**: `plan/in-progress/spec-draft-health-probe-status.md` (target 문서 내용은 prompt_file 에 embedded)
**검토 모드**: spec draft 검토 (--spec)
**검토 기준**: `spec/conventions/**`, `CLAUDE.md`, `.claude/docs/plan-lifecycle.md`

---

## 발견사항

### [CRITICAL] plan frontmatter 필수 필드 `started` 누락 — `created` 로 대체됨
- **target 위치**: frontmatter (YAML 블록 상단), `created: 2026-06-10`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 세 필드(`worktree`·`started`·`owner`)가 `plan/in-progress/*.md` 에서 **필수**. build guard `plan-frontmatter.test.ts` 가 강제.
- **상세**: target 문서의 frontmatter 는 `created: 2026-06-10` 을 사용하고 있으나, 규약이 요구하는 필드명은 `started` 다. `created` 는 규약 미정의 커스텀 필드이므로 `plan-frontmatter.test.ts` 가 `started` 를 찾을 때 누락으로 탐지해 **build 차단**이 발생한다. `worktree` 와 `owner` 는 올바르게 존재한다.
- **제안**: `created: 2026-06-10` → `started: 2026-06-10` 으로 필드명 교체. `created` 를 추가 정보로 유지하고 싶다면 `started` 와 함께 두는 것은 허용(`priority`/`status`/`title` 등 추가 필드 허용 명시).

---

### [WARNING] `worktree` 필드 값이 전체 경로로 기재 — 규약 기대값과 형식 불일치
- **target 위치**: frontmatter, `worktree: .claude/worktrees/health-probe-status-d9a184`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` 형식. 예시 값은 디렉토리 이름(`health-probe-status-d9a184`) 만이지 경로 prefix 없음.
- **상세**: 규약 예시는 `worktree: <task_name>-<slug>` 이며, 다른 plan 파일들은 디렉토리 이름만 사용한다. `plan_coherence` 충돌 검출이 값을 `.claude/worktrees/<value>` 로 해석한다면 전체 경로 포함 시 이중 prefix 로 오탐될 수 있다. `plan-frontmatter.test.ts` 가 형식을 엄격 검사하는지는 구현에 따라 통과할 수도 있어 CRITICAL 이 아닌 WARNING.
- **제안**: `worktree: health-probe-status-d9a184` (디렉토리 이름만). 다른 in-progress plan 의 `worktree` 값 패턴을 참조해 일관성 유지.

---

### [WARNING] `spec/data-flow/9-observability.md` 가 `spec-impl-evidence` frontmatter 의무 대상이 아님 — spec draft 가 이를 명시하지 않음
- **target 위치**: `## 영향받는 문서 → spec/data-flow/9-observability.md (substantive)` 섹션
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — frontmatter 의무 대상은 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/` 만. `spec/data-flow/` 는 목록에 없다.
- **상세**: target draft 가 `spec/data-flow/9-observability.md` 를 substantive 변경 대상으로 지목하지만, 이 spec 파일은 frontmatter(`id`/`status`/`code:`) 의무 적용 범위 밖이다. 따라서 health probe 관련 spec 변경이 spec-impl-evidence 가드로 추적되지 않아 향후 spec-coverage 감사에서 갭이 생긴다. 규약 자체의 위반이 아니라 커버리지 갭이므로 WARNING.
- **제안**: (a) draft 본문에 "9-observability.md 는 spec-impl-evidence 가드 범위 밖이므로 구현 후 spec-coverage 수동 감사 필요" 노트 추가. 또는 (b) `spec/data-flow/` 를 `spec-impl-evidence.md §1` 적용 대상 목록에 추가하는 별도 follow-up.

---

### [INFO] `target_specs` 필드는 비표준 frontmatter 키 — plan-lifecycle 스키마 미정의이나 허용 범위 내
- **target 위치**: frontmatter, `target_specs:` 키
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 의무 3 필드 외 추가 필드 허용이 명시되어 있어 가드 오류 없음. 단, `target_specs` 는 완료 시 Gate C 의 `spec_impact` 와 역할이 겹쳐 중복 선언이 발생할 수 있다.
- **상세**: `target_specs` 자체는 허용 범위다. 다만 완료 시 `spec_impact` 에 동일 경로를 선언해야 하는 Gate C 와 중복이 생긴다.
- **제안**: 완료 시 `spec_impact` 선언을 `target_specs` 목록 기준으로 채우도록 plan 체크리스트에 명시 권장.

---

### [INFO] 문서 구조 — `## 영향받는 문서` 는 plan 의 action 기술이지만 spec 이식 완료 여부 체크가 없음
- **target 위치**: `## 영향받는 문서` 섹션 및 `## 후속 (구현 — developer)` 섹션
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "기술 명세는 `spec/<영역>/*.md` 본문". plan 문서에 기술 내용이 서술되고 spec 에 이식하지 않으면 단일 진실 원칙 위배.
- **상세**: target plan 은 spec 변경 방향을 상세히 기술하고 있다. plan 이 complete 로 이동된 뒤에도 해당 내용이 spec 에 실제로 반영됐는지 추적 체크가 `## 후속` 에 명시되어 있지 않다.
- **제안**: `## 후속` 의 체크리스트에 "spec/data-flow/9-observability.md §1.1 + Rationale 갱신 완료 확인" 항목 추가 권장.

---

## 요약

target 문서는 의사결정 근거(Rationale), 영향 범위, 구현 방향이 명확히 기술된 양호한 spec draft plan이다. 그러나 **CRITICAL 1건**: plan frontmatter 의 필수 필드 `started` 가 누락되고 비표준 `created` 로 대체되어 build guard `plan-frontmatter.test.ts` 에 의한 차단이 예상된다. 추가로 `worktree` 값 형식 불일치 WARNING, `spec/data-flow/` 가 spec-impl-evidence 가드 범위 밖이라는 커버리지 갭 WARNING이 있다. CRITICAL 항목은 plan 파일 생성 전 즉시 수정이 필요하며, WARNING 항목은 구현 착수 및 spec 갱신 시 반드시 고려해야 한다.

## 위험도

CRITICAL
