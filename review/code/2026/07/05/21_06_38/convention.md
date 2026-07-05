# 정식 규약 준수 검토 — result-detail-props-hook (interaction-type-registry.md 갱신)

대상 diff: `use-result-detail-waiting.ts` 신설(hook 추출) + `spec/conventions/interaction-type-registry.md` §1.2/rule 3 갱신 + `interaction-type-exhaustiveness.test.ts` REGISTRY_SITES 갱신.

## 발견사항

- **[WARNING]** §1.2 매트릭스 레터링 갭 — `(d)` 다음 `(e)` 소거 후 바로 `(f)` 로 점프
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2, `form`/`ai_form_render` 행 (라인 45, 48)
  - 위반 규약: 해당 컨벤션 자체의 표기 관례(문서 내 (a)(b)(c)... 순차 레터 스킴). 명시적 외부 규약 위반은 아니고 문서 자기정합성 이슈.
  - 상세: 이전 버전은 drawer=(d), page=(e), (f)=result-detail.tsx/AssistantPresentationsBlock, (g)=resumeFromAiRenderForm 이었다. 이번 리팩터로 drawer+page 가 hook 하나(`use-result-detail-waiting.ts`)로 합쳐지며 `(d)` 하나만 남았는데, 표에는 `(d)` 다음 `(e)` 를 건너뛰고 바로 `(f)` 로 이어진다 (`form` 행: `...(d) ... (f) ...`, `ai_form_render` 행: `...(d) ... (f) ... (g)`). 문자열만 보면 사이트가 하나 빠졌다는 인상을 주며, "regime 이 3-site 로 줄었다"는 걸 명시적으로 알려주는 문구가 없어 독자가 (e) 가 실수로 빠졌는지 의도적으로 없앤 것인지 판단하기 어렵다.
  - 제안: `(f)` 를 `(e)` 로 재레터링하거나(연쇄 재번호), 혹은 "(e) 는 hook 통합으로 소거됨" 이라는 메모를 1.2 매트릭스 각주나 rule 3 서두에 추가해 갭을 명시적으로 설명. 기능적으로 잘못된 정보는 아니므로 WARNING(가독성/명확성) 등급.

