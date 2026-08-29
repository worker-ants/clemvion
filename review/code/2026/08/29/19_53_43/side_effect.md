STATUS=success reviewed 32 files (side_effect)
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 검토 범위 확인

`git diff --stat origin/main...HEAD` 로 실제 프로덕션/테스트 코드 변경 7개 파일을 직접 대조했다
(프롬프트에서 `http-exception.filter.spec.ts` 는 크기 제한으로 diff 가 생략돼 있어 `git diff` 로
직접 열어 178줄 추가분 전체를 확인했다). 나머지 25개 파일은 plan 문서(`.md`) 및 이전 라운드
리뷰/일관성 검사 산출물(`review/code/…`, `review/consistency/…`)로, 코드 실행 경로가 아니다.
저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 조사만 수행 — `git status --short` 결과 이 세션의
출력 디렉터리(`review/code/2026/08/29/19_53_43/`) 외 변경 없음을 확인).

변경 파일 요약(코드):
- 프로덕션 코드: `secret-resolver.service.ts` — 주석 1줄만("형제 3곳"→"형제 4곳" + 파일명 나열),
  로직 변경 없음(`git diff` 로 직접 확인).
- 테스트/가드: `http-exception.filter.spec.ts`(신규 `describe('cause 비노출 불변식…')` 블록,
  178줄), `expression-resolver.service.spec.ts`/`code.handler.spec.ts`/`error-shape.spec.ts`(주석만),
  신규 `redis-fail-open-catalog-guard.ts` + `redis-fail-open-catalog.spec.ts`.
- 문서: `plan/in-progress/*.md` 갱신, `plan/complete/deps-peer-gating-and-eslint10.md` 로 이동,
  이전 라운드 리뷰/consistency 산출물 전체가 신규 커밋 파일로 포함.

## 발견사항

