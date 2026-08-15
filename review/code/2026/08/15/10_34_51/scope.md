STATUS=success

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — durationMs 종결 이벤트 배관 (3라운드, 10_34_51)

## 검토 방법

프롬프트에서 diff 가 생략된 파일(4·5·65번 등)은 `git diff origin/main -- <path>` 로 직접
열었다. 로컬 브랜치가 `origin/main` 대비 최신인지 `git log --oneline -15` 로 커밋 경계를
확인했고(`c37a3732c`~`6bedc7e3c`, 최신 HEAD 는 직전 `10_18_38` 라운드 RESOLUTION 을 반영한
fix 커밋), 의심 지점은 `git show <commit> -- <path>` 로 커밋 단위까지 분해해 "언제·어느
커밋에서" 들어왔는지 특정했다.

## 발견사항

- **[WARNING]** 직전 라운드(`10_18_38`) 후속 fix 커밋이, **`savedExecution`(Execution 엔티티) 1곳**을
  겨냥한 리뷰 지적을 처리하면서 **전혀 다른 엔티티(`NodeExecution`)의 durationMs 계산 8곳**까지
  같은 헬퍼로 바꿔치기했다 — CHANGELOG·plan·커밋 메시지 어디에도 이 8곳은 언급되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    — `runExecution` 내부 컨테이너 노드 실패 처리(:4833-4834), `executeNode` 내부 5개 지점
    (:6042-6043, :6161-6163, :6194-6196, :6212-6214, :6226-6228), `finalizeErrorPortNode`
    (:6302-6303), 컨테이너 재조회 실패 처리(:7941-7942). 커밋 `6bedc7e3c`
    (`git show 6bedc7e3c -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)
    한 곳에서 전부 도입됐다.
  - 상세: 이 PR 의 스코프는 EIA §6 **종결 이벤트 3종**(`execution.completed`/`failed`/`cancelled`,
    `Execution` 엔티티의 `durationMs`)이다. `10_18_38` 라운드 `side_effect.md` W-항목은
    정확히 `driveCallStackResume` 함수의 `savedExecution.durationMs`(:2576~2578, `Execution`
    엔티티) **한 곳**만 지적했다 — 코드 인용도 `savedExecution.durationMs = ...` 다.
    그런데 이를 조치한 커밋 메시지는 "9곳" 이라 보고했고, 실제 diff 를 열어 보면 그 9곳 중
    **1곳만 `savedExecution`(요청된 수정)이고 나머지 8곳은 `nodeExecution`/`nodeExec`**
    (`NodeExecution` 엔티티, `execution.node.completed`/`execution.node.failed` 내부 WS
    이벤트의 `duration` 필드 — 코드 상 `duration: nodeExecution.durationMs` 로 그대로
    emit 됨, :6053/:6313)이다. `NodeExecution` 은 이번 PR 이 다루는 EIA 외부 종결 payload
    와 무관한 별개 기능(워크플로 에디터 UI 의 노드별 실행 시간 표시)이다.
    같은 세션의 회고("전수로 셌다는 세는 도구가 대상의 형태를 담을 때만 참이다")가 그대로
    반증됐다 — 이번엔 멀티라인 정규식이 **범위를 좁히지 못하고 오히려 넓혀서** `savedExecution`
    과 `nodeExecution`/`nodeExec` 를 구분하지 않고 한꺼번에 치환한 것으로 보인다.
  - 실질 영향: 순수 리팩토링이 아니라 **동작이 바뀐다.** 종전엔
    `nodeExecution.durationMs = nodeExecution.finishedAt.getTime() - nodeExecution.startedAt.getTime()`
    로 무가드 뺄셈(음수·`Invalid Date` 그대로 wire 로 나가거나 `startedAt` 부재 시 throw)이었는데,
    지금은 `resolveTerminalDurationMs(nodeExecution) ?? nodeExecution.durationMs` 로
    음수·NaN 이 조용히 `null` 로 바뀐다. 8곳 중 7곳은 기존에 `if (startedAt)` 가드조차 없던
    무조건 대입이었고(:7941-7942 한 곳만 원래도 `if` 가드가 있었음), 이 비일관성 자체가
    "손으로 하나씩 판단한 결과"가 아니라 "정규식이 매치되는 대로 치환한 결과"임을 방증한다.
    `git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    에 `nodeExecution`/`nodeExec` 문자열이 **0건** — 이 8곳에 대한 신규 테스트가 전혀 없다
    (요청받았던 `driveCallStackResume` 1곳에 대한 테스트도 없다 — 별개 testing 관점 이슈).
  - 제안: 8곳(`nodeExecution`/`nodeExec`)을 이번 PR 범위에서 제외하고 별도 후속(node-level
    duration 하드닝)으로 분리하거나, 유지하려면 최소한 (1) CHANGELOG/plan 에 "node 레벨
    durationMs 계산도 같은 이유로 하드닝했다"고 명시하고 (2) 음수/`Invalid Date`/`startedAt`
    부재 케이스에 대한 노드 레벨 테스트를 추가할 것. 지금 상태로는 "durationMs 종결 3종"
    이라는 커밋 메시지·CHANGELOG·plan 서술이 실제 diff 보다 좁다.

- **[INFO]** (기존 라운드에서 이미 실측·용인된 항목, 변동 없음) `spec/5-system/14-external-interaction-api.md`
  의 `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run` 오탈자 정정 1줄은 별도
  커밋(`cdaa4291d`)으로 격리돼 있고, `--impl-prep` consistency-check 가 CRITICAL 로 잡아
  착수 전 의무적으로 해소한 게이트다(`09_58_24`·`10_18_38` scope 라운드가 이미 같은 결론).
  이번 라운드에서도 diff 위치·격리 상태 재확인 결과 동일 — 조치 불필요.

- **[INFO]** 테스트 mock(`.setParameter`/`.returning()`) 확산 범위가 실제 프로덕션 SQL 호출
  지점(5곳)보다 넓은 것은 `mockExecutionRepo.createQueryBuilder` 파일 전역 `beforeEach`
  기본 mock 1곳을 넓힌 파급임을 두 차례(`09_58_24`, `10_18_38`) 실측 확인했고, 이번
  라운드에서 추가로 건드린 부분도 없다(`git diff origin/main -- .../execution-engine.service.spec.ts`
  는 이번 최신 커밋에서 diff 0) — 조치 불필요.

## 그 외 확인한 항목 (문제 없음)

- `chat-channel.dispatcher.ts`(W8 대응, 3곳)·`chat-channel/types.ts`(3곳)의 `durationMs?: number`
  → `durationMs?: number | null` 캐스팅/타입 확장은 이 PR 이 넓힌 `Execution` 레벨 계약과
  정확히 일치하며 무관한 변경이 섞이지 않았다.
- `plan/in-progress/*.md` 3개·`review/code/**`·`review/consistency/**` 산출물은 CLAUDE.md 가
  명시한 강제 워크플로(구현 착수 전 `--impl-prep`, 완료 후 `/ai-review`+RESOLUTION,
  `--impl-done`)의 기대된 산출물이며 scope 이탈이 아니다.
- `terminal-duration.ts`/`.spec.ts`(신규 헬퍼)는 `Execution` 레벨 16 경로 배관 목적에 정확히
  부합하고, export 전부가 실제 사용처를 갖는다(미사용 공개 API 없음).
- 설정 파일(`package.json`/`tsconfig*`/CI workflow) 변경 없음.

## 요약

이번 PR 의 핵심 의도("종결 이벤트 3종의 `Execution.durationMs` 배관")는 대부분의 diff 에서
일관되게 지켜졌으나, 직전(`10_18_38`) 리뷰 지적 1건(`driveCallStackResume` 의
`savedExecution.durationMs`)을 조치한 마지막 fix 커밋(`6bedc7e3c`)이 그 지적과 무관한
`NodeExecution`(노드별 durationMs, 별개 기능인 내부 WS `execution.node.completed`/`failed`
이벤트의 `duration` 필드) 계산 8곳까지 같은 헬퍼로 바꿔치기했다. 이는 "지적받은 만큼만
좁게 고친다"의 반대 방향 실패 — 좁아야 할 수정이 멀티라인 정규식 때문에 관련 없는 코드
영역까지 넓게 퍼졌고, 그 결과 동작이 조용히 바뀐(음수/NaN 처리) 8개 지점이 CHANGELOG·plan·
커밋 메시지 어디에도 기록되지 않았으며 새 테스트도 없다. 나머지(스펙 오탈자 1줄, 테스트 mock
확산, 타입 확장, 신규 헬퍼)는 기존 라운드들이 이미 실측 검증했고 이번 라운드에서도 재확인
결과 동일하다.

## 위험도

MEDIUM
