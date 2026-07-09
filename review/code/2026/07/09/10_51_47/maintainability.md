# 유지보수성(Maintainability) 리뷰 결과

### 발견사항

- **[WARNING]** `buildExecutionHref` JSDoc이 실재하지 않는 ESLint 룰을 근거로 명시
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:29` (`buildExecutionHref` 위 JSDoc 마지막 줄)
  - 상세: 주석이 "`no-restricted-syntax` lint 룰이 raw `/workflows/…/executions` 리터럴을 금지해 이 헬퍼 사용을 강제한다"고 서술한다. 그러나 실제로는 이번 커밋에서 그런 ESLint 설정 변경이 없고(`grep -rln "no-restricted-syntax" codebase/frontend` 결과 href.ts 자신과 `no-raw-execution-href.test.ts` 주석에서만 문자열로 언급될 뿐, 실제 `.eslintrc`/config 룰은 없음), 같은 PR 의 `no-raw-execution-href.test.ts` 자체 doc-comment 는 "ESLint `no-restricted-syntax` 는 템플릿 리터럴이 quasi 로 쪼개져 AST 매칭이 취약하므로, 소스 텍스트 기반 guard 테스트로 강제한다"고 명시해 ESLint 접근을 명시적으로 **기각**했다고 밝힌다. 즉 실제 enforcement 메커니즘은 vitest 소스텍스트 guard 테스트인데, href.ts 의 주석만 이를 반영하지 않고 예전(기각된) 설계를 그대로 남겨 두 문서가 서로 모순된다. 향후 유지보수자가 이 주석만 보고 "ESLint 가 막아준다"고 오인해 실제 guard(테스트 파일)를 못 찾거나, lint 통과만으로 안전하다고 오판할 위험이 있다.
  - 제안: href.ts 의 해당 줄을 실제 메커니즘에 맞게 정정. 예: "`no-raw-execution-href.test.ts` 의 소스 텍스트 guard 가 raw `/workflows/…/executions` 리터럴을 금지해 이 헬퍼 사용을 강제한다(ESLint AST 매칭 취약성 회피 위해 텍스트 기반 채택 — 상세는 해당 테스트 파일 참조)."

- **[INFO]** 소스 텍스트 guard 테스트의 탐지 범위가 템플릿 리터럴 형태로 한정됨
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:14` (`RAW_EXECUTION_HREF` 정규식)
  - 상세: 정규식이 `` `/workflows/${...}/executions `` 형태(백틱 템플릿 리터럴, 그것도 `` /workflows/ `` 바로 앞에 백틱이 와야 매치)만 탐지한다. 문자열 연결(`"/workflows/" + id + "/executions"`)이나 다른 템플릿 조합(예: 접두 표현식이 있는 중첩 템플릿) 형태로 우회 리터럴이 재도입돼도 이 가드는 통과시킨다. 실제 회귀 이력(PR #865)이 전부 템플릿 리터럴 형태였다는 근거는 있으나, 가드가 "완전 차단"이라는 인상을 주는 주석과 달리 커버리지에 사각지대가 있다.
  - 제안: 주석에 "템플릿 리터럴 형태만 탐지, 문자열 연결 등 다른 형태는 커버 범위 밖" 임을 명시하거나, 정규식을 문자열 연결 패턴까지 확장.

- **[INFO]** guard 테스트의 `SRC` 경로가 상대 경로 깊이(`"..", "..", ".."`)에 암묵적으로 결합
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts:16` (`const SRC = path.join(__dirname, "..", "..", "..")`)
  - 상세: 테스트 파일이 `lib/workspace/__tests__/` 밖으로 이동하면 `SRC` 가 조용히 잘못된 디렉터리(`src` 가 아닌 다른 곳)를 가리키게 되고, 그 경우 guard 는 무엇도 못 찾은 채(offenders=[]) 조용히 통과한다 — 즉 가드가 무력화돼도 실패로 드러나지 않는 fail-open 구조. 실무상 파일 이동 빈도는 낮아 위험도는 낮음.
  - 제안: (선택) `SRC` 하위에 `lib/workspace/href.ts` 가 실제로 존재하는지 sanity assert 를 추가해 위치 가정이 깨지면 테스트가 명시적으로 실패하게 함.

- **[INFO]** 이번 diff 로 손댄 대형 컴포넌트(`ReRunModal`, `RunResultsDrawer`)의 기존 책임 과다는 범위 밖
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx`, `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx`
  - 상세: 두 컴포넌트 모두 import·href 호출 한두 줄만 이번 커밋에서 바뀌었고 나머지(폼 상태·리사이즈 드래그·쿼리·렌더링을 한 함수에 모두 담는 구조)는 이전부터 존재하던 코드다. 이번 리팩터의 범위(하드닝 B) 밖이라 직접 지적 대상은 아니지만, 향후 별도 리팩터링 후보로 남겨둘 만하다.
  - 제안: 이번 PR 범위 아님 — 조치 불필요. 별도 백로그 항목으로만 참고.

### 요약
이번 변경은 실행경로 리터럴 15곳을 `buildExecutionHref` 헬퍼로 통합하고, open-redirect 방어 정규화(`safe-path.ts`)를 `buildWorkspaceHref`/`isSafeRedirectPath` 양쪽이 공유하도록 단일화했으며, `WorkspaceSummary`/`WorkspaceRole` 타입을 별도 모듈로 분리해 `workspace-store` ↔ `resolve-fallback` 순환을 구조적으로 제거한, 방향성이 뚜렷하고 범위가 잘 통제된 리팩터다. 새로 추가된 함수들은 모두 짧고 단일 책임이며 네이밍도 기존 컨벤션(`build*/is*/to*`)과 일관되고, 타입 이동은 하위호환 re-export 로 16개 소비처를 무변경으로 유지하는 등 변경 영향 관리가 신중하다. 유일하게 실질적인 문제는 `buildExecutionHref` JSDoc 이 실제로 존재하지 않는 ESLint 룰을 enforcement 근거로 잘못 언급하는 것으로(실제 가드는 vitest 소스텍스트 테스트), 같은 PR 의 다른 파일 주석과 서로 모순돼 향후 혼선을 줄 수 있다. 나머지는 guard 테스트의 탐지 사각지대·경로 결합 등 낮은 우선순위의 개선 여지다.

### 위험도
LOW
