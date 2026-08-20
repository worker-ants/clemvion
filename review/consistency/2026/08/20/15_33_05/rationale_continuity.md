# Rationale 연속성 검토 — spec/5-system/ (`Execution.inputData` egress 마스킹 카브아웃 폐지, 2026-08-20)

## 조사 방법

- target: `spec/5-system/` (--impl-done, diff-base `origin/main`, HEAD 워크트리
  `eia-inputdata-marker-guard`, 현재 HEAD `b46216f1f`).
- 이번 브랜치의 실질 결정은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커
  가드 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드) 신설. `git diff origin/main...HEAD`
  로 `spec/5-system/14-external-interaction-api.md`(§R17 잔여②) ·
  `spec/5-system/6-websocket-protocol.md`(§4.1) · `spec/5-system/13-replay-rerun.md`(§10.2·
  RR-PL-02) · `spec/5-system/12-webhook.md`(§5.3) · `spec/1-data-model.md` ·
  `spec/3-workflow-editor/3-execution.md` · `spec/4-nodes/1-logic/12-background.md` 전수 대조.
- 본 검토는 4번째 라운드다. 직전 라운드(`review/consistency/2026/08/20/15_10_56/
  rationale_continuity.md`, 위험도 LOW)가 WARNING 1(CHANGELOG stale 서술)·INFO 2 를 남겼고,
  그 직후 커밋 `b46216f1f`(round-3 처분)가 WARNING 을 CHANGELOG 재작성으로, INFO 하나(RR-PL-02
  cross-link 부재)를 스펙 1줄 추가로 닫았다 — `git show b46216f1f` 로 실제 반영 여부를
  독립적으로 재확인했다(CHANGELOG "두 조건의 합" 문구·`RR-PL-02` 캐비엇 모두 확인).
- 추가 자체 점검: `MASKED_INPUT_DATA_REASON` 앵커가 `codebase/` 전체에서 0건인지
  (`grep -rn` 전수), `spec/` 전체에서 "카브아웃"·"레벨이 가른다" 옛 축이 과거형이 아닌 현재
  서술로 잔존하는지, `spec/2-navigation/14-execution-history.md` R-5 원문이 §R17 이 인용한
  대로인지 재대조했다.

## 발견사항

없음 — target(`spec/5-system/`) 범위에서 새로 보고할 CRITICAL/WARNING/INFO 없음.

## 확인했지만 문제 없음으로 판정한 항목

- **`Execution.inputData` 카브아웃 폐지는 실제 이력에 근거한 정당한 번복이다.** §R17 "잔여②"
  가 (a) 카브아웃을 세웠던 이유(재제출 프리필 왕복이 `'***'` 를 실제 입력으로 만듦) (b) 닫는
  조건(프런트 마커 가드가 세 소비처에 갖춰짐)과 그 충족 근거(소비처·가드 형태·시점 표) (c)
  판단 기준 자체가 "외부 노출 여부" 단일 축에서 "외부 노출 ∨ 예외의 미러 유지비 > 가드 비용"
  2축으로 바뀐 이유(6개 spec 파일이 예외를 SoT 로 인용해 유지비가 역전)를 전부 명시적으로
  서술한다. 과거 결정을 지우지 않고 "한동안"·"2026-08-20 이전에는" 같은 시제 표지로 남긴 채
  왜 더 이상 유효하지 않은지를 설명하는 형태라, `feedback_rationale_rejected_alternatives_
  need_history` 기준(지어낸 이력 금지)을 충족한다.
