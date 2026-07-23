# 문서화(Documentation) 리뷰 — output-shape.ts / output-shape.test.ts / output-shape-comment-followups.md

## 발견사항

- **[INFO]** JSDoc 정확성 실측 확인 — 통과
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` "rejects result.messages when the endReason key is absent entirely" 주석 (`output-shape.ts:202` 언급)
  - 상세: 테스트 주석이 인용하는 `typeof endReason === "string" &&` 가 실제로 `output-shape.ts` 202행과 정확히 일치함을 직접 대조 확인했다(`CONVERSATION_END_REASONS.has(endReason)` 는 203행). 주석-코드 정합성은 현재 시점에서는 문제 없음.
  - 제안: 없음 (기록용 확인).

- **[INFO]** 주석에 정확한 소스 줄번호를 pin — 향후 드리프트 위험
  - 위치: `output-shape.test.ts` 신규 테스트 주석("(2026-07-23 실측: 제거 시 39/39 green, tsc 는 output-shape.ts:202 에서 실패)") 및 `plan/in-progress/output-shape-comment-followups.md` "측정 1" 표
  - 상세: 특정 줄번호(`:202`)를 주석에 고정 인용하는 방식은 향후 `output-shape.ts` 리팩터링(예: import 순서 변경, 함수 재배치)으로 줄이 밀리면 그대로 stale 해질 수 있다. 다만 이번 diff 자체에서는 정확하므로 CRITICAL/WARNING 은 아니다.
  - 제안: 굳이 수정 불필요. 다음에 이 함수 주변을 편집할 때 줄번호 갱신 여부를 함께 점검하면 충분(이미 이 plan 문서 자체가 "다음 편집 시 함께" 패턴을 따르고 있어 재발 방지 프로세스가 존재).

- **[INFO]** 같은 파일 내 언어 통일 범위가 `isConversationOutput` JSDoc 한 곳으로 국한됨
  - 위치: `output-shape.ts` — `UnwrappedNodeOutput`(1085행 부근) · `extractIeSnapshot`(1284행 부근) · `AiMetadata`/`extractAiMetadata`(1385, 1436행 부근) · `extractTurnDebug`(1487행 부근) JSDoc은 여전히 영어
  - 상세: 이번 변경은 plan 문서 "3. 이월 주석 정리" 항목에서 명시적으로 `isConversationOutput` JSDoc 만 스코프로 잡았고, 파일 전체 언어 통일은 목표가 아니었다(문서화됨). 결과적으로 파일 안에 영어/한국어 JSDoc이 병존하는 상태는 남는다.
  - 제안: 의도된 축소 스코프이므로 이번 PR에서 추가 조치 불필요. 다만 향후 이 파일의 다른 함수를 편집할 때 언어 통일을 함께 검토할 여지가 있다는 점만 참고(차단 사유 아님).

- **[INFO]** CHANGELOG 미갱신 — 적절
  - 위치: 저장소 루트 `CHANGELOG.md` (Unreleased 섹션, 최근 항목들은 사용자 가시 동작 변경/버그 수정 위주)
  - 상세: 본 diff 는 주석·JSDoc·테스트 fixture 추가뿐이며 런타임 로직 변경이 없다고 plan 문서에서 명시("주석·JSDoc 만 바꿨고 소스 로직은 무변경"). 기존 CHANGELOG 항목들의 성격(동작 변경/버그 수정)과 비교했을 때 이번 변경은 CHANGELOG 대상이 아니라고 판단되며, 실제로 갱신되지 않은 것이 적절하다.
  - 제안: 없음.

- **[INFO]** 문서화 관행 자체는 모범적 — JSDoc↔테스트 주석 SoT 분리 명문화
  - 위치: `output-shape.ts` `isConversationOutput` JSDoc 말미("> 근거의 SoT 는 이 JSDoc 이다…") / `output-shape.test.ts` 각 격리 테스트 주석
  - 상세: 과거 3차례 회귀(#959 등)의 근본 원인이 "같은 근거가 JSDoc과 테스트 주석 양쪽에 흩어져 한쪽만 갱신되며 어긋난 것"이었는데, 이번 변경은 "OR-체인 분기가 왜 존재하는가"는 JSDoc에만, "이 fixture가 어떤 분기를 고립시키는가(필드 존재/부재)"는 테스트 주석에만 두도록 역할을 명문화했다. 실제로 diff 전수를 대조한 결과 이 분리가 일관되게 지켜지고 있다(내부 변수명은 "(내부적으로 …)" 각주로만 등장, 4곳 모두 일치 확인). 향후 drift 재발을 구조적으로 억제하는 좋은 패턴.
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** plan 문서(`output-shape-comment-followups.md`) 체크리스트 정합성
  - 위치: `plan/in-progress/output-shape-comment-followups.md` 체크리스트 마지막 항목 `- [ ] /ai-review + Critical/Warning 반영`
  - 상세: 본 리뷰(`/ai-review`)가 그 체크박스가 요구하는 절차 자체이므로 현재 미체크 상태는 타당하다(리뷰 완료 후 체크될 항목). frontmatter `spec_impact: none` 도 규약(리스트 또는 bare `none`)에 부합.
  - 제안: 리뷰 종료 후 해당 체크박스와 RESOLUTION 처리를 통상 절차대로 진행.

## 요약

이번 변경 자체가 문서화 개선(테스트 주석 정밀화 + JSDoc 언어 통일 + 근거 SoT 명문화)을 목적으로 하는 diff이며, 코드 로직 변경은 없다. 대조 검증한 결과 테스트 주석이 인용하는 소스 줄번호·조건은 실제 코드와 정확히 일치하고, "JSDoc = 분기 존재 근거의 SoT, 테스트 주석 = 필드 존재/부재 기반 격리 조건" 이라는 역할 분리가 새 테스트·기존 테스트 4곳 모두에 일관되게 적용되어 있어 과거 회귀(#959)의 재발 경로(이중 SoT drift)를 구조적으로 차단한다. 새로 추가된 README/API 문서/CHANGELOG/설정 문서/예시 코드 요구사항은 해당 사항이 없다(런타임 동작·공개 API·환경변수 변경 없음). 발견된 사항은 모두 INFO 수준(줄번호 pin의 장기 유지보수 리스크, 파일 내 잔존 언어 혼용 스코프 한정)이며 병합을 막을 사유는 없다.

## 위험도
LOW
