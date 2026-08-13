# 요구사항(Requirement) 코드 리뷰 — 세션 `19_08_48`

## 대상 및 방법

이 changeset 은 이미 `14_01_46` → `17_15_21` → `18_00_11` → `18_19_33` → `18_38_10`(code
review) + `14_18_42` → `17_05_10` → `18_50_06`(consistency-check) 8 라운드를 거친 상태다.
prompt 는 대부분(94개 파일 중 86개) 그 8 라운드의 `review/**` 산출물(RESOLUTION/SUMMARY/
개별 reviewer md/meta.json/_retry_state.json)이며, 실질 소스 변경은 backend 8파일
(`common/utils/assert-row-array.{ts,spec.ts}` 신규, `execution-engine.service.ts`,
`executions.service.ts`, 관련 `*.spec.ts` 4개)과 plan 문서 2건뿐이다.

prompt 예산 초과로 여러 diff/전체 파일 컨텍스트가 생략됐으므로, 워크트리에서 직접 검증했다:

- 8개 소스 파일을 `Read`로 열어 line-level 대조 (`assertRowArray` 4개 호출부 전부 — admission
  UPDATE, `lockNonTerminalExecutionRow`, `updateExecutionStatus`, `computeChainDepth`)
- `git log --oneline`으로 마지막 라운드(`18_38_10`) 이후 신규 커밋 확인 → `ef4ff8d5d`
  (`fix(engine): throw 의 근거가 틀렸다 — attempts:1 이라 재배달은 없다`) 1건이 이번 세션
  기준 신규였다. 이 커밋 diff를 직접 열어 (a) `execution-engine.service.ts` 주석 정정
  (b) `chat-channel.dispatcher.spec.ts` 스타일 리팩터(rename/wrapper 제거/캐스트 통합) 임을
  확인 — 둘 다 **동작 변경이 아니다**.
- `attempts: 1` 주장을 `execution-run.queue.ts`에서 직접 확인(line 75) — 정정된 주석이 사실과
  일치한다.
- `assert-row-array.spec.ts`의 "자매 지점 전수" 회귀 테스트가 고정한 카운트(engine
  queries:3/guards:3, executions queries:1/guards:1)를 실제 정규식으로 Node에서 재실행해
  현재 소스와 정확히 일치함을 확인.
- 관련 5개 spec 스위트를 직접 실행 — **535 passed**, `eslint --max-warnings 0` 클린,
  `tsc --noEmit` **199**(기존 baseline과 동일, 회귀 없음).
- `spec/5-system/13-replay-rerun.md` §RR-PL-05를 열어 chain 깊이 32 상수·에러 코드 표를
  코드와 대조.

## 기능 완전성

- `assertRowArray(rows, detail): asserts rows is unknown[]`가 raw SQL `.query()` 반환값을
  소비하는 4개 지점 전부에 배선돼 있고, 판정 로직(성공/실패 기준) 자체는 변경 없이 "배열이
  아니면 즉시 throw"만 추가한다 — 헬퍼의 이름·시그니처·구현이 정확히 일치.
- `computeChainDepth`의 가드는 실질적 비즈니스 규칙(RR-PL-05, 체인 깊이 32 제한)을 보호한다:
  가드 이전엔 드라이버가 배열이 아닌 값을 반환하면 `rows[0]?.depth ?? 1`로 조용히 depth 1이
  되어 `depth >= RERUN_CHAIN_DEPTH_LIMIT` 검사를 통과했다(fail-open). 이번 가드로 이 경로가
  닫혔다. `executions-rerun.service.spec.ts` 신규 테스트가 "가드를 지우면 실제로
  `engine.execute`가 호출된다"(=제한이 우회된다)를 직접 확인해 GREEN이 우연이 아님을
  스스로 증명한다.
