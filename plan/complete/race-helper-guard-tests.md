---
title: raceUnderHeldLock 의 순수 동기 분기 둘을 실제로 행사한다
status: complete
owner: developer
worktree: race-helper-guard-tests-3a7c9d
started: 2026-09-21
completed: 2026-09-21
spec_impact: none
---

# 「주석 대신 코드로 고정」한 방어가 자기 자신은 미검증이었다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`raceUnderHeldLock` 의 순수 동기 분기 둘이 어떤 테스트도 지나가지 않는다» 를 닫는다.
**직전 PR(#1377)에서 내가 등재한 항목**이고, 그 PR 이 «주석을 코드 검사로 승격» 하면서
그 검사 자체는 검증하지 않은 채 수렴했다.

대상 분기 둘:
- `fires.length < 2` 입력 가드
- 모듈 로드 시 `KNOWN_LOCK_TIMEOUTS_MS` 잠금 상한 검사

## A. 착수 전 실측 — 순진하게 쓰면 **안 도는 테스트**가 된다

| 확인할 것 | 실측 |
| --- | --- |
| unit jest | `jest.config.ts` 가 **`rootDir: 'src'`**, `testRegex: '.*\.spec\.ts$'` — `test/` 아래는 **애초에 탐색 범위 밖** |
| e2e jest | `test/jest-e2e.json` 이 `testRegex: '.e2e-spec.ts$'` — `.spec.ts` 는 **안 잡는다**(`-spec` 과 `.spec` 은 다르다) |
| 결론 | `test/helpers/concurrency.spec.ts` 를 그냥 만들면 **어느 러너도 돌리지 않는다** |

> 이 저장소에서 «새 테스트가 실제로 실행되는지 확인» 을 놓쳐 본 적이 있다. 그래서 이 PR 의
> 핵심 위험은 테스트 내용이 아니라 **러너가 그것을 집는가**다.

## A-2. 이 표를 «선례 없음» 으로 읽은 것이 틀렸다 — `--impl-prep` BLOCK: YES

첫 판은 위 표에 *"`test/` 의 기존 non-e2e spec 0건 — 선례가 없어 관례를 새로 정해야 한다"* 를
덧붙이고 `jest.config.ts` 의 `roots` 확장을 골랐다. `--impl-prep`
(`review/consistency/2026/09/21/22_25_20`) 의 `plan_coherence` 가 **Critical 로 차단**했다.

**선례는 있었다. 내가 없는 곳에서 찾았다.** `test/` 에 선례가 없는 것은 당연하다 — 거기 두면
안 돈다는 게 이 문제의 정의다. 물었어야 할 것은 *"이 문제의 관례가 이미 등재돼 있나"* 이고,
답은 **내가 지금 드레인하고 있는 그 트래커 안**에 있다:

| 실측 | 값 |
| --- | --- |
| 트래커 `:1895` developer 항목 | «self-spec 동반 헬퍼는 `src/shared/testing/`» — `#1308` 이 고른 처방 |
| `src/shared/testing/` 의 선례 쌍 | **5쌍** (`response-contract`·`schedule-trigger-ref`·`swagger-probe`·`trigger-workflow-ref`·`user-secret-absence`) |
| `trigger-workflow-ref.ts` 파일 스코프 註 | 위 A 표와 **같은 세 문장**(rootDir·testRegex·"영구히 돌지 않는다")을 이미 담고 있다 |

즉 나는 **이미 등재된 사실을 다시 발견해 놓고, 등재된 처방 대신 다른 것을 발명**했다.
이 세션의 반복 교훈과 같은 형태다 — «문서화됐는데 미구현» 처럼 보이는 것을 만나면 먼저
`git log`/트래커를 실측해야 한다.

## B. 처방: 규칙을 `src/shared/testing/` 의 순수 모듈로 (선례 (a))

모듈 로드 검사는 지금 형태로는 테스트할 수 없다 — 최상위 `for` 루프의 **임포트 부수효과**라
`jest.isolateModules` + 상수 `doMock` 이 필요한데, 그건 «검사» 가 아니라 «모킹 기계» 를
검증하게 된다. `fires.length < 2` 도 DB 의존 함수 안에 갇혀 있다.

**두 규칙을 순수 함수로 꺼내 선례가 사는 자리에 둔다**:

```
codebase/backend/src/shared/testing/overlap-preconditions.ts       (신규, 순수 — import 0)
codebase/backend/src/shared/testing/overlap-preconditions.spec.ts  (신규, self-spec)
```

```ts
export function assertEnoughFiresForOverlap(fireCount: number): void;
export function assertGuardBelowKnownTimeouts(
  guardMs: number,
  timeouts: ReadonlyArray<readonly [string, number]>,
): void;
```

`test/helpers/concurrency.ts` 는 이 둘을 **호출만** 한다 (최상위 한 줄 + 함수 안 한 줄).
DB 의존 오케스트레이션(`raceUnderHeldLock`)은 `test/helpers/` 에 **남는다**.

이 자리를 고르면 **jest 설정을 한 글자도 바꾸지 않는다** — `rootDir: 'src'` 가 이미
`src/shared/testing/*.spec.ts` 를 집는다(선례 5쌍이 지금 돈다). `roots` 확장안보다 좁다.

> **`fires.length < 2` 가 정말 막는 것** — 실측으로 갈라 둔다. `0` 이면 `Promise.all([])` 가
> 즉시 resolve 돼 공허성 가드가 `settled` 로 **이미 RED** 다(메시지만 나쁘다). 진짜 자리는
> **`1`** 이다: 요청 하나가 락을 기다리면 가드는 `pending` 을 보고 **통과**시킨다 — 겹침이
> 없는데 초록인 테스트가 된다. 다른 방어가 없는 유일한 케이스다.

> **남는 이음매를 적어 둔다**: 두 규칙의 *내용*은 테스트되지만 `concurrency.ts` 가 그것을
> *호출한다*는 **배선**은 테스트되지 않는다. 선례 5쌍도 같은 이음매를 갖는다
> (`expectTriggerWorkflowRef` 의 self-spec 은 헬퍼를 검증하고, e2e 가 그것을 부르는지는
> 별도로 검증하지 않는다). 선례와 같은 등급이라 여기서 새 기계를 만들지 않는다.

## B-2. `PROJECT.md:331` — 이 BLOCK 의 원인이라 같은 PR 에서 닫는다

트래커 `:1895` 의 처방은 *"`PROJECT.md` §파일 위치 에 한 줄"* 이다. 현 문면은
`- 신규 헬퍼: codebase/backend/test/helpers/<name>.ts` 뿐이고, **#1377 의 나를 그리로 보낸 것이
정확히 그 줄**이다. 예외가 거기 없어서 이번 BLOCK 이 났다 — scope 확장이 아니라 **같은 결함**이라
이 PR 에서 닫는다. 트래커 항목도 그 커밋에서 해소 표시한다.

## C. 이 PR 의 판별 실험 — 테스트가 **실제로 도는가**

직전 PR 의 음성 대조군과 같은 자리다. «unit PASS» 는 증거가 아니다 — 러너가 새 파일을
아예 안 집어도 PASS 다.

- [x] 새 spec 의 단언 하나를 **일부러 깨뜨린** 뒤 `run-test.sh unit` 이 **RED** 인지 본다.
- [x] 수집 여부를 **수치로도** 남긴다.

### 실측 — 예측과 대조

| 뮤턴트 | 예측 RED | 실측 RED | 죽은 테스트 |
| --- | --- | --- | --- |
| **A**: spec 단언 하나를 깨뜨림 (`run-test.sh unit` 전수) | 1 | **1** | `받은 수를 메시지에 싣는다` |
| **B**: `>=` → `>` | 1 | **1** | `가장 짧은 상한과 같으면 던진다` |
| **C**: 첫 항만 검사(`timeouts.slice(0, 1)`) | 2 | **2** | `같으면` + `첫 항을 통과해도 둘째 항이 위반이면` |
| **D**: `fireCount < 2` → `< 1` | 2 | **2** | `thunk 1개면 던진다` + `받은 수를 메시지에` |

**A 가 이 PR 의 판별 실험이다** — 타겟 jest 가 아니라 **`run-test.sh unit` 전수**에서 RED 가
났으므로(`_test_logs/unit-20260921-225725.log`: `1 failed, 471 passed, 472 total`) 그 파일은
실제로 수집되고 단언이 실제로 돈다. B~D 는 뮤턴트 유효성(테스트가 규칙을 진짜로 조이는가)이다.

### 수집 수치

| | 전 | 후 |
| --- | --- | --- |
| unit 수집 파일 | 471 | **472** |
| backend 테스트 | — | **9941** (신규 spec 단독 11 PASS) |

> **래퍼 요약 숫자를 그대로 믿지 말 것** — `run-test.sh unit` 의 한 줄은 `tests=14` 를 냈는데
> 그건 **마지막으로 실행된 패키지**의 수다. 로그에 `Tests:` 줄이 여러 개이고 backend 는
> 9941 이다. 커버리지 판단에 요약 숫자를 쓰면 안 되는 자리를 다시 확인했다.

## D. 하지 않는 것

- **프로덕션 런타임 코드 변경 0** — 신규 파일은 `tsconfig.build.json` 이 이미 exclude 하는
  `src/shared/testing/**` 아래이고 `dist/` 로 나가지 않는다(프로덕션 소비처 0건 유지).
- **jest 설정 변경 0** — `rootDir`·`roots`·`testRegex` 어느 것도 건드리지 않는다.
  (`collectCoverageFrom`·`coverageDirectory` 가 `rootDir` 상대라 함께 움직이는 위험도 소멸.)
- `raceUnderHeldLock` 을 `src/` 로 옮기지 않는다 — `pg.Client` 를 모는 오케스트레이션을
  테스트 사유만으로 프로덕션 트리에 넣게 되고, 9개 e2e 의 임포트 경로가 함께 움직인다.

## E. 유예 — 이 PR 에서 하지 않고 등재하는 것

`--impl-prep` `22_39_59` 의 Warning 1: `spec/5-system/{5-expression-language,7-llm-client,
11-mcp-client,16-system-status-api}.md` 의 첫 섹션 헤딩이 `## Overview` 가 아니다.

**이번 diff 가 유발한 것이 아니고**(2026-05 이래 존재), `spec/` 은 developer 권한 밖이라
여기서 고칠 수 없다. 트래커에 planner 항목으로 올린다 — 이 PR 의 수렴 조건이 아니다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` → BLOCK: NO
      (`22_25_20` BLOCK: YES → plan 개정 → `22_39_59` **BLOCK: NO · Critical 0 · Warning 1**.
      Warning 은 `spec/5-system` 4개 파일의 `## Overview` 헤딩 누락 — 2026-05 이래의 standing
      편차이고 `spec/` 은 developer 권한 밖이라 planner 항목으로 등재만 한다. §E)
