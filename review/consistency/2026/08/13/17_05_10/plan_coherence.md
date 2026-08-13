# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위

`origin/main...HEAD` 4 커밋(`4fcc1b43a`·`c31c96529`·`258b7691d`·`6570ca3bb`, "backlog-final-three"
라운드):

1. `4fcc1b43a` — 선재 테스트 공백 3건(snapshotCache evict·dispatcher logFn 분기·admission
   `Array.isArray` 가드) 보강 테스트.
2. `c31c96529` — 위 admission 가드를 리뷰(`14_01_46`)가 `return false`(defer)에서 `throw`
   (트랜잭션 롤백 유지)로 되돌림.
3. `258b7691d` — `--impl-done` 이 target(`spec/5-system/`) 전역 스캔에서 **선재** CRITICAL(EIA
   outbound notification payload 가 spec §6.3–§6.5·WS §4.1 계약과 실제 발송 shape 에서 근본적으로
   다름)을 발견 — `backend-lint-gate-broken-on-main.md` 에 (a)/(b) 택일과 근거를 등재, BLOCK:YES
   유지(우회하지 않음).
4. `6570ca3bb` — 위 CRITICAL 이 별도로 이미 머지된 `#1166`(`9a4d3e32b`, origin/main 조상)으로
   **(b) spec 을 실제에 맞춘다**로 종결됐음을 plan 문서에 기록.

`spec/5-system/**.md` 자체는 이 4커밋에서 1줄도 안 바뀐다 — 스캔이 잡은 drift 는 이미 별 PR
(`#1166`)이 해소했고, 이번 diff 는 그 사실을 plan 에 기록하는 chore 뿐이다.

## 확인한 것 (미해결 결정과의 충돌 — 없음)

- `258b7691d` 가 등재한 CRITICAL 은 developer 가 임의로 결정을 내리지 않고 정확히 규약대로
  처리됐다 — 권한 밖(spec write) 택일이라 plan 에 양쪽 선택지·근거를 남기고 BLOCK:YES 를
  유지한 채 planner 인계.
- 그 결정((b): spec 을 실제 구현 shape 에 맞춤)은 실제로 머지된 `#1166`(`9a4d3e32b`, 이미
  `origin/main` 조상)이 집행했음을 직접 확인했다 — `git log --oneline -- <해당 spec 파일들>`,
  `spec/5-system/14-external-interaction-api.md` §6 도입부("종결 이벤트의 필드 집합 (normative)"
  L562, "삭제된 약속" L575)를 직접 Read 해 `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`
  철회와 `result.outputs`/`durationMs` Planned 표기가 실재함을 확인.
- `6570ca3bb` 는 이 사실을 서술만 하고 새 결정을 내리지 않는다 — 충돌 없음.

## 확인한 것 (선행 plan 미해소 — 없음)

- `4-execution-engine.md` frontmatter `pending_plans`(`execution-engine-residual-gaps.md` ·
  `retry-turn-terminal-guard.md` · `exec-intake-followups.md`) 중 이번 diff 의 admission-gate
  코드·EIA CRITICAL 종결과 전제 충돌하는 항목 없음.
- `retry-turn-terminal-guard.md` P2 #2(`failRetryExecution` 의 `cancelledBy` 누락)는 이미
  등재돼 있고 이번 라운드가 그 행에 "계약 SoT 는 이제 EIA §6 도입부(2026-08-13 이관)" 를
  정확히 반영해 뒀다(`retry-turn-terminal-guard.md:329`) — 새 SoT 를 놓치는 stale 포인터 없음.

## 확인한 것 (후속 항목 누락 — 실질적 갭 없음, 문서 결함 1건 발견)

- `#1166` 이 "잔여는 반대 방향(구현을 문서에 맞추기)" 이라고 적은 두 항목 —
  `result.outputs`/`durationMs` emit, `error` 객체 통일 — 실제로
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:13-23`에 등재돼 있음을 직접
  확인. `spec-sync-websocket-protocol-gaps.md:17-18` 도 같은 계약이 이제 EIA §6 도입부 SoT 라고
  정확히 갱신돼 있음.
- `spec-link-integrity` 테스트(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`)
  를 직접 실행 — **13/13 통과**. `line 536` 하드코딩 인용도 spec 쪽 3곳 모두 제거 확인
  (`grep -rn "line 536" spec/` → 0건, 코드 3곳은 의도적으로 developer 후속 남김).
  `node-output-redesign/README.md:372` 의 EIA 절 번호(§6.3→§6.4) 오류도 정정돼 있음.
- **문서 결함(WARNING) — 이번 diff 가 만든 것은 아니나 같은 target 생태계**:
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (이미 `origin/main`에
  머지된 `#1166`/`9a4d3e32b` 커밋으로 신설, 이번 4커밋 diff 는 이 파일을 건드리지 않음)의
  L245-255 에 깨진 헤딩(`## Rationale\` 의 "EIA §6.2 blockquote" 앵커가...`)과 함께 **중복된
  체크리스트 블록**이 남아 있다. 바로 위 "### 실행 (2026-08-13)" 절(L224-243)에서 `[x]`로
  체크된 항목들 — §6.3~§6.5 축약, WS §4.1 갱신, `chat-channel-adapter.md` 축약, `retry-turn-
  terminal-guard.md` 역포인터, Planned gap 등재 — 이 이 잔재 블록에서는 **`[ ]`(미완료)로
  다시 나열**돼 자기 파일 안에서 완료 여부가 모순된다.
  > 실제 spec 상태는 위에서 직접 확인한 대로 **완료**다(§6 도입부 존재, WS §4.1 이 필드
  > 열거 대신 포인터, `chat-channel-adapter.md` 도 EIA §6 위임 형태). 이 블록은 이전 draft
  > 버전에서 새 "실행" 절을 추가하며 지우지 못한 잔재로 보인다.
  > 이 diff 의 스코프 밖(파일 자체가 diff 에 없음)이라 이번 PR 을 막을 사유는 아니지만,
  > 다음에 이 파일을 여는 사람이 "미완료" 로 오독해 이미 끝난 작업을 다시 하거나 반대로
  > spec 완료 여부를 의심할 수 있다 — memory 교훈("체크리스트 두 군데" 동기화 실패)과 같은
  > 형태다. 정리(중복 블록 삭제) 권장.

## 요약

이번 4커밋 diff 는 `spec/5-system/**.md` 를 직접 변경하지 않으며, `--impl-done` 이 target 전역
스캔에서 찾아낸 선재 CRITICAL(EIA outbound notification payload drift)을 규약대로 처리했다 —
우회하지 않고 등재 → planner 인계 → 별도 머지 PR(`#1166`)이 실제로 (b) 방향(spec 을 구현에
맞춤)으로 종결 → 이번 diff 는 그 종결을 plan 문서에 기록만 한다. 직접 spec 파일 Read 와
`spec-link-integrity` 테스트 실행으로 그 서술이 사실과 일치함을 확인했고, 후속 카탈로그
(`spec-sync-external-interaction-api-gaps.md`·`spec-sync-websocket-protocol-gaps.md`·
`retry-turn-terminal-guard.md`)도 정확히 갱신돼 있다. 유일한 발견은 관련 draft 플랜 파일 하나에
남은 **자기모순 체크리스트 잔재**(이미 `origin/main`에 있고 이번 diff 밖)로, 이번 PR 을 막을
사유는 아니지만 정리를 권한다.

## 위험도

LOW
