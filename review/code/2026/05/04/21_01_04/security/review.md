### 발견사항

- **[INFO]** `requestPayload` / `responsePayload` 비검증 통과
  - 위치: `llm-call-trace.ts:111–118` (`fromConversationMessages`)
  - 상세: 두 필드 모두 `unknown` 타입으로 수신되어 어떠한 구조 검증 없이 그대로 `LlmCallTrace`에 저장됨. 렌더링 계층이 이 값을 `innerHTML` 또는 `dangerouslySetInnerHTML`에 직접 삽입할 경우 XSS로 이어질 수 있음.
  - 제안: 렌더링 레이어에서 React의 기본 이스케이프를 우회하는 원시 HTML 렌더링이 없는지 확인. 이 함수 자체에서 검증을 추가할 필요는 없지만, 소비 측(Response/Request 탭 컴포넌트)이 항상 텍스트 노드로만 출력하는지 검토 필요.

- **[INFO]** 비신뢰 출처 데이터의 LLM API 요청/응답 노출
  - 위치: 전체 파일 — `requestPayload`, `responsePayload`
  - 상세: 이 트레이스는 LLM의 원시 요청·응답을 UI에 노출하는 디버깅용 컴포넌트임. 프롬프트 인젝션 페이로드나 민감한 시스템 프롬프트 내용(API 키, 내부 지침 등)이 포함될 경우 운영 환경 사용자에게 노출될 수 있음.
  - 제안: 이 탭이 인증된 내부 사용자 또는 개발자 모드에서만 접근 가능한지 확인. 프로덕션 빌드에서 접근 제어가 적용되어 있는지 상위 컴포넌트 레벨에서 점검 권장.

- **[INFO]** 타입 단언(`as`)을 통한 런타임 검증 생략
  - 위치: `llm-call-trace.ts:72–80`
  - 상세: `asRecord._turnDebugHistory as RawTurnDebugEntry[]`, `output._llmCalls as RawFlatCall[]` 등은 런타임 형태를 보장하지 않음. 악의적으로 조작된 서버 응답이 예상 밖 구조를 가져올 경우 런타임 오류가 발생하지만, 현재 코드는 오류를 조용히 흘려보냄.
  - 제안: 보안 위협보다는 방어적 코딩 문제에 가깝지만, 외부 입력이 들어오는 경로라면 Zod 등의 런타임 스키마 검증 도입을 검토.

---

### 요약

이번 변경은 도구 루프(tool loop)에서 동일 턴 내 여러 어시스턴트 호출이 모두 `callIndexInTurn: 0`을 공유하던 표시 버그를 `Map`으로 순번을 추적하여 수정한 것이다. 순수한 데이터 재구조화 유틸리티로, 신규 보안 취약점을 도입하지 않는다. 기존에도 존재하던 `requestPayload`/`responsePayload`의 무검증 통과 및 LLM 원시 데이터의 UI 노출 패턴이 여전히 유지되며, 이는 렌더링 레이어의 XSS 방어 여부와 접근 제어 정책에 의존한다.

### 위험도

**LOW**