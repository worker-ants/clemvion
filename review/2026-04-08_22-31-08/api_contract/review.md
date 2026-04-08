### 발견사항

- **[WARNING]** 단일 턴 vs 다중 턴 조건 출력 스키마 불일치
  - 위치: `ai-agent.handler.ts` — `executeSingleTurn` (조건 반환부) vs `buildConditionOutput`
  - 상세: 단일 턴 조건 출력의 metadata 키는 `inputTokens` / `outputTokens`이지만, 다중 턴(`buildConditionOutput`)의 metadata 키는 `totalInputTokens` / `totalOutputTokens`입니다. 동일한 `port` + `data` 구조를 사용하면서 내부 스키마가 달라 다운스트림 노드가 조건 결과를 일관되게 소비할 수 없습니다.
  - 제안: `buildConditionOutput`을 단일 턴에서도 재사용하거나, 두 경로 모두 동일한 메타데이터 키(`inputTokens`/`outputTokens` 또는 `totalInputTokens`/`totalOutputTokens`)를 사용하도록 통일

- **[WARNING]** 도구 이름 규칙 Breaking Change
  - 위치: `ai-agent.handler.ts` — `buildTools` 메서드
  - 상세: 기존 `tool_${nodeId.substring(0, 8)}` → 전체 `nodeId` UUID로 변경되었습니다. LLM 히스토리나 외부 시스템에서 이전 도구 이름을 참조하던 저장된 워크플로우나 대화 세션은 도구 호출 이름 불일치로 실패할 수 있습니다.
  - 제안: 기존 `toolOverrides`에 저장된 `toolName`이 `tool_` 접두사 형식인 경우를 마이그레이션하거나, 변경 시 버전 정책 명시 필요

- **[WARNING]** `conditions` 배열 순서 의존적 우선순위 결정이 문서화되지 않음
  - 위치: `ai-agent.handler.ts` — `classifyToolCalls`
  - 상세: 여러 조건 도구가 동시에 호출될 때 `conditions` 배열의 낮은 인덱스가 우선 선택됩니다. 이 계약(배열 순서 = 우선순위)이 API 응답이나 설정 스키마에 문서화되지 않아 클라이언트가 예측하기 어렵습니다.
  - 제안: 조건 설정 스키마 또는 시스템 프롬프트 안내에 우선순위 정책 명시

- **[INFO]** `ai_agent` 노드 정의 기본 출력 포트 추가 (하위 호환)
  - 위치: `node-definitions/index.ts`
  - 상세: `timeout`, `error` 포트가 기본 정의에 추가되었습니다. 기존 `out` 포트는 유지되므로 기존 연결에 영향 없음. 추가적 포트이므로 하위 호환성 유지됩니다.

- **[INFO]** 조건 미충족 시 `single_turn` 모드의 출력 스키마에 `port` 필드 미포함
  - 위치: `ai-agent.handler.ts` — `executeSingleTurn` 정상 반환 경로
  - 상세: 조건 미충족 시 기존 `{ response, metadata }` 구조를 그대로 반환하고, `execution-engine.service.ts`에서 `'port' in resultObj` 판별로 라우팅을 구분합니다. 이 암묵적 구별 로직이 타입 시스템 밖에 존재하며 향후 유지보수 시 실수 가능성이 있습니다.
  - 제안: 핸들러 반환 타입을 명시적 판별 유니온(`{ kind: 'condition', port, data } | { kind: 'normal', response, metadata }`)으로 정의하여 계약을 타입으로 강제할 것을 권장

---

### 요약

이번 변경은 AI Agent 노드에 조건(Condition) 기반 포트 라우팅을 추가하는 내부 API 계약 확장입니다. 외부 HTTP API가 아닌 핸들러↔실행 엔진 간 내부 계약 변경이므로 공개 API 파괴는 없으나, 단일 턴과 다중 턴 조건 출력의 metadata 스키마 불일치, 도구 이름 규칙 변경(UUID 전체 사용)이 기존 저장 워크플로우나 다운스트림 소비 코드에 암묵적 파괴를 일으킬 수 있습니다. 반환 타입이 암묵적 shape 판별에 의존하는 구조도 계약의 명시성을 약화시킵니다.

### 위험도
**MEDIUM**