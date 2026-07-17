# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (03_04_45, `94b66b212` 테스트 커버리지 갭 fix 검증)

> 지시받은 핵심 검증 대상: 직전(02_25_54) requirement 라운드가 재현한 "openStream 게이트 2곳 중
> `start()` 쪽(`:673`)이 기존 스위트 어떤 테스트로도 개별 검출되지 않는다"는 커버리지 갭을 커밋
> `94b66b212` 가 resolve 순서를 파라미터로 받는 공용 헬퍼로 두 방향 대칭 테스트를 추가해 고쳤다고
> 주장한다. 이번 라운드는 (1) 그 fix 가 갭을 실제로 닫는지(mutation: 각 게이트 개별 제거 시 자기
> 테스트만 실패), (2) 원래 3개 결함(00_51_53 고착 1건·23_58_23/18_39_11 되감기 2건) + 이중
> EventSource 방어가 여전히 유지되는지, (3) 대칭 테스트가 spec 동작을 정확히 반영하는지를 `git show
> 94b66b212` 직접 확인 + 격리 워크트리 실측 mutation 으로 검증했다.

## 검증 방법 — 격리 detached worktree, 3건의 독립 mutation

payload(`_prompts/requirement.md`, 2613줄)는 이전 두 라운드와 동일한 구조적 한계(진행 중 review 산출물
모음만 담고 이번 라운드가 실제로 검증해야 할 코드/테스트 diff 자체는 포함 안 됨)를 그대로 보였다 —
`git show 94b66b212` 로 대상 커밋을 직접 확정해 payload 대신 실제 커밋을 분석 대상으로 삼았다(호출자
지시와 일치, 두 라운드 연속 재현된 기지 패턴).

1. `git log --oneline -20` 으로 커밋 그래프 확정: `cffee0d28`(00_51_53, boot축→`sessionEstablished`)
   → `77805bd32`(01_44_21, openStream 직전 짝 게이트 2곳 최초 추가) → `94b66b212`(02_25_54 WARNING
   fix — 본 라운드 대상) → `fb78bfe60`/`61e07f3ec`(비-코드 정합, 현재 HEAD).
2. `git show 94b66b212` 전체 diff(2파일, +34/-16) 를 직접 읽고 `use-widget.ts` 의 `start()`(622-685)·
   `applyConfig` 복원분기(964-1021)·`seedWaitingFromStatus`(537-599) 전문을 trace-through 했다.
3. 원본(공유) worktree 에서 `tsc --noEmit` 재확인 — **exit 0**.
4. **격리 detached worktree**(`git worktree add --detach`, HEAD `61e07f3ec` pinned, scratchpad 하위)
   부트스트랩: root `node_modules` 심링크 + `codebase/channel-web-chat/node_modules` 실카피(memory
   관례). baseline `vitest run` → **394 passed**(22파일, 커밋 메시지 수치와 일치).
5. 이 격리 worktree 에서 **3건의 독립 mutation**을 개별 적용(각각 md5 대조로 원복 확인 후 다음
   mutation 진행) — Mutation A(`start()` 게이트만 제거)·Mutation B(`applyConfig` 게이트만 제거)·
   Mutation C(seed 내부 게이트 제거, 원래 3결함 축 재확인용). 작업 후 `git worktree remove --force`
   로 완전 제거, 공유 worktree `git status --porcelain`/`git diff --stat -- codebase/` 무출력으로
   무변경 확인.

## 발견사항

