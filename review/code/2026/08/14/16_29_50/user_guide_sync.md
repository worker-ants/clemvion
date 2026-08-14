### 발견사항

- **[INFO]** 변경이 doc-sync-matrix trigger 어디에도 확정 매칭되지 않음 — 근접 후보 3개를 확인했으나 전부 "동반 갱신 불요"로 판정
  - 변경 파일: `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (+ 각 `.spec.ts`)
  - 확인한 근접 trigger:
    1. **`backend-api-change`**(`.claude/config/doc-sync-matrix.json` id) — targets: "controller·DTO 의 swagger jsdoc / API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지". `GET /api/external/executions/:id` 응답을 만드는 `getStatus()` 가 수정 대상이라 후보였으나, `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` 의 `result`/`error`/`nodeOutput` 은 애초에 `@ApiProperty` 로 `Record<string, unknown>`(자유 형식) 로만 선언돼 있어 `llmCalls` 같은 개별 필드를 열거·약속한 적이 없다 — swagger jsdoc 갱신 대상 없음. 사용자 가이드 쪽은 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`(227~330줄)가 이 API 표면(엔드포인트 목록·토큰 전략·SSE 이벤트명)을 문서화하지만 `status`/`stream` 응답 **본문 스키마 예시(JSON)는 싣지 않는다** — `llmCalls`/`nodeOutput`/`debug` 관련 언급이 이 파일에 전혀 없음(grep 확인). 즉 고칠 stale 서술이 없다.
    2. **`run-debug-flow-change`**(semantic) — targets: `05-run-and-debug/`. 이번 수정은 **외부 수신자**(EIA REST 스냅샷·SSE·webhook·chat-channel)에게만 영향을 주고, 앱 내부 실행/디버그 UI 가 쓰는 내부 WS 채널(`execution:{executionId}`)은 diff 가 명시적으로 대조군 테스트로 "종전대로 full payload" 를 고정한다 — 인앱 실행·디버그 화면의 동작·표시는 전혀 바뀌지 않는다. `05-run-and-debug/*.mdx` grep 결과 `llmCalls`/`turnDebug` 언급 없음.
    3. **spec 정합** — 코드 JSDoc 이 명시하는 SoT `spec/5-system/6-websocket-protocol.md §4.4` 는 "이 필드는 모든 외부 수신자에서 strip 된다"를 **이미** 선언하고 있었고(CHANGELOG 발췌: "WS §4.4 는 이 필드가 '모든 외부 수신자에서 strip 된다' 고 선언하고 있었다"), 이번 diff 는 구현을 그 선언에 맞춘 **버그 수정**이지 신규 계약이 아니다 — spec 파일 자체는 이번 변경 set 에 없고(git diff 확인) 수정도 불필요.
  - 상세: 세 후보 모두 "사용자에게 새로 보이는 것/달라지는 계약"이 없어 문서 stale 위험이 없다고 판단. `codebase/frontend/**` 는 이번 변경 set 에 파일이 전혀 없음(신규 UI 문자열·노드·dict·backend-labels·locale.ts 트리거 전부 대상 외).
  - 제안: 조치 불요. (참고로만 기록 — CRITICAL/WARNING 아님)

### 요약
`.claude/config/doc-sync-matrix.json` 의 21개 trigger 행과 PROJECT.md §변경 유형 매핑을 전수 대조한 결과, 이번 변경 set(`CHANGELOG.md` + `interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`(+spec) + plan md 3건 + `review/**` 산출물)은 어느 trigger 에도 동반 갱신을 요하는 형태로 매칭되지 않았다. 이번 diff 는 frontend 코드를 전혀 건드리지 않는 backend-only 보안 버그 수정(외부 수신자로 새던 `llmCalls` raw 프롬프트를 깊이 무관 strip)이며, 관련 API 표면을 문서화하는 `02-nodes/triggers.mdx` 는 응답 본문 스키마를 예시로 열거하지 않아 stale 서술이 없고, JSDoc 이 인용하는 spec(WS §4.4)은 이미 이 동작을 documented behavior 로 선언한 상태였다(구현이 문서를 못 따라갔던 것이지 문서가 코드를 못 따라간 게 아니다). i18n dict·backend-labels·locale.ts·02-nodes MDX·04-expression-language·05-run-and-debug·06-integrations-and-config·07-workspace-and-team 어느 것도 갱신 대상이 아니다.

### 위험도
NONE
