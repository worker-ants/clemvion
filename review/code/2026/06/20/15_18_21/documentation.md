### 발견사항

- **[INFO]** `codebase/backend/README.md` 스크립트 표의 `npm` 명령어가 pnpm 전환 미반영
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/README.md` lines 7–9 (`npm install`, `npm run start:dev`) 및 스크립트 표 전체
  - 상세: 이번 diff 는 `lint`/`lint:fix` 행을 올바르게 추가했으나, README 나머지 부분은 여전히 `npm` 기준이다. PR #646 에서 pnpm workspace 로 전환됐으므로 실행 섹션의 `npm install`, `npm run start:dev` 및 스크립트 표의 모든 `npm run *` 표기가 `pnpm` 또는 `pnpm run` 으로 정정되어야 한다. 이번 PR RESOLUTION 에서 INFO #7 로 인지하고 "별도" 처리를 결정했으나, 독자가 README 를 신뢰하고 `npm` 명령을 실행하면 동작이 달라질 수 있어 문서 정확성 관점에서 가시화한다.
  - 제안: 별도 PR 또는 이번 PR 에 `npm` → `pnpm` 전수 교체를 포함하도록 권고. 최소한 실행 섹션(`npm install`, `npm run start:dev`)부터 교체.

- **[INFO]** `codebase/backend/eslint.config.mjs` 내 인라인 주석의 `pnpm --filter backend lint:fix` 표기가 모노레포 루트 실행 방법을 안내하나 워크스페이스 필터 문법 정확성 확인 필요
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/eslint.config.mjs` line 123 (주석 내 `pnpm --filter backend lint:fix`)
  - 상세: 주석의 `pnpm --filter backend lint:fix` 는 동작하는 올바른 문법이나, 모노레포 루트가 아닌 `codebase/backend/` 내에서 직접 실행 시에는 `pnpm lint:fix` 로 충분하다. 독자(특히 패키지 내부에서 작업하는 개발자)가 주석을 그대로 복사해 패키지 디렉토리에서 실행할 경우 혼란 가능. 설명 보완이 권장된다.
  - 제안: 주석에 "모노레포 루트에서: `pnpm --filter backend lint:fix`, 패키지 내: `pnpm lint:fix`" 와 같이 컨텍스트 명시.

- **[INFO]** `plan/complete/exec-single-node.md` `spec_impact` 포맷 변경 시 섹션 참조 정보 소실
  - 위치: `/Volumes/project/private/clemvion/plan/complete/exec-single-node.md` frontmatter
  - 상세: 이전 형식 `spec/3-workflow-editor/3-execution.md §1.3·§9·R` 에는 구체적 섹션 번호와 Rationale 표시(`R`)가 포함되어 있었다. YAML 리스트로의 정규화는 파싱 안정성을 높이지만, `§1.3·§9·R` 같은 세부 위치 정보가 제거된다. 완료 문서이므로 추적 영향은 낮으나, 향후 동일 패턴이 다른 plan 파일에 적용될 때 섹션 수준 참조 정보의 유실이 반복될 수 있다.
  - 제안: `spec-impact` 형식 명세(`.claude/docs/plan-lifecycle.md §5`)에 "섹션 참조는 별도 `spec_impact_notes` 필드 또는 본문 주석으로 보존" 규칙 추가를 `project-planner` 에 위임 (RESOLUTION INFO #1 에서 이미 언급됨, 후속 확인 권장).

- **[INFO]** `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 테스트 파일 상단 모듈 수준 주석이 변경된 sentinel 검증 방식과 여전히 부합하는지 확인
  - 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` lines 424–435 (파일 헤더 주석)
  - 상세: 헤더 주석은 "Scope = `plan/in-progress/*.md` (top level only)" 등 구조를 올바르게 기술하며, 변경된 sentinel 검증 로직과 충돌하지 않는다. 단, 추가된 인라인 주석(lines 469–471)이 "ai-review WARNING#1" 를 참조하는데, 이는 리뷰 내부 식별자다. 외부 독자(신규 기여자)에게 이 참조는 불투명하며 어느 리뷰 세션인지 탐색이 필요하다.
  - 제안: 인라인 주석의 `(ai-review WARNING#1)` 를 보다 자명한 설명 "(특정 파일명 의존 제거 — complete/ 이동 시 재발 방지)" 으로 대체하거나, 리뷰 경로를 함께 명시.

### 요약

이번 변경의 문서화 처리는 전반적으로 양호하다. 핵심 변경인 `lint` → report-only 전환과 `lint:fix` 신설은 `codebase/backend/README.md` 스크립트 표에 즉시 반영됐고, `eslint.config.mjs` 의 인라인 주석은 결정 배경·대안 거부 이유·opt-in 정리 방법까지 충분히 설명한다. `plan-frontmatter.test.ts` 에 추가된 주석도 변경 의도를 명확히 전달한다. 잔여 이슈는 모두 INFO 수준으로, `npm` → `pnpm` 전수 교체 미완료(기존 이슈, 별도 처리 결정)와 `spec_impact` 섹션 참조 소실(spec 명세 업데이트로 후속 위임)이 주를 이룬다. 리뷰 내부 식별자 참조(`ai-review WARNING#1`) 는 향후 가독성 개선 대상이나 즉각 차단 요인은 없다.

### 위험도

LOW
