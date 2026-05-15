### 발견사항

- **[WARNING]** 동일 초대 항목에 대한 Resend/Revoke 교차 비활성화 누락
  - 위치: `workspace/settings/page.tsx` — 초대 목록 렌더링 (~464–523행)
  - 상세: `resendMutation`과 `revokeMutation`은 각자의 `isPending`만 감시한다. Resend 요청이 in-flight인 동안 같은 행의 Revoke 버튼은 여전히 클릭 가능하다. 반대도 마찬가지. 즉 "Resend(새 토큰 발급) → 곧바로 Revoke(해당 초대 삭제)"가 거의 동시에 서버에 도달할 수 있다. 백엔드가 독립적인 트랜잭션으로 처리하므로 데이터 손상은 없지만, 사용자 입장에서 "재발송 성공 토스트"가 뜬 직후 초대가 사라지는 혼란이 생길 수 있다.
  - 제안: 버튼 disabled 조건을 교차 결합한다.
    ```tsx
    const anyInvMutPending = resendMutation.isPending || revokeMutation.isPending;
    // ...
    disabled={anyInvMutPending}
    ```

- **[INFO]** `resendMutation` 단일 인스턴스가 전체 행을 잠금
  - 위치: `workspace/settings/page.tsx` — `resendMutation` 선언 및 각 행의 버튼
  - 상세: React Query `useMutation`은 컴포넌트당 하나의 인스턴스를 생성한다. 행 A의 Resend가 in-flight인 동안 `resendMutation.isPending === true`가 되어 **모든 행**의 Resend 버튼이 비활성화된다. 이는 의도하지 않은 동시 재발송을 막는다는 면에서 보수적이고 안전한 동작이다. UX적으로 불필요한 잠금이 생기지만 정확성에는 문제없다.
  - 제안: 필요 시 `invitationId`별 per-item pending 상태(`Map<string, boolean>`)를 관리하거나, 현재 동작을 의도한 것으로 주석으로 명시한다.

- **[INFO]** `register-form.tsx` — useEffect 취소 플래그 패턴 정확히 적용됨
  - 위치: `register-form.tsx` — 첫 번째 `useEffect` (~68–94행)
  - 상세: `let cancelled = false` + cleanup에서 `cancelled = true` 설정으로, 컴포넌트 언마운트 또는 `invitationToken` 변경 후 응답이 도착해도 stale state 업데이트가 발생하지 않는다. 올바른 패턴.

- **[INFO]** `register/page.tsx` — `Promise.all`로 독립 비동기 작업 병렬화
  - 위치: `register/page.tsx` — 전체
  - 상세: `fetchEnabledOauthProviders()`와 `searchParams` Promise는 상호 의존성이 없으므로 `Promise.all`로 병렬 처리하는 것이 정확하다. Next.js 15 Server Component의 권장 패턴과 일치한다.

- **[INFO]** `expired` 판정에 `Date.now()` 대신 `invitationsQuery.dataUpdatedAt` 사용
  - 위치: `workspace/settings/page.tsx` — `expired` 계산
  - 상세: render 함수 내 `Date.now()` 호출을 피하기 위해 React Query의 `dataUpdatedAt`(쿼리 fetch 시점)을 기준 시각으로 사용한다. 이 값은 렌더 간 안정적이며, `invalidate → 재페치` 시 자연스럽게 갱신된다. 동시성 문제 없음.

---

### 요약

변경된 코드는 전반적으로 동시성 측면에서 안전하게 작성되어 있다. 백엔드의 핵심 경쟁 조건(동시 accept 경쟁, `UPDATE … WHERE accepted_at IS NULL`)은 이미 서버 측에서 처리되어 있으며, 프론트엔드 비동기 코드도 취소 플래그·React Query 패턴을 올바르게 사용한다. 주목할 부분은 초대 목록에서 같은 행의 Resend와 Revoke가 서로의 `isPending`을 감시하지 않아 두 요청이 거의 동시에 서버에 도달할 수 있다는 점이며, 이는 데이터 무결성보다는 UX 일관성 문제다.

### 위험도
**LOW**