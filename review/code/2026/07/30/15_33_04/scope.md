# Scope Review — retry_last_turn 재진입 짝 전이 DB 가드 수정

## 조사 방법

리뷰 페이로드 5개 파일이 전부 "전체 파일 컨텍스트"(diff 아님, unified diff 섹션 없음)로만
주어졌다 — `git diff`/`git diff --cached` 가 대상 파일에서 빈 결과를 반환했기 때문으로
보인다(커밋 후 워킹트리가 clean). 실제 변경 범위를 확정하기 위해 아래를 직접 대조했다:

- `git show --stat HEAD` / `git show HEAD -- <5개 중 diff 있는 4개 파일>` — 최신 커밋
  `2ca44b769`("fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지
  않던 결함 (8R CRITICAL)")의 실제 hunk.
- `git diff origin/main...HEAD -- codebase/ spec/` — 이 브랜치 전체(origin/main 대비
  9개 커밋) 의 파일 목록. 리뷰 페이로드 5개 파일은 이 중 프로덕션 코드 4개
  (`state-machine.ts`/`execution-engine.service.ts`/`ai-turn-orchestrator.service.ts`/
  `engine-driver.interface.ts`) + `retry-turn.service.ts` 와 정확히 일치한다(단,
  `continuation-execution.processor.ts` 는 브랜치 diff 에는 있으나 이번 페이로드
  대상은 아니다 — 다른 라운드 소관으로 판단, 재조사하지 않음).
- `review/code/2026/07/30/12_56_04/`(8R, 동일 worktree 미커밋 산출물) — 바로 이전
  라운드가 `retry-turn.service.ts`/`retry-turn.service.spec.ts` 2개 파일만 대상으로
  수행됐고, 그 라운드의 `concurrency` 리뷰어가 지목한 CRITICAL #1 이 정확히 이번
  커밋이 고친 결함과 1:1 로 일치함을 확인했다 — 이번 세션은 그 CRITICAL 을 고친
  fix 커밋에 대한 fresh 리뷰다.
- `Read` 로 실제 소스 파일을 열어 아래 인용 줄 번호를 원본과 대조했다(페이로드
  게이트가 `execution-engine.service.ts` 는 8,582줄 중 1,225줄까지만 표시되고 잘려,
  이번 diff hunk 다수가 그 절단 지점 밖에 있었기 때문).

## 발견사항

- **[INFO]** 커밋에 프로덕션 코드 4파일 + 테스트 3파일 외에 `spec/5-system/
  4-execution-engine.md` 1줄(§7.3 링크 앵커 `#73-크래시-재개` → `#73-멱등성-보장`)이
  같은 커밋에 포함돼 있다. 이 파일은 이번 리뷰 대상 5개 파일 목록에는 없다.
  - 위치: `spec/5-system/4-execution-engine.md:1394`(리뷰 페이로드 밖 — git으로 직접 확인)
  - 상세: 이 앵커는 이번 fix 가 아니라 **직전 커밋** `025aedd0f`(같은 브랜치, 같은
    세션)에서 신규 도입된 오류이고, 커밋 메시지 자신이 "spec 링크 가드가 내가 추가한
    앵커 오류를 잡아 정정"이라고 명시해 은폐 없이 공개했다. 코드 로직과 무관한 1줄
    문서 자기교정이며, retry 짝 전이 DB 가드 수정이라는 이번 커밋의 본 의도와는
    별개 관심사다. 다만 이 저장소는 유사 사례(§코드 표 이력의 "6R: 무관 plan 문서
    편집 2건이 이미 `b351731f0` 에 같은 커밋으로 포함됨 — 되돌리지 않음, 기록만")를
    이미 "허용 가능한 drive-by 정정"으로 처리한 선례가 있다.
  - 제안: 조치 불필요. 되돌릴 실익 없음(정정 자체가 옳고 자기모순 링크를 고친 것).
    향후 라운드에서 "spec 자기교정과 코드 fix 를 같은 커밋에 묶지 말 것" 원칙을
    세우고 싶다면 별도 커밋 분리를 권장 수준으로만 기록.

- **[INFO]** 신규/확장 JSDoc·인라인 주석의 절대량이 실제 로직 변경량 대비 크다
  (`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 선언부 JSDoc 14줄 vs 상수 정의 자체 9줄,
  `tryLockActiveExecutionAndSaveNodeExec` 3번째 파라미터 위 인라인 주석 6줄,
  `reparkAiResumeTurn` opts 파라미터 위 인라인 주석 7줄).
  - 위치: `execution-engine.service.ts:520-533`(상수 JSDoc), `:8227-8232`
    (`tryLockActiveExecutionAndSaveNodeExec` opts 인라인 주석), `:8415-8419`/
    `:8454-8457`(guarded UPDATE 두 분기의 CRITICAL #1 인라인 주석);
    `ai-turn-orchestrator.service.ts:435-441`(`reparkAiResumeTurn` opts 인라인 주석)
  - 상세: 다만 각 문단은 전부 "왜 이 opts 가 여기 필요한가"(무엇이 깨졌었고 왜
    이 파라미터 전파가 그것을 고치는가)를 정확히 지목하며 무관한 내용이 아니다.
    직전 라운드(8R, `review/code/2026/07/30/12_56_04/scope.md`)가 `retry-turn.
    service.ts` 에서 동일 패턴(결함 재발 방지용 근거 주석 누적)을 이미 "신규
    스코프 이탈이 아니라 이 코드베이스가 반복 채택 중인 기존 관행"으로 판정했고,
    이번 진단도 그 관행의 연장이다.
  - 제안: 조치 불필요. plan(`retry-turn-terminal-guard.md` §코드 표 #12/#18)이
    이미 "안정화 후 일괄 정리" 대상으로 추적 중이므로 별도 신규 등재 불요.

- **[INFO]** 리뷰 대상 5번째 파일 `retry-turn.service.ts` 는 이번 커밋에서 **0줄
  변경**이다(`git show --stat HEAD` 미포함, `git diff HEAD~1..HEAD -- retry-turn.
  service.ts` 출력 없음). 8R 스코프 리뷰(직전 라운드)가 "이 파일만으로는 고칠 수
  없고 근본 수정은 다른 3파일"이라 명시했던 것과 정확히 일치 — 이번 커밋이 그
  파일을 건드리지 않은 것은 예상된 동작이며 스코프 이탈이 아니다.
  - 위치: 해당 없음(diff 자체가 없음)
  - 상세: 8R SUMMARY 가 "이 파일의 '재진입 구현 완료' JSDoc 서술이 현재 정확하지
    않을 가능성이 높다"고 언급했으나, 이는 스코프(과잉 변경) 문제가 아니라 문서
    최신성 문제라 documentation/requirement 리뷰어 소관으로 남겨둔다.
  - 제안: 조치 불필요(스코프 관점에서는 문제 없음).

## 커밋 단위 대조 (`2ca44b769`, 8개 파일)

| 파일 | 실질 변경 | 커밋 의도(짝 전이 DB 가드 전파)와의 대응 |
|---|---|---|
| `state/state-machine.ts` | `canTransition` opt-in 조건에 `WAITING_FOR_INPUT` 타깃 추가(gate 68-79) + 관련 주석 3곳 | 1:1 대응 |
| `execution-engine.service.ts` | `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설(gate 520-543) + `lockNonTerminalExecutionRow`(:8168-8184) opts 파라미터 신설 + `tryLockActiveExecutionAndSaveNodeExec`(:8224-8241) opts 파라미터 신설·전파 + `updateExecutionStatus` linkedNodeExec 분기(:8420-8424)·else 분기(:8454-8461) 양쪽에 opts 전파 | 1:1 대응 |
| `ai-turn-orchestrator.service.ts` | `reparkAiResumeTurn`(:430-458) opts 파라미터 신설·전파 + 호출부 4곳(:237,303,321,339)에 기존 변수 `finalizeOpts` 재사용 전달 + `tryLockActiveExecutionAndSaveNodeExec` 호출 2곳(:1505-1508,1597-1600)에 기존 변수 `allowRetryReentry` 재사용 전달 | 1:1 대응(신규 상태 변수 도입 없음 — 기존 계산값 재사용) |
| `engine-driver.interface.ts` | `tryLockActiveExecutionAndSaveNodeExec` 시그니처에 opts 파라미터 1줄 추가(:213) | 구현체 시그니처 변경에 필수 동반 |
| `*.spec.ts` 3파일 | mock 하드코딩(항상 성공)을 실제 SQL·status 대조로 교체 + 신규 회귀 테스트(state-machine 3건, else 분기 2건) + 호출 시그니처 변경에 따른 기계적 `undefined` 인자 추가(5곳) | 커밋 메시지가 "mock 하드코딩이 결함을 8라운드 은폐"라고 명시한 근본 원인 제거 — 회귀 방지에 필수 |
| `spec/5-system/4-execution-engine.md` | 링크 앵커 1줄 정정 | 위 INFO #1 참조 — 별개 관심사지만 disclosed·trivial |

프로덕션 코드 diff 전 hunk(8개, `ai-turn-orchestrator.service.ts` 만도 8개 hunk 확인)를
훑은 결과, "짝 전이 DB 가드에 opts 전파" 라는 단일 의도를 벗어난 메서드 손질·포맷팅·
미사용 임포트·설정 변경은 없다. import 문 변경 0건(diff 에 import 라인 없음), 함수
시그니처 변경은 이번 결함과 직접 연결된 3개(`lockNonTerminalExecutionRow`,
`tryLockActiveExecutionAndSaveNodeExec` ×2 정의, `reparkAiResumeTurn`)로 한정된다.

## 요약

이번 커밋(`2ca44b769`)은 "retry_last_turn 재진입 짝 전이가 상태머신 opt-in 은 통과하나
DB 가드에는 도달하지 못해 항상 0행이었다"는 단일 결함을 고치는 데 정확히 필요한
4개 프로덕션 파일 + 3개 테스트 파일만 건드렸고, 신규 상태 변수 도입 없이 이미 존재하던
`finalizeOpts`/`allowRetryReentry` 계산값을 호출부까지 재사용·전파했을 뿐이다. 리뷰
대상 5번째 파일(`retry-turn.service.ts`)은 실제로 변경되지 않았으며 이는 직전(8R) 리뷰가
예견한 대로다. 유일한 지적 사항은 관심사가 다른 1줄 spec 링크 앵커 정정이 같은 커밋에
동반된 점인데, 커밋 메시지가 이를 투명하게 공개했고 이 저장소에 유사 drive-by 정정을
"기록만 하고 되돌리지 않는다"로 처리한 명시적 선례가 있어 실질적 위험은 없다. 8개
점검 관점(의도 이상의 변경/불필요한 리팩토링/기능 확장/무관한 수정/포맷팅/주석/임포트/
설정) 중 조치가 필요한 위반은 발견되지 않았다.

## 위험도

NONE
