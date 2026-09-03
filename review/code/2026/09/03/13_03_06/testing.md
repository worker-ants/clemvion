# 테스트(Testing) 리뷰 — WS `auth.token_expired` 이월 INFO 정리 (누적 diff, 4라운드째)

## 컨텍스트

이 diff(`d73eff860`..`a1984f196`)는 이미 3라운드(`11_57_58`, `12_16_24`, `12_40_10`)를 거쳤고,
매 라운드 testing 관점 리뷰가 상세히 수행됐다(JSDoc 오귀속 복원, rearm 개별 단언, cutoff
음수-clamp 순서 단언 추가, unref 정밀화). `80ac92668`(2R 수정) → `a1984f196`(3R 수정) 사이의
유일한 코드 변경은 `websocket.gateway.spec.ts`에 7줄(`invocationCallOrder` 순서 단언)이 추가된
것뿐이며, `websocket.gateway.ts`/`websocket-events.types.ts` 소스는 그 구간에서 변경이 없다
(`git diff 80ac92668 a1984f196 -- .../websocket.gateway.ts .../websocket-events.types.ts` = 빈
출력, 직접 확인). 이번 라운드는 그 위에서 새로 남은 갭이 있는지 독립적으로 재검증하는 데 집중했다.

## 검증 방법 (뮤테이션, 저장소 밖 `cp` 백업 → 원복)

`websocket.gateway.ts` 원본을 세션 scratch 디렉터리로 `cp` 백업 → 저장소 파일 직접 뮤테이션 →
`websocket.gateway.spec.ts` 실행(필터 없이 전체 파일, 72개) → `cp` 로 원복 → 매 항목 종료 시
`git status --short` 로 잔여물 없음 확인. `git checkout`/`restore`는 사용하지 않았다.

| # | 뮤테이션 | 대상 | 결과 |
|---|---|---|---|
| 1 | `notice.unref(); cutoff.unref();` 두 줄 삭제 | `websocket.gateway.ts:224-225` | **RED** — `만료 타이머는 unref 된다` 테스트, `hasRef()` 기대 `false` / 실측 `true` |
| 2 | `armExpiryTimers` 선제 `clearExpiryTimers(client.id)` 를 조기 `return` **뒤**로 이동(2R 이전에 실제로 있었던 W3 회귀 재현) | `websocket.gateway.ts:180-185` | **RED** — `exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다` 테스트, `emit` 이 `not.toHaveBeenCalledWith` 기대를 위반(옛 타이머가 살아남아 emit 1회 발생) |
| 3 | `notice`/`cutoff` `setTimeout` 블록의 **등록 순서를 통째로 교환**(3R 에서 이미 지적·수정된 형태를 재현) | `websocket.gateway.ts:203-220` | **RED** — `이미 만료된 exp 로 연결하면 즉시 끊는다` 테스트, `invocationCallOrder` 비교 실패(`Expected: < 60, Received: 61`) — **12_40_10 라운드의 WARNING(등록 순서 뒤바뀌어도 존재-단언만으로는 안 걸림)이 실제로 수정·해소됐음을 독립 재확인** |

3건 모두 원복 확인(`cp` 복원 후 `git status --short` 무변경, `npx jest websocket.gateway.spec.ts` 72/72 GREEN 재확인). 전체 backend 유닛 스위트도 직접 실행해 **442 suites / 9,233 passed / 1 skipped**로 초록임을 확인했다(RESOLUTION.md `11_57_58`가 기록한 "9,232"와 1건 차이 나지만, 그 기록은 이 서브사이클 이전 시점의 스냅샷이라 이번 3R 스펙 추가·이후 형제 작업 반영分으로 보이며 코드 결함은 아니다 — 참고용 INFO).

## 발견사항

