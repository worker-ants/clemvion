# 부작용(Side Effect) Review — 재리뷰 (fix 커밋 fdd206ee8)

리뷰 대상: 직전 리뷰(01_07_43) SUMMARY 의 W#3(세그먼트 상수화)·W#5(e2e 404 assertion 강화)·W#6(CHANGELOG) fix 커밋 `fdd206ee8`. 코드 파일 3개(`href.ts`, `(main)/[...rest]/page.tsx`, `e2e/workspaces/slug-routing.spec.ts`) + 문서 파일(CHANGELOG.md, plan/review 산출물).

## 핵심 확인: `buildWorkspaceHref` 출력 문자열 동일성

`codebase/frontend/src/lib/workspace/href.ts`:

```ts
export const WORKSPACE_ROUTE_SEGMENT = "w";
...
return slug ? `/${WORKSPACE_ROUTE_SEGMENT}/${slug}${clean}` : clean;
```

- `WORKSPACE_ROUTE_SEGMENT` 는 `export const` 로 선언된 문자열 리터럴 `"w"` — TS 는 `const` 리터럴 초기화식에 대해 widening 없이 literal type `"w"` 를 추론한다(별도 `as const` 불필요). 런타임 값도 정확히 `"w"`.
- 템플릿 리터럴 치환 결과: `` `/${"w"}/${slug}${clean}` `` = `` `/w/${slug}${clean}` `` — 변경 전 하드코딩 `` `/w/${slug}${clean}` `` 과 **문자 단위로 완전히 동일**. 상수 삽입이 공백/구분자를 추가하거나 변경하지 않음을 직접 확인했다.
- `slug` 가 falsy 인 분기(`: clean`)는 이번 diff 로 손대지 않음 — 그대로 유지.
- 결론: 이 함수가 생성하는 URL 문자열은 **회귀 없이 기존과 100% 동일**하다. 순수 리팩터(값 추출)이고 계산 로직·조건 분기·인자 순서 어느 것도 바뀌지 않았다.

## 공개 API 영향(30+ 호출부)

```
buildWorkspaceHref  → 30개 이상 소비처 (grep 확인)
buildExecutionHref  → buildWorkspaceHref 내부 위임, 시그니처·바디 무변경
buildEditorHref     → 동일
```

- `buildWorkspaceHref(slug, path): string` 시그니처(파라미터 개수·타입·리턴 타입) **무변경**. 기존 30+ 호출부(`sidebar.tsx`, `workspace-slug-gate.tsx`, 각 `(main)/w/[slug]/**/page.tsx`, `rerun-modal.tsx` 등) 전부 함수 시그니처·리턴값에 영향받지 않는다.
- 신규 export `WORKSPACE_ROUTE_SEGMENT` 는 **추가(additive)** 이며 기존 export(`buildWorkspaceHref`/`buildExecutionHref`/`buildEditorHref`) 이름·타입을 바꾸지 않았다 — barrel export 충돌·이름 재사용 없음(grep 결과 이 상수를 import 하는 곳은 신규 소비처 `page.tsx` 1곳뿐).
- 신규 named export 추가는 하위 호환(back-compat) 파괴 요인이 아니다(기존 `import { buildWorkspaceHref } from ...` 사용자는 영향 없음).

## `(main)/[...rest]/page.tsx` 판별 로직

```ts
const workspacePrefixed = rest[0] === WORKSPACE_ROUTE_SEGMENT;
```

- 이전 `rest[0] === "w"` 와 런타임 동작 동일(값이 같은 리터럴이므로). `rest.length === 2` 분기, `notFound()` 호출 조건, `useEffect` 의 forward 로직 — 이번 diff 로 변경된 바 없음(주석만 보강).
- 다른 파일에서 `rest[0] === "w"` 류의 병행 하드코딩 비교가 남아있는지 grep 했으나 **없음** — 생성부/판별부 결합이 상수 하나로 완전히 수렴했고, 향후 세그먼트명이 바뀔 때 갱신을 놓칠 잔여 사이트가 없다.
- 이 catch-all 라우트는 `(main)` 그룹 유일이며(`(editor)` 쪽 별도 catch-all 없음) 이번 상수를 소비할 다른 라우트가 존재하지 않아, 상수화가 커버해야 할 표면은 이미 다 커버됨.

## 시그니처/인터페이스 변경 여부

