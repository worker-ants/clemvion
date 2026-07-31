# Scope Review — retry_last_turn 재진입 짝 전이 DB 가드 (9R 이후 재확인 라운드)

## 조사 방법

리뷰 페이로드 5개 파일(`state/state-machine.ts`, `execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`)이
전부 "전체 파일 컨텍스트"(unified diff 섹션 없음)로만 주어져, 실제 변경 범위를 직접
git 으로 확정했다.

- `git log --oneline -15` — HEAD 는 `1838c6fec`("fix(engine): 9R CRITICAL 2건 — re-park
  경로 회귀 테스트 + FAILED→WAITING spec 반영"), HEAD~1 은 `2ca44b769`("8R CRITICAL"
  — retry 재진입 짝 전이 DB 가드 수정).
- `git show --stat HEAD -- <리뷰 대상 5개 파일>` → **출력 0건**. 즉 이번 최신 커밋은
  리뷰 대상 5개 파일 중 어느 것도 건드리지 않았다. 실제로 `1838c6fec` 가 건드린 파일은
  `execution-engine.service.spec.ts`(+53, 테스트) 와 `spec/4-nodes/3-ai/1-ai-agent.md` /
  `spec/5-system/4-execution-engine.md` / `spec/5-system/6-websocket-protocol.md`
  (문서 3개) 뿐이다 — 전부 이번 리뷰 대상 목록 밖.
- `git diff origin/main...HEAD -- <5개 파일>` 을 파일별로 개별 실행해 hunk 단위로
  독립 재대조했다 (아래 발견사항 참조). 이 5개 파일은 직전 두 라운드
  (`review/code/2026/07/30/15_33_04/scope.md` 4파일, `review/code/2026/07/30/12_56_04/
  scope.md` 의 `retry-turn.service.ts`)에서 이미 동일 diff 로 상세 검증되어 위험도
  NONE 판정을 받았던 것과 **바이트 단위로 동일한 코드**다 — HEAD~1→HEAD 사이에 이
  5개 파일에는 변경이 전혀 없었기 때문. 결론을 그대로 재사용하지 않고 5개 파일 diff
  전부를 다시 hunk 단위로 눈으로 대조했다.
- 최신 커밋이 실제로 건드린 out-of-list 파일(테스트 1개 + spec 문서 3개)도 내용을
  열어 커밋 메시지가 명시한 의도(C1 회귀 테스트/C2 SPEC-DRIFT 반영)와 대응하는지
  확인했다(아래 발견사항 참조).

## 발견사항

- **[INFO]** 리뷰 대상 5개 파일은 이번 세션 시점 기준 직전 두 라운드가 이미 검증한
  코드와 완전히 동일하다 — 그 사이 커밋(`1838c6fec`)이 이 5개 파일을 전혀 수정하지
  않았다.
  - 위치: 해당 없음 (`git show HEAD --stat -- state/state-machine.ts
    execution-engine.service.ts ai-turn-orchestrator.service.ts
    engine-driver.interface.ts retry-turn.service.ts` 공백 출력 — diff 자체가 없음)
  - 상세: 그럼에도 `git diff origin/main...HEAD -- <파일>` 5건을 각각 재실행해 독립
    재확인한 결과도 직전 라운드 결론과 일치한다.
    - `state-machine.ts`: opt-in 대상을 `FAILED→RUNNING` 단일에서
      `FAILED→(RUNNING\|WAITING_FOR_INPUT)` 로 확장 + 그 이유를 설명하는 주석 3곳.
      `ALLOWED_TRANSITIONS[FAILED]` 는 여전히 `[]` 로 미변경(방어 유지).
    - `engine-driver.interface.ts`: `tryLockActiveExecutionAndSaveNodeExec` 시그니처에
      `opts?: { allowRetryReentry?: boolean }` 1줄 추가 — 구현체 시그니처 변경에
      필수 동반.
    - `ai-turn-orchestrator.service.ts`: `reparkAiResumeTurn` 신규 `opts` 파라미터 +
      호출부 4곳에 이미 계산돼 있던 `finalizeOpts` 재전달, `tryLockActiveExecutionAndSaveNodeExec`
      호출 2곳에 이미 계산된 `allowRetryReentry` 재전달 — 신규 상태 변수 도입 없음.
    - `execution-engine.service.ts`: `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설(기존
      `NON_TERMINAL_STATUSES_SQL` 과 동일 패턴 재사용) + `lockNonTerminalExecutionRow`/
      `tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 의 두 guarded UPDATE
      분기(linkedNodeExec 유/무)에 opts 전파 3곳.
    - `retry-turn.service.ts`: `claimSpawnedRetryRow` 2차 원자 claim + `RETRY_STATE_KEY`
      상수화 — 12_56_04 라운드가 이미 plan(`retry-turn-terminal-guard.md`)의 승인된
      항목·RESOLUTION 처분표와 hunk 단위로 전량 대조 완료한 것과 동일 diff.
    8개 점검 관점(의도 이상 변경/불필요한 리팩토링/기능 확장/무관한 수정/포맷팅/주석/
    임포트/설정) 중 위반 0건 — import 라인 변경 없음, 함수 시그니처 변경은 이번 결함과
    직결된 4곳(`lockNonTerminalExecutionRow`, `tryLockActiveExecutionAndSaveNodeExec` 정의
    2곳, `reparkAiResumeTurn`)으로 한정.
  - 제안: 조치 불필요.

