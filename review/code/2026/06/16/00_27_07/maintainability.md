# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### **[WARNING]** `revealMutation.onSuccess` 의 `setTimeout` 누수 — `generatedKey` 와 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 1146
- 상세: `generatedKey` 의 30초 자동 클리어는 `useEffect` + cleanup으로 타이머 누수를 방지하도록 개선하였으나, 같은 파일 `revealMutation.onSuccess` 내부의 `window.setTimeout(() => setRevealedSecret(null), 30_000)` (라인 1146)은 여전히 날(raw) `setTimeout`으로 남아 있다. 언마운트 시 clearTimeout이 호출되지 않아 stale state 업데이트가 발생할 수 있고, 코드베이스 내에서 두 가지 패턴이 혼재한다. 테스트 파일 파일 헤더 주석에서도 "reveal 경로의 30초 자동 hide 와 동일 정책"이라고 명시하고 있어, 구현 방식의 불일치가 더욱 두드러진다.
- 제안: `revealedSecret` 에도 동일하게 `useEffect` + `window.clearTimeout` cleanup 패턴을 적용한다. 혹은 두 상태를 통합하는 `useAutoClear(value, delay)` 커스텀 훅으로 추상화하면 중복을 없애고 일관성을 확보할 수 있다.

### **[WARNING]** `AuthenticationPage` 컴포넌트 과도한 크기 및 책임 분산 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` — 전체 파일 (약 950 라인)
- 상세: 단일 컴포넌트에 12개 이상의 `useState`, 5개 이상의 `useMutation`, 2개의 `useQuery`, 여러 핸들러 함수, 그리고 Dialog·Drawer·Table 등 복잡한 JSX가 모두 담겨 있다. 이번 변경(autoclear `useEffect`)은 올바른 방향이지만, 파일 자체가 이미 단일 컴포넌트로서의 복잡도 한계를 초과해 있다. 이 상황에서 `useEffect`가 추가될 때마다 인과관계를 추적하기 어려워진다.
- 제안: 이번 PR 범위 내에서 강제할 사항은 아니지만, 중기적으로 `CreateEditDialog`, `RegenerateDialog`, `RevealDialog` 등 Dialog 단위로 서브컴포넌트 분리를 검토한다.

### **[INFO]** `AUTH_TYPES`와 `TYPE_LABEL_KEYS` 중복 구조
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 946–958
- 상세: `AUTH_TYPES` 배열(value + labelKey)과 `TYPE_LABEL_KEYS` Record(value → labelKey)가 동일한 정보를 중복 표현하고 있다. 새 type이 추가될 때 두 곳을 동시에 수정해야 한다.
- 제안: `AUTH_TYPES`만 유지하고, `TYPE_LABEL_KEYS`는 `Object.fromEntries(AUTH_TYPES.map(o => [o.value, o.labelKey]))` 로 파생시킨다.

### **[INFO]** `isIpOrCidr` 함수의 `try/catch` 범위가 광범위
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` 라인 394–400
- 상세: `try/catch`가 `Address4.isValid || Address6.isValid` 전체를 감싸고 있다. `ip-address` 라이브러리의 `isValid`는 boolean을 반환하는 정적 메서드로, 예외를 던지지 않는 것이 일반적 계약이다. 이 catch는 라이브러리의 예기치 않은 동작에 대한 방어인데, 이로 인해 정상 로직 오류(예: 라이브러리 API 변경)도 조용히 `false`로 반환되어 디버깅이 어렵다.
- 제안: 해당 라이브러리 버전에서 예외 발생 가능성이 없다면 try/catch를 제거하거나, 예외 발생 시 로깅을 추가해 silent failure를 방지한다. 방어적 보존이 필요하다면 주석에 이유를 명시한다.

### **[INFO]** 테스트 파일에서 `fireEvent`와 `userEvent` 혼용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` 라인 653–658
- 상세: `createApiKeyConfig` 헬퍼 함수에서 버튼 클릭에는 `fireEvent.click`을, 텍스트 입력에는 `user.type`을 사용하는 등 두 API가 혼재한다. `userEvent.setup()`을 이미 사용하고 있으므로, `fireEvent`를 사용해야 하는 특별한 이유(fake timer와의 결합 등)가 없다면 일관성 있게 `user.click`으로 통일하는 것이 바람직하다.
- 제안: 명시적인 이유가 없는 한 `fireEvent.click`을 `await user.click`으로 교체한다. 불가피한 경우 주석으로 이유를 명시한다.

### **[INFO]** `29_000`과 `1_000` 매직 넘버 분리 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` 라인 691, 695
- 상세: `30_000`ms 타임아웃을 `29_000 + 1_000`으로 분리해 경계값 테스트 의도를 명확히 표현한 점은 좋으나, 테스트 파일 상단에 `const AUTOCLEAR_MS = 30_000` 같은 상수를 선언해두면 프로덕션 코드의 `30_000`과 테스트의 경계값이 같은 기준에서 유래함을 명확히 할 수 있다.
- 제안: `const AUTOCLEAR_MS = 30_000`을 `PLAINTEXT_KEY` 근처에 선언하고, `29_000`을 `AUTOCLEAR_MS - 1_000`으로, `30_000` 만료를 `AUTOCLEAR_MS`로 표현한다.

---

## 요약

이번 변경의 핵심은 `generatedKey` 자동 클리어 `useEffect`(파일 6) 추가와 백엔드 IP/CIDR 검증 validator(파일 3) 신설로, 두 변경 모두 의도가 명확하고 코드 자체는 간결하다. `is-ip-or-cidr.validator.ts`는 역할 분리(순수 함수 `isIpOrCidr` + constraint class + 데코레이터)가 잘 되어 있고 주석도 충분하다. 테스트 파일(파일 1, 5)은 경계값 커버리지가 체계적으로 구성되어 있다. 다만 `revealedSecret`의 30초 타이머가 여전히 raw `setTimeout`으로 남아 동일 정책을 두 가지 구현 방식으로 처리하는 점이 가장 큰 유지보수성 위험이며, 장기적으로 `AuthenticationPage`의 과도한 크기도 개선 대상이다. `AUTH_TYPES`/`TYPE_LABEL_KEYS` 중복과 테스트 내 `fireEvent`/`userEvent` 혼용은 경미한 일관성 이슈다.

## 위험도

LOW
