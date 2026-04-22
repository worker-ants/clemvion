## 발견사항

### [WARNING] `get_node_schema` 도구의 응답 형식 비일관성 (2회차 캐시 응답)
- **위치**: `workflow-assistant-stream.service.ts`, `schemaCache` 처리 블록
- **상세**: 2회차 캐시 응답은 원본 결과를 spread(`...cached.result`)한 뒤 `warning`, `warningMessage`, `cached` 필드를 덧붙이는 방식. 원본 결과 형태에 따라 최종 응답 구조가 달라지므로, 고정된 스키마를 기대하는 소비자에게 예측 불가능한 응답이 올 수 있음. 반면 3회차 이상 하드스톱 응답(`ok:false, error`)은 타 에러 패턴과 일관됨.
- **제안**: 캐시 응답도 `{ ok: true, type, configSchema, warning, cached }` 처럼 명시적인 구조로 래핑해 스프레드 대신 고정 응답 형태를 보장할 것

### [WARNING] `finish` 도구의 에러 응답 판별자 추가 (사실상 breaking change)
- **위치**: `workflow-assistant-stream.service.ts`, `FinishGuardError` union 타입 / `evaluateReviewGuard`
- **상세**: `finish` 도구는 기존에 `PLAN_NOT_COMPLETE`만 반환했으나, 이제 `WORKFLOW_REVIEW_REQUIRED`도 반환. 기존 클라이언트(LLM 혹은 래핑 레이어)가 `finish` 에러 분기에서 `PLAN_NOT_COMPLETE`만 처리하도록 작성되어 있다면, 새 에러 코드는 무시되거나 잘못 처리됨. 시스템 프롬프트로 LLM 동작을 문서화했으나, 프론트엔드나 중간 레이어에서 `tool_result`를 별도로 파싱한다면 누락 위험 있음.
- **제안**: `finish` 응답을 소비하는 모든 레이어에서 `WORKFLOW_REVIEW_REQUIRED` 분기 처리 여부를 확인할 것

### [INFO] `ShadowResult`에 필드 추가 — 하위 호환성 유지
- **위치**: `shadow-workflow.ts`, `ShadowResult` 인터페이스
- **상세**: `knownTypes`, `suggestedType`, `repeatCount`, `hint` 모두 선택적 필드(optional). 기존 소비자가 이 필드를 무시해도 동작에 영향 없음. 추가 에러 코드(`UNKNOWN_NODE_TYPE`의 필드 풍부화, `LABEL_CONFLICT`의 `repeatCount`, `NODE_NOT_FOUND`의 `hint`)도 동일하게 비파괴적 확장.
- **제안**: 현재 설계 유지 — 이슈 없음

### [INFO] `buildReviewChecklist` 출력이 LLM tool_result로 직렬화됨
- **위치**: `review-workflow.ts`, `ReviewChecklistItem`
- **상세**: `data` 필드가 `unknown` 타입이라 직렬화 결과가 호출 경로마다 다른 형태. 현재 구현에서는 `UnresolvedFailureEntry[]`, `OrphanEntry[]` 등 구체 타입이 들어가지만 타입 시스템이 이를 보장하지 않음. LLM이 파싱하는 API 계약으로서는 예측 가능성이 낮아질 수 있음.
- **제안**: `data` 필드를 각 코드별 유니온 타입으로 좁히거나, 직렬화 전 스키마 검증을 추가하는 것을 고려

---

## 요약

이번 변경은 공개 HTTP REST API가 아닌 LLM 툴콜 프로토콜 계층의 변경이다. 대부분의 수정은 기존 필드에 선택적 필드를 추가하는 비파괴적 확장이며, 시스템 프롬프트를 통해 LLM에게 새 에러 코드의 처리 방법이 명시되어 있다. 주요 계약 위험은 두 가지다: (1) `finish` 도구가 반환하는 에러 유니온에 새 variant가 추가되어 기존 처리 코드에서 누락 가능성이 있고, (2) `get_node_schema` 캐시 응답이 스프레드 패턴으로 구성되어 응답 형태가 원본 결과에 의존적이다. 두 이슈 모두 내부 프로토콜 범위이고 테스트로 동작이 고정되어 있어 실제 위험은 제한적이다.

## 위험도

**LOW**