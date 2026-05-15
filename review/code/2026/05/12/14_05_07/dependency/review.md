### 발견사항

- **[WARNING]** `lucide-react` 중복 import (`workflows/page.tsx`)
  - 위치: 전체 파일 컨텍스트 24번째 줄 (`import { Users } from "lucide-react";`)
  - 상세: 이미 파일 상단에 `lucide-react` import 블록이 존재함에도 `Users` 아이콘만 별도 import 문으로 추가됨. 번들러(webpack/turbopack)가 tree-shaking 시 동일 모듈을 중복 resolve하지는 않지만, lint(`no-duplicate-imports`) 규칙에 위반될 수 있고 코드 가독성을 해침.
  - 제안: 기존 `lucide-react` import 블록에 `Users`를 함께 추가.

- **[INFO]** `invitationsApi`와 `workspacesApi`가 동일 모듈(`workspaces.ts`)에 혼재
  - 위치: `workspaces.ts` 전체
  - 상세: 공개(인증 불요) 엔드포인트인 `invitationsApi.getByToken`이 인증 필요 `workspacesApi`와 같은 파일에 공존함. 현재는 `apiClient`를 공유 사용하는데, `apiClient`가 Authorization 헤더를 자동 첨부한다면 `@Public` 엔드포인트에도 토큰이 붙어 나가게 됨 — 서버가 무시하면 무해하지만, 불필요한 토큰 노출 표면이 생김.
  - 제안: 기능적 문제는 없으나, 장기적으로는 `invitationsApi`를 `auth.ts` 또는 별도 `invitations.ts`로 이동하거나, 공개 엔드포인트용 `publicApiClient`(인터셉터 없는 axios 인스턴스)를 분리하는 것을 고려.

- **[INFO]** `register-form.tsx`가 `@/lib/api/workspaces`에 의존 (크로스 도메인)
  - 위치: `register-form.tsx` 13번째 줄 (`import { invitationsApi, type InvitationMeta } from "@/lib/api/workspaces";`)
  - 상세: auth 도메인 컴포넌트(`register-form`)가 workspace 도메인 API 모듈에 직접 의존하는 구조. 현재 규모에서는 문제없으나, 도메인 경계를 엄격히 유지하려면 `invitationsApi`를 별도 모듈로 분리하는 편이 명확함.
  - 제안: 기능 정확성에는 영향 없음. 향후 `lib/api/invitations.ts`로 분리 시 import 경로만 수정하면 됨.

- **[INFO]** `InvitationMeta` 인터페이스가 `invitationsApi` 선언 이후에 위치
  - 위치: `workspaces.ts` 약 140번째 줄
  - 상세: TypeScript는 호이스팅으로 동작하므로 런타임 문제는 없으나, 관례상 인터페이스/타입은 사용처보다 앞에 선언하는 것이 가독성에 유리함.
  - 제안: `InvitationMeta` 인터페이스를 `invitationsApi` 선언 위로 이동.

---

### 요약

이번 변경에서 **새로운 외부 패키지는 추가되지 않았다.** 모든 신규 import는 이미 프로젝트에 존재하는 `lucide-react`, `react`, `@tanstack/react-query`, 내부 모듈을 재사용한다. 가장 주목할 이슈는 `workflows/page.tsx`의 `lucide-react` 중복 import로, 기능적 결함은 없으나 lint 위반 및 코드 품질 측면에서 즉시 정리가 필요하다. `invitationsApi`의 모듈 배치(공개·인증 혼재)는 설계적으로 검토할 만한 지점이지만 현 규모에서 긴급도는 낮다.

### 위험도

**LOW**