- **[INFO]** 신규 가드 테스트가 저장소 밖(`os.tmpdir()`)에 파일을 쓰고 지운다 — 의도된 격리이며 결함은 아니다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts` (`withPatchedSpec` 함수, 71~93줄) + `176~183줄`(union 소스 부재 케이스의 별도 `mkdtempSync`/`rmSync`)
  - 상세: `withPatchedSpec` 은 `fs.mkdtempSync(path.join(os.tmpdir(), 'redis-failopen-guard-'))` 로
    만든 임시 디렉터리에 `spec/5-system/_product-overview.md` 사본을 써서 카탈로그 행만 패치한 뒤
    그 경로로 `readCatalogComponents(root)` 를 호출하고, `finally` 블록에서
    `fs.rmSync(tmp, { recursive: true, force: true })` 로 정리한다. `dest = path.join(tmp, CATALOG_SPEC)`
    이 `tmp`(절대경로) 아래로만 해석되므로 실제 저장소의 `spec/**` 파일은 건드리지 않는다.
    `fn(tmp)` 이 던져도 `finally` 가 정리를 보장한다 — 이 diff 의 유일한 실제 파일시스템 쓰기
    지점이지만 범위·정리 모두 안전하게 짜여 있다.
  - 제안: 조치 불요.

- **[INFO]** 신규 `describe('cause 비노출 불변식 (계측 지점)')` 안에서 `jest.spyOn(Logger.prototype, 'error'|'warn')`
  가 개별 `afterEach` 없이 `it`/`it.each` 여러 곳에서 반복 호출된다.
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (신규 블록, `catch(errorWithCause(), host)` 를 부르는 다수 `it`)
  - 상세: 상위 `describe('GlobalExceptionFilter', …)` 최상단의 `afterEach(() => jest.restoreAllMocks())`
    가 nested describe 에도 cascade 되므로 매 테스트 뒤 spy 가 복원된다 — 직접 열어 확인했다
    (`afterEach` 가 파일 최상단 1곳뿐이고 신규 블록 안에는 별도 `afterEach`/`beforeEach` 가 없다).
    spy 누설 없음.
  - 제안: 조치 불요(확인 결과 기록).

- **[INFO]** 이전 라운드 산출물(`review/code/2026/08/29/19_17_28/_retry_state.json`,
  `_resolution_state.json` 등)이 로컬 절대경로(`/Users/gehrig/orca/workspaces/clemvion/doliolid/...`)
  를 그대로 담은 채 커밋된다.
  - 위치: `review/code/2026/08/29/19_17_28/_retry_state.json` (session_dir·각 prompt/output 경로 필드), `_resolution_state.json`
  - 상세: 애플리케이션 런타임 부작용은 아니고, 이 저장소가 라운드 산출물 전체(감사 기록)를 커밋하는
    관례를 이번 PR 에서 명시적으로 채택(`plan/in-progress/deps-peer-gating-and-eslint10.md` 의
    2026-08-29 결정 — CLAUDE.md 권한표를 `review/**` 로 확장)했으므로 새로 생긴 문제는 아니며 매
    라운드에서 반복되는 기존 패턴이다. 다만 로컬 사용자명·워크트리 절대경로가 버전관리 이력에
    영구히 남는다는 점은 참고로 남긴다.
  - 제안: 조치 불요(기존 관례, 이번 diff 고유 결함 아님). 필요하면 별도 항목으로 산출물 경로를
    상대경로화하는 방안을 검토할 수 있으나 이 리뷰의 범위 밖이다.

- **[INFO]** 신규 가드 `findWiredComponents`/`listProductionSources` 가 `codebase/backend/src` 전체를
  재귀 스캔한다(`node_modules`/`dist` 제외).
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` (`listProductionSources` 91~111줄, `findWiredComponents` 118~161줄)
  - 상세: 프로덕션 모듈을 `require`/`import` 하지 않고 `fs.readFileSync` + TypeScript AST 파싱만으로
    값을 뽑으므로, 파일을 읽는 과정에서 프로덕션 코드의 모듈 최상위 부작용(DB 연결·환경변수 읽기
    등)이 실행될 위험은 없다. 새 CI 워크플로/훅에 별도로 연결돼 있지 않고
    (`grep -rn "redis-fail-open-catalog"` 결과 자기 자신의 `.spec.ts` 외 참조 없음) 기존 backend
    `unit` 스테이지가 `.spec.ts` 를 자동 discover 하는 경로로만 실행된다 — 새로운 실행 트리거
    아님.
  - 상세: 확인 결과이며 결함 아님.

## 그 외 관점별 확인 결과 (발견 없음)

- **의도치 않은 상태 변경**: `secret-resolver.service.ts` 는 주석 1줄뿐, 로직·상태 변경 없음
  (`git diff` 로 직접 대조).
- **전역 변수**: 신규 `redis-fail-open-catalog-guard.ts` 가 도입하는 `UNION_SOURCE`/`CATALOG_SPEC`/
  `UNION_TYPE_NAME`/`RECORDER_FN` 은 모듈 스코프 `export const` 문자열이고 `globalThis`/`process`
  등 실제 전역 객체를 건드리지 않는다. `http-exception.filter.spec.ts` 의 `CAUSE_MARKER`/
  `CLOSED_ENVELOPE_KEYS` 도 `describe` 블록 스코프 상수다.
- **시그니처/인터페이스 변경**: 기존 함수/클래스의 시그니처를 바꾸는 라인이 없다 — 유일한 프로덕션
  변경은 주석. 신규 export 4개(`readUnionMembers`/`readCatalogComponents`/`listProductionSources`/
  `findWiredComponents`)는 전부 새 파일이라 기존 호출자에 영향 없음.
- **환경 변수**: 이번 diff 가 실제로 건드리는 라인 범위 안에는 `process.env` 읽기/쓰기가 없다
  (`expression-resolver.service.spec.ts` 안의 기존 `process.env.EXPR_TEST_*` 사용은 이번 diff 의
  변경 라인(주석)과 무관한 기존 코드).
- **네트워크 호출**: 없음 — 전부 로컬 파일 읽기/쓰기(`fs`)와 순수 함수.
- **이벤트/콜백**: 새 이벤트 발생/콜백 등록 변경 없음. `GlobalExceptionFilter.catch` 는 기존
  시그니처 그대로 호출된다.
- **plan/consistency 산출물**(`plan/in-progress/*.md`, `plan/complete/*.md`, `review/**`): 서술·
  체크박스·`worktree:` frontmatter 갱신 및 이전 라운드 산출물 커밋뿐이며 런타임 코드에 영향 없음.

## 요약

이번 변경은 사실상 테스트·문서·감사 산출물 전용이다. 유일한 프로덕션 코드 변경(`secret-resolver.service.ts`)
은 주석 1줄이고, 나머지 코드 변경은 `http-exception.filter.spec.ts` 의 신규 `cause` 비노출 회귀
테스트, 기존 3개 spec 의 주석 정리(중복 근거를 정본 파일 하나로 위임), 그리고 새 repo-guard(코드·
spec·실배선 3자 정합 검사) 순수 파서 + 소비 spec 이다. 유일한 실제 파일시스템 쓰기는 새 가드 spec 의
`withPatchedSpec`/union-source 부재 테스트인데, 둘 다 `os.tmpdir()` 안에서만 쓰고 `finally` 로
정리하며 저장소 원본은 건드리지 않는다. 새 `jest.spyOn` 호출들은 파일 최상단의 공용
`afterEach(jest.restoreAllMocks())` 로 안전하게 복원됨을 직접 확인했다. 전역 상태·시그니처·환경변수·
네트워크·이벤트 축에서는 문제를 찾지 못했다. 리뷰 산출물에 로컬 절대경로가 박혀 커밋되는 점은
참고 사항으로만 남긴다(이번 PR 이 만든 새 패턴이 아니라 이미 채택된 관례).

## 위험도

NONE
