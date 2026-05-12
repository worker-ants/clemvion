### 발견사항

---

- **[WARNING]** 프레젠테이션 레이어에서 인증 토큰 직접 관리
  - 위치: `register-form.tsx` → `onSubmit` 내 `setAccessToken(accessToken)` 호출
  - 상세: Client Component가 액세스 토큰 메모리 셋팅이라는 인증 인프라 로직을 직접 실행하고 있음. 프레젠테이션 레이어가 `@/lib/api/client`의 내부 구현을 직접 제어하는 구조는 레이어 경계 위반. 향후 토큰 갱신 전략이 바뀔 때 폼 컴포넌트를 수정해야 하는 역방향 의존이 생김.
  - 제안: `authApi.register` 반환값에 토큰이 있을 때 처리하는 로직을 `useAuth` 훅이나 `authApi` 래퍼로 캡슐화. 폼은 API 레이어가 노출하는 추상만 호출.

---

- **[WARNING]** `invitationsApi`와 `workspacesApi`를 인증 컨텍스트가 다름에도 같은 모듈에 혼재
  - 위치: `workspaces.ts` — `workspacesApi`(인증 필요) vs `invitationsApi`(Public, `@Public` 엔드포인트)
  - 상세: 인증 요구사항이 다른 두 API 그룹이 같은 파일에 존재하고, 더 나아가 auth 도메인 컴포넌트(`register-form.tsx`)가 workspace 모듈에서 `invitationsApi`를 import함. 도메인 경계가 흐려지고 auth ↔ workspace 간 양방향 의존 가능성이 생김.
  - 제안: `invitationsApi`를 `@/lib/api/invitations.ts`로 분리. register-form은 auth 도메인 모듈만 참조하게 유지. `InvitationMeta` 타입도 동일 파일로 이동.

---

- **[WARNING]** `invitationBanner` IIFE — 렌더마다 클로저 재생성
  - 위치: `register-form.tsx` L170–200 (대략), `const invitationBanner = (() => { ... })()`
  - 상세: 매 렌더 사이클마다 새 클로저가 생성됨. `invitationState`가 바뀌지 않는 대다수 렌더에서 불필요한 연산. 가독성과 퍼포먼스 면에서 모두 안티패턴.
  - 제안: `useMemo(() => { ... }, [invitationState, t])`로 교체하거나 `<InvitationBanner state={invitationState} />` 컴포넌트로 추출.

---

- **[WARNING]** `resendMutation.isPending`이 목록 전체를 비활성화
  - 위치: `workspace/settings/page.tsx` — 초대 목록 렌더링 내 `disabled={resendMutation.isPending}`
  - 상세: mutation 하나가 진행 중일 때 목록에 있는 모든 초대의 재발송 버튼이 동시에 비활성화됨. 초대가 여러 건이면 다른 항목의 재발송도 막힘. invitationId별 로딩 상태가 없음.
  - 제안: `disabled={resendMutation.isPending && resendMutation.variables === inv.id}` 패턴으로 per-item 로딩 상태를 표현하거나, `pendingResendId` 상태를 별도 관리.

---

- **[WARNING]** `lucide-react` 중복 import
  - 위치: `workflows/page.tsx` — 기존 블록 import와 별도 `import { Users } from "lucide-react"` 공존
  - 상세: 번들러가 중복을 제거하더라도 코드 컨벤션 위반. 트리 셰이킹 신뢰도를 낮추고 lint 경고 발생 가능.
  - 제안: `Users`를 기존 lucide-react import 블록에 합산.

---

- **[INFO]** `RegisterFormInner` — SRP 경계 초과 중
  - 위치: `register-form.tsx` 전체
  - 상세: 현재 하나의 컴포넌트가 ①초대 토큰 메타 fetch, ②OAuth 노출 제어, ③이메일 prefill, ④invitationBanner 렌더링, ⑤두 갈래 제출 흐름(일반/초대), ⑥라우팅을 모두 담당. 기능 추가 때마다 이 컴포넌트의 복잡도가 선형 이상으로 증가.
  - 제안: `useInvitationToken(token)` 커스텀 훅으로 fetch/state 분리 → `RegisterFormInner`는 props만 소비.

---

- **[INFO]** `MembersTab` — mutation 5종 단일 컴포넌트 집중
  - 위치: `workspace/settings/page.tsx` — `MembersTab` 함수
  - 상세: invite / revoke / resend / updateRole / removeMember 5개 mutation이 한 컴포넌트에 존재. 현재 기능 수준에서는 관리 가능하지만, 초대 기능 확장(만료 연장, 알림 등) 시 god component로 발전할 임계점에 근접.
  - 제안: `useWorkspaceInvitations(workspaceId)` 훅으로 invitation 관련 3개 mutation 추출 분리 고려.

---

### 요약

전반적으로 설계 의도가 명확하고 Next.js App Router 패턴을 충실히 따르고 있다. 가장 주목할 아키텍처 문제는 두 가지다. 첫째, `register-form.tsx`가 `setAccessToken` 직접 호출로 인증 인프라를 침범하고 `invitationsApi`를 workspace 모듈에서 import해 도메인 경계를 교차한다. 둘째, `invitationsApi`(Public)와 `workspacesApi`(인증 필요)가 같은 파일에 혼재해 모듈 응집도가 약화된다. 초대 토큰 흐름 자체는 상태 머신(`InvitationState` union type)으로 안전하게 모델링됐고 TOCTOU·경쟁 조건 처리도 spec에 박제되어 있어 기능 정합성은 양호하나, 위 두 레이어 경계 문제는 초대 기능 확장 시 회귀 위험도를 높인다.

### 위험도

**LOW**