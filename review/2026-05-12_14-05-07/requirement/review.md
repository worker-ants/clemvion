### 발견사항

---

**[WARNING]** 초대 로딩 중 폼 제출 가능 — 이메일 prefill 전 submit 허용
- 위치: `register-form.tsx` → `onSubmit`, submit 버튼 `disabled` 조건
- 상세: `invitationState.kind === "loading"` 상태일 때 이메일 필드는 아직 readOnly가 아니고, submit 버튼도 활성화되어 있다. 느린 네트워크에서 사용자가 name·password·terms를 빠르게 입력하고 submit하면 `invitationToken`이 전달되지만 이메일은 사용자 임의값이 된다. 백엔드가 `invitation_email_mismatch(400)`으로 막아주긴 하나, "가입 이메일이 초대 이메일과 일치해야 해요"라는 토스트는 prefill이 왜 안 됐는지를 설명하지 못해 사용자가 혼란스러울 수 있다.
- 제안:
  ```tsx
  <Button
    type="submit"
    className="w-full"
    disabled={isLoading || invitationState.kind === "loading"}
  >
  ```
  또는 `invitationState.kind === "loading"` 중에는 이메일 필드에도 `readOnly`/`disabled`를 걸어 prefill 대기를 명시한다.

---

**[WARNING]** `lucide-react` 중복 import — ESLint `no-duplicate-imports` 위반 가능
- 위치: `workflows/page.tsx` 상단 import 블록
- 상세: 파일 전체 컨텍스트에서 `Plus, Search, MoreHorizontal …` 를 묶은 lucide-react import 블록이 이미 존재하는데, `Users`가 별도 `import { Users } from "lucide-react"` 라인으로 추가되어 중복이 발생했다. 빌드는 통과하더라도 `@typescript-eslint/no-duplicate-imports` 또는 `import/no-duplicates` 규칙이 켜져 있다면 CI에서 걸린다.
- 제안: `Users`를 기존 lucide-react import 블록 안으로 이동한다.

---

**[INFO]** 재발송 중 전체 재발송 버튼 일괄 비활성화
- 위치: `workspace/settings/page.tsx` → `resendMutation.isPending` 를 모든 `<Button disabled=…>` 에 적용
- 상세: 초대 목록에 항목이 여럿일 때 하나의 재발송이 진행 중이면 나머지 항목의 재발송 버튼도 모두 비활성화된다. 어떤 항목이 처리 중인지 시각적 피드백이 없어 관리자가 혼란을 겪을 수 있다.
- 제안: `const [resendingId, setResendingId] = useState<string | null>(null)`로 개별 추적하고, `onClick`에서 `setResendingId(inv.id)` → `onSuccess/onError`에서 `setResendingId(null)`. `disabled={resendingId === inv.id}`.

---

**[INFO]** 초대 오류 상태에서도 폼 제출 가능 (토큰 만료/미존재)
- 위치: `register-form.tsx` → `invitationState.kind === "error"` 분기
- 상세: 초대 토큰이 410(만료·사용됨)이나 404(미존재)로 오류 배너가 표시된 상태에서도 폼은 그대로 제출 가능하다. 백엔드 register API도 동일하게 거부하지만, 사용자가 오류 배너를 무시하고 가입을 시도할 수 있다. 에러 코드가 `invitation_email_mismatch`가 아닌 토큰 관련 코드라면 현재 `onSubmit`의 분기 처리(`code === "invitation_email_mismatch"`)에 해당하지 않아 `error.response?.data?.message ?? genericFailed` 경로로 처리된다.
- 제안: `invitationToken`이 있고 `invitationState.kind === "error"`이면 submit 버튼 비활성화 또는 `"워크스페이스 관리자에게 재발송을 요청하세요"` 안내와 함께 버튼 텍스트 교체.

---

**[INFO]** 한국어 로케일에서 `teamBadge` 영문 표기
- 위치: `ko.ts` → `workflows.teamBadge: "Team"`
- 상세: `teamBadgeAria`는 "팀 워크스페이스의 공유 워크플로우"로 한국어인데 배지 텍스트는 영문 "Team"이다. 의도적 제품 용어라면 명시적 주석이 없고, 그렇지 않으면 "팀"으로 현지화해야 한다.
- 제안: 의도적이라면 `// product term, intentionally English` 주석 추가. 현지화한다면 `"팀"`으로 변경.

---

### 요약

이번 변경은 미가입자 초대 토큰 흐름(이메일 prefill·readOnly·가입 시 자동 로그인·410/404 안내), 초대 재발송, 만료 표시, 팀 워크스페이스 배지 등 스펙에 정의된 요구사항을 전반적으로 충실하게 구현했다. 백엔드가 이메일 일치·토큰 유효성을 최종 방어선으로 갖추고 있어 보안상 치명적 허점은 없으나, 초대 로딩 중 폼 제출 허용과 lucide-react 중복 import는 UX 혼란 및 CI 오류 가능성이 있어 수정이 권장된다.

### 위험도

**LOW**