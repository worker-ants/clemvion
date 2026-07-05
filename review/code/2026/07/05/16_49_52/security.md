# 보안(Security) 코드 리뷰

## 대상
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx`

변경 성격: 순수 프런트엔드 리팩터. 실행 상세 페이지의 자체 구현 노드 패널
(Preview/Input/Output/Error 4탭 + 자체 `JsonViewer`)을 제거하고, 에디터
run-results 의 `ResultDetail` 컴포넌트(Preview/Input/Output/Config/LLM
Usage/Response/Request/References/Error 9탭 + 대화 인스펙터 + live waiting
상호작용)를 그대로 재사용하도록 교체했다. 백엔드 변경 없음, API 계약 변경
없음. 노출되는 데이터는 기존에 이미 `executionsApi.getById` 응답에 포함되어
있던 `nodeExecutions[].outputData`/`inputData`이며, 새로 추가된 서브탭들도 그
필드에서 파생 렌더링만 한다(신규 API 호출·신규 데이터 소스 없음).

## 발견사항

- **[INFO]** Config/LLM Request 페이로드 민감정보 마스킹은 서버 boundary 의존 — 프런트는 무방비
  - 위치: `ResultDetail` → `ConfigTabContent` (`result-detail.tsx:812-827`), `LlmInformationTab` → `RequestPane`/`ResponsePane` (`llm-information-tab.tsx:302-387`)
  - 상세: 새로 노출되는 Config/LLM Usage/Request/Response 탭은 `outputData.config` / `outputData.meta.turnDebug[].llmCalls[].requestPayload`/`responsePayload`를 가공 없이 그대로 `JSON.stringify` 렌더한다. 확인 결과 `config` 필드는 백엔드 `adaptHandlerReturn` (`codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:32-38`)에서 `maskSensitiveFields`로 이미 마스킹되어 DB에 저장되므로 이 경로는 안전하다. `requestPayload`(`ai-turn-executor.ts` 등)도 `model/messages/temperature/...` 형태로 구성되며 provider API 키 등 자격증명 필드를 포함하지 않는 것으로 확인했다. 다만 이 안전성은 **전적으로 서버 측 마스킹/구성 규율에 의존**하며 프런트 컴포넌트 자체에는 어떤 필터링/redaction 레이어도 없다. 향후 새 노드 핸들러가 `config`에 시크릿을 실수로 echo하거나, custom LLM provider 통합이 헤더/자격증명을 `requestPayload`에 포함시키면 이 화면이 즉시 그 값을 렌더한다 (기존에도 에디터 run-results 화면에 동일하게 존재하던 위험이며, 이번 diff가 신규로 만든 것은 아니다 — 노출 표면만 실행-히스토리 화면으로 확장됨).
  - 제안: `maskSensitiveFields` 커버리지에 대한 회귀 테스트(신규 핸들러가 `config`에 시크릿 필드를 넣으면 실패하는 계약 테스트)를 백엔드에 유지/보강하고, 프런트 쪽에도 방어적 2차 마스킹(alt-depth)을 두는 것을 defense-in-depth로 고려. 코드 변경을 요구하는 CRITICAL은 아님(기존 서버 계약이 이미 존재).

- **[INFO]** 노출 표면 확장 — 에디터 대비 실행-히스토리 화면의 접근 롤/컨텍스트 차이 미검증
  - 위치: `page.tsx` (전체), 특히 `NodeResultsTab` → `ResultDetail` 재사용부
  - 상세: 프롬프트 컨텍스트가 지적한 대로 "에디터 surface 대비 마스킹 parity"를 확인했다. 코드 서치 결과 `run-results` 디렉터리 어디에도 마스킹/redact 로직이 없으며(에디터·실행-히스토리 공통), 두 surface가 동일한 `NodeExecutionData.outputData`/`inputData`를 렌더하는 구조이므로 **parity는 유지된다** — 이번 변경이 실행-히스토리 화면에 에디터보다 더 많은 정보를 노출시키는 것은 아니다(오히려 정확히 동일한 컴포넌트로 통일). 단, 워크스페이스 역할별 페이지 접근 가드(이 실행 상세 페이지 자체를 볼 수 있는 최소 역할)는 이번 diff의 범위 밖이라 검증하지 못했다 — 기존에 이미 존재하던 정책이면 문제 없음.
  - 제안: 별도 확인 필요 시 workspace route guard(실행 히스토리 페이지 접근 최소 역할)가 에디터 페이지 접근 요건과 동일한지 별도 트랙에서 점검.

- **[INFO]** `JSON.stringify`/`dangerouslySetInnerHTML` 미사용 — XSS 벡터 없음
  - 위치: `JsonContent`/`ResponsePane`/`RequestPane` 등 모든 payload 렌더 지점
  - 상세: 모든 JSON payload는 React의 텍스트 노드(`{JSON.stringify(...)}`, `<pre><code>{formatted}</code></pre>`)로 렌더되며 `dangerouslySetInnerHTML`이나 raw HTML 삽입은 발견되지 않았다. React의 기본 이스케이핑으로 반사형 XSS 위험 없음. `openExternalLink` (버튼 URL 클릭) 경로는 이번 diff에서 로직 변경 없이 기존 함수를 그대로 재사용.
  - 제안: 없음 (안전).

- **[INFO]** 인증/인가 로직 미변경
  - 위치: `page.tsx` `canReRun` 사용부, adjacent/chain 조회
  - 상세: re-run 권한 판정(`canReRun`), 실행 조회 API 호출 방식, adjacent/chain 쿼리 등은 이번 diff에서 손대지 않았다. 신규 코드가 인증 우회나 권한 검증 누락을 추가하지 않았다.
  - 제안: 없음.

- **[INFO]** 에러 처리 — 민감정보 노출 없음
  - 위치: `executionQuery.isError` 분기, `execution.error?.message` 표시부
  - 상세: 이번 diff는 에러 표시 로직을 변경하지 않았다. 표시되는 `error.message`는 실행 엔진이 기록한 도메인 에러 메시지이며 스택트레이스 등 시스템 내부 정보를 노출하는 패턴은 발견되지 않았다(이 diff 범위 밖).
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 / 커맨드-SQL 인젝션 / 안전하지 않은 암호화 — 해당 없음
  - 상세: 이번 diff는 순수 UI 컴포넌트 배선(prop wiring) 변경으로, 신규 시크릿 리터럴, DB 쿼리, 커맨드 실행, 해시/암호화 코드가 전혀 포함되지 않는다.

## 요약

이번 변경은 실행 상세 페이지의 노드 패널을 에디터 run-results의 `ResultDetail` 컴포넌트로 통일하는 순수 프런트엔드 리팩터로, 백엔드·API·인증 로직에는 손을 대지 않았다. 새로 노출되는 Config/LLM Usage/Request/Response 서브탭이 다루는 데이터는 이미 API 응답에 포함되어 있던 `outputData`/`inputData`의 파생 뷰일 뿐이며, 신규 데이터 소스나 신규 권한 우회는 없다. 컨텍스트에서 우려한 "에디터 대비 마스킹 parity"는 실제로 두 surface가 동일 컴포넌트·동일 마스킹 계약(`maskSensitiveFields`, 서버 handler-output boundary)을 공유하므로 이번 diff로 인한 회귀는 없다고 판단한다. 다만 이 마스킹은 전적으로 서버 측 규율(신규 핸들러의 `config` echo, LLM 통합의 `requestPayload` 구성)에 의존하는 구조적 특성이 있어, 향후 새 노드/통합 추가 시 재확인이 필요한 잠재 리스크로 INFO 등급으로 기록한다. 코드 자체에서 인젝션·하드코딩 시크릿·인가 누락·XSS·안전하지 않은 암호화는 발견되지 않았다.

## 위험도

LOW
