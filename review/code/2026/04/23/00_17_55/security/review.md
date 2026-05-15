## 보안 코드 리뷰 결과

### 발견사항

---

- **[WARNING]** `originalRequest` 반사를 통한 간접 프롬프트 인젝션 위험
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` 반환값
  - 상세: `WORKFLOW_REVIEW_REQUIRED` 응답에 `originalRequest` (= `dto.content`, 사용자 원문 그대로)가 포함되어 LLM tool result history로 재주입된다. 악의적 사용자가 요청 문자열에 `\n\nSYSTEM: Ignore prior instructions…` 형태의 내용을 심으면, 이 값이 다음 라운드에서 LLM에게 신뢰할 수 있는 시스템 응답처럼 전달되는 간접 프롬프트 인젝션 경로가 형성된다.
  - 제안: `originalRequest`를 tool result에 포함하기 전 길이 상한(`MAX_ORIGINAL_REQUEST_LEN`)을 적용하거나, 프롬프트에서 이미 제공되므로 아예 제외를 고려. 꼭 필요하다면 별도 구조 필드(`{ text: ... }`)로 감싸 LLM이 지시문과 사용자 데이터를 혼동하기 어렵게 구분.

---

- **[WARNING]** 노드 label이 LLM 컨텍스트에 그대로 포함되는 2차 프롬프트 인젝션 경로
  - 위치: `review-workflow.ts` — `collectOrphans`, `collectUnmentionedPendingUserConfig` / `shadow-workflow.ts` — `addEdge` 힌트 생성
  - 상세: `ORPHAN_NODES`, `PENDING_USER_CONFIG_UNMENTIONED` 체크리스트 항목과 `NODE_NOT_FOUND` 힌트에 사용자가 편집 가능한 노드 `label` 값이 그대로 포함된다. 공격자가 노드 label에 LLM 지시문 문자열을 삽입하면 tool result를 통해 LLM 동작을 조작할 수 있다. `addEdge`의 힌트는 `JSON.stringify`로 이스케이프하지만, 체크리스트 data 필드는 직렬화 방식이 호출부(service)에 위임되어 있어 일관성이 없다.
  - 제안: 체크리스트 `data`에 노드 label을 포함할 때는 항상 JSON 직렬화를 보장하거나, label 길이 상한(예: 200자)을 schema 레벨에서 적용. 힌트 생성 시 이미 `JSON.stringify`를 사용하는 `addEdge` 패턴을 다른 경로에도 일관 적용.

---

- **[WARNING]** `attemptedType` 미검증 반사로 인한 힌트 문자열 인젝션
  - 위치: `shadow-workflow.ts` — `buildUnknownNodeTypeResult` (라인 약 435~480)
  - 상세: LLM이 제공한 `attemptedType`이 길이 검증 없이 템플릿 문자열 힌트에 삽입된다. `\n`, `\r` 등 제어 문자나 매우 긴 문자열이 그대로 포함될 경우, LLM이 응답을 파싱하는 방식에 따라 영향을 줄 수 있다. `closest`(Levenshtein 결과)는 `knownNodeTypes` 중 하나이므로 신뢰할 수 있지만, `attemptedType` 자체는 신뢰 불가 입력이다.
  - 제안: `attemptedType`을 힌트에 삽입하기 전 길이 상한(예: 64자) 적용 및 제어 문자 제거. 이미 `JSON.stringify` 기반 이스케이프를 사용하는 부분과 일관성 확보.

---

- **[INFO]** Levenshtein 함수 — 길이 미검증으로 인한 DoS 잠재성
  - 위치: `shadow-workflow.ts` — `levenshtein` 함수, `closestKnownType`
  - 상세: `attemptedType`이 매우 긴 문자열(수천 자)일 경우 `O(|attemptedType| × |candidate|)` 연산이 등록된 타입 수(최대 수십 개)만큼 반복된다. LLM turn 당 호출이므로 직접적인 외부 DoS는 아니지만, LLM이 반복 오류 루프에 빠지면 서비스 비용 증가로 이어질 수 있다.
  - 제안: `addNode` 진입 초반에 `type` 문자열 길이 상한(예: 128자) 검증 추가. 이미 `INVALID_ARGUMENTS` 패턴이 있으므로 일관되게 처리 가능.

---

- **[INFO]** `schemaCache` 키가 LLM 제공 문자열 — 맵 크기 암묵적 상한 없음
  - 위치: `workflow-assistant-stream.service.ts` — `schemaCache` 선언
  - 상세: `schemaCache`는 turn 범위로 선언되어 턴 종료 시 GC 대상이 된다. 하지만 단일 턴 내 LLM이 수십 가지 서로 다른 type 값을 제출하면 Map이 무한 성장할 수 있다. `MAX_TOOL_LOOP_ROUNDS(50)` 상한이 간접 방어선이 되지만 명시적 캐시 크기 상한은 없다.
  - 제안: `schemaCache.size > SCHEMA_CACHE_MAX_TYPES` 조건으로 캐시 항목 수를 제한.

---

### 요약

이번 변경 코드는 전통적인 웹 보안 취약점(SQL 인젝션, XSS, 하드코딩 시크릿 등)은 없으며, 설계 전반은 경계 조건을 잘 처리하고 있다. 주요 위험은 **AI 특화 보안 영역**으로, 사용자 원문(`originalRequest`)과 노드 label이 LLM tool result를 통해 재주입되는 **간접 프롬프트 인젝션** 경로가 핵심이다. 특히 `WORKFLOW_REVIEW_REQUIRED` 응답에 원본 사용자 입력이 그대로 포함되는 구조는, 악의적 사용자가 LLM 동작을 조작하기 위해 요청 내에 지시문을 심을 수 있는 현실적인 공격 경로다.

### 위험도

**MEDIUM**