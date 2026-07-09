# 아키텍처(Architecture) 리뷰

대상: 슬러그 라우팅 round-3 fix 커밋(`865e6b93`). 실질 프로덕션 코드 변경은
`rerun-modal.tsx` 1개 훅(`router.push` 성공 네비게이션에 `buildWorkspaceHref(slug, ...)`
래핑 추가) 뿐이고, 나머지는 회귀 테스트 3파일(`rerun-modal.test.tsx`,
`workspace-store.test.ts`, `href.test.ts`) + RESOLUTION.md 문서 갱신이다.
round-1(`18_24_41`)·round-2(`07_56_16`/`08_18_37`) architecture 리뷰가 이미 다룬
`useWorkspaceSlug` 이중 SoT(INFO)·`isSafeRedirectPath` 비대칭(W3, defer)·
`workspace-store`↔`resolve-fallback` type-only 순환(W4, defer) 은 본 diff 로 변경되지
않아 재론하지 않는다.

## 발견사항

- **[WARNING]** slug 프리픽스 부착이 순수 관례(convention)에 의존 — 구조적 강제 장치 부재
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:288-292`
    (금번 fix 지점) 및 `router.push`/`router.replace` 를 직접 호출하는 나머지 ~30개
    소비처(`buildWorkspaceHref` grep 결과: `app/(main)/w/[slug]/**`, `components/**`,
    `lib/integrations/**` 등)
  - 상세: 이번 fix 대상 파일은 이미 같은 컴포넌트 안에서 원본 실행 ID 링크(`href={buildWorkspaceHref(slug, ...)}`,
    L1004)에 동일 패턴을 쓰고 있었고 `useWorkspaceSlug`/`buildWorkspaceHref` 도 이미 import
    돼 있었다(diff 는 신규 import 를 추가하지 않음). 그럼에도 같은 파일의 다른 네비게이션
    호출부(재실행 성공 후 `router.push`)에서 래핑이 누락된 채 두 차례 리뷰 라운드(round-1
    grep 기반 점검, round-2 fix)를 통과해 round-3 에서야 발견됐다(커밋 메시지 자평:
    "멀티라인 표기라 round-1 단일행 grep 이 놓침"). 즉 "URL 이 FE 라우팅 SoT"라는 불변식을
    지키는 유일한 안전망이 사람 리뷰/grep 이었고, 그 안전망 자체가 이미 한 번 실패한 전례가
    있다. 소비처가 30곳 이상으로 늘어난 지금, 같은 defect class(bare path 로 slug 유실)가
    임의의 다른 호출부에서 재발할 구조적 가능성이 남아 있다 — 컴파일러/린터가 이를 강제하지
    않는다.
  - 제안: `useRouter()` + `buildWorkspaceHref` 수동 조합을 개별 호출부에 반복시키는 대신,
    `useWorkspaceRouter()` 같은 얇은 래핑 훅(`push(path)`/`replace(path)` 가 내부에서 항상
    `buildWorkspaceHref(slug, path)` 를 적용)으로 API 표면 자체에서 slug 프리픽스를 강제하는
    것을 검토. 훅 전환이 부담되면 최소한 `router.push`/`router.replace` 에 raw 문자열 리터럴을
    직접 넘기는 패턴을 금지하는 custom ESLint 룰(예: `no-restricted-syntax`)을 추가해 두 번째
    안전망을 마련.

- **[INFO(양호)]** 기존 확립된 패턴을 정확히 재사용 — 신규 결합/추상화 추가 없음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:288-292`
  - 상세: fix 자체는 이미 같은 파일·같은 모듈(`lib/workspace/href.ts`, `lib/workspace/use-workspace-slug.ts`)에
    존재하던 헬퍼/훅을 그대로 재적용한 것으로, 새 의존성이나 새 레이어 결합을 만들지 않았다.
    프레젠테이션 컴포넌트(모달)가 라우팅 정책(slug 프리픽스 규칙)을 직접 구현하지 않고 순수
    유틸(`buildWorkspaceHref`)·훅(`useWorkspaceSlug`)에 위임하는 기존 레이어 분리도 유지된다.
    변경 자체의 리스크는 낮다 — 위 WARNING 은 "이 fix" 가 아니라 "이 defect class 의 재발
    가능성"을 향한 것이다.

- **[INFO]** 테스트 보강이 실제 동작을 직접 검증(과도한 mock 없이) — 좋은 테스트 아키텍처
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts:38-49`(`it.each` 파라미터화),
    `codebase/frontend/src/lib/stores/__tests__/workspace-store.test.ts:96-131`(`setWorkspaces`
    전용 `describe` 블록)
  - 상세: `href.test.ts` 는 개별 `it` 로 흩어져 있던 open-redirect 회귀 케이스를 `it.each` 로
    통합해 케이스 추가 비용을 낮췄고, `workspace-store.test.ts` 는 `resolveFallbackWorkspace`
    를 mock 하지 않고 실제 스토어 액션(`setWorkspaces`)을 호출해 위임 동작을 종단 검증한다.
    둘 다 순수 함수/스토어 액션이라는 낮은 결합 표면을 그대로 활용한 결과로, 앞선 라운드가
    구축한 아키텍처(순수 함수 추출 + 단위테스트)의 이점이 실제로 회수되고 있음을 보여준다.

## 요약

이번 라운드는 이미 확립된 slug 라우팅 유틸(`buildWorkspaceHref`/`useWorkspaceSlug`)을 정확히
재적용하는 저위험 1-라인 fix이고 신규 결합·레이어 위반·순환 의존은 없다. 다만 이 fix 가 필요했던
근본 이유 — "같은 파일 안에서 동일 패턴이 두 곳엔 있고 한 곳엔 빠졌는데 두 리뷰 라운드가 이를
못 잡았다" — 는 slug 프리픽스 부착 규율이 여전히 순수 관례(사람 리뷰/grep)에만 의존하고
컴파일러/린터 레벨의 강제 장치가 없다는 구조적 갭을 드러낸다. ~30개 호출부로 계속 늘어나는 현재
확장 궤적을 고려하면, 이 갭은 현재 diff 의 결함이 아니라 향후 동일 defect class 재발을 막기 위한
아키텍처 후속 과제로 다룰 가치가 있다.

## 위험도

LOW
