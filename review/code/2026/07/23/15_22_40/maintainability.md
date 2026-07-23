# 유지보수성(Maintainability) 리뷰 — output-shape 이월 처분 (#983 후속, 최종 게이트)

## 범위 확인

이번 diff(`origin/main`..HEAD)는 3라운드에 걸친 `/ai-review` 로 이미 Critical 0 / Warning 0 수렴이
선언된 작업(`plan/complete/output-shape-comment-followups.md`)의 최종 상태다. 직접 재검증했다.

- `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput`
  JSDoc 재작성뿐. `git diff origin/main -- output-shape.ts` 를 라인 프리픽스로 직접 대조한 결과
  **non-comment 변경 0줄** — 함수 본문(OR-체인·AND-guard)·시그니처·다른 export 함수는 바이트
  단위로 무변경.
- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — 신규
  isolation 테스트 3건(`endReason` 키 부재 / `output.endReason` fallback / 우선순위) + 기존 6곳
  주석 정리. `expect(...)` 단언은 6곳 모두 무변경.
- `plan/complete/output-shape-comment-followups.md` — 신규 plan 문서(275줄), 3라운드 리뷰 이력·
  mutation 실측·라벨 legend 를 포함해 `complete/` 로 이미 이관됨.
- `review/code/2026/07/23/{14_19_49,14_34_01,14_48_38}/**` (33개 파일) — 선행 3라운드의 리뷰
  산출물(SUMMARY/RESOLUTION/reviewer 리포트/meta). 코드가 아니라 append-only 감사 기록이며
  프로젝트 규약(`review/**` 커밋 의무)상 정상 산출물이다. 통상적 코드 유지보수성 기준(가독성·
  네이밍·함수 길이·중첩·매직넘버·중복·복잡도)의 적용 대상이 아니라고 판단해 개별 지적하지 않는다.

## 발견사항

- **[INFO]** `isConversationOutput` JSDoc 만 파일 내 유일하게 Markdown 헤딩(`##`)·blockquote(`>`)
  사용
  - 위치: `output-shape.ts:113-158`
  - 상세: 같은 파일의 `unwrapNodeOutput`/`extractIeSnapshot`/`AiMetadata`·`extractAiMetadata`/
    `extractTurnDebug` JSDoc 은 평문+불릿만 쓰는데, 이 함수만 `## 방어적 유지` 헤딩과
    `> **근거의 SoT 는 이 JSDoc 이다.**` blockquote 를 쓴다(직접 대조 확인). 이미 1·2·3차 리뷰
    전원이 "plan 항목 3 에 명시된 의도된 결정, 스코프 이탈 아님" 으로 합의한 사안이라 신규
    지적은 아니다.
  - 제안: 이번 라운드도 조치 불요. 다음에 나머지 함수 JSDoc 을 편집할 기회에 포맷 통일 여부만
    재검토.

- **[INFO]** `isConversationOutput` 자체의 분기 복잡도는 여전히 높다(사전 존재, 이번 diff 로직
  무변경)
  - 위치: `output-shape.ts:159-217`
  - 상세: 최상위 게이트 1개(OR 2항, 그 중 1항은 AND) + 중간 불리언 6개(`hasResultMessages`,
    `hasLegacyMessages`, `outputInteraction`, `metaInteraction`, `hasConvConfig`,
    `looksLikeConversationEnd`, `isCanonicalWaiting`) + 최종 반환 4-way OR(그 중 1항은 AND 내부에
    OR 포함) 구조로, 함수 하나의 순환 복잡도가 낮지 않다. 다만 이는 "6차례 마이그레이션을 거친
    열린 JSON 에 대한 heuristic 판정" 이라는 도메인 제약에서 나오는 필연적 복잡도이고(plan 항목 1
    이 discriminated union 재설계를 NO-GO 로 실측 판정한 근거와 동일), 변수명이 각 disjunct 의
    의미를 그대로 드러내며, 7개 mutation 이 각각 정확히 대응 테스트 1건만 red 로 만드는 것이
    실측 확인돼 있어("측정 2", plan §mutation 실측) 복잡도가 안전망 없이 방치된 상태는 아니다.
    이번 diff 는 이 로직을 1바이트도 건드리지 않았으므로 차단 사유가 아니다.
  - 제안: 조치 불요(diff 범위 밖). 향후 이 함수의 판정 로직 자체를 편집하게 되면 그때 리팩터
    필요성을 재평가.

