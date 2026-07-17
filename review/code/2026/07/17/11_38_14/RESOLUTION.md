# RESOLUTION — ai-review 11_38_14 (직전 라운드 `09_36_01` 조치 커밋 재검토)

대상 범위: `50aa872cd..HEAD`. RISK MEDIUM / Critical 0 / Warning 1 / INFO 2. 3인 reviewer.

**요약**: 직전 라운드의 fix(`pendingResetRef` + `newChat()` 재생, `isStale` 추출)는 3인이 각자 검증해 **동작이 올바름을 확인**했다. 그러나 그 fix 자신이 남긴 잔여 결함 1건을 2인이 독립 발견하고 1인이 실측 재현했다 — 조치 완료.

**왜 이 라운드가 필요했나**: push 가드가 "8개 codebase 파일이 최근 리뷰 이후 변경됨"으로 막았다. 가드 코드를 읽어보니 **오진이 아니었다** — 세션 디렉토리명(`09_36_01`)을 리뷰 시각으로 쓰는데 fix 커밋은 그 뒤(10:13·10:37)에 작성됐고, 무엇보다 **`pendingResetRef` + `newChat()` 재생은 리뷰된 적 없는 새 프로덕션 동작**이었다. `BYPASS_REVIEW_GUARD` 를 쓰지 않고 정면으로 리뷰했고, 그 결과 실제 결함이 나왔다 — 가드가 옳았다.

## Warning

### W1 — `pendingResetRef` 가 부팅 시도에 스코프되지 않아 "유령 리셋" (**2인 독립 발견**, testing 실측 재현). **확인·수정**

내가 직전 라운드에 도입한 플래그가 **한 부팅 사이클 안에서만 산다**고 암묵 가정했으나 틀렸다. 플래그는 `applyConfig` 의 `configRef.current = cfg` **직후**에서만 소비되는데 그 **앞**에 `!allowed → BLOCKED → return` 이 있고, 그 경로는 플래그를 건드리지 않는다. 그리고 `applyConfig` 는 마운트당 1회가 아니다 — host 는 iframe 재생성 없이 `wc:boot` 를 재전송할 수 있고(`spec/7-channel-web-chat/2-sdk.md:106` 명문화), 관리자 미리보기(`live-preview.tsx`)가 draft 변경 시 실제로 그렇게 한다. `blocked` 는 렌더만 null 로 만들 뿐 훅을 언마운트하지 않아 ref 가 그대로 산다.

- **내 초회 재현은 실패했다 — 테스트가 틀렸다**: BLOCKED 를 만들려 `allowlist`/`enforce` 를 세팅했으나 `document.referrer` 를 안 세워 `detectHostOrigin` 이 null → 임베드 검증이 **fail-open**(4-security §3-① soft 컨트롤 설계) → boot#1 이 `blocked` 가 아니라 `streaming` 이 됐다(추적: `[1] boot#1 후 phase=streaming config=확립`). 즉 시나리오 자체가 구성되지 않았다. 리뷰어 2인이 일치했고 1인이 구체적 수치를 냈으므로 **내 음성 결과를 신뢰하지 않고** 구성을 고쳤다.
- **재현(수정 후)**: `phase=streaming exec=NEW2 hookPosts=1 LEGIT보존=false` — testing 리뷰어 결과와 정확히 일치. 리셋을 요청한 적 없는 2차 host 의 정상 세션이 조용히 폐기되고 새 대화가 강제 시작됐다.
- **수정**: `applyConfig` **진입 시**(첫 await 이전) `pendingResetRef.current = false`. 스코프가 자명해진다 — **이 시도의 await 구간에 도착한 요청만 유효**하고, 중단된 이전 시도의 의도는 그 시도와 함께 죽는다.
  - 리뷰어 제안 (a)"BLOCKED 직전 폐기" 보다 이쪽을 택했다: (a)는 **조기 return 마다 폐기를 추가**해야 해서 새 조기 return 이 생기면 같은 버그가 재발한다(이 파일이 4라운드 연속 겪은 "규율 의존" 패턴 그대로). 진입점 1곳에서 지우면 **출구가 몇 개든 무관**하다.
  - 제안 (b)"`worldGenRef` 스냅샷과 묶기" 도 검토했으나 과하다 — 부팅 중엔 `teardownSession` 이 세대를 올리지 않아(그게 C1 fix 다) 세대가 이 구간을 구분하지 못한다.
- **회귀 테스트**: "차단된 부팅 중의 resetSession 은 이후 무관한 부팅으로 새어나가지 않는다" — 1차 boot BLOCKED(전제를 `expect(phase).toBe("blocked")` 로 고정: 여기 못 오면 테스트가 무의미해지는 걸 내가 실제로 겪었다) → 정상 세션 존재 → 2차 boot 정상 → **세션 보존 + `hookPosts === 0`**(강제 새 대화 없음). `document.referrer` 를 세우는 이유도 주석에 남겼다.
- **mutation 검증**: 진입 시 폐기를 제거 → 41건 중 **이 테스트만** 실패. 복원 → 41/41.

## INFO

- **INFO#1 (중복 `NEW_CHAT` dispatch)** — 리듀서가 `...initialState` 무조건·멱등 대입이라 상태 오염 없음(여분 렌더 수준). 조치 없음.
- **INFO#2 (C1-b 3단 단언의 유효성)** — testing 이 "절반-mutation"(저장소만 지우고 재생 생략)으로 3번째 단언만 독립적으로 죽는 걸 실증. 설계가 정당했음이 확인됐다. 조치 없음.

## 검증

- **TEST WORKFLOW**: lint PASS(58s) · unit PASS(73s, `tests=14 passed`) · build PASS(122s).
- **channel-web-chat**: 23 파일 **373 passed**(vitest 실측).
- 신규 회귀 테스트 1건 mutation 검증 완료.
- **워크트리 위생**: 3인 전원이 지침대로 격리 worktree(`git worktree add --detach`)에서 mutation 을 수행하고 제거했다. 직전 라운드의 측정 오염이 **재발하지 않았다** — 이 지침을 앞으로도 유지한다(`09_36_01` RESOLUTION §C1).

## 이월

`09_36_01/RESOLUTION.md` §이월 을 승계한다(RESTORED/BOOTED 가드 확대 · `guardedAwait` 구조화 · W2 가드 개별 고정 · `useTokenRefresh` 종단 테스트 · 리뷰 파이프라인 정책). 본 라운드가 추가하는 이월은 없다.

**교훈 (이 라운드)**: **플래그를 도입할 때 그 수명(scope)을 명시하지 않으면 반드시 샌다.** `pendingResetRef` 는 "부팅 중 리셋"이라는 좁은 의도로 만들었지만 수명은 컴포넌트 전체였고, 그 간극이 정확히 결함이 됐다. 그리고 **내 재현이 음성이라고 리뷰어 지적을 기각하면 안 된다** — 이번엔 내 테스트 구성이 틀렸고(fail-open 미인지) 리뷰어가 옳았다.
