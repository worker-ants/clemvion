# 테스트(Testing) 리뷰 — activity-disconnected-banner (fresh review, RESOLUTION 반영 후)

## 발견사항

- **[INFO]** `page.tsx`의 `ActivityTab` wiring(신규 `status`/`onNavigate` prop 배선, 빈 상태·목록 두 분기 위에 `disconnectedBanner`를 얹는 조건부 렌더 합성, `onGoToOverview={() => onNavigate("overview")}` 클로저)은 여전히 자동 테스트로 커버되지 않는다
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` L609-682 (`ActivityTab`)
  - 상세: 직전 라운드(`review/code/2026/07/10/15_03_11/testing.md`)에서 WARNING으로 지적됐고 `RESOLUTION.md`에서 "wiring 스모크 테스트는 defer"로 명시적으로 보류됐다. 재확인 결과 defer 근거는 타당하다 — `ActivityTab`은 `page.tsx` 내부 비-export 로컬 함수이고, 형제 함수인 `UsageTab`(L570) 역시 같은 이유로 자체 테스트가 없는 기존 컨벤션(추출된 하위 컴포넌트만 개별 테스트, tab wiring 함수 자체는 미테스트)과 일치한다. 신규 회귀 위험(잘못된 prop 전달, `onNavigate` 오배선, "활동 있음 + status=error" 동시 렌더 케이스)은 code-read로만 검증됐고 자동 안전망은 없지만, 배너 컴포넌트 자체는 8-case RTL로 전수 검증되어 실질 리스크는 낮다.
  - 제안: 현 defer를 유지해도 무방. 다만 `ActivityTab`이 향후 필터/정렬 등으로 더 커지면(RESOLUTION에 이미 명시된 조건) 추출 시점에 이 wiring 케이스(status=error + 데이터 존재 동시 렌더, 버튼 클릭 → 탭 전환)를 함께 커버할 것.

- **[INFO]** `pending_install` 상태의 톤(amber)은 개별적으로 직접 검증되지 않음
  - 위치: `__tests__/activity-disconnected-banner.test.tsx` — "expired/pending_install 는 warning(amber) 톤이다" 테스트는 `status="expired"`만 렌더
  - 상세: 구현이 `isError = status === "error"` 단일 boolean으로 분기하므로(3-way switch가 아님) `expired`/`pending_install`은 코드상 완전히 동일 경로를 타 실질 회귀 위험은 없다. `it.each`로 이미 `pending_install`의 role/버튼 존재는 커버됨. 엄격한 exhaustiveness 관점에서만 완전하지 않음.
  - 제안: 우선순위 낮음. 조치 안 해도 무방하나, 원한다면 톤 테스트도 `it.each(["expired","pending_install"])`로 확장 가능.

## 테스트 관점 상세 평가

1. **테스트 존재 여부**: 신규 `ActivityDisconnectedBanner` 프레젠테이션 컴포넌트는 8개 케이스로 충실히 커버(connected 미노출·3-status role/문구/버튼·error red 톤·expired amber 톤·클릭 콜백·en 로케일). i18n 신규 키(`activityDisconnectedTitle/Hint/Action`) 추가는 en/ko 동시 반영되어 기존 `ui-label-parity.test.ts`(키 구조 동등성 회귀 가드)가 자동으로 검증 — 실행 결과 통과 확인.
2. **커버리지 갭**: `IntegrationDto["status"]` 4개 리터럴(connected/error/expired/pending_install) 전량 커버. 위 INFO 두 건 외 실질 갭 없음. `ActivityTab` wiring은 defer 근거가 타당(기존 컨벤션 연장, 형제 `UsageTab`도 동일 갭).
3. **엣지 케이스**: `container.firstChild`가 `null`인지 명시 검증(빈 렌더 확인)한 점이 좋음. 로딩 중 배너 미노출은 `isLoading` early-return이 `disconnectedBanner` 계산보다 앞서 구조적으로 보장되며 별도 wiring 테스트 없이는 회귀 자동 검출 불가(위 INFO에 포함).
4. **Mock 적절성**: 실제 `useT()`/`useLocaleStore`/실 i18n dict를 그대로 사용해 렌더하는 통합형 단위 테스트 — 과도한 mock 없이 번역 키 오탈자까지 함께 잡아내는 적절한 설계.
5. **테스트 격리**: `beforeEach`로 locale "ko" 리셋, `afterEach`에서 `cleanup()`. 마지막 en 로케일 테스트가 이후 복원하지 않지만 파일 순서상 마지막이라 실질 영향 없음(Vitest worker 격리 + 기존 컨벤션과 일치).
6. **테스트 가독성**: 한국어 설명형 테스트명이 의도를 명확히 표현. `it.each`로 3-status 공통 검증을 압축한 구성이 유지보수 면에서 좋음.
7. **회귀 테스트**: 실행 결과 8/8 pass 확인(`npx vitest run` 재실행). `ui-label-parity`/`hardcoded-korean-ratchet` 등 기존 회귀 가드도 신규 키에 대해 통과. 신규 diff가 기존 테스트를 깨뜨리지 않음.
8. **테스트 용이성**: `ActivityDisconnectedBanner`가 `status`/`onGoToOverview`/`t` 순수 props만 받는 presentational 컴포넌트로 테스트 용이성이 높다. `ActivityTab`은 `useQuery` 2개에 직접 의존해 테스트하려면 `integrationsApi` mock + `QueryClientProvider`가 필요하지만(기존 `integrations-page.test.tsx` 패턴 재사용 가능), 구조적 장벽이 낮은데도 defer된 상태 — 근거는 타당하나 완전 무비용은 아님을 기록.

## 요약
`ActivityDisconnectedBanner` 컴포넌트 자체는 status 유니온 전량·톤 escalation·클릭 콜백·로케일까지 8개 케이스로 잘 커버된 테스트다(실행 재확인: 8/8 pass). 유일한 잔여 갭인 `page.tsx`/`ActivityTab` wiring 미테스트는 직전 라운드에서 이미 WARNING으로 지적·검토됐고, 형제 `UsageTab`과 동일한 기존 컨벤션(로컬 tab 함수는 미테스트, 추출된 하위 컴포넌트만 테스트)에 부합한다는 근거로 RESOLUTION에서 합리적으로 defer됐다 — 재검증 결과 이 defer는 타당하다고 판단해 등급을 WARNING에서 INFO로 하향한다. i18n 신규 키는 기존 parity 회귀 가드를 자동으로 통과해 별도 조치 불필요.

## 위험도
LOW
