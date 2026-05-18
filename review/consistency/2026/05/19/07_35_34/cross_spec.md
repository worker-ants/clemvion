# Cross-Spec 일관성 검토 — loop-count-policy plan

검토 대상: `plan/in-progress/loop-count-policy.md`
검토 모드: `--plan`
검토 시각: 2026-05-19

---

### 발견사항

- **[WARNING]** `output.count` 필드 — `node-output.md` §9.2 vs `3-loop.md` §5.2 불일치
  - target 위치: `plan/in-progress/loop-count-policy.md` — spec 변경 항목 (`spec/4-nodes/1-logic/3-loop.md` §5 수정)
  - 충돌 대상: `spec/conventions/node-output.md` §9.2 (`Principle 9.2 — 노드별 최종 output` 표), `spec/4-nodes/1-logic/0-common.md` §9.1 (line 168, 201)
  - 상세: `spec/conventions/node-output.md` Principle 9.2 는 loop 완료 시점 output 을 `{ iterations: [...], count: N }` 으로 명시한다. `0-common.md` §9.1 표 (line 168) 와 §11 색인 (line 201) 도 동일하게 `{iterations, count}` 를 기술한다. 반면 `3-loop.md` §5.2 의 JSON 예시는 `{ "iterations": [...] }` 만 포함하고, §5.7 표도 `{ iterations: [...] }` 로 표기한다. 또한 §5.2 note (line 143) 는 "CONVENTIONS Principle 1.1 (config↔output 직교) 준수를 위해 `output.count` 는 제공하지 않는다" 고 명시해 conventions 의 Principle 9.2 와 정면으로 충돌한다. 본 plan 은 `3-loop.md` 를 수정하므로 이 불일치를 함께 해소하거나 명시적 우선순위 결정을 남겨야 한다. 이 충돌은 plan 이 생성한 것이 아닌 pre-existing 이지만, spec 수정 작업이 포함된 이번 PR 이 정리할 적기다.
  - 제안: `3-loop.md` 수정 작업 범위에 다음 중 하나를 포함한다. (a) `node-output.md` §9.2 와 `0-common.md` §9.1/§11 에서 loop 행의 `count` 를 제거하고 "횟수는 `meta.iterations` 또는 `output.iterations.length` 를 사용한다" 로 정합화. (b) 또는 `3-loop.md` §5.2 를 `output: { iterations: [...], count: N }` 으로 되돌리고 §5.2 note 의 Principle 1.1 예외 사유를 삭제. 어느 방향이든 세 파일이 동일한 형태를 기술해야 한다. 결정은 `3-loop.md §8 Rationale` 에 인라인으로 남긴다.

- **[INFO]** `backend-labels.ts` 제거 — i18n Principle 3 동일 PR 의무 확인 필요
  - target 위치: `plan/in-progress/loop-count-policy.md` 작업 항목 — `frontend backend-labels.ts:328 "Count must be entered." ko 매핑 제거`
  - 충돌 대상: `spec/conventions/i18n-userguide.md` Principle 3
  - 상세: i18n Principle 3 은 "백엔드 warningRules[].message 가 변경되면 frontend `backend-labels.ts` 의 `WARNING_KO` 매핑을 **동일 PR 안에서** 갱신한다" 고 규정한다. 본 plan 은 `loop:no-count` warningRule 을 제거하면서 `backend-labels.ts:328` 제거를 작업 항목으로 포함하고 있어 규칙에 부합한다. 그러나 자동 가드 (P1-B) 가 `warningRules[].message` 를 정적 추출하므로, loop schema 에서 rule 이 제거된 시점에 `WARNING_KO` 에서도 동시에 삭제되지 않으면 빌드 테스트가 실패할 수 있다. plan 의 체크리스트 순서 (schema 먼저 → labels 나중) 가 단일 커밋이 아닌 단계 분할이면 중간 상태에서 빌드가 깨질 수 있음을 인지해야 한다.
  - 제안: `loop.schema.ts` warningRule 제거와 `backend-labels.ts` 항목 제거를 **동일 commit** 에 포함한다. 현재 plan 체크리스트는 두 항목이 분리되어 있으나, P1-B 자동 가드를 고려해 하나의 atomic commit 으로 처리하거나, spec 에 "두 변경은 동일 commit 에서" 를 명시한다.

- **[INFO]** `node-config-required-defaults-sweep` 와의 worktree 경계 확인
  - target 위치: `plan/in-progress/loop-count-policy.md` 전체 (`worktree: loop-count-policy`)
  - 충돌 대상: `plan/in-progress/node-config-required-defaults-sweep.md` (`worktree: node-config-required-defaults-sweep`)
  - 상세: sweep plan 은 `loop.count` 에 `ui.required: true` 를 추가하는 작업을 완료 체크(line 73 `[x]`) 로 표시하고, loop-count-policy 분리를 후속 follow-up 으로 연결 링크(line 83, 90)까지 기록했다. 두 plan 이 각각 다른 worktree 에서 `loop.schema.ts` 를 수정한다. sweep 이 PR merge 전 상태라면 loop-count-policy PR 이 선행되거나 rebase 정렬이 필요하다. sweep plan 의 `[x]` commit 2 완료 상태와 현재 main branch 의 실제 schema 상태가 일치하는지 확인이 필요하다.
  - 제안: loop-count-policy PR 분기 시점이 sweep PR merge 이후임을 확인한다. 만약 sweep 이 미merge 상태라면, loop-count-policy 브랜치를 sweep 브랜치에서 분기하거나 순서를 명시적으로 직렬화한다.

---

### 요약

target plan (`loop-count-policy`) 은 기존 spec 의 요구사항 ID·API 계약·RBAC·상태 전이 영역과 직접 충돌을 일으키지 않는다. 발견된 WARNING 은 plan 이 생성한 것이 아닌 pre-existing 한 `output.count` 필드 불일치로, `spec/conventions/node-output.md` §9.2 와 `spec/4-nodes/1-logic/0-common.md` §9.1 이 `{ iterations, count }` 를 기술하지만 `spec/4-nodes/1-logic/3-loop.md` §5.2 가 명시적으로 `output.count` 를 제외하는 상반된 입장을 취한다. 이번 plan 이 `3-loop.md` 를 수정하는 기회에 세 파일을 정합화하지 않으면 향후 다운스트림 표현식(`$node["Loop"].output.count`) 사용 여부에 대한 혼동이 지속된다. INFO 두 건은 i18n 동일 commit 원칙과 parent sweep PR 순서 관리에 대한 운영상 주의사항이다.

---

### 위험도

MEDIUM
