# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[WARNING]** `revealMutation.onSuccess` 내 `window.setTimeout` — cleanup 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 1149
  - 상세: `revealMutation.onSuccess` 에서 `window.setTimeout(() => setRevealedSecret(null), 30_000)` 를 직접 호출하나 반환값(timer ID)을 저장하지 않아 clearTimeout 이 불가능하다. 컴포넌트 언마운트 후 30초가 경과하면 이미 해제된 컴포넌트의 `setRevealedSecret` 가 호출된다. 같은 파일에서 `generatedKey` 는 `useEffect` + cleanup 패턴으로 올바르게 처리하고 있으나, `revealedSecret` 경로는 동일 패턴이 적용되지 않아 구현 불일치가 존재한다. React 18 에서는 언마운트 후 setState 경고가 제거되어 런타임 오류는 발생하지 않으나, 잔류 타이머가 불필요하게 실행되고 테스트(generated-key-autoclear.test.tsx) 가 `clearTimeout` 호출 여부만 검증하므로 이 경로의 누수는 검증되지 않는다.
  - 제안: `revealMutation.onSuccess` 에서 timer ID 를 ref(`useRef<ReturnType<typeof window.setTimeout> | null>`)로 저장하고, `useEffect` cleanup 또는 `revealedSecret` 를 의존성으로 하는 `useEffect`([`revealedSecret`]) 에서 clearTimeout 을 호출한다. `generatedKey` 의 `useEffect` 패턴을 그대로 복사해 `revealedSecret` 에도 적용하는 방법이 가장 일관성 있다.

- **[INFO]** `IsIpOrCidrConstraint` stateless 설계 — race condition 없음 (양호)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`
  - 상세: `@ValidatorConstraint({ async: false })` 로 선언되고 instance field 가 없는 완전 stateless 클래스. class-validator 가 constraint 를 singleton 으로 재사용하더라도 공유 상태가 없어 race condition 이 발생하지 않는다. 코드 주석(`// Stateless — instance field 회피 (class-validator singleton 패턴의 race 회피)`)에도 의도가 명시되어 있어 적절하다.

- **[INFO]** `useEffect([generatedKey])` 타이머 관리 — 올바른 패턴 (양호)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 1023-1027
  - 상세: `generatedKey` 변경 시 이전 타이머를 cleanup 함수(`return () => window.clearTimeout(timer)`)로 취소하고 새 타이머를 등록한다. 언마운트 시에도 cleanup 이 실행되어 stale setState 가 방지된다. 의존성 배열 `[generatedKey]` 도 정확하다.

## 요약

변경 코드의 동시성 관련 핵심 변경은 두 곳이다. 백엔드 DTO validator (`is-ip-or-cidr.validator.ts`) 는 완전 stateless 설계로 race condition 위험이 없다. 프론트엔드 `page.tsx` 의 `generatedKey` 자동 클리어는 `useEffect` + cleanup 패턴으로 타이머 누수 없이 올바르게 구현되었다. 그러나 동일 컴포넌트의 `revealMutation.onSuccess` 내 `revealedSecret` 자동 hide 타이머는 cleanup 없는 bare `window.setTimeout` 호출로, `generatedKey` 경로와 불일치하는 구현이다. React 18 에서 런타임 에러는 없으나 언마운트 후 잔류 타이머 실행 및 테스트 미검증 경로로 남아 있어 경고 수준으로 분류한다.

## 위험도

LOW
