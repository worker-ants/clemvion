# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/eslint.config.mjs

- **[INFO]** `@typescript-eslint/no-unnecessary-type-assertion` 규칙을 `error` 대신 `warn` 으로 등록한 결정
  - 위치: 라인 95 (파일 내)
  - 상세: 주석이 결정 근거(281건 기존 위반, `--fix` 시 import orphan cascade)를 명시하고 있어 의도가 분명하다. 규칙이 `error`(차단)가 아닌 `warn`(가시화)으로 설정된 것은 기술 부채 점진적 해소 전략으로 타당하다. spec 에는 ESLint 규칙별 severity 를 명시하는 문서가 없으므로 spec fidelity 관점 점검 대상 없음.
  - 제안: 현행 유지. 단, warn 건수가 장기간 줄지 않으면 opt-in 정리(`pnpm --filter backend lint:fix`)를 주기적으로 수행할 것을 권장.

### 파일 2: codebase/backend/package.json

- **[INFO]** `lint` 스크립트에서 `--fix` 제거, `lint:fix` 신규 스크립트 추가
  - 위치: `scripts.lint` / `scripts.lint:fix`
  - 상세: 변경 전 `lint` 가 `--fix` 게이트로 동작해 로컬에서만 파일이 자동 수정되고 커밋되지 않는 문제를 해소한다. 변경 후 `lint` 는 report-only(다른 패키지와 일관성 확보), `lint:fix` 는 명시적 opt-in. PROJECT.md 에서 `pnpm --filter backend lint` 를 lint 게이트로 참조하는 구조와 일치한다. 기능 완전성 관점 이슈 없음.
  - 제안: 현행 유지.

### 파일 3: codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts

- **[WARNING]** `"finds top-level in-progress plans to validate"` 테스트의 알려진 파일 탐색 기준 파일명이 변경 diff 와 실제 worktree 파일 기준으로는 `competitive-analysis-n8n-flowise.md` 이지만, main 트리의 파일(`/Volumes/project/private/clemvion/codebase/...`)은 아직 이전 값(`knowledge-base-quality-improvements.md`)을 참조한다.
  - 위치: 라인 53 (diff 기준 변경 라인)
  - 상세: 이 diff 는 worktree 에 적용 완료 상태이며, worktree 파일에는 `competitive-analysis-n8n-flowise.md` 가 정확히 반영되어 있다. `knowledge-base-quality-improvements.md` 는 `plan/complete/` 로 이동됐고 `plan/in-progress/` 에 존재하지 않으므로 이전 참조는 테스트 실패를 일으킨다. **변경 자체는 올바르다** — 단 PR merge 시 main 도 업데이트되어야 한다.
  - 제안: 현행 diff 적용(merge)으로 해소됨. 추가 조치 불필요.

- **[INFO]** `plans.length > 20` 기준값의 경직성
  - 위치: 라인 51 (전체 파일)
  - 상세: 현재 `plan/in-progress/` 에 63개 파일이 있어 임계값 20은 충분히 여유롭다. 향후 in-progress 가 대규모로 정리되어 20 이하가 되면 vacuous pass 방어가 약해질 수 있지만, 현 상황에서는 기능적 문제 없음.

### 파일 4: plan/complete/exec-single-node.md

- **[SPEC-DRIFT]** `spec_impact` 필드 포맷이 inline 문자열에서 YAML 리스트로 변경됨
  - 위치: frontmatter `spec_impact` 필드 (diff 기준 라인 5-8)
  - 상세: 변경 전 값은 `spec/3-workflow-editor/3-execution.md §1.3·§9·R; spec/5-system/13-replay-rerun.md §15(C3); spec/1-data-model.md §2.13` — spec 파일 경로에 섹션 참조(`§1.3`, `R`)를 포함한 자유 텍스트 형식이다. 변경 후는 YAML 배열로 파일 경로만 나열(`spec/3-workflow-editor/3-execution.md`, `spec/5-system/13-replay-rerun.md`, `spec/1-data-model.md`). `spec-plan-completion.test.ts` 가 `Array.isArray(impact)` 분기에서 각 항목이 실존 spec 파일인지 검증하는 구조와 일치하며, 섹션 참조를 포함한 이전 포맷은 경로 존재 확인(`fs.existsSync`)을 통과하지 못할 수 있다(경로에 ` §1.3` 등이 붙어 있기 때문). 따라서 **변경이 구조적으로 올바르고** 이전 포맷이 guard 를 우회했을 가능성이 있다.
  - `plan-lifecycle.md §5 Gate C` 본문 예시(`spec_impact:\n  - spec/5-system/4-execution-engine.md`)는 이미 YAML 리스트 형식만을 보여주고 있어 변경 후 포맷이 spec 과 일치한다. 단, 섹션 참조(§1.3, §9, R 등) 세부 정보가 제거되어 어떤 섹션이 영향을 받았는지 추적 정보가 소실된다.
  - 판단: 코드(plan 파일)는 올바른 방향으로 수정되었으나, `plan-lifecycle.md §5` 는 섹션 참조를 허용하는지/금지하는지 명시가 없다. spec 에는 "리스트 항목은 실존 spec 파일이어야 한다"만 있고 섹션 추가 허용 여부가 침묵 상태이므로 **코드가 맞고 spec 이 불완전**한 경우에 해당 — 기술적으로는 SPEC-DRIFT.
  - 제안: 코드 유지. spec `/Volumes/project/private/clemvion/.claude/docs/plan-lifecycle.md §5 Gate C` 에 `spec_impact` 리스트 항목은 "파일 경로만 허용(섹션 참조 불포함)"을 명시하도록 spec 갱신 필요 (`project-planner` 위임).

## 요약

4개 파일의 변경 모두 의도한 기능을 올바르게 구현하고 있다. `eslint.config.mjs` + `package.json` 의 lint 게이트 변경은 `--fix` 자동 수정이 커밋되지 않는 문제를 report-only + 별도 `lint:fix` 분리로 깔끔히 해소하며, 주석에 결정 근거가 명확히 기술되어 있다. `plan-frontmatter.test.ts` 의 기준 파일 교체는 `knowledge-base-quality-improvements.md` 가 `plan/complete/` 로 이동했으므로 필수 수정이며 worktree 파일은 이미 반영되었다. `exec-single-node.md` 의 `spec_impact` YAML 리스트 전환은 `spec-plan-completion.test.ts` 의 `fs.existsSync` 검증 구조와 정합하며, 이전 인라인 문자열 포맷(섹션 참조 포함)이 오히려 guard 를 통과하지 못할 수 있었다는 점에서 올바른 수정이다. Critical 발견사항 없음.

## 위험도

LOW