- [x] `overlap-preconditions.ts` + self-spec 작성, `concurrency.ts` 는 호출만
- [x] `PROJECT.md:331` 에 예외 한 줄
- [ ] 트래커 `:1895` + 본 항목 해소 표기 (**종결 커밋에서** plan 이동과 한 동작으로)
- [x] **판별 실험으로 수집 확인** (§C — 뮤턴트 4종 예측=실측)
- [x] TEST WORKFLOW — lint PASS(`lint-20260921-225901.log`) · unit 472스위트/9941
      (`unit-20260921-225255.log`) · build PASS 타입체크 ratchet 포함
      (`build-20260921-225951.log`) · **e2e 378 PASS**(`e2e-20260921-230327.log`, #1377 과 동수).
      `dist/` 에 `shared/testing` 유출 0 확인
- [x] `/ai-review` → **1라운드 수렴** (`review/code/2026/09/21/23_08_19`,
      **Critical 0 · Warning 0**, forced 7/7 확보, 9 reviewer 실행). fix 0건이라
      `RESOLUTION.md` 불요. INFO 는 비차단 — 고치면 게이트 freshness 만 재무장된다.
- [x] `--impl-done` **해당 없음** — 실측으로 확인했다. spec frontmatter 의 `code:` 는
      `shared/testing/` 을 **파일별 prefix**로 적는다(`trigger-workflow-ref*.ts` ·
      `schedule-trigger-ref*.ts` · `response-contract*.ts` · `swagger-probe*.ts` ·
      `user-secret-absence*.ts`) — 디렉터리 와일드카드가 아니라 `overlap-preconditions.ts` 는
      어디에도 안 걸린다. `test/helpers` 는 `spec/` 전체 grep **0건**. push 게이트
      (`review_guard.evaluate_review`) 도 `blocked: False` 로 같은 판정을 냈다.
      > **등재하지 않는 것이 맞다** — 등재된 다섯은 각각 **spec 규칙**(DTO shape · 비밀 부재 ·
      > 응답 계약)을 시행한다. 이 헬퍼가 시행하는 것은 테스트 오케스트레이션의 전제이고
      > 그것을 소유한 spec 문서가 없다. 규칙 없는 등재는 `code:` 의 의미를 묽게 한다.
- [x] 트래커 항목 해소 + 이 plan `plan/complete/` 로 (**한 커밋으로** — 직전 PR 이 각주를
      먼저 쓰고 상태를 나중에 맞춰 지적받았다)
