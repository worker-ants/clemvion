# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (00_51_53, fix 검증 라운드)

> 이번 라운드는 직전(`23_58_23`) concurrency·requirement·side_effect 3인이 독립 재현한 CRITICAL —
> `start()`(eager 부팅) 자신의 지연 `seedWaitingFromStatus` 호출이 boot 축 무방비라, 재전송 복원 분기가
> 넘겨받아 SSE 로 전진시킨 화면을 뒤늦은 응답이 옛 노드로 되감고 두 번째 `EventSource` 까지 여는 결함 —
> 을 고친 커밋 `7cfbf2557`(+ 후속 정합 커밋 `a2cd6ebb7`·`213561c3f`, 둘 다 문서/테스트 리팩터만)에 대한
> **fix 검증**이 목적이다. 격리 `git worktree add --detach`(HEAD `5eed8cf96` pinned, 원 워크트리는
> 읽기 전용)에서 실측했고, 검증 후 `git worktree remove --force` + `rm -rf` 로 제거했다.

## 검증 방법

1. **baseline** — HEAD(fix 적용) 상태에서 `pnpm install --frozen-lockfile`(공유 pnpm store 재사용,
   16.8s) 후 `npx vitest run` → **391 passed(22 파일)**, `npx tsc --noEmit` 클린.
2. **mutation ①(핵심 검증)** — `start()`의 `seedWaitingFromStatus(client, session, { boot: bootAtStart })`
   에서 `{ boot: bootAtStart }` 인자를 제거(fix 이전 상태로 되돌림) → 재실행.
3. **mutation ②(증상 분리 확인)** — mutation ① 상태에서 신설 회귀 테스트의 두 단언 순서를 바꿔
   (`esCount` 를 먼저 단언) 되감기 증상과 이중 스트림 증상을 **독립적으로** 각각 재현.
4. **파생 시나리오 실측(신규 throwaway 테스트)** — `start()` 의 지연 seed 가 in-flight 인 동안 재전송이
   **BLOCKED**(embed allowlist 거부)로 귀결되는 경우를 별도로 구성해 오작동 여부 확인.
5. 검증 후 mutation·throwaway 테스트 전부 되돌리고(diff 0 확인) 격리 worktree 제거.

## 발견사항

