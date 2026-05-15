## 성능 코드 리뷰 결과

> **대상**: PRD/Spec 문서 변경 (구현 코드 없음) — 설계 결정이 런타임 성능에 미치는 영향을 분석합니다.

---

### 발견사항

- **[INFO]** `timeout` 포트 → `error` 포트 통합
  - 위치: `spec/4-nodes/3-ai-nodes.md` — Single/Multi Turn 종료 조건
  - 상세: 타임아웃과 일반 LLM 오류를 동일 포트로 통합. 구현 시 `endReason` 필드로 구분해야 하므로 포트 라우팅 분기 로직은 단순화되나, 클라이언트가 `error` 포트 수신 후 `endReason`을 파싱해야 하는 추가 연산이 발생.
  - 제안: `error` 포트 핸들러에서 `code` 필드(`LLM_TIMEOUT | LLM_RATE_LIMIT | LLM_API_ERROR`) 기반 분기 처리를 명확히 문서화할 것. 런타임 성능 영향은 미미.

- **[INFO]** 도구 이름 정제(sanitize) 연산 추가
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 도구 이름 규칙 (`cond_` / `tool_` 접두사)
  - 상세: UUID의 `-`를 `_`로 치환하는 sanitize 연산이 매 LLM 호출 시 도구 목록 생성 단계에서 발생. UUID는 36자 고정이므로 O(1) 연산이나, `toolNodeIds` + `conditions` 배열 전체에 대해 매 호출마다 재계산됨.
  - 제안: 구현 시 sanitize 결과를 노드 설정 저장 시 1회 계산하여 캐싱(예: `_toolName` 파생 필드)하고 LLM 호출 시 재사용. 대규모 tool 목록(최대 20 조건 + N개 일반 도구)에서 반복 연산 방지.

- **[INFO]** `_turnDebugHistory` 페이로드 크기
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 디버그 데이터 섹션 (신규 추가)
  - 상세: `requestPayload`와 `responsePayload`를 턴별 LLM 호출 단위로 전체 저장. Multi Turn 모드에서 `maxTurns=20`, 턴당 복수 LLM 호출(function calling 반복) 시 `messages` 배열이 누적되어 페이로드가 기하급수적으로 증가. 예: 20턴 × 3 LLM 호출 × (누적 messages 배열) → 메모리/직렬화 비용 급증.
  - 제안: `requestPayload.messages`는 중복 저장되므로 `_turnDebugHistory`에는 **해당 턴에서 추가된 메시지 델타**만 저장하고, 전체 히스토리는 별도 `messages` 필드에서 참조하는 구조로 스펙 개정 권장. 또는 `_turnDebugHistory`를 별도 스토리지(디버그 로그)에 비동기 기록하고 실행 결과 응답에서 제외하는 방안 검토.

- **[INFO]** Multi Turn 조건 0개 — `out` 포트 하위 호환 분기
  - 위치: `spec/4-nodes/3-ai-nodes.md` — 조건 0개 케이스
  - 상세: Multi Turn 조건 0개 시 `out` 포트만 제공(하위 호환). 런타임 포트 라우팅 로직에서 `conditions.length === 0` 체크가 모드별로 다른 포트 집합을 반환해야 하므로 조건 분기 증가. 성능보다는 유지보수 복잡도 이슈.
  - 제안: 구현 시 포트 집합 계산 함수를 단일 pure function으로 추출하여 테스트 커버리지 확보.

---

### 요약

변경된 파일은 구현 코드가 아닌 PRD/Spec 문서이므로 직접적인 런타임 성능 이슈는 없다. 다만 설계 결정 중 `_turnDebugHistory`의 누적 `requestPayload` 저장 방식이 Multi Turn 장기 대화 시 메모리 및 직렬화 비용 측면에서 잠재적 위험이 있으며, 도구 이름 sanitize 연산의 캐싱 여부는 구현 단계에서 명시적으로 처리해야 한다. `timeout`→`error` 포트 통합은 라우팅 로직을 단순화하여 오히려 성능에 긍정적이다.

### 위험도

**LOW**