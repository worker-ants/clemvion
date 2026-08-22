# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부/내부 패키지 의존성 없음 — 오히려 중복 의존을 1건 제거
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (파일 전체 삭제, 162줄) — `import * as ts from 'typescript';`, `import * as sot from '@workflow/masked-markers';` 를 소비하던 두 번째 사본이었음. `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:20`(`import * as sot from "@workflow/masked-markers";`), `:18`(`import ts from "typescript";`)가 유일한 잔존 사본.
  - 상세: `git diff HEAD~1 HEAD --stat -- "*package.json" "pnpm-lock.yaml" "pnpm-workspace.yaml"` 로 확인한 결과 이번 PR 은 매니페스트·락파일을 전혀 건드리지 않는다(신규 npm/pip 패키지 0건). 오히려 backend 쪽에서 `typescript`(AST 파서) 와 `@workflow/masked-markers` 를 테스트 전용으로 재수입하던 사본(`masked-marker-mirror-guard.ts` + `masked-marker-mirror.spec.ts`, 총 354줄)을 통째로 삭제해 frontend 사본 하나로 수렴시켰다. 두 패키지 모두 `codebase/backend/package.json`(`typescript ^5.7.3`, `@workflow/masked-markers workspace:*`)에 여전히 선언돼 있지만 다른 소비처(`typescript`→ 다른 backend guard·spec 다수, `@workflow/masked-markers`→`shared/utils/sanitize-error-message.ts`)가 살아 있어 orphan 선언은 아니다.
  - 제안: 없음 — 긍정적 변경.

- **[INFO]** 공유 devDependency 패키지 추출안을 등록 표면 실측으로 기각 — "새 의존성 불필요성" 판단이 문서화됨
  - 위치: `plan/in-progress/mirror-guard-single-copy.md` "왜 공유 패키지가 아닌가 — 등록 표면 비교(실측)" 표 (게이트 35-38줄, 파일 헤더 diff 기준), 커밋 메시지(HEAD) 동일 표.
  - 상세: 이 PR 은 원래 트래커 항목("미러 가드 탐지 로직을 공유 test-utility 패키지로 재추출")을 그대로 이행하지 않고, "공유 devDep 패키지(신규 패키지 1개, 등록 표면 8곳 중 자동검증 2곳)" vs "전용 CI 잡(신규 패키지 0개, 등록 표면 5곳 전부 자동검증)"을 실측 비교해 후자를 택했다. 신규 내부 패키지 도입을 피하고 기존 워크플로 배선으로 문제를 푼 결정이며, 본 리뷰 관점(§1 새 의존성 필요성, §5 불필요한 의존성)과 정확히 부합한다.
  - 제안: 없음 — 근거가 실측(표)으로 남아 있어 추후 재론 시에도 참조 가능.

- **[INFO]** 신규 워크플로가 스택 무관하게 frontend pnpm install 을 매 `codebase/**` PR 에서 태움 (빌드 시간 영향)
  - 위치: `.github/workflows/repo-guards.yml` (신규 파일) — `mirror-guard` 잡, 게이트 62-86줄 (특히 76-79줄 `uses: ./.github/actions/pnpm-workspace` / `filter: 'frontend...'`, 82-86줄 vitest 실행).
  - 상세: `on.pull_request`/`on.push` 에 `paths:` 필터가 없고 `changes` 잡의 pathspec 이 `codebase/**` 전체(게이트 52줄)이므로, backend-only 나 web-chat-only PR 에서도 이 잡이 relevant 판정을 받아 `pnpm-workspace` composite action(`filter: 'frontend...'`, `--frozen-lockfile --strict-peer-dependencies`)으로 frontend 워크스페이스 전체를 설치한 뒤 vitest 스펙 1개만 돌린다. `frontend-checks.yml` 이 이미 같은 설치를 하는 frontend-touching PR 에서는 **두 번** 실행된다(워크플로 자체 주석 20-23줄이 이를 명시적으로 인지·수용). backend/web-chat 전용 PR 입장에서는 이전에 없던 frontend 의존성 설치 비용이 CI 시간에 새로 추가되는 것이므로 §6(의존성 크기: 빌드 시간 영향) 관점의 실비용이다. 다만 이는 커밋 메시지·plan 문서에서 "공유 패키지 추출"(devDep 신규 패키지 도입 + 등록 표면 8곳)과의 트레이드오프로 명시적으로 비교·수용된 결정이라 결함이 아니라 disclosed cost 다.
  - 제안: 없음(수용된 트레이드오프). 향후 CI 시간이 실측으로 문제가 되면 이 워크플로만 targeted 하게 최적화(예: 캐시 키 조정) 검토.

- **[INFO]** `actions/checkout@v7` 버전 고정 방식은 저장소 전역 컨벤션과 일치 (신규 불일치 없음)
  - 위치: `.github/workflows/repo-guards.yml:74` (게이트).
  - 상세: 태그 기반 고정(`@v7`, SHA 고정 아님)이며, `grep -rn "actions/checkout@" .github/workflows/*.yml` 로 실측한 결과 기존 워크플로 전체(`_changed-paths.yml`·`backend-checks.yml`·`frontend-checks.yml`·`harness-checks.yml` 등)가 동일하게 `@v7` 를 쓴다. 이번 PR 이 새 패턴을 도입하거나 기존과 어긋나게 만들지 않는다.
  - 제안: 없음.

## 요약

이번 PR 은 신규 외부/내부 패키지 의존성을 전혀 추가하지 않는다 — `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 변경이 0건이며, 오히려 backend 에 있던 `typescript`+`@workflow/masked-markers` 소비 중복 사본(테스트 전용 AST 파서 로직 354줄)을 삭제해 frontend 사본 하나로 수렴시켰다. plan 문서는 "공유 devDep 패키지로 추출" 이라는 원래 대안을 등록 표면 실측(8곳/자동검증 2곳 vs 5곳/자동검증 5곳 전부)으로 명시 기각했는데, 이는 정확히 "새 의존성이 정말 필요한가" 를 검증 가능한 근거로 판단한 사례다. 유일한 실비용은 신규 `repo-guards.yml` 워크플로가 스택 무관하게 `codebase/**` 변경 시 frontend pnpm install 을 태워 CI 시간을 소폭 늘린다는 점인데(frontend 를 건드리는 PR 에서는 `frontend-checks.yml` 과 중복 실행), 이는 워크플로 자체 주석과 plan 문서에서 트레이드오프로 명시 수용된 사항이다. 라이선스·취약점·버전 고정 관점에서 새로 도입되거나 갱신된 의존성이 없어 해당 관점의 리스크는 없다.

## 위험도
NONE