- **6개 미러 문서가 모두 같은 날짜(2026-08-20)·같은 근거로 동기화돼 있다** — `1-data-model.md`
  (Execution/NodeExecution 두 행) · `3-workflow-editor/3-execution.md`(히스토리 로드 캐비엇) ·
  `4-nodes/1-logic/12-background.md`(본문 노드 inputData) · `12-webhook.md`(§5.3 "그 갭을
  덮는 후속 층" 갱신 + ingestion 층이 대체되지 않는다는 caveat 유지) · `13-replay-rerun.md`
  (§10.2 전면 재작성 + RR-PL-02 cross-link) · `6-websocket-protocol.md`(§4.1). 폐기된 옛 축
  ("레벨이 가른다")을 현재형으로 재긍정하는 잔존 문구는 없다 — 두 곳 모두 "그 축은 폐기됐다"
  로 명시.
- **`webhook Rationale` 의 "whack-a-mole" 반박이 §R17 자기 비판으로 남아 있다** — "이 작업
  자체가 그 우려를 실증했다(표면 넷→여섯, `inputData` 카브아웃 범위를 한 번 되돌렸다)"고
  인정하면서, 공유 관문(`toResponseExecution`/`emitExecutionEvent`/`emitNodeEvent`/
  `toTerminalErrorPayload`) 수렴 구조로 그 우려에 답하는 논리를 유지한다 — 과거 spec 이 기각한
  "display 시점 개별 마스킹"을 다시 채택한 것이 아니다.
- **`llmCalls` strip-only 결정(WS Rationale)은 번복되지 않았다** — §R17 이 "예외는 `llmCalls`
  하나, 그 결정은 번복되지 않았다" 로 명시 유지.
- **`config` raw-echo 원칙(node-output Principle 7)과의 관계도 재확인됐다** — 자격증명은
  이미 echo 금지 대상이라 이번 마스킹은 새 예외가 아니라 backstop 이라는 서술이 유지된다.
- **`MASKED_INPUT_DATA_REASON` 앵커는 `codebase/` 전체에서 0건**(전수 `grep`) — spec·CHANGELOG
  가 "전수 삭제했다" 고 서술한 상태와 코드가 일치한다. dangling 코드 인용 없음.
- **직전 라운드가 남긴 WARNING·INFO 중 조치 가능한 항목은 후속 커밋에서 실제로 닫혔다** —
  CHANGELOG 는 "값 비었는가"→"건드렸는가" 단일조건이 아니라 "두 조건의 합(터치 ∧ 마커부재)"
  으로, 각 조건이 단독으로 뚫리는 두 경로(타입 캐스팅 / 마커 되돌리기)를 모두 적어 재작성됐고
  (`b46216f1f`), `RR-PL-02` 절에 §10.2 마커 예외 cross-link 1줄이 추가됐다. 두 변경 모두
  `git show b46216f1f` 로 반영 확인.
- **잔존 INFO 1건(연속 3라운드 미해소, 저강도)**: `spec/2-navigation/14-execution-history.md`
  R-5(config 탭 boundary masking parity) → §R17 → `6-websocket-protocol.md` §4.1 로 이어지는
  2홉 인용에서, R-5 원 출처의 스코프 caveat("R-5 의 직접 대상은 Config 탭, `Execution.error`
  를 이미 규정하고 있던 것은 아니다")이 두 번째 홉(WS §4.1)에서는 다시 드러나지 않는다. §R17
  단계에서는 caveat 이 명시돼 있어(원용이지 기존 판정 아님) 각 홉의 결론 자체는 타당하고
  오류는 아니다 — 급하지 않은 문서 보강 수준으로, 이번 라운드도 위험도 상향 근거로 삼지 않음.

## 요약

`spec/5-system/` 의 이번 브랜치 핵심 결정(`Execution.inputData` egress 마스킹 카브아웃 폐지)
은 Rationale 연속성 관점에서 모범 사례에 가깝다 — 과거에 명시적으로 세운 조건부 예외를, 그
예외가 스스로 적어 둔 "닫는 조건"이 실제로 충족된 뒤에만 번복했고, 왜 세웠고 왜 지금 무효인지
를 시제 표지("~2026-08-20 이전")로 명확히 구분해 6개 미러 문서에 동시 반영했다. 이전 3개
검토 라운드가 지적한 항목(코드 CRITICAL 2·WARNING 다수, consistency WARNING·INFO)은 모두
후속 커밋에서 처분됐고, 최신 커밋(`b46216f1f`)에서 독립적으로 재확인한 결과 새로 보고할
CRITICAL/WARNING 은 없다. 폐기된 대안("레벨이 가른다" 단일 축, display 시점 개별 마스킹)의
재도입도 없고, `llmCalls` strip-only·`config` raw-echo 같은 인접 합의 원칙과의 충돌도 없다.
남은 것은 3라운드째 반복되는 저강도 INFO(R-5 인용 체인의 2홉 caveat 유실) 하나뿐이며 실질
결함이 아니다.

## 위험도

NONE
