# 테스트(Testing) 리뷰 — 내부 패키지 등록 목록 drift 가드

대상: `.claude/test-stages.sh`(주석만), `.github/workflows/packages-checks.yml`(주석만),
`codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`(신규,
파서/비교 순수 로직), `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`(신규, 40 assertions).

실행 검증: `pnpm --filter frontend test`(vitest) 로 해당 스펙만 단독 실행 — **40 tests / 1 file, 전부 PASS**
(로컬 재현, 실제 저장소 상태 대조 포함). tsconfig 상 `src/**/__tests__/**` exclude 확인, vitest
`include: ["src/**/*.{test,spec}.{ts,tsx}"]` 확인 — 가드 파일 헤더의 주장과 실측이 일치.

## 발견사항

- **[WARNING]** `packages-checks.yml` 대조용 `expectedDirs()` 계산 로직에 합성 fixture 회귀 테스트가 없음
  - 위치: `internal-package-registration.test.ts` L1373-1379 (`const expectedDirs = () => packages.filter(...).map(...).sort()`)
  - 상세: 같은 파일의 다른 순수 로직(`missingFromStage`, `fnBody`, `explicitFilterCalls`, `listAtPath` 등)은 전부
    가드 모듈로 추출돼 통제된 합성 입력으로 true-positive/negative 를 박제하는 전용 `describe("파서·비교 로직 회귀 가드 (합성 fixture)")`
    블록을 갖고 있다(테스트 파일 자신의 주석이 이 원칙을 명시: "이 비교가 인라인이면 … 회귀가 생겨도 스위트가 못 잡는다").
    그런데 `expectedDirs()`(backend-공유 패키지 이름→dir 매핑·필터·정렬)만은 이 원칙에서 벗어나 테스트 파일에 인라인돼
    있고, 대응하는 pure 함수 추출도 fixture 도 없다. 실행되는 유일한 검증은 "현재 저장소가 이미 정렬돼 있는 상태" 라
    `filter` 조건 반전(`!backendShared.includes` 로 실수 등)·`.map(p => p.dir)` ↔ `.map(p => p.name)` 혼동·정렬 키
    실수 같은 뮤테이션이 들어와도 현재 저장소 데이터가 우연히 같은 결과를 내면 스위트가 못 잡는다.
  - 제안: `expectedBackendSharedDirs(packages, backendShared)` 형태로 가드 모듈에 pure 함수로 옮기고, `missingFromStage`
    수준의 합성 fixture(예: backend-공유가 아닌 패키지가 섞인 입력, dir≠name 인 입력)로 true-positive 를 고정.

- **[INFO]** "INTERNAL_PACKAGES 에 실재하지 않는 패키지가 없다" (stale 항목 탐지) 도 합성 fixture 없이 실측 데이터로만 검증됨
  - 위치: `internal-package-registration.test.ts` L1362-1369 (`internal.filter((n) => !known.has(n))`)
  - 상세: 로직 자체는 한 줄이라 위험은 낮지만, `!known.has(n)` → `known.has(n)` 같은 부호 반전 뮤테이션이 들어와도
    현재 저장소엔 실제 stale 항목이 없어(전 패키지가 등록돼 있음) 테스트가 계속 green 이다 — 이 검사가 "실제로 뭔가를
    잡아내는지"를 확인하는 유일한 방법이 수동 코드 리딩뿐이다. 파일 전체가 표방하는 "#968 클래스를 스위트로 들여
    회귀를 고정한다"는 설계 원칙과 이 항목만 일관성이 어긋난다.
  - 제안: `collectPackages`/`missingFromStage` 처럼 `staleEntries(internal: string[], known: string[])` pure 헬퍼를
    빼서 `internal=["@workflow/a","@workflow/ghost"], known=["@workflow/a"]` → `["@workflow/ghost"]` 같은 합성
    케이스로 고정.

- **[INFO]** 가드 핵심 로직 파일이 tsc·type-aware lint 양쪽에서 실질적으로 비검증 상태
  - 위치: `internal-package-registration-guard.ts` (전체), `codebase/frontend/tsconfig.json` L23-30 (`src/**/__tests__/**` exclude), `codebase/frontend/eslint.config.mjs` (실측: `parserOptions.project` 미설정 — type-aware lint 아님)
  - 상세: 이 파일은 `__tests__/` 아래 배치돼 `next build`/`tsc` 에서 제외되고(파일 헤더가 스스로 명시), ESLint 도 project 기반이
    아니라 타입 오류를 못 잡는다. 실측: `npx eslint` 로 이 파일만 단독 실행해도 무오류 통과 — 타입 관련 검증이 전혀 없다는
    뜻이다. 과거 PR #912 에서 동일 패턴(타입 가드/테스트가 실제로는 타입 strip 되어 no-op)이 HIGH 로 지적된 바 있다.
    다만 이번 경우는 완화 요인이 있다: 40개 vitest assertion 이 이 모듈의 거의 모든 브랜치(early-open/early-close 파싱,
    fs 코어 분리, 병합 로직 등)를 런타임으로 직접 구동하므로, 진짜 타입 오류(예: undefined 접근)는 런타임에서도 throw 로
    드러나 vacuity 테스트가 잡을 가능성이 높다 — 전형적인 "테스트 없는 타입가드"보다는 실제 위험도가 낮다.
  - 제안: 급하진 않으나, 이런 "런타임 전용" 파일 클래스에 대해 `tsc --noEmit` 을 별도로 (exclude 무시하고) 부분 실행하는
    보조 스텝을 두면 향후 유사 파일에도 재사용 가능한 안전망이 된다. 이번 PR 단위에서 필수는 아님.

