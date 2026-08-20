STATUS=success rationale_continuity 검토 완료 — CRITICAL 0 / WARNING 0

### 발견사항

없음.

target(`spec/5-system/` 영역, diff-base `origin/main`)의 핵심 변경은 `Execution.inputData`
egress 마스킹 카브아웃 폐지다. 이는 과거 Rationale 을 무근거로 뒤집는 사례가 아니라, **과거
Rationale 이 스스로 명시해 둔 조건부 재검토 트리거를 충족시켜 예정대로 집행한 사례**다.

- **번복 대상 결정의 출처**: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②"
  (2026-08-16 최초 기록, 2026-08-17 범위 정정). 이 결정은 `Execution.inputData` 를 egress
  마스킹 대상에서 제외했고, **동시에 "닫는 조건"을 명문화**했다 — *"프런트가 마스킹 마커를
  감지해 해당 필드 재입력을 강제하는 가드가 선행되어야 한다."* `git show origin/main:spec/5-system/14-external-interaction-api.md`
  로 확인한 결과 이 "닫는 조건" 문구는 branch 분기 이전부터 origin/main 에 실재했다(사후에
  지어낸 근거가 아니다).
- **번복의 근거**: 이번 diff 는 그 조건이 세 소비처(폼 프리필 2026-08-17 · Re-run 모달
  2026-08-20 · 에디터 히스토리 로드 2026-08-20) 모두에서 충족됐음을 표로 명시하고, R17 본문에
  `~~잔여 ②~~ 해소(2026-08-20)` 로 취소선 처리해 이력을 보존한 채 결론을 갱신했다
  (`spec/5-system/14-external-interaction-api.md:1542` 근방).
- **미러 정합성**: 동일 결론이 SoT 로 인용되던 6개 문서(`spec/1-data-model.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`,
  `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
  `spec/5-system/6-websocket-protocol.md`) 전부가 같은 diff 에서 "종전엔 카브아웃 / 지금은
  마스킹" 형태로 동기 갱신됐다. `grep -rn "마스킹 대상이 아니다|카브아웃|재제출하므로 마스킹하면"
  spec/` 로 spec 트리 전체를 재스캔해 이 7개 파일 밖에 낡은 카브아웃 서술이 남아있지 않음을
  확인했다(대상 없음).
- **인접 결정과의 비충돌**: `12-webhook.md` §Rationale 의 "ingestion-time 헤더 마스킹" 결정
  (display-time 마스킹을 명시적으로 기각한 결정, `## Rationale` "기각(display)" 항목)은 본
  변경이 대체하지 않는다 — R17 "언제 가리는가" 불릿(이번 diff 이전에 이미 존재, `89c3f3c53`
  으로 blame 확인)과 12-webhook.md 갱신분이 "이 층은 대체되지 않는다"고 명시적으로 선을 긋고,
  ingestion 층 위에 egress 층을 **추가**하는 것으로만 서술한다. R17 은 한 걸음 더 나아가
  webhook Rationale 의 "whack-a-mole" 반대 근거(모든 read 경로를 개별 마스킹해야 한다)를
  직접 인용해 반박한다 — "공유 관문(`toResponseExecution`/`emitExecutionEvent`/
  `emitNodeEvent`/`toTerminalErrorPayload`)으로 수렴시켜 구조적으로 상속시킨다"는 설계
  근거를 명시했으므로 과거 반대 근거를 무시한 게 아니라 **정면으로 응답**한 사례다.
  `NodeExecution.inputData` 를 카브아웃까지 확대했다가 flip-flop CRITICAL 로 기각했던 과거
  결정(§R17 잔여② 본문 "초판은 카브아웃을 노드 레벨까지 확대했는데…")도 이번 diff 에서
  재도입되지 않았다 — 현재 상태(두 레벨 모두 마스킹)는 그 기각된 대안(노드 레벨 카브아웃,
  Execution 레벨만 원문 유지)과 다르다.
- **판단 기준(축) 개정의 정당화**: "왕복되는 값은 카브아웃, 아니면 마스킹"이라는 종전 단일축
  (외부 노출 여부) 원칙을 이번 diff 가 2축(외부 노출 + 예외 유지비 vs 가드 비용)으로
  개정했는데, R17 본문이 "그 축은 폐기됐다"고 명시하고 개정 사유(6개 spec 이 예외를 SoT 로
  인용하며 유지비가 가드 비용을 넘어섬, 그 사이 폼 가드가 서서 가드 비용이 거의 0이 됨)를
  함께 적었다 — 새 Rationale 없는 무근거 원칙 변경이 아니다.
- **코드 정합**: 구 Rationale 이 구현 정본으로 인용하던 `ExecutionsService.MASKED_INPUT_DATA_REASON`
  상수는 `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` 결과 코드·spec 양쪽에서 흔적
  없이 제거됐다 — 폐기된 결정의 구현 유물이 남아 spec 서술과 어긋나는 상태가 아니다. frontend
  마커 가드(`masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`)도 diff 상 존재하며,
  round3~8(커밋 `b0d841923`~`1539349f5`) 리뷰 처분 이력이 R17 이 명시한 "세 조건의 AND"(터치
  여부·현재 마커 부재·구조 필드 JSON 파싱 성공) 및 "정확 일치만 감지"(부분 치환은 미탐지,
  의도된 보장 경계로 R17 에 명문화됨) 경계를 반복 검증한 흔적이다.
- **직전 라운드와의 연속성**: 동일 target 범위에 대한 직전 rationale_continuity 리포트
  (`review/consistency/2026/08/20/17_14_02/rationale_continuity.md`, 결론 NONE)와 비교해
  `git log --oneline fa4718df0..HEAD -- spec/` 가 비어 있음을 확인했다 — 그 리포트 이후 추가된
  커밋(`1539349f5`, 라운드8)은 `spec/` 를 전혀 건드리지 않고 테스트·plan·review 산출물만
  변경했다. 따라서 결론은 그대로 유지된다.

### 요약
`Execution.inputData` egress 마스킹 카브아웃 폐지는 과거 Rationale(§R17 잔여 ②)이 스스로
못박아 둔 "닫는 조건"(branch 분기 이전부터 origin/main 에 실재)이 충족되어 예정대로 집행된
변경이며, 취소선으로 이력을 보존하고 7개 관련 spec 문서(SoT 포함)를 동시 동기화했다. 인접한
다른 결정(webhook ingestion-time 마스킹의 명시적 display-time 기각, node-level 카브아웃 확대
기각)과도 충돌하지 않고 오히려 과거 반대 근거(whack-a-mole)에 정면으로 응답했으며, 코드·
frontend 마커 가드 구현·과거 구현 정본 상수 제거와도 정합한다. Rationale 연속성 관점에서
지적할 사항이 없다.

### 위험도
NONE
