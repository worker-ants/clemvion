# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] `$thread` — scope-gate 없음 (의도적, spec 정합)
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts` L36
- 상세: `$thread`는 `scopeKey` 없이 추가됐다. `$loop`/`$item`/`$itemIndex`는 각각 `hasLoop`/`hasItem` 으로 scope-gated되지만, `$thread`는 spec `5-expression-language.md §4.4`에서 "AI Agent 노드의 `contextScope` 자동 주입과는 독립적으로 사용자가 명시 참조 가능"하다고 정의한다 — 즉 컨테이너 한정이 아닌 전역 변수다. `ContainerScopeFlags`에 `hasThread`가 없는 것도 맞다.
- 제안: 이상 없음.

### [INFO] `$thread` — `isExpandable: true` (spec 정합)
- 위치: `expression-constants.ts` L36
- 상세: spec §4.4가 `turns`, `length`, `text` 속성을 정의하므로 `isExpandable: true`는 올바르다. `BUILT_IN_PICKER_VARIABLES`는 `ROOT_VARIABLES.filter(not-input/node/var).map(…)` 파생이므로 picker에도 자동 반영된다.
- 제안: 이상 없음.

### [INFO] `spec-sync-execution-history-gaps.md` — `complete/` 이동됐으나 체크박스 미완료
- 위치: `/plan/complete/spec-sync-execution-history-gaps.md` L13
- 상세: 파일이 `plan/complete/`에 있지만 "미구현 항목" 체크박스가 `- [ ]`(미완료)로 남아 있다. 코드(`executions.service.ts:575`, `execution-response.dto.ts:103~111`)에는 `completedNodeCount`/`totalNodeCount`/`failedNodeCount` 배치 집계가 실제 구현되어 있고, spec(`14-execution-history.md`)도 `implemented`로 승격됐다. 내용 일관성 이슈지만 기능 완전성에는 영향 없음.
- 제안: `- [ ]` → `- [x]` 로 flip (plan-lifecycle 정합).

### [INFO] `spec-draft-eia-strip-llmcalls.md` — 백엔드 strip 구현 아직 없음 (draft 문서 역할 명확)
- 위치: `plan/complete/spec-draft-eia-strip-llmcalls.md`
- 상세: 이 파일은 spec 초안 draft이며 구현 여부를 추적하지 않는다(title: "Spec draft"). `llmCalls` strip 로직은 backend에서 아직 구현되지 않은 것으로 확인된다 — 현재 `ai-agent.handler.ts`가 `llmCalls`를 payload에 포함하고, fanout 경로에서 제거하는 seam이 없다. 그러나 이 파일 자체는 spec 변경을 기술하는 planner 산출물이며, "곧이어 backend 구현(fanout strip)이 따른다"고 명시한다. `plan/complete/`에 위치하므로 spec 갱신은 완료됐고 backend 구현은 별도 developer 작업으로 예정된 상태다.
- 제안: `llmCalls` strip backend 구현 plan이 `in-progress`에 없다면 별도 plan 티켓으로 추적 권장 (security 관점 — 외부 수신자에게 raw LLM payload 누출).

### [INFO] `spec-update-c-sync-promotions.md §4` — workspace `(owner_id,type)` UNIQUE 마이그레이션 갭 해소 여부 미추적
- 위치: `plan/complete/spec-update-c-sync-promotions.md` L1314–1318
- 상세: `[WARNING]`으로 기록된 workspace `(owner_id,type)` UNIQUE DB 마이그레이션 갭(TypeORM `@Unique` 존재, SQL 제약 없음)이 "developer 후속"으로만 기재되어 있고 별도 `plan/in-progress/` 티켓이 존재하지 않는 것으로 보인다. 추적 누락 여부 확인 필요.
- 제안: `plan/in-progress/`에 해당 갭 추적 plan이 없다면 신설 권장.

### [SPEC-DRIFT] `spec/5-system/12-webhook.md`, `spec/5-system/15-chat-channel.md` — `{ ignored: true }` → `{ executionId: 'ignored' }` 응답 body 변경
- 위치: `spec/5-system/12-webhook.md` WH-EP-07 및 §7 step 7c, `spec/5-system/15-chat-channel.md` §5.5 표
- 상세: 이전 spec은 `{ ignored: true }`를, 개정 spec은 `{ executionId: 'ignored' }`를 명시한다. 코드(`hooks.service.ts`)가 `{ executionId: 'ignored' }` 을 반환하도록 이미 구현되어 있다 — 코드가 맞고 spec이 코드를 반영한 것이다. `{ ignored: true }` 형태는 코드 어디에도 없으므로 이번 spec 변경은 코드 현실을 추격한 것이다.
- 제안: 코드 유지. 관련 client 코드(`chat-channel` 소비자 등)가 `ignored` 필드를 읽는다면 `executionId === 'ignored'` 패턴으로 이미 처리돼야 한다 — 확인 필요. 대상 spec: `spec/5-system/12-webhook.md` WH-EP-07 및 §7 step 7c, `spec/5-system/15-chat-channel.md` §5.5 표.

### [WARNING] `spec-draft-node-execution-cancelled.md` — IE multi-turn `runTurnWithCollectionRetries` abortSignal 전파 TODO 미완
- 위치: `plan/complete/spec-draft-node-execution-cancelled.md` L299
- 상세: "구현 영향" 목록에 `information-extractor.handler.ts:634 TODO` — IE multi-turn `runTurnWithCollectionRetries` 에 abortSignal 전파가 명시적 TODO로 남아 있다. 이 plan이 `complete/`에 위치하지만 이 항목의 완료 여부가 명시되지 않아 있다.
- 상세 확인: `information-extractor.handler.ts:634` 근처에 TODO가 있는지 점검 필요. plan 파일이 draft(spec 변경 전 작성)이라면 backend 구현 plan에서 추적되어야 한다.
- 제안: `information-extractor.handler.ts` 의 해당 TODO가 실제로 남아 있다면 별도 developer plan으로 분리하거나 미완료 명시 필요.

---

## 요약

38개 파일에 걸친 변경 세트는 spec-sync groom 작업으로, 구현 완료된 surface의 spec marker flip, plan 이동, 신규 spec 문서(cancelled status, llmCalls strip, workspace settings API)를 포함한다. 핵심 코드 변경인 `$thread` autocomplete 추가(파일 1)는 spec `5-expression-language.md §4.4`와 line-level 정합 — scope-gate 없음·`isExpandable: true`·`BUILT_IN_PICKER_VARIABLES` 자동 반영 모두 올바르다. spec marker flip들(auth-flow, error-empty-states, text-classifier, information-extractor, execution-history, workflow, statistics, user-guide-evidence, embedding §4.3)은 코드 구현 사실에 부합하며 기능 완전성 결함 없다. 주요 주의사항: (1) `spec-draft-eia-strip-llmcalls.md`는 spec 초안 완료이나 backend fanout strip 구현이 아직 없어 보안상 별도 developer 작업이 필요하고 추적 plan이 있는지 확인이 필요하다. (2) `spec-sync-execution-history-gaps.md`의 체크박스 미flip은 소소한 정합 이슈. (3) IE multi-turn abortSignal 전파 TODO 완료 여부 확인 필요.

## 위험도

LOW
