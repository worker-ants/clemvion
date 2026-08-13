# RESOLUTION — `23_46_00` (+ consistency `23_46_01`)

**CRITICAL 0.** ai-review WARNING 6 / consistency WARNING 5 — 조치 4건, 나머지는 이미 해소됐거나
plan 에 등재된 관측·위임 항목이다. **forced 7명 전원 결과 확보**(직전 라운드의 `testing` 실패 해소).

## 조치

### ai-review W3 — 내 테스트가 이 PR 의 교훈을 재도입했다

`resolves.not.toBe('admitted')` 였다. 그러면 *"0행인데 `cancelled` 를 돌려주는"* 회귀도
통과한다. **느슨한 단언이 버그를 4개월 숨긴 게 이 PR 의 요지인데, 그걸 고치며 만든 테스트가
같은 형태였다.** `resolves.toBe('deferred')` 로 조였다.

### ai-review W4 — `detail` 이 메시지에 실리는지 안 봤다

`detail` 을 **필수로 승격까지 해 놓고**(직전 라운드 W4), 정작 그 값이 에러 메시지에 실리는지는
검증하지 않았다. 자매 헬퍼 `assertRowArray` 의 같은 테스트는 이미 하고 있었다.

정규식을 `/배열이 아님.*computeChainDepth 재귀 CTE/s` 로 강화하고 **강화가 실질인지 확인** —
헬퍼에서 `— ${detail}` 을 빼는 뮤턴트로 **3건 사살**. 형식적 강화가 아니다.

### ai-review W1·W2 / consistency W4 — plan 자기모순

`spec_impact` 를 리스트로 바꿔 놓고 본문 `[planner 위임]` 블록에 *"frontmatter 는 `none` 을
유지한다"* 를 남겼다. 그리고 위임 대상을 5개로 늘리며 도입부의 "넷이다" 를 안 고쳤다.
둘 다 정정(리뷰 시점엔 미커밋 상태였다).

### consistency W5 — caveat 의 blast radius 를 행 단위로 뭉갰다

**가장 값어치 있는 지적이다.** `node-cancellation.md` §2.4 표에 caveat 을 **행 라벨 단위**로
걸라고 적어 뒀는데, 그러면 영향권 밖 메커니즘까지 "검증 안 됨" 으로 뭉뚱그려져 **반대 방향
drift** 를 만든다. 소비 경로 단위로 재서술했다:

| | 대상 |
|---|---|
| **영향 있음** (`persisted` 소비) | `finalizeFailedExecution` · `failFirstSegmentSetup` · `executeSync` timeout · retry 재진입 종결 |
| **영향 없음** (반환값 미사용) | `assertExecutionNotCancelled`(DB 재조회) · `linkedNodeExec` `FOR UPDATE`(SELECT) |

`node-cancellation.md` frontmatter `pending_plans:` 등재 지시도 함께 넣었다
(`spec-pending-plan-existence.test.ts` 가 추적하도록).

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| ai W5·W6 / cons W2 | **배포 후 관측** — 사문화됐던 이벤트·메트릭·CAS 락 409 가 처음 발동한다. 조치가 아니라 관측이고 plan §후속에 5항목으로 등재돼 있다 |
| ai W6 / cons W5 | `persisted=false` 를 **실제 동시 트랜잭션으로** 관측하는 것은 `complete/` 이동 전 조건으로 두 plan 에 등재됨. 단위 커버리지는 온전하다(직전 라운드에서 3건 실측 확인) |
| cons W1 | worktree 슬러그와 작업 주제 불일치 — 값은 참이라 "고치면" 거짓이 된다. 이미 메모로 기록 |
| cons W3 | 규약 승격 — `spec/` 권한 밖. planner 위임 목록에 등재됨 |

## 검증

- W4 강화가 판별하는지 **뮤테이션으로 확인 (3건 사살)**
- 104 스위트 **2052 passed** · `lint --max-warnings 0` 통과 · ratchet **199/38 일치**

## 수렴 판정

| 라운드 | CRITICAL | 성격 |
|---|---|---|
| `20_36_35` | 2 | **실제 버그** — 소셜 로그인 상시 실패, 모순 주석 |
| `22_45_24` | 1 | 내 커버리지 주장이 거짓 |
| `23_07_11` | 1(이미 해소) | stale 제네릭·테스트 3곳 공백 |
| `23_27_48` | 0 | 문서 정확성 + `testing` 실행 실패 |
| `23_46_00` | **0** | 테스트 단언 강도 + plan 자기모순 |

프로덕션 결함은 1라운드에서 끝났고, 이후는 **내 서술의 정확성과 커버리지 강도**였다.
이번 라운드는 CRITICAL 0 이고 forced 전원이 돌았으며, 남은 것은 배포 관측과 planner 위임뿐이다.
