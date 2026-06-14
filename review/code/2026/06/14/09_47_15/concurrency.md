# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[INFO]** `window.setTimeout` 타이머 핸들 미저장 — 언마운트 후 state 업데이트 가능성
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/impl-config-auth-gaps-317fb4/codebase/frontend/src/app/(main)/authentication/page.tsx` — `revealMutation.onSuccess` 내 `window.setTimeout(() => setRevealedSecret(null), 30_000)`
- **상세**: 30초 타이머의 반환값(타이머 ID)이 `useRef` 나 다른 변수에 저장되지 않는다. 사용자가 30초 이내에 페이지를 벗어나거나 컴포넌트가 언마운트되면 React가 이미 정리된 컴포넌트의 `setRevealedSecret(null)`을 호출하게 된다. React 18 에서는 이 경우 경고 없이 무시되지만(`setState on unmounted component` 경고는 17에서 제거), 타이머가 메모리에 계속 살아 있어 잠재적 메모리 누수가 된다.
- **제안**: `useEffect` + `useRef`로 타이머를 관리하고 클린업 시 `clearTimeout`을 호출한다.
  ```tsx
  const revealTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  // onSuccess 내:
  if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  revealTimerRef.current = window.setTimeout(() => setRevealedSecret(null), 30_000);
  // useEffect cleanup (또는 resetForm 내):
  if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  ```

---

## 요약

변경 범위는 React 단일 스레드 브라우저 환경의 프론트엔드 컴포넌트(page.tsx), 테스트 코드(authentication-form.test.tsx), i18n 정적 딕셔너리, 문서(plan/spec md) 4종이다. 공유 뮤터블 상태·멀티스레드·락 관련 동시성 위험은 해당 없다. TanStack Query `useMutation`의 `isPending` guard로 Create/Regenerate/Delete/Reveal 모든 버튼의 중복 제출이 방지되며, `async/await` 사용과 `waitFor`를 이용한 비동기 테스트 패턴도 적절하다. 유일한 주의점은 `revealMutation.onSuccess`의 `window.setTimeout` 핸들이 저장되지 않아 언마운트 후 타이머가 실행되는 잠재적 메모리 누수로, 심각한 버그는 아니나 개선이 권장된다.

## 위험도

LOW
