# 문서화(Documentation) 리뷰 — output-shape.ts / output-shape.test.ts / plan/complete/output-shape-comment-followups.md (4차 라운드, 15_22_40)

## 검증 방법

- `git diff 860aad982(origin/main merge-base) HEAD` 로 실제 코드/문서 diff 3파일이 프롬프트와 일치함을 확인 (나머지 33개 "변경 파일"은 1~3차 리뷰 라운드(`14_19_49`/`14_34_01`/`14_48_38`)의 review 산출물이며 이번 라운드의 신규 리뷰 대상 로직이 아니다 — `review/code/**` 저장 규약(CLAUDE.md)에 부합하는 정규 산출물).
- `output-shape.ts` JSDoc 의 모든 서술(OR-체인 6분기, `endReason` 2단 조회 + `result` 우선순위, 방어적 유지 두 분기)을 실제 함수 본문(160~215행)과 라인 단위로 대조 — 전부 정확히 일치.
- 테스트 파일에 하드코딩 줄번호(`output-shape.ts:202` 등)가 남아있는지 `grep` — **0건**(1차 리뷰 INFO 1 반영으로 코드 앵커 서술로 전환된 상태 유지 확인).
- plan 문서가 인용하는 모든 경로·라인 번호(`executions.ts:27`, `result-detail.tsx:1006/1052`, `result-timeline.tsx:73`, `spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/conversation-thread.md` §9.9 Inv-8, `plan/complete/is-conversation-output-restructure.md`)를 직접 열어 실존·정확성 확인 — 전부 일치(1차 리뷰 INFO 5 의 링크 오류도 이미 분리 수정된 상태 유지).
- `CHANGELOG.md` 확인 — 최근 Unreleased 항목은 전부 사용자 가시 동작 변경/버그 수정. 본 diff 는 주석·테스트·plan 문서뿐이고 `output-shape.ts` non-comment diff 0줄이 여러 라운드에 걸쳐 실측 확인됐으므로 CHANGELOG 대상 아님.

## 발견사항

- **[INFO]** plan 문서(아카이브)에 소스 줄번호 1건 잔존 — 의도된 스냅샷, 실질 위험 낮음
  - 위치: `plan/complete/output-shape-comment-followups.md:66` — `"conjunct 단순 제거 | **TS2345** (output-shape.ts:202, ...)"`
  - 상세: 1차 리뷰(14_19_49) INFO 1 은 "테스트 주석의 하드코딩 줄번호"를 지적했고, 그 반영으로 **테스트 파일**(`output-shape.test.ts`)에서는 줄번호가 전부 코드 앵커(`typeof endReason === "string"` conjunct 등) 서술로 치환되었음을 확인했다(grep 0건). 다만 같은 라운드에 신설된 plan 문서 "측정 1" mutation 표에는 동일한 `output-shape.ts:202` 참조가 그대로 남아 있다. plan 문서 자체가 "표 읽는 법" 절에서 "각 라운드 시점의 수치를 그대로 남긴다(소급 갱신하지 않는다)"고 명시하고 있어, 이는 실수가 아니라 **의도된 역사적 스냅샷**(당시 tsc 에러 위치를 고정 기록)이며, 문서가 `plan/complete/`로 이관되어 향후 `output-shape.ts` 리팩터와 함께 갱신될 대상도 아니다. 다만 미래에 이 plan 파일을 참조하는 개발자가 그 줄번호를 "현재도 유효한 좌표"로 오독할 여지는 이론상 남는다.
  - 제안: 조치 불요(INFO, 기록 목적). 굳이 개선하려면 "표 읽는 법" 각주 옆에 "이 표의 줄번호는 작성 시점(2026-07-23) 스냅샷이며 최신 좌표가 아닐 수 있다"는 한 줄을 덧붙이는 정도로 충분하나, 이미 "각 라운드 시점의 수치" 서술이 사실상 동일한 경고를 하고 있어 필수는 아니다.

