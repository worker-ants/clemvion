### 발견사항

- **[INFO]** `GET /api/external/executions/:executionId`(§5.3) 응답 스키마는 `nodeOutput`/`result`/`error` 를 `additionalProperties: true` 열린 map 으로 선언(`execution-status-response.dto.ts`)하고 있어, 이번 diff 가 `llmCalls` 필드를 깊이 무관으로 제거해도 **선언된 OpenAPI 계약과의 형태 불일치는 없다** — 확인 완료, positive finding
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (`nodeOutput`/`result`/`error` 필드, `type: 'object', additionalProperties: true`)
  - 상세: `llmCalls` 는 애초에 DTO 가 명시적으로 선언한 필드가 아니라 열린 map 내부에 우연히 실리던 debug 값이었다. 이번 수정으로 그 값이 빠져도 Swagger/OpenAPI 스키마 자체는 변경되지 않으므로, 스키마 기반 코드젠 클라이언트가 깨질 위험은 없다.
  - 제안: 조치 불요.

- **[INFO]** REST(`getStatus`)와 WS fanout(SSE/webhook/chat-channel)이 이번 diff 로 **같은 유틸(`stripExternalOnlyFields`)** 을 공유하게 되어, 종전에 갈라져 있던 두 표면의 응답 계약이 일관된 상태로 수렴했다 — API 응답 형식 일관성 관점에서 긍정적
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`(`stripAndRedact`, `getStatus` 세 출구: waiting `nodeOutput`/terminal `result`/terminal `error`), `codebase/backend/src/modules/websocket/websocket.service.ts`(`emitExecutionEvent`/`emitNodeEvent`)
  - 상세: 수정 전에는 SSE/webhook/chat-channel 은 top-level(depth-1) 만 strip, REST 스냅샷은 `deepRedactSecrets`(값 마스킹)만 걸려 있어 **같은 `iext_*`/`itk_*` 토큰으로 접근하는 같은 데이터가 표면마다 다른 수준으로 보호**되고 있었다(REST 쪽은 사실상 무방비). 이번 diff 로 두 표면 모두 필드명 기준 깊이 무관 strip + 값 마스킹을 동일하게 적용해, 같은 execution 을 REST 로 보든 SSE 로 보든 응답에 `llmCalls` 원본 프롬프트가 실리지 않는다는 계약이 표면 간 대칭이 됐다.
  - 제안: 없음(positive finding).

- **[INFO]** `null`/키-생략 부재 표현 관례가 이번 응답 형태 변경에서도 그대로 보존된다 — 회귀 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`stripAndRedact` 정의부: `if (value === null || value === undefined) return null;`, 및 waiting 분기 `stripAndRedact(nodeExec.outputData) ?? {}`, terminal 분기 `stripAndRedact(execution.outputData)`)
  - 상세: 종전 `deepRedactSecrets(nodeExec.outputData ?? {})` / `deepRedactSecrets(execution.outputData ?? null)` 이 갖던 null-fallback 의미(waiting 은 `{}`, terminal `result`/`error` 는 `null`)가 새 `stripAndRedact` 호출부에서도 동일하게 유지된다. DTO 의 `result?: Record<string, unknown> | null` / `error?: ... | null` 타입과도 어긋나지 않는다.
  - 제안: 없음(positive finding).

- **[INFO]** §5.3(`GET /api/external/executions/:executionId`) 정본 응답 예시/설명 블록 자체에는 `llmCalls` strip 이 적용된다는 인라인 언급이 없고, 그 사실은 문서 하단 `## Rationale`(§R17 부근, `> **값 마스킹만으로는 부족하다**...` 단락)에만 기술돼 있다 — §5.2 SSE `waiting_for_input`/`ai_message` 절은 각각 인라인으로 명시하는 것과 비대칭
  - 위치: `spec/5-system/14-external-interaction-api.md:433`(`### 5.3 단발 상태 조회`) 절의 `구현 상태 (V1)` 콜아웃 vs. 동일 파일 786행 부근(`### 5.2` — `**단, debug 전용 \`llmCalls\` 필드...**`) 및 1383행 부근(`## Rationale`)
  - 상세: API 소비자가 §5.3 만 읽고 §Rationale 까지 내려가지 않으면 "REST 스냅샷도 `llmCalls` 가 strip 된다"는 계약을 놓칠 수 있다. 동작 자체는 이미 올바르게 구현·테스트됐고 spec 본문(Rationale)에도 서술은 존재하므로 CRITICAL/WARNING 급 결함은 아니지만, §5.2 가 채택한 "정본 응답 블록 옆에 인라인 콜아웃" 패턴을 §5.3 에도 대칭 적용하면 발견성이 좋아진다.
  - 제안: §5.3 의 `구현 상태 (V1)` 콜아웃 또는 JSON 예시 바로 아래에 §5.2 와 같은 문구(예: "`context.nodeOutput`/`result`/`error` 의 debug 전용 `llmCalls` 는 WS §4.4 strip-only 결정에 따라 제거된다")를 한 줄 추가. 급하지 않음 — 다음 EIA §5.3 관련 편집 시 함께.

