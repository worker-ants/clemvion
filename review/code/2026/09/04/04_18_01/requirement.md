# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (8R 이후 상태)

## 컨텍스트 및 검증 방법

이 changeset 은 이미 `review/code/2026/09/04/01_48_39` 부터 `03_58_32` 까지 **8회** 리뷰
라운드를 거쳤고, 매 라운드 Critical/Warning 이 그 즉시 조치됐다(마지막 W1 은 `masked-reject-callers.spec.ts` 상단에 새 `describe`+JSDoc 을 끼워 넣으며 원래 있던 JSDoc 이 orphan
된 것 — `cfc69dd63` 로 조치 완료, HEAD 시점). 본 라운드는 그 위에서 신규 요구사항 결함 유무를
독립적으로 재검증했다(저장소 트리에는 검증 후 아무 것도 남기지 않음 — 아래 참조).

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 119 tests 전부 PASS**
- `npx tsc --noEmit`(대상 파일 필터) → 관련 파일 에러 0
- `grep -n -E "TODO|FIXME|HACK|XXX"` 대상 9개 파일 전수 → **0건**
- `grep -rn readdirSync src/repo-guards` → **0건**(5개 walker 사본이 전부 `collectTsFiles` 로
  수렴했다는 plan 서술과 일치)
- **plan 문서의 실측 수치("2026-09-04 실측 135 → 115")를 직접 재현**: `nullable-type-lie-cast.spec.ts`
  의 "[전제] 넓혀진 필드가 실제로 있다" 테스트에 임시 `console.log` 를 삽입해 실제
  저장소(엔티티 41개·spec 443개)로 `widenedEntityFields` 를 돌려 **115** 를 직접 확인했다.
  저장소 트리 변경은 원본을 scratch 로 `cp` 해 둔 뒤 검증 직후 `cp` 로 원복했고,
  `git status --short` 로 잔여물이 없음을 확인했다(review 세션 자신의 출력 디렉터리만 신규).
- `masked-reject-callers.spec.ts` 상단을 직접 열어 7R 조치가 실제로 반영됐는지 확인 — 두
  JSDoc 이 각자의 `describe` 바로 위에 정확히 붙어 있다.

## 발견사항

- **[INFO]** `findUntypedNullableColumns` 의 "`type:` 명시 여부" 판정이 **따옴표로 시작하는
  문자열 리터럴만** 인식한다 — enum 상수 등 비-문자열 `type:` 값이 오면 "타입 미지정"으로
  오판할 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (
    `COLUMN_NAME`/`findUntypedNullableColumns` 부근, `/\btype:\s*'/.test(deco)` 판정문)
  - 상세: `@Column({ type: 'varchar', nullable: true })` 처럼 `type:` 값이 항상 따옴표로
    시작하는 문자열 리터럴이라고 가정한다. TypeORM 은 `type: 'enum', enum: SomeEnum` 형태로
    문자열을 쓰는 것이 관례이므로 지금은 문제가 없고, 실제로 저장소 전수(`@Column(` 블록)를
    `grep` 해 `type:` 값이 비-문자열-리터럴인 사례가 **0건**임을 확인했다(단순 `type: string;`
    형태의 TS 필드 선언만 걸릴 뿐, 데코레이터 옵션 안의 `type:` 은 전부 문자열이다). 다른
    가드 함수(`WIDENED_DECL` 의 "데코레이터 1개까지만", `isNullableType` 의 표기 형태)는
    이런 종류의 미문서화 가정을 이미 docstring 의 "한계" 절로 명시하는 관례를 갖고 있는데,
    이 함수만 그 관례를 따르지 않는다. 위음성(=런타임 크래시를 놓치는) 방향이라 실질
    리스크는 낮지만, 이 파일 전체가 표방하는 "한계는 명시한다" 원칙과는 어긋난다.
  - 제안: 조치 필수는 아님. `type:` 판정 바로 위에 "값이 문자열 리터럴이 아니면(예: 상수
    참조) 이 축은 놓친다 — 저장소 전수에 그런 형태 없음(YYYY-MM-DD 실측)" 한 줄을 남기면
    이 파일의 다른 함수들과 문서화 수준이 맞춰진다.

