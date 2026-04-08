## 발견사항

---

### **[WARNING]** `_turnDebugHistory`의 민감 데이터 노출 위험
- **위치**: `spec/4-nodes/3-ai-nodes.md` — 신규 추가된 `_turnDebugHistory` 섹션
- **상세**: `requestPayload`에 전체 `messages`, `tools` 배열이 포함되어 있어 시스템 프롬프트, 도구 설정, 대화 이력 전체가 실행 결과에 포함된다. 이 데이터에 대한 접근 제어 정책이 스펙에 명시되어 있지 않다. 일반 사용자가 이 필드에 접근 가능할 경우 시스템 프롬프트(내부 운영 정보), RAG 검색 결과, 도구 호출 내용 등이 노출된다.
- **제안**: 스펙에 접근 제어 정책 명시 필요. 예: `_turnDebugHistory`는 워크플로우 소유자/관리자 권한에서만 조회 가능하도록 제한. API 응답에서 기본 제외(`?debug=true` 쿼리 파라미터로만 포함)하거나, 별도 디버그 전용 엔드포인트로 분리.

---

### **[WARNING]** 사용자 입력 `condition.prompt`의 LLM 프롬프트 직접 주입
- **위치**: `spec/4-nodes/3-ai-nodes.md` — 조건 도구 등록 섹션, `toolOverrides.toolDescription`
- **상세**: `condition.prompt`가 검증·새니타이징 없이 LLM 도구의 `description`으로 직접 사용된다. 악의적인 사용자가 프롬프트를 조작하여 LLM 동작을 변경하거나(프롬프트 인젝션), 시스템 지시를 무효화하거나, 조건 외 포트로 강제 라우팅을 유도할 수 있다. `toolOverrides.toolDescription`도 동일한 위험이 있다.
- **제안**: `condition.prompt` 저장 시 기본 서버사이드 새니타이징 적용. 스펙에 이미 2,000자 제한이 추가됐으나, 주입 패턴(예: "Ignore previous instructions", `\n\n` 구분자 악용)에 대한 필터링 또는 LLM 레이어에서의 도구 설명 이스케이핑 정책 명시 필요.

---

### **[INFO]** 에러 코드가 내부 시스템 상태 노출
- **위치**: `spec/4-nodes/3-ai-nodes.md` — `error` 포트 출력 구조
- **상세**: `error.code` 필드에 `LLM_TIMEOUT | LLM_API_ERROR | LLM_RATE_LIMIT` 등 내부 오류 분류가 엔드유저에게 직접 전달된다. Rate limit 정보는 공격자가 API 호출 한도를 파악하는 데 활용될 수 있다.
- **제안**: 사용자 대면 에러 메시지와 내부 에러 코드를 분리. 내부 코드는 서버 로그에만 기록하고, 클라이언트에는 일반화된 메시지(`EXECUTION_ERROR` 등) 전달 고려.

---

### **[INFO]** `endReason` enum의 `timeout` 값과 포트 구조 불일치
- **위치**: `spec/4-nodes/3-ai-nodes.md` — `endReason` enum 정의
- **상세**: `endReason` enum에 `timeout`이 여전히 유효한 값으로 존재하지만 `timeout` 포트는 제거되어 `error` 포트로 통합됐다. 주석(`> 참고: ...`)으로 설명되어 있으나, 구현 시 라우팅 로직에서 이 불일치가 혼선을 유발할 수 있으며 잘못된 포트 라우팅으로 이어질 수 있다.
- **제안**: `endReason` 값을 포트 구조와 완전히 일치시키거나, `timeout`을 내부 값으로만 사용하고 외부 출력 시 `error`로 변환하는 로직을 명시적으로 스펙화.

---

### **[INFO]** Rate limit 오류의 `error` 포트 통합으로 모니터링 가시성 저하
- **위치**: `prd/6-phase2-ai.md`, `prd/3-node-system.md` — ND-AG-19
- **상세**: timeout과 rate limit을 `error` 포트로 통합하면 워크플로우 실행 결과에서 rate limit 발생 여부를 구분하기 어려워진다. 남용(abuse) 탐지나 비용 모니터링 시 `error.code`를 파싱해야만 구분 가능하다.
- **제안**: 실행 통계/로그 레벨에서 rate limit 이벤트를 별도 카운터로 추적하는 요구사항 추가 고려.

---

## 요약

이번 변경은 도구 이름 명명 규칙 개선(`cond_`/`tool_` 접두사 + UUID sanitize)과 포트 구조 단순화가 주 내용으로, 전반적인 보안 설계 방향은 양호하다. 그러나 새로 추가된 `_turnDebugHistory` 기능이 시스템 프롬프트를 포함한 LLM 전체 컨텍스트를 출력에 포함하면서 접근 제어 정책이 스펙에 누락된 점이 가장 큰 위험이며, 사용자 정의 `condition.prompt`가 LLM 도구 설명으로 직접 주입되는 구조는 프롬프트 인젝션 벡터가 될 수 있어 입력 검증 정책 명시가 필요하다.

## 위험도

**MEDIUM**