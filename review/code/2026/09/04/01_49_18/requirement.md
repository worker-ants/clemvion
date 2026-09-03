# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드

## 검증 방법

정적 diff 판독에 더해 실행 가능한 것은 실제로 돌려 확인했다(저장소 트리에는 아무 것도 쓰지
않음 — `git status --short` 로 확인, 리뷰 이전 상태와 동일):

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 105 tests 전부 PASS**
- `npx tsc --noEmit` (대상 파일 필터) → 관련 파일 에러 0
- `npx eslint` (대상 8개 파일) → 경고/에러 0
- `find codebase/backend/src -name "*.d.ts" | wc -l` → **0**, `node_modules|dist` 디렉터리 → **0**
  (plan 문서의 "축이 사문이다" 실측 주장을 직접 재검증 — 일치)
- 5개 walker 사본이 `collectTsFiles` 로 수렴한 뒤 `readdirSync` 잔존을 grep → 소스 파일에는
  `source-scan.ts` 1곳만 남음(spec 안의 주석 인용 2건 제외) — plan 의 "잔존 0" 주장과 일치

## 발견사항

- **[INFO]** `widenedEntityFields` 의 `WIDENED_DECL` 정규식은 넓혀진 필드를 가리키는 데코레이터
  뒤에 **추가 데코레이터를 최대 1개**까지만 허용한다(`@ManyToOne` + `@JoinColumn` 형태 전용,
  `(?:\s*@\w+\(...\)\s*\n)?` 이 옵셔널 1회뿐 — `*`/`+` 가 아니다).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:135`
    (`const WIDENED_DECL = ...`)
  - 상세: 필드에 데코레이터가 3개 이상 붙는 경우(예: `@Column` + `@JoinColumn` + `@Index` 3연속)
    이 정규식은 매치에 실패해 그 필드를 "넓혀지지 않음" 으로 취급한다. 그러면
    `findStaleSpecCasts` 는 그 필드를 겨눈 `.spec.ts` 의 낡은 `null as unknown as` 캐스트를
    구조적으로 놓친다 — 정확히 이 가드가 막으려는 잔재 클래스다. 현재 저장소를 전수 확인한
    결과(`grep -rlP` 로 2-데코레이터 이상 케이스를 모두 추출해 대조) 실재하는 조합은 전부
    `@ManyToOne`/`@OneToOne` + `@JoinColumn` 두 개뿐이라 **지금은 잠재적**이다(라이브 회귀
    아님, "저장소 전수" 테스트도 GREEN).
  - 함수 docstring 의 "왜 오탐이 없나" 절은 **정밀도**(false positive 없음)만 논증하고
    **재현율**(false negative 가능성)은 다루지 않는다 — 같은 파일의 자매 함수
    `countRawUpdateReturning` 이 "이 축이 안 보는 것" 절로 blind spot 을 명시하는 관례와
    대비된다.
  - 제안: 데코레이터 그룹을 `(?:...)*` 로 넓히거나(반복 허용), 최소한 이 한계를 docstring 에
    한 줄로 적어 "다음 사람이 이걸 버그로 오인해 정규식을 확장하려 들지 않도록" 고정. 코드
    fix 대상이라기보다 문서화 갭에 가깝다 — 필수 아님.

- **[정보성 확인, 결함 아님]** `engine-error-code-anchor-guard.ts` (`walkTsFiles`, 정렬 없음)와
  `redis-fail-open-catalog-guard.ts` (`listProductionSources`, 정렬 없음)는 리팩터 전에는
  파일 목록을 **정렬하지 않았다.** `collectTsFiles` 는 항상 정렬한다. `hits[0].file` 을
  단언하는 `engine-error-code-anchor.spec.ts:120` 케이스가 순서 변경에 영향받는지 직접
  대조했다 — 알파벳 정렬 시 `audit-action-binding-*.ts` 가 `engine-error-code-anchor-fixture.ts`
  보다 앞서지만, 그 두 파일에는 `code`/`errorCode` UPPER_SNAKE 바인딩이 없어(grep 확인)
  `hits[0]` 은 여전히 fixture 파일에서 나온다 — 테스트가 GREEN 인 것을 확인했다(105/105).
  오히려 이 변경은 CI 환경(ext4, `readdir` 해시 순서)에서 **가드 메시지의 결정성을
  개선**한다 — 리팩터 전에는 이 두 가드가 CI 에서 파일 순서가 비결정적이었을 수 있다. 회귀
  아님, 발견사항으로 두지 않음(참고용으로만 기록).

- **[정보성 확인, 결함 아님]** `.d.ts` 제외 축(`collectTsFiles` 가 항상 켬)과
  `node_modules`/`dist` skip 축은 5개 사본 중 3곳(`audit-action-binding`,
  `engine-error-code-anchor`, `nullable-type-lie-cast`)에는 없던 필터다. 이 필터들이 5개
  호출부 전부에서 실제로 아무것도 안 거르는지(`src` 하위 `.d.ts` 0개·`node_modules`/`dist`
  0개) 직접 `find` 로 재확인 — plan 의 실측 표(507/818/1261/818/818 "집합 동일")와 일치.

## 요약

핵심은 `repo-guards/__tests__/` 의 5개 디렉터리 walker 사본(`collectSourceFiles`·
`walkTsFiles`·`listSourceFiles`·`collectScanTargets`·`listProductionSources`)을
`common/__test-utils__/source-scan.ts` 의 `collectTsFiles(root, { includeSpec })` 하나로
통합하고, 부수적으로 `stripLiterals`(문자열/템플릿 리터럴 내용 지우기)를 노출해 새 가드
`widenedEntityFields`/`findStaleSpecCasts`(`| null` 로 넓혀진 엔티티 필드를 겨눈 `.spec.ts` 의
낡은 `null as unknown as` 캐스트 검출)를 추가한 리팩터다. 5개 호출부 각각에 대해 원본 walker
와 신규 `collectTsFiles` 의 필터 축(`.spec.ts`/`.d.ts`/`node_modules`·`dist`/정렬)을 하나씩
대조했고, 실제 저장소 조건(`.d.ts` 0개, `node_modules`/`dist` 0개, 관련 spec 없음)에서는 전부
동작 불변임을 직접 재현·확인했다(105/105 테스트 GREEN, `tsc`/`eslint` 클린). 새 스캔 가드
(`findStaleSpecCasts`)도 "저장소 전수" 회귀 테스트로 잔존 0 을 스스로 검증하고 있고, 뮤테이션
근거(plan 문서 기재)까지 갖춰 완결성이 높다. 이 변경 영역(내부 test-tooling/repo-guard)을
직접 규정하는 `spec/` 본문은 없다 — `spec/conventions/raw-query-results.md` 는
`source-scan.ts` 를 코드 증거로만 링크하고(RETURNING 튜플 축, 이번 diff 로 안 바뀜),
`1-manual-trigger.md`/`14-external-interaction-api.md` 는 `masked-reject-callers-guard.ts` 를
동작 서술 없이 참조만 한다 — spec fidelity 위반 없음(회색지대, 결함 아님). 유일한 발견은
`widenedEntityFields` 정규식의 미문서화된 재현율 한계(현재는 비활성 리스크)로, CRITICAL/
WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
