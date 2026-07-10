# 테스트(Testing) 리뷰 — activity-disconnected-banner

## 발견사항

- **[WARNING]** `page.tsx` 내 `ActivityTab` 통합 지점(wiring)이 어떤 레벨에서도 테스트되지 않음
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` — `ActivityTab` 함수(L986-1049), 특히 `disconnectedBanner` 를 빈 상태(L1040-1049)와 목록-존재(L1053-1055) 두 분기 위에 각각 렌더하는 부분
  - 상세: 새로 추가된 `activity-disconnected-banner.test.tsx` 는 `ActivityDisconnectedBanner` 컴포넌트 자체만 격리해서 검증한다(단위 테스트로는 충분히 탄탄함 — 아래 참고). 그러나 이 배너가 실제로 소비되는 지점인 `ActivityTab`(신규 `status`/`onNavigate` prop 배선, `data.items.length === 0` 분기와 데이터-존재 분기 **양쪽** 모두에 `disconnectedBanner` 를 얹는 로직, `onGoToOverview={() => onNavigate("overview")}` 클로저)에 대한 테스트가 전무하다. `page.tsx` 자체가 기존에도 단위 테스트 파일이 없었으므로(`find` 결과 `[id]/__tests__/` 에 `page.test.tsx` 부재) 신규 컨벤션 위반은 아니지만, 이번 변경으로 새로 생긴 조건부 렌더 두 곳(빈 상태 위/목록 위)이 실제로 올바르게 합성되는지 — 특히 "활동 기록이 있는데 status 가 error 인 경우 배너+테이블이 동시에 보이는" 케이스, `onNavigate` 가 실제로 `setTab("overview")` 로 이어져 탭 전환이 일어나는 케이스 — 는 코드 리딩으로만 확인 가능하고 자동 회귀 안전망이 없다.
  - 제안: `ActivityTab` (혹은 `IntegrationDetailPage`) 에 대한 최소 스모크 테스트를 추가해 (a) status="error" + activity 목록 존재 시 배너와 테이블이 동시에 렌더되는지, (b) [상태 확인] 버튼 클릭이 실제로 "개요" 탭으로 전환시키는지(`onNavigate` 배선 전체)를 검증. `integrationsApi.activity`/`integrationsApi.catalog` 는 mock 필요.

- **[INFO]** 로딩 상태에서 배너가 노출되지 않는 경로는 테스트되지 않음(구조적으로는 안전)
  - 위치: `page.tsx` L1022-1028 (`isLoading` 조기 반환이 `disconnectedBanner` 계산보다 먼저 실행됨)
  - 상세: `isLoading` 이 true 인 동안은 스피너만 보이고 배너가 안 보여야 하는데, 이는 컴포넌트 구조상(early return 위치) 자연히 보장되지만 이를 명시적으로 확인하는 테스트는 없음. 위 WARNING 의 `ActivityTab` 통합 테스트를 추가한다면 자연스럽게 커버 가능.
  - 제안: 우선순위 낮음 — 위 WARNING 테스트 추가 시 부수적으로 해소 가능.

## 테스트 관점 상세 평가

1. **테스트 존재 여부**: `ActivityDisconnectedBanner` 컴포넌트 자체는 신규 테스트 파일로 충실히 커버됨(4가지 status 전량 + 클릭 콜백 + 로케일). 반면 이 배너를 소비하는 `page.tsx`/`ActivityTab` 쪽 wiring 은 테스트 없음(위 WARNING).
2. **커버리지 갭**: `IntegrationDto["status"]` 타입은 정확히 `"connected" | "expired" | "error" | "pending_install"` 4개 리터럴이며, `it.each(["error","expired","pending_install"])` + 별도 `"connected"` 테스트로 **전량(exhaustive)** 커버됨 — 타입 유니온 갭 없음. i18n en/ko 두 로케일도 모두 커버.
3. **엣지 케이스**: `status="connected"` 시 `container.firstChild` 가 `null` 인지 명시적으로 검증(빈 렌더 확인) — 좋은 엣지 케이스 처리. `onGoToOverview` 미전달 시의 기본값(`() => {}`)은 별도 검증되지 않지만 프로덕션에서 항상 전달되는 필수 prop 이라 실질 리스크 낮음.
4. **Mock 적절성**: 과도한 mocking 없이 실제 `useT()`/`useLocaleStore`/실제 i18n dict 를 그대로 사용해 렌더 — 실제 동작과의 괴리가 적은 통합형 단위 테스트로, 번역 키 오탈자·누락도 함께 잡아낼 수 있어 적절함. `Button` 컴포넌트도 mock 하지 않고 실 렌더 — 과도한 격리로 인한 false confidence 위험 없음.
5. **테스트 격리**: `beforeEach` 로 locale 을 "ko" 로 리셋, `afterEach` 에서 `cleanup()` 수행 — 테스트 간 DOM/스토어 상태 격리 양호. 마지막 테스트가 locale 을 "en" 으로 바꾼 뒤 복원하지 않지만, Vitest 기본 파일별 모듈 격리(worker 당 fresh registry) 덕분에 다른 테스트 파일로 전파되지 않으며, 동일 파일 내에서도 이 테스트가 마지막이라 후행 테스트에 영향 없음(리포지토리 내 다수 파일이 동일 패턴 사용 — 기존 컨벤션과 일치).
6. **테스트 가독성**: `Shell` 래퍼로 `useT()` hook 을 컴포넌트 트리 안에서 얻어 props 로 주입하는 패턴이 명확. 테스트명이 한국어 설명형으로 의도를 잘 표현("connected 상태면 아무것도 렌더하지 않는다" 등). `it.each` 로 3개 비-connected 상태를 압축한 것도 가독성·유지보수성 면에서 좋음.
7. **회귀 테스트**: 기존 `page.tsx` 관련 테스트 파일이 애초에 없어 회귀 걱정 없음. 다만 위 WARNING 처럼 신규 wiring 부분의 회귀 안전망 자체가 부재.
8. **테스트 용이성**: `ActivityDisconnectedBanner` 가 `status`/`onGoToOverview`/`t` 를 순수 props 로 받는 presentational 컴포넌트로 설계되어 있어 테스트하기 쉬운 구조(의존성 주입 양호). `page.tsx` 쪽 `ActivityTab` 은 `useQuery` 2개(`activity`, `catalog`)에 직접 의존해 테스트하려면 `integrationsApi` mock 이 필요 — 이 리팩터 없이도 QueryClientProvider + api mock 조합으로 테스트 가능(기존 `integrations-page.test.tsx` 등에서 이미 쓰는 패턴 재사용 가능하므로 구조적 장벽은 낮음).

## 요약
신규 `ActivityDisconnectedBanner` 컴포넌트에 대한 단위 테스트는 status 유니온 타입을 전량 커버하고, 클릭 콜백·로케일 분기까지 명확하게 검증하는 잘 작성된 테스트다. 다만 이 배너가 실제로 조립되는 `page.tsx`/`ActivityTab` 쪽(신규 `status`/`onNavigate` prop 배선, 빈 상태·목록 존재 두 분기 위에 배너를 얹는 조건부 렌더 합성)은 어떤 레벨에서도 테스트되지 않아, 배선 실수(예: 잘못된 prop 전달, 탭 전환 콜백 오배선)가 있어도 자동으로 잡히지 않는 커버리지 갭이 남아있다. 기존에도 `page.tsx` 레벨 테스트가 없었던 컨벤션 연장선이라 크리티컬하지는 않지만, 이번처럼 새 조건부 UI 합성 로직이 추가된 경우 최소 스모크 테스트를 권장한다.

## 위험도
LOW
