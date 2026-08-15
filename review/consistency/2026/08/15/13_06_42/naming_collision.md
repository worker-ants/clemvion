# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 방법

`_prompts/naming_collision.md` 는 컨텍스트 예산 초과로 diff 본문 및 다수 관련 spec 파일이
절단되어 있었다. 이에 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`,
현재 세션 CWD 와 동일)에서 `git diff origin/main...HEAD` 를 직접 재실행해 변경 범위를 확인했다.

변경 파일(18개, 764 insertions / 78 deletions):
- `spec/5-system/14-external-interaction-api.md` (spec 본문 1개)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (+spec) — 신규 파일
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(+spec)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(+spec)
- `codebase/backend/src/modules/executions/executions.service.ts`(+spec)
- `codebase/backend/src/modules/statistics/statistics.service.ts`(+spec)
- `codebase/backend/src/modules/dashboard/dashboard.service.ts`(+spec)
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`(+spec) / `types.ts`
- `codebase/frontend/src/content/docs/05-run-and-debug/run-results{,.en}.mdx`

본 PR 은 EIA §6 필드 집합 표에서 이미 "미구현(Planned)" 으로 선언돼 있던 `durationMs` 를
"구현됨" 으로 전환하고, 취소·타임아웃 경로에도 값을 채우는 구현을 붙인 것 — **신규 요구사항·
신규 표면 추가가 아니라 기존에 spec 이 이미 선언한 필드의 상태 전환**이다. 부수적으로
Re-run API 참조 경로의 stale `/api/v1/` 접두를 실제 SoT(`/api/executions/:id/re-run`,
`spec/5-system/13-replay-rerun.md` §8.1)와 일치하도록 고쳤다.

## 발견사항

점검 관점 6가지(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 /
파일 경로) 전부에 대해 diff 를 대조한 결과, **충돌로 볼 항목은 없다**. 근거:

1. **요구사항 ID** — diff 는 기존 `durationMs` 행의 상태·본문만 바꿨고 신규 `EIA-*` ID 행을
   추가하지 않았다(`git diff` 상 `+` 라인에 `| EIA-` 신규 패턴 없음).
2. **엔티티/타입명** — `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`(`chat-channel/types.ts`)의
   `durationMs?: number` → `durationMs?: number | null` 타입 확장뿐, 신규 타입/인터페이스 없음.
3. **API endpoint** — 신규 endpoint 없음. 오히려 stale 참조(`/api/v1/executions/:id/re-run`,
   실제로 존재한 적 없는 경로)를 실제 SoT 경로(`POST /api/executions/:executionId/re-run`,
   `spec/5-system/13-replay-rerun.md:200`)로 정정 — 충돌 해소 방향.
4. **이벤트/메시지명** — `execution.completed`/`failed`/`cancelled` 는 기존 이벤트, 신규 이벤트명
   도입 없음.
5. **환경변수/설정키** — 신규 ENV var·config key 없음 (`git diff` 상 `process.env.*` 신규 참조 0건).
6. **파일 경로** — 신규 파일 `codebase/backend/src/shared/utils/terminal-duration.ts` /
   `terminal-duration.spec.ts` 는 동일 디렉터리의 기존 `terminal-error-payload.ts` /
   `terminal-error-payload.spec.ts` 와 같은 `terminal-*.ts` 명명 컨벤션을 따른다. 다른 위치에
   동명 파일 없음(`git ls-files | grep terminal-duration` 1쌍만 확인).

신규 식별자(`PG_INT4_MAX`, `resolveTerminalDurationMs`, `toFiniteNumber`,
`TERMINAL_DURATION_MS_SQL`, `TERMINAL_FINISHED_AT_PARAM`)를 전수 grep 한 결과 다른 의미로
쓰이는 기존 사용처는 없었고, 호출부(`execution-engine.service.ts`, `retry-turn.service.ts`,
`executions.service.ts`)에서 일관되게 import 되어 쓰인다.

- **[INFO]** 헬퍼 명명 접두어가 형제 파일과 다르다
  - target 신규 식별자: `resolveTerminalDurationMs` (`codebase/backend/src/shared/utils/terminal-duration.ts`)
  - 기존 사용처: 같은 디렉터리의 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 의
    `toTerminalErrorPayload` (동일 "종결 이벤트 필드를 한 곳에서 정규화" 역할의 형제 헬퍼)
  - 상세: 충돌은 아니나, 같은 EIA §6 종결 필드 정규화 역할을 하는 두 헬퍼가 `to*` (변환) vs
    `resolve*` (해석) 로 접두어가 갈린다. 의미상 `resolveTerminalDurationMs` 도 "DB/엔티티 →
    wire 값 변환"이라는 점에서 `toTerminalErrorPayload` 와 동일 카테고리라 `to*` 계열로 보일 수
    있다.
  - 제안: 필수 조치 아님. 다음에 이 파일 쌍을 다시 만질 때 참고할 수준의 명명 일관성 제안.

## 요약

이번 diff 는 이미 spec 에 선언돼 있던 `durationMs`(EIA §6 필드 집합 표)를 Planned → 구현됨으로
전환하는 좁은 범위의 변경이며, 신규 요구사항 ID·엔티티/타입·API endpoint·이벤트명·환경변수·
파일 경로 중 어느 것도 기존 사용처와 충돌하지 않는다. 오히려 Re-run API 참조 경로의 stale
`/v1/` 접두 오기를 SoT 와 일치시켜 기존에 존재하던 문서 간 불일치를 해소했다. 신규 코드
식별자(`terminal-duration.ts` 의 5개 export)는 grep 전수 확인 결과 다른 의미로 쓰이는 기존
사용처가 없고, 파일 배치도 형제 파일(`terminal-error-payload.ts`)의 명명 컨벤션을 따른다.

## 위험도

NONE
