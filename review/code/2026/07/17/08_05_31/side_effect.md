# 부작용(Side Effect) Review

대상: `aee4f75e9..HEAD` (직전 리뷰 `review/code/2026/07/17/07_12_33/` 지적 반영 fix 델타 — `b04654f94`, `ea6f5f85c`, `4e6e079e5`). 핵심 코드 변경은 `conversation-inspector.tsx`(인라인 재파싱 블록 삭제), `output-shape.ts`(ReadonlySet 리팩터), 테스트 3개 파일, spec/코드 주석 §7.9 경로 정정.

## 조사 방법

diff 만으로는 "삭제된 코드가 정말 도달 불가였는가"를 확정할 수 없어, 현재 HEAD 소스(`conversation-inspector.tsx`, `result-detail.tsx`, `conversation-utils.ts`, `resolve-result-field.ts`, `output-shape.ts`)를 직접 열람하고, 삭제된 인라인 파서의 pre-`aee4f75e9` 원본(`git show aee4f75e9^:...`)까지 대조했다. RAG 판단은 `RagSearchService.buildContext` / `kb-tool-provider.ts` 를 백엔드에서 grep 해 실제 호출부 유무를 재확인했다. `conversation-inspector.test.tsx` / `output-shape.test.ts` / `result-detail.test.tsx` 를 직접 재실행해 103/103 passed 를 확인했다.

## 발견사항

