---
worktree: cafe24-jwt-exp-fix-7a3f1c
started: 2026-05-18
owner: developer (사용자 권한 위임으로 본 worktree 안에서 직접 적용)
---

# Spec 갱신 — Cafe24 토큰 만료 SoT 를 JWT exp claim 으로 격상

## 배경

`plan/in-progress/cafe24-jwt-exp-fix.md` 의 구현과 동일 PR 로 spec 도 함께 갱신한다 (SDD 흔적 보존, consistency-check `--impl-prep` 의 W1·W2·W3·W4·W5 권고 반영).

본래 developer 는 `spec/` 에 직접 쓰지 않으나, 사용자가 본 worktree 안에서 직접 적용을 지시했고 consistency-check 가 Critical 없이 LOW 위험도로 진행 가능 판정한 상태.

## consistency-check 결과 요약

- 위치: `review/consistency/2026/05/18/19_29_07/`
- 판정: **BLOCK: NO** (Critical 0건, WARNING 5건, INFO 13건)
- 모든 WARNING 은 본 spec 갱신에 포함 (W1·W2 → §5 추가, W3 → §6 추가, W4·W5 → §3 Rationale 본문 보강)

## 갱신 항목

### 1. `spec/2-navigation/4-integration.md §10.5 토큰 자동 갱신` 첫 bullet 뒤 신설 bullet