- **[INFO]** JSDoc ↔ 테스트 주석 ↔ plan 문서 3중 근거 분리 원칙이 최종 상태에서도 일관 적용됨 — 모범 사례 재확인
  - 위치: `output-shape.ts` `isConversationOutput` JSDoc 말미(SoT 위임 문구) / `output-shape.test.ts` 신규 3건("rejects result.messages when the endReason key is absent entirely", "detects a terminal whose endReason sits at output.endReason...", "prefers result.endReason over output.endReason...") / `plan/complete/output-shape-comment-followups.md` "mutation 실측" 절
  - 상세: 최종 diff 를 다시 대조한 결과, "왜 이 분기가 존재하는가"(JSDoc), "이 fixture 가 어떤 필드 존재/부재로 분기를 고립시키는가"(테스트 주석), "이 fixture 가 어떤 mutation 을 잡는지의 실측 수치"(plan 문서) 세 층위가 이번 4차 라운드까지 포함해 서로 중복 없이 정확히 분리되어 있다. 과거 3차례 회귀(#959 등)의 근본 원인이 "같은 근거가 여러 곳에 흩어져 한쪽만 갱신되며 어긋난 것"이었다는 점을 감안하면, 이 구조는 재발 방지에 실질적으로 기여한다.
  - 제안: 없음 (긍정적 관찰, 향후 이 파일을 편집하는 개발자에게 참고할 만한 패턴).

- **[INFO]** TEST WORKFLOW 섹션의 e2e 면제 자가판단 오류를 감사 무결성 유지하며 투명하게 정정 — 문서화 관행으로 모범적
  - 위치: `review/code/2026/07/23/14_48_38/RESOLUTION.md` "e2e 판정 정정 (중요)" 절, `plan/complete/output-shape-comment-followups.md` "e2e 면제 자가판단은 오류였다 (교훈)" 절
  - 상세: 1·2차 라운드 RESOLUTION 이 "테스트-only 라 재-e2e 불요"라는 잘못된 면제 판단을 기록했는데, 이를 소급 수정하지 않고(과거 스냅샷 보존) 최종 RESOLUTION 과 plan 문서에 정정 사실 자체를 명시적으로 남기는 방식을 택했다. 오류를 은폐하지 않고 "왜 틀렸는지(PROJECT.md §e2e 면제 화이트리스트 인용) + 무엇이 맞는지(실제 e2e PASS 로그 경로)"까지 근거를 남긴 점은 리뷰/plan 문서의 신뢰성을 높인다.
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** README·API 문서·환경변수 문서 영향 없음 — 확인 완료
  - 위치: 전체 diff
  - 상세: 이번 변경은 `codebase/frontend/src/components/editor/run-results/{output-shape.ts,__tests__/output-shape.test.ts}` 의 주석/JSDoc/테스트 fixture 와 `plan/` 문서에 국한되며, `isConversationOutput` 등 export 함수의 시그니처·반환 타입·공개 API·환경변수·설정 옵션은 전혀 변경되지 않았다(여러 라운드에 걸쳐 non-comment diff 0줄 실측 확인). README/API 문서/설정 문서 갱신 대상 아님.
  - 제안: 없음.

## 요약

이번 4차 라운드(15_22_40)의 실질 diff 는 3차 라운드(14_48_38) 이후 추가된 TEST WORKFLOW 재수행 기록(plan 문서 갱신 + RESOLUTION.md 정정)뿐이며, `output-shape.ts`/`output-shape.test.ts` 자체는 3차 라운드에서 이미 검증된 상태(42 테스트, non-comment diff 0줄)로 변경이 없다. 문서화 관점에서 이 PR 전체를 재확인한 결과: JSDoc 은 실제 코드(OR-체인 6분기, `endReason` 2단 조회 및 우선순위)와 완전히 일치하고, plan 문서가 인용하는 모든 파일 경로·라인 번호·spec 섹션이 실존·정확하며, "JSDoc=근거 SoT / 테스트 주석=고립 조건 / plan 문서=mutation 실측치" 3층 분리 원칙이 신규 테스트 3건 전부에 일관 적용되어 과거 반복 회귀(#959)의 재발 경로를 구조적으로 차단하고 있다. e2e 면제 자가판단 오류를 감사 무결성을 지키며 투명하게 정정한 점도 문서화 관행으로 모범적이다. 유일하게 발견된 사항은 plan 문서(아카이브) 내 mutation 실측 표에 남은 소스 줄번호 1건인데, 이는 문서 스스로 "라운드별 시점 스냅샷을 소급 갱신하지 않는다"고 명시한 의도된 기록이라 실질 위험은 낮다. README/API 문서/CHANGELOG/환경변수 문서 갱신 필요성은 없다(런타임 로직·공개 API·설정 무변경). 병합을 막을 사유는 없다.

## 위험도
NONE
