# 유지보수성(Maintainability) 리뷰

본 리뷰는 이전 라운드(`review/code/2026/07/10/15_03_11`)의 WARNING/INFO 조치(RESOLUTION.md) 반영 후 fresh changeset 을 대상으로 한다. 이전 라운드에서 지적된 `role="status"` 누락과 다크모드 border 톤 불일치는 status-aware 톤(`error`=red, `expired`/`pending_install`=amber) 도입으로 해소를 확인했다.

## 발견사항

- **[INFO]** 두 "경고 배너" 컴포넌트가 여전히 태그·라운딩이 다르다 (컨벤션 아직 완전 일원화 안 됨)
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx:297` (`<div role="status" className="rounded-lg border p-4" ...>`) vs `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/scope-tab.tsx:168-171` (`<section role="status" className="rounded-md border ... p-3 text-sm" ...>`)
  - 상세: 이전 라운드에서 지적된 `role` 누락·dark border 톤 불일치는 이번에 해소됐으나, 태그(`div` vs `section`)·라운딩(`rounded-lg` vs `rounded-md`)·패딩(`p-4` vs `p-3`)·`text-sm` 클래스 유무는 여전히 두 파일에서 각각 하드코딩되어 미세하게 다르다. 기능적 문제는 없고, 이전 리뷰가 이미 "3번째 배너가 추가되면 공용 컴포넌트로 추출 검토"로 defer 한 항목의 연장선이라 지금 조치를 요구하지는 않는다.
  - 제안: 현재는 유지, 향후 유사 경고 배너가 하나 더 추가되면 공용 `WarningBanner`(tone prop) 로 추출해 태그·spacing 까지 통일 검토.

- **[INFO]** `ActivityTab` 이 받는 `onNavigate: (tab: Tab) => void` 는 실제로는 `"overview"` 리터럴 하나로만 호출되는데, 배너로 전체 탭 dispatcher 를 그대로 흘려보낸다
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:611-619,656-659` (`ActivityTab` prop 정의 및 `onGoToOverview={() => onNavigate("overview")}`)
  - 상세: `ActivityTab` 시그니처는 범용 `(tab: Tab) => void` 를 받지만, 본문에서 실제 소비하는 것은 "개요 탭으로 이동"이라는 단일 의도뿐이다. 상위 `page.tsx:206` 에서 `onNavigate={setTab}` 로 `Tab` 전체 도메인을 그대로 내려보내는 구조라, `ActivityTab` 코드만 읽으면 "다른 탭으로도 이동시킬 수 있나?" 라는 오해의 여지가 남는다(실제로는 아님). 기능적 결함은 아니며 현재로선 사소함.
  - 제안: 필수는 아니지만, 의도를 더 명확히 하려면 `page.tsx` 가 `ActivityTab` 에 좁은 콜백 `onGoToOverview={() => setTab("overview")}` 을 직접 넘기는 편이 (제네릭 `onNavigate` prop 없이) API 표면을 더 좁혀 향후 다른 탭 이동이 필요해질 때 명시적으로 확장하게 만든다.

- **[INFO]** `ActivityTab` 함수가 이미 장문(쿼리 2개 + memo + 3단 분기 + 테이블 렌더)인 상태에서 이번 변경으로 `status`/`onNavigate` prop 과 `disconnectedBanner` 지역 변수가 추가되어 소폭 더 길어짐 (이전 라운드에서도 지적, 재확인)
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:609-700`
  - 상세: `disconnectedBanner` 를 변수로 뽑아 빈 상태·목록 두 분기에서 재사용한 방식은 중복을 피해 이번 diff 자체는 문제없다. RESOLUTION.md 에서 `ActivityTab` 을 별도 파일로 추출하지 않은 이유(테스트를 위한 과도한 분리 방지)도 합리적이다.
  - 제안: 지금 리팩터 불필요. 향후 activity 탭에 필터·정렬 등이 더해지면 테이블 렌더 부분을 서브컴포넌트로 분리 검토(이전 리뷰와 동일 권고 유지).

## 요약

`ActivityDisconnectedBanner` 는 폴더 내 기존 tab 추출 컨벤션을 그대로 따르는 소형(61줄) 순수 프레젠테이션 컴포넌트로, 단일 얕은 조건(`status === "connected"` 조기 반환)과 명확한 tone 매핑 객체로 복잡도가 낮고 매직 넘버·중복 로직이 없다. 이전 라운드 WARNING/INFO(테스트 wiring 보류 근거 명시, CHANGELOG·유저 가이드 갱신, `role="status"` 추가, status-aware 톤 escalation)가 RESOLUTION.md 대로 반영되어 확인됐고, 테스트도 `it.each` 파라미터화 + ko/en 로케일 + 톤/role 단언까지 8케이스로 보강되어 가독성·커버리지가 좋다. `page.tsx` 배선(`disconnectedBanner` 변수 재사용)도 중복 없이 깔끔하다. 남은 발견사항은 모두 이전에도 낮은 우선순위로 defer 된 스타일 통일(경고 배너 태그/라운딩)과 신규로 확인한 사소한 API 표면(제네릭 `onNavigate` vs 좁은 콜백) 관련 INFO뿐이며, 병합을 막을 이유는 없다.

## 위험도

NONE
