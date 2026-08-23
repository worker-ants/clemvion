# RESOLUTION — `19_24_24` (CRITICAL 0 · WARNING 2 · INFO 3 · 위험도 MEDIUM)

타겟 라운드(`architecture`·`security`·`documentation`·`testing` — 직전 라운드 지적의 주체).
직전 WARNING 4건이 소스에 실제 반영됐음을 4명 전원이 재확인했다.

## WARNING #1 (security) — SSE fanout 잔존 → **범위 유지, 인계 보강**

`--impl-prep` 에서 정한 범위이고 리뷰어도 *"이번 diff 가 새로 만든 회귀는 아니며 tracker 에
이미 등재돼 non-blocking"* 으로 판정했다.

**이번에도 리뷰어가 호출부를 더 짚었다** — 직전 라운드의 둘에 더해 `processButtonResumeTurn`
과 `nodeOutputForEvent` 까지. 트래커 항목에 **전부 옮겨 적고**, 재사용할 헬퍼 경로도 명시했다.
후속 착수자가 세 번째로 같은 grep 을 돌리지 않도록.

## WARNING #2 (documentation) — 내가 파일을 분리하며 만든 깨진 링크 → **정정**

직전 라운드 W2(계층 역전) 대응으로 코드를 분리하면서 JSDoc 문구를 **그대로 옮겼다**.
`{@link EXTERNAL_STRIPPED_FIELDS}` 가 "위" 를 가리키는데 그 심볼은 이제 자매 **파일**에 있다.

→ 파일명을 명시한 산문으로 정정했다. import 를 추가하는 대안은 택하지 않았다 — 문서 참조
하나 때문에 방금 끊어 낸 결합을 되살리게 된다.

## INFO 처분

| # | 항목 | 처분 |
| --- | --- | --- |
| 2 (security) | `NODE_OUTPUT_ALLOWED_KEYS` 에 `Object.freeze` 없음 | **적용** — `as const` 는 컴파일타임 리터럴 타입만 준다. 이 상수의 JSDoc 이 "보안 경계" 라 주장하므로 런타임 불변까지 참으로 만들었다(컴파일타임 결속과 같은 원칙) |
| 3 (testing) | terminal `error` 캐너리가 `result` 와 비대칭 | **추가** — 아래 참조 |
| 1 (architecture) | `shared/utils/` 밖으로 재배치 | **미조치, 트래커 등재** — 같은 라운드에 이미 한 번 옮겼고 또 옮기면 리뷰가 다시 stale 해진다. 리뷰어도 "후속" 판정. **SSE 항목이 소비처를 하나 늘리므로 그 작업과 함께 정하는 편이 낫다**(소비처가 둘이 되면 배치 답이 달라진다) — 그 근거를 트래커에 적었다 |

## ⚠️ 새 캐너리가 **내 가정을 반증**했다 (그래서 값이 있었다)

INFO 3 을 반영하며 `error` 출구 캐너리를 썼는데 **첫 실행에서 실패**했다 —
`expect(err.임의진단키).toBe('keep')` 가 `undefined` 를 받았다.

원인은 코드가 아니라 **내 fixture** 였다. 두 terminal 출구는 **둘 다
`execution.outputData`** 를 읽는데(`result`/`error` 분기는 `status` 로만 갈린다) 나는 fixture 를
`execution.error` 에 넣었다. 리뷰어는 제안에서 *"`status: FAILED` + 임의 키 outputData"* 라고
**정확히** 적었는데 내가 옮겨 적으며 틀렸다.

fixture 를 고치니 통과했고, **그 과정에서 두 출구가 같은 컬럼을 읽는다는 사실이 테스트에
주석으로 남았다** — 원래 INFO 가 겨눈 "통합 리팩터링 시 한쪽만 바뀌는 것" 을 막는 데 그
사실이 핵심이다.

## 재검증

- 영향 스위트 **80/80 GREEN**(`interaction.service.spec.ts` + `node-output-allowlist.spec.ts`)
- TEST WORKFLOW 4단계 재수행 (아래 plan `## 게이트·수치` 갱신 참조)
