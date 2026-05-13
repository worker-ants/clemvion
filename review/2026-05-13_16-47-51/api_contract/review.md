### 발견사항

- **[INFO]** 내부 구현 변경 — 외부 API 계약에 영향 없음
  - 위치: `auth.service.ts`, `sessions.service.ts` 전체 diff
  - 상세: `void this.loginHistory.record(...)` → `await this.loginHistory.record(...)` 변경은 순수 내부 비동기 처리 방식의 수정이다. HTTP 응답 형식, 상태 코드, 엔드포인트 경로, 요청/응답 스키마에 어떤 변화도 없다.
  - 제안: 해당 없음 (올바른 수정)

- **[INFO]** 응답 latency 소폭 증가
  - 위치: plan 문서 "영향 범위" 섹션
  - 상세: 로그인/로그아웃 관련 모든 엔드포인트에서 `INSERT login_history` 완료를 기다리므로 ~1–5 ms 증가 예상. SLA나 API 계약상 latency 보장이 명시된 경우라면 검토 필요하나, 일반적으로 이 수준은 무시 가능하다.
  - 제안: 해당 없음

---

### 요약

이번 변경은 `loginHistory.record()` 호출 방식을 fire-and-forget(`void`)에서 `await`으로 전환한 내부 구현 수정이다. 외부 API 계약(엔드포인트, HTTP 메서드, 요청/응답 스키마, 상태 코드, 인증 방식)에 일체 영향을 주지 않으며, `record()` 자체가 예외를 내부에서 삼키므로 인증 흐름의 에러 응답 형식에도 변화가 없다. API 계약 관점에서는 완전히 안전한 변경이다.

### 위험도

NONE