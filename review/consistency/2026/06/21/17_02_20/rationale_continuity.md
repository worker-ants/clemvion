# Rationale 연속성 검토 결과

- 검토 모드: 구현 착수 전 (--impl-prep)
- 검토 대상: `spec/4-nodes/4-integration` (0-common.md · 1-http-request.md · 2-database-query.md · 3-send-email.md · 4-cafe24.md)
- 참조 Rationale: spec/0-overview · spec/1-data-model · spec/2-navigation/* · spec/4-nodes/4-integration/* 자체 Rationale

---

## 발견사항

### [INFO] D4 결정 이후 통일된 에러 라우팅 — 내부 상태 일관성 양호
  - target 위치: `0-common.md §4.2` D4 결정 박스; `1-http-request.md §5.8`; `2-database-query.md §5.8`; `3-send-email.md §5.8`
  - 과거 결정 출처: `0-common.md §4.2` D4 결정; `04-security.md C-3` (옵션 A — SSRF 가드 전 인증 방식 적용)
  - 상세: 세 핸들러 모두 `execute()` 내부 실패를 `port:'error'` 로 라우팅하는 D4 정책을 일관되게 기술하고 있다. `1-http-request.md §8.2 Rationale` 은 "기각된 대안" (B: none 전용 별도 allowlist, C: 현상 유지)을 명시하고 채택 경위를 기록해 Rationale 연속성이 완전하다.
  - 제안: 보완 불필요.

### [INFO] `meta.durationMs` 명명 통일 — `0-common.md §6.1` 이후 세 문서 모두 반영 완료
  - target 위치: `0-common.md §6.1`; `1-http-request.md §5.1/§5.3`; `2-database-query.md §5.1`; `3-send-email.md §5.1`
  - 과거 결정 출처: `0-common.md §6.1` ("모든 Integration 노드의 시간 메트릭은 `meta.durationMs` 로 통일")
  - 상세: `meta.duration` → `meta.durationMs` breaking change 가 `0-common.md` 에 명시 기록되어 있고 세 하위 문서가 모두 `durationMs` 를 사용해 정합한다.
  - 제안: 보완 불필요.

### [INFO] `3-send-email.md §5.3` — `INTEGRATION_NOT_FOUND` 미surface 기록 방식
  - target 위치: `3-send-email.md §5.3` 비고 및 §5.8
  - 과거 결정 출처: `0-common.md §4.2` 비고 ("별도 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 … `INTEGRATION_CALL_FAILED`로 surface")
  - 상세: send-email 에서 `NotFoundException`이 `EMAIL_SEND_FAILED`로 흡수되는 현상이 `0-common.md §4.2` 의 표준 패턴(RESOURCE_NOT_FOUND → fallback 코드로 흡수)과 달리 `EMAIL_SEND_FAILED`로 흡수됨을 §5.3 비고에서 "Planned" 로 별도 기록하고 있다. send-email 핸들러의 catch 분기가 `IntegrationError` 여부로만 분기하는 구조상 필연적인 차이인데, `0-common.md §4.2` 비고("send-email 의 경우 `EMAIL_SEND_FAILED` 로 surface")와 정합해 문서 간 충돌은 없다.
  - 제안: 보완 불필요. 단, 구현 시 send-email 의 catch 블록이 http/db 와 달리 `INTEGRATION_CALL_FAILED` fallback 을 거치지 않고 `EMAIL_SEND_FAILED` 로 직접 매핑함을 `0-common.md §4.2` 비고에 한 줄 명시 보강하면 구현자 혼란을 예방할 수 있다.

### [INFO] `2-database-query.md §4 풀 캐시` Redis pub/sub — Durable Continuation 폐기 결정과 공존 관계 명시
  - target 위치: `2-database-query.md §4.2` 풀 캐시 + Rationale "풀 캐시 멀티 인스턴스 무효화"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md Rationale "Durable Continuation"` (옛 Redis pub/sub `execution:continuation` → BullMQ 영속 큐 교체)
  - 상세: database-query Rationale 이 `execution:continuation` 폐기와 본 `integration:cache:invalidate` 채널이 왜 상충하지 않는지를 명시("continuation 은 유실 시 실행이 멈추는 내구성 필요 … 본 채널은 best-effort") 하고 있어 Rationale 연속성이 완전하다.
  - 제안: 보완 불필요.

### [INFO] `1-http-request.md §4` SSRF 가드 — `none`/`custom` 무가드 폐지 Rationale 완비
  - target 위치: `1-http-request.md §8.2 Rationale`
  - 과거 결정 출처: `04-security.md C-3` (옵션 A 채택 — SSRF 가드 전 인증 방식 적용; 기각: B 별도 allowlist, C 현상 유지)
  - 상세: `1-http-request.md §8.2` 가 "기각된 대안 (B)/(C)" 를 명시하고 사용자 결정(2026-06-11)을 기록해 `04-security.md C-3` 옵션 선택 내역과 완전히 일치한다. 채택 이유·breaking 영향·마이그레이션 안내까지 갖추어 Rationale 연속성이 가장 완전한 섹션 중 하나다.
  - 제안: 보완 불필요.

---

## 요약

`spec/4-nodes/4-integration` 영역 전체는 Rationale 연속성 관점에서 심각한 충돌이 없다. D4 에러 라우팅 통일·SSRF 가드 전 인증 방식 적용·`meta.durationMs` 명명 통일·DB 풀 캐시 Redis 무효화 채널의 네 가지 핵심 결정이 모두 각 문서 Rationale 또는 공통 규약(`0-common.md`)에 근거와 함께 기록되어 있으며, 기각된 대안 재도입·합의된 invariant 우회·무근거 번복의 징후가 발견되지 않았다. `send-email` 의 `INTEGRATION_NOT_FOUND` 미surface 차이가 `0-common.md §4.2` 와 미세하게 설명 방식이 다르지만, 실질적 정책 모순은 아니다. 구현 착수 전 추가 Rationale 갱신이 필요한 CRITICAL·WARNING 항목은 없다.

---

## 위험도

NONE
