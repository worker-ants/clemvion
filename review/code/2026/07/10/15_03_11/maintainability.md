# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 경고 배너 `role` 속성 누락 — 동일 폴더 내 기존 패턴과 불일치
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx:224-241`
  - 상세: 같은 디렉터리의 형제 컴포넌트 `scope-tab.tsx` (line 168-171)의 동일 성격 amber 경고 박스는 `<section role="status" className="rounded-md border border-amber-300 bg-amber-50 ...">` 로 `role="status"`를 명시하는데, 신규 배너는 `<div className="rounded-lg border border-amber-300 bg-amber-50 p-4 ...">` 로 `role` 없이 렌더한다. 기능적 버그는 아니지만 같은 폴더 내 "경고 배너" 컨벤션이 파일마다 갈리면 다음 작성자가 어느 쪽을 표준으로 따라야 할지 혼동될 수 있다.
  - 제안: `role="status"` 추가(또는 두 컴포넌트를 한 공용 `WarningBanner` 로 통합)해 컨벤션을 일원화. 필수는 아니며 defer 가능한 수준.

- **[INFO]** dark 모드 border 색상 톤 미세 불일치
  - 위치: `activity-disconnected-banner.tsx:225` (`dark:border-amber-900`) vs `scope-tab.tsx:171` (`dark:border-amber-800`)
  - 상세: 두 파일이 사실상 동일한 "경고 배너" UI 패턴을 각자 하드코딩하면서 `dark:border-amber-{800|900}` 값이 미묘하게 다르다. 기능에 영향 없는 시각적 디테일이나, 반복되는 유사 마크업이 파일마다 조금씩 달라지는 초기 징후로 볼 수 있다.
  - 제안: 당장 손댈 필요는 없음 — 향후 유사 경고 배너가 3번째로 추가되면 공용 `WarningBanner` 컴포넌트로 추출 검토.

- **[INFO]** `ActivityTab` 함수가 이미 장문(약 190라인, `page.tsx:986-1171`)이며 이번 diff로 prop 2개(`status`, `onNavigate`)와 로컬 변수(`disconnectedBanner`)가 추가되어 소폭 더 길어짐
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:986-1171`
  - 상세: 새 로직 자체는 배너 컴포넌트로 잘 추출되어 `ActivityTab` 안에는 3줄짜리 JSX 조립만 추가됐고, 두 return 분기(빈 상태/목록)에서 `{disconnectedBanner}` 변수를 재사용해 중복도 피했다 — 이번 변경만 놓고 보면 문제 없음. 다만 `ActivityTab`은 이미 쿼리 2개 + 메모 + 3단 조건 분기 + 테이블 렌더까지 담당하는 다중 책임 함수라, 추후 이 파일에 로직이 더 붙으면 분리(예: 테이블 렌더를 별도 서브컴포넌트로)를 고려할 시점.
  - 제안: 지금 당장 리팩터 불필요. 향후 activity 탭에 필터/정렬 등이 추가되면 분리 검토.

## 요약

신규 `ActivityDisconnectedBanner` 컴포넌트는 이 폴더의 기존 tab 추출 컨벤션(`scope-tab.tsx`, `danger-tab.tsx`, `cafe24-app-url-card.tsx`, `usage-node-list.tsx`)을 정확히 따르고, JSDoc에 도메인 배경(MCP bridge skip, `INTEGRATION_NOT_CONNECTED`)을 명시해 "왜"가 코드에 남아 있다. 조건 분기는 얕고(단일 `if (status === "connected") return null`), 매직 넘버나 중복 로직도 없으며, `disconnectedBanner` JSX를 변수로 뽑아 두 return 분기에서 재사용해 중복을 피했다. 테스트도 `it.each`로 3개 status를 파라미터화하고 ko/en 로케일까지 커버해 가독성·의도가 명확하다. i18n 사전 두 파일(ko/en)에 3개 키를 대칭 추가한 것도 기존 패턴과 일치한다. 발견된 사항은 모두 기존 코드베이스에 이미 존재하던 미세한 스타일 불일치(role 속성, dark border 톤)에 대한 참고용 INFO뿐이며, 이번 변경이 새로 만든 문제는 아니다.

## 위험도

NONE
