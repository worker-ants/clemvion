# RESOLUTION — `review/code/2026/09/17/13_44_39` (1라운드)

**Critical 0 · Warning 5 · LOW.** forced 7/7, `unfinished: []`.

`codebase/**` 를 고쳤으므로 이 라운드로는 종결하지 않는다 — 2라운드가 뒤따른다.

| # | 발견 | 처분 |
|---|---|---|
| W1 [SPEC-DRIFT] `spec/2-navigation/2-trigger-list.md §3` ⚠️ 가 이 PR 로 낡는다 | **planner 후속** — 그 문장은 planner 턴이 썼다. 머지 직후 별 PR 에서 ⚠️ 교체 + 증거 e2e 의 `code:` 등재 + `15-chat-channel.md §5.4` 404 사유. plan «이 PR 이 안 하는 것» 에 기재 |
| W2 plan 뮤턴트 표의 M1 «2 RED» 가 실측과 다르다 | **수용·정정** — 리뷰어가 맞았다. «2» 는 창 1 이 `save` 반환값을 그대로 돌려주던 **이전 형태**에서 잰 값이었고, 코드를 고친 뒤 다시 재지 않았다. 최종 코드에서 재측정: M1 **1 RED** |
| W3 창 1 머리말 «재읽은 행을 저장 대상으로 쓴다» 가 아래 부분 객체 `save` 와 모순 | **수용·수정** — 같은 전제를 가진 `withRef` 픽스처 JSDoc 도 함께 고쳤다 |
| W4 mock JSDoc 이 «이 파일을 고칠 땐 다시 재라» 인데 재측정 기록이 없다 | **수용·재측정** — `transaction` 이 콜백을 실행하지 않는 뮤턴트: **53 → 60 RED** (321건 중). JSDoc 갱신 |
| W5 저장 payload 가 `save` 호출과 `Object.assign` 에 리터럴로 두 번 | **수용·수정** — `const patch` 하나로 |

INFO 중 반영한 것:
- **#1** `if (written.updatedAt)` 가드 근거(5명 공통) — 주석: 실제 TypeORM 은 `@UpdateDateColumn` 이라 늘 채운다. 가드는 단위 대역이 넘긴 객체를 돌려줄 때 재읽은 값을 `undefined` 로 지우지 않으려는 것.
- **#12** null 회귀 단언이 한 컬럼만 본다 — **응답에 남는** 세 컬럼(`endpointPath`·`lastTriggeredAt`·`authConfigId`)으로 조였다. 처음엔 `notificationSecretV2`·`chatChannelTokenV2` 로 조였다가 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답에서 지워 단언이 성립하지 않음을 실패로 알았다. «한 필드만 골라 덮기» 뮤턴트(M4) RED.
- **#4** `jest.config.ts` 의 «e2e 는 `pg` Client 만 연다» 전제 — 예외 한 줄.

나머지 INFO(#2 CASCADE 창 500 마스킹 · #3 e2e 컬럼 범위 2/4 · #5 mock 트립와이어 약화 · #6 `update()` 길이 · #7 에러코드 리터럴 · #8 TypeORM 내부 동작 의존 · #9 락 보유 시간 · #10 공용 mock 파급 · #11 보안 방향 확인 · #13 e2e 비밀번호 fallback)는 조치 불요 · 기지 갭 · 기록 목적이다.

## 재측정 (최종 코드)

| 뮤턴트 | RED |
|---|---|
| M1 통째 엔티티 `save` | `저장 대상은 이 요청이 바꾸는 필드뿐이다` |
| M2 반환값 통째 덮기 (PR 안에서 낸 회귀) | `save 반환값의 null 이 재읽은 값을 덮지 않는다` |
| M3 `updatedAt` 누락 | 같은 테스트 |
| M4 한 필드만 골라 덮기 | 같은 테스트 |
| mock `transaction` 콜백 미실행 | 60 |

`run-test-all.sh` 4단계 ALL PASS (lint · unit 14 · build+타입 ratchet · e2e 314).
