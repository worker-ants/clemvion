# Requirement Review — eia-misc-hygiene

## 발견사항

- **[WARNING]** `websocket.service.spec.ts` 리팩터 과정에서 JSDoc 이 자신이 설명하던 테스트에서 분리돼, 이제 **엉뚱한 두 테스트를 설명**한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:751-761` (JSDoc), 바로 아래 `:762`(`it('llmCalls 없는 이벤트는 그대로 fanout (no-op strip)'...)`) 및 `:777`(`it('emitNodeEvent fanout 도 llmCalls 를 strip...)`)
  - 상세: 이 diff 는 파일 끝쪽(옛 위치, 삭제된 라인들)에 있던 두 테스트("llmCalls 없는 이벤트는 그대로 fanout" / "emitNodeEvent fanout 도 llmCalls 를 strip")를 파일 앞쪽으로 옮기면서, 원래 그 자리(옮겨 붙인 지점 바로 위)에 있던 JSDoc — `**fanout nodeOutput 은 fail-closed allowlist 다** — EIA §R17. … REST getStatus 는 #1205 에서 allowlist 로 닫혔고, 이 테스트가 SSE/fanout 쪽 같은 문을 고정한다. … _retryState 를 고른 이유: …` — 를 그대로 둔 채 그 뒤에 이동시킨 두 테스트를 끼워 넣었다. 그 결과 이 JSDoc 은 이제 llmCalls-strip 두 테스트를 설명하는 것처럼 보이지만, 실제로는 `_retryState`/`nodeOutput` allowlist 캐너리(`it('[캐너리] fanout 의 nodeOutput 에서 allowlist 밖 내부 필드가 제거된다'...)`, 새로 분리된 `describe('nodeOutput allowlist · fanout 파이프라인 불변식', ...)` 블록의 첫 항목, `:812`)를 설명하려고 쓴 글이다. 새 describe 블록에는 별도의(짧은) JSDoc(`:803-810`, "`llmCalls strip` 에서 **분리했다**…")이 붙었지만, `_retryState`/`#1205` 근거를 담은 원 JSDoc 은 옮겨지지 않고 방치됐다. 이 PR 전체가 "주석·문서가 실제로 가리키는 코드와 정확히 일치해야 한다"는 규율(docstring 정합성)을 핵심 동기로 삼고 있는 만큼(예: `redact-stored-error.ts` 의 `@param`/`@returns` 보강, `node-output-allowlist.ts` 표-배열 미러 동기화 서술 등), 같은 PR 안에서 이 형태의 괴리가 새로 생긴 것은 criterion #4(의도와 구현 간 괴리)에 해당한다.
  - 제안: JSDoc(`:751-761`)을 `describe('nodeOutput allowlist · fanout 파이프라인 불변식', ...)` 블록의 캐너리 테스트(`:812` 근처) 위로 옮기거나, 최소한 이동된 두 llmCalls-strip 테스트를 설명하도록 다시 쓴다. 두 JSDoc(`:751-761` 과 `:803-810`)이 뒤섞이지 않도록 정리.

- **[INFO]** `swagger-probe.ts` 에 `schemasOf` 선언 직전 JSDoc 블록이 **3개 연속**으로 남아 있고, 그중 하나는 `schemaOf` 를 설명하는 내용이라 대상이 어긋난다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:58-75` (`export function schemasOf(` 는 `:76`)
  - 상세: `:58-62` 와 `:71-75` 는 둘 다 `schemasOf` 를 설명하는 사실상 동일 문구의 중복 JSDoc 이고, 그 사이 `:63-70` 은 "생성 문서에서 DTO 스키마 **하나**를 꺼낸다 … 어느 단계가 비었는지 이름으로 말해 준다" 는, 실제로는 `schemaOf`(단수) 를 설명하는 문단이다. TS/JSDoc 툴링은 함수 바로 위 블록(`:71-75`)만 그 함수의 문서로 인식하므로 `:58-62`, `:63-70` 은 고아(orphan) 주석으로 남는다 — 리팩터링 중 초안을 지우지 않고 남긴 흔적으로 보인다.
  - 제안: `:58-70` 두 블록을 지우고 `:71-75` 하나만 남긴다(또는 세 블록의 내용을 통합해 하나로).

- **[INFO]** `buildSwaggerDocument` JSDoc 의 "네 스펙 중 둘은 `{ controllers: […] }`, 둘은 `{ imports: […] }`" 서술이 실측과 다르다(2:2 가 아니라 3:1).
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:41-43`
  - 상세: 실제로 이 헬퍼로 전환된 네 스펙 중 `imports:` 를 쓰는 것은 `re-run.dto.spec.ts` 1건뿐이고, 나머지 셋(`execution-status-response.dto.spec.ts`·`interact-ack-response.dto.spec.ts`·`workflows-execute-body.spec.ts`)은 모두 `controllers:` 를 쓴다(실측, grep). 기능적 영향은 없다 — `ModuleMetadata` 를 그대로 받는 시그니처라 어떤 조합이든 동작한다 — 이므로 순수 문서 정확도 이슈다.
  - 제안: "둘은 … 둘은 …" 을 "셋은 `controllers:`, 하나는 `imports:`" 로 정정.

## 참고 — 확인해 검증한 항목 (문제 없음)

- `node-output-allowlist.ts`/`.spec.ts` 를 `shared/utils/` → `nodes/core/` 로 이동: 소비처(`websocket.service.ts`, `interaction.service.ts`) import 경로 동반 갱신, 구 경로 파일 잔존 0, 구 경로 문자열 참조 0(spec 포함) — 실측 확인.
- `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse` 리네임: 구 이름 잔존 참조 0(실측), 호출부(`executions.service.ts`, `redact-stored-error.spec.ts`, docstring 표) 전부 동기화.
- `interaction.guard.ts` JSDoc 의 `EIA-AU-09` 제거: spec(`spec/5-system/14-external-interaction-api.md`)에 `EIA-AU-09` 라는 독립 요구사항 ID는 존재하지 않는다(§3.3.1 은 "Implementation Note (EIA-AU-08)" 일 뿐) — 저장소 전체에 `EIA-AU-09` 잔존 0(실측). 코드가 spec 과 일치하도록 정정된 것이 맞다.
- `tsconfig.build.json` 에 `src/shared/testing/**` exclude 추가: `swagger-probe.ts` 가 devDependency `@nestjs/testing`/`@nestjs/swagger`(DocumentBuilder 등)를 import 하므로 dist 오염 방지 목적과 일치. `*spec.ts` 패턴에 안 걸리는 `swagger-probe.ts` 만 해당(같은 디렉토리의 `swagger-probe.spec.ts` 는 어차피 `**/*spec.ts` 로 이미 제외).
- `websocket.service.spec.ts` 캐너리 8건을 `describe('nodeOutput allowlist · fanout 파이프라인 불변식', ...)` 로 이동: 실측상 정확히 8건이 새 블록에 있고 중복/누락 없음.
- `swagger-probe.ts`(`schemasOf`/`schemaOf`/`propertyOf`)의 에러 경로(없는 DTO/프로퍼티/빈 스키마)는 `swagger-probe.spec.ts` 가 각각 캐너리로 고정 — 엣지 케이스 커버리지 양호.
- `allowlistNodeOutputKeys` 의 컴파일타임 결속(`assertAllowlistCoversHandlerContract`)이 `NodeHandlerOutput` 실제 필드(config/output/meta/port/status + `_resumeState`/`_retryState`)와 일치함을 확인 — `tsc --noEmit` 에서 해당 파일·심볼 관련 신규 에러 없음(사전 존재하는 무관 다수 에러는 이 diff 범위 밖).
- `spec/5-system/14-external-interaction-api.md`, `spec/conventions/node-output.md`, `spec/conventions/egress-masking.md` 의 `code:`/본문 경로 갱신이 실제 파일 위치와 일치.
- TODO/FIXME/HACK/XXX 마커: 변경 파일 전체에서 0건.

## 요약

이번 PR 은 순수 위생(hygiene) 정리 — Swagger 테스트 보일러플레이트를 `swagger-probe.ts` 공유 헬퍼로 추출, `redactNodeExecutionRow` 개명, `node-output-allowlist.ts` 재배치, 낡은 `EIA-AU-09` 주석 정정, `tsconfig.build.json` dist 오염 방지 항목 추가, 관련 plan/spec 문서 동기화로 구성된다. 리네임·이동·경로 갱신은 grep 실측으로 잔존 참조 0건을 확인했고 spec fidelity(§3.3.1 EIA-AU-09 제거)도 spec 본문과 일치한다. 다만 `websocket.service.spec.ts` 의 테스트 재배치 과정에서 JSDoc 한 블록이 원래 대상(신규 분리된 allowlist 캐너리)에서 떨어져 나가 지금은 무관한 두 테스트 위에 얹혀 있는 실제 결함(WARNING)을 발견했다. 그 외 `swagger-probe.ts` 의 고아 JSDoc 중복과 사소한 서술 오차는 기능에 영향 없는 INFO 다. 전반적으로 기능적 위험은 낮고, 지적된 문서 정합성 문제는 이 PR 이 스스로 강조하는 "주석-코드 일치" 규율에 반하므로 후속 커밋에서 바로잡을 가치가 있다.

## 위험도

LOW