- **[INFO]** rule 3 서술과 REGISTRY_SITES 갯수·구성이 실제 배열과 정확히 일치함(교차검증 결과 문제 없음, 참고용 기록)
  - target 위치: §1.2 rule 3 (라인 53) vs `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 라인 37-41
  - 상세: "현재 REGISTRY_SITES 는 3개 파일 — `use-execution-events.ts`(a·b), `apply-execution-snapshot.ts`(c), `use-result-detail-waiting.ts`(d — drawer·page 공유 deriveFlags 단일 site)" 서술이 실제 배열 `[use-execution-events.ts, apply-execution-snapshot.ts, use-result-detail-waiting.ts]` 과 파일명·순서·개수 모두 일치. 문제 없음.

## 검증 상세 (요청 항목별)

1. **§1.2 매트릭스 (d) 참조** — `form`/`buttons`/`ai_conversation`/`ai_form_render` 4행 모두 (d) 를 `use-result-detail-waiting.ts` `deriveFlags` 로 정확히 갱신. `(f)`(`result-detail.tsx` formPreview / `AssistantPresentationsBlock`)·`(g)`(`resumeFromAiRenderForm`) 는 이번 리팩터로 코드 위치가 변경되지 않았으므로 그대로 유지된 것이 맞다 — 참조 자체는 정확. 다만 위 WARNING 의 레터링 연속성 문제만 존재.

2. **rule 3 프로즈 vs 실제 test 배열** — 일치 확인(위 INFO). 파일 리스트·개수(3)·각 파일이 대표하는 분기((a)(b)/(c)/(d)) 서술이 실제 `REGISTRY_SITES` 배열 및 테스트 파일 내 주석(라인 30-36)과 정확히 대응.

3. **가드 invariant 보존 여부**
   - AST grep 가드(rule 3): `use-result-detail-waiting.ts` 안에 `deriveFlags` 가 `waitingInteractionType === "form"/"buttons"/"ai_conversation"/"ai_form_render"` 4개 literal 을 모두 문자열로 포함하므로, 신규 enum 값이 추가되고 이 hook 이 갱신되지 않으면 grep 가드가 여전히 fail한다 — **invariant 유지**.
   - drawer 잔여 `isLiveConversation` 은 `ai_conversation`/`ai_form_render` 2값만 구분하는 **subset 소비처**(4값 전체를 다루지 않음)이므로 grep 가드 대상에서 제외해도 방어 논리상 정당. exhaustive 분기가 아니라 TS 컴파일러 차원의 별도 커버리지도 없다는 점은 문서가 "TS 로만 커버" 라고 명시했으나, 엄밀히는 `isLiveConversation` 은 exhaustive switch 가 아닌 boolean OR 표현식이라 TS `assertNever` 도 실제로는 적용되지 않는다(신규 5번째 enum 값 추가 시 `isLiveConversation` 갱신을 누락해도 컴파일 에러가 나지 않음). 다만 이는 **drawer 고유 UI 뉘앙스**(2-state 구분)이지 §1.2 표에 등록된 4값 exhaustive 분기가 아니므로, "표의 모든 위치 동시 갱신"(rule 1) 대상에서 원래도 제외되어 있었다(이전 버전에도 `isLiveConversation` 은 표에 등록되지 않았음) — 이번 diff 로 새로 생긴 갭이 아니라 기존 갭의 승계이며, 신규 리스크 도입은 아니다. INFO 수준 참고사항으로만 기록.
   - drawer/page 를 REGISTRY_SITES 에서 제거하고 hook 하나로 대체한 것은 **방어 대상이 정확히 이동**한 것으로, 실제로 drawer/page 어느 쪽이든 `deriveFlags` 를 거치지 않고 자체적으로 `waitingInteractionType` 을 분기하는 새 코드가 추가되면 grep 가드가 캐치하지 못하는 이론적 gap 이 생기지만, 이는 "공용 hook 도입" 리팩터의 통상적 트레이드오프이며 두 소비처 모두 실제로 hook 에 위임하는 것을 diff 로 확인함 — invariant 실질적 저하 없음.

4. **`code:` frontmatter — hook 추가 여부**
   - 확인 결과 이전 버전에서도 `run-results-drawer.tsx`, `page.tsx`, `use-execution-events.ts`, `apply-execution-snapshot.ts`, `result-detail.tsx` 모두 `code:` 목록에 없었다(frontend 쪽은 오직 `interaction-type-exhaustiveness.test.ts` 하나만 등재, 나머지는 backend 파일 6개 + `conversation-utils.ts`). 따라서 신규 hook `use-result-detail-waiting.ts` 를 `code:` 에 추가하지 않은 것은 **기존 패턴과 일관** — 이 필드는 "가드 코드/핵심 계약 정의처"만 선별 등재하는 정책으로 보이며 UI 파생 소비처는 원래 범위 밖. 지적할 위반 없음(요청의 가설대로 "제외가 타당"으로 확인).

5. **문서 구조/cross-ref breakage**
   - 문서 3섹션 구성(§1 WaitingInteractionType / §2 ConversationTurnSource / §3 Presentation type / §4 Rationale) 자체는 변경 없이 보존.
   - 외부에서 이 컨벤션을 참조하는 4개 문서(`spec/1-data-model.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/conventions/i18n-userguide.md`, `spec/conventions/chat-channel-adapter.md`) 를 확인한 결과 모두 §1(enum 개념) 또는 §1.2 앵커를 개념적으로만 인용하며 drawer/page 파일 경로 등 이번에 바뀐 세부 좌표를 인용하지 않음 — cross-ref breakage 없음.
   - `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-05 후속 체크박스가 `[ ]` → `[x]` 로 갱신되고 근거가 상세히 기록되어 있음 — plan 라이프사이클 규약(체크박스=실제 상태) 준수.

## 요약

이번 리팩터는 `interaction-type-registry.md` §1.2 매트릭스·rule 3 프로즈·`interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 3자를 정확히 동기화했다. AST grep 가드의 핵심 invariant(신규 enum 값 누락 시 fail)는 손상되지 않았고, drawer 잔여 `isLiveConversation` 을 가드 대상에서 제외한 것도 subset-consumer 논리로 방어 가능하며 기존 상태의 연장선이다. `code:` frontmatter 에 hook 을 추가하지 않은 것도 frontend UI 소비처를 원래 등재하지 않던 기존 정책과 일관된다. 유일한 흠은 §1.2 표의 `(d)→(f)` 레터링 갭으로, 기능적 오류는 아니지만 문서 자기정합성 측면에서 사소한 혼란을 유발할 수 있다.

## 위험도

LOW
