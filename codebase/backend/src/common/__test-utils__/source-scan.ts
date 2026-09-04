/**
 * 구조적 회귀 가드가 **소스를 세는·모으는** 방식의 단일 출처. 테스트 전용이다.
 *
 * jest 타입 비의존 — build tsc 가 `__test-utils__` 를 컴파일하므로 의도적으로 순수
 * 함수만 둔다 (`workspace-id-fixtures.ts`·`modules/integrations/__test-utils__` 와 같은 관례).
 *
 * > 처음엔 `common/utils/__testing__/` 라는 **새 디렉토리**에 두고 `tsconfig.build.json`
 * > 에서 제외했다. 저장소에 이미 `__test-utils__`(2곳)·`__tests__`·`__test__` 가 있어
 * > **네 번째 변종**이었고, 제외도 내 디렉토리에만 걸려 비대칭이었다
 * > (`01_44_03` maintainability W2). 여기로 합치고 제외는 되돌렸다 — 자매 두 파일이
 * > docstring 에 "build 가 컴파일한다" 를 **전제로 적어 둔 계약**이라, 제외를 넓히는 건
 * > 내 파일이 아니라 남의 계약을 바꾸는 일이다.
 *
 * ## 왜 공유하나
 *
 * `assert-row-array.spec.ts` 와 `update-returning-rows.spec.ts` 는 각자
 * "헬퍼 호출 수 == 소비 지점 수" 를 세는 같은 모양의 가드를 갖고 있다. 한쪽만
 * 하드닝하면 나머지에 같은 결함 클래스가 남는다 — 실제로 `00_54_01` testing
 * WARNING 1 이 그 비대칭을 잡았다(주석 스트리핑을 한쪽에만 적용했다).
 *
 * 세 번째 가드가 생겨도 여기만 고치면 되도록 둘의 계산을 여기로 모은다.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 블록 주석과 `//` 주석(줄 끝 포함)을 지운다.
 *
 * 주석 속 심벌 언급이 카운트에 섞이면 가드가 **약해진다** — 호출을 빠뜨린 파일이
 * 주석에서 헬퍼를 언급하기만 해도 개수가 맞아 통과해 버린다. 실제로
 * `auth-oauth.service.ts` 의 docstring 이 처방을 설명하며 심벌을 적었다가 2로 셌다.
 *
 * ## 줄 끝 주석도 지우는 이유 — 두 방향의 위험이 대칭이 아니다
 *
 * 처음엔 줄 끝 `//` 를 남겼다. 대상 파일에 `'https://…'` 가 있어 URL 을 자르게 된다는
 * 이유였는데, **재보지 않고 쓴 트레이드오프였다** (`01_12_26` architecture/testing W2·W5).
 *
 * 실측하니 줄 끝까지 지워도 4개 대상 파일의 카운트가 **하나도 바뀌지 않았다** — URL 은
 * 8줄 있지만 헬퍼 호출과 같은 줄에 있는 것이 없다. 그리고 두 방향은 대칭이 아니다:
 *
 * | 남겨두면 | 지우면 |
 * |---|---|
 * | 주석 언급이 카운트를 **부풀려** 호출 누락을 가린다 → **조용히 통과** | URL 이 잘려 카운트가 **줄어** RED → 시끄럽지만 안전 |
 *
 * 가드의 존재 이유가 "조용히 통과" 를 막는 것이므로 그쪽을 닫는다. URL 과 호출이 같은
 * 줄에 놓이는 날이 오면 RED 로 드러나고, 그때 사람이 판단하면 된다.
 *
 * > **export 인 이유**: 주석 처리 규칙은 "세는" 가드만의 것이 아니다. 넓혀진 필드를 겨눈
 * > 낡은 캐스트를 찾는 가드도 같은 규칙이 필요한데, 거기서 다시 구현하면 이 모듈이 막으려던
 * > 비대칭이 그대로 재발한다 — 실제로 walker 가 그렇게 사본 5개가 됐다.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * 문자열·템플릿 리터럴 내용을 지운다(따옴표는 남긴다).
 *
 * ## 왜 필요한가 — 가드의 픽스처가 가드에 걸린다
 *
 * 구조적 가드의 spec 은 **검출 대상 코드를 문자열로 들고 있다**. 그 spec 자체를 전수 스캔의
 * 대상에 넣으면 픽스처가 곧바로 offender 가 된다 — 실제로 `findStaleSpecCasts` 를 도입한
 * 날 자기 spec 을 잡았다.
 *
 * 이걸 허용목록으로 덮으면 **오판을 목록으로 은폐**하는 것이다(형제 가드
 * `masked-reject-callers-guard` 가 정확히 그 실수를 했다가 AST 로 옮기며 되돌렸다).
 * 리터럴 안의 코드 모양은 **코드가 아니다** — 그건 술어의 참인 성질이므로 여기서 처리한다.
 *
 * ## 한계
 *
 * 정규식이라 템플릿 리터럴의 `${...}` 안에 백틱이 중첩되면 경계를 잘못 잡을 수 있다.
 * 틀리는 방향은 **더 지우는 쪽**(= 덜 검출 → 조용히 통과)이므로 무해하지 않다. 그러나
 * AST 로 옮기는 비용(spec 443개 파싱)을 지금 치를 근거가 없다 — 그 형태가 저장소에
 * 실재하면 이 주석이 판단 기록으로 남는다.
 */
