# 성능 리뷰: 내부 패키지 등록 목록 drift 가드

## 발견사항

- **[INFO]** `discoverPackages()` 의 개별 `package.json` 동기 읽기 — N+1 유사 패턴이나 무해
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:695-707` (`discoverPackages`)
  - 상세: `readdirSync` 로 얻은 각 패키지 디렉터리마다 `fs.existsSync` + `fs.readFileSync`(동기)를 개별 호출한다. 형식적으로는 "반복문 내 I/O 호출" 패턴이지만, 대상이 로컬 파일시스템·현재 6개 디렉터리(`codebase/packages/*`)뿐이라 실질 비용은 무시할 수준이다. DB/네트워크 N+1과 성격이 다르다.
  - 제안: 조치 불필요. 패키지 수가 수십~수백으로 늘어날 가능성이 있다면 그때 배치 고려. 현 스코프(테스트 셋업, 수 개 파일)에서는 최적화 대상 아님.

- **[INFO]** `fnBody`/`listAtPath` 정규식 스캔의 반복 호출 — 파일 크기 대비 무의미한 재계산
  - 위치: `test.each(STAGES)` 블록(`878-897`)에서 `cmd_lint`/`cmd_unit`/`cmd_build` 각각에 대해 `fnBody(sh, fn)` 을 재호출. `it.each` 로 `on.pull_request.paths`/`on.push.paths` 도 `listAtPath` 를 매 케이스 재계산.
  - 상세: `sh`(148줄)·`yml`(69줄)는 describe 블록 상단에서 1회만 읽혀 공유되므로 파일 I/O 자체는 캐시돼 있다. 다만 각 `it`/`it.each` 케이스마다 동일 입력에 대해 정규식 파싱을 다시 수행한다(`fnBody` 는 vacuity 체크에서도 한 번, 본 검증에서 또 한 번 총 2회/함수). 파일이 100줄대이므로 실측 영향은 마이크로초 단위이며 테스트 스위트 전체 실행시간에 기여하지 않는다.
  - 제안: 조치 불필요. 굳이 다듬는다면 `beforeAll` 에서 파싱 결과를 메모이즈할 수 있으나, 가독성(각 단언이 자기완결적으로 재계산)과 맞바꿀 가치가 없는 트레이드오프다.

- **[INFO]** 동기 I/O(`readFileSync`/`readdirSync`) 사용 — 테스트 컨텍스트라 적절
  - 위치: 파일 전역(`ROOT`, `discoverPackages`, `backendWorkflowDeps`, describe 블록 상단)
  - 상세: "블로킹 I/O" 관점에서는 지적 대상이나, 이 코드는 서버 요청 경로가 아니라 vitest 테스트 파일의 collection/setup 단계에서 1회 실행되는 코드다. Node 테스트 러너가 순차 실행하는 맥락에서 동기 I/O 는 표준적이고 올바른 선택이다(비동기화해도 이득 없음, 오히려 불필요한 `async`/`await` 노이즈만 추가).
  - 제안: 변경 불필요.

- **[INFO]** `repoRoot()` 의 최대 12단계 디렉터리 탐색 — trivial
  - 위치: `677-687`
  - 상세: `pnpm-workspace.yaml` 을 찾을 때까지 최대 12회 `fs.existsSync` 호출. 상수 상한이 있고 실제로는 `codebase/frontend/src/lib/repo-guards/__tests__/` 에서 루트까지 5단계 내로 종료되므로 문제 없음.
  - 제안: 없음.

## 요약
세 변경분(`.claude/test-stages.sh` 주석 추가, `.github/workflows/packages-checks.yml` 주석 추가, 신규 vitest 가드 테스트)은 모두 빌드/테스트 인프라 코드이며 런타임 서비스 경로와 무관하다. 신규 테스트 파일은 6개 남짓의 로컬 소규모 파일(`package.json` 수 개, `test-stages.sh` 148줄, `packages-checks.yml` 69줄)을 1회성으로 동기 읽고 정규식으로 파싱·대조하는 구조로, N+1·과도한 메모리 할당·O(n²) 누적·블로킹 병목 등 실질적 성능 이슈가 발생할 표면이 없다. 입력 규모가 앞으로 극적으로 커질 개연성도 낮다(내부 공유 패키지 목록이라는 성격상). 발견된 항목은 모두 정보성(INFO) 관찰이며 조치가 필요하지 않다.

## 위험도
NONE
