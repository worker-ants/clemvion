### 발견사항

---

**[WARNING] TTL 스캔이 `createdAt` 기준이어서 토큰 갱신 후에도 즉시 만료 가능**
- 위치: `integration-expiry-scanner.service.ts` — `expirePendingInstalls`, `integration-oauth.service.ts` — `existingPending` 재사용 분기
- 상세: `expirePendingInstalls`는 `createdAt < now - 24h` 조건으로 만료를 판단한다. 그런데 `begin`의 `existingPending` 재사용 경로에서 `installToken`과 `credentials`는 새 값으로 교체되지만 `createdAt`은 원래 행의 생성 시각을 그대로 유지한다. 결과적으로 원래 `pending_install` 행이 생성된 지 24시간이 지난 시점에서 재사용하면, 새 토큰을 발급한 직후에도 스캐너가 해당 행을 `expired(install_timeout)`으로 전환할 수 있다.
- 제안: `existingPending` 재사용 시 `existingPending.createdAt = new Date()`로 갱신하거나, 별도의 `installTokenIssuedAt` 컬럼을 두어 TTL 기준점을 명확히 분리할 것.

---

**[WARNING] 팝업 닫힘 감지 useEffect의 stale closure**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `oauthWaiting` 폴링 `useEffect`
- 상세: `setInterval` 콜백 안의 `setTimeout(() => { if (!oauthWaiting) return; ... }, 1500)` 에서 `oauthWaiting`은 이 effect가 setup될 당시의 값으로 고정된다(클로저 캡처). OAuth 성공 메시지가 도착해서 `oauthWaiting`이 `false`로 바뀐 뒤에도, 팝업이 닫히면서 `setTimeout`이 발화할 경우 stale `oauthWaiting === true`를 읽어 `setOauthError(oauthPopupClosedNoResult)` 를 호출할 수 있다. 성공 직후에 에러 토스트가 뜨는 레이스가 발생한다.
- 제안: `oauthWaiting`을 `useRef`로 유지하거나, `setTimeout` 내부에서 `setOauthWaiting` 함수형 업데이트를 활용해 최신 상태를 읽도록 수정.

```ts
// 예시 — ref를 병행 유지
const oauthWaitingRef = useRef(oauthWaiting);
useEffect(() => { oauthWaitingRef.current = oauthWaiting; }, [oauthWaiting]);
// setTimeout 내부에서 oauthWaitingRef.current 사용
```

---

**[WARNING] `CREATE UNIQUE INDEX`가 기존 중복 `install_token` 값에서 실패 가능**
- 위치: `V043__cafe24_install_token_index.sql`
- 상세: `IF NOT EXISTS`는 인덱스가 이미 존재할 때만 건너뛴다. 과거에 `install_token`이 NULL-아닌 값으로 중복 저장된 행이 있으면(이론적으로 낮지만 수동 조작이나 버그 발생 가능) 마이그레이션 자체가 실패한다.
- 제안: 마이그레이션 앞에 `UPDATE integration SET install_token = NULL WHERE ctid NOT IN (SELECT MIN(ctid) FROM integration WHERE install_token IS NOT NULL GROUP BY install_token)` 같은 중복 제거 구문을 선행하거나, 배포 전 `SELECT install_token, COUNT(*) FROM integration WHERE install_token IS NOT NULL GROUP BY install_token HAVING COUNT(*) > 1` 쿼리로 사전 확인 절차를 추가.

---

**[WARNING] `handleInstall` 시그니처 변경 — 모든 호출 지점 갱신 확인 필요**
- 위치: `integration-oauth.service.ts:852` → `(installToken: string, query: Cafe24InstallQuery)`
- 상세: 기존 `handleInstall(query)` → `handleInstall(installToken, query)`로 인자가 추가됐다. `integrations.controller.ts`는 갱신됐으나, 테스트 파일(spec) 외 서비스 내부에서 직접 `handleInstall`을 호출하는 경로가 있을 경우 런타임 오류가 발생한다.
- 제안: `grep -r 'handleInstall' backend/src/`로 모든 호출 지점을 확인하여 누락된 갱신이 없는지 검증.

---

