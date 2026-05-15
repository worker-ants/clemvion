### 발견사항

- **[CRITICAL]** `timeout` 포트 제거 — Breaking Change
  - 위치: `spec/4-nodes/3-ai-nodes.md` 포트 섹션, Single Turn / Multi Turn 모드
  - 상세: 기존 `timeout` 정적 포트를 제거하고 `error` 포트로 통합. 이미 배포된 워크플로우에서 `timeout` 포트에 엣지가 연결된 경우, 해당 연결이 유효하지 않은 포트를 참조하게 됨. 스펙에 마이그레이션 전략(기존 `timeout` 엣지를 `error`로 자동 리라우팅 등)이 없음.
  - 제안: 마이그레이션 가이드 또는 자동 포트 리맵핑 로직(예: `timeout` 포트 ID를 가진 기존 엣지 → `error` 포트로 자동 전환) 명시 필요

- **[WARNING]** `endReason` enum과 포트 구조 불일치 — 내부/외부 계약 불일치
  - 위치: `spec/4-nodes/3-ai-nodes.md` — `endReason` enum 정의 및 Multi Turn 오류 포트 출력 구조
  - 상세: `endReason` enum에 `timeout`이 여전히 유효한 값으로 포함(`condition | user_ended | max_turns | timeout | error`)되지만, 실제 라우팅 포트로는 `error`가 사용됨. 이 불일치로 인해 다운스트림 노드에서 `endReason === 'timeout'`을 처리하는 로직이 필요한지 불분명. 단순한 참고 주석만 있고 공식 스펙 계약으로 명확히 정의되지 않음.
  - 제안: `endReason`을 `condition | user_ended | max_turns | error`로 단순화하거나, `timeout`을 별도 값으로 유지할 경우 클라이언트가 이를 어떻게 처리해야 하는지 명확히 명시

- **[WARNING]** Multi Turn 조건 0개 포트 구조 변경 — 기존 클라이언트 영향 가능
  - 위치: `spec/4-nodes/3-ai-nodes.md` 공통 섹션 — "조건이 0개인 경우"
  - 상세: 이전 스펙: Multi Turn + 조건 0개 → `timeout` + `user_ended` + `max_turns` + `error`. 변경 후: `out` 포트만 제공. "하위 호환"이라고 명시했으나 실제로는 `user_ended`/`max_turns`/`error` 포트가 사라지는 것이므로 기존 워크플로우의 해당 포트 연결이 깨짐. `out` 포트만 남기는 것은 하위 호환이 아닌 추가 파괴적 변경임.
  - 제안: "하위 호환"이라는 표현을 제거하거나, 실제 하위 호환을 보장하려면 조건 0개 Multi Turn에서도 `user_ended` + `max_turns` + `error` 포트를 유지해야 함

- **[WARNING]** 유효성 검증 규칙의 예약 포트 목록에 삭제된 `timeout` 포함
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 유효성 검증 규칙
  - 상세: `id`가 예약된 포트 ID(`out`, `in`, `timeout`, `error`, `user_ended`, `max_turns`)와 충돌 불가라고 명시했으나, `timeout` 포트는 이번 변경으로 제거됨. 실제로 존재하지 않는 포트 ID를 예약 목록에 유지하면 불필요한 제약이 생기고 혼란을 야기함.
  - 제안: 예약 포트 목록에서 `timeout` 제거 (또는 향후 재도입 가능성이 있다면 주석으로 이유 명시)

- **[INFO]** 도구 이름 규칙 변경의 기존 LLM 히스토리 호환성
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 도구 이름 규칙
  - 상세: 도구 이름이 순수 UUID에서 `tool_`/`cond_` 접두사 + 정제된 UUID로 변경됨. 이미 실행 중인 워크플로우의 대화 히스토리(Multi Turn)에 기존 UUID 형식의 tool call이 저장되어 있다면, 재개 시 도구 이름 불일치가 발생할 수 있음.
  - 제안: 실행 재개 시 기존 히스토리의 도구 이름을 새 형식으로 마이그레이션하는 처리 또는 "진행 중인 Multi Turn 세션에는 미적용" 정책 명시

---

### 요약

이번 변경은 AI Agent 노드의 포트 구조 및 도구 명명 규칙을 정비한 것으로, 설계 의도(timeout 단순화, 접두사 기반 도구 구분)는 명확하다. 그러나 `timeout` 포트 제거와 Multi Turn 조건 0개 케이스의 포트 구조 축소는 기존 워크플로우에 연결된 엣지를 파괴하는 **실질적인 Breaking Change**이며, 스펙에 마이그레이션 전략이 전혀 기술되지 않은 점이 가장 큰 위험이다. `endReason` enum에 `timeout`이 잔존하는 내부/외부 계약 불일치도 다운스트림 구현 시 혼란을 초래할 수 있다.

### 위험도
**HIGH**