export function stripLiterals(src: string): string {
  return src
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/**
 * 주석을 제외하고 `<name>(` 또는 `<name><` 호출 수를 센다.
 *
 * 주석 처리 규칙과 그 한계는 `stripComments` 참조 — 특히 문자열 리터럴 안의 `//`
 * (URL 등)도 주석으로 보고 잘라낸다. 의도된 선택이고, 틀리는 방향이 RED 다.
 */
export function countCalls(src: string, name: string): number {
  const pattern = new RegExp(`\\b${name}[<(]`, 'g');
  return (stripComments(src).match(pattern) ?? []).length;
}

/**
 * 한 소스가 **raw `UPDATE`/`DELETE … RETURNING`** 을 실행하는가.
 *
 * ## 왜 필요한가 — 큐레이션 목록은 "새 지점" 을 못 본다
 *
 * 자매 가드들은 **손으로 고른 파일 목록**(`EXPECTED`)의 헬퍼 호출 수만 셌다. 그 방식은
 * *"아는 지점이 후퇴하지 않는지"* 는 지키지만 *"모르는 지점이 생겼는지"* 는 원리적으로
 * 못 본다 — 목록 밖 파일에 새 raw UPDATE 가 생기면 **아무 가드도 RED 를 내지 않는다**
 * (`01_12_26` architecture W1). 실측으로도 목록(3파일) 밖에 이미 대상이 있었다.
 *
 * 그래서 입력 집합을 **손으로 고르지 않고 발견**한다. 목록을 줄이는 편집이 조용히
 * 통과하던 표면이 사라진다.
 *
 * ## 판정 축 — SQL 리터럴의 **첫 키워드**
 *
 * `.query(` 뒤의 SQL 리터럴을 꺼내 **선두가 `UPDATE`/`DELETE` 인지**를 본다. 호출 주변을
 * 훑는 방식(윈도우)으로 하면 안 된다 — 실측에서 두 종류가 오탐으로 잡혔다:
 *
 * | 형태 | 왜 대상이 아닌가 |
 * |---|---|
 * | `INSERT … RETURNING` | command tag 가 INSERT — 튜플이 아니라 행 배열이다 |
 * | `INSERT … ON CONFLICT DO UPDATE … RETURNING` | 본문에 `UPDATE` 가 있지만 여전히 INSERT 태그다 |
 *
 * 선두 키워드로 가르면 둘 다 자연히 빠진다.
 *
 * ## 이 축이 **안** 보는 것 (의도 + 미문서 blind spot 정정)
 *
 * - QueryBuilder `.update().execute()` 는 대상이 아니다 — 그쪽 반환은 `[rows, count]` 튜플이
 *   아니라 `UpdateResult { raw, affected }` 라 애초에 다른 계약이다. 엔진 §7.4·§7.5 의
 *   **의도된 조건부 UPDATE**(경합 판정용 `affected` 기반)가 전부 그 형태이므로, 이 가드는
 *   그것들을 **구조적으로** 건드리지 않는다(allowlist 로 빼 줄 필요가 없다).
 * - **`.query(sqlVar)` — SQL 이 변수에 담겨 전달되면 원리적으로 못 본다.** 이 판정 축은
 *   `.query(` 뒤에 오는 **문자열 리터럴**만 읽는다. SQL 을 상수/템플릿으로 조립해 변수에
 *   담고 `.query(sql, params)` 처럼 넘기면 `m[1]` 이 리터럴이 아니라서 애초에 매치되지
 *   않는다(scratch 프로브로 실측, `false` 반환 — `01_12_26` W1). 넓히지 않는다 — 변수를
 *   추적하려면 데이터플로 분석이 필요해 정규식 스캐너의 범위를 벗어난다. 이 저장소의
 *   raw UPDATE/DELETE 지점은 지금까지 전부 리터럴이라 실피해는 없지만, 다음 사람이 변수로
 *   리팩터하면 **조용히** 이 가드의 사각지대로 들어간다는 뜻이다.
 * - **CTE 접두 — `WITH … UPDATE/DELETE … RETURNING` 을 못 본다.** 판정이 SQL 의 **첫
 *   키워드**를 보는데 CTE 는 `WITH` 로 시작하므로 `^\s*(UPDATE|DELETE)` 가 어긋난다.
 *   PostgreSQL 은 CTE 를 얹어도 top-level 이 UPDATE/DELETE 면 **command tag 가 그대로**라
 *   반환은 `[rows, count]` 튜플이다 — 즉 이건 오탐 배제가 아니라 **진짜 미탐지**다.
 *   오늘 저장소에 그 형태의 사용처는 없다(전수 확인). 넓히지 않는 이유는 첫 키워드 판정이
 *   `INSERT … ON CONFLICT DO UPDATE` 오탐을 배제하는 근거이기도 해서다 — CTE 를 받으려면
 *   본문을 파싱해 top-level 커맨드를 찾아야 하고, 그건 정규식 스캐너를 SQL 파서로 바꾸는
 *   일이다(이 저장소가 기록한 "유한한 문제를 무한한 문제와 바꾸지 말라").
 *
 *   > **이 항목은 1라운드 리뷰(`12_41_15` requirement)가 이미 짚었는데 SUMMARY 합성에서
 *   > 누락돼 두 라운드를 그냥 지나갔다** (`13_46_53` W4 가 재발견). 개별 리포트에 있던
 *   > 발견이 요약을 거치며 사라질 수 있다 — 요약만 읽고 처분하면 이렇게 샌다.
 */
export function countRawUpdateReturning(src: string): number {
  const clean = stripComments(src);
  // `.query(` / `.query<…>(` 뒤에 오는 첫 문자열 리터럴(백틱·작은따옴표·큰따옴표).
  // 작은따옴표를 빠뜨렸던 것이 과거 CRITICAL(소셜 로그인 상시 실패)의 사각지대였다.
  //
  // 제네릭 부분은 **한 단계 중첩**까지 받는다 — `.query<Array<{ id: string }>>(` 형태가
  // 저장소에 실존한다(`scripts/eval-retrieval.ts:162`). 옛 `<[^>]*>` 는 안쪽 `<...>` 를
  // 만나면 첫 `>` 에서 멈춰 버려 바깥 `.query<Array<...>>(` 전체가 매치 실패했다 — 오늘은
  // 전부 SELECT 라 무해하지만 이 자리에 UPDATE...RETURNING 이 오면 통째로 못 봤을 것이다
  // (`01_12_26` testing/requirement W1). 2단계 이상 중첩은 여전히 못 받는다 — 저장소
  // 실측상 1단계를 넘는 사례가 없어 그 이상은 넓히지 않는다.
  const CALL =
    /\.query\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
  let count = 0;
  for (const m of clean.matchAll(CALL)) {
    const sql = m[1].slice(1, -1);
    if (/^\s*(UPDATE|DELETE)\b/i.test(sql) && /\bRETURNING\b/i.test(sql)) {
      count++;
    }
  }
  return count;
}

/**
 * `null as unknown as X` — 엔티티 타입이 컬럼의 `nullable: true` 를 안 적어서 **강제되는**
 * 이중 캐스트를 센다.
 *
 * ## 왜 이 형태를 세나
 *
 * 컬럼이 `nullable: true` 인데 TS 필드가 non-null 이면, `null` 을 대입하는 코드가 컴파일러를
 * **두 단계로 우회**해야 한다. 그 캐스트는 "타입이 실제보다 좁다" 는 **기계적으로 검출 가능한
 * 증거**다 — 사람이 판단할 필요가 없다.
 *
 * 2026-09-03 에 그런 8건(`User` 7 · `Schedule` 1)의 타입을 `| null` 로 넓혀 캐스트를 전부
 * 걷어냈다. `strictNullChecks` 가 켜져 있는데도 **신규 타입 오류가 0** 이었다 — 런타임 코드는
 * 이미 null 을 올바로 다루고 **타입만 거짓말하고 있었다.**
 *
 * ## 왜 backend ratchet 이 이 자리를 못 보나
 *
 * `scripts/backend-typecheck-baseline.json` 은 **`*.spec.ts` 만** 담는다(2026-09-03 실측:
 * 37파일 중 비-spec **0개**). 설계상 그렇다 — spec 은 `nest build` 가 exclude 하고 jest 가
 * 타입을 strip 해 "그 검사 말고는 아무도 못 보는" 자리를 메우는 게 그 ratchet 의 목적이다.
 * 그래서 **프로덕션 소스의 타입 회피는 어떤 게이트도 안 잡는다.**
 *
 * 이 축의 전수 목록·완료 이력: `plan/complete/entity-nullable-column-type-mismatch.md`
 * (33/33 파일로 종결). **다음 배치**는 그 plan 이 아니라
 * `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§5.4 drift 배치" 다 —
 * 엔티티 컬럼 축은 닫혔고 남은 것은 DTO 선언 축이다.
 */
export function countNullAsUnknownAsCasts(src: string): number {
  // 주석 속 언급은 세지 않는다 — 이 저장소에 정리 이력을 적어 둔 주석이 실재한다
  // (`secret-resolver.service.ts`: "종전의 `as unknown as string` 은 …").
  const pattern = /\bnull as unknown as\b/g;
  return (stripComments(src).match(pattern) ?? []).length;
}

/** {@link countNullAsUnknownAsCasts} 의 "지점이 존재하는가" 만 필요할 때 쓰는 얇은 래퍼. */
export function hasNullAsUnknownAsCast(src: string): boolean {
  return countNullAsUnknownAsCasts(src) > 0;
}

/** {@link countRawUpdateReturning} 의 "지점이 존재하는가" 만 필요할 때 쓰는 얇은 래퍼. */
export function hasRawUpdateReturning(src: string): boolean {
  return countRawUpdateReturning(src) > 0;
}

/** {@link collectTsFiles} 옵션. */
export interface CollectTsFilesOptions {
  /**
   * `*.spec.ts` 를 포함할지. **기본 `false`** — 대부분의 가드는 프로덕션 소스만 본다.
   *
   * `true` 가 필요한 실사례가 하나 있다: `masked-reject-callers-guard` 는 테스트 코드가
   * 마커 거부를 안 하는 base 함수를 직접 부르는 것도 잡아야 해서 spec 을 스캔하고,
   * 그래서 허용목록에 `*.spec.ts` 항목이 실제로 들어 있다.
   */
  includeSpec?: boolean;
}

/**
 * 디렉터리를 재귀 스캔해 `.ts` 파일 절대경로를 **정렬해** 돌려준다.
 *
 * ## 왜 여기 있나
 *
 * 이 로직이 `repo-guards/__tests__/` 안에서 **사본 5개**가 됐다(`collectSourceFiles` ·
 * `walkTsFiles` · `listSourceFiles` · `collectScanTargets` · `listProductionSources`).
 * 위 §"왜 공유하나" 가 **세는** 축에 대해 말한 것이 **모으는** 축에도 그대로 적용된다 —
 * 한쪽만 하드닝하면 나머지에 같은 결함이 남는다.
 *
 * ## 다섯 사본의 차이 중 살아있던 것은 하나뿐이다 (2026-09-04 실측)
 *
 * 사본들은 네 축에서 갈렸는데, 스캔 루트에 대해 실제로 결과를 바꾸는 것은 `.spec.ts`
 * 포함 여부뿐이었다:
 *
 * | 축 | 살아있나 | 근거 |
 * |---|---|---|
 * | `.spec.ts` 제외 | **예** | 포함/제외가 `1261` vs `818` — 차이 **443** 이 `.spec.ts` 수와 일치 |
 * | `.d.ts` 제외 | 아니오 | `src` 하위 `.d.ts` **0개** |
 * | `node_modules`·`dist` skip | 아니오 | 스캔 루트가 `src` 하위라 애초에 없다 |
 * | `sort()` | 순서만 | 5중 2개만 정렬했다 |
 *
 * `.d.ts` 제외와 vendor skip 은 **지금은 아무것도 안 거르지만 켜 둔다** — 어느 사본도
 * 그것들을 *원한* 적이 없고(둘 다 "안 보고 싶다" 는 필터다), 나중에 `.d.ts` 가 생기면
 * 끄고 있는 쪽이 조용히 틀린다. 정렬도 항상 한다: 가드 메시지가 결정적이어야 한다.
 *
 * 따라서 옵션은 **살아있는 축 하나**만 노출한다.
 */
export function collectTsFiles(
  root: string,
  { includeSpec = false }: CollectTsFilesOptions = {},
): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        (includeSpec || !entry.name.endsWith('.spec.ts'))
      ) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out.sort();
}

