# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 조사 범위와 방법

프롬프트 번들은 `spec/5-system/` 대부분(4-execution-engine.md·14-external-interaction-api.md 포함
15개 파일)과 `plan/in-progress/` 대다수(64개 파일)가 컨텍스트 예산 초과로 절단돼 있었다. "여기
없다는 사실을 근거로 삼지 말 것" 지시에 따라, 절단된 항목 중 현재 작업과 관련성이 높은 파일은
저장소에서 직접 `Read`/`grep` 했다:

- 현재 워크트리의 실제 uncommitted diff(`git diff HEAD`)를 1차 target 으로 삼았다 — 번들의
  `spec-sync-external-interaction-api-gaps.md` 스냅샷이 diff 적용 **이전** 상태였기 때문에(같은
  파일의 `finalizeStalledExhausted` 체크박스가 번들에선 `[ ]`, 디스크에선 `[x]`), 디스크 최신
  상태를 정본으로 채택했다.
- 직접 읽은 plan: `eia-stalled-atomicity.md`(신규), `spec-sync-external-interaction-api-gaps.md`,
  `eia-db-wire-invariant.md`, `eia-terminal-payload.md`, `spec-draft-eia-r8-alignment.md`,
  `execution-engine-residual-gaps.md`, `node-cancellation-residual-signal-propagation.md`,
  `spec-update-node-cancellation-shutdown-classification.md`(관련 절).
- 직접 읽은 spec: `spec/conventions/node-cancellation.md`(diff), `spec/5-system/4-execution-engine.md`
  (`finalizeStalledExhausted` grep).

## 대상 변경 요약

현재 diff(미커밋)는 `eia-stalled-atomicity.md` plan 을 그대로 집행한다:
`finalizeStalledExhausted` 의 Execution UPDATE + NodeExecution cascade UPDATE 를
`dataSource.transaction()` 으로 묶어 자매 두 함수(`cancelParkedExecution`,
`markWebChatIdleTimeout`)와 동형으로 통일했고, `spec/conventions/node-cancellation.md` §2.4
매트릭스에 해당 행을 추가했으며, **같은 diff 안에서** 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)의 대응 체크박스를 `[x]` 로 갱신했다.

## 발견사항

- **[INFO]** `eia-stalled-atomicity.md` 자체 체크리스트가 본문 완료 상태를 못 따라간다
  - target 위치: (참고) `plan/in-progress/eia-stalled-atomicity.md` 하단 `## 체크리스트`
  - 관련 plan: 같은 문서. 본문의 "## 조치" 5항목은 전부 `[x]`, 자매 트래커
    (`spec-sync-external-interaction-api-gaps.md`)도 같은 diff 에서 이미 `[x]` 로 갱신됐다.
    그런데 문서 맨 아래 `## 체크리스트`(`--impl-prep` BLOCK: NO / 자매 트래커 동시 갱신 /
    TEST WORKFLOW 4스테이지 / `/ai-review` CRITICAL 0 / `--impl-done` BLOCK: NO / push 게이트
    통과)는 6개 항목 전부 `[ ]` 로 남아 있다.
  - 상세: target-vs-plan 충돌은 아니고(다른 plan 을 침해하지 않음), 같은 문서 내부의
    본문↔체크리스트 불일치다. 이 저장소가 이미 반복 기록한 형태(`eia-terminal-payload.md` 가
    "체크리스트가 커�밋 메시지보다 늦는 것이 이 plan 에서만 세 번째" 라고 자인한 바로 그
    패턴)라 재발 소지가 있다. 이 상태로 커밋되면 이후 게이트나 리뷰어가 "자매 트래커
    동시 갱신" 이 아직 안 된 것으로 오판할 수 있다(실제로는 됐다).
  - 제안: 커밋 직전에 `## 체크리스트`의 "자매 트래커 동시 갱신" 항목을 최소한 `[x]` 로
    동기화할 것. 나머지(`/ai-review`·`--impl-done`·push)는 실제로 아직 수행 전이므로 그대로
    두는 것이 맞다.

## 교차 확인 결과 (충돌 없음 확인)

- **미해결 결정과의 충돌**: 이 diff 가 건드리는 영역(EIA stalled 소진 종결의 트랜잭션 원자성)에
  대해 다른 in-progress plan 이 "결정 필요" 로 남겨 둔 항목은 발견되지 않았다.
  `node-cancellation-residual-signal-propagation.md` 의 `⛔ BLOCKED — project-planner 결정 대기`
  항목(workflow-timeout 노드 abort 의 `cancelled` vs `failed` 계약 택일)은 `ShutdownStateService`
  의 SIGTERM/`SERVER_INTERRUPTED` 경로를 다루며, `finalizeStalledExhausted`(BullMQ stalled
  재배달 소진 → `WORKER_HEARTBEAT_TIMEOUT`)와는 트리거·코드 경로가 분리돼 있어 이 변경과
  충돌하지 않는다.
- **선행 plan 미해소**: `eia-stalled-atomicity.md` 는 스스로 "범위 밖" 항목(관용구 헬퍼 추출·
    단일 emit 관문·실 DB e2e)을 정본 트래커에 위임하고 이번 PR 에서 건드리지 않는다고
    명시했으며, 실제 diff 도 그 경계를 지켰다(트랜잭션 래핑 외 로직 변경 없음). 선행 조건
    미해소는 확인되지 않았다.
- **후속 항목 누락**: `spec/5-system/4-execution-engine.md` 는 `finalizeStalledExhausted` 를
  §7.5/§2.13/Rationale 에서 여러 차례 언급하지만 두 UPDATE 의 원자성 여부를 명시적으로
  약속한 적이 없어(조건부 UPDATE 자체만 서술), 이번 트랜잭션화로 그 문서를 갱신해야 할
  의무는 발생하지 않는다. `spec/conventions/node-cancellation.md` §2.4 매트릭스 갱신만으로
  충분하며 이미 diff 에 포함돼 있다. `eia-db-wire-invariant.md`(완료 상태)의 "범위 밖" 절이
  "`finalizeStalledExhausted` 트랜잭션 — 별도 PR" 이라고 예고한 그대로 별도 PR
  (`eia-stalled-atomicity`)에서 집행됐으므로 그 문서도 갱신이 불필요하다.

## 요약

이번 diff(`finalizeStalledExhausted` 트랜잭션화 + `node-cancellation.md` 매트릭스 행 +
정본 트래커 체크박스 동기화)는 plan/in-progress 전반과 정합적이다. 미해결 결정을 우회하거나,
해소되지 않은 선행 plan 을 전제하거나, 다른 plan 의 후속 항목을 무효화하는 사례는 발견되지
않았다. 유일한 관찰은 `eia-stalled-atomicity.md` 문서 내부의 본문↔체크리스트 표시 지연으로,
이 저장소가 반복 지적해 온 패턴과 같은 결이라 INFO 로 남긴다.

## 위험도

LOW
