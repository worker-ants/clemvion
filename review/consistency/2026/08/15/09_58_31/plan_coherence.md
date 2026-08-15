# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 발견사항

- **[WARNING]** `durationMs` Planned→구현됨 전환이 "정본" 트래커 두 곳에 미반영
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 도입부 필드 집합 표
    (`durationMs` 행이 이번 diff 에서 `미구현 (Planned)` → `구현됨` 으로 전환됨) 및
    §6.3/§6.4/§6.5 payload 예시(`durationMs` 실값 삽입).
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
      (frontmatter 는 없지만 `eia-terminal-payload.md` 가 이 파일을 **"정본"**으로 명시함,
      `## 다른 plan 과의 관계` 절) L22-28 — `- [ ] **durationMs emit** (§6 도입부 필드 집합
      표의 Planned 2행 …) … 구현되면 필드 집합 표의 "미구현 (Planned)" 를 "구현됨" 으로
      flip 한다` — 아직 체크되지 않았고, target 이 이미 그 flip 을 완료했다는 사실이
      반영되지 않았다.
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
      L108 — 자체 (1) 표에 `| durationMs | 미구현 (Planned) | 데이터는 emit 직전 존재 |`
      가 여전히 남아 target 표와 직접 모순된다. L187-189 후속 체크박스
      `- [ ] emit 에 durationMs 채우기 — 종결 3종 전부 …` 도 미체크.
  - 상세: 현재 브랜치(`claude/eia-terminal-duration-outputs`, origin/main 대비 5 커밋)가
    `e2f4b3bfc`/`f403cd60d`/`0f0050dea`/`0dce2a83f` 로 종결 3종(completed 6·failed 4·
    cancelled 6, 총 16 경로) `durationMs` 구현을 완료했고, 마지막 커밋이 target spec 의
    Planned 캐비엇을 해제했다(§6 표 `구현됨`, §6.3/§6.4 JSON 예시에 실값, §6.5 신규 단락).
    그런데 `eia-terminal-payload.md` 자신이 "구현 후 그쪽 체크박스가 stale 로 남지 않게
    동시 갱신할 것" 이라고 지목한 두 파일 중 어느 쪽도 이 라운드에서 갱신되지 않았다.
    `spec-sync-external-interaction-api-gaps.md` 는 다른 여러 planner/impl-prep 게이트가
    "정본" 으로 참조하는 문서라, 이 상태로는 다음에 그 파일을 읽는 사람(또는 impl-prep
    checker)이 durationMs 를 여전히 미구현으로 오판할 수 있다. `eia-terminal-payload.md`
    자신도 이미 이 실패 패턴("체크리스트가 커밋 메시지보다 늦는다")을 같은 문서 안에서
    세 차례 자인했는데(`22_55_51` W11 · `23_18_06` W2 · `23_34_12` W2), 이번이 4번째
    재발이다.
  - 제안: plan 갱신. (1) `spec-sync-external-interaction-api-gaps.md` L22-28 의
    `durationMs emit` 체크박스를 `[x]` 로 전환하고 "16 경로 전부 완료(2026-08-15,
    `e2f4b3bfc`/`f403cd60d`/`0f0050dea`)" 근거를 남긴다. (2)
    `spec-draft-eia-notification-payload-contract.md` L108 표 행을 target 과 일치시키거나
    (`구현됨`) 최소한 "2026-08-15 구현됨 — 상세는 (durationMs 후속 항목) 참조" 각주를
    붙이고, L187-189 체크박스를 `[x]` 로 전환한다.