- **[INFO]** 이 changeset(내부 test-tooling/repo-guard 리팩터 + 신규 가드)을 직접 규정하는
  `spec/` 본문은 없음 — 이미 앞선 라운드(`01_49_18`/`02_12_38` requirement)가 동일하게
  확인한 결론을 본 라운드에서도 재확인했다
  - 상세: `grep -rl "collectTsFiles|source-scan|nullable-type-lie-cast|widenedEntityFields" spec/`
    → `spec/conventions/raw-query-results.md` 1건만 매치되나, 그 문서는 `source-scan.ts` 를
    RETURNING 튜플 축의 코드 증거로 링크할 뿐이고 이번 diff 는 `countRawUpdateReturning` 을
    건드리지 않았다(무변경 확인). `masked-reject-callers-guard.ts` 를 참조하는
    `1-manual-trigger.md`/`14-external-interaction-api.md` 도 동작 서술 없이 참조만 한다.
    회색지대이며 spec fidelity 위반 아님(CRITICAL 대상 아님).

## 검증된 항목 (문제 없음 — 재확인)

- `widenedEntityFields` 의 "동명 충돌 제거"(2R W1 조치)는 대조군 테스트(충돌 이름
  `userId` 는 안 잡고 비충돌 이름 `onlyHereAt` 은 잡는다)와 "저장소 전수" 회귀 테스트로
  이중 방어돼 있고, plan 이 주장하는 수치(115)를 독립 재현해 정확히 일치함을 확인했다.
- `collectTsFiles` 로 통합된 5개 walker 각각의 필터 축(`.spec.ts`/`.d.ts`/`node_modules`·
  `dist`/`sort()`) 차이는 실측 근거(파일 수 507/818/1261/818/818)로 문서화돼 있고, 실제
  코드에도 그 근거와 모순되는 지점을 찾지 못했다.
- `findStaleSpecCasts`/`findCastOffenders`/`findUntypedNullableColumns` 모두 빈 입력(빈
  파일 목록)에 대해 빈 배열을 반환하는 경로가 자연스럽게 성립하고(루프가 그냥 안 돎),
  모든 반환 경로가 선언된 타입(`StaleSpecCast[]`/`CastOffender[]`/`UntypedNullableColumn[]`)
  과 일치한다 — 반환값 누락 경로 없음.
- TODO/FIXME/HACK/XXX 계열 미완성 마커는 대상 9개 파일에 0건.
- `tsc --noEmit`·대상 6-suite jest(119 tests)·`readdirSync` 잔존 스캔 모두 이번 세션에서
  독립적으로 재실행해 통과를 확인했다(과거 라운드의 "PASS 였다" 주장을 그대로 믿지 않고
  재현).

## 요약

8라운드에 걸쳐 이미 매우 촘촘하게 검증된 changeset이며, 본 라운드에서 독립적으로 재실행한
검증(jest 119/119, tsc 클린, `readdirSync` 잔존 0, plan 의 "135→115" 수치를 실제로 재현해
정확히 일치 확인, JSDoc 결속 육안 확인)에서 새로운 Critical/Warning 급 요구사항 결함은
발견되지 않았다. 유일하게 신규로 기록하는 것은 `findUntypedNullableColumns` 의 `type:`
판정이 문자열 리터럴만 인식한다는 미문서화 가정(INFO, 현재 저장소에 실재 사례 없음 —
위음성 방향이라 안전측)이며, spec fidelity 는 이 영역을 규정하는 `spec/` 본문이 없어
회색지대(INFO)로 재확인했다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 모든 축에서
이 changeset 은 스스로 반증 가능한 근거(뮤테이션 검증·실측 표·대조군 테스트)를 갖추고
있어 요구사항 충족 관점의 위험은 낮다.

## 위험도

LOW
