# RESOLUTION — `18_19_33`

CRITICAL 0 / WARNING 1. **WARNING 조치 완료** + INFO 2건(#6·#8) 함께 처리.
**이 라운드로 리뷰 루프를 닫는다** — 사유는 아래 §수렴 판정.

## WARNING 1 — 회귀 테스트 주석의 근거 세션 오귀속 (documentation)

**조치 완료.** 지적이 맞고, **내가 쓴 주석의 사실 오류**다. 직접 확인했다:

```
$ ls -d review/code/2026/08/13/14_18_42        → No such file or directory
$ ls -d review/consistency/2026/08/13/14_18_42 → 존재
```

`14_18_42` 는 **consistency-check** 세션이고, 그 CRITICAL 은 EIA payload drift ·
WARNING 은 `failRetryExecution` `cancelledBy` 와 WS flat/nested 였다. **자매-커버리지
지적은 거기 없다.** 그 지적은 `17_15_21` requirement WARNING 1 단독이다.

`(ai-review \`14_18_42\` → \`17_15_21\` 연속 지적)` → `(ai-review \`17_15_21\` requirement
WARNING 1)` 로 정정했다.

> 내가 "반복된 결함 계열" 이라고 느낀 것은 사실이지만, 그 근거를 **세션 ID 두 개로
> 구체화하면서 확인하지 않았다.** 느낌은 맞고 인용은 틀린 형태 — 근거를 적을 때
> 실제로 열어 보지 않으면 이렇게 된다.

## INFO #6 — 타입 좁히기 검증 주체 오귀속 (testing)

**조치 완료.** 이건 이 저장소가 반복해 걸린 함정과 같은 형태라 넘기지 않았다 —
`vitest run`/`ts-jest` 는 타입을 strip 하므로 **타입 테스트가 no-op 이 될 수 있다.**
주석을 "여기서 확인하는 건 런타임 접근이고, `asserts` 좁히기의 컴파일 검증은
`tsc --noEmit` / typecheck-ratchet CI job 몫" 으로 명확화했다.

## INFO #8·#7 — 정규식 사각지대와 `FILES` 범위 (testing)

**조치 완료(주석화).** `let` 선언 · 구조분해(`const [row] = await …`) · 체이닝 형태는
`CONSUMING_QUERY` 에 안 잡혀 **GREEN 을 유지한 채 지나간다**. `FILES` 도 이 PR 이 손댄
2개로 한정돼 backend 전역 감사가 아니다.

정규식을 넓히지 않고 **사각지대를 명시**했다 — 이 가드는 완전한 증명이 아니라 가장 흔한
형태의 재발을 막는 그물이고, 넓히려면 정규식이 아니라 AST 가 맞다. 무언가를 조용히
덜 잡는 것과, 덜 잡는다고 적어 두는 것은 다르다. `integration-oauth.service.ts` 등
유사 소비 지점의 전역 감사는 별건이다(§후속).

## 수렴 판정 — 여기서 리뷰 루프를 닫는다

라운드별 발견의 **성격**:

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| `14_01_46` | 0 | — | fixture 중복 등 |
| `17_15_21` | 0 | 2 | **동작** — 자매 미적용(그중 하나 fail-open), routing 미해제 |
| `18_00_11` | 0 | 1 | **구조** — boilerplate 중복 |
| `18_19_33` | 0 | 1 | **문서** — 주석의 세션 인용 오류 |

동작 → 구조 → 문서로 단조 하강했고, 이번 라운드의 유일한 WARNING 은 **주석 한 줄의
인용 오류**다. 프로덕션 로직 발견은 0이다. 이 저장소가 기록해 둔 판정 기준
("Critical 0 + 코드 발견 0 이면 doc-루프 금지")에 정확히 해당하므로, 이 정정을 마지막으로
push 한다. 5라운드째를 돌리면 다시 주석 문구에 대한 지적이 나올 뿐이다.

**남은 INFO 는 전부 근거를 적어 넘긴다** — 유예를 "나중에" 로 미루지 않고 아래에 처분을 남긴다.

## 검증

- `assert-row-array.spec.ts` 8 passed, `eslint` clean (이번 변경은 주석 3곳뿐 —
  테스트 로직·프로덕션 코드 무변경이라 앞 라운드의 뮤테이션 6/6 결과가 그대로 유효하다)

## INFO 처분

| # | 처분 |
|---|---|
| 6, 7, 8 | **조치**(위) |
| 1 | 조치 불요 — `GlobalExceptionFilter` 가 마스킹. 내부 진단 Error 를 규율하는 규약 자체가 없고, 만들려면 `error-codes.md` 신설이라 별건 |
| 2 | 조치 불요 — 메시지 문구 통일은 의도. 문자열 매칭 모니터링 규칙은 **확인된 바 없다**(리뷰어도 "확인된 규칙 없음" 이라 적음) |
| 3 | 조치 불요 — `readFileSync` 로 소스를 읽는 건 이 가드의 설계다. 파일 이동 시 `ENOENT` 로 실패하는 것도 **알려주는 실패**라 문제 아님 |
| 4, 5, 10 | 직전 라운드들이 이미 의식적으로 유예. 뒤집을 새 근거 없음 |
| 9 | 조치 불요 — 이번 diff 가 만든 위험이 아니다. `updateExecutionStatus` else 분기의 트랜잭션화는 별건(§후속) |

## 후속 (별건 등재 대상)

- `integration-oauth.service.ts` `consumeOAuthState` 등 **backend 전역** raw-query 소비
  지점 감사 — 이번 가드의 `FILES` 는 2파일 한정 (`18_19_33` testing INFO 7)
- `updateExecutionStatus` else 분기의 트랜잭션화 (`18_19_33` concurrency INFO 9)
- `chat-channel.dispatcher.spec.ts` 캐스트 4곳 타입 별칭 통합 (`18_19_33` maintainability INFO 5)
