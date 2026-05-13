### 발견사항

- **[INFO]** 신규 외부 의존성 없음
  - 위치: 전체 diff
  - 상세: 변경 범위가 기존 내부 모듈 간 호출 방식 수정(`void` → `await`)에 한정되며, `package.json` 변경이 없다. 신규 import 도 없다.
  - 제안: 해당 없음

- **[INFO]** `AuthService` → `LoginHistoryService` 의존 결합도 변화
  - 위치: `auth.service.ts` 전 호출부, `sessions.service.ts` 전 호출부
  - 상세: 기존에는 fire-and-forget(`void`)이어서 `LoginHistoryService`의 응답 지연이 `AuthService` 응답 시간에 영향을 주지 않았다. `await`로 전환하면 `record()` 내부의 DB `INSERT` 완료가 HTTP 응답 경계에 포함된다. 단, `record()` 자체가 예외를 swallow하므로 오류 전파 위험은 없다.
  - 제안: 현재 구조 유지 가능. 향후 `LoginHistoryService`가 외부 webhook·분석 파이프라인 등 고지연 작업을 포함하게 된다면, 내부에서 비동기 큐로 분리하고 호출부는 `await`를 유지하는 방향이 적합하다.

- **[INFO]** TypeORM connection pool 의존 가정이 명문화됨
  - 위치: `login-history.service.ts` JSDoc
  - 상세: 변경 동기(pool에서 read/write가 다른 connection을 쓸 수 있어 visibility race 발생)가 주석으로 명시됨. 이 가정은 TypeORM 외부 의존성의 동작 특성에 대한 것으로 정확하다.
  - 제안: 해당 없음 — 문서화 수준이 적절하다.

---

### 요약

이번 변경은 신규 외부 패키지를 추가하지 않으며, 기존 내부 의존 그래프(`AuthService` · `SessionsService` → `LoginHistoryService` → TypeORM)를 그대로 유지한다. 유일한 의존성 관점의 변화는 `record()` 호출이 동기 완료를 보장하게 되어 인증 응답 latency에 DB `INSERT` 1회 비용(~1–5 ms)이 추가된다는 점이다. `record()` 내부 예외 swallow 구조가 유지되므로 오류 격리는 그대로 보장된다. 의존성 측면의 위험 요소는 없다.

### 위험도

**NONE**