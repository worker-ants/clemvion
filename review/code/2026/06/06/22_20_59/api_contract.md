# API 계약(API Contract) 리뷰 결과

## 발견사항

### 내부 서비스 간 계약 변경

- **[INFO]** `SearchWithMetaResult` 타입에 `unsearchable` 필드 추가 (optional)
  - 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` +164~+173
  - 상세: `unsearchable?: { kbId: string; reason: KbUnsearchableReason }[]` 를 optional 로 추가했다. 기존 호출자(`KbToolProvider`)는 필드 부재 시 기존 동작 그대로 유지되므로 하위 호환성 파괴 없음. `undefined` 일 때와 `[]` 일 때의 의미(검색가능 vs 빈 배열)를 코드 주석으로 명확히 구분("unsearchable 없으면 undefined, 있으면 해당 목록")하고 있어 계약 모호성은 낮다.
  - 제안: 현재 상태 유지 가능. 다만 향후 호출자가 늘어날 경우 `unsearchable: []`(빈 배열)과 `unsearchable: undefined`(해당 없음)의 의미 차이를 타입 문서에 명시적으로 고정하는 것을 권장.

- **[INFO]** `KbSearchDiagnostic` 인터페이스에 `unsearchable?: boolean` 필드 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` +429
  - 상세: optional 추가로 기존 구현체 영향 없음. 진단 목적 필드이므로 외부 클라이언트에는 직접 노출되지 않는다.

- **[INFO]** `RagDiagnostics.skipReason` 유니온에 `'kb_unsearchable'` 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` +366
  - 상세: 기존 `'empty_kb_list' | 'no_results'` 에 `'kb_unsearchable'` 추가. 이 필드가 외부 API 응답으로 직렬화되어 노출되는지 확인이 필요하다. 내부 진단 메타데이터라면 클라이언트 breaking change 아님. 그러나 외부 REST/WebSocket 응답 스키마에 포함된다면 새 열거값 추가는 클라이언트 열거 파서에서 unknown value 처리 이슈 가능.
  - 제안: `skipReason` 이 외부 응답 body 에 포함되는지 확인. 포함된다면 API 변경사항으로 문서화 또는 버전 태그 검토.

### tool_result 응답 형식 — 내부 LLM 도구 계약

- **[INFO]** `status: 'not_searchable'` 봉투 신규 도입
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` +554~+568
  - 상세: KB tool 의 `tool_result` 응답에 `status`, `reason`, `note`, `results` 필드를 포함하는 새 응답 구조가 도입됐다. 이 봉투는 LLM(AI 모델)이 소비하는 내부 tool 결과이며, 공개 HTTP API 엔드포인트가 아니다. 기존 `search_failed` 에러 봉투와 명확히 구분(`error` 필드 미포함)된 graceful 신호로 설계되어 있다.
  - 제안: 현재 설계 적절. `note` 필드의 영어 고정 문자열이 LLM 프롬프트 인젝션 의도이므로 i18n 대상이 아닌 것이 맞다.

### 프론트엔드 API 응답 소비

- **[INFO]** `knowledge-bases` 목록 API 응답에 `reembedStatus`, `embeddingDimension` 필드 소비
  - 위치: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` +869~+889
  - 상세: 프론트엔드가 목록 API 응답에서 `reembedStatus`와 `embeddingDimension` 를 직접 소비한다. 테스트 픽스처(파일 8)에서 `reembedStatus: "idle"` 을 기본값으로, `embeddingDimension: null` 을 검색 불가 신호로 사용하고 있다. 이 두 필드가 백엔드 `/knowledge-bases` 목록 API 응답 스키마에 실제로 포함되어 있는지 확인이 필요하다.
  - 제안: 백엔드 `KnowledgeBase` DTO / 직렬화 레이어에 `reembedStatus` 와 `embeddingDimension` 이 명시적으로 포함되어 있는지 검토. 테스트가 mock 기반이므로 실제 API 응답 스키마 불일치 가능성이 존재한다(이 PR 변경에서 백엔드 DTO/컨트롤러 레이어 변경은 보이지 않음).

## 요약

이번 변경은 KB 재임베딩 상태를 검색 서비스 및 에이전트 진단 계층에 전파하는 내부 서비스 간 계약 확장이다. 모든 신규 필드가 optional 로 추가되어 하위 호환성이 유지되며, 외부 공개 HTTP REST 엔드포인트의 직접 변경은 이 diff 범위 내에서 발견되지 않는다. 주요 주의 사항은 두 가지다: (1) `RagDiagnostics.skipReason` 의 새 열거값(`kb_unsearchable`)이 외부 클라이언트에 노출되는 응답 필드인지 확인이 필요하고, (2) 프론트엔드가 소비하는 `reembedStatus`·`embeddingDimension` 필드가 백엔드 목록 API DTO에 정식으로 포함되어 있는지 DTO/컨트롤러 레이어 검증이 필요하다. 전반적으로 API 계약 관점에서 위험도는 낮다.

## 위험도

LOW

---
STATUS=success ISSUES=4
