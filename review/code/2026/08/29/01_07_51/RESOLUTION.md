# RESOLUTION — 01_07_51

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 문서(주석) | 본 커밋 | `expression-resolver.service.spec.ts` 의 C2 서술에서 §6.3.1 원문의 한정어("**민감** 정보")가 떨어져 "message·name 밖 속성이 없다" 로 과잉 일반화됐다. 지적이 옳다 — 실측으로 확인(아래). 형제 파일 문구로 맞췄다 |
| #1 확장 | 문서(주석) | 본 커밋 | **리뷰가 지목하지 않은 자매 2곳**(`code.handler.ts` · `code.handler.spec.ts`)이 같은 형태였다. 전수로 세어 3곳 다 고쳤다 |
| (리뷰 밖) | 문서(주석) 정정 | 본 커밋 | C2 실측 중 **내가 앞선 턴에 쓴 확신 주석이 반증됐다** — "isolate 경계 때문에 host `Error` 를 상속하지 않는다" 는 거짓이고 원인은 Jest 의 realm 이다. 주석 2곳 + plan 1곳 정정 |
| INFO #4 | 문서(주석) | 본 커밋 | `secret-resolver.service.ts` 에 "C1 이 거짓이므로 C2 는 판정 불요" 한 줄 추가 — 형제 3곳과 형식이 다른 이유를 그 자리에 남겼다 |
| INFO #1 · #2 | 후속 등재 | — | `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 열린 항목으로 등재 (§수렴 예외 — 아래) |
| INFO #3 · #5 · #6 | 무조치 | — | #3(포인터 5곳 반복)은 리뷰 자신이 "지금 규모에서는 조치 불필요" 로 판정, #5·#6 은 확인 기록 |

## Warning #1 — 지적이 맞았다 (실측)

§6.3.1 의 C2 원문은 "`err` 가 message·name **밖의 민감 정보를 속성으로** 들고 있지
않다" 인데, 주석 3곳이 한정어를 떨어뜨려 "밖 속성이 없다" 로 적고 있었다. 두 경로의
실제 own property 를 재 봤다:

| 경로 | 부가 own property (실측 2026-08-29) | 민감한가 |
|---|---|---|
| `ExpressionError` (`packages/expression-engine/src/errors.ts`) | `code`(ErrorCode enum) · `position`(정수 오프셋) | 아니오 |
| `isolated-vm` 컴파일 예외 | `message` · `stack` 뿐 (표준 shape) | 아니오 |

즉 **결론(부착해도 안전)은 유효하지만 문장은 문자 그대로 거짓**이었다. 이 PR 자체가
"요약이 정본과 갈리는 문제" 를 없애려는 것이라, 같은 결함을 새로 만든 셈이다. 리뷰가
지목한 것은 `expression-resolver.service.spec.ts` 1곳이지만 자매를 전수로 세어
`code.handler.ts` · `code.handler.spec.ts` 도 같은 형태임을 확인하고 3곳을 고쳤다.

## 리뷰 밖 정정 — realm 귀속이 틀렸다

C2 를 실측하다 앞선 턴에 내가 쓴 다른 주장이 반증됐다. 옛 주석은
`code.handler.spec.ts` 가 `toBeInstanceOf(Error)` 대신 `toBeDefined` 를 쓰는 이유를
"`isolated-vm` 이 **자기 realm** 에서 만든 `SyntaxError` 라 호스트 `Error.prototype` 을
상속하지 않는다" 로 설명했다. 판별 프로브(host realm vs `vm.createContext` realm):

```
host: err instanceof Error = true      ← 평범한 node = 프로덕션과 같은 조건
sandbox: err instanceof Error = false  ← vm context = Jest 가 테스트 파일을 돌리는 realm
```

네이티브 애드온은 **메인 realm** 의 `Error` 로 만든다. `instanceof` 를 깨는 경계는
isolate 가 아니라 **Jest 의 vm 샌드박스**다 — 프로덕션 코드에서는 `instanceof Error` 가
성립한다. 형제 `expression-resolver` 케이스가 통과하는 이유도 다시 쓸 수 있다:
`ExpressionError` 는 Jest 가 적재한 JS 코드가 만들어 **같은 샌드박스 realm** 이기 때문이다.

"두 곳의 단언 형태가 다르고 통일하면 안 된다" 는 결론은 그대로지만 근거가 바뀌었으므로,
그 귀속을 옮겨 적은 주석 2곳과 plan 의 "부수 발견" 줄을 함께 정정했다(취소선 + 정정).

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260829-012213.log`, 51s)
- unit  : 통과 (`_test_logs/unit-20260829-012310.log`, 71s — `cmd_unit` 이 `pnpm --filter backend test` 를 포함하므로 편집한 두 spec 파일이 실제로 돌았다)
- build : 통과 (`_test_logs/build-20260829-012435.log`, 140s)
- e2e   : 면제 — `PROJECT.md §e2e 면제 화이트리스트` 의 "주석 전용 변경 (코드 라인 0줄, 주석/공백/포맷만)".
  **부분집합 판정 실측**: 이번 변경 set 전체에 대해
  `git diff -U0 | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*//' | grep -vE '^[+-][[:space:]]*$'`
  가 **출력 0줄** — 추가·삭제된 모든 줄이 `//` 주석이거나 빈 줄이다. 직전 e2e 통과
  (`8b92546f5`, 285/285) 이후의 델타가 이 주석 전용 변경뿐이다.

## 보류·후속 항목

INFO #1 · #2 를 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 열린 체크박스로
등재했다. developer SKILL **§수렴 예외** (a)(b)(c)(d) 를 근거로 든다:

- (a) **동작 결함이 아니다.** 두 항목 다 오늘 재현되는 오동작이 없다 — #1 은 커버리지
  갭(주석이 말하는 C2 를 아무도 단언하지 않음), #2 는 "저장소에 `.cause` 소비자가 없다"
  는 **전역 부재** 불변식의 계측 지점 부재다. 부재 자체는 `security` reviewer 가 grep 으로
  직접 확인했다. 발견의 성격이 동작 → 구조 → **문서/커버리지**로 이동했다.
- (b) **fix 가 새 라운드를 강제한다.** #1 은 `expression-resolver.service.spec.ts`(spec
  frontmatter `code:` 에 걸리는 spec-linked 파일)를 건드리므로 방금 통과한 `/ai-review` 와
  이어서 준비할 `--impl-done` 이 freshness 비교에서 동시에 무효가 된다. #2 는 아예
  `GlobalExceptionFilter` 라는 **다른 표면**을 여는 작업이라 이 PR 의 범위 밖이다.
- (c) 등재 사유는 "비용" 이 아니라 "수렴" 이다 — 이 문단이 그 근거이고, plan 항목도
  같은 조항을 인용한다.
- (d) 등재는 **이 턴에** 했다. 기존 §2 항목에 추가가 아니라 그 자리를 **갱신**했다.
