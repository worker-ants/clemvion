# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 신규 테스트 주석에 소스 파일의 구체적 줄번호(`output-shape.ts:202`)를 하드코딩
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:805` ("rejects result.messages when the endReason key is absent entirely")
  - 상세: `(2026-07-23 실측: 제거 시 39/39 green, tsc 는 output-shape.ts:202 에서 실패)` 라는 주석이 소스 파일의 구체 줄번호를 못박고 있다. 현재는 실제로 `output-shape.ts:202` 가 `typeof endReason === "string" &&` 와 일치하지만(확인함), 이 함수 상단의 JSDoc(현재 40줄 이상)이나 그 위 코드가 조금만 편집돼도 줄번호가 밀려 주석이 stale 해진다. 자동으로 drift 를 잡아줄 장치가 없어 향후 편집자를 오도할 수 있다.
  - 제안: 줄번호 대신 "`typeof endReason === \"string\"` conjunct" 처럼 코드 앵커(식별자/표현식) 기준으로 서술하거나, 최소 "PR 작성 시점 기준" 임을 명시해 stale 가능성을 스스로 표시.

- **[INFO]** mutation 실측 서술이 테스트 주석과 `plan/in-progress/output-shape-comment-followups.md` 양쪽에 거의 동일한 내용(R1/R2/R3, TS2345, 39/39 green)으로 중복 기록됨
  - 위치: `output-shape.test.ts:800-813` (신규 테스트 주석) vs `plan/in-progress/output-shape-comment-followups.md` "측정 1 — 신규 테스트(항목 2)가 잡는 리팩터 클래스" 표
  - 상세: 이번 diff의 `isConversationOutput` JSDoc 자체는 "같은 근거를 양쪽에 두면 한쪽만 갱신돼 어긋난다" 는 원칙을 명문화해 OR-분기 근거의 이중 SoT 문제를 해소했다. 그런데 바로 옆 신규 테스트가 추가한 mutation 측정 서사(R1/R2/R3 결과)는 그 원칙을 적용받지 않고 plan 문서와 사실상 같은 내용을 다시 서술한다. plan 문서는 작업 완료 후 `complete/` 로 이관되면 코드에서 멀어지므로, 두 서술이 갈라질 경우 어느 쪽이 최신인지 판단할 SoT가 없다.
  - 제안: 필수는 아니나, 테스트 주석은 결론(R1/R2가 잡는 리팩터 클래스)만 남기고 실측 표/수치는 plan 문서로 위임하는 편이 이번 diff가 JSDoc에 채택한 SoT 위임 패턴과 일관적.

- **[INFO]** 파일 전체 언어가 여전히 영어/한국어 혼재 상태로 남음(이번 diff 범위 밖)
  - 위치: `output-shape.ts` — `unwrapNodeOutput`(영어 주석, 미변경), `isConversationOutput` JSDoc(이번 diff로 한국어 통일), `CONVERSATION_END_REASONS`(기존부터 한국어)
  - 상세: 이번 변경은 "언어 혼용 정리" 를 명시적 목표(plan 항목 3)로 삼아 `isConversationOutput` JSDoc을 한국어로 통일했고 이는 실제로 파일 내 지배적인 언어(한국어)와의 정합성을 높인다. 다만 `unwrapNodeOutput`/`UnwrappedNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등 나머지 함수 주석은 여전히 영어로 남아 파일 단위로는 혼재가 지속된다.
  - 제안: 신규 이슈는 아니며 이번 diff가 스코프를 명확히 좁힌 것(가장 위험한 단일 함수)은 합리적 선택이다. 향후 이 파일을 다시 편집할 기회에 나머지 주석도 정리 대상으로 plan에 남겨두면 좋다(이미 유사 패턴의 plan 문서 관행이 있음).

## 요약

이번 diff는 런타임 로직 변경이 전혀 없는 **주석/문서/테스트 전용 변경**이다(코드 diff는 `output-shape.ts` JSDoc 재작성과 테스트 파일의 주석 정리 + 신규 음성 테스트 1건 추가뿐, 함수 본문·타입은 무변경). `isConversationOutput`의 근거 서술을 JSDoc 한 곳으로 모으고 테스트 주석은 "어떤 필드 존재/부재가 어떤 분기를 고립시키는가"만 남기도록 재편한 것은 이중 SoT(문서 drift)로 인한 과거 회귀(#959)를 구조적으로 예방하는 좋은 설계 결정이며, 위임 규약 자체를 JSDoc 말미에 명문화해 다음 편집자가 다시 갈라놓지 않게 한 점도 유지보수성에 긍정적이다. 신규 테스트는 기존 6건과 동일한 "필드 존재/부재 기반 고립 조건" 서술 스타일을 일관되게 따르고, mutation 실측 근거까지 상세히 남겨 회귀 방지 의도가 명확하다. 다만 신규 테스트 주석에 박아 넣은 소스 줄번호 하드코딩과, plan 문서와 겹치는 mutation 서사 중복은 이번 diff가 스스로 세운 "단일 SoT" 원칙에서 살짝 벗어난 지점으로, 경미하지만 향후 stale 위험이 있다. 전반적으로 가독성·네이밍·일관성 면에서 개선 방향이며 새로 도입된 구조적 문제는 없다.

## 위험도
LOW
