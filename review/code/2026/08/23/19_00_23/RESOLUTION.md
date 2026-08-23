# RESOLUTION — `19_00_23` (CRITICAL 0 · WARNING 4 · 위험도 MEDIUM)

WARNING 4건 **전부 반영**. INFO 13건 중 조치한 5건과 미조치 사유를 아래에 적는다.

## WARNING #1 (security, MEDIUM) — SSE/fanout 은 여전히 fail-open → **범위 유지, 인계 보강**

이 PR 이 REST 만 닫고 SSE 를 남긴 것은 `--impl-prep` 단계에서 **의도적으로 결정**한 범위이고,
spec §R17 표와 트래커에 이미 등재돼 있다. 리뷰어도 *"이번 PR 의 blocking 사유는 아니나 후속
PR 착수 전 이 WARNING 을 그대로 인계할 것"* 으로 판정했다.

**다만 리뷰어가 내가 못 찾은 호출부를 짚었다** — `FormInteractionService.waitForFormSubmission`
과 `ButtonInteractionService.waitForButtonInteraction` 이 아무 필터 없이 `nodeOutput` /
`buttonConfig.nodeOutput` 을 실어 `toFanoutEnvelope` 를 지난다. **그 실측을 트래커 항목에
그대로 옮겨 적었다** — 후속 착수자가 다시 찾지 않도록.

## WARNING #2 (architecture) — 계층 역전 → **파일 분리**

정당한 지적이다. `strip-external-only-fields.ts` 는 **순수·범용** deny-list(다중 소비처, 깊은
순회)였는데 내가 거기에 `NodeHandlerOutput` type import 를 넣어 **하위 계층이 도메인 타입을
참조**하게 만들었다. 소비처도 `getStatus` 한 곳뿐이라 응집도도 낮았다.

→ `shared/utils/node-output-allowlist.ts` 로 **분리**하고 테스트도 함께 갈랐다. 두 파일 모두
상단에 "왜 분리돼 있나 · 두 정책의 관계(깊은 deny-list vs 최상위 allowlist)" 를 적었다.

## WARNING #3 (architecture·documentation) — `getStatus` JSDoc 이 stale → **정정**

`interaction.service.ts` 의 JSDoc 이 *"`nodeOutput` 키-allowlist 는 별개 잔여 항목"* 이라
말하는데 **바로 그 메서드 본문에** 이 PR 이 배선을 넣었다. spec §R17 표는 정확히 갱신했는데
이 한 줄만 남았다 — 이 세션에서 반복한 형태다.

→ *"이 함수의 waiting 출구 1곳에 fail-closed 로 적용된다 — terminal 은 의도적 제외, SSE 는
잔여. 범위 표는 §R17"* 로 정정.

## WARNING #4 (documentation) — CHANGELOG 누락 → **추가**

같은 표면의 **선행 보안 수정**(`llmCalls` fanout 누출)은 발견 배경·운영 영향까지 CHANGELOG 에
남겼는데 성격이 같은 이번 건에는 없었다. 관례 이탈이 맞다.

→ 같은 형식으로 추가했다. **과거 노출 가능성**(waiting 응답을 받은 토큰 보유자)을 명시하되,
`_retryState` 가 자격증명이 아니라 재시도 continuation 상태라는 점도 함께 적어 과장하지
않았다.

## INFO 처분

| # | 항목 | 처분 |
| --- | --- | --- |
| 3 | `__proto__` 회귀 테스트 부재 | **추가** — 자매 스위트와 같은 형태. fail-closed 라 지금도 안전하지만 구현이 바뀌면 조용히 뚫린다 |
| 4 | buttons 분기 직접 캐너리 없음 | **추가** — 지금은 같은 `out` 참조라 안전하지만 분기가 독립 재가공되면 못 잡는다 |
| 5 | terminal 경계가 부수 효과로만 커버 | **추가** — 설계 경계를 의도 명시 캐너리로 못박았다 |
| 7 | `delete` 안전 근거 미기재 | **추가** — 자매가 `defineProperty` 를 쓰는 건 **대입**이 setter 를 타서고 `[[Delete]]` 는 그 경로가 없다는 근거를 주석으로 |
| 1 | 하위 plan 체크박스 미체크 | **flip** |
| 2 | "타입에서 파생" 표현 vs 리터럴 배열 | **미조치** — assertion 이 *누락*은 잡고 *초과*는 안 잡는 것은 **설계**다(wire 전용 키는 타입에 없다). 그 비대칭을 JSDoc 이 이미 명시한다 |
| 6 | assertion 판독성 | **미조치** — 바로 위 JSDoc 이 무엇을 강제하는지와 깨졌을 때 할 판단을 적고 있다 |
| 8 | 파생 `it.each` 가 남아 있음 | **미조치** — 리터럴 캐너리가 앞에 있고 그 주석이 파생 테스트의 vacuous 이력을 명시한다. 지우면 개별 키 통과 검증이 사라진다 |
| 9·13 | 응답 필드 축소 · REST/SSE 강도 비대칭 | **조치 불요** — 리뷰어도 "이미 반영" 판정 |
| 10 | `Object.freeze` 부재 | **미조치** — 자매 상수도 같은 패턴이라 신규 위험이 아니고, 둘을 함께 바꾸는 게 맞다(이 PR 범위 밖) |
| 11 | 내부 필드 SoT 위치 | **미조치** — 리뷰어도 "필수 아님". 컴파일타임 assertion 이 현재 안전을 보장한다 |
| 12 | `includes` → `Set` | **미조치** — 9개 리터럴. 리뷰어도 "순수 마이크로 최적화, 우선순위 낮음" |

## 재검증

- 영향 스위트 GREEN (분리 후 `node-output-allowlist.spec.ts` 21건 + `interaction.service.spec.ts` 58건)
- TEST WORKFLOW 4단계 재수행 (아래 plan `## 게이트·수치` 갱신 참조)
