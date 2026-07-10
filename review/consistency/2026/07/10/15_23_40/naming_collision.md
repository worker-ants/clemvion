### 발견사항

- **[INFO]** `onNavigate` prop 이름이 다른 컴포넌트에서 이미 다른 의미로 사용 중
  - target 신규 식별자: `ActivityTab({ onNavigate }: { onNavigate: (tab: Tab) => void })` — `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx:234,240,613,619,658` (탭 전환 콜백, `setTab` 을 그대로 전달)
  - 기존 사용처: `codebase/frontend/src/components/editor/expression/expression-autocomplete.tsx:8,31` — `onNavigate: (direction: "up" | "down") => void` (자동완성 드롭다운 키보드 방향 이동 콜백)
  - 상세: 두 컴포넌트는 폴더·도메인이 완전히 분리(에디터 표현식 자동완성 vs 통합 상세 탭)돼 있어 실제 타입 충돌이나 import 충돌은 없다. 다만 같은 리포지토리 내에서 "탭 전환"(`Tab` enum 인자) 과 "방향키 이동"(`"up"|"down"` 인자) 이라는 서로 다른 의미에 동일한 prop 이름을 재사용해 grep 검색·코드 리딩 시 혼동 가능성이 있다. 더 나아가 같은 파일(`page.tsx`) 안에서도 탭 전환 콜백의 기존 관행은 `setTab`(직접 useState setter) 이며, 이 PR 이 새로 도입한 `onNavigate` 는 리포지토리 전역에서 확립된 탭 전환 네이밍(`onTabChange`/`onActiveTabChange`/`setActiveTab`, 예: `models/page.tsx`, `create-kb-form-dialog.tsx`)과도 다른 제3의 관용구다.
  - 제안: 필수 수정 아님(로컬 컴포넌트 prop 이라 실질 충돌 없음). 향후 유사 "탭 전환 콜백" 이 이 파일에 더 늘어난다면 리포지토리 관행인 `onTabChange`/`onActiveTabChange` 로 통일하는 편이 검색성이 좋다.

### 요약

target PR(`activity-disconnected-banner`)이 도입하는 신규 식별자 — 컴포넌트 `ActivityDisconnectedBanner`, 파일 `activity-disconnected-banner.tsx`/`.test.tsx`, i18n 키 `integrations.activityDisconnectedTitle`/`Hint`/`Action`, `ActivityTab` 신규 prop `status`/`onNavigate` — 을 spec(`spec/2-navigation/4-integration.md` §4.6, `spec/0-overview.md` §3.4 Inline Alert 사용처 표) 및 코드베이스 전역과 대조한 결과 CRITICAL/WARNING 급 충돌은 없다. 새 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수는 이번 diff 에 신설되지 않았고(코드는 기존에 이미 spec 에 §4.6 로 명시된 배너 사양을 구현한 것), 신규 i18n 키·파일 경로도 기존 사용처와 중복이 없으며 sibling 파일 명명 컨벤션(`<도메인>-<역할>.tsx`)을 그대로 따른다. 유일하게 언급할 만한 사항은 `onNavigate` prop 이름이 리포지토리 내 다른 컴포넌트(`expression-autocomplete.tsx`)에서 이미 다른 시그니처로 쓰이고 있다는 점으로, 스코프가 완전히 분리돼 있어 실질 위험은 낮은 INFO 수준이다.

### 위험도
LOW
