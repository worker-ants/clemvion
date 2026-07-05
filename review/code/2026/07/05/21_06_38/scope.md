# Scope Review — ResultDetail waiting props 공용 hook 추출

커밋: `b6a9c6cf5 refactor(run-results): ResultDetail waiting props 공용 hook 추출 (V-05 후속)`
Diff 대상: 7 files changed, 190 insertions(+), 87 deletions(-)

## 검토 대상 파일
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
- `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx`
- `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` (신규)
- `codebase/frontend/src/components/editor/run-results/__tests__/use-result-detail-waiting.test.ts` (신규)
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `spec/conventions/interaction-type-registry.md`
- `plan/in-progress/spec-code-cross-audit-2026-06-10.md`

## 발견사항

- **[INFO]** registry §1.2 매트릭스 `form`/`ai_form_render` 행 라벨이 `(a)(b)(c)(d)(f)`로 `(e)`를 건너뜀
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 표, `form` 행과 `ai_form_render` 행
  - 상세: drawer(옛 (d))+page(옛 (e)) 두 사이트가 hook 하나 `(d)`로 합쳐지면서 `buttons`/`ai_conversation` 행은 "(a)~(d) 동등"으로 라벨 범위를 정확히 축약했으나, `form`/`ai_form_render` 두 행 자체는 개별 열거에서 `(e)`를 스킵한 채 `(a)(b)(c)(d)(f)`로 남아 표기가 다소 어색함(문법상 오류는 아니고 존재하지 않는 사이트를 참조하지도 않음 — 순수 표기 매끄러움 문제).
  - 제안: 4개 항목이면 `(a)(b)(c)(d)`로 재라벨링해 `(e)`를 완전히 제거하거나, `(f)`를 `(e)`로 당겨 라벨 연속성을 맞추는 사소한 후속 정리(선택 사항, 비차단).

## 스코프 정합성 확인 (문제 없음)

1. **핵심 추출**: `page.tsx`/`run-results-drawer.tsx` 양쪽에서 동일한 11개 store selector + 4개 resume 콜백 + `isWaitingForm/Buttons/Conversation` 파생 로직을 제거하고 신규 `useResultDetailWaiting()` 호출로 치환. 두 소비처의 원본(변경 전) selector 목록과 boolean 파생식이 `git show`로 문자 그대로 일치함을 확인 — 로직 변경 없이 위치만 이동(순수 추출).
2. **`ResultDetail`에 전달되는 props**: 두 소비처의 JSX prop 목록(`isWaitingForm`, `formConfig`, `isWaitingButtons`, `buttonConfig`, `isWaitingConversation`, `conversationConfig`, `conversationMessages`, `isWaitingAiResponse`, `executionId`, `onFormSubmit`, `onAiRenderFormSubmit`, `pendingFormToolCallId`, `onButtonClick`, `onConversationEnd`, `onSelectConversationItem`)이 리팩터 전후 동일 — 소비 측 selector 유실이나 신규 prop 추가 없음. `result-detail.tsx` 자체는 diff에 포함되지 않았고 인터페이스도 미변경.
3. **hook 범위 밖으로 남긴 것들이 정확함**: `waitingNodeId`, `isSelectedWaiting`(계산식은 소비처마다 다름 — drawer는 dual match, page는 단순 비교), drawer의 `isLiveConversation`, conversation item 선택 상태(local vs store action) 모두 diff에서 건드리지 않고 각 소비처에 그대로 유지됨 — hook JSDoc에 명시된 "범위 밖" 설명과 실제 코드가 정확히 일치.
4. **`deriveFlags` 클로저**: 두 소비처의 `isWaitingForm/Buttons/Conversation` 원본 식과 hook 내부 `deriveFlags`의 표현식이 완전히 동일(문자 단위 비교 확인). 신규 로직·신규 분기 없음, 순수 파생 함수로 위치 이동만.
5. **신규 unit test** (`use-result-detail-waiting.test.ts`): 훅의 selector pass-through와 `deriveFlags`의 4개 `WaitingInteractionType` 값별 케이스만 검증 — 추출 범위에 정확히 대응, 오버스펙 없음. 실행 확인(7 tests pass).
6. **REGISTRY_SITES 갱신** (`interaction-type-exhaustiveness.test.ts`): exhaustive 분기가 물리적으로 drawer+page 두 곳에서 hook 한 곳으로 실제로 이동했으므로, grep 대상 파일 목록을 4→3으로 줄이고 `use-result-detail-waiting.ts`로 교체한 것은 코드 이동을 그대로 반영한 필수 동반 변경. 주석 추가분("The exhaustive ... deriveFlags closure ... single site")도 이 변경의 근거를 설명하는 데 국한.
7. **`interaction-type-registry.md` §1.2 갱신**: 각 enum 값 행에서 (d)/(e) 사이트 참조를 hook 단일 사이트로 정정한 것, rule 3 텍스트를 REGISTRY_SITES 3파일로 맞춘 것, drawer 잔여 `isLiveConversation`이 "exhaustive 분기 아닌 subset 소비처"라 grep 대상이 아님을 명시한 것 — 전부 사이트 이동이라는 사실 변경에 정확히 대응하는 최소 갱신. 값 매핑 자체(backend emit 위치, enum 정의, EIA 4→3 매핑, resume/park-entry dispatch 노트 등)는 무변경.
8. **plan 체크박스 갱신**: `spec-code-cross-audit-2026-06-10.md`에서 해당 refactor followup 항목 정확히 1개만 `[ ]`→`[x]`로 갱신 + 완료 근거 기록. 다른 항목(V-10/V-14 등)은 무변경. plan-lifecycle 관례("체크박스=실제 상태") 준수, 무관 항목 손대지 않음.
9. **포맷팅/주석/임포트**: `import { useExecutionStore, selectPendingFormToolCallId }`에서 `selectPendingFormToolCallId`가 page.tsx/drawer.tsx 양쪽에서 제거되고 hook 파일로 이동 — 사용처가 실제로 이동했으므로 정당한 임포트 정리. 무관한 임포트 추가/정리 없음. 순수 포맷팅만 바뀐 hunk 없음(모든 diff hunk가 실질적 코드 이동을 동반).
10. **기능 확장 없음**: `deriveFlags(isSelectedWaiting)`이라는 함수 시그니처 설계는 "Rules of Hooks 준수(store subscribe는 always-called, boolean 파생은 조건부 이후 호출 가능)"라는 실제 제약에 대응하는 최소 설계이며, 신규 기능이나 신규 옵션·파라미터를 추가하지 않음.

## 요약

7개 변경 파일 모두 "waiting selector·resume 콜백·타입별 boolean 파생을 공용 hook으로 추출"이라는 단일 의도에 종속된 필수 변경이다. 두 소비처의 원본 selector·boolean 파생 로직이 hook으로 문자 그대로(로직 무변경) 이동했음을 diff와 git show 대조로 확인했고, `ResultDetail`에 전달되는 최종 props 셋도 리팩터 전후 동일해 소비자 측 selector 유실이나 의도치 않은 동작 변화가 없다. registry(spec)와 exhaustiveness 테스트 갱신은 "exhaustive 분기가 drawer/page 두 물리적 사이트에서 hook 한 사이트로 실제 이동"이라는 사실을 그대로 반영하는 최소 동반 변경으로, 값 매핑·enum 정의·다른 사이트 서술 등은 건드리지 않아 over-reach가 없다. plan 체크박스도 해당 항목 1개만 정확히 갱신했다. 라벨 번호 하나가 다소 어색한 것을 제외하면 리팩터 범위를 벗어나는 항목은 발견되지 않았다.

## 위험도

NONE
