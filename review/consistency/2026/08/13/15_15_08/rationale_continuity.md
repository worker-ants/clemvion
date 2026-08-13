# Rationale 연속성 검토 — spec-draft-eia-notification-payload-contract

## 검토 대상
- target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
- 대상 spec Rationale: `spec/5-system/14-external-interaction-api.md` (R1~R19), `spec/5-system/6-websocket-protocol.md`, `spec/5-system/4-execution-engine.md`(본문/코드 교차검증), `spec/0-overview.md`

## 발견사항

- **[WARNING]** WS §4.1 의 `duration` 제거를 `cancelled` 행에만 적용 — 같은 행에 나란히 있는 `completed`/`failed` 의 동종 미구현 필드(`duration`·`nodeCount`·`failedNodeId`)는 방치
  - target 위치: "## 무엇을 쓸 것인가 → 3. §6.5 `execution.cancelled` — nested 로 통일, WS §4.1 동기화" (target 문서 L105-111), 체크리스트 L130 "§6.5 + WS §4.1 nested 통일, `duration` 제거"
  - 과거 결정 출처: target 문서 자신이 §6.3 절에서 세운 원칙 — "왜 spec 이 코드를 따르는가" Rationale, "동일 출처에 다른 판단을 적용할 이유가 없다"(target L146-151). 실제 spec 은 `spec/5-system/6-websocket-protocol.md` §4.1 표(L177-179)
  - 상세: target 은 `execution.cancelled` 행의 `duration` 이 실제 emit(`{status, result:{cancelledBy}, error?}`)에 없는 필드임을 정확히 지적하고 제거를 결정했다. 그러나 실측 결과 **같은 §4.1 표의 바로 위 두 행**도 동일 결함이다 — `execution.completed`: `{executionId, status, duration, nodeCount}` 로 문서화돼 있으나 실제 emit 은 `emitExecution(id, EXECUTION_COMPLETED, {status})` 뿐이고 `websocket.service.ts` `emitExecutionEvent` 의 wire envelope 도 `{executionId, ...payload, seq, timestamp}` 로 `payload` 를 그대로 spread 하므로 `duration`/`nodeCount` 는 실제로 존재하지 않는다(코드 전수 grep: `nodeCount`·`failedNodeId` 는 `execution-engine` 소스에 0건). `execution.failed`: `{executionId, error, failedNodeId, duration}` 로 문서화됐으나 emit 은 `{status, error}`(현재 string) 뿐이다. 이 세 행은 `git blame` 상 `completed`/`failed` 행이 spec 최초 커밋(`915607532`, 2026-03-29, #228 보다도 이전)부터 존재해온 "구현 이전 초안" 필드로, target 이 §6.3 에서 `finalNodeId`/`finalPort` 를 다룬 것과 **동일 성격·동일 클래스**의 미이행 약속이다. target 이 세운 원칙("동일 출처·동일 성격이면 동일 판단")을 정작 자신이 편집하는 같은 표 안에서 두 행에는 적용하지 않는다 — 결정을 일부만 번복하면서 나머지 절반은 침묵으로 남기는 셈이라, 이 draft 가 반영된 뒤 "WS §4.1 은 이미 실측 정정됐다" 는 오해를 낳을 위험이 있다(§Rationale·체크리스트가 `cancelled` 만 언급하므로 `completed`/`failed` 는 추적조차 안 남는다).
  - 제안: (a) 같은 diff 로 `completed`/`failed` 두 행도 실제 emit(`{executionId, status, seq, timestamp}` / `{executionId, status, error, seq, timestamp}`)에 맞춰 `duration`/`nodeCount`/`failedNodeId` 를 제거하거나 "미구현(Planned)" 표기하거나, (b) 의도적으로 이번 draft 범위에서 제외한다면 "## 비목표" 에 명시하고 후속 항목으로 별도 등재해 "동일 클래스 잔여" 를 문서에 남긴다. 현재처럼 언급 자체가 없으면 다음 audit 이 다시 처음부터 찾아야 한다.

## 정합 확인 (문제 없음 — 참고용)

아래는 target 이 Rationale 연속성을 오히려 **정확히 지킨** 사례로, 이력을 실측 검증했다.

- **§6.3 `finalNodeId`/`finalPort` 삭제**: `spec/5-system/4-execution-engine.md` 전체에도 해당 개념이 없고(grep 0건), EIA Rationale R1~R19 어디에도 이 두 필드를 의도적으로 지키기로 한 결정이 없다 — "기각된 대안의 재도입"이 아니라 애초에 한 번도 이행된 적 없는 초안 약속의 철회다.
- **§5.4 `/cancel` 응답 shape 선례 인용(R16)**: target 이 인용한 "코드가 SoT 이고 spec 서술이 낡았던 것이라 spec 을 맞췄다"(2026-08-10 정정) 문구는 `spec/5-system/14-external-interaction-api.md` R16 원문과 정확히 일치하며, target 은 이 선례를 §6.3 에 동일 근거(같은 PR #228 초안 출처)로 일관되게 확장 적용한다 — 원칙 재사용이지 위반이 아니다.
- **`chat-channel.dispatcher.ts` 주석이 가리키는 후속 plan `spec-update-execution-failed-payload-shape` 부재 주장**: `git log --all -S "spec-update-execution-failed-payload-shape"` 로 실측 시 해당 문자열은 실제 plan 파일로 존재한 적이 없고, 오늘 날짜(2026-08-13) `--impl-done` 세션이 이 사실을 `backend-lint-gate-broken-on-main.md` 에 등재한 커밋(`10c58b0766`)에서만 등장한다 — target 의 "그 plan 은 만들어진 적이 없다" 주장은 사실과 부합한다.
- **§6.3 출처 = PR #228**: `git show 9ed6e6305:spec/5-system/14-external-interaction-api.md` 로 확인한 결과 §6.3 의 `finalNodeId`/`finalPort`/`result` 구조는 실제로 그 커밋(#228, "구현 이전" 초안)에서 도입됐다 — target 의 역사적 근거는 지어낸 것이 아니라 검증 가능하다.
- **EIA R2/R10/R17 등과의 충돌 없음**: 얇은 notification signal + REST 재조회(EIA-IN-04) 모델은 R2("인터랙션은 별도 inbound 채널")·R10(엔진 단일 sink + facade)·R17(SSE 는 라이브 권위, REST 는 시드/복원)의 기존 역할 분담과 상충하지 않는다.

## 요약

target 은 Rationale 연속성 관점에서 대체로 견고하다 — §6.3 의 `finalNodeId`/`finalPort` 삭제와 §5.4 R16 선례 인용은 실제 git 이력으로 검증되며, 지어낸 역사나 명시적으로 기각된 대안의 무단 재도입은 발견되지 않았고 결정 번복에는 새 Rationale 이 동반됐다. 다만 target 이 WS §4.1 을 손대면서 `cancelled` 행의 `duration`(미구현 필드)만 제거하고 바로 옆 `completed`/`failed` 행의 동일 클래스 미구현 필드(`duration`·`nodeCount`·`failedNodeId`)는 언급도 비목표 등재도 없이 방치한다 — target 이 스스로 세운 "동일 출처·동일 성격은 동일 판단" 원칙을 정작 자신이 편집하는 표 안에서 절반만 적용한 self-inconsistency 로, 후속 audit 이 다시 처음부터 발견해야 하는 잔여 표면을 남긴다.

## 위험도
LOW
