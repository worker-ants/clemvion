# Security Review — commit `fdd206ee8`

리뷰 대상: `refactor(navigation): ai-review 지적 반영 — 세그먼트 상수화·e2e 404 검증·CHANGELOG` (선행 PR `34008deb5` 의 W#3·W#5·W#6 fix 커밋). 본 세션은 이전 라운드(01_07_43)가 `agents_forced` 화이트리스트를 어기고 security 를 누락한 데 대한 뒤늦은 보강 리뷰다.

## 발견사항

### 핵심 점검 1 — `buildWorkspaceHref` 치환이 open-redirect 방어를 약화시키는지

- **[INFO]** 치환은 순수 리터럴 인라인 → 상수 참조로, 출력에 어떤 차이도 없다.
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:10,37`
  - 상세: `WORKSPACE_ROUTE_SEGMENT`는 `export const WORKSPACE_ROUTE_SEGMENT = "w";` 로 선언된 컴파일타임 문자열 리터럴이다. `` `/${WORKSPACE_ROUTE_SEGMENT}/${slug}${clean}` `` 는 `` `/w/${slug}${clean}` `` 와 바이트 단위로 동일하다. 방어 로직 자체(`toSafeInternalPath` 호출)는 이 diff 에서 전혀 변경되지 않았다 — `safe-path.ts` 는 diff 대상에 없고, `clean = toSafeInternalPath(path)` 호출 순서·인자도 그대로다. 따라서 protocol-relative(`//evil.com`, `\\evil.com`), 제어문자(tab/CR/LF) 우회에 대한 방어 강도는 변경 전과 완전히 동일하다.
  - 실측: `href.test.ts` 의 기존 회귀 테스트(`prefixes an absolute path with /w/<slug>`, `collapses protocol-relative leading slashes`, `it.each` 로 backslash/tab/CR/LF 조합 7건)를 코드와 대조한 결과, 모두 `/w/...` 문자열 리터럴을 기대값으로 그대로 사용하고 있어 이 diff 이후에도 여전히 유효하다(상수 값이 `"w"`이므로 리터럴 기대값과 정확히 일치). 테스트가 상수를 import 해 참조하지 않고 하드코딩된 `"/w/..."` 문자열을 쓴다는 점은 향후 상수 값이 바뀌면 테스트가 (의도대로) 실패해 드리프트를 잡아준다는 점에서 오히려 바람직한 형태다.
  - 결론: 이 항목은 방어 약화가 아니다. 조치 불요.

### 핵심 점검 2 — 신규 `export const WORKSPACE_ROUTE_SEGMENT` 가 새로운 취약 표면을 만드는지

- **[INFO]** 새로운 공격 표면 없음.
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:10`
  - 상세: ES 모듈의 named export 는 read-only live binding이다 — 소비 모듈(`page.tsx`)은 `import { WORKSPACE_ROUTE_SEGMENT } from "@/lib/workspace/href"` 로 값을 읽을 수만 있고 재할당은 언어 수준에서 불가능하다(`const` 이므로 원본 모듈 내에서도 재할당 불가). 값은 사용자 입력·환경변수·서버 응답 등 외부에서 주입되는 경로가 전혀 없는 순수 정적 문자열이다. `grep` 결과 이 상수를 참조하는 지점은 `href.ts`(정의부)와 `page.tsx`(판별부) 두 곳뿐이며, 둘 다 클라이언트 번들 내부 상수 비교/문자열 조합 용도로만 쓰인다. 외부에서 조작 가능한 환경설정, API 응답, URL 파라미터로 이 상수가 재정의될 경로는 없다.
  - 결론: 조치 불요.

### 핵심 점검 3 — `(main)/[...rest]/page.tsx` 의 상수 기반 판별을 우회해 무한 루프·의도치 않은 forward 를 유발할 입력이 있는지

- **[INFO]** `rest[0] === WORKSPACE_ROUTE_SEGMENT` 는 `rest[0] === "w"` 와 논리적으로 항등이므로, 이 diff 자체가 판별 로직에 새로운 취약점을 만들지는 않는다.
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx:55`
  - 상세: `params.rest` 는 Next.js App Router 의 optional catch-all 세그먼트로, 항상 URL 경로 세그먼트 단위로 분리된 `string[]` 이다(타입 코어션·객체 주입으로 `rest[0] === "w"` 를 우회할 경로 없음). 상수 치환 전/후로 비교 대상 문자열이 정확히 같으므로(`"w"`), 판별을 통과/실패시키는 입력 집합에 변화가 없다 — 즉 이 diff 는 우회 표면을 넓히지도 좁히지도 않는다.
  - 무한 루프 방지 구조 자체(이 diff 범위 밖, 이전 커밋에서 이미 검토됨)도 그대로 유지된다: `workspacePrefixed && !workspaceRootSlug` 인 경우 `useEffect` 의 `router.replace` 분기(72행 `if (workspacePrefixed) return;`)가 조기 반환해 재부착을 하지 않고, render 단계의 91행 `notFound()` 로 종결한다. `rest.length === 2` 판별도 이 diff 에서 값이 바뀌지 않았다.
  - 결론: 이 diff 자체로 인한 신규 우회 벡터는 없음. (참고: `rest[1]`(slug 값)을 멤버십 검증 없이 그대로 `buildWorkspaceHref` 에 전달해 `/w/<slug>/dashboard` 로 forward 하는 기존 설계는 이전 리뷰 라운드(01_07_43 SUMMARY INFO#1)에서 이미 "의도된 설계, 실제 접근 제어는 `(main)/w/[slug]` layout 의 `WorkspaceSlugGate` 에 위임" 으로 판정되었고, 이번 diff 는 그 로직을 변경하지 않았으므로 재론하지 않는다.)

### 그 외 파일(CHANGELOG.md, e2e spec, plan 문서, RESOLUTION/SUMMARY)

- **[INFO]** 보안 관련 이슈 없음.
  - 상세: CHANGELOG·plan 문서는 순수 서술형 텍스트이며 하드코딩된 시크릿·인증정보 없음. e2e 테스트 diff(`slug-routing.spec.ts`)는 404 UI 렌더 assertion 을 강화한 것으로, 검증 로직 강화이지 신규 입력 처리 경로가 아니다. `review/code/**` 산출물(RESOLUTION.md, SUMMARY.md, `_retry_state.json`)은 리뷰 메타데이터로 시크릿·자격증명 노출 없음.

## OWASP Top 10 / 그 외 카테고리 점검 결과

- 인젝션(SQL/XSS/커맨드/경로탐색): 해당 없음. 순수 클라이언트 라우팅 문자열 조합이며, 서버 실행·DOM 삽입·파일시스템 접근 코드 없음.
- 하드코딩 시크릿: 없음.
- 인증/인가: `WorkspaceSlugGate`(diff 밖) 에 위임하는 기존 구조 유지, 이 diff 로 인한 변화 없음.
- 입력 검증: `toSafeInternalPath` 정규화 로직·호출 순서 불변.
- 암호화: 해당 없음(암호화/해시 코드 변경 없음).
- 에러 처리: `notFound()` 는 Next.js 표준 404 바운더리를 태울 뿐 민감정보 노출 없음.
- 의존성 보안: 이 diff 에 의존성 변경 없음.

## 요약

이번 diff 는 기존 하드코딩 리터럴 `"w"` 를 `export const WORKSPACE_ROUTE_SEGMENT = "w"` 상수로 승격해 링크 생성부(`buildWorkspaceHref`)와 판별부(catch-all `page.tsx`)가 값을 공유하도록 리팩터링한 것으로, 값 자체·비교 로직·`toSafeInternalPath` 기반 open-redirect 방어 경로 어느 것도 변경하지 않았다. 상수는 외부에서 주입·재정의될 수 없는 순수 정적 문자열이라 신규 공격 표면을 만들지 않으며, catch-all 의 재부착 가드 판별(`rest[0] === WORKSPACE_ROUTE_SEGMENT`)도 이전과 논리적으로 항등이라 무한 루프·의도치 않은 forward 를 유발하는 신규 입력 클래스는 발견되지 않았다. `href.test.ts`/`safe-path.test.ts` 의 기존 회귀 테스트(protocol-relative `//`, `\\`, tab/CR/LF 우회 케이스 포함)는 이 diff 이후에도 여전히 유효하다. 그 외 CHANGELOG·e2e·plan·review 산출물 파일들에서도 시크릿 노출, 인젝션, 인증/인가 우회 등 보안 이슈는 발견되지 않았다.

## 위험도

NONE
