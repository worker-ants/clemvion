# Security Review

## 발견사항

### [INFO] revealedSecret 의 setTimeout 에 clearTimeout 미적용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` — `revealMutation.onSuccess` (라인 1146)
- 상세: `generatedKey` 의 30초 자동 클리어는 `useEffect` + `clearTimeout` 으로 언마운트 및 값 변경 시 타이머를 정리한다. 반면 `revealedSecret` 의 30초 자동 클리어(`window.setTimeout(() => setRevealedSecret(null), 30_000)`)는 동일 `useEffect` 패턴이 아닌 `onSuccess` 콜백 내 bare `setTimeout` 으로 구현되어 있다. 언마운트 시 이 타이머가 정리되지 않으면: (1) stale closure 로 인해 GC 지연, (2) 언마운트 후 setState 로 인한 콘솔 에러가 발생할 수 있다. 보안적으로는 30초 타이머가 확실히 동작하므로 평문 노출 시간 제한 자체는 유지되지만, 정책 일관성(`generatedKey` 패턴과 상이)과 stale timer 방어 측면에서 동일 `useEffect` 방식으로 통일하는 것이 권장된다.
- 제안: `revealedSecret` 에도 `generatedKey` 와 동일하게 `useEffect(() => { if (!revealedSecret) return; const t = window.setTimeout(() => setRevealedSecret(null), 30_000); return () => window.clearTimeout(t); }, [revealedSecret]);` 패턴을 적용하고 `onSuccess` 내 bare `setTimeout` 을 제거한다.

### [INFO] 빈 배열(ipWhitelist: []) 전송 시 화이트리스트 전체 삭제 인가 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` — `ipWhitelist` 필드
- 상세: `@IsOptional()` + `@IsArray()` + `@IsIpOrCidr({ each: true })` 조합에서 빈 배열(`[]`)은 `each` 검증 대상 항목이 없으므로 통과하고, 이는 화이트리스트 전체 삭제를 의미한다(spec 문서 명시). DTO 레벨 검증 자체는 올바르나, 서비스 레이어에서 "빈 배열 → 전체 삭제" 경로에 대해 추가 감사 로그(audit log) 기록이 확인되지 않는다. 운영 측면에서 IP 화이트리스트 전체 삭제는 인증 우회 노출 확대를 의미하므로, 해당 조작이 audit_log 에 명시적으로 기록되는지 서비스 레이어에서 재확인을 권장한다.
- 제안: `auth-configs.service.ts` 에서 `ipWhitelist` 가 빈 배열(`[]`)로 갱신될 때 `audit_log` 에 `action='auth_config.ip_whitelist_cleared'` 등의 이벤트를 기록하도록 검토한다.

### [INFO] isIpOrCidr 검증 함수의 ip-address 라이브러리 의존성 보안
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`
- 상세: `Address4.isValid` / `Address6.isValid` (ip-address 패키지)를 사용한다. `try { ... } catch { return false; }` 로 예외를 안전하게 처리하고 있어 런타임 에러 전파 위험은 없다. ip-address 패키지 자체에 알려진 ReDoS 또는 파싱 취약점은 현재 보고되지 않으나, 의존성 버전을 정기적으로 감사(`npm audit`)할 것을 권장한다.
- 제안: `package.json` 의 ip-address 버전 핀(pin) 또는 `npm audit` CI 통합으로 의존성 취약점을 지속 모니터링한다.

### [INFO] 평문 비밀값 클립보드 복사 처리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` — `copyToClipboard` 함수 (라인 1253)
- 상세: `generatedKey` 및 `revealedSecret` 에 대해 클립보드 복사 버튼이 제공된다. 클립보드에 복사된 평문 비밀값은 OS/브라우저 클립보드 히스토리에 남을 수 있으며, 30초 후 화면 자동 클리어와 달리 클립보드 내용은 자동으로 삭제되지 않는다. 이는 많은 시스템의 표준 동작이나, 사용자에게 클립보드 민감성을 안내하는 토스트/경고 메시지가 없다는 점을 인지한다. 현재 구현은 `toast.success("copied")` 만 표시한다.
- 제안: 클립보드 복사 성공 토스트에 "브라우저 클립보드 히스토리에 주의하세요" 와 같은 경고 문구를 추가하거나, 비밀값 복사 후 일정 시간 뒤 `navigator.clipboard.writeText("")` 로 클립보드를 지우는 방어를 검토할 수 있다(UX 트레이드오프 감안).

---

## 요약

이번 변경은 IP 화이트리스트 저장 시점 형식 검증(`@IsIpOrCidr` 커스텀 데코레이터)과 평문 비밀키 30초 자동 클리어(`useEffect` + `clearTimeout`) 두 가지 보안 강화 기능을 도입한다. 입력 검증 측면에서 `Address4.isValid || Address6.isValid` 기반 검증은 런타임 평가와 동일한 기준을 공유하므로 저장-런타임 drift 위험이 제거되었으며, 공백·도메인명·범위 초과 CIDR 등을 올바르게 거부한다. 비밀값 노출 시간 제한은 `generatedKey` 에 대해 `useEffect` 패턴으로 구현되어 언마운트 시 타이머 정리까지 올바르게 처리되나, `revealedSecret` 의 bare `setTimeout` 은 동일 정책 적용이 미완료 상태다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, LDAP 인젝션 등의 취약점은 발견되지 않았으며, 인증/인가 측면에서도 `@Roles('admin')` 강제 및 클라이언트 `isAdmin` 가드가 명시되어 있다.

## 위험도

LOW