- **[INFO]** `eia-terminal-payload.md` 자신의 `### 다음 PR (이연)` 체크박스 및
  `## 체크리스트` 절이 이번 라운드(durationMs 구현)를 반영하지 않음
  - target 위치: 동일 (durationMs 관련 diff 전체)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` L199
    (`- [ ] durationMs — 종결 3종 전부 (사용자 결정 2026-08-15). 재판정 ④ 참조`, 미체크)
    및 L292-323 `## 체크리스트` (가장 마지막 항목이 이전 `error` PR 라운드의
    `/ai-review` 3차 `23_34_12` 로 끝나고, 이번 durationMs 구현·테스트·리뷰 라운드에
    대응하는 항목이 없다).
  - 상세: 위 WARNING 과 같은 근본 원인(구현 완료 시점과 plan 갱신 시점의 분리)의
    자기 문서 내 재발. `spec-draft-eia-62-waiting-payload.md`(§6.2 관련) 사례처럼,
    이 파일 하나가 이미 스스로 "체크리스트가 늦는다" 를 3회 기록해 둔 만큼, 같은 턴에
    체크박스를 커밋에 동봉하는 것이 유일한 해법이라고 스스로 적어 두었다 — 이번엔 아직
    그렇게 되지 않았다.
  - 제안: `eia-terminal-payload.md` 를 이번 durationMs 구현 커밋들과 같은 턴에 갱신 —
    L199 를 `[x]` 로, `## 체크리스트` 에 durationMs 라운드(`--impl-prep`/구현/테스트/
    `/ai-review`/`--impl-done` 흐름) 항목을 추가.

- **[INFO]** `retry-turn-terminal-guard.md` #2 의 줄 번호 인용이 이번 diff 로 stale
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `failRetryExecution` — durationMs 삽입으로 emit 블록이 원래 위치(`:956~965` 부근)에서
    아래로 이동함(현재 emit 블록은 약 `:963~975`).
  - 관련 plan: `eia-terminal-payload.md` `## 다른 plan 과의 관계` 절 — "같은 코드 블록
    (`retry-turn.service.ts` `failRetryExecution` `:956~965`)을 겨냥한다" 라는 줄 번호
    인용, 및 `retry-turn-terminal-guard.md` 자체의 관련 인용.
  - 상세: 함수 심볼(`failRetryExecution`)로도 특정 가능해 실질적 추적 실패 위험은 낮지만,
    이 저장소가 반복적으로 "줄 번호 인용은 리팩터마다 stale 해지므로 심볼로 고정한다" 는
    관행을 명시한 만큼, 정확도를 위해 갱신 여지가 있다. **decision 충돌은 아님** —
    두 plan 이 실제로 겨냥하는 코드가 여전히 같은 함수·같은 emit 호출부라 실질 충돌은 없다.
  - 제안: 우선순위 낮음. `retry-turn-terminal-guard.md` #2(`cancelledBy` 추가) 착수 시
    자연히 현재 코드를 다시 읽으므로 별도 조치 없이도 무방하나, 시간이 있으면 줄 범위
    인용을 제거하고 심볼 참조로만 남긴다.

## 요약

target 인 `spec/5-system/14-external-interaction-api.md`(및 동반 `3-execution.md`,
`chat-channel-adapter.md`) 의 이번 변경 — `durationMs` 를 종결 3종(completed/failed/
cancelled) 전부에서 `미구현 (Planned)` → `구현됨` 으로 전환 — 은 plan 이 "결정 필요"로
남겨 둔 항목과 충돌하지 않고, 사용자 결정("3종 전부", 2026-08-15)·재판정 ④의 실측과도
정합한다. §6.5 신규 단락(`EXECUTION_QUEUE_WAIT_TIMEOUT` 이 "큐 대기 시간"이라는 의미
차이 명시)도 재판정 ④ 서술과 일치하고, `chat-channel-adapter.md`/`3-execution.md` 동반
변경도 `eia-terminal-payload.md` 의 "spec 동반 변경 (전수)" 표와 1:1 대응한다. 다만 그
표를 만든 plan 자신, 그리고 그 plan 이 "정본"으로 지목한 `spec-sync-external-interaction
-api-gaps.md`·`spec-draft-eia-notification-payload-contract.md` 두 자매 트래커의 durationMs
체크박스/표 행이 이번 구현을 아직 반영하지 않았다 — target 변경이 만든 후속 갱신 의무가
plan 쪽에 아직 집행되지 않은 상태다. 이 실패 패턴은 같은 plan 문서가 이미 3회 자인한
것의 4번째 재발이며, `spec-sync-external-interaction-api-gaps.md` 가 다른 게이트들의
"정본" 참조점이라는 점에서 방치 시 향후 오판 위험이 있다.

## 위험도

MEDIUM
