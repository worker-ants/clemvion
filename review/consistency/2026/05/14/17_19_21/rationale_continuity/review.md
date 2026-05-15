## Rationale Continuity Check 결과

### 발견사항

---

- **[WARNING]** `output.view` 참조 — Principle 4.2의 폐기 결정과 충돌
  - **target 위치**: `spec/conventions/node-output.md` § Principle 8.2 통일된 1차 네이밍 테이블 마지막 행
  - **과거 결정 출처**: 동일 문서 Principle 1.1.4 ("기존 초안에서 제안했던 `output.view.type` 판별자는 **폐기**") 및 Principle 4.2 ("초안의 `output.view` 래퍼 → **폐기** (Principle 1.1.4). 런타임 값은 `output` 최상위에 직접 배치.")
  - **상세**: Principle 8.2 테이블은 "프레젠테이션 뷰" 의 권장 위치로 `output.view (Principle 4 참고)` 를 명시하고 있다. 그런데 Principle 4.2는 `output.view` 래퍼 자체를 명시적으로 폐기했고, Principle 4.3의 노드별 Waiting output 표는 실제 필드가 `{ items }` / `{ rows }` / `{ data }` / `{ rendered }` 등 최상위로 직접 배치됨을 보여준다. Principle 8.2의 `output.view` 행은 폐기된 구조를 SSOT에 다시 기재한 형태로, 구현자가 이를 읽으면 `output.view` 래퍼를 사용해야 한다고 오해할 수 있다.
  - **제안**: Principle 8.2 테이블의 "프레젠테이션 뷰" 행을 `output.view` 대신 Principle 4.3의 실제 필드 목록 (`items` / `rows` / `totalRows` / `data` / `rendered`) 으로 대체하거나, "(Principle 4.3 참고 — 노드별 직접 배치)" 형태로 교체한다.

---

- **[INFO]** `source='system'` turn → `role: 'system'` 매핑의 API 비호환 처리 연기
  - **target 위치**: `spec/conventions/conversation-thread.md` §5.1 messages 모드 매핑 테이블 마지막 행
  - **과거 결정 출처**: 해당 문서 §5.1 각주 ("Anthropic API 는 messages 배열 내 `role: 'system'` 메시지를 미지원 — `system_text` 모드 또는 provider 별 분기 필요. v1 자동 push 없으므로 현재 실질 문제 없음")
  - **상세**: 문서 스스로 API 비호환을 인지하고 "v1 자동 push 없음" 을 이유로 현재는 실질 문제 없다고 설명한다. 그러나 `system` source turn 을 허용하는 경로가 `수동 push 도입 시 provider 분기 필수` 라는 조건부 경고만으로 관리된다. 이 경고가 구현 시점에 체크리스트에 남지 않으면, Anthropic 프로바이더 사용 중 messages 모드에서 `system` source turn 이 주입될 경우 API가 조용히 실패하거나 오류를 낼 수 있다.
  - **제안**: §5.1 매핑 테이블에서 `system` 행에 ⚠️ 주석을 추가하거나, §7 v2 로드맵에 "수동 push 도입 시 Anthropic provider 분기 구현" 항목을 명시적으로 포함시킨다.

---

- **[INFO]** `ConversationThread.id = 'default'` — 포트 예약어 'default' 와의 네임스페이스 경계 표기
  - **target 위치**: `spec/conventions/conversation-thread.md` §1.3 ConversationThread 테이블 `id` 행
  - **과거 결정 출처**: `spec/conventions/node-output.md` Principle 6 ("시스템 포트 예약어: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`")
  - **상세**: 해당 문서가 이미 "port 예약어 'default' 와 무관 — namespace 분리" 를 인라인 주석으로 명시하고 있어 의식된 결정임이 확인된다. 다만 실제 구현에서 네임스페이스 분리가 코드 레벨에서 명확히 구분되어야 하는데, `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장이 '권장' 수준에 그쳐있다.
  - **제안**: 이행은 필수 사항으로 승격하여 "코드에서 `DEFAULT_THREAD_ID = 'default'` 상수로 추출 **필수**" 로 표현을 강화한다.

---

### 요약

`spec/conventions/conversation-thread.md` (신규) 는 기존 node-output.md 의 Principle 4 / 8.2 / interaction payload 규격을 올바르게 참조하고 있으며, 배경·스코프 격리 근거가 명시되어 있어 결정의 연속성이 유지된다. 단, `spec/conventions/node-output.md` 자체에서 Principle 4.2 가 명시적으로 폐기한 `output.view` 래퍼가 Principle 8.2 참조 테이블에 그대로 남아있는 내부 모순이 발견됐다. 이 항목은 구현자가 Principle 4.2/4.3 과 8.2 를 동시에 읽을 때 혼동을 유발할 수 있어, 구현 착수 전 수정이 필요하다.

### 위험도

**LOW** — Critical 수준의 기각 대안 재도입은 없으나, `output.view` 내부 모순(WARNING)은 presentation 노드 구현 시 직접적인 오류 원인이 될 수 있으므로 착수 전 정정을 권장한다.