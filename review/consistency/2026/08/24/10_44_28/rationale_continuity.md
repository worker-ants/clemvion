# Rationale 연속성 검토 — `spec/5-system/` (WS 프로토콜 / EIA)

## 검토 방법에 대한 주석 (중요)

전달받은 target 번들(`_prompts/rationale_continuity.md`)은 조립 시점에 **동결(frozen)** 된
스냅샷이다. 실제로 열어 확인해 보니, 이 worktree 의 working tree 에는 그 스냅샷 이후
**`spec/5-system/6-websocket-protocol.md` · `spec/5-system/14-external-interaction-api.md`**
를 포함한 커밋되지 않은 수정(`git diff origin/main --stat`)이 이미 존재했고, 그 수정이
바로 이 검토가 가장 먼저 의심해야 할 지점(§R17 `envelope.output` 잔여 결정의 번복)을
**이미 자체적으로 해소**한 상태였다. 따라서 본 보고서는 동결된 프롬프트 텍스트가 아니라
**현재 디스크 상태(uncommitted 포함)** 를 근거로 판정했다 — 프롬프트 스냅샷만 보고 판정하면
이미 고쳐진 사안을 살아있는 결함으로 오보할 뻔했다.

## 발견사항

### [INFO] R17 `envelope.output` 잔여 결정의 번복 — 이미 적법하게 처리됨 (참고용 기록)

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.4 wire 필드 caveat(구
  "**`execution.node.*` 의 `envelope.output` 은 이 좁히기 대상이 아니다**" 문장) /
  `spec/5-system/14-external-interaction-api.md` §R17 표의
  `SSE/fanout execution.node.completed/.failed 의 envelope.output` 행 및 그 아래
  "같은 목록을 그대로 걸 수 없다" 정정 블록
- **과거 결정 출처**: EIA §R17, 2026-08-23 결정 — `envelope.output` 은 버튼 재개 flat
  record(`{type, buttonId, ..., _selectedPort}`) 를 정본 `allowlistNodeOutputKeys` 에
  통과시키면 `{}` 가 된다는 실측을 근거로 "이종 payload 라 같은 목록을 걸 수 없다" 며
  **의도적으로 deny-list 를 유지**하고, 반대 방향을 `websocket.service.spec.ts` 의
  `[잔여]` 캐너리로 고정했다.
