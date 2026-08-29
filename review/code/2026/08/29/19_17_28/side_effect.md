STATUS=success reviewed 9 files (side_effect)
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 검토 범위 확인

`git diff --stat origin/main...HEAD` 로 실제 변경 파일 9개를 확인했고, 프롬프트에 실린 8개
파일 + 프롬프트 크기 제한으로 컨텍스트가 잘린 2개 파일(`code.handler.spec.ts`,
`backend-lint-gate-broken-on-main.md`)을 각각 `git diff`/전체 스캔으로 직접 열어 대조했다.
저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 조사만 수행, `git status --short` 변화 없음).

변경 파일 요약:
- 프로덕션 코드 변경: `secret-resolver.service.ts` — **주석 1줄만** 변경("형제 3곳" → "형제 4곳"),
  로직 변경 없음.
- 테스트/가드 파일: `http-exception.filter.spec.ts`(신규 describe 9 케이스),
  `expression-resolver.service.spec.ts`(주석만), `code.handler.spec.ts`(주석만),
  `error-shape.spec.ts`(주석만), 신규 `redis-fail-open-catalog-guard.ts` +
  `redis-fail-open-catalog.spec.ts`.
- 문서: `plan/in-progress/*.md` 2건(서술·체크박스 갱신).

## 발견사항

- **[INFO]** 신규 가드 테스트가 저장소 밖(`os.tmpdir()`)에 파일을 쓰고 지운다 — 의도된 격리이며 결함은 아니다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts:71` (`withPatchedSpec` 함수, 71~93줄)
  - 상세: `withPatchedSpec` 은 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 만든 임시 디렉터리에
    `spec/5-system/_product-overview.md` 사본을 써서 카탈로그 행만 패치한 뒤 그 경로로
    `readCatalogComponents(root)` 를 호출하고, `finally` 블록에서 `fs.rmSync(tmp, { recursive: true, force: true })`
    로 정리한다. `dest = path.join(tmp, CATALOG_SPEC)` 이 `tmp`(절대경로) 아래로만 해석되므로
    실제 저장소의 `spec/**` 파일에는 손대지 않는다. `fn(tmp)` 이 던져도 `finally` 가 정리를
    보장한다 — 유일한 실제 파일시스템 부작용 지점이지만 범위·정리 모두 안전하게 짜여 있다.
  - 제안: 조치 불요. 다만 이 패턴이 프로세스가 `SIGKILL` 로 죽는 극단적 경우엔 임시 디렉터리가
    남을 수 있다(모든 `mktemp` 패턴의 공통 한계이지 이 PR 고유의 결함은 아님) — 참고로만 기록.

- **[INFO]** 신규 `describe('cause 비노출 불변식 (계측 지점)')` 안의 `jest.spyOn(Logger.prototype, ...)`
  가 개별 `afterEach` 없이 여러 `it`/`it.each` 에서 반복 호출된다 — 상위 `describe('GlobalExceptionFilter', ...)`
  의 `afterEach(() => jest.restoreAllMocks())` (파일 41~43줄, 변경 없음) 가 중첩 describe 에도
  cascade 되어 매 테스트 뒤 복원되므로 spy 누설은 없음을 확인했다.
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (신규 블록 226~377줄, 특히 267·299·347~351줄의 `jest.spyOn`)
  - 상세: 부정 결과(문제 없음)만 확인차 기록한다 — 별도 조치 불요.

- **[INFO]** 신규 가드 `findWiredComponents` 가 `codebase/backend/src` 전체를 재귀 스캔한다
  (`node_modules`/`dist` 제외) — 프로덕션 모듈을 `require`/`import` 하지 않고 `fs.readFileSync` +
  TypeScript AST 파싱만으로 값을 뽑으므로, 파일을 읽는 과정에서 프로덕션 코드의 모듈 최상위
  부작용(DB 연결·환경변수 읽기 등)이 실행될 위험은 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts:92`(`listProductionSources`), `:119`(`findWiredComponents`)
  - 상세: 확인 결과이며 결함 아님.

## 그 외 관점별 확인 결과 (발견 없음)

- **전역 변수**: 신규 파일이 도입하는 `UNION_SOURCE`/`CATALOG_SPEC`/`UNION_TYPE_NAME`/`RECORDER_FN`
  은 모듈 스코프 `export const` 이고 `globalThis`/`process` 등 실제 전역 객체를 건드리지 않는다.
- **시그니처/인터페이스 변경**: 이 diff 는 프로덕션 함수 시그니처를 하나도 바꾸지 않는다
  (`secret-resolver.service.ts` 는 주석 1줄뿐). 공개 API 변경 없음.
- **환경 변수**: 이 diff 가 실제로 건드리는 라인 범위 안에는 `process.env` 읽기/쓰기가 없다.
  (`expression-resolver.service.spec.ts` 안에 `process.env.EXPR_TEST_*` 를 다루는 기존 테스트가
  있지만 이번 diff 의 변경 라인(175~186, 주석만)과 무관한 기존 코드다.)
- **네트워크 호출**: 없음 — 전부 로컬 파일 읽기/쓰기와 순수 함수.
- **이벤트/콜백**: 변경 없음.
- **plan 문서 변경**(`backend-lint-gate-broken-on-main.md`, `deps-peer-gating-and-eslint10.md`):
  서술·체크박스·`worktree:` frontmatter 갱신뿐이며 코드에 영향 없음.

## 요약

이번 변경은 사실상 테스트/문서 전용이다 — 유일한 프로덕션 코드 변경은 `secret-resolver.service.ts`
의 주석 한 줄이고, 나머지는 `http-exception.filter.spec.ts` 의 신규 회귀 테스트, 기존 spec 3곳의
주석 정리, 그리고 신규 repo-guard(코드·spec·실배선 3자 정합 검사) 순수 파서 + 그 소비 spec 이다.
유일한 실제 파일시스템 부작용은 새 가드 spec 의 `withPatchedSpec` 헬퍼인데, `os.tmpdir()` 안에서만
쓰고 `finally` 로 정리하며 저장소 원본(`spec/**`)은 건드리지 않는다 — 헤더 주석이 명시한 "저장소
원본은 건드리지 않는다" 는 주장이 실제 경로 조합과 일치함을 확인했다. mock 복원·전역 상태·시그니처·
환경변수·네트워크 축에서는 문제를 찾지 못했다.

## 위험도

NONE
