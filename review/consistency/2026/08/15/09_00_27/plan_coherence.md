# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 발견사항

### [WARNING] `eia-terminal-payload.md` 의 `spec_impact` frontmatter 가 자기 본문의 "spec 동반 변경(전수)" 표보다 좁다 — 같은 클래스 drift 재발 (3건 중 1건 잔존)

- target 위치: `spec/5-system/14-external-interaction-api.md` §6 도입부 필드 집합 표 (durationMs 행) — 이번에 착수 예정인 durationMs emit 작업의 spec 반영 대상
- 관련 plan: `plan/in-progress/eia-terminal-payload.md` frontmatter `spec_impact:` 목록 vs 같은 파일 §"재판정 ④ > spec 동반 변경 (전수)" 표
- 상세:
  - 현재 frontmatter 는 세 파일만 선언한다: `spec/5-system/14-external-interaction-api.md` · `spec/conventions/chat-channel-adapter.md` · `spec/3-workflow-editor/3-execution.md`. 주석에 "재판정 ④ 표가 명시하는데 frontmatter 가 좁았다 (`08_45_50` plan_coherence W3 — Gate C drift)" 라고 직접 적혀 있어, 직전 라운드가 같은 문제를 이미 지적하고 고친 이력이다.
  - 그런데 그 "spec 동반 변경 (전수)" 표 자체가 이번에도 네 번째 파일 `spec/data-flow/3-execution.md:111` (durationMs 관련 시퀀스 다이어그램 — "이 PR 이 그걸 참으로 만든다" 로 명시) 을 별도 행으로 열거하는데, frontmatter 는 이걸 담지 않았다. `spec/3-workflow-editor/3-execution.md` 와 `spec/data-flow/3-execution.md` 는 같은 파일명(`3-execution.md`)이지만 **서로 다른 디렉터리의 별개 파일**이라(각각 66,565 / 35,077 바이트, 별도 커밋 이력) 이미 추가된 `3-workflow-editor/3-execution.md` 가 `data-flow/3-execution.md` 를 대신하지 않는다.
  - 실측: `spec/data-flow/3-execution.md:111` 은 실제로 `cancelled` 도 `duration_ms` 를 쓰는 것처럼 세 상태를 한 UPDATE 로 뭉쳐 표기하고 있어(`Eng->>PG: UPDATE execution SET status='completed'/'failed'/'cancelled', finished_at, duration_ms, ...`), durationMs 구현 시 실제로 손대야 하는 파일이 맞다.
  - `spec_impact` 는 `consistency_orchestrator.py` 의 bundling 대상 판정에도 쓰인다 — 이 파일이 빠지면 이후 라운드가 이 plan 을 다시 로드할 때 `spec/data-flow/3-execution.md` 를 컨텍스트에 못 실어 같은 drift 를 또 놓칠 위험이 있다(이번 라운드가 그 사례).
- 제안: `eia-terminal-payload.md` frontmatter 의 `spec_impact` 에 `spec/data-flow/3-execution.md` 를 추가한다. developer 권한 내(plan 자기 기록 갱신)이므로 별도 planner 턴 불필요.

### [INFO] `eia-terminal-payload.md` §"차단 해제 조건" 이 이미 해소된 BLOCK 상태를 여전히 서술형으로 남겨 둔다

- target 위치: 없음 (plan 내부 서술)
- 관련 plan: `plan/in-progress/eia-terminal-payload.md` §"차단 해제 조건" (line 268~274) vs 같은 파일 체크리스트 (line 293~299, `--impl-prep` 재실행 BLOCK: NO 확인 완료)
- 상세: "차단 해제 조건" 절은 "`spec-draft-eia-62-waiting-payload.md` 가 spec 에 반영돼야 여기가 진행된다" 고 현재형으로 적는데, 그 draft 는 이미 커밋 `4b13ca5ae` 로 반영됐고 이 plan의 `--impl-prep` 도 `BLOCK: NO` 로 재확인됐다(체크리스트에 명시). 위→아래로 읽으면 아직 차단 중인 것으로 오독될 수 있다.
- 제안: 부작용 없음(문서만 stale) — 다음 편집 때 "차단 해제 조건" 절 머리에 "(해소됨 — 아래 체크리스트 참조)" 한 줄만 추가해도 충분하다. 급하지 않음.

## 요약

target(`spec/5-system/14-external-interaction-api.md`)과 이를 직접 참조하는 in-progress plan 들(`eia-terminal-payload.md`, `spec-draft-eia-notification-payload-contract.md`, `spec-sync-external-interaction-api-gaps.md`, `spec-sync-websocket-protocol-gaps.md`, `spec-draft-eia-62-waiting-payload.md`, `retry-turn-terminal-guard.md` #2, `node-output-redesign/README.md`)를 대조한 결과, **미해결 결정을 일방적으로 우회하는 CRITICAL 은 없다.** `error` 객체화 작업은 완결됐고 spec·타입·chat-channel dispatcher가 모두 정합 상태다. `durationMs`/`result.outputs` 는 spec 이 명시적으로 "Planned" 로 열어 둔 채 착수 전이며, 그 사실이 관련 트래커(EIA 정본·WS 포인터)에 일관되게 반영돼 있다. `retry-turn-terminal-guard.md` #2(cancelledBy 누락)와의 코드 충돌 가능성도 `eia-terminal-payload.md` 안에 이미 교차 링크돼 있다. 유일한 실질 갭은 `eia-terminal-payload.md` 자신의 `spec_impact` frontmatter 가 자기 본문이 지목한 4개 spec 파일 중 `spec/data-flow/3-execution.md` 를 빠뜨린 것 — 이는 직전 라운드가 이미 잡았던 것과 같은 클래스의 결함이 부분적으로만 고쳐진 재발이라 WARNING 으로 등재한다.

## 위험도
LOW