- **[INFO]** `repoRoot()` 의 실패 경로(`MAX_DEPTH` 초과 시 throw)와 `internalPackages` 의 배열-선언-누락 외 변형(빈 배열 `()`, 항목 내 주석)이 미검증
  - 위치: `internal-package-registration-guard.ts` L343-356(`repoRoot`), L425-429(`internalPackages`)
  - 상세: 둘 다 방어적 코드 경로라 위험은 낮음. `repoRoot` throw 경로는 fs mock 없이는 테스트하기 어려운 구조(디렉터리
    탐색이 `__dirname` 고정)이고, 실패해도 모든 테스트가 즉시 fail-loud 로 죽으므로 실질적 피해는 적다.
  - 제안: 낮은 우선순위. `repoRoot(startDir)` 처럼 시작 디렉터리를 인자로 주입 가능하게 하면(현재도 사실상 pure 하게
    만들 수 있음) `MAX_DEPTH` 초과 케이스를 합성 fixture 로 저비용에 고정할 수 있다.

## 좋은 점 (참고)

- vacuity 방지 블록(파싱이 실제로 뭔가를 읽었는지 먼저 확정)이 "회귀 대조가 전부 통과처럼 보이지만 사실 아무것도 안
  읽어서 vacuous PASS" 라는, 이 저장소가 실제로 반복해서 겪은 실패형(#960·#962·#968)을 정확히 겨냥해 방어한다.
- `fnBody` 의 early-open(중첩 `{`)·early-close(heredoc, `<<-` tab-strip 변형)·here-string(`<<<`) 오탐 배제까지
  세 갈래를 전부 합성 fixture 로 고정 — 휴리스틱 파서의 알려진 사각지대를 실측 재현 케이스로 규율화한 좋은 예.
  ai-review 가 지적한 WARNING(주석/echo 문자열 안 `pnpm --filter` 오인식)을 "명령 위치" 판정으로 고치고 그 자체를
  회귀 테스트 3건으로 고정한 것도 review-fix 사이클이 테스트로 닫힌 좋은 사례.
  fs 접근과 순수 로직(`collectPackages`/`workflowDepsOf` vs `discoverPackages`/`backendWorkflowDeps`)을 분리해
  의존성 주입 형태로 만들어 테스트 용이성을 확보한 설계도 위 WARNING 항목들과 대비되는 모범 사례.
- 실패 메시지가 전부 "무엇을 어디에 추가해야 하는지"까지 담고 있어(예: `.claude/test-stages.sh 의 INTERNAL_PACKAGES 에
  추가하거나 …`) 실제 CI/로컬에서 이 테스트가 깨졌을 때 조치가 즉시 명확하다 — 가독성/실전성 모두 우수.
- 왜 이 가드가 frontend vitest 위치에 있는지(Actions off·python unittest 도 inert·vitest glob 자동 발견이라
  손 유지 호출부가 없음)를 테스트 파일 헤더에서 논증한 것은 "이 가드 자신이 실제로 도는가" 라는 메타적 테스트 용이성
  질문에 정면으로 답한 드문 사례.

## 요약

신규 drift 가드(`internal-package-registration-guard.ts` + `.test.ts`)는 파서·비교 순수 로직을 분리해 통제된 합성
fixture 로 true-positive/negative 를 고정하는 설계가 전반적으로 탄탄하고, vacuity 방지·fail-loud 파싱·주석/로그
오인식 차단까지 이전 리뷰 WARNING 을 실측 재현 테스트로 닫아 온 이력이 확인된다(로컬 재실행 40/40 PASS). 다만 이
설계 원칙이 일관되게 적용되지 않은 곳이 두 군데 있다 — `packages-checks.yml` 대조용 `expectedDirs()` 필터/매핑/정렬
로직과 `INTERNAL_PACKAGES` stale 탐지 로직은 pure 함수로 추출되지 않아 합성 fixture 회귀 커버리지가 없고, 오직
"현재 저장소가 우연히 정렬 상태" 라는 사실에 기대어 통과한다. 두 항목 모두 이 파일 자신이 스스로 표방하는 원칙(인라인
비교는 뮤테이션을 못 잡는다)의 예외라서 WARNING/INFO 로 표시했다. `test-stages.sh`·`packages-checks.yml` 변경분은
주석 추가뿐이라 그 자체의 테스트 필요성은 없다.

## 위험도

LOW