- **[WARNING]** RAG 행 소실의 "의도된 변경" 근거(SUMMARY §RAG 판단 근거 1 "live 는 원래부터 없었다 — history 전용 비대칭")가 실제 변화의 크기를 과소평가하고 있다 — 이번에 사라진 것은 "history 전용 기능"이 아니라 "이미 실제로 동작하던 기능"이다
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:868` (`const items = conversationMessages;`) / 비교 대상: `git show aee4f75e9^:codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` 의 `items` `useMemo` (`if (isLive) return conversationMessages;` 다음 줄부터 무조건 재파싱)
  - 상세: `aee4f75e9` **이전**(즉 이번 Inv-8 작업 착수 전, 오랫동안 유지돼온 코드) 에는 `isLive=false` 분기가 호출자가 넘긴 `conversationMessages` prop 을 **무조건 무시**하고 `resolveResultField(output, "messages")` 로 자체 재파싱했다 — `msgsRaw` 가 배열이 아닐 때만 폴백. 반면 `result-detail.tsx` 는 그 시점에도 이미 `historyMessages = isCompletedConversation ? parseHistoryMessages(...) : []` 를 계산해 넘기고 있었으므로(`git show aee4f75e9 -- result-detail.tsx` 의 `-` 라인 확인), **완료된(completed) 대화 이력을 보는 모든 프로덕션 경로**에서 RAG 시스템 메시지가 있으면 실제로 "🔎 KB Reference" 행이 렌더됐다. 즉 RAG 행은 "history 전용으로 남아있던 낡은 비대칭"이 아니라, `aee4f75e9` 이 `if (conversationMessages.length > 0) return conversationMessages;` 가드를 추가하면서 **처음으로 도달 불가가 된, 그 커밋 자신이 유발한 조용한 회귀**다. 이번 델타(`b04654f94`)는 그 가드로 이미 죽은 코드를 물리적으로 삭제해 "확정"시켰을 뿐이다.
  - 근거 2("프로덕션 dead — `RagSearchService.buildContext` 호출부 없음")·근거 3("References 탭이 현재 SoT")은 사실이며(백엔드 재확인: `grep -rn buildContext src/` → 정의부(`rag-search.service.ts:716`) 1곳뿐, `kb-tool-provider.ts:335` 주석이 "기존 buildContext 와 동일 규칙"이라고 명시해 tool-call 기반 설계로 대체됐음을 확인) **신규 실행에는 영향 없다.** 그러나 이 두 근거는 "새 실행"에 대한 것이고, 실제 손실 표면은 **DB 에 이미 영속된 구형 실행 레코드**(시스템 메시지 주입 방식이 살아있던 시절의 실행)다. 그 레코드들의 `outputData.result.messages` 에는 `role:'system', content:'### Relevant Knowledge...'` 항목이 그대로 남아있지만, `parseHistoryMessages`/`messagesToConversationItems` 는 `system` role 을 무조건 skip 하므로(`conversation-utils.ts:559` "system messages and unknown roles are skipped") 그 실행을 새로고침 후 다시 열어보면 KB 컨텍스트가 주입됐다는 사실 자체가 Preview 타임라인에서 보이지 않게 된다. **완전한 데이터 유실은 아니다** — 원본 문자열은 outputData 에 그대로 남아 Output 탭(raw JSON viewer)으로는 계속 조회 가능하다. 하지만 "타임라인에서 KB 호출이 보인다"는, 예전에 실제로 존재했던 UX 는 구형 레코드에 대해서는 영구히 사라진다.
  - 제안: SUMMARY.md/코드 주석의 "의도된 변경" 근거를 "live/history 비대칭 해소"가 아니라 "**`aee4f75e9` 가 만든 회귀를 그대로 확정**"으로 정확히 재서술하고, `conversation-thread.md` 의 관련 Rationale(§8.5 또는 §9.3 인접)에 "구형 실행의 RAG 컨텍스트는 Preview 타임라인이 아니라 Output 탭 raw JSON 으로만 조회 가능 — 의도적으로 복원하지 않음"을 한 줄 명시해, 향후 "왜 예전 실행에는 KB 청크 chip 이 없지?"라는 동일 질문이 반복될 때 근거 문서가 정확한 답을 주도록 할 것. (심각도가 낮은 이유: 신규 실행 영향 없음, raw 데이터 보존, 이미 팀이 판단·기록을 마친 사안 — 다만 그 기록 자체의 정확도를 개선할 여지가 있어 WARNING.)

- **[INFO]** 삭제된 producer(`RAG_CONTEXT_MARKER`/`isRagContextContent`/인라인 파서)의 반대편 consumer 가 청소되지 않고 그대로 남아 새로운 dead code 가 됨 — 이번 fix 가 스스로 적용한 원칙("guard 만으로는 부족, 물리적 삭제 필요")이 이 경로에는 적용되지 않은 비일관성
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:564-584`(`RagDetail` 컴포넌트 전체), `:366-368`(`if ((item.type as string) === "rag") return <RagDetail item={item} />;`), `:927`(`const isRag = (item.type as string) === "rag";`) 및 그 파생값을 쓰는 `:1161,1183,1186,1197,1220`
  - 상세: `ConversationItem["type"]` 의 실제 타입 선언(`execution-store.ts:108-114`)에는 `"rag"` 가 애초에 없다 — `"rag"` 는 항상 `as ConversationItem["type"]` 런타임 캐스트로만 존재하던 synthetic 값이었고, 그 유일한 생성처가 이번에 삭제된 인라인 파서였다(`out.push({ type: "rag" as ConversationItem["type"], ... })`, 삭제된 블록). `parseHistoryMessages` / `messagesToConversationItems` 어디에도 `"rag"` 를 만드는 코드가 없음을 grep 으로 확인했다(`grep -rn '"rag"' src/` → 소비처 2곳만 매치, 생성처 0). 즉 `RagDetail` 컴포넌트와 `isRag` 관련 5개 분기는 이제 **런타임에 절대 참이 될 수 없는 조건**이 됐다 — 이번 fix 커밋이 정확히 같은 이유(guard 로 우회된 dead code 는 나중에 조건이 흔들리면 다시 위험해진다)로 인라인 파서를 삭제했는데, 그 파서의 소비자 쪽에는 동일 논리를 적용하지 않았다.
  - 왜 문제인가: 기능상 즉각적 버그는 아니다(도달 불가이므로 실행되지 않음). 다만 (1) 다음 유지보수자가 `RagDetail`/`isRag` 를 보고 "RAG 타임라인 표시가 아직 살아있다"고 오판할 수 있고, (2) `ConversationItem.type` 선언에 없는 값을 문자열 캐스트로 비교하는 패턴이 코드에 남아 타입 시스템의 보호를 우회한 채 방치된다.
  - 제안: `RagDetail` 함수 정의, `if ((item.type as string) === "rag")` 분기(:366-368), `isRag` 변수 및 그 5개 소비처를 함께 삭제할 것 — producer 삭제와 같은 커밋/후속 커밋에서 정리하는 것이 "우회 대신 물리적 제거"라는 이번 fix 의 원칙과 일관된다.

- **[INFO, 확인용 — 문제 아님]** "도달 불가" 판단 자체는 코드 대조로 정확함이 재확인됨
  - 위치: `conversation-inspector.tsx:846-853`(`SummaryView` 의 `output` unwrap) vs `conversation-utils.ts:633-651`(`parseHistoryMessages` 의 `wrapper`/`messagesSource` 계산)
  - 상세: 두 로직 모두 `"config" in raw && "output" in raw ? raw.output : raw` 로 동일하게 unwrap 하고, `result?.messages ?? wrapper?.messages` 로 동일 우선순위로 messages 를 찾는다 — 구조적으로 동치. `result-detail.tsx:1073-1079` 도 `isConversationHistory`(=`isConversationOutput` 참) 일 때만 `historyMessages = parseHistoryMessages(...)` 를 계산해 `ConversationInspector` 에 넘기므로, 삭제된 인라인 재파싱이 실행되려면 "호출자가 messages 실재를 확인했음에도 빈 배열을 넘기는" 상황이 필요한데 현재 콜 그래프에 그런 경로가 없다. 델타의 "도달 불가" 주장은 검증됐다.
  - 제안: 없음.

