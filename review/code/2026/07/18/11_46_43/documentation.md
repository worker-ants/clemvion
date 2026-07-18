# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 계약 설명 docblock 이 두 파일에 사실상 동일한 3가지 사유로 중복 서술됨
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:456-465` (`endMultiTurnConversation` docblock) ↔ `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1180-1219` (동 메서드 구현 docblock)
  - 상세: 두 곳 모두 "IE 가 errorPayload/failedUserMessage/failedUserMessageSource 를 무시하고 self-fill 하는 3가지 이유"를 거의 같은 문장으로 반복 서술한다. 인터페이스 쪽은 "상세 SoT 는 그 핸들러의 `endMultiTurnConversation` docblock" 이라고 명시해 SoT 를 핸들러로 지정해뒀지만, 실제로는 요약이 아니라 3가지 사유 전체를 다시 풀어쓴 수준이라 향후 한쪽만 갱신되면 drift 위험이 있다.
  - 제안: 현재로선 두 설명이 상호 검증됐고(코드 대조 결과 둘 다 정확) 즉각 조치가 필요한 수준은 아니다. 다만 향후 이 계약이 다시 바뀔 때는 인터페이스 쪽을 한 문단 요약으로 더 압축하고 "이유 1/2/3" 전체 서술은 핸들러 docblock 에만 남기는 방향을 고려할 수 있다.

- **[INFO]** `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` frontmatter `spec_impact` 가 실제 diff 에 없는 spec 파일 2건을 나열
  - 위치: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` frontmatter (`spec_impact: [spec/4-nodes/3-ai/3-information-extractor.md, spec/4-nodes/3-ai/1-ai-agent.md]`)
  - 상세: 이번 changeset 12개 파일 중 `spec/**/*.md` 수정은 0건이다(plan 본문 Q3 결론도 "문서화 (behavior 무변경)" 이며, 체크리스트도 handler docblock/interface docblock/pinning test 만 포함). `spec_impact` 는 Gate C(완료 시점 강제) 필드이므로 지금(`status: in-progress`) 당장 문제는 아니지만, 이대로 `complete/` 로 이동하면 "spec 파일을 건드렸다"는 선언과 실제 diff(spec 무변경)가 불일치하게 된다.
  - 제안: `complete/` 이동 시점에 실제로 `spec/**` 편집이 없다면 `spec_impact: none` 으로 교정할 것 (`.claude/docs/plan-lifecycle.md` §5 Gate C 기준). 현재 in-progress 단계라 강제 대상은 아니므로 blocking 은 아님.

- **[INFO]** CHANGELOG 업데이트 불요 판단은 타당함 (참고 사항, 조치 불필요)
  - 위치: `CHANGELOG.md` (Unreleased 섹션들과 비교)
  - 상세: 기존 CHANGELOG 항목들은 전부 사용자 가시 동작 변경/버그 수정을 다룬다. 이번 변경은 `endMultiTurnConversation` 의 런타임 동작을 바꾸지 않는 순수 문서화 + 회귀 pinning 테스트(plan 자체가 "Q3: 문서화, behavior 무변경"으로 명시)이므로 CHANGELOG 항목이 없는 것은 기존 관례와 정합적이다.

## 검증한 문서 정확성

- `information-extractor.handler.ts` 새 docblock 이 인용하는 심볼(`runTurnWithCollectionRetries`/`processMultiTurnMessage`/`executeMultiTurn`/`buildErrorOutput`/`buildMultiTurnFinalOutput`/`hydrateState`/`retryabilityDetails`)은 모두 실존하며 `@link` 대상이 유효함을 확인했다.
- `buildMultiTurnFinalOutput` 의 `error` 분기(handler.ts:1339-1362)가 실제로 `code: 'LLM_CALL_FAILED'` + `retryabilityDetails('LLM_CALL_FAILED')`(→ `retryable: true`) + `output.result` 병존을 만든다는 docblock 서술과 코드가 일치함을 확인.
- `AiAgentHandler`(→`AiTurnExecutor.endMultiTurnConversation`)가 실제로 `output.error = errorPayload` verbatim relay 를 수행함(`ai-turn-executor.ts:3281-3282`)을 확인 — 인터페이스 docblock 이 서술하는 "AI Agent 는 verbatim relay, IE 는 self-fill" 대비가 코드와 일치.
- `spec/4-nodes/3-ai/3-information-extractor.md:304` 의 §5.3 invariant(`LLM_CALL_FAILED`/`LLM_RATE_LIMIT` → `retryable: true`, 나머지 → `false`)가 신규 docblock/plan/테스트가 인용하는 내용과 정확히 일치함을 확인.
- `spec/4-nodes/3-ai/3-information-extractor.md:174` 는 이미 `endMultiTurnConversation(_resumeState, endReason)` 2-인자 형태로 서술돼 있어, 이번 코드 변경(뒤 3개 인자를 `_` prefix 로 명시)과 spec 문구 간 신규 불일치가 발생하지 않는다.
- 신규 테스트(`information-extractor.handler.spec.ts`)의 인라인 주석은 각 assertion 이 무엇을 검증하는지(§5.3 code-기반 invariant, errorPayload 필드 미유입, IE context 보존, `_retryState` 미emit) 명확히 설명하며 실제 assertion 과 1:1 대응한다.

## 요약

이번 변경은 코드 동작 변경 없이 기존에 모호했던 `ResumableNodeHandler.endMultiTurnConversation` 의 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 소비 계약을 인터페이스·구현체 양쪽 docblock 과 회귀 pinning 테스트로 명문화하는, 문서화 관점에서 모범적인 PR이다. 새로 추가된 모든 docblock 주장(참조 심볼, spec §5.3 invariant, AI Agent 의 verbatim relay 대비 IE 의 self-fill)을 실제 코드·spec 본문과 대조 검증했으며 불일치를 발견하지 못했다. 유일하게 눈에 띄는 것은 인터페이스와 핸들러 두 곳에 거의 동일한 3가지 사유 설명이 중복돼 향후 한쪽만 갱신될 drift 위험이 있다는 점과, plan frontmatter `spec_impact` 가 이번 diff 에 없는 spec 파일 2건을 가리키고 있어 `complete/` 이동 전 `none` 으로 재검토가 필요할 수 있다는 점이며, 둘 다 INFO 수준으로 즉시 조치가 필요하지 않다.

## 위험도
LOW
