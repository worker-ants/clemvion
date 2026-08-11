# 의존성(Dependency) 리뷰

## 조사 방법
프롬프트에 포함된 9개 파일(`.claude/_shared/git_probe.py`, `.claude/skills/code-review-agents/lib/session.py`,
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/tests/test_consistency_bundle_priority.py`,
`.claude/tests/test_consistency_context_budget.py`, `.claude/tests/test_review_session_dir_collision.py`,
`codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`,
`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`)의 import 구문을 전수 확인하고,
실제 커밋 diff(`git show --stat HEAD`, `git diff HEAD~1 HEAD -- codebase/frontend/package.json`,
`git diff HEAD~1 HEAD -- .../spec-links.ts`)로 이번 변경이 의존성 매니페스트(`package.json`, `pnpm-lock.yaml`,
Python `requirements`류)를 건드렸는지 대조했다.

## 발견사항

- **[INFO]** 이번 커밋은 외부 의존성을 추가하지 않는다
  - 위치: 커밋 `62084e807` 전체 diff (`git show --stat HEAD`)
  - 상세: 변경 파일은 `codebase/frontend/src/lib/docs/__tests__/{plan-link-integrity.test.ts, spec-links.ts, spec-plan-completion.test.ts}`
    3개와 `plan/**.md` 문서뿐이다. `codebase/frontend/package.json`·`pnpm-lock.yaml`은 이번 diff 에 포함되지 않았다(`git diff HEAD~1 HEAD -- codebase/frontend/package.json` 출력 없음).
    Python 쪽 3개 파일(`.claude/_shared/git_probe.py`, `.claude/skills/code-review-agents/lib/session.py`,
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`)도 `git show --stat HEAD` 목록에 없어, 이 리뷰 세션이 함께 묶은 컨텍스트일 뿐 이번 커밋의 diff 대상이 아니다.
  - 제안: (조치 불필요) 새 패키지 도입이 없으므로 버전 고정/라이선스/취약점/번들 크기 항목은 이번 변경에서 실질적 리스크가 없다.

- **[INFO]** `spec-links.ts` 신규 함수는 기존 import 만 재사용, 새 import 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `collectPlanMarkdown`(신규 함수, `git diff HEAD~1 HEAD` 기준 추가분 43줄), `findBrokenPlanLinks`
  - 상세: 두 함수는 파일 상단에서 이미 import 돼 있던 `fs`(node:fs), `path`(node:path)와 파일 내부에 이미 정의된 `findBrokenLinksInFiles`만 사용한다. `git diff HEAD~1 HEAD -- .../spec-links.ts` 로 확인한 추가분(+43줄)에 `import` 문이 하나도 없다.
  - 제안: 없음. DRY 재사용이 적절하다.

- **[INFO]** 새 테스트 2개가 재사용하는 npm 패키지는 이미 `package.json`에 선언돼 있고 lockfile 로 고정됨
  - 위치: `codebase/frontend/package.json:49`(`gray-matter`), `:79`(`@types/mdast`), `:88`(`github-slugger`), `:91`(`mdast-util-from-markdown`), `:92`(`mdast-util-to-string`), `:94`(`vitest`)
  - 상세: `plan-link-integrity.test.ts`가 `github-slugger`/`mdast-util-from-markdown`/`mdast-util-to-string`을 (`spec-links.ts` 경유로) 간접 재사용하고, `spec-plan-completion.test.ts`가 `gray-matter`를 직접 import 한다. 두 패키지군 모두 2026-06-04(#457) 커밋에서 이미 도입돼 이번 diff 는 신규 추가가 아니다. `package.json`은 caret(`^`) 범위를 쓰지만 `pnpm-lock.yaml`이 실제 설치 버전을 고정하므로(monorepo 표준 방식, `project_pnpm_migration.md` 참고) 버전 고정 관점에서 별도 조치는 불필요.
  - 라이선스: `gray-matter`(MIT), `github-slugger`(ISC), `mdast-util-from-markdown`/`mdast-util-to-string`(MIT), `@types/mdast`(MIT), `vitest`(MIT) — 모두 permissive, 사내 프로젝트와 호환.
  - 제안: 없음.

- **[INFO]** Python 3개 파일은 표준 라이브러리 + 내부 모듈만 사용 — 오히려 내부 의존성 중복을 제거하는 방향
  - 위치: `.claude/_shared/git_probe.py:42-43`(`import os, subprocess`), `.claude/skills/code-review-agents/lib/session.py:3-5`(`json, os, datetime`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:20-26`(`argparse, json, os, re, subprocess, sys, datetime`) + 내부 모듈 `lib.session`, `lib.role_instructions`, `_lib.project_config`, `_shared.block_integrity`, `_shared.git_probe`, `_shared.retry_state` (`:38-53`)
  - 상세: 새 pip 패키지 없음. `git_probe.py` 자체가 "review_guard.py 와 plan_guard.py 의 byte-identical 5개 함수를 추출"한 산출물이라는 docstring(`:1-38`)대로, 세 소비처(`code_review_orchestrator`, `consistency_orchestrator`, 세 push-gate guard)가 각자 복제해 갖고 있던 git 프로브 로직을 단일 모듈로 합친 것 — 내부 의존성 그래프를 단순화하는 리팩터다.
  - 제안: 없음. 오히려 바람직한 방향(단일 진실 원천).

- **[INFO]** `spec-links.ts`는 `__tests__/` 디렉터리에 위치한 비-테스트 공유 헬퍼 — 기존 패턴 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts:5`(`import { collectPlanMarkdown, findBrokenPlanLinks } from "./spec-links"`)
  - 상세: `spec-links.ts`는 프로덕션 로직이 아니라 가드 전용 라이브러리이지만 테스트 폴더 안에 놓여 있어, 새 가드(`plan-link-integrity.test.ts`)가 여기 내부 의존을 하나 더 얹는 형태다. 다만 이는 2026-06-04(#457)부터 확립된 기존 컨벤션(`spec-link-integrity` 계열 가드가 같은 파일을 공유)이고 이번 diff 가 새로 만든 결합이 아니다.
  - 제안: 없음(참고용 INFO). 향후 세 번째 소비처가 생기면 `lib/docs/` 최상위로 승격을 고려할 수 있다.

## 요약
이번 diff(커밋 `62084e807`)는 `package.json`/`pnpm-lock.yaml`을 전혀 건드리지 않으며 신규 외부 패키지를 도입하지 않는다. 새로 추가된 함수(`collectPlanMarkdown`, `findBrokenPlanLinks`)와 신규 테스트 파일(`plan-link-integrity.test.ts`, `spec-plan-completion.test.ts` 확장)은 모두 2026-06-04(#457)부터 `package.json`에 이미 선언·lockfile 로 고정돼 있던 `gray-matter`/`github-slugger`/`mdast-util-*`/`@types/mdast`/`vitest`를 재사용할 뿐이며, 라이선스는 전부 MIT/ISC 로 프로젝트와 호환된다. 함께 묶인 Python 3개 파일도 표준 라이브러리와 내부 `_shared`/`lib` 모듈만 사용하고, 오히려 세 orchestrator/가드가 각자 복제하던 git 프로브·세션·retry-state 로직을 단일 모듈로 흡수해 내부 의존성 중복을 줄이는 방향이다. 의존성 관점에서 조치가 필요한 항목은 없다.

## 위험도
NONE
