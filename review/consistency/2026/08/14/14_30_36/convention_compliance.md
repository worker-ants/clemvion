# 정식 규약 준수 검토 — convention_compliance

대상: `spec/5-system/` (--impl-done, diff-base `origin/main`)

## 조사 방법 메모

prompt 번들은 컨텍스트 예산 초과로 `spec/conventions/**` 전량과 `git diff origin/main...HEAD -- code_areas`,
`spec/5-system/14-external-interaction-api.md` 본문이 생략되어 있었다. 프롬프트만으로는 판정 불가하다고 보고,
워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD` 전문과 `spec/conventions/*.md`·`spec/5-system/14-external-interaction-api.md`를
직접 Read/Bash 로 열어 확인했다.

이번 diff(`origin/main..HEAD`)는 **`spec/5-system/**` 를 전혀 건드리지 않는다** — 변경은 전부
`codebase/backend/src/modules/external-interaction/interaction.service.ts`,
`codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신설) 및 그 테스트,
그리고 `CHANGELOG.md`/`plan/**`/`review/**` 산출물이다. 따라서 본 점검은 "target 문서(spec/5-system/)가
**지금 상태로** conventions 를 따르는가", 특히 이번 코드 변경이 spec 문서가 서술하는 출력 형식·보안 마스킹
계약과 여전히 정합하는지에 집중했다.

## 발견사항

### [WARNING] EIA §R17 "표면 제약(보안)" 이 이번 PR 의 `getStatus` 마스킹 강화를 반영하지 못해 실제보다 좁게 서술됨

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" > `nodeOutput.conversationConfig` + terminal `result`/`error` 항목 (L1346–1352)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` Overview — "spec 문서가 약속한 surface 와 실제 구현 코드 사이의 정적 증거"가 정합해야 한다는 SoT 원칙(구체적으로는 build-gate 가 아니라 **본문 서술의 정확성**에 대한 일반 원칙 원용). 인접해서 `2-api-convention.md §5.3`/`§5.4`(출력 형식·부재 표현 문서화 규약)이 요구하는 "문서가 실제 wire 를 정확히 반영해야 한다"는 원칙과도 닿아 있다.
- **상세**:
  - 코드: 이번 diff(commit `34e32e62f`)가 `InteractionService.getStatus`(`interaction.service.ts`)에 `stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}), MAX_REDACT_DEPTH)` 를 추가했다. 이제 `llmCalls`(및 중첩된 `requestPayload`/`responsePayload`)는 REST `GET /api/external/executions/:id` 응답에서 **키 자체가 깊이 무관으로 삭제**된다.
  - 문서: 그런데 EIA §R17 은 여전히 다음과 같이만 서술한다 — *"`getStatus` 는 `nodeOutput` 전체 + terminal `result`(COMPLETED)/`error`(FAILED)의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다(REST 는 `sanitizePayloadForWs` 미적용 경로라 필수). **마스킹은 secret-shape 만 치환**(정상 결과 데이터는 copy-on-change 로 보존)."* — `deepRedactSecrets`(값 마스킹) 만 언급하고, 이번에 추가된 `stripExternalOnlyFields`(필드 삭제)는 전혀 언급하지 않는다. "마스킹은 secret-shape 만 치환" 이라는 단정 자체가 이제 사실과 다르다 — `llmCalls` 는 값이 아니라 **키가 사라진다**.
  - 바로 위 줄(L1349)의 괄호 "(에디터 전용 `turnDebug.llmCalls` 는 건드리지 않음)" 은 `ai-turn-orchestrator` 의 **waiting emit**(WS/SSE) 경로를 가리키는 서술인데, `getStatus` 서술 바로 앞에 붙어 있어 독자가 "getStatus 도 `llmCalls` 를 건드리지 않는다"고 오독하기 쉬운 배치다. 이 오독은 지금은 **사실과 반대**다(이번 fix 로 `getStatus` 도 `llmCalls` 를 strip 한다).
- **이미 추적 중(중복 아님, 세부 보강)**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §(7) "`llmCalls` strip SoT 가 실제 누출 표면을 안 덮는다" 가 직전 라운드(`11_02_18` convention_compliance WARNING 1)의 후속으로 이미 planner 인계 항목을 갖고 있다 — "WS §4.4 Rationale 을 '위치·이벤트 무관' 으로 넓히고, EIA §6.2 에 §6.5 와 동형의 strip 명시 문장 + §R17 역참조를 추가"하라는 내용이다. 다만 그 항목은 **§6.2 에 R17 로의 역참조를 추가하는 것**만 명시하고, **R17 본문 자체의 "secret-shape 만 치환" 서술을 정정하는 것**은 범위에 없다 — 그 문구가 지금 이 diff 로 인해 새로 부정확해졌기 때문에, planner 턴에서 함께 처리해야 누락이 없다.
- **제안**: planner 턴에서 §R17 "표면 제약(보안)" 의 `getStatus` 서술을 다음과 같이 갱신 — "`getStatus` 는 `deepRedactSecrets`(값 마스킹) 에 더해 `stripExternalOnlyFields`(`llmCalls` 등 debug 전용 필드를 깊이 무관으로 **삭제**) 를 함께 적용한다. 마스킹은 secret-shape 값 치환, strip 은 필드 자체 제거로 방식이 다르다." SoT 상호링크(WS §4.4 ↔ EIA §R17) 를 양방향으로 추가하면 §(7) 항목의 "역참조" 요구도 함께 충족된다.

### [INFO] 신설 공용 유틸 `strip-external-only-fields.ts` 가 관련 spec frontmatter `code:` 목록에 없음

- **target 위치**: `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md` frontmatter `code:`
- **위반 규약**: 해당 없음 — `spec/conventions/spec-impl-evidence.md` R-1 이 glob 기반 하위 커버리지를 명시적으로 허용하고, 두 문서 모두 이미 `shared/utils/sanitize-error-message.ts` 같은 다른 공용 유틸도 개별 열거하지 않는 기존 관행과 일치한다. `spec-code-paths.test.ts` 가드도 glob ≥1 매치만 요구하므로 CI 상 위반 아님.
- **상세**: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 는 두 문서가 공유하는 SoT(WS §4.4 strip-only 결정)의 실제 구현이지만, WS 문서의 `code:` 는 `websocket.gateway.ts`/`websocket.service.ts` 등 명시 파일 나열 방식이라 이 신규 파일이 빠져도 가드는 통과한다. 순수 추적성 관점의 참고 사항.
- **제안**: 강제 조치 불요. 다음에 이 문서를 편집할 기회(위 WARNING 정정 시점)에 `code:` 에 한 줄 추가하면 좋다.

## 그 외 확인한 사항 (위반 없음)

- 이번 diff 는 신규 DTO·API endpoint·WS 메시지 타입을 추가하지 않아 `swagger.md`(API 문서 데코레이터/DTO 명명) 대상 변경이 없다.
- `stripExternalOnlyFields(value, maxDepth)` 의 깊이 상한 계약 — WS 호출부는 `MAX_SANITIZE_DEPTH`(=10, `websocket.service.ts`), REST 호출부는 `MAX_REDACT_DEPTH`(=10, `sanitize-error-message.ts`) — 이 파일 자신의 JSDoc 계약("호출부가 명시, 각자 자매 sanitizer 와 같은 상한")과 실제 값(10=10) 모두 일치한다. 어긋남 없음.
- §5.4(부재 표현 null vs 키 생략) 규약은 "값이 없을 때의 표현" 을 다루는 것이고, `llmCalls` strip 은 "수신자 권한에 따른 필드 가시성" 이라 다른 축의 개념이다 — §5.4 위반으로 보지 않았다(오분류 방지 차원에서 명시).
- `secret-store.md`, `redis-keys.md`, `node-output.md`, `error-codes.md` 등 나머지 conventions 파일을 대조했으나 이번 diff 의 코드 변경(REST/WS fanout 필드 strip, 순수 backend 유틸)과 직접 충돌하는 명명·포맷 규칙은 없었다.

## 요약

이번 PR 은 spec 문서를 전혀 건드리지 않고 `codebase/` 만 바꾼 보안 패치(외부 fanout 뿐 아니라 REST 스냅샷에서도 `llmCalls` raw 프롬프트가 새던 경로를 막음)다. `spec/conventions/**` 명명·포맷 규약 자체를 직접 위반하는 지점은 찾지 못했으나, 이 코드 변경으로 인해 `spec/5-system/14-external-interaction-api.md` §R17 의 `getStatus` 마스킹 서술("secret-shape 만 치환")이 실제 동작(값 마스킹 + 필드 삭제 병행)보다 좁아져 부정확해졌다. 이 갭은 이미 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §(7) 에 planner 인계 항목으로 등재돼 있으나, 그 항목은 §6.2 역참조 추가만 명시하고 R17 본문의 "secret-shape 만 치환" 문구 자체를 정정하는 것은 빠져 있어 다음 planner 턴에 명시적으로 포함시킬 필요가 있다. 나머지는 신규 DTO/endpoint 가 없어 API 문서 규약(swagger.md) 대상 밖이었고, 깊이 상한·strip 계약 등은 자체 JSDoc 선언과 일치했다.

## 위험도

LOW