- **[INFO]** 실제 최신 커밋(`1838c6fec`)이 건드린 파일(`execution-engine.service.spec.ts`
  회귀 테스트 2건 + spec 문서 3개)은 이번 리뷰 대상 5개 파일 목록 밖이다.
  - 위치: 해당 없음 (out-of-list 파일)
  - 상세: 내용을 확인한 결과 커밋 메시지가 명시한 두 의도와 1:1 대응한다.
    (1) `execution-engine.service.spec.ts` — 기존 `describe('updateExecutionStatus
    누적…')` 블록 안에 focused 테스트 2건만 추가(opt-in 시 FAILED→WAITING_FOR_INPUT
    persist + 잠금 SQL 에 `'failed'` 포함 단언, 대조로 opt-in 없으면 미persist).
    (2) `spec/5-system/4-execution-engine.md` §1.1 다이어그램에 `waiting_for_input`
    엣지 추가 + 전이표에 `failed \| waiting_for_input` 행 신설 + Rationale 에 "세
    번째 갈래" 문단 추가, `6-websocket-protocol.md` §4.2 / `1-ai-agent.md` §12.8 에
    각 한 문단 — 전부 8R 이 신설한 `FAILED→WAITING_FOR_INPUT` opt-in 전이를 spec 에
    반영하는 단일 의도(C2 SPEC-DRIFT)에 귀속되며 무관한 spec 내용 변경은 없다.
  - 제안: 조치 불필요.

- **[WARNING]** 위 spec 문서 편집 중 `spec/5-system/4-execution-engine.md` 한 줄에
  마크다운 불릿 마커 중복 오타가 새로 생겼다.
  - 위치: `spec/5-system/4-execution-engine.md:1522` (Read 로 직접 확인한 실제
    소스 줄 번호 — 이번 리뷰 payload 에는 이 파일이 포함돼 있지 않아 게이트 인용 불가)
  - 상세: diff 를 보면 원래 있던 `- 재진입 성공 시 Execution 은 \`completed\`, …` 줄
    바로 앞에 "세 번째 갈래 — 재진입 turn 이 계속되는 경우" 신규 문단을 삽입하면서,
    기존 줄이 `- - 재진입 성공 시 Execution 은 …` (대시 2개) 로 바뀌었다. 두 줄 모두
    들여쓰기가 없어 마크다운 중첩 리스트로 해석되지 않고, 대부분의 렌더러에서 불릿
    뒤에 리터럴 `-` 문자 하나가 그대로 노출되는 표시 결함이다. 코드 로직·spec 의미
    내용에는 영향 없는 순수 편집 부산물(오타)이며, 이번 리뷰 대상 5개 파일 목록에는
    없는 파일이라 다른 리뷰어(documentation 등)와 중복 지적일 수 있다.
  - 제안: `- - 재진입` → `- 재진입` 으로 대시 1개만 제거.

## 커밋/파일 대조 요약

| 파일 | HEAD~1→HEAD(`1838c6fec`) 변경 | origin/main→HEAD 누적 변경 | 스코프 판정 |
|---|---|---|---|
| `state/state-machine.ts` | 없음 | opt-in 대상 확장 (WAITING_FOR_INPUT 추가) | 1:1 대응, 위반 없음 |
| `execution-engine.service.ts` | 없음 | `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 + opts 전파 3곳 | 1:1 대응, 위반 없음 |
| `ai-turn-orchestrator.service.ts` | 없음 | `reparkAiResumeTurn`/`tryLock…` 호출부 opts 전파(기존 계산값 재사용) | 1:1 대응, 위반 없음 |
| `engine-driver.interface.ts` | 없음 | 시그니처 opts 파라미터 1줄 | 구현체 변경 필수 동반 |
| `retry-turn.service.ts` | 없음 | 2차 원자 claim(`claimSpawnedRetryRow`) + `RETRY_STATE_KEY` 상수화 | 이전 라운드(12_56_04) 검증 완료분과 동일 |
| `execution-engine.service.spec.ts`(목록 밖) | focused 회귀 테스트 2건 | — | 9R 의도(C1)와 1:1 대응 |
| `spec/*.md` 3파일(목록 밖) | opt-in 전이 문서 반영 | — | 9R 의도(C2)와 1:1 대응, 단 1줄 오타(WARNING) |

## 요약

이번 세션이 리뷰 대상으로 받은 5개 프로덕션 파일은 직전 두 라운드(15_33_04 —
4파일, 12_56_04 — `retry-turn.service.ts`)가 이미 hunk 단위로 상세 검증해 위험도
NONE 판정을 내린 코드와 바이트 단위로 동일하다 — 그 사이의 유일한 신규 커밋
(`1838c6fec`, 9R)이 이 5개 파일을 전혀 건드리지 않았기 때문이다. 결론을 그대로
재사용하지 않고 5개 파일의 origin/main 대비 누적 diff 를 다시 독립적으로 hunk
단위 대조한 결과도 동일하게 "짝 전이 DB 가드에 opts 전파"라는 단일 의도를 벗어난
불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석·미사용
임포트·설정 변경은 발견되지 않았다. 실제 최신 커밋이 건드린 파일(회귀 테스트 1개 +
spec 문서 3개)은 이번 리뷰 목록 밖이지만 확인한 결과 커밋이 명시한 의도(회귀 테스트
보강 + SPEC-DRIFT 반영)에 정확히 대응했다 — 다만 그 spec 편집 과정에서 기존 불릿
줄 앞에 대시가 하나 더 붙는 사소한 마크다운 오타(`4-execution-engine.md:1522`)가
새로 생겨 WARNING 으로 기록한다(로직 영향 없는 표시 결함, 1글자 수정으로 해결).

## 위험도

LOW — 리뷰 대상 5개 파일 자체의 스코프 위반은 0건(그 기준만으로는 NONE)이나, 같은
작업의 최신 커밋이 목록 밖 spec 문서에 남긴 사소한 마크다운 오타 1건(WARNING)이
있어 보수적으로 LOW 로 기록한다.
