---
title: raceUnderHeldLock 의 순수 동기 분기 둘을 실제로 행사한다
status: in-progress
owner: developer
worktree: race-helper-guard-tests-3a7c9d
started: 2026-09-21
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
| `test/` 의 기존 non-e2e spec | **0건** — 선례가 없어 관례를 새로 정해야 한다 |

> 이 저장소에서 «새 테스트가 실제로 실행되는지 확인» 을 놓쳐 본 적이 있다. 그래서 이 PR 의
> 핵심 위험은 테스트 내용이 아니라 **러너가 그것을 집는가**다.

## B. 모듈 로드 검사는 지금 형태로는 테스트할 수 없다 — 그래서 모양을 바꾼다

현재 검사는 모듈 최상위 `for` 루프의 **임포트 부수효과**다. 테스트하려면
`jest.isolateModules` + 상수 모듈 `doMock` 이 필요한데, 그건 «검사» 가 아니라 «모킹 기계» 를
검증하게 된다.

대신 **규칙을 순수 함수로 꺼낸다**:

```ts
export function assertGuardBelowKnownTimeouts(
  guardMs: number,
  timeouts: ReadonlyArray<readonly [string, number]>,
): void;
```

모듈 최상위는 그 함수를 **오늘의 상수로 한 번 호출**한다. 그러면
- 규칙 자체는 임의 입력으로 직접 테스트되고,
- «오늘의 상수에 적용» 은 그대로 임포트 시 발화한다.

«규칙» 과 «오늘의 값에 규칙을 적용» 을 분리하는 것이 요점이다.

## C. 이 PR 의 판별 실험 — 테스트가 **실제로 도는가**

직전 PR 의 음성 대조군과 같은 자리다. «unit PASS» 는 증거가 아니다 — 러너가 새 파일을
아예 안 집어도 PASS 다.

- [ ] 새 spec 의 단언 하나를 **일부러 깨뜨린** 뒤 `run-test.sh unit` 이 **RED** 인지 본다.
      **예측: RED**. GREEN 이면 그 파일은 수집되지 않은 것이고, 그게 이 PR 이 찾아야 할 것이다.
- [ ] 수집 여부를 **수치로도** 남긴다 — 전/후 `tests=N` 비교(로그 파일명과 함께).

## D. 하지 않는 것

- **프로덕션 코드 변경 0** — `codebase/backend/src/**` 는 건드리지 않는다.
- `rootDir` 자체를 바꾸지 않는다. `collectCoverageFrom`·`coverageDirectory` 가 `rootDir`
  상대 경로라 같이 움직인다 — **필요한 최소 변경(`roots` 추가)만** 한다.

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/5-system` → BLOCK: NO
- [ ] 규칙을 순수 함수로 추출 + 모듈 최상위는 그 함수 호출로
- [ ] `test/helpers/concurrency.spec.ts` 작성 (DB 불필요)
- [ ] unit 러너가 집도록 **최소 설정 변경** + **판별 실험으로 수집 확인**
- [ ] TEST WORKFLOW (lint · unit · build · e2e) — 숫자는 로그 파일명과 함께
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/5-system` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로 (**한 커밋으로** — 직전 PR 이 각주를
      먼저 쓰고 상태를 나중에 맞춰 지적받았다)
