## 발견사항

---

**[WARNING]** Multi Turn 0-조건 케이스의 포트 누락
- 위치: `spec/4-nodes/3-ai-nodes.md` — 포트 섹션, "조건이 0개인 경우 (하위 호환)"
- 상세: Multi Turn + 조건 0개일 때 `out` 포트만 제공한다고 명시. 하지만 이 경우 `user_ended`, `max_turns`, `error` 포트도 없으므로, 사용자가 대화를 종료하거나 max_turns에 도달하거나 LLM 오류가 발생했을 때 어떤 포트로 라우팅되는지 정의되어 있지 않음. `out` 하나만으로는 종료 사유를 구분할 수 없음.
- 제안: 하위 호환 모드에서도 `error`, `user_ended`, `max_turns` 포트를 포함하거나, `out` 포트가 모든 종료 사유를 수용함을 명시. 또는 0-조건 Multi Turn을 지원하지 않음을 명시.

---

**[WARNING]** `endReason: "timeout"` 과 포트 구조 간 불일치
- 위치: `spec/4-nodes/3-ai-nodes.md` — Multi Turn `error` 포트 출력 구조, `endReason` enum 설명
- 상세: `endReason` enum에 `timeout`이 여전히 유효한 값으로 포함되고 (`endReason: "timeout | error"`), 별도 주석으로 "timeout은 여전히 유효한 값"이라고 설명함. 하지만 `timeout` 전용 포트는 삭제되고 `error` 포트로 통합됨. 구현자가 `endReason == "timeout"`을 받았을 때 라우팅 로직에서 혼란을 겪을 수 있음. 두 가지 오류 원인(`timeout`과 `error`)이 동일 포트로 나오는데 enum 값은 여전히 분리되어 있음.
- 제안: `endReason` enum을 `condition | user_ended | max_turns | error`로 단순화하거나, `timeout`은 `error`의 하위 개념임을 `code` 필드(`LLM_TIMEOUT`)로만 구분한다고 명확히 기술하고 `endReason`에서 제거.

---

**[WARNING]** `ToolOverride.toolName`에 접두사 규칙 미적용
- 위치: `spec/4-nodes/3-ai-nodes.md` — ToolOverride 구조 섹션
- 상세: `toolOverrides[].toolName`을 설정하면 사용자가 직접 도구 이름을 지정할 수 있음. 신규 규칙(`tool_` 접두사)이 override된 이름에도 적용되는지 불명확함. 사용자가 임의 이름을 입력하면 `cond_`로 시작하는 조건 도구 이름과 충돌하거나, LLM 오작동 방지 목적의 접두사 규칙을 우회할 수 있음.
- 제안: override 시에도 `tool_` 접두사를 자동 적용하거나, 예약된 접두사(`cond_`, `tool_`) 사용 제한 규칙을 유효성 검증 섹션에 추가.

---

**[WARNING]** `sanitizeId` 함수 미정의 — LLM API 이름 길이 제한 미고려
- 위치: `spec/4-nodes/3-ai-nodes.md` — 도구 이름 규칙 섹션
- 상세: UUID를 sanitize하여 `-`를 `_`로 치환하면 `tool_xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx` 형태로 약 41자. OpenAI function calling API는 함수명 최대 64자 제한이 있어 단독으로는 통과하지만, 일부 LLM 프로바이더는 더 짧은 제한을 가질 수 있음. 또한 예시(`tool_abc1234_5678_...`)가 전체 UUID가 아닌 일부만 표시되어 실제 생성 형식이 불분명함.
- 제안: 전체 UUID 사용 예시 추가 및 최대 길이 보장 방법(예: UUID 앞 N자만 사용 + 충돌 방지 해시) 또는 "표준 UUID v4 전체 sanitize" 명시.

---

**[INFO]** 유효성 검증 규칙의 `timeout` 예약 포트 ID 잔존
- 위치: `spec/4-nodes/3-ai-nodes.md` — 유효성 검증 규칙 섹션
- 상세: `id`가 예약된 포트 ID(`out`, `in`, `timeout`, `error`, `user_ended`, `max_turns`)와 충돌 불가라고 명시되어 있으나, `timeout` 포트는 이번 변경으로 삭제됨. 기능적 문제는 없으나 삭제된 포트가 예약어 목록에 남아 있어 혼란 유발 가능.
- 제안: 예약 포트 목록에서 `timeout` 제거: `out`, `in`, `error`, `user_ended`, `max_turns`

---

**[INFO]** ND-AG-13의 종료 조건 설명과 실제 포트 구조 간 미세 불일치
- 위치: `prd/3-node-system.md` ND-AG-13, `prd/6-phase2-ai.md` ND-AG-13
- 상세: ND-AG-13은 "최대 턴 수, **타임아웃**, 사용자 명시적 종료"를 종료 조건으로 열거하는데, 이번 변경으로 타임아웃은 전용 포트 없이 `error`로 통합됨. PRD 항목 자체는 수정되지 않아 "타임아웃"이 독립 종료 조건처럼 읽힘.
- 제안: ND-AG-13에 "(타임아웃은 error 포트로 통합)" 보충 또는 설명 문구 조정.

---

## 요약

이번 변경은 `timeout` 포트 제거 및 `error` 통합, 도구 이름 접두사 규칙 도입, 포트 순서 조정이라는 세 가지 일관된 목표를 가지며 PRD 두 문서와 Spec 문서 간 핵심 내용은 동기화되어 있음. 그러나 **Multi Turn + 조건 0개 케이스의 포트 구조 불완전**이 가장 중요한 문제로, 이 모드에서 `user_ended`, `max_turns`, `error` 이벤트 발생 시 라우팅 경로가 정의되지 않아 구현 시 임의 결정이 발생할 위험이 있음. 또한 `endReason` enum에 `timeout`이 잔존하여 포트 구조와의 논리적 불일치가 있으며, `ToolOverride.toolName`의 접두사 규칙 우회 가능성과 `sanitizeId` 함수의 구체적 명세 부재도 구현 오류로 이어질 수 있는 요소임.

## 위험도

**MEDIUM**