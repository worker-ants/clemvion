STATUS=success rationale_continuity 검토 완료 — CRITICAL 0 / WARNING 0

### 발견사항

없음.

target(`spec/5-system/` 영역, `Execution.inputData` egress 마스킹 카브아웃 폐지)은 과거
Rationale 을 무근거로 뒤집는 사례가 아니라, **과거 Rationale 이 스스로 명시해 둔 조건부
재검토 트리거를 충족시켜 예정대로 집행한 사례**다. 직전 라운드(`16_52_12`, 동일 결론·위험도
NONE) 이후 커밋(`fa4718df0`)은 테스트 파일과 plan 문서만 건드렸고 `spec/5-system/`(target
범위)은 변경되지 않았음을 `git show --stat`로 확인했다 — 아래는 그 결론을 독립적으로 재검증한
근거다.

- **번복 대상 결정의 출처**: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②"
  (2026-08-16 최초 기록, 2026-08-17 범위 정정). 이 결정은 `Execution.inputData` 를 egress
  마스킹 대상에서 제외했고, **동시에 "닫는 조건"을 명문화**했다 — *"프런트가 마스킹 마커를
  감지해 해당 필드 재입력을 강제하는 가드가 선행되어야 한다."* `git show origin/main:spec/5-system/14-external-interaction-api.md`
  로 branch 분기 이전 시점을 직접 열어, 이 "닫는 조건" 문구가 이번 diff 이전부터 실재했음을
  확인했다(사후 지어낸 근거가 아니다).
- **번복의 근거**: 이번 diff 는 그 조건이 세 소비처(폼 프리필 2026-08-17 · Re-run 모달
  2026-08-20 · 에디터 히스토리 로드 2026-08-20) 모두에서 충족됐음을 표로 명시하고, R17 본문에
  `~~잔여 ②~~ 해소(2026-08-20)` 로 취소선 처리해 이력을 보존한 채 결론을 갱신했다
  (`spec/5-system/14-external-interaction-api.md:1542` 근방).
- **미러 정합성**: 동일 결론이 SoT 로 인용되던 6개 문서(`spec/1-data-model.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`,
  `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
  `spec/5-system/6-websocket-protocol.md`) 전부가 같은 커밋 계열에서 "종전엔 카브아웃 / 지금은
  마스킹" 형태로 동기 갱신됐다. `grep -rln "마스킹 대상이 아니다|비대상|카브아웃" spec/` 로
  spec 트리 전체를 재스캔해 이 6곳 밖에 낡은 카브아웃 서술이 남아있지 않은지 확인했다 — 걸린
  다른 파일들(`2-navigation/2-trigger-list.md`, `conventions/secret-store.md`,
  `conventions/interaction-type-registry.md` 등)의 "비대상"/"카브아웃" 용례는 전혀 다른
  맥락(AuthConfig 암호화, endReason 레지스트리, 트리거 인증 경고 등)이라 본 결정과 무관함을
  개별 확인했다.
- **인접 결정과의 비충돌**: 12-webhook.md §5.3 의 "ingestion-time 헤더 마스킹" 결정
  (2026-07-07, display-time 마스킹을 명시적으로 기각한 결정)은 본 변경이 대체하지 않는다 —
  R17 §"언제 가리는가" 불릿과 12-webhook.md 갱신분이 "이 층은 대체되지 않는다"고 명시적으로
  선을 긋고, ingestion 층 위에 egress 층을 **추가**하는 것으로만 서술한다.
  `NodeExecution.inputData` 를 카브아웃까지 확대했다가 flip-flop CRITICAL 로 기각했던 과거
  결정(§R17 잔여② 본문 "초판은 카브아웃을 노드 레벨까지 확대했는데…")도 이번 diff 에서
  재도입되지 않았다 — 두 레벨 모두 마스킹하는 현재 상태는 그 기각된 대안(노드 레벨은 카브아웃,
  Execution 레벨만 원문 유지)과 다르다.
- **판단 기준(축) 개정의 정당화**: "왕복되는 값은 카브아웃, 아니면 마스킹" 이라는 종전
  단일축(외부 노출 여부) 원칙을 이번 diff 가 2축(외부 노출 + 예외 유지비 vs 가드 비용)으로
  개정했는데, R17 본문이 "그 축은 폐기됐다"고 명시하고 개정 사유(6개 spec 이 예외를 SoT 로
  인용하며 유지비가 가드 비용을 넘어섬)를 함께 적어, 새 Rationale 없는 무근거 원칙 변경이
  아니다.
- **다른 spec 영역의 관련 Rationale 과도 무충돌**: `1-data-model.md`("버전 스냅샷 = JSONB"),
  `3-execution.md`(R-1.3/R-2.2/R-7), `12-background.md`(ExecutionContext Map 키 분리 등),
  `7-channel-web-chat/1-widget-app.md`(R6~R10) 의 Rationale 을 발췌 대조했으나 이번 변경과
  겹치거나 충돌하는 invariant/원칙이 없다 — 특히 `1-widget-app.md` R9 의
  "single-flight coalesce" 는 별개 표면(webhook 재발사)이라 무관.
- **코드 정합**: 구 근거로 R17 이 인용하던 `ExecutionsService.MASKED_INPUT_DATA_REASON` 상수는
  코드·spec 양쪽에서 흔적 없이 제거됐고, `executions.service.ts` diff 는
  `redactStoredDataForResponse(execution.inputData)` 적용으로 실제 마스킹이 걸림을 보여
  spec 서술과 code 가 일치한다. frontend 마커 가드(`masked-markers.ts`,
  `rerun-modal.tsx`, `editor-toolbar.tsx`)도 R17 이 명시한 "세 조건의 AND"(터치 여부·현재
  마커 부재·구조 필드 JSON 파싱 성공)를 정확히 그대로 구현하고 있음을 diff 로 직접 확인했다.

### 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 과거 Rationale(§R17 잔여 ②)이 스스로
못박아 둔 "닫는 조건"(branch 분기 이전부터 실재 확인됨)이 충족되어 예정대로 집행된 변경이며,
취소선으로 이력을 보존하고 6개 관련 spec 문서를 동시 동기화했다. 인접한 다른 결정(webhook
ingestion-time 마스킹, node-level 카브아웃 확대 기각)과도 충돌하지 않고, 코드·frontend 마커
가드 구현과도 정합한다. 직전 라운드 이후 target 범위에 변경이 없어 결론은 그대로 유지된다.
Rationale 연속성 관점에서 지적할 사항이 없다.

### 위험도
NONE