**[WARNING] `process()`의 에러 삼킴 — BullMQ 재시도 불가**
- 위치: `integration-expiry-scanner.service.ts` — `process()` 메서드
- 상세: 이전에는 `run()` 또는 `pruneUsageLogs()`에서 예외가 발생하면 job이 실패로 기록되어 BullMQ가 재시도·DLQ로 라우팅했다. 이제 각 패스에 `.catch(logger.error)`가 붙어 job은 항상 성공으로 종료된다. 알림 발송 실패나 DB 오류가 재시도 없이 조용히 넘어간다.
- 제안: 의도한 설계라면 spec §1.4에 "단일 패스 실패 시 재시도 없음" 정책을 명기하고, 모니터링 알럿(Sentry, Datadog 등)을 `logger.error` 대신 또는 병행 사용할 것. 부분 실패를 집계하는 패스별 카운터를 반환값으로 노출하는 것도 고려.

---

**[WARNING] `meta` 필드가 required DTO — 기존 응답 역직렬화 호환성**
- 위치: `integration-response.dto.ts`, `frontend/src/lib/api/integrations.ts`
- 상세: `@ApiProperty` (non-optional)로 선언된 `meta` 필드가 추가됐다. 백엔드 `toPublic`이 항상 `meta`를 채우도록 업데이트되어 있으나, 프론트엔드 클라이언트 코드가 캐싱된 구버전 응답(브라우저 캐시, SWR/React Query 캐시)을 읽을 경우 `integration.meta` 가 `undefined`가 된다. `isReauthorizeDisabled`에서 `integration.meta?.appType`로 optional chaining이 사용되어 런타임 오류는 발생하지 않지만, Cafe24 Private 재인증 버튼이 일시적으로 활성화 상태로 표시될 수 있다.
- 제안: React Query `queryClient.invalidateQueries` 또는 배포 시 cache key 버저닝으로 stale 캐시 제거 보장.

---

**[INFO] TOCTOU 레이스: 동시 `begin` 요청으로 중복 `pending_install` 행 생성 가능**
- 위치: `integration-oauth.service.ts` — `createPrivatePendingIntegration`
- 상세: `existing` 스캔 → `existingPending` 찾기 → `save`까지 트랜잭션/advisory lock이 없다. 두 요청이 동시에 진입하면 둘 다 `existingPending === undefined`를 보고 각각 새 행을 생성한다. 계획 문서에서 후속 작업으로 인지하고 있으나, 현재 PR에서 미해결.
- 제안: 단기 완화책으로 `(workspaceId, serviceType, mall_id, app_type, status='pending_install')` 조합에 partial unique 인덱스 추가 또는 `pg_advisory_xact_lock` 적용.

---

**[INFO] `staleTime: 0` + `refetchOnWindowFocus: true` 조합의 서버 부하**
- 위치: `frontend/src/app/(main)/integrations/page.tsx`
- 상세: 탭 포커스마다 목록 API가 재호출된다. 워크스페이스에 통합이 많고 사용자가 탭 전환을 자주 하는 환경에서 불필요한 서버 부하가 발생할 수 있다.
- 제안: `staleTime: 30_000` 등 짧은 캐시 윈도우를 두어 연속 포커스 이벤트에 의한 중복 요청을 억제.

---

**[INFO] 레거시 `/oauth/install/cafe24` 라우트의 NestJS 등록 순서**
- 위치: `integrations.controller.ts` — 두 `@Get('oauth/install/cafe24*')` 핸들러
- 상세: `:installToken` 파라미터 라우트가 static 라우트보다 먼저 정의됐다. Express/NestJS에서 static 경로(`/cafe24`)는 파라미터 경로(`/cafe24/:token`)보다 우선순위가 높으므로 현재 순서는 안전하다. 그러나 이 동작은 프레임워크 내부 구현에 의존하므로, 명시적으로 static 라우트를 먼저 선언하는 것이 더 방어적이다.

---

### 요약

전반적으로 변경의 의도와 방향성은 명확하며 기존 O(N) HMAC 스캔 취약점을 단일 인덱스 조회로 올바르게 대체했다. 그러나 두 가지 실제 버그가 존재한다: (1) `expirePendingInstalls`가 `createdAt`을 기준으로 삼아 토큰을 갱신한 재사용 pending 행을 의도보다 일찍 만료시킬 수 있고, (2) 팝업 닫힘 감지 `useEffect`의 stale closure가 OAuth 성공 직후 에러 메시지를 표시하는 레이스를 만들어낸다. `process()`의 에러 삼킴 패턴과 TOCTOU 레이스는 계획상 인지된 사항이지만 운영 관측성 측면에서 보완이 필요하다.

### 위험도

**MEDIUM** — 두 개의 실제 버그(TTL 조기 만료, stale closure)가 운영 환경에서 발현 가능하며, TOCTOU는 저빈도지만 미완화 상태.