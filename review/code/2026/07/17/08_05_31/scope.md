# 변경 범위(Scope) Review — 직전 리뷰 지적 반영 fix 델타 (aee4f75e9..HEAD)

대상 커밋: `b04654f94`(코드 fix) + `ea6f5f85c`/`4e6e079e5`(review/** 산출물, 코드 변경 없음)
비교 기준: `review/code/2026/07/17/07_12_33/` 의 architecture·maintainability·scope·testing·documentation WARNING/CRITICAL 지적 목록

## 발견사항

- **[INFO]** 코드 fix 커밋(`b04654f94`)의 diff(10 files, 78 insertions / 104 deletions)는 직전 리뷰 지적 7건에 1:1로 대응하며, 각 지적이 요구한 것 이상의 변경을 포함하지 않는다
  - 위치: `codebase/frontend/src/components/editor/run-results/{conversation-inspector.tsx,output-shape.ts}` + `__tests__/{conversation-inspector.test.tsx,output-shape.test.ts,fixtures/conversation-scenarios.ts}` + `spec/{2-navigation/14-execution-history.md,3-workflow-editor/3-execution.md,conventions/conversation-thread.md}` + `lib/websocket/{use-execution-events.ts,__tests__/use-execution-events.test.ts}`
  - 상세: 커밋 메시지의 각 절(§7.9 정정 / dead code 제거 / endReason 화이트리스트 테스트 / ReadonlySet 전환 / fixture 주석)이 실제 diff hunk와 정확히 일치함을 `git show b04654f94` 로 파일별 대조했다. `output-shape.ts`는 신설 `CONVERSATION_END_REASONS` 상수와 `looksLikeConversationEnd` 판정 로직 교체 외에 다른 라인 변경이 없고(`MULTI_TURN_INTERACTION_TYPES` 등 인접 코드 무변경), `use-execution-events.ts`/`use-execution-events.test.ts`는 §7.9 경로 문자열 1줄 주석 정정뿐이다. 지적 대상이 아닌 파일(`result-detail.tsx`, `execution-store.ts` 등)은 이번 델타에 전혀 등장하지 않는다 — 직전 리뷰의 side_effect #10/#11, security 지적(비AI 실패 전용 테스트, `cancelled` 표면, redaction) 은 RESOLUTION.md 가 "후속/기존갭"으로 명시적으로 분류한 대로 실제 코드도 손대지 않았음을 확인했다.
  - 제안: 없음.

- **[INFO]** `conversation-inspector.tsx`의 orphan 심볼 5개 제거는 architecture WARNING이 지목한 대상과 정확히 일치하며 과잉 제거가 없다
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`
  - 상세: 커밋 메시지가 명시한 5개(`useMemo`/`tryParseJson`/`stripInlineMarkers`/`RAG_CONTEXT_MARKER`/`isRagContextContent`)를 파일 전체에서 grep한 결과 잔존 참조가 0건이었다 — 삭제가 누락 없이 완결됐다. 동시에 남은 4개 React 훅(`useState`/`useCallback`/`useRef`/`useEffect`)은 파일 내에서 여전히 2회 이상씩 사용 중임을 확인해, import 정리가 "필요한 것만" 제거했고 부수적으로 다른 심볼까지 걷어내지 않았다. 삭제된 55줄의 인라인 재파싱 블록(`turnCounter`/`callNameById`/RAG 감지)은 직전 리뷰 architecture WARNING이 "도달 불가능한 dead code"로 명시 지목한 바로 그 블록이며, 삭제 후 `items = conversationMessages` 로 축소한 것도 리뷰의 제안(`제안: 인라인 재파싱 블록을 완전히 삭제하고 items = conversationMessages 로 축소`) 문구를 그대로 따른다. architecture 리뷰가 별도로 지목한 `hasLiveSystemError` identity 매칭(`nodeExecutionId` 우선순위) 개선이나 `useMemo` 승격 제안은 이번 델타에 반영되지 않았는데, 이는 RESOLUTION.md에서 별도 처분 대상으로도 언급되지 않은 INFO 등급 제안이라 범위 확장 없이 손대지 않은 것이 오히려 최소 변경 원칙에 부합한다.
  - 제안: 없음.

- **[INFO]** `output-shape.ts`의 `ReadonlySet` 전환은 maintainability WARNING이 요구한 리팩토링 범위에 정확히 국한된다
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:111-338`
  - 상세: 신설 `CONVERSATION_END_REASONS` 상수는 파일에 이미 존재하는 `MULTI_TURN_INTERACTION_TYPES` 패턴(`ReadonlySet<string>` + `new Set([...])`)을 그대로 복제한 것으로, "파일 기존 패턴 미준수"라는 maintainability 지적을 정확히 해소하는 국소 변경이다. `isConversationOutput` 함수의 다른 판정 로직(예: `hasResultMessages`, waiting shape 판정)은 diff 밖이며, 같은 함수 내에서 architecture INFO가 "근본 원인"으로 지목한 heuristic OR-체인 자체의 구조 개선(exhaustiveness guard 도입)은 RESOLUTION.md가 "후속 백로그"로 명시 이관했고 실제로 손대지 않았다.
  - 제안: 없음.

- **[INFO]** `output-shape.test.ts` endReason 열거 갱신은 scope+testing WARNING의 지시(제거 대신 테스트 추가)를 정확히 실행했다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:574-590`
  - 상세: 직전 scope 리뷰는 `'condition'` 제거 또는 테스트 추가 중 택일을 제안했고, testing 리뷰는 `condition`/`error` 를 `endReasons` 배열에 추가하라고 구체적으로 지시했다. 이번 변경은 정확히 그 배열에 두 값을 추가하는 것 외에 테스트 파일의 다른 부분(다른 `it` 블록, import, setup)을 건드리지 않았다.
  - 제안: 없음.

- **[INFO]** `conversation-inspector.test.tsx` 배선 갱신은 dead code 삭제의 필연적 귀결이며 독립적 스코프 확장이 아니다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx:6-13, 435-448`
  - 상세: `parseHistoryMessages` import 추가와 `conversationMessages={[]}` → `conversationMessages={parseHistoryMessages(result.outputData)}` 교체 1건뿐이다. `items = conversationMessages` 로 컴포넌트가 재파싱을 하지 않게 되면서 빈 배열을 넘기던 옛 테스트는 필연적으로 red가 되므로(실제로 RESOLUTION.md가 이 red→green 전환을 "테스트가 검증하던 배선이 실제 프로덕션과 달랐던 것이 드러난 것"으로 기록), 이 수정 없이는 아키텍처 fix 자체가 성립하지 않는다 — 요청 범위를 벗어난 편승이 아니라 삭제의 직접 파생이다. 커밋 메시지가 언급하는 "history tool 테스트를 프로덕션 배선대로 갱신"이라는 문구와도 일치하며, testing 리뷰가 지목했던 "R4 격리 단위 테스트 부재" 자체를 새 테스트로 메우지는 않았다(별도 신규 테스트 케이스 추가 없이 기존 테스트 1건의 fixture만 교체) — 이는 오히려 범위를 확장하지 않은 보수적 선택이다.
  - 제안: 없음.

- **[INFO]** fixture 헤더 주석 갱신은 순수 comment-only 변경으로 로직에 영향이 없다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts:259-273`
  - 상세: `makeErroredConversationOutput` 함수 자체와 export되는 fixture 값은 변경되지 않았고, JSDoc 주석만 신규 시나리오(CT-S15~17)의 범위·소비 테스트 파일을 명시하도록 확장 + §7.9 경로 정정 1건이 포함됐다. maintainability WARNING이 "stale 주석" 을 지적한 범위와 정확히 일치.
  - 제안: 없음.

- **[INFO]** spec 3개 문서(4개 인용 위치) + 코드 주석 3곳의 §7.9 경로 정정은 documentation CRITICAL이 요구한 전수 정정이며 과부족이 없다
  - 위치: `spec/2-navigation/14-execution-history.md:236`, `spec/3-workflow-editor/3-execution.md:514,608`, `spec/conventions/conversation-thread.md:364`, `codebase/frontend/src/lib/websocket/use-execution-events.ts`, `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`, `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts`
  - 상세: `spec/conventions/conversation-thread.md` 내 CT-S15 행에도 동일 오류 참조가 있었고 diff에 포함돼 있어(§9.10 표 안에서 1건 추가 발견) 실질적으로 spec 쪽 정정 위치는 4곳(3파일), 코드 주석은 3곳으로 커밋 메시지의 "spec 4곳 + 코드 주석 3곳"과 정확히 일치한다. 저장소 전체를 `grep -rn "5-system/4-execution-engine.md"` 로 재검색해 "§7.9" 와 결합된 잔존 오참조가 0건임을 직접 확인했고, 남아있는 `5-system/4-execution-engine.md` 참조 2곳(`spec/4-nodes/3-ai/1-ai-agent.md:1296`, `spec/conventions/node-output.md:216`, `ai-turn-executor.ts` 주석 2곳)은 §7.9 가 아닌 다른 섹션(§1.1+§2.1, §1.3)을 정확히 가리키는 기존 정당한 참조이므로 이번 fix가 손댈 필요가 없는 영역이다. 정정된 앵커(`#79-multi-turn-모드--오류-error-포트`)가 `spec/4-nodes/3-ai/1-ai-agent.md:913` 의 실제 `### 7.9 Multi Turn 모드 — 오류 (error 포트)` 헤딩과 일치함도 직접 대조했다.
  - 제안: 없음.

- **[INFO]** `conversation-thread.md` §9.10 표 빈 줄 제거와 Inv-7/Inv-8 순서 교정은 선언된 CRITICAL/WARNING 범위 내 최소 수정이다
  - 위치: `spec/conventions/conversation-thread.md:571-578, 596-602`
  - 상세: `git show`로 확인한 실제 diff는 (1) CT-S14와 CT-S15 사이의 빈 줄 1개 삭제(표 파손 복구), (2) Inv-7과 Inv-8 두 줄의 순서 교체(내용 자체는 무변경, 위치만 교환) 2건뿐이다. 표 재검사(`grep "^| CT-S"`) 결과 CT-S1~CT-S17이 단일 연속 GFM 테이블로 복원됐음을 확인했고, Inv 목록도 Inv-1~Inv-8이 순번대로 나열됨을 확인했다. 이 두 항목과 무관한 §9.9/§9.10의 다른 서술(Inv-1~6 본문, CT-S1~14 행 내용)은 바이트 단위로 무변경이다.
  - 제안: 없음.

- **[INFO]** review/** 산출물 커밋(`ea6f5f85c`, `4e6e079e5`)은 코드/스펙에 전혀 영향을 주지 않는 프로세스 문서로, scope 판정 대상인 "코드 변경"과는 구분된다
  - 위치: `review/code/2026/07/17/07_12_33/*`, `review/consistency/2026/07/17/00_32_29/*`, `review/consistency/2026/07/17/00_57_13/*`
  - 상세: 두 커밋은 `review/**` 경로에만 27+1개 신규 파일을 추가하며 `codebase/**`·`spec/**`·`plan/**` 어느 것도 건드리지 않는다(`git diff --stat aee4f75e9..HEAD -- plan/` 결과 0건). 이는 CLAUDE.md가 규정한 "코드 리뷰 산출물은 `review/code/**`" 저장 위치 규약 및 "review-fix 커밋이 게이트를 재무장하지 않도록 마지막은 review/** 전용 커밋으로 종결" 관행과 정확히 일치하는 표준 워크플로 산출물이므로 scope creep으로 볼 수 없다.
  - 제안: 없음.

## 요약

`aee4f75e9..HEAD` 델타는 직전 리뷰(`07_12_33`)의 Critical 2건(§7.9 경로 오류, §9.10 표 파손)과 fix 대상 Warning 8건 각각에 좁게 대응하는 국소 변경으로 구성되어 있다. 특히 우려 지점이었던 "orphan 심볼 5개 제거"는 architecture 리뷰가 명시 지목한 심볼 집합과 정확히 일치하고(grep으로 잔존 0건 확인), 다른 훅·심볼까지 확대 정리하지 않았다. `ReadonlySet` 전환·endReason 테스트 갱신·fixture 주석·§7.9 경로 정정·Inv 순서 교정 모두 해당 지적이 요구한 최소 범위를 넘지 않으며, 지적되지 않은 인접 개선 제안(architecture INFO의 `nodeExecutionId` identity 매칭, `useMemo` 승격, `isConversationOutput` heuristic 구조 개선, side_effect/security 후속 항목)은 RESOLUTION.md가 명시적으로 "후속 백로그"·"기존 갭"으로 분류한 대로 이번 델타에서 실제로 손대지 않았음을 코드 대조로 확인했다. review/** 산출물 2개 커밋은 프로젝트 표준 워크플로에 따른 문서화이며 코드·스펙 변경과 무관하다. 요청받은 지적 대응을 넘어선 편승 변경(scope creep)은 발견되지 않았다.

## 위험도

NONE
