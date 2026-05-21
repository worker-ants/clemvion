# 보안(Security) 리뷰

대상 파일:
- `codebase/backend/src/modules/llm/llm.service.spec.ts` (테스트 파일 변경)
- `codebase/frontend/src/components/layout/sidebar.tsx` (프론트엔드 변경)

---

## 발견사항

### 파일 1: llm.service.spec.ts

- **[INFO]** 테스트 내 `apiKey: 'encrypted'` 플레이스홀더 값 사용
  - 위치: `describe('Retry-After header behavior')` 블록, `config` 상수 (diff +43, +628 등)
  - 상세: 테스트 코드가 `apiKey: 'encrypted'` 리터럴을 사용하고 있다. 이는 실제 키가 아닌 mock placeholder 이며, `mockLlmConfigService.getDecryptedApiKey`가 항상 `'sk-decrypted-key'`를 반환하도록 mock 되어 있어 실제 API 키가 코드에 포함된 것은 아니다. 그러나 전체 파일 컨텍스트의 `mockLlmConfigService` 설정(`getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted-key')`)은 실제 키가 아닌 테스트 전용 값임이 명확하다.
  - 제안: 현재 패턴은 허용 수준. 단, CI 에서 secret scanner(예: truffleHog, gitleaks) 가 `sk-` prefix 패턴을 OpenAI 키로 오탐 가능성이 있으니 `.gitleaksignore` 등에 테스트 파일 예외 규칙 추가를 권장한다.

- **[INFO]** `extractRetryAfterMs` 의 `Date.parse` 사용 — HTTP-date 파싱 경로
  - 위치: `llm.service.ts` 라인 371 (`Date.parse(str)`)
  - 상세: 이번 diff 에서 직접 변경된 코드는 아니나 새 테스트가 검증하는 프로덕션 로직이다. `Date.parse`는 JS 구현마다 비표준 입력을 다르게 처리하므로 악의적으로 조작된 `Retry-After` 헤더 값(예: 매우 큰 숫자, 특수 문자)이 예상치 못한 값으로 파싱될 수 있다. 현재 코드는 `Number.isFinite` 로 최종 검증하고 있어 NaN/Infinity 를 걸러내며, `MAX_BACKOFF_MS = 60_000` 상한 cap 으로 과도한 delay 를 차단하므로 실질적 위험은 낮다.
  - 제안: 기존 방어 로직으로 충분하나, delta-seconds 가 `Number.isFinite` 를 통과 후 `Math.floor(seconds * 1000)` 시 결과가 `MAX_BACKOFF_MS` 를 초과할 수 있다. 예를 들어 헤더 값 `999999` 초는 `extractRetryAfterMs` 에서 `999999000` ms 를 반환하지만 `withRetry` 의 `Math.min(retryAfterMs, MAX_BACKOFF_MS)` 로 cap 된다. 설계상 의도된 동작이며 cap 이 올바르게 적용된다.

- **[INFO]** Retry-After 헤더 신뢰 기반 DoS 완화 확인
  - 위치: `llm.service.ts` `withRetry` 메서드 (라인 289–321)
  - 상세: 외부 LLM provider 응답의 `Retry-After` 헤더 값을 신뢰해 sleep 시간을 결정한다. 공격자가 provider API 응답을 중간에서 변조(MITM)하거나 provider 자체가 악의적인 값을 전달할 경우 서버 스레드를 장시간 점유시킬 수 있다. `MAX_BACKOFF_MS = 60_000` 상한이 이를 방어하고 있다.
  - 제안: 현재 60초 cap 은 합리적이다. 추가로 총 누적 대기 시간 한도(예: 전체 retry 3회 × 최대 60초 = 180초)가 의도된 SLA 범위 내에 있는지 API Gateway / 요청 timeout 설정과 교차 점검 권장.

### 파일 2: sidebar.tsx

- **[INFO]** `notificationHref` 에서 `resourceId` 경로 탐색 방지 검증 확인
  - 위치: `codebase/frontend/src/lib/notifications/href.ts` 라인 19, 31
  - 상세: `SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/` 패턴으로 resourceId 를 화이트리스트 검증하고 있다. `..`, `/`, `%2F` 등 경로 탐색 문자를 차단한다. 이번 diff 가 `closeNotif` / `toggleNotif` 를 통해 `notificationHref` 결과를 `router.push(href)` 에 전달하는 경로를 정리했다.
  - 제안: 현재 검증 로직은 적절하다. 다만 `router.push(href)` 가 클라이언트 사이드 라우팅이므로 외부 URL(`https://evil.com`)이 들어오는 경우를 href 생성 단계에서 이미 차단하고 있는지 확인한다. `href.ts` 의 반환값은 항상 `/` 로 시작하는 상대 경로이므로 현재 설계상 문제 없다.

- **[INFO]** `closeNotif` dependency array 누락 가능성 없음 (useCallback)
  - 위치: `sidebar.tsx` 라인 1170–1173
  - 상세: `closeNotif = useCallback(() => { ... }, [])` 에서 `setNotifOpen`, `setNotifFilter` 는 React `useState` setter 로 참조 안정성이 보장되므로 빈 deps 배열이 정확하다. 보안 취약점 없음.
  - 제안: 해당 없음.

- **[INFO]** 사용자 이메일 UI 노출
  - 위치: `sidebar.tsx` 라인 1644–1647
  - 상세: `user?.email` 이 사이드바 유저메뉴 팝오버에 평문으로 표시된다. 이는 기존 코드에도 동일하게 존재하며 이번 diff 에서 변경되지 않았다. 접근 제어(로그인 필요)가 전제되어 있고, 자신의 이메일을 자신에게 보여주는 것은 정상 UX이다.
  - 제안: 해당 없음. 다만 화면 공유 시나 어깨너머 열람(shoulder surfing) 환경을 고려해 이메일 마스킹(예: `l***@domain.com`) 옵션을 UX 기획 시 검토 가능.

- **[INFO]** `handleClickOutside` 에서 `closeNotif` 의존성 누락 (useEffect deps)
  - 위치: `sidebar.tsx` 라인 1215–1237
  - 상세: `useEffect` deps 배열이 `[userMenuOpen, notifOpen, workspaceMenuOpen]` 이고 `closeNotif` 는 포함되지 않는다. `closeNotif` 가 `useCallback([], [])` 으로 참조 안정적이라 실제로는 문제가 없으나, eslint `exhaustive-deps` 규칙이 경고를 낼 수 있다. 보안상 영향은 없다.
  - 제안: `closeNotif` 를 deps 에 추가하거나 `// eslint-disable-next-line` 주석으로 의도를 명시하면 코드 명확성이 높아진다.

---

## 요약

이번 변경은 백엔드 LLM 서비스의 Retry-After 헤더 처리 로직에 대한 테스트 확장과, 프론트엔드 알림 팝오버의 필터 상태 리셋 핸들러 리팩터링으로 구성된다. 보안 관점에서 식별된 CRITICAL 또는 HIGH 수준의 취약점은 없다. `extractRetryAfterMs` 는 외부 헤더 값을 처리하지만 `MAX_BACKOFF_MS` cap 과 `Number.isFinite` 검증으로 적절히 방어되어 있으며, `notificationHref` 의 `SAFE_ID` 정규식 검증이 프론트엔드 경로 탐색을 차단한다. 테스트 파일 내 `sk-decrypted-key` 문자열은 CI secret scanner 오탐 가능성이 있으나 실제 키가 아니다.

---

## 위험도

NONE
