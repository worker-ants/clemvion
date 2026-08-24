# Plan 정합성 검토 — spec/5-system/ (impl-prep)

## 조사 방법 메모

target 번들에 실린 `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md` 본문은
프롬프트 조립 시점(커밋 HEAD 기준)의 **구현 전 상태**였다. 그런데 실제 working tree 를
`git status`/`git diff` 로 재확인하니, 이 작업(`plan/in-progress/node-output-envelope.md`)의
구현·spec 정정이 **이미 uncommitted 로 완료**돼 있었다(코드 2파일 + spec 2파일 + 관련 문서 3곳
+ CHANGELOG). 최초 `git status --short` 호출이 이 변경분을 누락해 보고할 뻔했다 — 재확인
(`git status --porcelain`)으로 잡았다. 아래 평가는 **working tree 실제 상태** 기준이다.

## 발견사항

- **[WARNING]** `spec_impact` 목록이 실제 diff 를 못 따라간다
  - target 위치: `plan/in-progress/node-output-envelope.md` frontmatter `spec_impact`
    (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 2건만 나열)
  - 관련 plan: 동일 문서 자신 (Gate C 대상 — 완료(`complete/`) 이동 시점에 `spec-plan-completion.test.ts` 가 강제)
  - 상세: 실제 working tree diff 는 spec 파일을 **3곳** 건드렸다 — 위 2곳에 더해
    `spec/conventions/conversation-thread.md` §8.4 정정 blockquote(같은 "이종 payload 라 같은
    목록을 걸 수 없다" 취소선 패턴, 2026-08-24)도 이번 작업의 일부다. in-progress 단계에서는
    Gate C 가 아직 강제되지 않으므로 지금 당장 fail 하지는 않지만, 이 상태로 `complete/` 로
    이동하면 `spec_impact` 선언이 실제 변경분보다 좁아 게이트를 통과는 하되 부정확한 기록이 남는다.
  - 제안: `complete/` 이동 전에 `spec_impact` 에 `spec/conventions/conversation-thread.md` 추가.

- **[WARNING]** plan 체크리스트가 실제 진행 상태를 반영하지 않는다
  - target 위치: `plan/in-progress/node-output-envelope.md` `## 작업` 체크리스트 8항목 (전부 `[ ]`)
  - 관련 plan: 동일 문서 자신 + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    (CRITICAL 항목, line 136 부근)
  - 상세: `git diff` 로 확인한 실제 상태는 다음과 같이 이미 완료돼 있다 — (1)
    `allowlistFanoutNodeOutput` → `narrowTopLevelNodeOutput` 리팩터로 `envelope.output` 배선 완료
    (`websocket.service.ts`), (2) 캐너리 3종(`_retryState` 제거·렌더 키 보존·내부 WS 불변·flat
    폴백 고정) 추가 완료(`websocket.service.spec.ts`), (3) `[잔여]` 캐너리가 실제로 뒤집혀
    `[캐너리] execution.node.* 의 envelope.output 도 allowlist 를 지난다` 로 교체됨, (4) "(planner
    턴)" 항목도 완료 — EIA §R17 표 flip + 취소선 정정 + WS §4.4 단서 갱신 + **마스터 트래커
    `spec-sync-external-interaction-api-gaps.md` 의 해당 CRITICAL 항목을 `[x]`+취소선+`<details>`
    이력보존으로 종결하고 파생 신규 항목("`finalAdapted ?? nodeOutputCache` 폴백…")까지 등재**
    + `CHANGELOG.md`·`plan/complete/sse-nodeoutput-allowlist.md` 동반 정정까지 전부 반영됨.
    체크리스트만 보면 아직 착수 전으로 보이나 실제로는 뮤테이션 검증·TEST WORKFLOW·`/ai-review`
    3항목만 남은 상태다. 다음 세션(또는 이 세션의 다음 턴)이 문서만 읽고 이미 끝난 배선·planner
    턴 작업을 중복 수행하거나, 마스터 트래커가 이미 닫혔다는 사실을 놓칠 위험이 있다.
  - 제안: 커밋 전에 완료된 5개 항목을 `[x]` 로 갱신(또는 커밋 직전 한 번에 동기화).

## 교차 확인 — 발견되지 않은 항목 (반증 과정 기록)

아래는 처음 의심했으나 실측으로 반증된 항목이다 — 향후 동일 오탐 방지용으로 남긴다.

- ~~마스터 트래커(`spec-sync-external-interaction-api-gaps.md`)의 CRITICAL 항목이 갱신되지
  않았다~~ → **반증**. `git status --porcelain` 재확인 결과 해당 파일이 이미 수정돼 있었고,
  `[x]`+취소선+`<details>` 이력보존+파생 신규 항목 등재까지 기존 선례(같은 파일 72~94행 패턴)를
  그대로 따라 정확히 처리돼 있었다.
- WS §4.4 caveat("`execution.node.*` 의 `envelope.output` 은 이 좁히기 대상이 아니다") 문장이
  target 번들엔 취소선 없이 그대로 보였으나, 이는 번들이 구현 전 커밋 스냅샷을 담았기 때문 —
  working tree 실제 파일은 이미 취소선+정정으로 갱신돼 있다.
- `node-output-allowlist.ts` 의 13키 목록 자체는 이번 diff 로 변경되지 않았다(실측: 해당 파일
  diff 없음) — 마스터 트래커의 "wire-only 8키가 `node-output.md` Principle 0 레지스트리 밖" 미해결
  항목(별도, planner 소관)에 새 영향 없음. 충돌 없음.
- `plan/in-progress/node-output-redesign/**` 및 `_retryState` 를 참조하는 다른 in-progress
  plan(`retry-turn-terminal-guard.md` 등)은 엔진 내부 재개 메커니즘을 다룰 뿐 이번 fanout 노출
  범위 변경과 겹치는 가정이 없다 — 충돌 없음.

## 요약

Target(`spec/5-system/6-websocket-protocol.md`, `14-external-interaction-api.md`)과
`plan/in-progress/node-output-envelope.md` 사이의 실질 충돌은 없다. 이 plan 이 스스로 반증한
유예 근거("`envelope.output` 은 이종 payload 라 같은 목록을 걸 수 없다")는 실 DB 조회(e2e 285건)
로 뒷받침됐고, 그 정정은 마스터 트래커(`spec-sync-external-interaction-api-gaps.md`)·
`plan/complete/sse-nodeoutput-allowlist.md`·`spec/conventions/conversation-thread.md`·
`CHANGELOG.md` 까지 취소선 정정 패턴으로 일관되게 동반 반영돼 있다(모두 uncommitted 이지만
working tree 에 이미 존재). 남은 문제는 두 가지 **문서 부기(bookkeeping) 갭**뿐이다 — plan
frontmatter `spec_impact` 가 실제 3번째 spec 파일(conversation-thread.md)을 누락했고, plan
체크리스트가 이미 끝난 5개 항목을 여전히 미체크로 표시한다. 둘 다 커밋 전 정리하면 되는 낮은
비용의 수정이며, 결정 충돌이나 선행 조건 미해소는 확인되지 않았다.

## 위험도

LOW