- `runExecutionFromQueue`의 admission `try/catch`는 throw 시 `releaseExecutionRouting`
  후 재전파해, 기존 `deferred` arm과의 release 비대칭(`17_15_21` WARNING 2)을 해소한다.
  최신 커밋(`ef4ff8d5d`)은 이 경로의 "왜 삼키지 않고 재전파하는가" 주석을 재검증했다 —
  이전 라운드 주석("BullMQ 재배달로 자가 치유")이 `attempts: 1`(재배달 없음, stalled 카운터와
  무관)을 놓친 오서술이었음을 발견해 실제 근거(`removeOnFail: false`로 DLQ 관측 보존, 노드
  미실행 단계라 재전파해도 이중 실행 위험 없음)로 교체했다 — **동작은 그대로**이고 주석만
  사실에 맞게 고쳤다. `execution-run.queue.ts`에서 `attempts: 1`을 직접 확인해 새 주석이
  정확함을 검증했다.

## 엣지 케이스

- 빈 배열(`[]`)은 통과(0행은 정상), `undefined`/`null`/객체/숫자/문자열 5종 비배열은 전부
  throw + 호출부 `detail` 컨텍스트를 메시지에 포함 — `it.each`로 고정, 직접 실행해 확인.
- `lockNonTerminalExecutionRow`는 이미 fail-closed(비배열 시 `.length` undefined → `> 0`
  false)였던 지점이라 가드는 판정을 바꾸지 않고 진단(조용한 중단 vs 진짜 중단 구분)만
  추가 — 목적과 구현이 일치.
- `updateExecutionStatus`는 애플리케이션 트랜잭션 **밖**의 단발 UPDATE라 throw해도 이미
  커밋된 UPDATE를 되돌릴 수 없다는 사실이 코드 주석(가드 바로 위)과 plan 후속 항목
  양쪽에 정직하게 기록돼 있다 — 트랜잭션 경계와 가드 배치를 직접 대조해 주석이 정확함을
  확인했다.

## TODO/FIXME

`assert-row-array.{ts,spec.ts}`, `execution-engine.service.ts`/`executions.service.ts`의
diff 구간, 관련 spec 파일에 TODO/FIXME/HACK/XXX 없음(grep 확인). plan 문서 후속 항목
(backend 전역 raw-query 감사, `CONSUMING_QUERY` 정규식 사각지대, `updateExecutionStatus`
트랜잭션화)은 `[ ]`로 정직하게 미완료 표시돼 있어 은폐된 미완성이 아니다. `chat-channel.
dispatcher.spec.ts` 스타일 4건은 이번 최신 커밋(`ef4ff8d5d`)에서 전부 `[x]`로 실제 반영됨을
diff로 직접 확인했다(JSDoc 재배치, pass-through 래퍼 제거, naming 통일, 캐스트 4곳→
`callHandle` 헬퍼 1곳).

## 반환값 / 에러 시나리오

- `assertRowArray`는 성공 시 `void`(타입 좁히기만), 실패 시 항상 throw — 시그니처와 구현이
  일치.
- `computeChainDepth`가 throw하면 `reRun()` HTTP 경로까지 예외가 전파돼 `GlobalExceptionFilter`
  가 일반 `Error`를 500(`"An unexpected error occurred..."`)으로 마스킹한다(직접 확인,
  `http-exception.filter.ts` line 40). 즉 "드라이버가 계약을 어겨 depth 판정이 불가능한"
  극단적 상황은 정상적인 `RERUN_CHAIN_DEPTH_EXCEEDED`(409) 대신 500이 된다 — 이는 "조용한
  제한 우회"를 "시끄러운 실패"로 바꾸는 의도된 트레이드오프이며(plan에 "그게 의도다" 로
  명시), 실제 pg 드라이버가 파라미터 쿼리에서 배열이 아닌 값을 반환하는 것은 사실상
  불가능한 경로라 위험도는 낮다. 새로운 발견은 아니다(과거 라운드가 이미 INFO로 처리).

## 관련 spec 본문 일치 여부 (spec fidelity)

- `spec/5-system/13-replay-rerun.md` §RR-PL-05(체인 깊이 32 제한, 에러 코드
  `RERUN_CHAIN_DEPTH_EXCEEDED`/409)와 `executions.service.ts`의 `RERUN_CHAIN_DEPTH_LIMIT = 32`
  + `depth >= RERUN_CHAIN_DEPTH_LIMIT` 비교가 line-level로 일치한다. 이번 diff는 이 규칙
  자체를 바꾸지 않고, 규칙이 조용히 우회될 수 있던 경로만 닫는다.
