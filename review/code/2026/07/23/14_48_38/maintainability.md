# 유지보수성(Maintainability) 리뷰

## 범위 메모

이번 diff 의 실제 소스는 `output-shape.ts`(JSDoc 재작성, 로직 0줄 변경 — `git diff` non-comment
라인 실측 재확인 완료)와 `output-shape.test.ts`(신규 fixture 3건 + 기존 4개 테스트 주석 정리),
`plan/in-progress/output-shape-comment-followups.md`(신규 plan 문서)다. 나머지 파일 대부분
(`review/code/2026/07/23/14_19_49/**`, `review/code/2026/07/23/14_34_01/**`)은 이전 두 리뷰
라운드의 산출물(SUMMARY/RESOLUTION/개별 리뷰어 결과 등)이 append-only 감사 기록으로 커밋된
것으로, 코드가 아니라 리뷰 이력 데이터다. 프로젝트 관례(`review/` 커밋 의무)상 정상 산출물이며
가독성/네이밍/함수길이/중첩/매직넘버/중복/복잡도 같은 코드 유지보수성 기준을 적용할 대상이
아니라고 판단해 아래 발견사항에서 별도로 다루지 않는다.

## 발견사항

- **[INFO]** `isConversationOutput` JSDoc 이 파일 내 유일하게 Markdown 헤딩(`##`)·blockquote(`>`)
  사용
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:113-162`
  - 상세: 같은 파일의 다른 JSDoc(`extractIeSnapshot`, `AiMetadata`/`extractAiMetadata`,
    `extractTurnDebug` 등)은 평문 + 리스트만 쓰는데 이 함수만 헤딩·blockquote 구조를 쓴다.
    이전 두 리뷰 라운드에서 이미 지적·합의된 사항(plan 항목 3이 스코프를 이 함수로 명시
    한정)이라 이번 라운드에서 새로 발견된 문제는 아니며, 조치를 요구하지 않는다. 다만
    "가장 위험한 단일 함수만 문서를 강화한다"는 의도적 비대칭이 파일을 열어보는 사람에게는
    스타일 drift 로 읽힐 수 있으므로 계속 인지하고 있을 가치가 있다.
  - 제안: 이번 PR 에서는 조치 불요(합의된 결정). 다음에 다른 함수의 JSDoc 을 편집할 기회에
    포맷 통일 여부를 재검토.

- **[INFO]** 신규 isolation 테스트 3건(`rejects result.messages when the endReason key is
  absent entirely`, `detects a terminal whose endReason sits at output.endReason...`,
  `prefers result.endReason over output.endReason...`)이 각각 10~20줄의 유사 구조(취지
  단락 + "이 fixture 가 없으면 …이었다" 반증 서술 + 고립 조건 bullet list)를 반복
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:629-720`
  - 상세: 반복 자체는 파일의 기존 스타일(OR-체인 isolation 테스트 3건)과 일관되고, 각 fixture 가
    잡는 mutation 클래스가 서로 달라 개별 서술이 필요하다는 점도 plan 문서 실측(§측정 1/1b/1c)으로
    뒷받침된다. 다만 describe 블록 전체가 317줄(plan 자체 실측치)까지 불어났고, 그중 절반 이상이
    fixture+근거 주석이라 "비슷한 도입부 문장 스캐닝 피로"가 누적되는 지점이다. plan 문서가 이미
    `it.each` 테이블화 전환을 검토해 NO-GO(순감 4% 미만) 판정을 근거와 함께 내렸으므로, 이 자체를
    재론할 필요는 없다.
  - 제안: 구조 변경 불필요. 향후 이 describe 가 더 커지면(예: 8번째 isolation 테스트 추가) "취지
    단락"을 describe 상단 공유 주석으로 한 번만 서술하고 각 `it` 은 고립 조건 bullet 만 남기는
    방식도 재검토 여지가 있다는 정도로 기록.

- **[INFO]** plan 문서의 mutation 라운드 라벨(R1·R2·R3·H·I·A~G)에 표 밖 legend 가 없음
  - 위치: `plan/in-progress/output-shape-comment-followups.md` "mutation 실측" 절 전체
    (§측정 1/1b/1c/2)
  - 상세: 각 라벨은 해당 표의 "mutation" 열에서 바로 설명되므로 실제 오독 위험은 낮지만, 표
    4개에 걸쳐 흩어진 알파벳/숫자 혼용 라벨(R1~R3, H, I, A~G)을 한 번에 조망할 legend 가 없어
    "12건 전수 재실행" 같은 요약 문장을 검증하려면 표를 오가며 손으로 세어야 한다.
  - 제안: 선택 사항. 문서 상단이나 §측정 2 앞에 라벨→테스트명 대응표 1개를 추가하면 향후
    편집자가 회귀 여부를 더 빠르게 대조할 수 있다.

- **[INFO]** JSDoc "근거의 SoT" 위임 원칙이 실제로 4곳 모두 일관되게 적용됨 (양성 관찰)
  - 위치: `output-shape.ts:158-161` (원칙 선언) ↔ `__tests__/output-shape.test.ts`의 OR-체인
    isolation 3건 + 신규 fallback/우선순위 2건
  - 상세: "왜 이 분기가 존재하는가"는 JSDoc에만, "어떤 필드 존재/부재가 어떤 분기를 고립시키는가"는
    테스트 주석에만 두고 내부 변수명은 "(내부적으로 …)" 각주로만 노출하는 규약이 diff 전수에
    걸쳐 어긋남 없이 지켜지고 있다. 과거 3차례 회귀(#959 등)의 근본 원인이었던 "같은 근거가
    양쪽에 흩어져 한쪽만 갱신되는" 이중 SoT 문제를 구조적으로 차단하는 좋은 설계다.
  - 제안: 없음. 다음 편집자가 이 규약을 계속 지키도록 리뷰 시 확인 포인트로 유지 권장.

## 요약

이번 diff 는 `isConversationOutput` 함수의 실행 로직을 전혀 바꾸지 않는 JSDoc/테스트 주석
재작성과 mutation 고립 fixture 3건 추가, 그리고 그 작업을 추적하는 신규 plan 문서로 구성된다.
가독성·네이밍·일관성 측면에서는 "근거는 JSDoc, 고립 조건은 테스트 주석"이라는 SoT 분리
규약을 4곳 모두 흔들림 없이 적용했고, 이전 두 리뷰 라운드에서 지적된 줄번호 하드코딩·실측
수치 중복 기재 문제도 이번 상태에서는 이미 제거되어 있음을 직접 재확인했다(grep 으로 "39/39",
"output-shape.ts:202" 등 잔존 여부 확인, 잔존 0건). 함수 자체(163~222행, 60줄)는 분기가 많지만
중첩은 1단을 넘지 않고 매직 넘버도 없어 이번 diff 로 새로 생긴 복잡도 문제는 없다. 남은 관찰
사항은 모두 이미 합의됐거나(JSDoc 포맷 비대칭) 사소한 가독성 개선 여지(mutation 라벨 legend,
장기적 describe 비대화) 수준의 INFO 이며, 병합을 막을 사유는 없다.

## 위험도
LOW