> - **만료 시각 SoT (2026-05-18 갱신)**: Cafe24 의 `access_token` / `refresh_token` 은 JWT 이므로 **JWT `exp` claim** (RFC 7519, Unix epoch seconds — UTC absolute) 을 만료 시각의 single source of truth 로 사용한다. backend 의 token-exchange normalizer (`parseTokenExpiresAt`) 와 refresh path (`refreshAccessToken`) 는 내부적으로 `parseJwtExp(token)` 을 첫 단계로 호출해 결과를 최우선 채택하고, JWT 디코드가 비정상으로 null 인 경우에만 표준 `expires_in` → cafe24 한정 `expires_at` ISO (timezone designator 누락 시 `+09:00` KST 부여로 정규화) → 2h default 로 강하한다. ISO 의 timezone 모호성으로 `Integration.token_expires_at` 가 의도와 다른 epoch 로 저장돼 proactive refresh 와 워커 short-circuit 이 동시에 빗나가는 회귀 ([Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"](#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18) 참고) 의 영구 차단. JWT signature 검증은 본 용도에 불필요 (만료 시각 metadata 추출 목적; 토큰 진위는 Cafe24 API 호출 시점에 검증).

### 2. `spec/2-navigation/4-integration.md §5.8 Cafe24` 응답 shape 설명 갱신 (line ~555)

> **응답 shape (Cafe24 quirk)**: Cafe24 의 `/oauth/token` 응답은 OAuth 표준 `expires_in` (초) 을 돌려주지 않고 **`expires_at` (ISO8601 문자열)** 만 돌려준다. 단 `access_token` 자체가 JWT 라 `exp` claim 으로도 만료 시각을 알 수 있다. backend 의 token-exchange normalizer 는 **JWT `exp` 우선** → 표준 `expires_in` → cafe24 의 `expires_at` ISO (TZ designator 누락 시 `+09:00` 정규화) → 2h default 의 precedence 로 채택 ([Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"](#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18) 참고). 옛 "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" Rationale 항은 본 격상으로 흡수.

### 3. `spec/2-navigation/4-integration.md ## Rationale` 신규 항목

기존 "`call()` 의 401 자동 회복 (2026-05-17)" 항 다음 위치에 신설:

```markdown
### Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)

**문제**: `plan/complete/cafe24-proactive-refresh-fix.md` + 401 자가 회복 fix 가 모두 main 에 있는데도 사용자 보고 (2026-05-18, mall `gehrig0301`) — 같은 401 (`access_token time expired`) 가 반복. 직접 추적 결과:

1. `parseTokenExpiresAt` 와 `refreshAccessToken` 의 `Date.parse(expiresAtStr)` 가 TZ-less ISO 를 서버 local time 으로 해석 (ECMA-262 사양). Cafe24 가 KST 의미로 TZ-less ISO 를 보내면 UTC 컨테이너에서 `tokenExpiresAt` 가 의도 시각과 다른 epoch 로 저장됨.
2. `Cafe24TokenRefreshProcessor.process` 의 short-circuit guard (`expiresAtMs - now > REFRESH_WINDOW_MS` → skip refresh) 가 1 의 잘못된 값을 신뢰 → L3 401 reactive 자가 회복이 enqueue 해도 worker 가 refresh 를 수행하지 않음 → caller 가 stale token 으로 retry → 두 번째 401 → `markAuthFailed`.

L1~L4 4-layer 방어가 *같은 잘못된 expiry* 를 신뢰하므로 모두 무력화.

**결정**: Cafe24 의 access_token / refresh_token 이 JWT 라는 사실에 근거해 **JWT `exp` claim** 을 single source of truth 로 격상. RFC 7519 정의상 Unix epoch seconds (UTC absolute) 이므로 TZ 모호성 원천 제거. 두 위치 모두 precedence 통일:

- `parseTokenExpiresAt(provider='cafe24', data)` — JWT exp → `expires_in` → `expires_at` ISO (TZ-less 면 `+09:00` 부여) → 2h default
- `Cafe24ApiClient.refreshAccessToken` 의 expiresAt 계산 — 동일 precedence

추가로 워커 short-circuit 의 잘못된 신뢰 차단:

- `Cafe24RefreshJobData.source` 에 `'reactive_401'` 값 추가 (의미: HTTP 401 을 empirical 하게 받아 강제 refresh 가 필요한 경로의 신호. 향후 다른 empirical 신호 경로가 생기면 `reactive_<signal>` 패턴으로 확장)
- `Cafe24TokenRefreshProcessor.process` 가 `source === 'reactive_401'` 이면 short-circuit skip — 본 source 는 *caller 가 empirical 401 을 받았다* 는 신호라 DB 의 `expires_at` 을 신뢰하면 안 됨. 기존 short-circuit (proactive 의 thundering herd 방지) 은 그대로 유효 — proactive/background 경로의 dedup 보증은 BullMQ jobId dedup (waiting/active 상태) 으로 유지되며 본 변경은 *완료된 job* 의 잔존 동작만 영향. ("[BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소 (2026-05-16)](#bullmq-cafe24-token-refresh-큐--멀티-인스턴스-race-해소-2026-05-16)" 의 확장)
- `Cafe24ApiClient.performAuthRefresh` 가 `refreshViaQueue` 호출 시 `'reactive_401'` 전달
- **`reactive_401` 의 `removeOnComplete: { age: 0 }` 정책**: BullMQ jobId dedup 은 `waiting/active` 뿐 아니라 `completed` 상태 job 도 dedup 대상으로 본다. proactive 가 60s 잔존 정책으로 완료 후 60s 동안 같은 jobId 의 새 add 를 기존 completed job 으로 dedup 시키면, reactive_401 이 enqueue 해도 worker 가 실행되지 않고 waitUntilFinished 가 즉시 resolve 되어 caller 가 stale credentials 로 retry 하는 edge case 발생. `removeOnComplete: { age: 0 }` 는 reactive_401 의 완료 job 을 즉시 제거해 같은 시점의 다음 reactive_401 add 가 새 job 으로 진입하게 한다. **cross-pod 동시성**: 두 pod 의 reactive_401 add 가 waiting/active 상태에서 만나면 BullMQ jobId dedup 이 정상 작동 (한 worker 만 실행) — refresh_token rotation race 보호 유지.

**기각 대안**:

- (A) `parseTokenExpiresAt` 만 TZ 보정 (워커 short-circuit 그대로) — 옛 NULL 또는 잘못된 expiry 가 DB 에 이미 저장된 row 의 자가 회복이 안 됨. 본 fix 의 reactive_401 force 가 필요.
- (B) 워커 short-circuit 만 제거 (JWT exp 미적용) — proactive 경로가 여전히 잘못된 expiry 로 skip → 매 호출이 401 → reactive_401 → refresh 라는 우회로만 남음. 정상 상태에서도 매 호출이 한 번씩 401 을 받는 retry 비용 발생. JWT exp 가 근본 해결.
- (C) Cafe24 에 응답 형식 정규화 요청 — 외부 의존, 시간 무한. 본 fix 가 우리 측에서 해결 가능.

**Trade-off / 잔여 위험**:

- JWT signature 검증 없음 — 본 용도 (만료 시각 추출) 에 불필요. Cafe24 가 token format 을 opaque 로 바꾸면 `parseJwtExp` 가 null 반환 → fallback chain 으로 정상 강하.
- TZ 보정 fallback (`+09:00`) 은 Cafe24 본사 운영 기준 timezone 으로 합리적 추정. Cafe24 가 향후 UTC 로 변경해도 JWT exp 가 최우선이라 영향 없음.
- 기존 row 의 (잘못된) `tokenExpiresAt` 은 다음 reactive_401 refresh 사이클에 자동 정정.

**테스트**:

- `jwt-exp.spec.ts` 신규 — `parseJwtExp` 단위 (정상 / segment 오류 / base64 오류 / JSON 오류 / exp 누락 / exp 비-숫자 / null / undefined)
- `integration-oauth.service.cafe24.spec.ts` 보강 — JWT 우선 / JWT 비정상 시 ISO fallback / TZ-less ISO 의 KST 정규화
- `cafe24-api.client.spec.ts` 보강 — refresh 응답의 access_token JWT 우선 / stale tokenExpiresAt + 401 → reactive_401 worker 가 short-circuit 없이 refresh
- `cafe24-token-refresh.processor.spec.ts` 보강 — source='reactive_401' 일 때 fresh token 도 refresh / 'proactive' 는 종전 short-circuit

**출처**: 사용자 보고 (2026-05-18, mall `gehrig0301`). 직전 같은 mall 의 보고 (`plan/complete/cafe24-proactive-refresh-fix.md` + 후속 fix 들) 가 같은 클래스의 회귀였음을 확정.
```

### 4. 옛 Rationale 항 obsolete 표시 (consistency-check I1)

`spec/2-navigation/4-integration.md ## Rationale` 의 기존 항 "Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)" 본문 첫 줄에 다음 안내 추가:

> > **(2026-05-18 superseded)** 본 항의 정책은 "[Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)](#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18)" 으로 흡수·격상됨. 본 항은 역사 기록으로 보존.

### 5. `spec/data-flow/5-integration.md §2.2` Redis 표 갱신 (consistency-check W1·W2)

`cafe24-token-refresh` 큐 row 의 컬럼 두 개:

- **payload.source 유니온**: `'background' | 'proactive'` → `'background' | 'proactive' | 'reactive_401'`. `reactive_401` 추가는 `Cafe24ApiClient.executeWithRateLimit` 의 401 자가 회복 경로가 사용하는 source — caller 가 empirical 401 을 받은 신호.
- **dedup 컬럼**: `removeOnComplete: { age: 60 }` 단일값 → 다음으로 갱신:
  > `removeOnComplete: { age: 60 } (proactive / background)` · `{ age: 0 } (reactive_401 — completed 잔존이 stale dedup 시키는 edge case 차단)`

세부 근거는 [4-integration.md Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"](../2-navigation/4-integration.md#cafe24-token-만료-sot--jwt-exp-격상-2026-05-18) 참조.

### 6. `spec/4-nodes/4-integration/4-cafe24.md §9.6` 진입점 갱신 (consistency-check W3)

기존 "Refresh 진입점은 셋" 기술을 4개로 확장. 4번째 진입점:

> 4. `Cafe24ApiClient.performAuthRefresh` (`executeWithRateLimit` 의 401 자가 회복 경로) → `refreshViaQueue` 호출 시 `source='reactive_401'` 로 dispatch. 워커가 short-circuit 을 skip 하고 항상 refresh 시도. `removeOnComplete: { age: 0 }` 로 완료된 job 의 잔존 dedup 차단. caller 는 새 token 으로 동일 요청을 1회 retry (`triedAuthRetry=true` flag 로 무한 재귀 차단).

## 처리

본 worktree 안에서 직접 적용:

1. ✅ `consistency-check --impl-prep` 통과 (BLOCK: NO).
2. spec 변경 commit (`docs(spec): cafe24 토큰 만료 SoT JWT exp 격상 — 4-integration §5.8·§10.5·Rationale + data-flow §2.2 + 4-cafe24 §9.6`).
3. 본 plan 모든 체크박스 완료 시 `git mv` 로 `complete/` 이동 (마지막 commit).

## 처리 후

본 plan 의 spec 갱신이 모두 끝나면 `git mv plan/in-progress/spec-update-cafe24-jwt-exp.md plan/complete/spec-update-cafe24-jwt-exp.md`.