- **[NONE]** `output-shape.ts` 의 OR-체인 → `CONVERSATION_END_REASONS` `ReadonlySet` 전환은 순수 리팩터 — 시그니처·export·동작 변화 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:121-128,172-175`
  - 상세: `CONVERSATION_END_REASONS` 는 모듈 스코프 `const` 로 export 되지 않고(grep 확인, 파일 내부에서만 참조), `isConversationOutput` 시그니처도 변화 없다. `endReason === "a" || endReason === "b" ...` 와 `Set.has(endReason)` 은 값 집합이 동일하면 완전히 동치이며, 이번 델타에서 값 집합(`completed/user_ended/max_turns/max_retries/condition/error`) 자체는 바뀌지 않았다(그 확장은 `aee4f75e9` 에서 이미 있었음). `isConversationOutput` 의 두 프로덕션 호출자(`result-detail.tsx`, `result-timeline.tsx`)에 영향 없음.
  - 제안: 없음.

- **[NONE]** orphan import/심볼 정리(`useMemo`, `tryParseJson`, `stripInlineMarkers` 로컬 import, `RAG_CONTEXT_MARKER`, `isRagContextContent`) — 실제로 파일 내·외부 어디에서도 재사용되지 않음
  - 위치: `conversation-inspector.tsx` import 문 (diff 상단)
  - 상세: `grep -rn "RAG_CONTEXT_MARKER|isRagContextContent" src/` → 0건. `grep -n "useMemo|tryParseJson" conversation-inspector.tsx` → 0건. `stripInlineMarkers` 함수 자체는 `conversation-utils.ts` 의 다른 정상 경로(라이브 처리 등)에서 계속 쓰이므로 삭제 대상이 아니다 — 이번 delta 가 지운 것은 `conversation-inspector.tsx` 의 **로컬 import** 뿐이며 정확하다. `npx vitest run conversation-inspector.test.tsx output-shape.test.ts result-detail.test.tsx` 재실행 결과 103/103 passed, tsc/eslint 에러 없이 통과.
  - 제안: 없음.

- **[NONE]** `ConversationInspectorProps.conversationMessages` 의 암묵적 계약 강화("자체 복원 가능" → "호출자가 완전히 책임") — 인터페이스 변화지만 현재 유일한 프로덕션 호출자(`result-detail.tsx`)와 정합해 즉각 영향 없음
  - 위치: `conversation-inspector.tsx:167-176`(props JSDoc)
  - 상세: 이전에는 `isLive=false` + 빈 배열을 넘겨도 컴포넌트가 `output.messages` 를 스스로 복원했으나, 이제는 호출자가 넘긴 값을 그대로 신뢰한다. 현재 `<ConversationInspector>` 의 프로덕션 렌더 지점은 `result-detail.tsx` 3곳뿐이며(라이브/이력/폼 preview), 모두 `conversationMessages`/`effectiveConversationMessages` 를 통해 이미 `parseHistoryMessages` 또는 store 사본을 채워 넘긴다(grep 확인). 즉시 회귀는 없다. 이 트레이드오프는 직전 architecture 리뷰가 이미 지적·수용한 것이므로 별도 조치는 불필요하고, 참고로만 재확인한다.
  - 제안: 없음 (향후 신규 호출자를 추가할 때 이 계약 변화를 인지시키는 것으로 충분).

## 요약

이번 델타(`b04654f94` 등, `aee4f75e9..HEAD`)는 직전 리뷰가 지적한 dead code 를 실제로 도달 불가능함을 코드 대조로 재확인한 뒤 삭제한 것으로, 그 "도달 불가" 판단 자체는 `SummaryView`/`parseHistoryMessages` 의 unwrap·우선순위 로직을 직접 대조해 정확함을 검증했다 — 신규 side effect 를 만들지 않는다. 다만 RAG 행 소실에 대한 "의도된 변경" 정당화는 실제보다 온건하게 서술돼 있다: 이는 "history 전용으로 원래도 있었던 비대칭 해소"가 아니라, 직전 커밋(`aee4f75e9`)의 가드 도입이 만든 조용한 회귀(완료된 대화 이력에서 실제로 렌더되던 KB reference 행이 사라짐)를 이번 델타가 코드 삭제로 확정한 것이다 — 신규 실행에는 영향이 없고 원본 데이터도 Output 탭에서는 계속 조회 가능해 완전한 손실은 아니지만, 근거 문서에는 이 프레이밍을 정확히 반영해두는 편이 향후 재질문을 막는다. 또한 producer(인라인 파서)를 삭제하면서 그 반대편 consumer(`RagDetail` 컴포넌트, `isRag` 분기 5곳)를 함께 정리하지 않아 새로운 도달 불가 dead code 가 생겼는데, 이는 이번 fix 커밋이 스스로 내세운 "guard 우회 대신 물리적 삭제" 원칙과 일관되지 않는 잔여 항목이다. 두 지점 모두 즉각적인 기능 파손이나 회귀를 일으키지 않으며(테스트 103/103 재확인), 문서 정확도·코드 정리 수준의 개선 여지로 WARNING/INFO 처리했다.

## 위험도

LOW