- **상세**: `plan/in-progress/node-output-envelope.md` 는 바로 이 유예 결정을 재검증해
  "그 `{}` 측정 자체는 맞지만 '그 객체가 `outputData` 가 된다' 는 전제가 틀렸다"(flat
  record 는 `contextService.setNodeOutput` 으로 in-memory `nodeOutputCache` 에만 들어가고,
  실제 `outputData` 에 대입되는 것은 `buildResumedStructuredOutput` 이 반환하는
  `NodeHandlerOutput`)는 것을 e2e 285건 + teardown 전 실 Postgres 조회로 확정했다. 이는
  §Rationale 이 이미 기각한 대안(같은 목록 재적용)을 근거 없이 되살리는 것처럼 보일 수
  있는 지점이라 본 체커가 CRITICAL 후보로 잡을 자리였다.
  그러나 **현재 working tree 에는 이 번복이 이미 다음 6곳에 일관되게 취소선+정정 형태로
  반영돼 있다** (모두 `git diff origin/main` 로 직접 확인):
  1. `spec/5-system/6-websocket-protocol.md` §4.4 caveat — 구문 취소선 처리 + "2026-08-24 에
     같은 목록으로 함께 닫혔다" 갱신
  2. `spec/5-system/14-external-interaction-api.md` §R17 표 행 flip
     (`deny-list 유지(잔여)` → `fail-closed allowlist(2026-08-24 추가)`) + "재정정" 블록
     (실측 표 포함, 옛 문단은 취소선으로 **보존**)
  3. `plan/complete/sse-nodeoutput-allowlist.md` — 옛 유예 서술 취소선 + `[2026-08-24
     반증됨]` 주석
  4. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` — 동일 패턴 갱신
  5. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 트래커 항목
     `[ ]` → `[x]` 로 체크 + 등재 당시 원문을 `<details>` 로 **이력 보존**
  6. `spec/conventions/conversation-thread.md` §8.4 인접 서술 — 동일 패턴 갱신
  7. `CHANGELOG.md`, `codebase/backend/.../websocket.service.ts` 코드 주석, `.spec.ts`
     캐너리(구 `[잔여 캐너리]` → 신규 GREEN 캐너리로 뒤집힘, JSDoc 의 "닫히면 뒤집는 것이
     작업의 일부" 계약 이행)도 동일하게 갱신됨.

  모든 지점이 **"측정 자체는 맞았다, 전제가 틀렸다"** 는 동일한 정정 논리와 실측 표를
  공유하고, 옛 문장은 삭제가 아니라 취소선으로 남겨 이력을 보존했다 — 이는
  `feedback_deferral_rationale_must_be_measured.md`("유예 근거는 실측해야 한다")와
  R17 자체가 이미 반복해 온 취소선-정정 관례에 정확히 부합한다. 또한 잔여 위험
  (`ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? nodeOutputCache` flat 폴백)은
  "285건에서 미발현" 이라는 측정과 함께 **별도 트래커 항목 + 전용 캐너리
  (`[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다`) + 측정 가능한 재개 신호**로
  분리 등재됐다 — 총칭이 아니라 열거(R17 의 반복 원칙)를 지켰고, "내부 WS 는 안 바뀐다"
  invariant 도 코드 주석·plan 검증기준 양쪽에서 그대로 유지됐다.
- **제안**: 없음 — 이미 적절히 처리됨. 다만 이 항목이 CRITICAL 로 오판되지 않도록 후속
  검토(예: 다음 라운드 consistency-check)에서는 **동결 프롬프트가 아니라 현재 디스크
  상태**를 1차 근거로 삼을 것을 권한다.

### [INFO] `plan/in-progress/node-output-envelope.md` 체크리스트가 실제 진행 상태와 어긋남

- **target 위치**: `plan/in-progress/node-output-envelope.md` `## 작업` 체크리스트
  (line 98–108, 전항목 `[ ]`)
- **과거 결정 출처**: 해당 없음 (Rationale 위반이 아니라 plan 위생 이슈)
- **상세**: 이 plan 이 스스로 예정한 작업 — `allowlistFanoutNodeOutput` 배선, 캐너리
  4종(`_retryState` 제거·렌더 키 보존·내부 WS 불변·flat 폴백 고정), `#1208` 잔여 캐너리
  뒤집기, `(planner 턴)` §R17 flip + 취소선 정정 + WS §4.4 갱신 — 이 모두가 이미 working
  tree 에 구현/반영돼 있음을 위 항목에서 직접 확인했다. 그런데 이 plan 파일의 체크박스는
  `/consistency-check --impl-prep` 항목을 포함해 **하나도 체크되지 않았다**. `plan/`
  체크박스는 "수행 후에만 체크" 가 원칙이고 plan 은 실제 상태를 반영하는 단일 진실이어야
  하는데, 지금은 코드/spec/트래커 4곳이 앞서 나가고 plan 만 뒤처져 있다.
- **제안**: 이번 턴에서 실측·구현이 이미 끝난 항목(배선·캐너리·잔여 캐너리 뒤집기·planner
  턴 spec 갱신)을 `[x]` 로 동기화하고, 남은 항목(뮤테이션 검증·TEST WORKFLOW·`/ai-review`)만
  미체크로 남길 것. 그렇지 않으면 다음 세션이 "아직 착수 전" 으로 오판해 이미 끝난
  planner 턴 spec 갱신을 중복 시도할 위험이 있다.

## 요약

이번 검토의 핵심 위험 후보였던 "EIA §R17 이 명시적으로 기각한 `envelope.output` 동일
allowlist 적용" 은, 동결된 프롬프트 스냅샷만 보면 무근거 번복(CRITICAL 후보)처럼 보이지만
실제 working tree 를 직접 대조한 결과 **이미 취소선-보존형 정정 + 실측 근거 + 잔여 위험의
별도 등재(측정 가능한 재개 신호 포함)** 로 6곳 이상에 일관되게 반영돼 있어 프로젝트
관례("유예 근거는 실측해야 한다", "총칭이 아니라 열거")를 모범적으로 따르고 있다. Rationale
연속성 관점에서 실질적 결함은 없다. 유일한 잔여 이슈는 `plan/in-progress/node-output-envelope.md`
의 체크리스트가 이미 완료된 작업을 반영하지 못해 실제 상태와 어긋나 있다는 plan 위생
문제이며, Rationale 자체의 정합성 문제는 아니다.

## 위험도

LOW
