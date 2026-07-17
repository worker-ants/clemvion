# Testing Review — 2026-07-17 11_38_14

검증 방법론: `.claude/tools/ensure-worktree.sh` 가 아닌 `git worktree add --detach <tmp> HEAD` 로 만든 격리
worktree 2개(순차 사용·즉시 제거)에서 mutation 실행. `codebase/channel-web-chat` 은 workspace 패키지
의존이 없는 self-contained 앱이라(`grep workspace: package.json` 무매치) node_modules 심링크 공유가
안전함을 먼저 확인했다. 모든 mutation 은 원본 파일을 `.orig` 로 백업 후 적용→실행→즉시 원복. 베이스라인
(무mutation) 은 격리 환경에서 **22 파일 372 passed** 로 RESOLUTION.md 실측치와 일치. 작업 종료 후
격리 worktree 는 `git worktree remove --force` 로 제거, 공유 worktree(`funny-mahavira-50d003`)는
`git status`로 무오염 확인.

## 발견사항

- **[WARNING]** `pendingResetRef` 가 소비되지 않고 영구 고착되는 경로(BLOCKED 조기 return) — 테스트 0건,
  실제 재현되는 "유령 리셋" 결함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:231-234`(플래그 set) ·
    `use-widget.ts:726-730`(BLOCKED 조기 return, 소비 이전) · `use-widget.ts:741-745`(소비 블록) ·
    테스트 갭은 `use-widget-eager-start.test.ts` 전체(BLOCKED/`pendingResetRef`/`origin_not_allowed`
    관련 매치 0건 — grep 확인).
  - 상세: `teardownSession()` 은 `configRef.current` 가 null 이면(부팅 중) 무조건
    `pendingResetRef.current = true` 를 세팅하고 return 한다. 이 플래그는 오직 `applyConfig` 의
    `configRef.current = cfg;` 대입 **직후**(741행)에서만 소비된다. 그런데 `applyConfig` 는 그 대입
    **이전**에 `if (!allowed) { dispatch({ type: "BLOCKED", ... }); return; }` (727-730행) 분기가
    있고, 이 분기는 `pendingResetRef` 를 전혀 건드리지 않는다. 즉 **origin 이 차단된 boot 시도 중에
    도착한 resetSession 요청은 플래그를 세우지만, 그 boot 사이클은 절대 그 플래그를 소비하지 못한다.**
    문제는 이 컴포넌트 인스턴스 동안 `applyConfig` 가 **한 번만** 불린다는 암묵 전제다 — 그러나
    `host-bridge.ts:51-57` 의 `wc:boot` 핸들러는 pin 된 origin 이 일치하기만 하면 몇 번이든
    `bootCb`(=`applyConfig`)를 재호출한다. 이것이 이론적 억측이 아니라는 근거는 이 코드베이스
    자신의 기존 테스트다 — `widget-app.test.tsx:122-130` "동일 인스턴스에 다른 locale 로 wc:boot
    재전송 → UI 언어 불변(§4 boot 1회 고정, 변경은 재마운트로만)" 이 정확히 "같은 인스턴스에 두 번째
    `wc:boot` 가 온다"는 시나리오를 정규 지원 케이스로 다루고 있다.
    격리 worktree 에서 임시 재현 테스트(비커밋, 검증 후 `git checkout --` 로 폐기)로 실측했다: (1)
    1차 `wc:boot` 가 allowlist 불일치로 BLOCKED, (2) 그 창에서 host 가 `resetSession` 전송 →
    `pendingResetRef.current = true`, (3) 완전히 무관한 정상 세션(`LEGIT`)이 storage 에 존재, (4)
    2차 `wc:boot` 가 이번엔 허용돼 정상 진행 — 결과: `phase=streaming, executionId=NEW2,
    hookPosts=1`, storage 의 `LEGIT` 세션이 `NEW2` 로 덮였다. **2차 boot 의 host 는 리셋을
    요청한 적이 없는데도, 1차(무관·차단된) boot 에서 걸린 리셋 의도가 소급 재생돼 정상 세션을
    지우고 새 대화를 강제 시작시켰다.** C1-b 가 막은 것과 같은 클래스(조용한 세션 유실/유령
    리셋)의 결함이 다른 진입 경로로 남아 있다.
  - 제안: (a) 테스트 우선 — BLOCKED 분기 진입 시 `pendingResetRef.current` 상태를 특정하는 회귀
    테스트 추가(예: 위 재현 절차를 정식 테스트화). (b) 코드 방향성 제안(테스트 리뷰 범위 밖이라
    참고용) — BLOCKED dispatch 직전에 `pendingResetRef.current = false` 로 명시 폐기하거나,
    `pendingResetRef` 를 단순 boolean 이 아니라 `worldGenRef` 스냅샷과 묶어 "이 세대에서 세운
    의도만 유효" 로 스코프를 좁히는 방안 검토. 현재 JSDoc(162-169행)은 "그때는 cfg 가 없어서" 라는
    단일 boot 사이클 전제로만 서술돼 있어, 다중 `wc:boot` 케이스는 설계상 고려되지 않은 것으로 보인다.

- **[INFO]** 확인 요청 1 — 신규 회귀 테스트("저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가
  부활하지 않는다")의 검출력 독립 검증 결과: **주장대로 작동함, 3단 단언 모두 개별적으로 유효함**
  - 위치: `use-widget-eager-start.test.ts:2016-2083`, 대응 구현 `use-widget.ts:231-234, 741-745`.
  - 상세: 3가지 mutation 으로 확인.
    1. `pendingResetRef.current = true;` 대입 제거(플래그 자체를 안 세움) → 40건 중 **신규 테스트
       1건만 실패**, 실패 지점은 어서션 (2) `executionId).not.toBe("OLD")`(`OLD` 로 정확히 일치해
       실패 — 옛 세션이 그대로 복원됨을 확인).
    2. 소비 블록(741-745행) 전체 제거(플래그는 서지만 아무도 안 읽음) → 동일하게 **1건만 실패**,
       동일 지점.
    3. "절반만 고친" 변종 — `apiRef.current.newChat()` 재생 대신 `clearSession(cfg.triggerEndpointPath)`
       만 호출(RESOLUTION.md 가 스스로 언급한 "리뷰어 제안(clearSession 만)"과 동일) → 어서션
       (1)(config 확립)·(2)(OLD 미포함)는 **통과**, 어서션 (3) `hookPosts).toBe(1)` 만 **실패**
       (`0` 그대로 — 새 대화가 시작되지 않아 패널만 열린 빈 화면). 이는 세 번째 단언이 앞의
       두 단언과 겹치지 않는 별도의 실패 모드를 잡아낸다는 뜻으로, "3단 단언" 설계가 군더더기가
       아니라 각자 몫을 하고 있음을 뒷받침한다.
    베이스라인(무mutation)은 매 회 40/40 통과로 원복 확인. 세 mutation 모두 다른 39건에는 어떤
    영향도 주지 않아(collateral failure 0건) 테스트 격리도 양호함을 같이 확인했다.
  - 제안: 없음(주장 확인됨). 참고로 RESOLUTION.md §W1 이 기술한 두 mutation("newChat() 재생만 제거"
    / "소비 전체 제거")과 내가 독립 설계한 세 번째(부분 수정) mutation 이 서로 다른 실패 지점을
    가리켜 상호보완적으로 3단 단언의 필요성을 입증한다.

- **[INFO]** 확인 요청 2 — `isStale` 추출 후 기존 가드 테스트 검출력 보존 여부 독립 검증 결과:
  **주장대로 정확히 7건 실패, 보존 확인**
  - 위치: `use-widget.ts:196`(`isStale` 정의) 및 7개 호출 지점(`use-widget.ts:384, 416, 473, 491,
    499, 517, 726, 766` 등), 영향받은 테스트는 전부 `use-widget-eager-start.test.ts`.
  - 상세: `const isStale = useCallback((_gen: number) => false, [])` 로 대체(모든 staleness 가드를
    무조건 "안 stale" 로 만드는 최강 mutation)해 전체 채널 스위트(22 파일)를 실행한 결과 **정확히
    7건 실패, 365 passed** — RESOLUTION.md §W5 의 "7건 실패, 원복 40/40"과 정합(§ 카운트 기준인
    `use-widget-eager-start.test.ts` 파일 내부 통과수 기준으로도 40/40 원복 확인). 실패 7건은 모두
    `use-widget-eager-start.test.ts` 안에 있고 stale-catch(W2)·언마운트 회귀(W3)·복원 in-flight
    재대화·booting 중 옛 webhook reject 등 서로 다른 가드 지점에 고르게 걸쳐 있어, 단일 헬퍼로의
    통합이 검출력을 어느 한쪽으로 쏠리게 하거나 죽이지 않았음을 확인했다. 신규 C1-b 테스트는 이
    mutation 으로는 실패하지 않는데, 이는 결함이 아니라 설계상 정상이다 — C1-b 는 `isStale` 이 아니라
    `pendingResetRef`(별도 축)로 지켜지고, 해당 boot 사이클 동안 `worldGenRef` 자체가 증가하지
    않으므로 `isStale` 을 항상 false 로 바꿔도 원래도 false 였을 값과 같다(두 가드 메커니즘이 서로
    잠식하지 않는 직교 축임을 방증).
  - 제안: 없음(주장 확인됨). 부가로, 자매 훅 `use-token-refresh.ts:92` 의
    `if (worldGenRef.current !== gen) return;` 은 `isStale` 을 쓰지 않고 동일 패턴을 손으로 유지한
    채 남아 있다(위젯 훅 경계를 넘어 `isStale` 콜백 자체를 주입하지 않고 `worldGenRef` ref 만
    주입하는 구조라 자연스러운 결과). 이 지점도 독립적으로 `worldGenRef.current !== gen` 라인만
    제거해 봤더니 해당 훅의 W5 회귀 테스트(`use-token-refresh.test.ts` "refresh in-flight 중 세대
    변경...") **1/11 만 실패**로 정상 검출됨을 확인했고, `Promise.resolve()` → `vi.advanceTimersByTimeAsync(0)`
    치환도 이 검출력에 영향 없음을 같이 확인했다. `isStale` grep 한 방으로 전 지점을 센다는 JSDoc
    의도(194행)가 이 자매 훅까지는 미치지 않는다는 점만 참고로 기록(이번 diff 의 touched files 는
    아니라 이번 라운드의 결함은 아님).

- **[INFO]** 테스트명 리팩터(라운드 접두어 `W4:`/`C1:`/`W2:`/`W3:` 제거, 서술형 전환) 및
  `widget-state.test.ts` 의 재개 경로 `it.each` 파라미터화 — 가독성·유지보수성 개선, 회귀 없음 확인
  - 위치: `widget-state.test.ts:112-143`, `use-token-refresh.test.ts:104-121`,
    `use-widget-eager-start.test.ts` 전역(라벨명 변경 지점들).
  - 상세: 이전 라운드 W4(09_36_01)가 지적한 "테스트 라벨이 spec 불변식 ID(`C1`)와 충돌" 문제를
    깔끔히 해소했다. `it.each(["START", "NEW_CHAT"])` 파라미터화는 두 재개 경로를 한 테스트
    구조로 묶으면서도 개별 판별력을 잃지 않았음을 추가로 확인했다 — 가드를 의도적으로 과잉
    확대(`state.phase === "ended" || state.phase === "panel"`)하는 mutation 을 걸어보니 `NEW_CHAT`
    케이스만 40건 중 1건 실패하고 `START` 케이스는 영향받지 않아, 두 파라미터가 서로 다른 실패
    모드를 각자 담당함을 확인했다(RESOLUTION.md §W2 "가드를 과잉으로 바꾸면 NEW_CHAT 재개 케이스만
    실패" 서술과 일치).
  - 제안: 없음.

## 요약

이번 델타는 지난 두 라운드(`08_29_33`, `09_36_01`)의 지적을 반영한 후속 조치 + 테스트 라벨링 정리이며,
전체적으로 테스트 품질이 높다. 요청받은 두 가지 핵심 검증 — 신규 C1-b 회귀 테스트의 3단 단언이 각각
실제로 다른 실패 모드를 잡는지, `isStale` 추출이 기존 7개 가드 테스트의 검출력을 보존했는지 — 모두
독립 mutation 으로 **주장 그대로 재현**했고, RESOLUTION.md 가 제시한 수치(372 passed, 7건 실패,
1건만 실패 등)는 전부 실측과 정확히 일치해 이 라운드의 검증 신뢰도는 높다고 판단한다. 다만 세 번째
확인 요청(`pendingResetRef` 미소비 경로의 테스트 존재 여부)에 대한 답은 "테스트가 없을 뿐 아니라
실제로 재현되는 결함이 존재한다"였다 — BLOCKED 조기 return 은 `pendingResetRef` 를 소비하지 않고
영구 고착시키며, 이 코드베이스가 이미 정규 지원 시나리오로 테스트하는 "동일 인스턴스 `wc:boot`
재전송" 과 결합하면 무관한 후속 boot 이 정상 세션을 조용히 지우고 새 대화를 강제 시작한다(격리
환경에서 실측 재현). C1-b 가 막은 것과 정확히 같은 유형(유령 리셋/조용한 세션 유실)의 결함이 다른
진입 경로로 남아 있으므로, 이번 라운드에서 회귀 테스트 없이 넘어가는 것은 권장하지 않는다.

## 위험도

MEDIUM
