### 발견사항

---

**[WARNING]** `react-hooks/purity` 는 존재하지 않는 ESLint 규칙명
- 위치: `workspace/settings/page.tsx`, `invitationsQuery.data.map()` 내 주석
- 상세: `// react-hooks/purity 가 본문에서 Date.now() 호출을 금지하므로` — `react-hooks/purity` 라는 공식 lint 규칙은 없다. 실제 이유는 React의 순수 렌더 원칙(같은 입력에 같은 출력)을 지키기 위해서이며, `Date.now()` 를 render path에서 쓰면 매 렌더마다 값이 달라져 비결정적 출력이 생긴다는 것이다. 잘못된 규칙명을 참고하면 이후 독자가 해당 규칙을 찾다가 혼란을 겪는다.
- 제안: `// Date.now() 는 매 렌더마다 달라지므로, dataUpdatedAt(fetch 시점)을 기준으로 만료를 판정한다` 로 교체

---

**[INFO]** `resendInvitation` 에 JSDoc 없음
- 위치: `workspaces.ts`, `resendInvitation` 메서드
- 상세: `invitationsApi.getByToken` 에는 JSDoc(spec 링크 포함)이 있고, `resendInvitation` 바로 위에 위치한 비슷한 `invite`·`revokeInvitation` 메서드들도 내부 타입 시그니처로 의미가 어느 정도 전달되지만, `resendInvitation` 은 "재발송 시 기존 토큰 invalidate + 만료 재시작"이라는 비자명한 부수 효과가 있다. 반환값(`WorkspaceInvitationSummary`)이 갱신된 invitation 임도 명시되지 않는다.
- 제안: `/** 기존 토큰을 무효화하고 새 토큰으로 초대 메일을 재발송한다. 만료 시계가 재시작된다. */` 한 줄 추가

---

**[INFO]** `InvitationMeta.invitedByName: string | null` — null 조건 미문서화
- 위치: `workspaces.ts`, `InvitationMeta` 인터페이스
- 상세: 언제 `null` 인지(초대자 계정 삭제? 시스템 초대?) 타입만으로는 알 수 없다. `register-form.tsx` 에서 `{invitedByName && ...}` 로 방어하고 있어 런타임은 안전하지만, API 문서로서의 가독성이 부족하다.
- 제안: `/** 초대자 계정이 조회 불가(탈퇴 등)일 때 null */` 인라인 주석 추가

---

**[INFO]** `invitationBanner` 변수 주석이 WHAT을 설명
- 위치: `register-form.tsx`, `invitationBanner` IIFE 직전 주석
- 상세: `// 초대 토큰 메타가 도착하지 않았거나 실패한 경우 상단에 안내 카드.` — 변수명 `invitationBanner` 과 코드 구조가 이미 WHAT을 말해 주므로 주석이 중복이다 (CLAUDE.md 규약: WHAT 설명 주석 금지).
- 제안: 주석 제거 또는 "왜 IIFE로 작성했는가"(early-return 패턴으로 JSX 분기를 깔끔하게 처리) 같은 WHY로 교체

---

**[INFO]** `lucide-react` 중복 import
- 위치: `workflows/page.tsx` 상단 import 블록
- 상세: 기존에 `Plus, Search, MoreHorizontal, ...` 를 하나의 `from "lucide-react"` 블록으로 가져오고 있는데, 변경에서 `import { Users } from "lucide-react"` 가 별도 라인으로 추가됐다. 동일 모듈 소스를 두 번 import 하는 것은 코드 리더에게 혼란을 줄 수 있다.
- 제안: 기존 lucide-react import 블록에 `Users` 를 추가하고 별도 라인 제거

---

**[INFO]** `RegisterData.invitationToken` JSDoc spec 참조 섹션 번호 불일치 가능성
- 위치: `auth.ts`, `invitationToken` 필드 JSDoc
- 상세: `spec/5-system/1-auth.md §1.5.2` 를 참조하나, plan 문서에는 `§1.5` 로 기재돼 있다. 섹션 번호 레벨 차이가 오타인지 별도 하위 섹션인지 확인 필요.
- 제안: spec 파일의 실제 섹션 번호와 일치하는지 검증 후 수정

---

### 요약

전반적으로 문서화 수준은 이 규모의 기능 추가 치고 양호하다. spec 참조 링크(`spec/5-system/1-auth.md §1.5`, `spec/2-navigation/10-auth-flow.md §2.6`)를 인라인 주석에 박아 결정의 근거를 추적 가능하게 만들었고, 공개 인터페이스(`invitationsApi`, `InvitationMeta`, `RegisterResultData`)에도 필요한 JSDoc이 대부분 달려 있다. 주요 개선점은 존재하지 않는 ESLint 규칙명을 참조하는 오해의 소지가 있는 주석 한 건, `resendInvitation` 의 비자명한 부수 효과(토큰 invalidate) 미기재, `InvitationMeta.invitedByName` 의 null 조건 미명시이다.

### 위험도

**LOW**