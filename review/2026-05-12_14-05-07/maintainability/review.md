### 발견사항

- **[WARNING]** `Users` 아이콘 중복 import
  - 위치: `workflows/page.tsx` 상단 import 블록
  - 상세: lucide 아이콘들이 하나의 import 블록에 묶여 있는데, `Users`만 별도 import 문으로 분리되어 있음. 기존 lucide 블록에 추가하지 않아 발생.
  - 제안: 기존 `import { Plus, Search, … } from "lucide-react"` 블록에 `Users` 병합

- **[WARNING]** `invitationBanner` IIFE 패턴이 가독성 저하
  - 위치: `register-form.tsx:200~230` 대역
  - 상세: `const invitationBanner = (() => { … })()` 형태의 IIFE로 JSX를 생성하는 패턴은 이 파일의 다른 부분이나 컴포넌트 관용구와 다름. 컴포넌트 본문에서 즉시 실행 함수가 등장하면 독자가 "왜 컴포넌트가 아닌가?"라는 의문을 갖게 됨.
  - 제안: `<InvitationBanner state={invitationState} />` 형태의 서브컴포넌트로 추출하거나, 단순 named function `function renderInvitationBanner(state: InvitationState)` 으로 정리

- **[INFO]** `invitationsApi` / `workspacesApi` 분리 기준이 불명확
  - 위치: `workspaces.ts`
  - 상세: 초대 관련 API가 `workspacesApi.resendInvitation`, `workspacesApi.revokeInvitation`, `workspacesApi.listInvitations`(인증 필요)와 `invitationsApi.getByToken`(공개)으로 나뉨. JSDoc 주석이 이유를 설명하지만, 파일 독자가 초대 API를 찾을 때 두 곳을 확인해야 함.
  - 제안: `invitationsApi` 내부 주석에 "인증 불요(공개) 엔드포인트만 여기에" 한 줄 추가하거나, 파일 상단에 분리 기준 한 줄 주석으로 명시

- **[INFO]** `InvitationMeta` 타입이 사용처보다 아래에 선언됨
  - 위치: `workspaces.ts`
  - 상세: `invitationsApi.getByToken`의 반환 타입 `InvitationMeta`가 해당 함수 아래에 선언되어 있음. TypeScript는 문제없이 처리하지만, 타입 → 구현 순서가 컨벤션상 더 읽기 쉬움.
  - 제안: `InvitationMeta` 및 `WorkspaceInvitationSummary` 선언을 `workspacesApi` / `invitationsApi` 객체 위로 이동

- **[INFO]** 초대 메타 fetch가 React Query를 우회
  - 위치: `register-form.tsx`의 `useEffect` + `invitationsApi.getByToken` 호출
  - 상세: 컴포넌트 전체가 `@tanstack/react-query`를 사용하는데, 초대 토큰 조회만 bare `useEffect`로 구현됨. 캐시·중복 요청 제거·에러 재시도가 없고, 향후 유사 fetch를 추가하는 개발자가 다른 패턴을 따를 수 있음.
  - 제안: `useQuery({ queryKey: ['invitation', invitationToken], queryFn: … , enabled: !!invitationToken })` 으로 교체하면 패턴 일관성 확보. 단, 현재 구현도 기능상 문제없으므로 우선순위는 낮음.

- **[INFO]** `resendMutation.isPending`이 목록 전체 버튼을 비활성화
  - 위치: `workspace/settings/page.tsx` 초대 목록 렌더링
  - 상세: 특정 초대 1건에 대해 재발송을 누르면 목록 내 모든 초대의 [재발송] / [취소] 버튼이 비활성화됨. `revokeMutation`도 동일. 기존 패턴과 일관되나, 목록이 길어질 경우 의도치 않은 UX 동결처럼 보일 수 있음.
  - 제안: 단기적으로는 현 상태 유지 가능. 향후 목록이 커지면 `pendingId` state를 도입해 해당 row만 비활성화하는 방식으로 개선 고려.

---

### 요약

전반적으로 변경 코드는 기존 파일 구조와 명명 컨벤션을 잘 따르고 있으며, `InvitationState` discriminated union·취소 가능 `useEffect`·데이터 prefill 분리 등 핵심 로직의 가독성이 양호하다. 유지보수 측면에서 즉각 수정이 필요한 수준의 문제는 `Users` 중복 import와 `invitationBanner` IIFE 두 건이며, 나머지는 향후 코드베이스가 커질 때 혼란을 줄이기 위한 개선 제안이다.

### 위험도

**LOW**