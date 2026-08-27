# API 계약(API Contract) 리뷰

## 변경 개요 (API 계약 관점 요약)

이번 변경(`masking-expression-egress-split`, C2 (a))은 `handler-output.adapter.ts`
(`adaptHandlerReturn`)에서 노드 `config` echo에 걸려 있던 storage-time 마스킹
(`maskSensitiveFields`)을 제거하고, 마스킹 책임을 REST(`redactStoredDataForResponse`)·
WS(`maskWireEnvelope`) 두 egress 지점에만 위임한다. REST 엔드포인트 URL·HTTP 메서드·
요청 파라미터·페이지네이션·인증/인가 게이트는 이 diff 에서 전혀 바뀌지 않는다 — 순수하게
**응답 payload 값의 마스킹 시점**만 이동한다.

## 발견사항

- **[INFO]** REST/WS 로 관찰되는 마스킹 결과는 이번 변경으로 바뀌지 않는다 (하위 호환성 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:49` (`config: r.config ?? {}`)
  - 상세: 종전에는 어댑터가 `maskSensitiveFields`(키 이름 완전일치, `****<last4>` 포맷)로 1차 마스킹한 뒤, 그 값이 다시 REST(`redactStoredDataForResponse`)·WS(`maskWireEnvelope`) 의 `deepRedactSecrets*`(키 패턴 정규식)를 통과해 `***` 로 2차 마스킹됐다. 이번 변경으로 어댑터의 1차 마스킹만 제거되고 2차(egress) 마스킹은 그대로이므로, **REST/WS 클라이언트가 최종적으로 관측하는 마스킹 포맷(`***`)·마스킹 대상 키 집합은 그대로**다. `codebase/backend/src/shared/utils/redact-stored-error.ts` 의 `redactStoredDataForResponse`/`redactNodeExecutionRow` 가 `outputData`(config 포함) 를, `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `maskWireEnvelope` 가 모든 WS emit envelope 를 커버함을 직접 확인했다. `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:66-71` 의 `outputData` OpenAPI 문서("자격증명으로 판별된 값은 마스킹되어 반환된다")도 이번 변경과 무관하게 그대로 정확하다 — DTO 갱신 불필요, breaking change 없음.
  - 제안: 없음 (양호). 안전성 근거로 남겨둠.

- **[WARNING]** 안전 불변식(egress 마스킹 키 축 ⊇ 어댑터 키 축)이 스키마/타입 레벨이 아니라 테스트·컨벤션에만 의존
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:20-42` (JSDoc) / `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:129` (`describe('DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets 의 키 축'`)
  - 상세: 이 PR 의 안전 주장 전체가 "`config`가 이제 DB 에 원문으로 저장되지만, 이를 반환하는 **모든** 경로가 egress 마스킹(REST `redactStoredDataForResponse` / WS `maskWireEnvelope`)을 통과한다"는 전제에 걸려 있다. 이 전제는 (a) 캐너리 테스트(`DEFAULT_SENSITIVE_KEYS ⊆ deepRedactSecrets`)로 키 집합 포함관계만 검증하고, (b) "이 경로들만 config 를 반환한다"는 사실은 코드 레벨 강제(예: 응답 직렬화 계층에서 강제 마스킹을 부착하는 인터셉터/데코레이터, 또는 `NodeExecution.outputData` 를 반환하는 모든 지점에 대한 정적 가드)가 아니라 사람이 읽는 JSDoc·spec 문서(`spec/conventions/egress-masking.md`, EIA §R17)로만 관리된다. 즉 향후 `config`/`outputData` 를 반환하는 새 엔드포인트(예: export, admin 조회, 감사 로그 API)가 두 egress 헬퍼를 거치지 않고 DB row 를 직접 직렬화하면 자격증명이 평문으로 노출되는데, 이를 막는 컴파일 타임/런타임 게이트가 없다. (이미 `spec/conventions/egress-masking.md:54` 와 `plan/in-progress/masking-expression-egress-split.md` 자체가 이 리스크를 인지하고 문서화했으나, API 계약 관점에서 재확인할 가치가 있어 기록한다.)
  - 제안: 신규 API 표면 추가 시 체크리스트(또는 lint 규칙)로 "`NodeExecution.outputData`/`Execution.error` 를 반환하는 신규 엔드포인트는 반드시 `redactStoredFieldsForResponse`/`redactNodeExecutionRow`/`maskWireEnvelope` 중 하나를 경유한다"를 강제하는 것을 고려. 현재로선 회귀는 아니며 이 diff 범위 밖.

- **[INFO]** 이 변경으로 `NodeExecution.outputData.config` 의 **DB 저장 값**이 마스킹본 → 원문으로 바뀐다 (API 응답과는 별개)
  - 위치: `spec/5-system/4-execution-engine.md:1558`, `spec/2-navigation/14-execution-history.md:471-477`
  - 상세: API 응답(REST/WS)의 계약(스키마·마스킹 정책)은 변하지 않지만, 저장소의 원본 데이터는 이제 자격증명을 원문으로 담는다. API 계약 자체의 문제는 아니지만, "API 가 반환하는 값" 과 "DB 가 보관하는 값"의 괴리가 커졌으므로 향후 이 데이터를 소비하는 어떤 API 표면이든 egress-only 원칙을 반드시 지켜야 한다는 계약상 의무가 강화됐다. spec 6개 문서(`spec/2-navigation/14-execution-history.md` R-5, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/node-output.md`, `spec/conventions/egress-masking.md`) 가 이번 PR 로 동기화되어 이 사실을 명문화했음을 확인했다 — 정합성 양호.
  - 제안: 없음 (정보 제공 목적). planner 턴에서 이미 처리 완료.

- **[INFO]** 인증/인가·페이지네이션·URL 설계·버전 관리·요청 검증 — 변경 없음
  - 위치: 해당 없음 (diff 에 컨트롤러·라우트·DTO 요청 스키마 변경 없음)
  - 상세: `GET /api/executions/:id` 의 워크스페이스 멤버(viewer 포함) 접근 정책은 이 PR 이전과 동일하게 유지되며(`spec/2-navigation/14-execution-history.md` 466번째 줄 인근 서술 그대로), 이 diff 는 라우트·DTO 요청 파라미터·페이지네이션 로직을 전혀 건드리지 않는다.
  - 제안: 없음.

- **[INFO]** 테스트가 실제 REST/WS 파이프라인이 아니라 유틸 함수(`deepRedactSecrets`) 직접 호출 수준에서 안전 주장을 검증
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` (예: `it('[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다 (안전 주장)'`, diff 상 158번째 줄 부근)
  - 상세: 새로 추가된 캐너리들은 `adaptHandlerReturn` 출력에 `deepRedactSecrets` 를 직접 걸어 안전성을 확인한다. 실제 컨트롤러 → 서비스 → DTO 직렬화를 거치는 통합/e2e 테스트로 최종 HTTP 응답을 확정하는 테스트는 이 diff 범위에 없다(다만 기존에도 없었던 것으로 보이며, 이 PR 이 새로 만든 갭은 아니다).
  - 제안: 별건으로, `GET /api/executions/:id` 에 config 내 자격증명 필드를 포함한 e2e 테스트가 있는지 확인하고 없으면 추가 검토.

## 요약

이번 변경은 REST/WS API 가 외부에 노출하는 응답 스키마·마스킹 포맷·URL·인증/인가·페이지네이션을 전혀 바꾸지 않으며, egress 마스킹 계층(REST `redactStoredDataForResponse`, WS `maskWireEnvelope`)이 어댑터 제거 이전과 동일하게 모든 노출 경로를 커버함을 직접 코드로 확인했다 — 클라이언트 관점에서는 breaking change 가 없다. 다만 DB 저장값이 원문으로 바뀌면서 API 계약의 안전성이 "모든 소비 경로가 egress 마스킹을 통과한다"는 전제에 더 강하게 의존하게 됐는데, 이 전제는 테스트 캐너리와 spec 문서로만 관리되고 스키마/코드 레벨로 강제되지 않는다는 점을 WARNING 으로 남긴다. spec 6개 문서 동기화·OpenAPI DTO 문서(`execution-response.dto.ts`)와의 정합성도 확인했으며 drift 는 없다.

## 위험도

LOW
