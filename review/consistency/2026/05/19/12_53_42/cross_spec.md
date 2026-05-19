# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
구현 범위: `LlmService.withRetry` 에 RFC 7231 `Retry-After` 헤더 존중 로직 추가 (`delta-seconds` / HTTP-date 양 형식, 상한 60s). 변경 파일: `llm.service.ts`, `llm.service.spec.ts`. 신규 spec · 요구사항 ID · 엔티티 없음.

---

## 발견사항

### 1. [INFO] spec §6 재시도 횟수·backoff 기술과 구현 간 미세 표현 불일치

- **target 위치**: `plan/in-progress/llm-retry-after.md` §변경 범위, 구현 예정 `llm.service.ts:withRetry`
- **충돌 대상**: `spec/5-system/7-llm-client.md §6 에러 처리`
  ```
  | 속도 제한 | 429 | `LLM_RATE_LIMIT` — 재시도 (exponential backoff, 최대 3회) |
  ```
  및 `§8.3 서비스 레이어`:
  ```
  재시도(rate limit)는 스트리밍 중에는 적용하지 않는다. 시작 전 네트워크
  초기화 단계에서만 기존 exponential backoff 규칙을 적용.
  ```
- **상세**: spec §6 은 backoff 방식을 단순히 "exponential backoff" 로만 기술하고 있다. 구현 예정 변경은 `Retry-After` 헤더가 존재하면 exponential 대신 provider 지시값을 사용하므로, spec 문구가 실제 동작을 완전히 설명하지 못하게 된다. 기능적 충돌은 아니지만 spec 의 기술이 stale 해진다.
- **제안**: 구현 완료 후 `spec/5-system/7-llm-client.md §6` 의 `LLM_RATE_LIMIT` 행을 "exponential backoff, 최대 3회 / RFC 7231 Retry-After 헤더 존재 시 헤더 값 우선 (상한 60s)" 으로 갱신할 것을 권장한다. `spec/` 변경은 `project-planner` 역할을 통해 별도 처리.

---

### 2. [INFO] spec §8.3 스트리밍 재시도 제한 규칙 — 구현과 일치하나 명시적 언급 추가 권장

- **target 위치**: `plan/in-progress/llm-retry-after.md` §결정 사항 "변경 위치 — 단일 `withRetry`"
- **충돌 대상**: `spec/5-system/7-llm-client.md §8.3`
  ```
  재시도(rate limit)는 스트리밍 중에는 적용하지 않는다.
  ```
- **상세**: plan 은 `withRetry` 만 수정하고 `chatStream` 에 Retry-After 로직을 추가하지 않는다. 이는 spec §8.3 과 정확히 일치한다. 충돌 없음. 단, plan 문서에 "스트리밍 경로(`chatStream`)는 기존 스펙(§8.3)대로 재시도 없음 — 본 변경 무관" 이라는 주석이 있으면 향후 오해를 방지할 수 있다.
- **제안**: 구현 코드 주석 또는 plan 문서에 1행 메모 추가 (spec 변경 불필요).

---

## 요약

이번 구현 대상은 `LlmService.withRetry` 의 backoff 결정 로직과 `extractRetryAfterMs` helper 추가에만 국한된다. 신규 spec ID, 새 엔티티·필드, API 엔드포인트 변경이 전혀 없으므로 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임 관점에서 충돌이 발견되지 않는다. 유일한 비일치는 `spec/5-system/7-llm-client.md §6` 의 backoff 방식 기술이 구현 변경 이후에도 "exponential backoff" 로만 남는다는 INFO 수준의 문서 동기화 필요성이다. 이는 `project-planner` 가 spec 을 소폭 갱신하는 것으로 해소된다. 구현 착수를 차단하는 CRITICAL/WARNING 은 없다.

---

## 위험도

NONE
