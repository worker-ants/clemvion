# 문서화(Documentation) 리뷰 — eia-masking-round2 (라운드 2, resolution 후 fresh review)

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 stale-문장 수정(직전 라운드 WARNING #4 fix)이 존재하지 않는 "아래 항목"을 가리키는 새로운 오류를 만들었다
  - 위치: `CHANGELOG.md:39` (`(프런트 마커 가드는 **아래 항목에서 폼 프리필에 먼저 구현**됐다 — Re-run·히스토리 로드로`)
  - 상세: 직전 라운드(`review/code/2026/08/17/12_06_12/`) 의 documentation WARNING(`CHANGELOG.md` 가 "프런트 마커 가드는 트래커에 등재했다"는 stale 문장을 유지 중)을 해소하려고 그 문장을 "아래 항목에서 폼 프리필에 먼저 구현됐다"로 고쳤다(`RESOLUTION.md` §4). 그런데 이 저장소 `CHANGELOG.md` 는 **최신이 위로 쌓이는** 구조다 — 같은 파일 line 24 가 "`#1177`(아래 항목 — CHANGELOG 는 최신이 위로 쌓인다)이 종결 emit 경로에…"라고 이 관례를 스스로 명시하며, 거기서 "아래 항목"은 **더 오래된**(따라서 파일에서 더 아래에 있는) PR 항목을 정확히 가리킨다. 반면 line 39 의 "아래 항목"은 **이번 PR(현재 리뷰 대상 diff) 자신이 구현한** `DynamicFormUI.isMaskedMarker` 프리필 가드를 가리키려는 의도인데, 이건 이번 절과 같거나 더 새 시점의 변경이라 존재한다면 **위**(더 최신 섹션)에 있어야 한다. 게다가 실측(`grep -n "프리필\|DynamicFormUI\|isMaskedMarker\|왕복" CHANGELOG.md`)으로 확인한 결과, "폼 프리필" 가드를 설명하는 별도 항목은 파일 전체에 **존재하지 않는다** — `DynamicFormUI`/`isMaskedMarker` 문자열은 CHANGELOG 어디에도 없고, "프리필"은 이 줄(자기 참조)과 line 33(Re-run 모달 얘기, 다른 메커니즘)에만 등장한다. 즉 이 PR 이 고친 실질 결함(폼 `defaultValue` 프리필이 마스킹 마커를 그대로 되쓰는 왕복 오염, `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 가 "CRITICAL 과 같은 클래스"라고 명시한 결함)은 이 시리즈의 다른 3개 커밋(#1177/#1179/#1180, 각각 자기 `## Unreleased` 항목 보유)과 달리 **독립 CHANGELOG 항목이 없고**, 존재하지도 않는 항목을 가리키는 죽은 포인터만 남았다. 직전 라운드 documentation 리뷰어가 제안한 두 선택지("문장 갱신" 또는 "새 Unreleased 하위 항목 추가") 중 전자를 택했는데, 그 결과물이 문법적으로는 "구현됐다"고 과거형으로 말하면서 존재하지 않는 곳을 참조해 사실상 검증 불가능한 서술이 됐다.
  - 제안: `39-40` 행의 "아래 항목에서 폼 프리필에 먼저 구현됐다"를 "이번 커밋에서 폼 프리필(`DynamicFormUI.isMaskedMarker`)에 먼저 구현했다"처럼 자기-완결적 서술로 바꾸거나, 이 PR 을 위한 새 `## Unreleased — 폼 defaultValue 프리필이 마스킹 마커를 되쓰던 왕복 오염 (프런트 가드)` 항목을 이 절 **위**에 추가하고 여기서는 그 항목을 가리키게(`## Unreleased — 폼 defaultValue 프리필 왕복 오염 (위 항목)` 식으로 "위 항목"이라 정정) 한다. 이 시리즈의 다른 3개 자매 커밋(#1177/#1179/#1180)이 모두 자기 항목을 가졌던 선례를 고려하면 후자가 이 저장소 관행과 더 일치한다.

- **[INFO]** 마커 상수·함수 리네임(`MASK_MARKERS`→`MASKED_MARKERS`, `isMaskedValue`→`isMaskedMarker`, 직전 라운드 maintainability WARNING #6 fix)이 backend/frontend 양쪽 JSDoc·주석·`{@link}` 참조 전부에 정확히 반영됐음을 확인(발견 아님, 긍정 확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95,124-126,128,134-135,261-262`, `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:335,339,371-372,376,378,473`
  - 상세: `grep -n "MASK_MARKERS\|isMaskedValue\|MASKED_MARKERS\|isMaskedMarker"` 로 두 파일과 테스트 파일을 전수 대조한 결과, 옛 이름(`MASK_MARKERS`/`isMaskedValue`)의 잔존은 0건이고 새 이름이 backend 정의·frontend 미러·상호 참조 주석(`{@link MASKED_MARKERS}` 등) 전부에서 일관됨. 테스트 파일(`dynamic-form-ui.test.tsx`)은 애초에 이 심볼을 직접 import 하지 않고 마커 리터럴만 쓰므로 리네임의 영향을 받지 않음.

- **[INFO]** spec §R17 "프리필 왕복" 신설 불릿·`12-background.md` §8.2·`15-chat-channel.md` §R-CC-15 세 spec 변경 모두 코드·plan 체크리스트와 line-level 로 일치(발견 아님, 긍정 확인)
  - 위치: `spec/5-system/14-external-interaction-api.md` (line 1552-1569 부근), `spec/4-nodes/1-logic/12-background.md:246`, `spec/5-system/15-chat-channel.md:659`
  - 상세: impl-prep W1(`12-background.md` §8.2 에 `outputData`/`inputData` 마스킹 반영)·W2(`nodeName`→`nodeLabel` 정정)가 diff 에 정확히 반영됐고, 두 번째 consistency-check 라운드(`review/consistency/2026/08/17/12_06_15/SUMMARY.md`)가 5개 checker 전원 위험도 NONE 으로 이를 이미 재확인했다. §R17 "프리필 왕복" 불릿은 판단 기준(외부 노출 여부로 마커 가드 vs carve-out 선택)·SoT(backend 상수)·동기화 의무를 정확히 서술하며 구현과 부합한다.

## 요약

이번 diff 는 직전 라운드(`12_06_12`) 리뷰의 WARNING 6건이 전부 조치되고 두 번째 consistency-check 라운드(`12_06_15`)가 NONE 위험도로 수렴한, 이미 상당히 정제된 상태를 담고 있다. 실측으로 재검증한 결과 마커 리네임(`MASKED_MARKERS`/`isMaskedMarker`)은 backend/frontend 전역에서 완전히 일관되고, 세 spec 파일 갱신도 코드·plan 과 정확히 대응한다. 다만 직전 라운드 WARNING #4("CHANGELOG stale") 를 고치는 과정에서 새로운 결함이 생겼다 — 고친 문장이 "아래 항목에서 구현됐다"고 말하지만 그런 항목은 CHANGELOG 어디에도 없고, 이 파일 스스로 다른 곳(line 24)에서 증명하는 "최신이 위로 쌓인다"는 관례를 따르면 방향(아래→위)도 틀렸다. 이 PR 이 고친 실질 결함(폼 프리필 왕복 오염)은 결국 이 마스킹 시리즈에서 유일하게 독립 CHANGELOG 항목을 못 받은 채 죽은 포인터 하나로만 남아 있다.

## 위험도

LOW — 기능 회귀나 코드 정확성 문제는 아니며, 신규로 확인된 것은 저장소 자신의 변경 이력 문서(CHANGELOG) 안의 자기-모순적 참조 하나뿐이다. 다만 이 시리즈 전체가 "정확한 포인터·시제·소스 추적"을 반복적으로 강조해 온 만큼, 그 기준으로 보면 실제로 고쳐야 할 항목이다.
