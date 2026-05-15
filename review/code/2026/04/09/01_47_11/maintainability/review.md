### 발견사항

- **[INFO]** `endReason` 열거값과 포트 존재 여부 간 불일치
  - 위치: `spec/4-nodes/3-ai-nodes.md` — `endReason` enum 정의 및 주석
  - 상세: `endReason` enum에 `timeout`이 여전히 포함되어 있으나 `timeout` 포트는 제거됨. 주석(`> 참고: endReason에서 timeout은 여전히 유효한 값이지만...`)으로 설명했지만, enum 값과 실제 라우팅 포트가 불일치하는 상태를 "유효함"으로 문서화하면 구현자가 혼란을 겪을 수 있음. `timeout`이 `error` 포트로 통합된다면 `endReason` enum에서 `timeout`을 제거하거나, 혹은 내부 상태값(포트가 아닌 데이터 필드)임을 명확히 구분해야 함.
  - 제안: `endReason`을 "내부 종료 사유 코드"와 "라우팅 포트"로 명확히 분리. 예: `exitPort` (라우팅 결정) vs `endReason` (출력 데이터 내 상세 사유). 또는 enum에서 `timeout`을 제거하고 `error` 케이스의 `error.code`로만 구분.

- **[WARNING]** 조건 0개일 때 Multi Turn 포트 구조가 Single Turn과 비대칭
  - 위치: `prd/3-node-system.md` ND-AG-24, `spec/4-nodes/3-ai-nodes.md` 공통 섹션
  - 상세: Single Turn 조건 0개 → `out` + `error`, Multi Turn 조건 0개 → `out`만 제공. Multi Turn에서 오류 발생 시 `error` 포트 없이 `out`만 있다면 오류를 처리할 수 없음. "하위 호환"을 위해 의도적으로 `error`를 생략한 것인지 불명확.
  - 제안: Multi Turn 조건 0개 케이스에서도 `out` + `user_ended` + `max_turns` + `error`를 제공하거나, 적어도 `error` 포트를 포함시키는 것을 명시. 하위 호환 목적이라면 구체적으로 어떤 기존 동작을 유지하는지 기술.

- **[INFO]** PRD와 Spec 간 조건 유효성 검증 규칙 누락
  - 위치: `prd/3-node-system.md`, `prd/6-phase2-ai.md`
  - 상세: Spec(`3-ai-nodes.md`)에는 최대 20개 조건, `prompt` 최대 2,000자, `reason` 최대 500자 잘림 처리 등의 유효성 검증 규칙이 추가되었으나, PRD 파일에는 해당 내용이 없음. PRD와 Spec이 동기화되지 않아 PRD만 읽는 독자는 이 제약을 알 수 없음.
  - 제안: PRD에 "유효성 제약은 Spec을 참조"라는 명시적 링크를 추가하거나, 핵심 제약(최대 조건 수 등)을 PRD에도 간략히 기재.

- **[INFO]** `sanitizeId` 함수 정의 부재
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 도구 이름 규칙 섹션
  - 상세: `cond_{sanitizeId(condition.id)}` 표기에서 `sanitizeId`가 "UUID 내 `-` 등 비영숫자 문자를 `_`로 치환"이라고 설명되어 있으나, 결과 예시(`cond_abc1234_5678_...`)와 정제 규칙이 완전히 일치하는지 검증이 필요함. UUID는 32개 16진수 문자 + 4개 하이픈 구조이므로 치환 후 길이가 36자가 되어 LLM API의 함수명 길이 제한(OpenAI: 64자)에 근접할 수 있음.
  - 제안: 최종 도구 이름의 최대 길이와 LLM API별 제한을 명시. 필요 시 UUID를 단축(예: 앞 8자만 사용 + 충돌 방지 로직)하는 정책을 Spec에 기술.

---

### 요약

이번 변경은 `timeout` 포트 제거 및 도구 이름 접두사(`cond_`/`tool_`) 도입이라는 명확한 설계 결정을 세 문서에 일관되게 반영한 점에서 유지보수성이 개선되었다. 그러나 `endReason` enum에 더 이상 존재하지 않는 `timeout` 포트에 대한 값이 잔존하여 구현자 혼란 요소로 남아 있고, Multi Turn 조건 0개 케이스의 포트 구조가 하위 호환을 이유로 `error` 포트를 누락한 점은 오류 처리 경로를 모호하게 만든다. 전반적으로 문서 간 일관성은 양호하나, 내부 상태값(data field)과 라우팅 포트를 명확히 분리하는 용어 정리가 추가로 필요하다.

### 위험도

**LOW**