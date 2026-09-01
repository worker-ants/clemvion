# RESOLUTION — retry/ie 잔여(C-4) 리뷰 1라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **5** · INFO 11

WARNING 5건을 **전부 조치**했다. 셋(W1·W2·W3)은 **이 changeset 이 만든 것**이고, 성격이 같다 —
내가 넣은 것이 실제로 제자리에 있는지·물리는지를 확인하지 않았다.

## W1 — JSDoc 을 원래 함수에서 떼어놨다 (이 세션 3번째)

`markSpawnedRowFailed`·`prepareSuccessTermination` 을 삽입하면서 앵커를
`private async completeRetryExecution(` **선언 줄**로 잡았다. 그 결과 새 헬퍼가 JSDoc **아래**·
함수 **위**에 들어가, 21줄짜리 `@internal` 계약 문서가 전혀 다른 함수(FAILED 마킹)에 얹혔다.
documentation·maintainability·scope **3명이 독립적으로** 지적했다.

JSDoc 블록을 실제 선언 바로 위로 옮겼다. 두 신규 헬퍼는 각자 올바른 JSDoc 을 갖고 있어 그대로 뒀다.

**같은 실수를 이 세션에서 세 번째 한다** (`#1259` 에서 같은 파일에 두 번). 원인이 매번 같다 —
**선언 줄을 앵커로 잡으면 그 위의 문서 블록이 보이지 않는다.** 삽입 앵커는 선언이 아니라
**문서 블록의 시작**이어야 한다.

## W2·W3 — 내가 추가한 관측이 테스트로 안 물려 있었다

이 PR 의 요지 중 하나가 "버려지던 신호를 관측 가능하게" 인데, 정작 그 관측 두 개가 **지워져도
초록**이었다. 커밋 메시지에는 "관측한다" 고 적으면서 그것이 사라져도 아무도 모르는 상태를
남긴 셈이다.

| # | 대상 | 조치 | 뮤턴트 |
|---|---|---|---|
| W2 | `executeSync` timeout 의 `logger.warn` | 전제(0행 매칭)는 이미 세팅돼 있던 기존 테스트에 spy 단언 추가 | M9 warn 블록 제거 → **RED** |
| W3 | `assertLinkedTransitionApplied` 의 `logger.error` | 페이로드(짝 row id · 원본 에러)를 단언 | M10 로그에서 `nodeExec.id` 제거 → **RED** |

W3 은 페이로드까지 무는 것이 중요하다 — 예외를 흡수했으니 **로그가 유일한 신호**이고,
"어딘가 실패했다" 까지만 알고 대상을 모르면 조사를 시작할 수 없다.

## W4 — 내 타입 수정이 남의 문서를 거짓으로 만들었다

`Execution.error` 를 `| null` 로 넓히자, `executions.service.ts` 의 JSDoc 두 곳이 근거로 삼던
*"엔티티는 이 셋을 `| null` 없이 선언한다"* 가 `error` 에 한해 거짓이 됐다. 기능 영향은 없지만
다음 사람이 **틀린 전제로 판단**한다.

세 필드를 뭉뚱그리던 서술에서 `error` 만 갈라 정정했다 — `inputData`/`outputData` 는 여전히
넓히는 대상이므로 그 논지는 그대로 유효하고, 그 사실도 함께 적었다.

## W5 — CHANGELOG 누락

같은 성격의 선행 커밋 4건이 모두 CHANGELOG 항목을 남긴 관행과 어긋났다. 사용자 관측 가능한
행동 변화 3건(성공 retry 의 옛 error 잔류 · 중복 spawn 가드 무방비 · 취소의 FAILED 오분류)을
`## Unreleased` 에 추가했다.

## 부수 — lint 를 좁게 확인했다

W1~W5 조치 후 `prettier --check` 를 **`executions.service.ts` 한 파일에만** 돌리고 넘어갔다.
편집한 파일은 여덟이었고, lint 스테이지가 다른 파일에서 3건을 잡았다. 검증 명령의 범위가
내 주장("포맷 확인함")보다 좁았던 것 — 이 세션에서 반복된 클래스다. 전 파일에 `--write` 후
스테이지 재실행으로 PASS.

## INFO 11건

미조치. 성격별로:

- **이미 plan 에 등재된 이월** (INFO 3·7·8): `markExecutionFailed` 공용 헬퍼 승격 ·
  mock-캡처 중복(W6 백로그) · 실 Postgres 미검증(e2e 인프라). 전부 §C-4 처분 표에 사유가 있다.
- **의도·수용된 트레이드오프** (INFO 4·5): 마킹 실패 흡수가 짝 row 를 non-terminal 로 남길 수
  있다는 것, catch 가 DB 예외와 프로그래밍 오류를 구분하지 않는다는 것. 전자는 plan 이 명시
  수용했고(감사 로그 실패와 같은 판단), 후자는 범위를 좁히는 후속 리팩터 대상이다.
- **구조적 관찰** (INFO 2): `finalizeGuarded` 의 output-parameter 패턴을 JSDoc 으로 고정한 것이
  안티패턴을 **문서화해 굳혔다**는 지적. 타당하다 — 다만 이번 항목의 범위는 "시그니처가
  부수효과를 안 드러낸다" 였고, 순수 반환형 전환은 되쓰기 소비처까지 함께 설계해야 한다.
  그 스코프를 INFO 3 의 공용 헬퍼 승격과 묶으라는 리뷰어 제안을 plan 에 반영할 후보로 남긴다.
- **확인 목적** (INFO 1·6·9·10·11): 신규 위험 없음 / 개선 확인 / spec 회색지대 / 마이그레이션
  불요 / `@param` 태그 사소 누락.

## 검증

lint(`--max-warnings 0`) **PASS** · prettier(편집 8파일 전수) ·
backend **442 suites / 9218 passed, 1 skipped** · execution-engine **42 suites / 1185** ·
docs 가드 **3120** · e2e **342**(backend 291 + playwright 51).
