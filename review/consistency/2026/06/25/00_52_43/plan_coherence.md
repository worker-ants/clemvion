# Plan 정합성 검토 결과

**검토 대상**: `spec/5-system/14-external-interaction-api.md`
**검토 모드**: --impl-done (scope=spec/5-system/14-external-interaction-api.md, diff-base=origin/main)
**검토 일시**: 2026-06-25

---

## 발견사항

### 발견사항 1
- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 미구현 항목 해소 — plan 갱신 필요
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 (getStatus 구현 상태 callout)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 4번째 미구현 항목 "**`GET /api/external/executions/:id` 의 currentNode / context / seq 실값** (§5.3) — 현재 `getStatus()` 가 `currentNode: null`, `context: null`, `seq: 0` placeholder 고정 반환. 노드 context·최신 seq 노출 미구현."
  - 상세: 이번 구현 diff 에서 `interaction.service.ts getStatus()` 가 `WAITING_FOR_INPUT` 시 `NodeExecution`을 조회해 `currentNode`·`context` 를 채우도록 변경됐다. spec §5.3 callout 도 이미 갱신돼 있다("waiting_for_input 상태에서는 currentNode/context 도 채워진다"). 따라서 `spec-sync-external-interaction-api-gaps.md` 의 해당 항목이 실제 완료된 상태이나, plan 내에서 체크박스가 미체크([ ])로 남아 있어 추적 불일치가 발생한다. `seq` 가 여전히 `SSE_SEQ_PLACEHOLDER(0)` 임은 spec 과 일치(placeholder 인정)하므로 seq 부분은 잔여 아님.
  - 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 4번째 항목에 부분 완료 표기 추가 — `currentNode`/`context` 구현 완료(이번 PR), `seq` 실값은 placeholder 유지(spec 합의)로 분리 명기.

### 발견사항 2
- **[INFO]** `web-chat-preview-eia-race-fix.md` plan 의 체크리스트와 구현 일치 확인 — plan 종결 단계 추적
  - target 위치: diff 전체 (interaction.service.ts, use-widget.ts, use-widget-eager-start.test.ts, node-execution.entity.ts)
  - 관련 plan: `plan/in-progress/web-chat-preview-eia-race-fix.md`
  - 상세: plan 의 P0 항목(2) SSE replay, (1a) getStatus 확장, (1b) 위젯 status 시드, 문서 갱신, 테스트 모두 체크됨. 미완료는 "검증(build/e2e)"과 "리뷰·PR" 단계뿐. 구현 diff 내용이 plan 체크된 항목과 정합한다. plan 이 정상적으로 진행 중이며 충돌 없음.

### 발견사항 3
- **[INFO]** `eia-distributed-seq-load-verify.md` — seq 실값 미노출 유지와의 정합
  - target 위치: `interaction.service.ts` `SSE_SEQ_PLACEHOLDER = 0` / spec §5.3 seq 0 placeholder 명기
  - 관련 plan: `plan/in-progress/eia-distributed-seq-load-verify.md` (분산 SSE seq 부하 검증)
  - 상세: 이번 구현이 seq 를 0 placeholder 로 유지하고 spec §5.3 에도 동일하게 명기했으므로, `eia-distributed-seq-load-verify.md` 가 추구하는 분산 seq 검증 방향과 충돌하지 않는다. 단, 해당 plan 을 열람하지 못해(파일 크기 미확인) 내부 미결정 항목이 없는지 확인이 권장된다.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 의 구현 diff(getStatus waiting 표면 복원, SSE lastEventId=0 replay, NodeExecution 인덱스, 위젯 seedWaitingFromStatus)는 `web-chat-preview-eia-race-fix.md` plan 에 명시된 모든 P0 항목을 충실히 이행하며, spec 도 동반 갱신된 상태다. `spec-sync-external-interaction-api-gaps.md` 에 남아 있는 `getStatus currentNode/context 미구현` 항목이 실제로는 이번 구현으로 해소됐으므로 해당 plan 에 부분 완료 표기가 필요하지만, 이는 추적 메모 수준의 불일치다. 미해결 결정을 일방적으로 우회하거나 선행 plan 미해소 상태를 가정하는 사례는 없으며, 후속 항목을 무효화하는 변경도 발견되지 않았다.

---

## 위험도

LOW