- **[INFO]** 신규 isolation 테스트 3건이 각각 15~35줄의 유사 구조(취지 단락 + "이 fixture 가
  없으면 …이었다" 반증 서술 + 고립 조건 bullet)를 반복
  - 위치: `output-shape.test.ts` "rejects result.messages when the endReason key is absent
    entirely" / "detects a terminal whose endReason sits at output.endReason…" /
    "prefers result.endReason over output.endReason…" (약 629-720행 부근)
  - 상세: 반복 자체는 파일에 이미 확립된 OR-체인 isolation 테스트 패턴과 일관되며, 각 fixture 가
    잡는 mutation 클래스(R1/R2, H, I)가 서로 달라 개별 서술이 정당화된다 — plan
    §mutation 실측(측정 1/1b/1c)이 그 근거를 실측으로 뒷받침한다. `it.each` 테이블화는 이미 plan
    항목 4 에서 "순감 4% 미만" 실측 근거로 NO-GO 처리됐다. `describe` 블록이 300줄을 넘는 수준까지
    자랐지만, 부피의 원인이 보일러플레이트가 아니라 fixture+근거 주석이라는 점도 실측돼 있다.
  - 제안: 구조 변경 불필요(이미 근거 있는 기각). 향후 이 describe 에 8번째 이상 isolation 테스트가
    추가될 경우, 취지 단락을 describe 상단 공유 주석으로 한 번만 두고 각 `it` 은 고립 조건 bullet
    만 남기는 방식을 재검토할 여지가 있다는 정도로만 기록.

- **[INFO]** JSDoc "근거의 SoT" 위임 원칙이 최종 상태에서 5곳(JSDoc 1 + isolation 테스트 6+3건)
  모두 일관되게 적용됨 — 양성 관찰
  - 위치: `output-shape.ts:113-158`(원칙 선언) ↔ `output-shape.test.ts` 전체 isolation 테스트
  - 상세: "왜 이 분기가 존재하는가" 는 JSDoc 에만, "이 fixture 가 어떤 필드 존재/부재로 어떤 분기를
    고립시키는가" 는 테스트 주석에만 있고 내부 변수명은 "(내부적으로 …)" 각주로만 등장하는 규약이
    신규 fallback/우선순위 테스트 2건에도 예외 없이 지켜진다. 과거 3차례 회귀(#959 계열)의 근본
    원인이던 "같은 근거가 양쪽에 흩어져 한쪽만 갱신되는" drift 를 구조적으로 차단하는 설계로,
    3라운드에 걸쳐 재검증됐음에도 재발하지 않았다.
  - 제안: 없음. 다음 편집자가 이 규약을 깨지 않도록 향후 리뷰 시 확인 포인트로 유지 권장.

- **[INFO]** 리뷰 산출물 축적 — 회고적 관찰(비차단, 코드 문제 아님)
  - 위치: `review/code/2026/07/23/{14_19_49,14_34_01,14_48_38}/**` (33개 파일)
  - 상세: 동일 작업에 대해 거의 동일한 내용(non-comment diff 0줄 재확인, spec 앵커 재검증 등)이
    3라운드에 걸쳐 반복 기록돼 있다. 이는 결함이 아니라 프로젝트가 명시적으로 요구하는 append-only
    감사 트레일 관례(각 라운드 결과를 소급 수정하지 않고 새 폴더에 남김)의 의도된 결과이며, 실제로
    각 라운드가 실측 재현되는 실질 갭(H·I)을 하나씩 닫아 doc-loop 이 아닌 진짜 수렴이었음이 plan
    문서에 기록돼 있다. 유지보수성 관점에서 "코드" 로 다룰 대상이 아니라는 판단을 재확인한다.
  - 제안: 없음.

## 요약

이번 라운드(4차, 최종 게이트)에서 독립적으로 재검증한 결과, 실제 소스(`output-shape.ts`)는 여전히
non-comment diff 0줄이고 판정 로직·시그니처는 완전히 무변경이다. 테스트 파일은 3라운드에 걸쳐
mutation 실측으로 검증된 isolation fixture 3건(키 부재·fallback 단·우선순위)만 추가됐고, 이전
라운드들이 지적한 문서화 갭(줄번호 하드코딩, 근거 이중 기록, JSDoc 의 fallback 서술 누락, mutation
라벨 legend 부재)은 모두 실코드 대조로 반영 확인됐다. 남아 있는 관찰 사항은 전부 이미 1~3차
라운드에서 실측 근거와 함께 "의도된 결정" 또는 "diff 범위 밖 사전 존재" 로 합의된 INFO 수준
비차단 항목의 재확인이며, 이번 diff 로 새로 도입된 유지보수성 결함은 없다. `isConversationOutput`
의 높은 분기 복잡도 자체는 여전히 남아 있으나, 그것이 오늘 diff 의 산물이 아니고(로직 0줄 변경)
mutation-고립 테스트 전량이 안전망으로 작동함이 실측돼 있어 이번 게이트에서 새로 지적할 사유가
아니다.

## 위험도
NONE