- **[INFO]** `expSeconds` 가 `NaN`/`Infinity` 인 경로는 여전히 전용 테스트가 없다 (3라운드 연속 이월, 판단 유지)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:185` (`typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)`)
  - 상세: `undefined` 케이스(`exp 가 없는 토큰이면 타이머를 걸지 않는다` 테스트, `websocket.gateway.spec.ts:915` 부근)와 동일한 분기를 공유하므로 실사용 리스크는 낮다. 3개 선행 라운드가 동일 결론(우선순위 낮음, 조치 불요)에 도달했고 이번 라운드도 이견 없음 — 새로 발견한 것이 아니라 재확인.
  - 제안: 조치 불요(기존 판단 유지). 여유가 있다면 `exp: NaN` 1케이스 추가.

- **[INFO]** `RESOLUTION.md`(`11_57_58`)의 "unit(backend 9,232)" 수치가 현재 실측(9,233 passed + 1 skipped)과 1건 차이
  - 위치: `review/code/2026/09/03/11_57_58/RESOLUTION.md` 검증 섹션(파일 끝 "## 검증")
  - 상세: 이 수치는 그 라운드가 닫힐 당시의 스냅샷이고 이후 3R(테스트 1개 항목에 단언만 추가, 신규 `it` 없음)이나 형제 브랜치 작업이 반영됐을 수 있어 이 PR 의 코드 결함은 아니다. 테스트 관점에서 새 위험은 없으나, 문서 정확성 관례(과거 메모리: "실측 시점" 표기)상 참고용으로만 남긴다.
  - 제안: 조치 불요. 굳이 정정한다면 "PR이 닫히는 시점" 값으로 재측정.

## 회귀·격리·가독성 (문제 없음, 확인)

- `websocket.gateway.spec.ts` 의 `토큰 만료` `describe` 블록은 `beforeEach`에서 `jest.useFakeTimers()` + `jest.setSystemTime(NOW)`, `afterEach`에서 `jest.useRealTimers()` 로 정확히 격리된다. 최상위 `beforeEach`가 매 `it`마다 `TestingModule`을 새로 `compile()`하므로 `gateway.expiryTimers` Map 이 테스트 간 누수되지 않는다 — 신규 5개 테스트(메시지 상수 이중 단언, rearm 개별 단언, exp-less rearm, 음수-clamp 즉시종료+순서, unref 정밀 단언) 모두 고유 `client.id`를 사용해 상호 독립적으로 실행 가능함을 확인.
- `만료 타이머는 unref 된다` 테스트의 `jest.spyOn(global, 'setTimeout')`은 `try/finally`로 감싸 `mockRestore()`가 항상 실행된다(1R INFO#6 수정 반영 확인) — 테스트 실패 시에도 spy 잔존으로 후속 테스트를 오염시키지 않는다.
- `handleDisconnect`를 만료 타이머가 없는 소켓(`client-1`, `armExpiryTimers`를 거치지 않음)에 호출하는 기존 테스트(`websocket.gateway.spec.ts:993`)가 `clearExpiryTimers`의 `if (!timers) return;` 조기 반환 분기를 암묵적으로 커버한다 — 명시적 단언은 아니지만 크래시 없이 통과하는 것 자체가 방어 성립의 증거이며, 3라운드 동안 일관되게 "조치 불요"로 판단돼 왔다. 이견 없음.
- `MSG_AUTH_TOKEN_EXPIRING` 상수 사용처가 `websocket.gateway.ts`·`websocket.gateway.spec.ts` 양쪽뿐이고, 테스트가 상수 참조와 리터럴 값 단언을 함께 쓰는 "이중 관리"는 의도된 트레이드오프(관측 가능한 wire 계약을 못박는다)로 이미 이전 라운드가 뮤테이션으로 실효성을 검증했다 — 이번 라운드도 동의.

## 리뷰 스코프 밖

`review/code/2026/09/03/{11_57_58,12_16_24,12_40_10}/*.md`, `*.json`, `review/consistency/2026/09/03/12_40_11/*`은 애플리케이션 코드가 아니라 이전 라운드의 산출물이며 테스트 관점 분석 대상이 아니다 — 단 그 안의 정량적 테스트 주장(뮤테이션 RED, 통과 개수)은 신뢰성 확인을 위해 표본 재현했다(위 "검증 방법" 표). 워크트리에 별도로 존재하는 `codebase/backend/src/modules/auth/sessions.service.spec.ts`, `codebase/backend/test/users-change-password.e2e-spec.ts`, `plan/in-progress/auth-change-password-oauth-only-code-split.md` 변경은 이번 `testing.md` 프롬프트의 리뷰 대상 파일 목록(파일 1~4, WS 관련)에 포함되지 않아 스코프 밖으로 판단했다.

## 뮤테이션/저장소 변경

리뷰 중 `codebase/backend/src/modules/websocket/websocket.gateway.ts`를 3회 직접 뮤테이션했으나 매번 세션 scratch(`/private/tmp/claude-501/.../scratchpad/websocket.gateway.ts.orig`)에 원본을 `cp` 백업해 두고 뮤테이션 → 테스트 → `cp` 원복 순으로 진행했다. 최종적으로 `git status --short` 확인 결과 저장소에는 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/03/13_03_06/`)만 untracked 로 남아 있고, 소스 파일 잔여 변경은 없다.

## 요약

3라운드에 걸쳐 촘촘히 검증된 이월 INFO 정리(상수화+리터럴 이중 단언, 선제 `clearExpiryTimers`, `.unref()`, 순서 단언)를 이번 라운드에서 3개 독립 뮤테이션(unref 제거·조기 return 회귀 재현·타이머 등록 순서 교환)으로 재현한 결과 모두 정확히 RED 를 냈다 — vacuous 테스트가 아님을 재확인했고, 특히 `12_40_10` 라운드가 지적한 "존재-단언만으로는 등록 순서 역전을 못 잡는다"는 WARNING 이 `invocationCallOrder` 비교로 실제 해소됐음을 독립적으로 검증했다. 전체 스위트(gateway 72/72, backend 9,233 passed)는 뮤테이션 전후 모두 그린이며 격리·가독성 문제도 없다. 남은 유일한 갭은 3라운드 연속 이월된 `NaN`/`Infinity` `expSeconds` 미검증(우선순위 낮음, 판단 유지)뿐이고, 새로운 Critical/Warning 은 없다.

## 위험도

NONE