- **[INFO]** 필드명 기준(경로 무관) strip 이므로, 워크플로우 노드가 사용자 정의 데이터에 우연히 `llmCalls` 라는 키를 담아 반환하면(예: 폼/HTTP 응답 JSON 에 동명 키) 그 값도 공개 REST/SSE 응답에서 함께 제거된다 — 이미 이전 라운드에서 의도된 트레이드오프로 검토·수용됨(collateral 0 확인), 신규 지적 아님
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`EXTERNAL_STRIPPED_FIELDS`, `stripDeep` — 키 이름만으로 판정, JSON path/노드 타입 구분 없음)
  - 상세: 보안 결함(원본 프롬프트 유출)의 재발을 막기 위한 의도된 설계(이름 기반 방어가 위치 나열보다 강건)이며, 응답 데이터의 "정확성"(사용자 데이터를 임의로 누락시키지 않는다) 대비 "기밀성" 을 우선한 트레이드오프다. `interaction.service.spec.ts`/`strip-external-only-fields.spec.ts` 의 대조군 테스트가 정상 필드 보존을 확인하고 있어 collateral 위험은 낮다. API 계약 관점에서는 "응답에 없는 필드 = 반드시 부재" 라는 일반 원칙에 미세한 예외(동명 키는 값과 무관하게 제거)가 생긴다는 점만 인지해 두면 된다.
  - 제안: 조치 불요. 향후 실제 워크플로우 output 에 `llmCalls` 라는 이름의 사용자 필드가 관측되면 그때 path-scoped 방식으로 좁히는 것을 재검토.

- **[INFO]** URL/버전 관리: 이번 diff 의 spec 수정이 종전 §6.2 예시에 있던 `https://api.clemvion.ai/v1/executions/{id}` 형태의 절대 URL·`/v1/` 버전 세그먼트를 실제 구현 경로(`/api/external/executions/{id}`, 상대경로)로 정정했다 — 실제 엔드포인트와 문서 불일치를 줄이는 방향의 개선이며 이번 diff 가 코드 쪽 URL 설계를 바꾼 것은 아니다
  - 위치: `spec/5-system/14-external-interaction-api.md`(§6.2 `interaction` 블록, `submitUrl`/`streamUrl`/`statusUrl`/`cancelUrl` 예시)
  - 상세: 해당 `interaction` 블록 필드 자체는 여전히 "Planned(미구현)" 으로 별도 명시돼 있어 실제 동작 변경은 없다. URL 버전 세그먼트를 쓰지 않는 것이 `API 규약 §1` 관례임도 문서에 함께 명시됐다.
  - 제안: 없음(positive finding).

- **[해당 없음]** 이번 diff 는 요청 검증(request body/param validation), 페이지네이션, 인증/인가 로직 자체를 변경하지 않는다 — `getStatus` 는 종전과 동일한 `iext_*`/`itk_*` 토큰 gate 를 그대로 사용하고, 컨트롤러(`interaction.controller.ts`)·가드(`interaction.guard.ts`)는 diff 대상에 포함되지 않았다.

### 요약

이번 diff 의 실질은 `execution.waiting_for_input` fanout(SSE/webhook/chat-channel)과 REST 단발 상태 조회(`GET /api/external/executions/:executionId`) 양쪽에서 `outputData` 안에 중첩된 `llmCalls`(raw LLM 프롬프트/응답) 가 depth-1 strip 을 우회해 외부로 유출되던 보안 결함을 필드명 기준 깊이-무관 strip 으로 닫은 것이다. API 계약 관점에서는 (1) 해당 필드가 애초에 OpenAPI 스키마에 명시 선언된 필드가 아니라 열린 map(`additionalProperties: true`) 안의 debug 값이었으므로 형식적 스키마 파괴는 없고, (2) REST 와 WS fanout 이 공유 유틸을 쓰게 되어 두 표면의 응답 계약이 서로 대칭·일관돼졌으며, (3) `null`/키-생략 부재 표현 관례와 DTO nullable 타입이 그대로 보존됐고, (4) 관련 spec 문서(§5.2/§6.2/§Rationale, WS §4.4)가 코드 변경과 같은 커밋 세트 안에서 동기화됐다. 이 응답 형태 변경(필드 제거)은 의도치 않게 유출되던 민감정보를 막는 보안 수정으로서 정당한 breaking change 이며 CHANGELOG 에 영향 범위(이미 전송된 과거 데이터)까지 명시돼 있어 운영 커뮤니케이션도 갖춰져 있다. 새로 발견된 CRITICAL/WARNING 급 API 계약 결함은 없다 — §5.3 문서에 strip 사실을 인라인으로 대칭 추가하면 좋겠다는 발견성 개선 제안(INFO) 정도가 남는다.

### 위험도
LOW
