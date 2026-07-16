# 유지보수성(Maintainability) Review — 재리뷰 (fix 커밋 fdd206ee8)

대상: 직전 리뷰(`review/code/2026/07/17/01_07_43`, LOW/Critical 0/Warning 6)의 W#3(세그먼트 리터럴
산재)·W#5(약한 e2e 404 가드) 조치. 실제 코드 diff 는 3개 파일 26줄
(`codebase/frontend/src/lib/workspace/href.ts`, `codebase/frontend/src/app/(main)/[...rest]/page.tsx`,
`codebase/frontend/e2e/workspaces/slug-routing.spec.ts`)이며, 이 fix 자체가 새 결함을 넣었는지에 집중했다.

## 발견사항

- **[INFO]** W#3 조치는 정확하고 완결적 — 생성부/판별부 결합을 상수로 명시
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:4-10`, `codebase/frontend/src/app/(main)/[...rest]/page.tsx:7-10,55`
  - 상세: `WORKSPACE_ROUTE_SEGMENT = "w"` 를 링크 생성부(`buildWorkspaceHref`)에 두고 판별부
    (catch-all `rest[0] === WORKSPACE_ROUTE_SEGMENT`)가 그대로 import 해 사용한다. 네이밍이
    목적을 정확히 드러내고(`WORKSPACE_ROUTE_SEGMENT`), docstring 이 "이 상수가 어긋나면
    무한 중첩이 재발한다"는 결합 이유까지 명시해 향후 리팩터링 시 안전판 역할을 한다.
    `rest.length === 2` 는 의도적으로 상수화하지 않고 주석만 보강했는데(RESOLUTION.md 근거:
    "세그먼트 2개 = `/w/<slug>` 라는 구조의 직접 표현이라 이름을 붙이면 오히려 한 겹 우회"),
    직전 리뷰도 이 항목을 "필수는 아님"으로 명시했던 선택 사항이라 결함이 아니다.
  - 제안: 없음 — 조치 완결.

- **[INFO]** W#5 조치도 정확 — 실제 not-found UI 렌더까지 증명하고, 파일 기존 컨벤션(타임아웃)과 정합
  - 위치: `codebase/frontend/e2e/workspaces/slug-routing.spec.ts:180-186`
  - 상세: `page.getByRole("heading", {...}).toBeVisible({timeout: 15_000})` + 사이드바 유지
    assertion 추가로, 이전엔 URL 세그먼트 개수만 봐서 "조용한 blank 렌더"도 통과하던 약한
    가드가 실제 404 바운더리 렌더까지 검증하도록 강화됐다. `15_000` 타임아웃은 매직 넘버로
    보일 수 있으나 같은 파일 내 다른 모든 `waitForURL`/`toBeVisible` 호출이 동일하게
    `{timeout: 15_000}` 를 쓰고 있어(예: 35, 49, 59, 69, 81, 137, 151, 165, 169, 202행)
    기존 컨벤션을 그대로 따른 것이지 새 매직 넘버가 아니다. 정규식에 ko/en 제목을 모두
    하드코딩한 것도 파일의 기존 패턴(`/\/docs\/(ko|en)\//` 등 다국어 관용)과 일관되고,
    실제 `lib/i18n/dict/{ko,en}/errorPage.ts` 의 `title` 값과 정확히 일치함을 확인했다.
  - 제안: 없음.

- **[INFO]** (참고, 이번 fix 범위 밖) `WORKSPACE_ROUTE_SEGMENT` 도입 취지가 아직 전 소비처에
  퍼지지는 않음
  - 위치: `codebase/frontend/src/components/auth/auth-provider.tsx:58` —
    `const onWorkspaceSlugRoute = pathname.startsWith("/w/");` 가 여전히 raw 리터럴 사용
  - 상세: 새 상수의 docstring 은 "생성과 판별이 같은 값에 의존"한다는 결합을 근거로 드는데,
    `auth-provider.tsx` 도 동일한 세그먼트("/w/")를 판별 목적으로 검사하는 세 번째 소비처다.
    이번 fix 커밋(3파일 26줄)의 명시된 범위(page.tsx/href.ts 만)를 벗어나 손대지 않은 것은
    타당한 스코프 판단이며 새 결함은 아니다. 다만 상수가 존재하는 지금, 향후 라우트
    세그먼트명이 바뀌면 이 파일만 갱신 누락될 여지가 여전히 남아 있다는 점은 후속 참고로
    기록해둔다.
  - 제안: (선택, 후속) `auth-provider.tsx` 도 `WORKSPACE_ROUTE_SEGMENT` 를 import 해
    `pathname.startsWith(\`/${WORKSPACE_ROUTE_SEGMENT}/\`)` 로 정합시키면 상수 도입 취지가
    완전히 실현된다. 이번 재리뷰의 차단 사유는 아님.

## 요약

fix 커밋(fdd206ee8)은 직전 리뷰의 W#3·W#5 두 경고를 정확히 겨냥해 최소 범위(3파일 26줄)로
해소했다. `WORKSPACE_ROUTE_SEGMENT` 상수는 네이밍·docstring·생성/판별 양쪽 사용이 모두
적절하고, `rest.length===2` 미상수화는 근거가 명시된 의도적 선택이라 결함이 아니다. e2e
assertion 은 실제 not-found UI 렌더 검증으로 회귀 가드를 강화했고, 타임아웃·정규식 패턴 모두
파일 내 기존 컨벤션과 일관된다. 새로 도입된 가독성 저하, 함수 길이/중첩 증가, 매직 넘버,
중복 코드는 발견되지 않았다. 유일한 참고 사항은 상수 도입 취지가 아직 미치지 않은 제3의
소비처(`auth-provider.tsx`)가 범위 밖에 남아 있다는 점인데, 이는 이번 fix 의 결함이 아니라
후속 정리 기회에 가깝다.

## 위험도

NONE
