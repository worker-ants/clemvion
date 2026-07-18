# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 신규 "repo-guards" 디렉터리가 기존 "meta 가드 테스트" 배치 관례와 다른 위치 패턴을 만든다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`, `internal-package-registration.test.ts` (신규 디렉터리)
  - 상세: 이 저장소에는 이미 "자기참조형 저장소 가드" 테스트 선례가 있다 — `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`, `interaction-type-exhaustiveness.test.ts` 는 모두 `src/lib/__tests__/` 바로 아래에 flat 하게 위치한다. 이번 PR 은 같은 성격(레포 CI/빌드 배선 drift 가드)의 새 테스트를 위해 별도 최상위 `repo-guards/` 서브디렉터리를 신설했다. 파서 로직을 `__tests__/` 안의 비-test 모듈로 분리하는 패턴 자체는 `lib/docs/__tests__/spec-links.ts`, `lib/workspace/__tests__/href-guard-utils.ts` 등으로 이미 선례가 있어 문제 없으나, "어떤 도메인 폴더 밑에 두는가" 축에서는 이번이 처음으로 도메인이 없는 cross-cutting 가드를 위한 전용 폴더를 만든 사례다.
  - 제안: 의도된 선택이라면(도메인이 없는 meta 가드를 위한 새 홈), `repo-guards/` 를 향후 유사 가드(예: eslint-layering-guard)의 표준 위치로 삼을지 여부를 짧게 문서화(예: 이 테스트 파일 헤더나 `spec/conventions/`)해 두면 다음 가드 추가 시 위치가 다시 흩어지는 것을 막을 수 있다. 급하지 않음.

- **[INFO]** `internal-package-registration.test.ts` 내 `describe` 블록 간 변수명 `internal` 재사용
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:933` (실측 파싱 결과) vs `:1197` (`missingFromStage` 합성 fixture 섹션의 로컬 상수)
  - 상세: 최상위 `describe` 스코프의 `internal = internalPackages(sh)`(실제 저장소 상태)와, 아래쪽 합성 fixture `describe("missingFromStage — …")` 안의 `const internal = ["@workflow/a", "@workflow/b"]`(가짜 데이터)가 이름이 같다. 각각 다른 클로저라 런타임 충돌은 없지만, 같은 파일을 위→아래로 훑는 리뷰어/유지보수자가 "실측값"과 "합성값"을 혼동할 여지가 있다.
  - 제안: 합성 fixture 쪽을 `fixtureInternal` 등으로 구분하면 스캔 시 모호함이 줄어든다. 우선순위 낮음.

- **[INFO]** bash 함수 본문 추출(`fnBody`)과 pnpm 호출 파싱(`explicitFilterCalls`)이 lookaround 를 포함한 여러 정규식에 의존
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:442-495` (`fnBody`, `explicitFilterCalls`)
  - 상세: `/^\s*(\{|[A-Za-z_]\w*\(\)\s*\{)\s*$/m`, `/(?<!<)<<-?(?!<)/` 같은 정규식은 개별적으로는 잘 주석돼 있지만, bash 문법을 정규식으로 근사하는 접근이라 향후 test-stages.sh 구조가 바뀌면(예: 새 중첩 블록 패턴) 파서가 자기 자신의 known-limitation throw 에 걸리거나 무언가를 놓칠 여지가 구조적으로 남는다.
  - 제안: 현재는 "조용히 틀리느니 깨지게" 설계(각 알려진 사각지대를 fail-loud 로 명시적으로 차단)로 리스크를 상쇄하고 있어 추가 조치가 시급하진 않다. 향후 test-stages.sh 의 `cmd_*` 함수가 더 복잡해지면(중첩 함수/블록 도입) 정규식 기반 대신 실제 bash 파서(예: `bash -n --dump-po` 류나 shellcheck AST)로 교체를 고려.

## 요약
전반적으로 코드 품질이 높다. 네이밍(`fnBody`, `explicitFilterCalls`, `missingFromStage`, `backendWorkflowDeps` 등)은 목적을 명확히 드러내고, 각 함수는 짧고 단일 책임에 가깝다(정규식 파싱과 검증 로직을 한 함수에 묶은 곳도 "조용한 무력화 방지"라는 명시적 근거가 주석에 있다). 매직 넘버(`MAX_DEPTH = 12`)는 근거가 딸려 있고 실측(7단계)과도 일치한다. 순수 로직(`internal-package-registration-guard.ts`)과 소비처(`*.test.ts`)의 분리, `__tests__/` 안에 비-test 헬퍼 모듈을 두는 패턴은 `lib/docs/__tests__/spec-links.ts`·`lib/workspace/__tests__/href-guard-utils.ts` 등 기존 코드베이스 관례와 일치한다. 다만 이번에 신설된 `repo-guards/` 최상위 디렉터리는 기존 "자기참조형 가드" 선례(`lib/__tests__/eslint-layering-guard.test.ts`)와는 다른 위치 패턴이라 향후 유사 가드 추가 시 배치 기준이 흩어질 소지가 있고, 합성 fixture 섹션의 변수명 재사용은 사소한 가독성 노이즈다. 두 항목 모두 차단 사유는 아니다.

## 위험도
LOW