- spec 문서(`spec/**`)는 이 구간에서 변경되지 않았다(`git diff origin/main...HEAD --stat --
  spec/` 재확인 결과 0건) — 순수 내부 구현 하드닝이라 spec 갱신 의무를 트리거하지 않는다.
  SPEC-DRIFT 아님.
- `assertRowArray`가 던지는 `Error`는 `spec/conventions/error-codes.md`가 규율하는 REST
  응답 봉투(`error.code`) 축 밖의 내부 진단 예외이고, `updateExecutionStatus`/`admission`/
  `lockNonTerminalExecutionRow`는 BullMQ consumer 경로에서만 발생해 HTTP 경계에 닿지
  않는다. `computeChainDepth`만 `reRun()` 경유로 HTTP 경계에 닿지만 `GlobalExceptionFilter`
  가 일괄 마스킹하므로 구조화된 에러 코드 규약 위반은 아니다.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** `computeChainDepth`가 assertRowArray 실패 시 `RERUN_CHAIN_DEPTH_EXCEEDED`(409)
  대신 마스킹된 500을 반환한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`computeChainDepth`,
    `assertRowArray(rows, ...)` 호출부 — `grep -n assertRowArray` 결과 라인 325)
  - 상세: 정상적인 "체인 깊이 초과" 거부(409)와, "드라이버가 배열을 안 돌려줘 깊이 판정 자체가
    불가능"한 상황(500)은 사용자 입장에서 둘 다 "재실행 실패"로 보이지만 원인·재시도 가능성
    정보가 다르다. 이미 plan에 "그게 의도다"로 명시돼 있고, 실제 도달 가능성이 pg 드라이버
    계약 위반이라는 사실상 불가능한 조건에 한정돼 위험도는 낮다.
  - 제안: 조치 불요(과거 라운드가 이미 같은 판단, 재확인만). 후속으로 이 경로를 더 진단
    가능한 구조화 에러로 노출할지는 별건으로 plan에 이미 등재돼 있다.

## 요약

`19_08_48` 세션 기준으로 이 changeset의 실질 코드는 8라운드 리뷰를 거치며 이미 수렴했다
(동작→구조→문서→절차 순으로 발견 성격이 단조 하강, 프로덕션 로직 발견은 4라운드 연속 0).
`18_38_10` 이후 유일한 신규 커밋(`ef4ff8d5d`)은 (1) admission catch 주석의 "BullMQ 재배달로
자가 치유" 서술이 `attempts: 1`(재배달 없음)을 놓친 오서술이었다는 점을 발견해 사실에 맞게
정정하고, (2) 4라운드째 유예됐던 `chat-channel.dispatcher.spec.ts` 스타일 4건(JSDoc 위치,
pass-through 래퍼, 네이밍, 캐스트 중복)을 실제로 정리한 것으로, 두 변경 모두 **동작을
바꾸지 않는다** — `execution-run.queue.ts`의 `attempts: 1`을 직접 확인해 정정된 주석이
사실과 일치함을, diff를 직접 열어 스타일 리팩터가 기계적 치환뿐임을 검증했다. 관련 5개 spec
스위트(535 tests)를 직접 실행해 GREEN을 확인했고, `assertRowArray` 배선 카운트(3/3, 1/1)를
독립적으로 재계산해 구조적 회귀 테스트의 주장과 일치함을 확인했다. `RR-PL-05`(체인 깊이 32
제한) spec 본문과 코드가 line-level로 정합하며, spec 자체는 변경되지 않아 SPEC-DRIFT도
없다. TODO/FIXME류 미완성 표식은 없고 남은 후속 백로그는 plan에 정직하게 미완료로 남아
있다. 신규 CRITICAL/WARNING 급 요구사항 결함을 발견하지 못했다.

## 위험도

NONE