/**
 * 경로 문자열의 구분자를 POSIX(`/`)로 바꾼다 — **순수 문자열 변환**.
 *
 * `path.relative` 와 갈라 둔 이유는 **관측 가능성**이다. 합쳐 두면 POSIX CI 에서
 * `path.relative` 가 애초에 `/` 만 내놓아 윈도우 분기를 **어떤 입력으로도 탈 수 없다**.
 * 실제로 그렇게 짰다가 `toPosixRelative('C:\\a', 'C:\\a\\b\\c.ts', '\\')` 가
 * `'../C:/a/b/c.ts'` 를 내며 실패했다 — POSIX `path.relative` 는 윈도우 경로를 모른다.
 * 문자열 변환만 떼면 플랫폼과 무관하게 그 분기를 직접 겨눌 수 있다.
 */
export function toPosixPath(p: string, sep: string = path.sep): string {
  return p.split(sep).join('/');
}

/**
 * `root` 기준 상대 경로를 **POSIX 구분자로 정규화**해 돌려준다.
 *
 * ## 왜 필요한가 — `path.relative` 만으로는 플랫폼마다 다른 문자열이 나온다
 *
 * 윈도우에서 `path.relative` 는 `modules\executions\dto.ts` 를 준다. 저장소 가드들이
 * 그 값을 보고서에 싣고 테스트가 문자열로 비교하므로, 정규화를 빠뜨리면 같은 위반이
 * 플랫폼마다 다른 문자열로 보고된다.
 *
 * ## 왜 여기 있는가 — 같은 한 줄이 여덟 군데 복제돼 있었다
 *
 * 2026-09-04 실측: `path.relative(...).split(path.sep).join('/')` 가 저장소에 **8곳**.
 * 그중 4곳은 **바로 앞 리뷰 라운드에서 "정규화가 빠졌다" 는 지적을 고치며 내가 늘린
 * 것**이다 — 사본을 없애는 것이 주제인 PR 안에서 사본을 넷 더 만들었다. 추출이 맞다.
 */
export function toPosixRelative(root: string, file: string): string {
  return toPosixPath(path.relative(root, file));
}
