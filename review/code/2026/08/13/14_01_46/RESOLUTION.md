# RESOLUTION — 세션 `14_01_46` (백로그 잔여 3건)

CRITICAL 0 / WARNING 3. **3건 전부 조치.** 그중 하나는 내가 이 PR 에서 새로 만든 결함이었다.

## WARNING 1 (side_effect) — 가드가 롤백 불변식을 깼다

**조치 완료. 판정을 되돌렸다.**

`Array.isArray(rows)` 가드를 `logger.warn` + `return false`(defer)로 썼다. 리뷰어 지적:
그러면 콜백이 예외 없이 끝나 **트랜잭션이 커밋된다.**

지적이 맞다. shape 이 어긋났다는 것은 **UPDATE 가 실제로 행을 갱신했는지 알 수 없다**는 뜻이다:

| 처리 | DB | 앱 | 결과 |
|---|---|---|---|
| `return false` (내가 쓴 것) | UPDATE 가 적용됐다면 **커밋** → `running` | defer | **워커 없는 `running`** — 실행이 영영 붕 뜬다 |
| `throw` (되돌린 것) | 롤백 → `pending` 유지 | 예외 | 재시도가 정상적으로 집는다 |

`throw` 로 되돌렸다. **가드가 더하는 것은 판정 변경이 아니라 진단이다** —
`Cannot read properties of undefined (reading 'length')` 대신 원인이 보이는 메시지.
원래 백로그 항목이 원한 것도 그것이었다("런타임 가드", 실패 방향은 이미 fail-closed).

> **내가 놓친 지점**: "fail-closed 를 명시한다" 는 문구에 만족해서, **어느 층에서** 닫히는지를
> 안 물었다. 애플리케이션 반환값은 닫혔지만 **트랜잭션은 열려 있었다.** 방어를 한 칸 좁게
> 잡는 형태가 또 나왔다.

**이 회귀를 캐너리로 고정했다.** 뮤턴트 H2(가드가 던지지 않고 `return false` 로 삼킴) =
**내가 방금 저지른 것 그 자체** → baseline 441 passed vs H2 **1 failed** 로 사살 확인.
고친 것을 고친 채로 유지하는 것은 별개 문제다.

## WARNING 2 (maintainability) — fixture 두 벌

**조치 완료.** 내가 만든 `buildDispatcherForNull()` 이 기존 `buildDispatcher()` 의 배선(생성자
5인자·adapter shape·triggerRepository fixture)을 그대로 복제했다. 생성자가 바뀌면 두 곳을 함께
고쳐야 하고, **한쪽만 고치는 것이 이 저장소가 반복해 온 형태**다.

공통 `makeDispatcherHarness({ renderResult?, lookupState? })` 를 모듈 상단에 두고 둘 다 그것을
쓰게 했다. 옵션은 두 축만 연다 — 렌더 결과와 대화 상태. **통합 후 뮤테이션 4/4 유지**를 확인해
리팩터가 테스트를 약화시키지 않았음을 증명했다.

## WARNING 3 (documentation) — `'deferred'` 서술 stale

**자동 해소.** WARNING 1 을 `throw` 로 되돌리면서 **새 `deferred` 경로가 사라졌다.**
docstring·`(d)` 분기·호출부 주석 3곳의 "cap 초과" 서술은 여전히 정확하다.

> 세 지점을 고치는 대신 **고칠 필요를 없앤** 것이다. WARNING 1 과 3 이 같은 원인의 두 증상이라
> 하나를 바로잡으니 다른 하나가 소멸했다 — 증상별로 고쳤으면 주석 3곳을 잘못된 사실에 맞춰
> 갱신했을 것이다.

## 조치하지 않은 INFO

| INFO | 처분 |
|---|---|
| 1 `SNAPSHOT_CACHE_MAX_ENTRIES` export 사유 주석 | 무조치 — 자매 상수와 비대칭이나 소비처가 정의부·내부·테스트뿐 |
| 2 `emitSpy` 복원이 `finally` 밖 | **부분 조치** — 가드 테스트를 다시 쓰면서 `try/finally` 로 감쌌다 |
| 3 `dispatcher as unknown as {...}` 캐스트 4곳 | 무조치 — 파일 기존 관례. 별칭화는 별건 |
| 4 재큐 단언 부재 | 무조치 — 인접 테스트가 배선을 덮는다 |
| 5·6 plan 완료 메모 배치·빈 줄 | 무조치 — 서식 |
| 7 CHANGELOG 미등재 | 무조치 — 관측된 결함이 아닌 순수 진단 개선이고, 판정은 종전과 동일(둘 다 예외) |
| 8 `Logger.prototype` 전역 patch | 무조치 — `try/finally` 복원 보장 |
| 9 spec 문서화 대상 아님 | 확인 — 조치 불요 |

## 검증

- eslint **0/0** · execution-engine **441 passed** · chat-channel dispatcher **38 passed**
- typecheck ratchet **199건/38파일** 불변
- 뮤테이션: evict **4/4** · logFn **4/4**(빌더 통합 후 재확인) · 가드 **H1·H2·H3 사살**

> ⚠️ 가드 뮤테이션에서 `jest -t` 필터 실행이 이 스위트에서 `SIGABRT`(exit=-6)를 내는 flake 를
> 만났다. **baseline 쪽도 크래시**했으므로 뮤턴트 탓이 아니다. 전체 스위트로 다시 재
> baseline 441 passed vs 뮤턴트 1 failed 로 판정했다. **크래시는 변별력의 증거가 아니다** —
> 이 브랜치에서 그 함정을 두 번 만났다.