- **[INFO] (핵심 확인 1) 커버리지 갭이 실제로 닫혔다 — 두 게이트가 각각 정확히 자기 테스트로만
  고정됨(과소·과다 킬 없음), 독립 mutation 으로 재확인**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:673`(`start()` 게이트)·`:1018`
    (`applyConfig` 게이트), `use-widget-eager-start.test.ts:3412-3489`(`raceStartVsResendSingleStream`
    헬퍼 + 대칭 테스트 2건).
  - 상세: **Mutation A**(`:673` 만 `if (false && sessionEstablished()) return;` 로 무력화, `:1018` 은
    원본 유지) → 전체 스위트 394건 중 **정확히 1건만 실패**: `두 복원 seed 가 같은 flush 에서 resolve
    — 재전송 먼저 열려도 하나만 생성된다 (start() 게이트)`(`expected 2 to be 1`). 나머지 393건(기존
    "start 먼저 — applyConfig 게이트" 테스트 포함) 전원 그린. **Mutation B**(`:1018` 만 무력화, `:673`
    원본 유지) → 정확히 반대로 **`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만
    생성된다 (start 먼저 — applyConfig 게이트)` 1건만 실패**, companion 은 그린. 두 mutation 모두
    `tsc --noEmit` 클린 상태에서 실행됐고 원복 후 md5 가 mutation 전과 완전히 일치함을 확인했다. 이는
    커밋 메시지·SUMMARY.md·RESOLUTION.md 가 주장한 "mutation 개별 검증: start 게이트만 제거 →
    companion 만 실패 / applyConfig 게이트만 제거 → 기존만 실패"를 **본 리뷰가 별도로 작성한
    mutation(호출자 주장을 그대로 재현한 게 아니라 원본 파일을 직접 패치해 독립 실행)으로 재확인**한
    것이다 — 직전(02_25_54) 라운드가 지적한 "start() 쪽 게이트는 어떤 테스트로도 개별 검출되지 않는다"
    갭이 이번 커밋으로 **완전히 닫혔다**.
  - 제안: 없음 — 지시받은 핵심 검증 대상은 신뢰 가능.

- **[INFO] 대칭 테스트의 resolve-순서 파라미터가 실제로 서로 다른 게이트를 겨냥한다 — 테스트명·
  JSDoc·메커니즘이 일치(의도-구현 괴리 없음)**
  - 위치: `use-widget-eager-start.test.ts:3404-3411`(신규 JSDoc "두 방향을 모두 고정한다")·`:3470`
    (`const [first, second] = resendResolvesFirst ? [1, 0] : [0, 1];`)·`:3479-3489`(두 `it` 블록).
  - 상세: `resendResolvesFirst=false`(첫 테스트, "start 먼저") → `[first, second]=[0,1]` → C(=`start()`
    자신의 getStatus, `statusResolvers[0]`)가 먼저 resolve → `start()` 가 스트림을 열고
    `applyConfig`(재전송 D)의 `:1018` 게이트가 이를 막는다. `resendResolvesFirst=true`(둘째 테스트,
    "재전송 먼저") → `[first, second]=[1,0]` → D 가 먼저 resolve → `applyConfig` 가 스트림을 열고
    `start()`(C)의 `:673` 게이트가 이를 막는다. 이 매핑은 JSDoc 서술과 정확히 일치하고, 위 Mutation
    A/B 결과(각 테스트가 정확히 자기 이름이 가리키는 게이트에만 반응)로 **코드 레벨로 독립
    재확인**했다 — 테스트 이름이 주장하는 메커니즘과 실제로 검증하는 메커니즘 사이에 괴리 없음.
  - 제안: 없음.

- **[INFO] (핵심 확인 2) 원래 3개 결함(00_51_53 고착 1건·23_58_23/18_39_11 되감기 2건) + 이중
  EventSource 방어 — 전부 여전히 유지, `94b66b212` 는 이 축을 건드리지 않았다**
  - 위치: `seedWaitingFromStatus:568`(`if (!opts?.allowWhileStreaming && sessionEstablished()) return
    "stale";` — 이번 diff 밖, `cffee0d28` 부터 무변경), 되감기 회귀
    `use-widget-eager-start.test.ts:3051`(대체된 시도)·`:3223`(start() 지연 seed), 고착 회귀 `:3316`
    (webhook in-flight no-op 재전송).
  - 상세: `git show 94b66b212` 의 diff hunk 는 테스트 파일 한 곳(대칭화 리팩토링)과 `use-widget.ts`
    의 `start` useCallback **의존성 배열 1줄**뿐이다 — `seedWaitingFromStatus` 내부 게이트(:568,
    되감기 2건과 고착 회피를 함께 규율하는 핵심 조건문)는 이번 diff 범위에 전혀 없다. 이를 직접
    재확인하기 위해 **Mutation C**(:568 을 `if (false) return "stale";` 로 무력화)를 별도 실행한 결과,
    전체 394건 중 **정확히 예상된 2건만 실패**(`대체된 시도의 지연 getStatus 가 살아있는 화면을 옛
    노드로 되감지 않는다`, `start() 의 지연 seed 가 재전송이 전진시킨 화면을 되감거나 두번째 스트림을
    열지 않는다` — 둘 다 `expected 'n2' to be 'n1'`형 되감기 실패), 나머지 392건(고착 회귀 포함) 전원
    그린. 이는 01_44_21 testing.md 가 이미 확립한 "Mutation A → 정확히 되감기 2건" 결과와 동일 — 두
    라운드 뒤에도 이 축이 그대로 보존됨을 재확인한 것이다. Baseline(mutation 없음) 394 passed 자체가
    고착·되감기 2건·기존 이중 EventSource 회귀(3388행대)를 모두 포함하는 그린 스위트이므로, `94b66b212`
    이후에도 이 4개 방어선이 실측으로 살아있다.
  - 제안: 없음.

- **[INFO] side_effect WARNING(누락 dep) fix 확인 — eslint 경고 실제로 해소됨**
  - 위치: `use-widget.ts:685`(`}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh,
    isStale, sessionEstablished]);`).
  - 상세: 격리 worktree 에서 `npx eslint src/widget/use-widget.ts
    src/widget/use-widget-eager-start.test.ts` 재실행 결과 `react-hooks/exhaustive-deps` 경고 없음
    (exit 0, 남은 유일한 경고는 `use-widget-eager-start.test.ts:657` 의 `fetchMock` 미사용 변수 —
    이번 diff hunk 범위(3396행 이후) 밖의 pre-existing 무관 항목). 02_25_54 requirement.md 가 지적한
    "`sessionEstablished` 가 `start` deps 배열에 누락"이 정확히 이 1줄로 해소됐다.
  - 제안: 없음.

- **[INFO] 리팩토링(헬퍼 추출)이 커버리지를 잃지 않았다 — 제거된 `latestEs` 는 원래도 미사용
  변수(dead code), 실질적 손실 없음**
  - 위치: `use-widget-eager-start.test.ts:3412-3423`(신규 헬퍼) vs `94b66b212^`(부모 커밋)의 동일
    구간.
  - 상세: `git show 94b66b212^:.../use-widget-eager-start.test.ts` 로 이전 버전을 직접 대조한 결과,
    구버전의 `let latestEs: ControllableEventSource | null = null;` 은 대입(`latestEs = new
    ControllableEventSource()`)만 되고 테스트 본문 어디서도 읽히지 않았다(`.emit()` 호출 등 SSE 이벤트
    주입에 쓰인 적 없음) — 신규 헬퍼가 이를 제거한 것은 실질 단언·커버리지 손실이 아니라 순수 dead
    code 정리다. 나머지 mock 셋업(embed-config/webhook/status 응답, EventSource stub)은 로직 변경
    없이 그대로 헬퍼로 옮겨졌다.
  - 제안: 없음.

- **[INFO] spec 정합 — `94b66b212` 는 spec 이 규정하는 관찰 가능한 행동 계약에 변경이 없는
  테스트/품질 전용 커밋, spec 침묵 영역 재확인**
  - 위치: `spec/7-channel-web-chat/2-sdk.md §3(재전송)`("위젯은 마지막 wc:boot 의 config 를 적용"),
    `3-auth-session.md`, `1-widget-app.md §3.1`. `CHANGELOG.md` Unreleased 첫 항목(§3(재전송) SoT
    명시).
  - 상세: `git show 94b66b212 --stat` 기준 프로덕션 코드 변경은 `use-widget.ts` **1줄**(의존성 배열)
    뿐이고 나머지는 테스트 파일이다 — 실행 로직(분기·반환값·에러 처리)은 0줄 변경. `2-sdk.md §3(재전송)`
    ·`3-auth-session.md`·`1-widget-app.md` 를 grep(`EventSource`·`이중 스트림`·`단일 스트림`) 한
    결과는 이전 두 라운드(01_44_21·02_25_54)와 동일하게 매칭 0건(§R9 는 웹훅 POST 단일화이지 SSE
    스트림 개수와 무관) — spec 은 "재전송이 활성 대화를 방해하지 않는다"는 관찰 가능한 행동만 규정하고
    `sessionEstablished()` 게이트의 개수·테스트 커버리지 대칭성은 의도적으로 열어둔 구현 디테일이다.
    `CHANGELOG.md` 도 이 커밋에 대응하는 새 항목을 추가하지 않았는데, 이는 적절하다 — 사용자 가시
    동작이 전혀 바뀌지 않았기 때문이다(이미 기존 Unreleased 항목 3번이 되감기 방어 자체를 서술함).
    spec-drift 여부를 판단할 대상 자체가 없다(코드 로직 무변경).
  - 제안: 없음 — project-planner 위임 불요.

- **[INFO] (경미, 이번 커밋 범위 밖) `nodeId` 단언은 race 승자를 구분하지 못한다 — 사전 존재하던
  설계, `94b66b212` 가 도입/악화하지 않음**
  - 위치: `use-widget-eager-start.test.ts:3449-3452`(`waitingAt` — C·D 양쪽에 항상 동일 `"n1"` 사용),
    `:3481-3482`·`:3487-3488`(두 테스트 모두 `expect(nodeId).toBe("n1")`).
  - 상세: C 와 D 가 항상 같은 `"n1"` 컨텐츠로 resolve 되므로, `nodeId` 단언은 "누가 이겼는지"를
    구분하지 못하고 "최종 상태가 손상되지 않았다"만 확인한다(어느 쪽이 화면을 그리든 결과가 같기
    때문). 이 설계는 `94b66b212` 가 아니라 원조 테스트(`77805bd32`)부터 있던 것이며(구버전 diff 대조
    확인), 이번 커밋은 resolve 순서만 파라미터화했을 뿐 `waitingAt` 인자는 그대로 `"n1"` 이다. 실질
    검증 축은 `esCount===1` 단언이고, 이는 위 Mutation A/B 로 정밀하게 개별 게이트에 반응함을 이미
    확인했으므로 이 약점이 현재 리뷰의 결론에 영향을 주지 않는다.
  - 제안: 없음(즉각 조치 불필요) — 향후 이 파일을 다시 다룰 라운드에서 두 테스트가 서로 다른
    nodeId(예: D 는 "n1", C 지연 seed 는 별도 노드)로 구분하면 "어느 시도가 실제로 소유했는가"까지
    단언 가능해져 진단력이 높아진다는 정도의 개선 여지만 남긴다.

- **[INFO] TODO/FIXME/HACK/XXX 없음, 반환값·함수 계약 전 경로 보존 확인**
  - 위치: `git show 94b66b212` 전체 diff.
  - 상세: `git show 94b66b212 | grep '^+' | grep -iE "TODO|FIXME|HACK|XXX"` 무매칭. 유일한 프로덕션
    코드 변경(`start` useCallback 의존성 배열)은 함수의 반환 경로·타입·호출 시그니처를 전혀 바꾸지
    않는다(React `useCallback` 의 두 번째 인자는 재생성 트리거일 뿐 반환값 계약과 무관). 테스트 파일
    변경도 `it()` 블록 수만 1→2 로 늘렸을 뿐 기존 51개 테스트의 본문은 무변경(diff 로 직접 대조).
  - 제안: 없음.

## 요약

호출자가 지시한 핵심 검증 대상 — 직전(02_25_54) 라운드가 재현한 "openStream 게이트 2곳 중 `start()`
쪽이 기존 스위트 어떤 테스트로도 개별 검출되지 않는다"는 비대칭 커버리지 갭 — 은 커밋 `94b66b212` 로
**실제로 닫혔다**. 본 리뷰는 이를 호출자·커밋 메시지 주장을 그대로 신뢰하지 않고 격리 detached
worktree 에서 원본 파일을 직접 패치하는 **독립 mutation** 으로 재확인했다: `start()` 게이트(:673)만
무력화하면 정확히 신규 companion 테스트 1건만 실패하고(393건 그린), `applyConfig` 게이트(:1018)만
무력화하면 정확히 기존 테스트 1건만 실패한다(393건 그린) — 완전한 대칭 고정이며 과소·과다 킬이 없다.
두 테스트의 resolve-순서 파라미터(`[first, second]` 매핑)가 실제로 서로 다른 게이트를 겨냥한다는 점도
JSDoc 서술과 mutation 결과가 정확히 일치함을 코드 레벨로 확인했다. 원래의 3개 결함(00_51_53 고착 1건·
23_58_23/18_39_11 되감기 2건)과 이중 EventSource 방어 자체는 `94b66b212` 의 diff 범위(테스트 파일 +
`start` 의존성 배열 1줄) 밖에 있는 `seedWaitingFromStatus` 내부 게이트(:568)에 의해 규율되는데, 이
게이트를 별도로 무력화하는 Mutation C 를 실행한 결과 정확히 예상된 되감기 2건만 실패하고 고착 회귀를
포함한 나머지 392건은 무영향이었다 — 4연속 라운드에 걸쳐 확립된 방어선이 이번 커밋 이후에도 실측으로
살아있다. 부수적으로 지적됐던 side_effect WARNING(`start` useCallback 의 `sessionEstablished` 의존성
누락)도 eslint 재실행으로 해소를 확인했고, 헬퍼 추출 리팩토링은 사전 미사용 변수(`latestEs`)만 정리했을
뿐 실질 커버리지 손실이 없다. spec 관점에서는 이 커밋이 프로덕션 로직을 1줄(의존성 배열)만 바꾼 순수
테스트/품질 개선이라 `2-sdk.md §3(재전송)` 등이 규정하는 관찰 가능한 행동 계약에 영향이 없으며, 이전
두 라운드가 이미 확립한 "EventSource 개수는 spec 침묵 영역" 결론이 그대로 유지된다 — spec-drift 도,
spec 불일치도 해당 사항 없음. 유일하게 남긴 경미한 관찰(두 race 참가자가 항상 동일 `nodeId`로 resolve
돼 단언이 "승자 구분"까지는 못 한다)은 `94b66b212` 이전부터 있던 설계이고 실질 검증축(`esCount`)의
정밀도에는 영향이 없어 조치 불필요로 판단했다. 신규 CRITICAL·WARNING 없음 — 이 자리(18_39_11 →
23_58_23 → 00_51_53 → 01_44_21 → 02_25_54 → 03_04_45)의 결함 등급이 MEDIUM(테스트 갭)에서 완전
해소로 수렴했다.

## 위험도

NONE — 지시받은 검증 항목(커버리지 갭 폐쇄·원 결함 3건 유지·이중 EventSource 방어 유지·대칭 테스트의
spec 정합) 전부를 독립 mutation 실측으로 긍정 확인했다. CRITICAL·WARNING 신규 발견 없음. 유일한 관찰
(`nodeId` 단언의 판별력 한계)은 이번 커밋 범위 밖의 사전 존재 설계이며 실질 검증축에 영향이 없어
정보성 INFO 로만 기록했다.

STATUS=success requirement PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/03_04_45/requirement.md risk=NONE