- 시그니처 변경: **없음**. `href.ts` 의 export 3개 함수(`buildWorkspaceHref`/`buildExecutionHref`/`buildEditorHref`) 모두 파라미터·리턴 타입 동일.
- 인터페이스 변경: 신규 export 1개 추가만 있고 기존 인터페이스 축소·breaking 변경 없음.
- 이벤트/콜백: `page.tsx` 의 `router.replace(...)` 호출 조건·`notFound()` 트리거 조건 이번 diff 로 불변(직전 fix 에서 이미 확정, 이번은 상수 치환뿐).

## 테스트·문서 변경(부작용 무관 확인)

- `e2e/workspaces/slug-routing.spec.ts`: `waitForLoadState("networkidle")` 를 실제 404 heading `toBeVisible()` + 사이드바 `nav a[href="/docs"]` 가시성 assertion으로 대체 — 검증을 더 엄격하게 만든 변경으로, 애플리케이션 코드에 부작용을 일으키지 않는다(테스트 전용).
- `CHANGELOG.md`: 문서 전용 삽입, 실행 경로 영향 없음.
- `plan/in-progress/spec-update-catch-all-terminal-contract.md`(신규), `plan/in-progress/user-guide-routing-loop-fix.md`(체크리스트 갱신), `review/code/2026/07/17/01_07_43/{RESOLUTION.md,SUMMARY.md,_retry_state.json}`(신규): 전부 `plan/**`·`review/**` 산출물로 CLAUDE.md 컨벤션상 developer 쓰기 허용 범위 내 문서 파일. 코드 실행 경로·전역 상태·파일시스템 런타임 부작용과 무관.

## 전역 상태·환경 변수·네트워크·파일시스템

- 이번 3개 코드 파일 diff 어디에도 전역 변수 도입/수정, `process.env` 읽기·쓰기, 외부 네트워크 호출, 런타임 파일시스템 I/O 가 없다. `WORKSPACE_ROUTE_SEGMENT` 는 모듈 스코프 `const`(상수, 재할당 불가)로 전역 가변 상태가 아니다.

## 발견사항

- **[INFO]** 상수가 `"w"` 문자열 리터럴로 TS literal type 추론에 의존
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:10`
  - 상세: `export const WORKSPACE_ROUTE_SEGMENT = "w"` 는 `const` 이므로 TS 가 literal type `"w"` 를 자동 추론해 `page.tsx` 의 `rest[0] === WORKSPACE_ROUTE_SEGMENT` 비교가 타입 레벨에서도 `"w"` 와 동등하게 좁혀진다(`readonly` 재할당 방지도 동반). 별도 `as const` 캐스트가 필요 없어 안전하나, 만약 향후 이 상수를 `let` 로 바꾸거나 함수 인자로 넘기며 타입을 넓히면(`string` 으로 widen) 이 비교의 타입 안전성이 약해질 수 있다.
  - 제안: 조치 불요(현재 코드는 안전). 향후 리팩터 시 `const` 유지를 유지보수 가이드에 남겨두면 좋음(선택).

## 요약

`href.ts` 의 `buildWorkspaceHref` 가 하드코딩 `` `/w/` `` 리터럴을 신규 상수 `WORKSPACE_ROUTE_SEGMENT`("w") 참조로 대체한 변경은 순수 값 추출 리팩터로, 생성되는 URL 문자열이 문자 단위로 기존과 완전히 동일함을 템플릿 리터럴 치환 결과로 직접 확인했다. 함수 시그니처·리턴 타입·분기 로직 모두 무변경이며, 신규 export 는 기존 API 를 깨지 않는 순수 추가(additive)다. 저장소 전역 30개 이상의 `buildWorkspaceHref`/`buildExecutionHref`/`buildEditorHref` 호출부는 이번 diff 로 영향받지 않는다. `(main)/[...rest]/page.tsx` 의 판별 로직도 동일 상수를 참조하도록 바뀌었을 뿐 조건·부작용(라우팅 forward/`notFound()` 트리거)은 직전 fix 그대로 유지된다. e2e·CHANGELOG·plan 문서 변경은 부작용 관점에서 중립(테스트 강화, 문서 추가)이다. 전역 변수 도입, 환경 변수 접근, 네트워크 호출, 예상치 못한 파일시스템 I/O 는 발견되지 않았다.

## 위험도
NONE
