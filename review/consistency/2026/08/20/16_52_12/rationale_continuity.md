STATUS=success rationale_continuity 검토 완료 — CRITICAL 0 / WARNING 0

### 발견사항

없음.

target(`spec/5-system/` 영역, `Execution.inputData` egress 마스킹 카브아웃 폐지)은 과거
Rationale 을 무근거로 뒤집는 사례가 아니라, **과거 Rationale 이 스스로 명시해 둔 조건부
재검토 트리거를 충족시켜 예정대로 집행한 사례**다. 상세 근거는 아래와 같다.

- **번복 대상 결정의 출처**: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②"
  (2026-08-16 최초 기록, 2026-08-17 범위 정정). 이 결정은 `Execution.inputData` 를 egress
  마스킹 대상에서 제외했고, **동시에 "닫는 조건"을 명문화**했다 — *"프런트가 마스킹 마커를
  감지해 해당 필드 재입력을 강제하는 가드가 선행되어야 한다."*
- **번복의 근거**: 2026-08-20 diff 는 그 조건이 세 소비처(폼 프리필 2026-08-17 · Re-run 모달
  2026-08-20 · 에디터 히스토리 로드 2026-08-20) 모두에서 충족됐음을 표로 명시하고, R17 본문에
  `~~잔여 ②~~ 해소(2026-08-20)` 로 취소선 처리해 이력을 보존한 채 결론을 갱신했다.
- **미러 정합성**: 동일 결론이 SoT 로 인용되던 6개 문서(`spec/1-data-model.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`,
  `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
  `spec/5-system/6-websocket-protocol.md`) 전부가 같은 커밋에서 "종전엔 카브아웃 / 지금은
  마스킹" 형태로 동기 갱신됐다 — 낡은 서술이 어느 한 곳에도 남아 있지 않음을
  `grep -rn "egress 마스킹 대상이 아니다\|카브아웃"` 로 확인.
- **인접 결정과의 비충돌**: 12-webhook.md §5.3 의 "ingestion-time 헤더 마스킹" 결정
  (2026-07-07, display-time 마스킹을 명시적으로 기각한 결정)은 본 변경이 대체하지 않는다 —
  본 변경은 R17 §"언제 가리는가" 불릿에서 "이 층은 대체되지 않는다" 고 명시적으로 선을 긋고,
  ingestion 층 위에 egress 층을 **추가**하는 것으로만 서술한다. `NodeExecution.inputData` 를
  카브아웃까지 확대했다가 flip-flop CRITICAL 로 기각했던 과거 결정도 이번 diff 에서 재도입되지
  않았다 — 두 레벨 모두 마스킹하는 현재 상태는 그 기각된 대안(WS 만 마스킹·REST 는 원문)과
  다르다.
- **코드 정합**: 구 근거로 R17 이 인용하던 `ExecutionsService.MASKED_INPUT_DATA_REASON` 상수는
  코드·spec 양쪽에서 흔적 없이 제거됐고(`grep` 0건), `executions.service.ts` 는
  `redactStoredDataForResponse(execution.inputData)` 로 실제 마스킹을 적용해 spec 서술과 code
  가 일치함을 확인했다.
- **plan 문서와의 정합**: `plan/in-progress/eia-inputdata-marker-guard.md` 도 동일하게 "닫는
  조건이 충족돼 집행한다" 는 서술을 유지하며 spec 변경과 결이 같다.

결론적으로 이 target 은 Rationale 연속성 검토 관점(기각된 대안 재도입 / 합의 원칙 위반 /
무근거 번복 / invariant 우회) 중 어느 것도 해당하지 않는다 — 오히려 "조건부 유예 결정 →
조건 충족 시 명시적으로 재검토하고 이력을 취소선으로 남기며 전 미러를 동기화" 라는 모범
사례에 가깝다.

### 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 과거 Rationale(§R17 잔여 ②)이 스스로
못박아 둔 "닫는 조건"이 충족되어 예정대로 집행된 변경이며, 취소선으로 이력을 보존하고
6개 관련 spec 문서를 동시 동기화했다. 인접한 다른 결정(webhook ingestion-time 마스킹,
node-level 카브아웃 확대 기각)과도 충돌하지 않고, 코드·plan 문서와도 정합한다. Rationale
연속성 관점에서 지적할 사항이 없다.

### 위험도
NONE
