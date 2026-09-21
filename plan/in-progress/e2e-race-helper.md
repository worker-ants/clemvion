---
title: 동시성 e2e 아홉 파일의 공용 헬퍼 추출 — 공허성 가드를 한 곳에 모은다
status: in-progress
owner: developer
worktree: e2e-race-helper-8d1b6e
started: 2026-09-21
spec_impact: none
---

# `raceUnderHeldLock()` — 테스트 전용 리팩터

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 항목
«동시성 e2e 아홉 파일의 공용 헬퍼를 추출한다 — 테스트 전용 PR» 을 닫는다.
**추출 여부는 아홉 번째 PR(#1376)의 착수 게이트에서 이미 결정됐다** — 이 PR 은 그 집행이다.

## A. 왜 추출하는가 — 줄 수가 아니라 공허성 가드다

동시 삭제 감사 중복 결함 클래스를 아홉 자리 닫으면서 같은 구조의 e2e 가 아홉 파일 쌓였다.
공통부는 이렇다:

```text
BEGIN → 락 한 쿼리 → 두 요청 발사 → 1.5초 공허성 가드 → COMMIT → 결과 정렬
finally: ROLLBACK + pending?.catch
```

**이 중 공허성 가드가 없으면 테스트가 고치기 전 코드도 통과시킨다** — 조용히 거짓 초록이
되는 부분이고, 지금은 **아홉 파일 11 블록에 손으로 복제**돼 있다. 실제로 #1376 에서
그 가드를 빠뜨린 테스트를 썼다가 리뷰가 잡았다. 열 번째를 쓰는 사람이 또 빠뜨릴 수 있다.

## B. 착수 전 실측 — 시그니처가 전부를 담는가

| 확인할 것 | 실측 |
| --- | --- |
| 대상 블록 수 | **아홉 파일 11 블록**(`member-remove` · `webauthn-credential-delete` 가 각 2개). 전부 `Promise.race` 1 · `pending?.catch` 1 · `finally` 1 로 균일 |
| 락 형태 | **전부 «한 쿼리 + params»** — 행 락 6(`… FOR UPDATE`, 그중 하나는 `ANY($1::uuid[])`), advisory lock 2(`pg_advisory_xact_lock(hashtext($1))`) |
| 가드 대기 | **전부 1.5초**. 트리거 삭제 경로의 `lock_timeout` 이 5초라 그 아래여야 한다 |
| 발사 함수 반환 | 파일마다 다르다 — `number` · `{status}` · `{status, code}`. **제네릭 `T` 로 받는다** |
| 발사 대상 | **10/11 은 같은 thunk 두 번**, `webauthn` 둘째만 **서로 다른 thunk**(`fireDelete(idA)`·`fireDelete(idB)`). → 시그니처는 `fire()` 하나가 아니라 **배열**이어야 한다 |
| 락과 발사 사이 IO | **11 블록 전부 0** — 락 직후 바로 발사한다 |
| COMMIT 과 `finally` 사이 IO | **11 블록 전부 0** — 단언뿐이라 헬퍼가 결과를 반환하면 `try` 밖으로 자연히 나간다 |

설계 — **트래커 등재분에서 `fire` 를 배열로 고친다**(위 실측 때문):

```ts
// codebase/backend/test/helpers/concurrency.ts
export async function raceUnderHeldLock<T>(
  locker: Client,
  lock: { sql: string; params?: unknown[] },
  fires: Array<() => Promise<T>>,   // 최소 2개
): Promise<T[]>;
```

### `integration-rotate-concurrency` 는 **제외한다** — 그리고 내가 한 번 틀렸다

grep 의 공통 토큰(`BEGIN`·`Promise.race`·`pending?.catch`·`finally`)만 보고 «같은 구조이니
포함이 맞다» 고 먼저 결론지었다. **본문을 읽으니 아니었다**:

- 요청을 **하나만** 발사한다(둘이 아니다). 상대편은 locker 가 잡은 트랜잭션 안의 `UPDATE` 가 대신한다.
- 락과 가드 **사이에 그 UPDATE** 가 끼고, COMMIT **전에** donor 암호문을 읽는다.
- 가드 반환 형태도 다르다(`{settled: boolean}`).

이걸 헬퍼에 욱여넣으려면 «몇 개 발사할지 · 락 쥔 채 실행할 훅 · COMMIT 전 읽을 훅» 파라미터가
붙어 **공유하는 것보다 감추는 것이 많아진다**. 삭제 경합이 아니라 **갱신 경합**이라 축이 다르다.

> 교훈: 토큰 수준 grep 으로 구조 동일성을 판정하면 안 된다. 이 세션에서 같은 형태
> («한 층을 grep 하고 다른 층을 단정») 를 반복했다.

## C. 이 리팩터의 진짜 위험 — 테스트가 조용히 약해지는 것

**«전부 GREEN» 은 이 PR 의 증거가 아니다.** 헬퍼가 락을 안 잡거나 가드를 안 걸어도
아홉 파일이 전부 통과할 수 있다(겹침이 없으면 각 요청이 그냥 순차로 성공한다).

그래서 **판별 실험**을 넣는다:

- [ ] **음성 대조군**: 헬퍼에서 **락 쿼리 호출을 빼는** 뮤턴트를 넣고 e2e 를 돌린다.
      겹침이 사라지므로 **공허성 가드가 `settled` 를 관측해 RED** 여야 한다.
      **예측: 11 블록 전부 RED**(각 블록이 가드를 통과 못 함). 실측을 함께 적는다.
      RED 가 안 나거나 수가 적으면 **그 블록은 가드가 죽은 것**이다 — 그게 이 PR 이
      찾아야 할 것이다.
- [ ] 뮤턴트 원복은 **`cp`** 로. 원복 후 `git status` 클린 확인.

## D. 하지 않는 것

- **매직 넘버 상수화(`1_500` · `60_000`)** — 헬퍼 안으로 들어가는 `1_500` 은 자연히 한 곳이
  된다. `60_000`(jest timeout)은 `it` 인자라 헬퍼 밖이고, 파일마다 다를 이유가 있어
  (초대 throttler 때문에 일부는 120초) **일괄 상수화하지 않는다.**
- **프로덕션 코드 변경 0** — `codebase/backend/src/**` 는 건드리지 않는다.
- **`integration-rotate-concurrency`** — 위 §B 의 근거로 **제외**한다.

## 체크리스트

- [x] `integration-rotate-concurrency` 가 같은 구조인지 실측 → **제외 결정**(§B). grep 으로 먼저
      «포함» 이라 결론졌다가 본문을 읽고 뒤집었다 — 그 경위도 §B 에 남겼다
- [ ] `/consistency-check --impl-prep <scope>` → BLOCK: NO
- [ ] 헬퍼 작성 + 아홉 파일 전환
- [ ] **음성 대조군** — 락 제거 뮤턴트로 가드가 살아 있음을 실측(예측/실측 두 칸)
- [ ] TEST WORKFLOW (lint · unit · build · e2e) — 숫자는 로그 파일명과 함께
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done <scope>` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
