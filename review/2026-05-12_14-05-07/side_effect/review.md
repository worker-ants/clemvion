## 발견사항

### [WARNING] `lucide-react` 중복 import 블록 — `workflows/page.tsx`
- **위치**: 파일 상단 import 섹션
- **상세**: 기존 `lucide-react` import 블록에 `Users`를 추가하지 않고 별도 `import { Users } from "lucide-react"` 문을 추가. 번들러가 병합하므로 런타임 오류는 없지만, tree-shaking 힌트가 분산되고 린터 규칙(`import/no-duplicates`)에 걸릴 수 있음.
- **제안**: 기존 `import { Plus, Search, ... } from "lucide-react"` 블록에 `Users` 추가.

---

### [WARNING] `resendMutation` 단일 인스턴스가 목록 전체 버튼을 잠금 — `workspace/settings/page.tsx`
- **위치**: `resendMutation.isPending` 를 모든 목록 아이템의 `disabled` 조건으로 공유
- **상세**: 하나의 초대에 대해 "재발송"을 클릭하면 `isPending` 이 `true`가 되어 나머지 모든 초대의 "재발송"·"취소" 버튼이 동시에 비활성화됨. `revokeMutation`도 동일 패턴. 초대가 여러 개일 때 UX 마찰이 발생하며, 빠른 연속 클릭보다는 의도된 직렬화일 수 있으나 명시적이지 않음.
- **제안**: 진행 중인 `invitationId`를 별도 상태로 추적하거나(`pendingResendId`, `pendingRevokeId`), 각 항목별로 분리된 mutation을 사용하는 것을 검토.

---

### [WARNING] `t` 함수가 `useEffect` 의존성 배열에 포함 — `register-form.tsx`
- **위치**: 초대 토큰 메타 조회 effect (`[invitationToken, t]`)
- **상세**: `t` 가 렌더마다 새 참조를 반환하는 경우 effect가 재실행되어 `getByToken` API를 중복 호출함. `cancelled` 플래그로 경쟁 상태는 막히지만 불필요한 네트워크 요청이 발생할 수 있음. 단, 컴포넌트가 `key={locale}` 로 재마운트되는 구조이므로 로케일 전환 시에는 실제 문제가 없음.
- **제안**: `t`를 의존성에서 제거하고 `useCallback`으로 감싸거나, effect 내부에서 필요한 번역 키를 별도 변수로 캡처.

---

### [INFO] `setAccessToken` 전역 메모리 상태 변경 타이밍 — `register-form.tsx`
- **위치**: `onSubmit` 내 `setAccessToken(accessToken)` 호출 (l.152 부근)
- **상세**: `setAccessToken` 호출 후 `router.push("/dashboard")` 가 실패하거나 컴포넌트 언마운트 중 예외가 발생하면 in-memory Access Token이 설정된 채로 페이지가 정체될 수 있음. 이후 API 요청은 이 토큰을 사용하므로 대부분의 경우 무해하지만, 오류 배너를 표시한 상태에서 토큰이 이미 유효한 상태가 됨.
- **제안**: `router.push` 성공 여부를 확인하기 어려운 구조이므로, 현재 접근이 실용적으로 최선. 다만 `toast.success` 와 `router.push` 사이에 `await` 없이 동기 호출되는 점은 문제 없음.

---

### [INFO] `authApi.register` 반환 타입 변경의 하위 호환성 — `auth.ts`
- **위치**: `authApi.register` 반환 타입 `{ message: string }` → `{ data: RegisterResultData }`
- **상세**: 기존 호출부(변경 전 register-form)는 반환값을 사용하지 않았으므로(`await authApi.register(...)`) 타입 변경이 런타임 회귀를 일으키지 않음. 그러나 코드베이스 내 다른 호출부가 있다면 타입 오류 또는 `.data.message` 접근 실패 위험.
- **제안**: `grep authApi.register` 로 다른 호출부 없음을 확인 (현재 단일 호출부로 보임).

---

### [INFO] `encodeURIComponent` 적용 대상이 이미 URL-safe — `workspaces.ts`
- **위치**: `invitationsApi.getByToken` 내 `/invitations/${encodeURIComponent(token)}`
- **상세**: 토큰이 `crypto.randomBytes(48).toString('base64url')` 기반이라면 `A-Za-z0-9-_` 만 포함하므로 인코딩이 불필요. 부작용은 없으나 불필요한 연산.

---

## 요약

이번 변경은 초대 토큰 가입 흐름, 재발송 UI, 팀 워크스페이스 배지를 추가하는 작업으로, **전반적인 부작용 위험도는 낮음**. `cancelled` 플래그를 활용한 경쟁 상태 방어, 적절한 쿼리 캐시 무효화 패턴, `shouldDirty: false` 를 통한 prefill 제어 등 구현 품질이 양호함. 주요 리스크는 단일 `resendMutation` 인스턴스가 목록 전체 버튼을 잠그는 UX 패턴과 `lucide-react` 중복 import 두 가지이며, 모두 기능 오류보다는 코드 품질·UX 수준의 문제임. `authApi.register` 반환 타입 변경은 기존 호출부가 반환값을 사용하지 않았으므로 안전함.

## 위험도

**LOW**