# 신규 식별자 충돌 검토

검토 대상: `cafe24-call-401-retry` (구현 착수 전 검토 — `--impl-prep`)
검토 일시: 2026-05-17

---

### 발견사항

신규 식별자 충돌에 해당하는 항목이 발견되지 않았다.

**근거:**

본 구현 범위가 도입하는 변경은 다음으로 한정된다.

1. `cafe24-api.client.ts` 의 `executeWithRateLimit()` 내부 401 분기 교체 — 새 public 식별자 없음.
2. 내부 boolean 파라미터 (`triedAuthRetry`) 또는 private helper (`tryRefreshAndRetry`) — 모듈 외부에 노출되지 않는 구현 세부이며, 기존 `pingConnection()` 의 동일 패턴과 동명 충돌 없음.
3. 호출 대상(`refreshViaQueue`, `refreshAccessToken`, `markAuthFailed`, `Cafe24AuthFailedError`, `ensureFreshToken`) 은 모두 기존 spec 및 코드에 이미 정의된 식별자 — 신규 도입 없음.
4. 테스트 케이스 T-1~T-5 는 `cafe24-api.client.spec.ts` 기존 `describe` 블록 내 추가로, 새 테스트 파일명이나 describe scope 명을 도입하지 않는다.
5. `spec-update-cafe24-call-401-retry.md` 가 제안하는 §10.5 본문 추가는 기존 절 번호·엔티티·API·이벤트·ENV 변수를 재사용하며 새 식별자를 정의하지 않는다.

점검 항목별 결과:

| 점검 관점 | 결과 |
|-----------|------|
| 요구사항 ID 충돌 | 해당 없음 — 신규 요구사항 ID 미도입 |
| 엔티티/타입명 충돌 | 해당 없음 — 신규 엔티티·DTO·인터페이스 미도입 |
| API endpoint 충돌 | 해당 없음 — 신규 엔드포인트 미도입 |
| 이벤트/메시지명 충돌 | 해당 없음 — 신규 webhook·queue·SSE 이벤트명 미도입 |
| 환경변수·설정키 충돌 | 해당 없음 — 신규 ENV var·config key 미도입 |
| 파일 경로 충돌 | 해당 없음 — 기존 파일 수정만 수행. 신규 파일은 `cafe24-api.client.spec.ts` 내 추가 테스트로 경로 변경 없음 |

---

### 요약

`cafe24-call-401-retry` 구현 범위는 `cafe24-api.client.ts` 의 기존 401 분기를 같은 파일 내 `pingConnection()` 패턴으로 교체하는 협소한 내부 수정이다. 신규로 외부에 노출되는 식별자(요구사항 ID, 엔티티/DTO명, API 엔드포인트, 이벤트명, ENV var, 파일 경로)가 전혀 없으므로 기존 사용처와의 충돌 가능성은 없다.

---

### 위험도

NONE
