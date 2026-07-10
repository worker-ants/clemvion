# 부작용(Side Effect) 리뷰 결과

대상: `activity-disconnected-banner` (§4.6 활동 탭 "연결 안 됨" 배너) — 7개 파일 (신규 컴포넌트+테스트, page.tsx 배선 변경, i18n ko/en, plan, spec)

## 발견사항

- **[INFO]** `ActivityTab` 로컬 함수 시그니처 확장 (`status`, `onNavigate` prop 추가)
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:609-620` (정의), `:200-207`(유일 호출부)
  - 상세: `ActivityTab` 은 export 되지 않는 파일 내부 함수이고 호출부가 같은 diff 안에서 함께 갱신되어 외부 호출자에 영향을 줄 여지가 없다. `grep` 확인 결과 이 컴포넌트를 참조하는 다른 파일은 없음(테스트 파일도 `ActivityDisconnectedBanner` 만 직접 import). 인터페이스 파급 없음 — 형식상 "시그니처 변경" 이지만 실질 위험 없음.
  - 제안: 조치 불필요.

- **[INFO]** `onNavigate: (tab: Tab) => void` 로 `setTab` React state setter 를 그대로 하위 컴포넌트에 전달
  - 위치: `page.tsx:582`(`onNavigate={setTab}`), `page.tsx:655`(`onGoToOverview={() => onNavigate("overview")}`)
  - 상세: `IntegrationDetailPage` 의 `setTab` 디스패처가 `ActivityTab` 에 임의 탭으로 이동 가능한 타입(`(tab: Tab) => void`)으로 전달된다. 실제로는 `ActivityTab` 내부에서 `"overview"` 로만 호출되고, `ActivityDisconnectedBanner` 에는 인자 없는 `() => void` 로 한 단계 더 좁혀 전달되므로 현재 코드 경로상 실질적 오남용 위험은 없다. 탭 전환은 §4.6 명세가 의도한 신규 콜백 동작(연결 안 됨 배너 → [상태 확인] 클릭 → 로컬 `tab` state 변경)이며, 전역 상태나 라우팅에는 영향을 주지 않는 컴포넌트 로컬 side effect다.
  - 제안: 현재로선 조치 불필요. 향후 `ActivityTab` 이 더 커지면 `onNavigate` 대신 처음부터 `onGoToOverview: () => void` 를 좁혀 받는 편이 원칙적으로 더 안전(YAGNI)하지만 blocking 사유는 아님.

- **[INFO]** 테스트 파일의 전역 Zustand 스토어(`useLocaleStore`) 직접 `setState` 조작
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/activity-disconnected-banner.test.tsx:65,95`
  - 상세: `beforeEach` 에서 `ko` 로 리셋하지만, 마지막 테스트가 `en` 으로 바꾼 뒤 별도 복원을 하지 않는다. `useLocaleStore` 는 모듈 싱글턴이라 이론상 크로스-테스트 오염 가능성이 있으나, `grep` 확인 결과 동일 패턴(`beforeEach(() => useLocaleStore.setState(...))`, 마지막 테스트에서 로케일 전환 후 미복원)이 기존 테스트 스위트 전반(`statistics-page.test.tsx`, `workflows-page.test.tsx` 등 20+개 파일)에 이미 정착된 컨벤션이고, Vitest 기본 설정(`isolate: true`)상 파일 간 모듈 레지스트리가 격리되어 실질적 누수는 발생하지 않는다. 이번 변경이 새로 도입한 위험이 아님.
  - 제안: 조치 불필요(기존 컨벤션 준수).

- **[INFO]** `page.tsx` 내 `ActivityTab` 훅 호출 순서 불변 확인
  - 위치: `page.tsx:993-1038` (`useLocale`/`useQuery`×2/`useMemo` → `isLoading` early return → `disconnectedBanner` JSX 구성 → `!data` early return)
  - 상세: 새로 삽입된 `disconnectedBanner` 변수 선언은 `useMemo` 이후, 기존 두 early return(`isLoading`, `!data`) 사이에 위치하며 새로운 hook 호출을 추가하지 않는다. React Hooks 규칙(조건부 hook 금지) 위반 없음.
  - 제안: 조치 불필요.

기타 검토 결과 이슈 없음:
- 전역 변수 신규 도입/변경 없음.
- 파일시스템 부작용 없음(신규 컴포넌트/테스트/i18n 항목/spec·plan 문서는 모두 의도된 변경분).
- 공개 API(백엔드 HTTP, 이미 존재하는 `IntegrationDto.status` 필드 소비)만 read, 신규 네트워크 호출 없음 — `ActivityDisconnectedBanner` 는 순수 프레젠테이션 컴포넌트로 `status==="connected"` 시 `null` 반환 외 부작용 없음.
- 환경 변수 읽기/쓰기 없음.
- i18n dict(`ko`/`en`) 는 각각 동일한 3개 키(`activityDisconnectedTitle`/`Hint`/`Action`)를 대칭 추가 — 다른 dict 소비 경로에 영향 없음.

## 요약

이번 변경은 신규 프레젠테이션 컴포넌트(`ActivityDisconnectedBanner`) 도입과 이를 소비하는 `ActivityTab` 의 로컬 prop 확장(`status`, `onNavigate`)으로 구성된 자기완결적(self-contained) UI 기능 추가다. 변경된 함수들은 모두 비-export 로컬 함수이거나 이번 diff 안에서 유일한 호출부까지 함께 갱신되어 외부 인터페이스·전역 상태·파일시스템·네트워크·환경 변수에 미치는 부작용이 없다. 유일하게 주목할 지점은 `setTab` 이 `onNavigate` 로 하위 컴포넌트에 전달되는 부분이지만 실제 호출은 `"overview"` 로 좁게 고정되어 있어 실질 위험은 없다. 테스트의 전역 로케일 스토어 조작도 기존 코드베이스 컨벤션과 동일하다.

## 위험도

NONE
