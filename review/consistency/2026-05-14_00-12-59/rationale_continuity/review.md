## 발견사항

### WARNING: `meta.rowCount` 이중 기술 — 공통 규약과 노드 spec 충돌

- **target 위치**: `0-common.md §6` 표(DB `meta` 열) vs `2-database-query.md §5.1` 주석
- **과거 결정 출처**: `2-database-query.md §5.1` — *"`rowCount` 는 형식상 메트릭이지만 워크플로우 분기의 비즈니스 판단 재료로 `output` 에 유지한다. `meta` 에 복제하지 않는다 — 같은 값이 두 곳에 있으면 일관성을 해친다."*
- **상세**: `0-common.md §6` 표의 DB `meta` 열에는 `meta.rowCount (output.rowCount 와 중복 가능 — output 은 도메인, meta 는 메트릭 측면)` 이라고 쓰여 있어, `meta.rowCount` 존재를 허용하는 것처럼 읽힌다. 그러나 `2-database-query.md §5.1` 는 "복제하지 않는다" 고 명시하고, 실제 JSON 예시 어디에도 `meta.rowCount` 가 없다. 공통 규약 문서가 노드 spec 의 명시적 결정을 덮어쓰는 것처럼 보여 구현자가 혼동할 수 있다.
- **제안**: `0-common.md §6` 표 DB 행의 `meta.rowCount` 기술을 삭제하거나, 괄호 내에 "2-database-query.md §5.1에서 meta 복제 금지로 확정" 주석을 달아 단일 진실을 명확히 한다.

---

### INFO: `send_email` success 포트 명 `out` — Rationale 부재

- **target 위치**: `3-send-email.md §3.2`, `0-common.md §7` 출력 색인
- **과거 결정 출처**: 없음 (기존 Rationale 어디에도 이유 미기술)
- **상세**: HTTP Request, Database Query, Cafe24 는 success 포트 id가 `success` 인 반면 Send Email 만 `out` 을 사용한다. `0-common.md §7` 색인도 이를 그대로 열거할 뿐 차이의 배경을 설명하지 않는다. 새로 도입된 Cafe24 spec 이 `success` 를 채택함으로써 이 불일치가 더 두드러진다.
- **제안**: `3-send-email.md §9 Rationale` 에 "이메일은 발송 결과가 단방향 완료 신호(`out`)이며 HTTP 요청처럼 resource를 반환하지 않아 `success` 와 구별"하거나, 반대로 `success` 로 통일하는 결정 중 하나를 명시적으로 기록한다.

---

### INFO: `output.response.error` legacy 잔재 보존 명시

- **target 위치**: `1-http-request.md §5.3.2` (transport 실패 출력 예시)
- **과거 결정 출처**: 없음 (CONVENTIONS Principle 1.1 — config raw ↔ output runtime 직교 원칙)
- **상세**: transport 실패 케이스에서 `output.response: { "error": "ECONNREFUSED" }` 와 `output.error: { ... }` 가 공존한다. spec 자체가 "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용"이라 명시하고 있어 의도는 명확하나, 해당 legacy 보존 결정이 어느 시점에 왜 내려졌는지 Rationale 에 기록되어 있지 않다. 후속 리팩터링 시 혼동 요인이 될 수 있다.
- **제안**: `1-http-request.md §9 Rationale` 또는 CHANGELOG 에 "backwards-compatibility 목적으로 `output.response.error` 를 일정 기간 유지, 폐기 시점 미정" 한 줄을 추가한다.

---

## 요약

`spec/4-nodes/4-integration/` 문서 전체는 과거 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 CRITICAL 문제는 없다. Cafe24 spec §9 는 MCP Bridge 방식 선택 근거(Option A vs B vs C), 단일 노드 + 메타데이터 테이블 채택, 5필드 invariant 준수, rate-limit 범위 한정 trade-off 를 모두 명시적으로 기술하여 의사결정 연속성이 잘 유지된다. 다만 `0-common.md §6` 의 `meta.rowCount` 기술이 `2-database-query.md §5.1` 의 "복제 금지" 결정과 상충하는 WARNING 1건이 식별되며, `send_email` 포트명(`out`) 과 HTTP transport 실패의 legacy `output.response.error` 에 대한 Rationale 미기록이 INFO 수준으로 발견된다.

## 위험도

**LOW**