---

## 발견사항

### WARNING 1: TTL 기준이 spec과 불일치 (createdAt vs token 발급 시각)
- **위치**: `integration-expiry-scanner.service.ts:expirePendingInstalls()`, `integration-oauth.service.ts:begin()`
- **상세**: spec §6은 "install_token 발급 후 24시간" 기준을 명시한다. 그러나 `expirePendingInstalls`는 `createdAt < now - 24h`를 사용한다. 변경 3의 재사용 경로(`existingPending` reuse)에서 `installToken`은 갱신되지만 `createdAt`은 원래 row 생성 시각 그대로다. 즉, 사용자가 T=0에 pending row를 만들고 T=23h에 재등록하면 T=25h 스캔에서 "2시간짜리 토큰"이 만료 처리된다.
- **제안**: `Integration` 엔티티에 `installTokenIssuedAt: Date | null` 컬럼을 추가하거나, 재사용 시 `updatedAt`을 명시적으로 갱신하고 TTL을 `updatedAt` 기준으로 계산한다. 더 단순한 대안은 reuse 시 `createdAt`을 현재 시각으로 재설정하는 것이나, `@CreateDateColumn`은 immutable이므로 별도 컬럼이 필요하다.

---

### WARNING 2: pending 이외 터미널 상태 전환 시 UI 피드백 없음
- **위치**: `frontend/src/app/(main)/integrations/new/page.tsx:Cafe24PrivatePendingStep`
- **상세**: `refetchInterval` 콜백은 `row.status !== 'pending_install'`이면 `false`를 반환해 폴링을 중단한다. 그런데 status가 `expired`(TTL 만료)나 `error`로 바뀐 경우 `lastErrorMessage` 계산식이 `null`을 반환하고(`poll?.status === "pending_install"` 조건 미충족), `timedOut` 상태도 false면 사용자는 아무 안내도 받지 못하고 폴링만 조용히 멈춘다.
- **제안**: `poll?.status === 'expired'` 또는 `poll?.status === 'error'` 분기를 추가해 적절한 안내 메시지를 표시한다.

---

### WARNING 3: popup closed 감지의 stale closure
- **위치**: `frontend/src/app/(main)/integrations/new/page.tsx:useEffect([oauthWaiting])`
- **상세**: 1500ms `setTimeout` 콜백 안에서 `if (!oauthWaiting) return`은 effect가 실행됐을 때 클로저에 캡처된 `oauthWaiting` 값을 읽는다. OAuth 성공 후 `setOauthWaiting(false)`가 호출되어도 이 타이머 클로저는 여전히 `true`를 보므로 `"OAuth popup closed without returning a result"` 오류 토스트가 표시될 수 있다.
- **제안**: `oauthWaitingRef.current`를 사용한다:
  ```ts
  const oauthWaitingRef = useRef(oauthWaiting);
  useEffect(() => { oauthWaitingRef.current = oauthWaiting; }, [oauthWaiting]);
  // setTimeout 내부: if (!oauthWaitingRef.current) return;
  ```

---

### INFO 1: 중복 방어 조건
- **위치**: `integration-oauth.service.ts:handleInstall()` line ~868
- **상세**: `if (!installToken || installToken.length === 0)` — `!installToken`이 이미 빈 문자열을 커버한다. 기능 오류는 없으나 혼란을 줄 수 있다.

---

### INFO 2: `'install_timeout'` 문자열 분산
- **위치**: `integration-expiry-scanner.service.ts`, `status-badge.tsx`, `isReauthorizeDisabled`
- **상세**: plan W10 cleanup으로 추적 중이지만, 변경 4 구현이 이미 이 PR에 포함되어 있어 상수화 없이 3곳에 리터럴이 퍼져 있다. 오타 방어를 위해 이번 PR에서 함께 처리하는 것이 바람직하다.

---

### INFO 3: Plan 미완 항목 다수
- **위치**: `plan/in-progress/cafe24-pending-polish.md`
- **상세**: e2e 테스트 (W14, 변경 5 전반), IP 기반 rate limiting (W7), nginx install_token segment 마스킹 (W6), 레거시 경로 영구 폐기 일정, TOCTOU advisory lock (변경 3) 등이 미완료로 남아 있다. 단위 테스트로 회귀 보호는 확보되어 있으나 보안·운영 관련 항목이 후속 PR로 미뤄진 상태다.

---

## 요약

변경 0–5의 핵심 기능(install_token 식별 키 승격, 중복 pending 방지, TTL 스캔, Reauthorize 비활성, 폴링, 팝업 피드백)은 spec과 전반적으로 일치하며 테스트 커버리지도 양호하다. 그러나 **install_token 재발급 후 TTL이 `createdAt` 기준으로 남아 spec의 "발급 후 24시간" 요건과 어긋나는 기능적 불일치**가 존재하며, popup closed 감지의 stale closure로 인한 오탐 toast 가능성과 폴링 종료 시 UI 공백이 추가로 발견된다.

## 위험도

**MEDIUM**