- **[정보 — fix 검증 결과: 유효함]** `start()` 의 지연 seed 되감기·이중 EventSource CRITICAL은 실제로 닫혔다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612-666`(`start()`), `:520-581`
    (`seedWaitingFromStatus`), 회귀 테스트 `use-widget-eager-start.test.ts:3223`
    ("start() 의 지연 seed 가 재전송이 전진시킨 화면을 되감거나 두번째 스트림을 열지 않는다")
  - 상세(코드 추적 + 실측 mutation 둘 다):
    - `start()` 는 진입 시 동기 구간에서 `const gen = ++worldGenRef.current;`(world, 세대 증가) 다음
      `const bootAtStart = bootGenRef.current;`(boot, **읽기전용** — `beginBootAttempt()` 미사용)를
      캡처한다. 두 캡처 사이·이전에 `await` 가 없어(전부 동기) 캡처 시점 경합 창이 없다.
    - 웹훅 resolve 후 `seedWaitingFromStatus(client, session, { boot: bootAtStart })` 로 전달되고,
      함수 내부 WAITING 분기의 `if (attempt && cannotApplyConfig(attempt)) return "stale";`
      (`:550`)가 이 스냅샷으로 게이팅한다. `outcome !== "continue"` 조기 return(`:652`)이
      `openStream` 호출 자체를 막으므로 되감기와 이중 스트림 두 증상을 **한 게이트**로 함께 막는다.
    - **mutation ①**(`{ boot: bootAtStart }` 제거) 결과 — 391 건 중 **정확히 1건**만 실패, 실패
      지점도 커밋 메시지가 주장한 그대로: `expected 'n1' to be 'n2'`(신설 테스트 단독 실패, 나머지
      390건 그린). 커밋 메시지의 "mutation: boot 스냅샷 인자 제거 → 정확히 이 테스트만 실패(n1)"
      주장을 그대로 재현 — 신뢰 가능.
    - **mutation ②**(단언 순서 교체로 `esCount` 먼저 확인) — 같은 mutation ① 상태에서
      `expected 2 to be 1`(두 번째 `EventSource` 실제로 열림)을 독립 확인. 즉 이 fix 는 "화면 되감기"
      와 "스트림 이중 생성" 두 증상을 **하나의 boot 스냅샷 게이트**로 동시에 닫는다 — 부분 수정이
      아니다.
  - 결론: 커밋의 재현·수정·검증 서술은 과장 없이 정확하다. 리뷰이므로 별도 조치 불필요.

- **[정보 — 확인됨, 문제 없음]** 종료 확정은 여전히 world 축만 본다(대체된 `start()` seed 도 종료를
  놓치지 않는다)
  - 위치: `seedWaitingFromStatus` 의 분기 순서(`:537` world 체크 → `:543-546` 종료 확정 → `:547-563`
    WAITING, boot 체크는 이 안에만 있음)
  - 상세: 종료 확정 분기(`if (TERMINAL...) { finalizeEnded(...); return "ended"; }`)는 `attempt` 를
    전혀 참조하지 않는다 — `start()` 가 넘긴 `attempt`든 `applyConfig` 가 넘긴 `attempt`든 코드
    경로가 완전히 동일(공유 함수, 분기 이전)하므로 "대체된 시도가 발견한 종료는 그대로 확정된다"
    회귀 테스트(`:3113`, `applyConfig` 복원 분기로 구성)가 이미 고정한 불변식이 `start()` 경로에도
    구조적으로 그대로 적용된다. 다만 이 테스트는 `applyConfig` 대 `applyConfig` 겹침만 구성하고
    `start()` 자신의 attempt 가 실제로 superseded 된 채 terminal 을 발견하는 조합은 **전용 회귀
    테스트가 없다** — 낮은 우선순위 제안(아래 WARNING) 참조.

- **[정보 — 확인됨, 문제 없음]** BLOCKED·무효(`!apiBase`) 재전송이 `start()` 의 지연 seed 와 겹쳐도
  오작동하지 않는다
  - 위치: `establishConfig`/`applyConfig` 의 `!cfg.apiBase` 조기 return(`beginBootAttempt()` **이전**,
    이 diff 가 건드리지 않은 기존 라인) vs `beginBootAttempt()` → `isEmbedAllowed` await → `!allowed`
    시 `BLOCKED` dispatch(`beginBootAttempt()` **이후**)
  - 상세:
    - **무효 config**(`!apiBase`/`!triggerEndpointPath`): `beginBootAttempt()` 호출 전에 return 하므로
      `bootGenRef` 가 증가하지 않는다("죽은 대체자"는 세대를 소모하지 않는다는 기존 불변식, 이 diff
      무변경). 따라서 `start()`의 `bootAtStart` 스냅샷은 그대로 유효하게 남고 자기 seed 는 정상
      dispatch 된다 — 무효 재전송이 정상 흐름을 방해하지 않는다.
    - **BLOCKED**(embed allowlist 거부): `beginBootAttempt()` 는 embed 체크 **이전**에 호출되므로
      BLOCKED 로 귀결돼도 `bootGenRef` 는 증가한다. 즉 `start()`의 `bootAtStart` 는 stale 판정을
      받아 그 지연 seed 의 `WAITING` dispatch 가 **스킵된다**. throwaway 테스트로 직접 구성해
      확인(embed-config 1차 호출은 fail-open 허용, 2차 호출은 `enforce:true`+`referrer` 불일치로
      거부): `phase` 는 `"blocked"` 로 유지, `pending` 은 `null`, 신규 `EventSource` 는 **0개**.
      즉 BLOCKED 이후 도착한 stale seed 가 차단 화면을 되돌리거나 몰래 스트림을 여는 일이
      **없다** — 이 boot 축 게이팅은 BLOCKED 조합에서 오히려 방어적으로 유리하게 작동한다(원치
      않는 부작용이 아니라, "차단된 호스트로 화면이 새는" 별개의 잠재 문제를 부수적으로 막는다).
  - 제안: 없음(범위 내 정상 동작). 참고로 이 BLOCKED 상호작용은 새 회귀 테스트로 고정돼 있지 않다
    — 아래 WARNING 참조.

- **[정보 — 확인됨]** `seedWaitingFromStatus` 호출부는 정확히 3곳이고 서로 상호배타적이다(4번째
  무방비 경로 없음)
  - 위치: `use-widget.ts:651`(`start()`, boot 스냅샷), `:982`(`applyConfig` 복원 분기, `beginBootAttempt()`
    토큰), `:426`(`handleEiaEvent` 의 `execution.replay_unavailable` 폴백, attempt 없음)
  - 상세(정적 확인 — `grep -n "seedWaitingFromStatus("` 로 호출부 2곳만 인자 3개짜리임을 확인, 3번째는
    `handleEiaEvent` 안에서 `seedWaitingFromStatusRef.current?.(client, session)` 2-인자 호출):
    - (start, applyConfig 복원): 이번 fix 가 다루는 조합 — mutation 으로 검증 완료(위).
    - (applyConfig 복원, applyConfig 복원): 전전 라운드(18_39_11)가 검증한 조합 — `isAttemptStale`.
    - (start, replay_unavailable): `replay_unavailable` 은 SSE 로만 발화하는데, `start()`는 자기
      seed 가 `"continue"` 를 반환한 **뒤**에만 `openStream`(스트림 개설)하므로, `start()`의 seed
      가 in-flight 인 동안은 스트림이 아직 없어 `replay_unavailable`이 발화할 수 없다 — 순서상
      배타.
    - (applyConfig 복원, replay_unavailable): 복원 분기는 `sessionEstablished()`(`streamRef.current
      !== null`) 가 참이면 통째로 스킵되는데, `replay_unavailable`이 발화하려면 정의상 스트림이
      이미 열려 있어야(`streamRef.current !== null`) 하므로 그 순간의 복원 분기는 항상 스킵된다 —
      배타.
    - (start, start): `startedRef` 가 첫 `await` 이전 동기적으로 세팅되므로 같은 마운트에서 두
      `start()` 인스턴스가 겹칠 수 없음(이 diff 무관, 기존 가드).
    - 따라서 3개 호출부의 **모든 쌍**이 커버돼 있고, 이번 fix 이후 무방비로 남은 조합은 없다.

- **[WARNING]** 낮은 우선순위 — `start()` 경로 특유의 두 파생 조합에 전용 회귀 테스트가 없다
  - 위치: (1) `start()`가 넘긴 `attempt`가 실제로 superseded 된 채로 자기 seed가 **terminal**을
    발견하는 조합(종료 확정이 boot 축을 무시하는지), (2) `start()`의 seed in-flight 중 재전송이
    **BLOCKED**로 귀결되는 조합.
  - 상세: 둘 다 이번 실측(코드 추적 + 임시 throwaway 테스트)으로 **현재 코드가 옳게 동작함**을
    직접 확인했다. 다만 (1)은 "종료 확정은 world 만" 불변식이 `applyConfig` 경로로만 회귀
    고정돼 있어 `seedWaitingFromStatus`가 공유 함수라는 사실에 의존하는 논증이고, (2)는 아예
    회귀 테스트가 없다 — 둘 다 이 파일이 "명백히 안전해 보이는 것"이 실은 안전하지 않았던 사례를
    여러 차례(이번 PR만 3번째 되감기 경로) 낸 전력이 있어, "구조상 안전"과 "테스트로 고정됨"의
    간극이 이 코드베이스에서 실제로 반복 재발한 축이다. 이번 라운드 자체가 "18_39_11 concurrency
    가 `start()`를 안전하다고 결론지었다가 23_58_23 에서 반증된" 사례이므로, 이 경고는 추상적
    우려가 아니라 같은 파일의 실제 재발 패턴에 근거한다.
  - 제안: 필수 아님(현재 동작 정정 불필요) — 여유가 있으면 `use-widget-eager-start.test.ts` 에
    (1) "start() 의 대체된 seed 가 발견한 종료도 확정된다" 짝 테스트, (2) 위 throwaway 테스트에
    준하는 "BLOCKED 재전송이 start() 의 지연 seed 를 되살리지 않는다" 테스트를 추가해 향후
    `useEiaSession` 분리(`webchat-usewidget-extraction.md` 이월 항목) 시 이 불변식이 코드 이동
    과정에서 조용히 깨지지 않도록 defense-in-depth 로 고정할 것을 권한다.

- **[INFO]** 공유 워크트리에서 병렬 리뷰어의 동일 mutation 잔존 관측(내 세션 무관, 조치 안 함)
  - 위치: 리뷰 종료 시점 `git status --short` 확인 결과 `codebase/channel-web-chat/src/widget/
    use-widget.ts` 가 로컬 미커밋 상태로 `{ boot: bootAtStart }` 인자가 제거돼 있었고(=내가 이번
    라운드에 검증한 것과 동일한 mutation ①), 신규 `zz-scratch-boot-during-webhook.test.ts`(167줄,
    미추적)도 함께 있었다.
  - 상세: 이 변경은 내 세션이 만든 것이 아니다 — 나는 mutation 을 전부 격리된 detached worktree
    (`/private/tmp/.../scratchpad/mutcheck`)에서만 수행했고, 공유 워크트리에는 `Read`/읽기 전용
    `git` 명령만 사용했다(diff 0 확인). "병렬 리뷰어 다수"라는 지시대로 다른 리뷰 세션(아마도
    같은 concurrency 관점 또는 requirement/side_effect 재검증)이 공유 워크트리에 직접 실측 중인
    것으로 보인다 — `apiBase`·CHANGELOG 이월 사례처럼 이 프로젝트가 이미 알고 있는 패턴(사용자
    메모리 "ai-review flaky 측정 아티팩트": 공유 worktree 동시편집이 리뷰 결과를 오염시킬 수 있다)
    이 실시간으로 관측됐다. 내 결론은 이 상태에 의존하지 않는다(격리 재현으로 독립 확보) — 다만
    다른 병렬 리뷰어가 같은 결론(동일 mutation)에 도달 중이라는 정황은 이번 fix 검증의 교차
    확증으로 읽을 수 있다. 조치는 하지 않았다(진행 중인 다른 세션의 작업을 되돌리는 것이 더
    위험) — 요약자는 이 항목을 근거로 삼지 말고 각 리뷰어의 격리 검증 결과만 종합할 것을 권한다.

## 요약

이번 라운드가 검증 대상으로 지목한 커밋 `7cfbf2557`은 직전 라운드(`23_58_23`) concurrency·
requirement·side_effect 3인이 독립 재현한 CRITICAL(`start()`의 지연 seed 가 재전송 복원이 SSE 로
전진시킨 화면을 되감고 두 번째 EventSource 를 여는 결함)을 정확히 그 라운드가 제안한 형태(부팅
시도로 취급하지 않는 읽기전용 `bootGenRef` 스냅샷)로 고쳤다. 격리 detached worktree 에서 baseline
(391 passed)을 확인한 뒤, fix 의 핵심 변경(`{ boot: bootAtStart }` 인자)을 mutation 으로 제거하자
**정확히 신설 회귀 테스트 1건만** 실패했고, 실패 증상도 커밋이 주장한 그대로(화면 n1 되감김 +
`EventSource` 2개 생성)임을 단언 순서를 바꿔가며 독립적으로 재확인했다. 요청받은 "반대 구멍" 세
가지도 직접 검증했다: (a) 정상(재전송 없음) 경로는 391건 그린에 포함돼 훼손되지 않았고, (b) 종료
확정은 여전히 world 축만 보는 공유 코드 경로라 대체된 `start()` 시도도 종료를 놓치지 않으며, (c)
무효(`!apiBase`) 재전송은 세대를 소모하지 않아 무해하고 BLOCKED 재전송은 오히려 stale seed 의
차단-화면 되살림을 부수적으로 막는(해로운 부작용이 아닌) 방향으로 작동함을 신규 throwaway 테스트로
직접 확인했다. `seedWaitingFromStatus`의 호출부 3곳(`start`·`applyConfig`복원·`replay_unavailable`)
간 모든 쌍은 순서·상태 불변식(`startedRef`/`sessionEstablished`/스트림 존재 여부)으로 구조적으로
상호배타임을 확인했고, 방치된 4번째 경로는 없다. 유일한 잔여 제안은 필수가 아닌 defense-in-depth
성격의 회귀 테스트 2건 추가(종료-확정-무시-boot-축의 `start()` 전용 짝 테스트, BLOCKED-vs-지연-seed
조합)이며, 둘 다 이번에 코드 추적·임시 실측으로 현재 동작이 옳음을 이미 확인했으므로 병합을 막을
사유는 아니다.

## 위험도

NONE — 검증 대상 CRITICAL 은 fix 로 닫혔고 실측으로 확인했다. 새로 발견된 CRITICAL/WARNING(차단
사유)은 없다(위 WARNING 1건은 낮은 우선순위 테스트 커버리지 제안일 뿐 현재 동작 결함이 아니다).

---
STATUS=success concurrency PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/00_51_53/concurrency.md
