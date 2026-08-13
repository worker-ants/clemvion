# 요구사항(Requirement) 코드 리뷰

## 대상 및 방법

이번 changeset 은 이전 세 라운드(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`)가 이미 리뷰한
"backlog-final-three"(snapshotCache LRU 경계값, dispatcher 로그 레벨 분기, admission
`Array.isArray` 가드) 위에 마지막 커밋(`30112b7d4` `refactor(engine): 가드 4곳을
assertRowArray 로 + 누락 자체를 막는 회귀 테스트`, 및 그 뒤 주석 정정 커밋 2건)이 얹힌 최종
상태다. 프롬프트가 컨텍스트 예산으로 여러 diff·전체 파일 컨텍스트를 생략했으므로, 실제 소스
(`assert-row-array.ts`/`.spec.ts`, `execution-engine.service.ts`, `executions.service.ts`,
관련 `.spec.ts`)를 워크트리에서 `git diff origin/main...HEAD`/`Read`로 직접 열어 line-level
로 대조했고, 신규 헬퍼 `assertRowArray` 관련 4개 테스트 스위트(527 테스트)와 신규
`assert-row-array.spec.ts`(8 테스트)를 직접 실행해 GREEN 을 확인했다. `eslint --max-warnings 0`
도 관련 4개 소스 파일에 대해 통과를 확인했다.

## 기능 완전성 확인

- `assertRowArray(rows, detail): asserts rows is unknown[]`
  (`codebase/backend/src/common/utils/assert-row-array.ts`)가 신설되고, raw SQL `.query()`
  반환값을 소비하는 4개 지점에 정확히 배선됐다:
  `execution-engine.service.ts` `admitExecutionOrDefer`(admission UPDATE)·
  `lockNonTerminalExecutionRow`(FOR UPDATE SELECT)·`updateExecutionStatus`(guarded UPDATE),
  `executions.service.ts` `computeChainDepth`(재귀 CTE). 실제 소스를 열어 4곳 모두
  `if (!Array.isArray(rows)) throw ...` 인라인 블록이 `assertRowArray(...)` 호출로 완전히
  치환됐고, 판정 로직(무엇을 성공/실패로 볼지)은 그대로 유지됨을 확인했다 — 순수
  구조적 리팩터다.
- `assert-row-array.spec.ts` 의 "자매 지점 전수" 구조적 회귀 테스트가 주장하는 실측 카운트
  (`execution-engine.service.ts`: queries 3/guards 3, `executions.service.ts`: queries 1/guards
  1)를 실제 정규식(`CONSUMING_QUERY`)으로 Node 에서 직접 재실행해 정확히 일치함을 확인했다.
  이 가드는 "가드를 한 곳에만 적용하고 자매를 안 세는 것"이라는 이 저장소가 반복해 온 결함
  클래스를 리뷰-의존이 아니라 테스트-의존으로 구조화해 막는다 — 함수명·목적·구현이 정확히
  일치한다.
- `computeChainDepth`에서 `assertRowArray`가 없던 이전 상태의 실제 결함(배열이 아니면
  `rows[0]` undefined → `?? 1` → depth 1 → `depth >= RERUN_CHAIN_DEPTH_LIMIT` 통과 →
  RR-PL-05 체인 깊이 32 제한 우회)은 `spec/5-system/13-replay-rerun.md` §RR-PL-05, E3(체인
  깊이 32 제한)와 `executions.service.ts:47`의 `RERUN_CHAIN_DEPTH_LIMIT = 32` 상수를 대조해
  실제로 이 비즈니스 규칙을 보호하는 자리임을 확인했다. `executions-rerun.service.spec.ts`
  신규 테스트가 가드 제거 시 `reRun`이 실제로 **성공**(engine.execute 호출됨)한다고 명시해
  "GREEN 이 우연이 아님"을 스스로 검증하고 있다 — 의도와 구현이 정확히 일치한다.
- `admitExecutionOrDefer`의 가드는 트랜잭션 콜백(`manager.transaction`) 내부에서 throw 하므로
  롤백되고, `runExecutionFromQueue`의 신규 `try/catch`가 admission throw 시
  `releaseExecutionRouting` 후 재전파한다. 기존 `deferred` arm 의 release 패턴과 대칭을
  이루며, 신규 테스트(`admission 이 throw → routing release 후 그대로 재전파 + runExecution
  미호출`)가 이 대칭을 직접 고정한다 — routing context 누수라는 실제 백로그 항목(`17_15_21`
  WARNING 2)이 실제로 해소됐다.

## 엣지 케이스

- 빈 배열(`[]`)은 여전히 통과(assert 통과 후 `.length === 0`/`.length > 0` 등 정상 판정으로
  흘러감) — `assertRowArray`는 "배열인가"만 검증하고 "행이 있는가"는 호출부 판정에 맡긴다.
  `assert-row-array.spec.ts`의 `'빈 배열도 통과한다 — "0행" 은 정상 결과지 이상이 아니다'`
  테스트가 이를 명시적으로 고정했고, 실제 실행(`pnpm exec jest assert-row-array.spec.ts` →
  8 passed)으로 확인했다.
- `undefined`/`null`/객체/숫자/문자열 5종 비배열 입력에 대해 전부 던지고, 메시지에 호출부
  컨텍스트(`detail`)가 포함되는지 `it.each`로 고정 — 경계값 커버리지가 넓다.
- `lockNonTerminalExecutionRow`의 신규 테스트는 정상 배열(hit/miss)과 비배열(throw) 3가지
  분기를 모두 검증해, 가드가 정상 경로(`live.length > 0`)를 바꾸지 않음을 함께 고정한다.

## TODO/FIXME

`assert-row-array.ts`/`.spec.ts`, 그리고 변경된 `execution-engine.service.ts`/
`executions.service.ts` diff 구간에 TODO/FIXME/HACK/XXX 주석 없음(grep 확인). plan 문서
(`backend-lint-gate-broken-on-main.md`)에 명시적 후속 백로그 4건("backend 전역 raw-query 감사",
"`CONSUMING_QUERY` 정규식 사각지대", "`updateExecutionStatus` else 분기 트랜잭션화", "캐스트
리터럴 4곳 통합")이 남아 있으나, 전부 `[ ]` 미완료로 정직하게 표시돼 있고 완료로 잘못 주장하지
않는다 — 은폐된 미완성이 아니다.

## 반환값 / 에러 시나리오

- `assertRowArray`는 정상 시 `void`(narrowing만), 실패 시 항상 `throw`(반환하지 않음) — 함수
  시그니처(`asserts rows is unknown[]`)와 실제 구현이 정확히 일치한다.
- 4개 호출부 모두 실패 시 예외가 호출자까지 전파되는 경로를 실제로 추적했다: admission/lock
  두 곳은 트랜잭션 콜백 내부라 롤백 후 전파, `updateExecutionStatus`는 트랜잭션 밖이라 이미
  적용된 UPDATE 를 되돌리지 못한다는 사실이 코드 주석·plan 후속 항목 양쪽에 정직하게
  기록돼 있다 — 의도(주석)와 실제 트랜잭션 경계가 일치한다.

## 관련 spec 본문 일치 여부 (spec fidelity)

- `spec/5-system/13-replay-rerun.md` §RR-PL-05(체인 깊이 32 제한)와
  `executions.service.ts`의 `RERUN_CHAIN_DEPTH_LIMIT = 32` + `depth >= RERUN_CHAIN_DEPTH_LIMIT`
  비교가 line-level 로 일치한다. 이번 diff 는 이 규칙 자체를 바꾸지 않고, 이 규칙이 조용히
  우회될 수 있던 경로(비배열 반환 시 depth 1)를 닫는다.
- `spec/5-system/4-execution-engine.md` L1355-1356 "프로젝트의 fail-open 선례는 인프라
  가용성(Redis/DB) 시나리오 한정이고, 데이터 정합성 게이트는 fail-closed 가 원칙" Rationale과
  admission 가드의 throw(트랜잭션 롤백) 방향이 정합한다 — 코드가 spec 원칙을 정확히 따른다.
- `assertRowArray`의 에러 메시지(`raw SQL 결과가 배열이 아님 …`) 및 4개 호출부의 `Error`는
  `spec/conventions/error-codes.md`가 규율하는 REST 응답 봉투(`error.code`) 축 밖의 내부
  진단 예외이며, 이 예외들은 전부 BullMQ consumer 경로(`runExecutionFromQueue`)에서만
  발생해 HTTP 경계까지 전파되지 않는다(`GlobalExceptionFilter` 가 일반 `Error`를 마스킹) —
  이전 라운드(`17_15_21`/`18_00_11`)의 convention_compliance 검토가 이미 "적용 범위 밖"으로
  판정한 것을 재확인했다. 새 위반은 발견하지 못했다.
- spec 문서(`spec/5-system/**`) 자체는 이번 4~8개 커밋 구간에서 전혀 변경되지 않았다
  (`git diff origin/main...HEAD --stat -- spec/` = 0건, 이전 consistency-check 라운드들이
  반복 확인한 사실을 재확인). 이 리팩터는 순수 내부 구현 디테일(가드 boilerplate 추출)이라
  spec 갱신 의무를 트리거하지 않는다 — SPEC-DRIFT 아님.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 참고용 INFO 1건뿐이다.

- **[INFO]** `assertRowArray`의 asserts 타입 프레디킷이 실제로 컴파일 타임에 좁혀지는지는
  Jest(ts-jest 가 타입을 strip)로 검증되지 않는다는 사실을, 헬퍼의 spec 파일 자신이 이미
  정확히 주석으로 밝히고 있다(`assert-row-array.spec.ts:10-13`, "그 검증은
  `scripts/check-backend-typecheck-ratchet.py` 몫"). 실제로 `.github/workflows/
  backend-checks.yml`에 typecheck 단계가 존재함을 확인했다(파일 목록 확인, 전체 실행은
  시간상 생략). 이 PR 자체는 문제가 없고, 검증 계층 분리가 정확히 문서화돼 있다는 점만
  참고로 남긴다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts` (파일 상단 주석)
  - 제안: 조치 불요 — 이미 정확히 문서화됨.

## 요약

이번 changeset 은 4개 raw-SQL 소비 지점의 중복 가드를 `assertRowArray` 공용 헬퍼로 추출하고,
"가드 호출 자체가 누락되는 것"을 막는 정적 카운트 기반 구조적 회귀 테스트를 신설한 순수
리팩터다. 실제 소스를 직접 열어 4개 호출부 전부가 판정 로직 변경 없이 인라인 블록→헬퍼
호출로 1:1 치환됐음을 확인했고, 구조적 테스트가 주장하는 카운트(3/3, 1/1)를 실제 정규식으로
재실행해 검증했으며, 관련 4개 스펙 스위트(527 테스트) + 신규 헬퍼 스펙(8 테스트)이 모두
GREEN 임을 직접 실행으로 확인했다. `computeChainDepth`(RR-PL-05 체인 깊이 32 제한)와
admission 가드(spec Rationale "데이터 정합성 게이트=fail-closed")는 모두 관련 spec 본문과
line-level 로 정합한다. TODO/FIXME 류 미완성 표식은 없고, 남은 후속 백로그 4건은 plan 문서에
`[ ]`로 정직하게 남아 있어 은폐된 미완성이 아니다. CRITICAL/WARNING 급 요구사항 결함을
발견하지 못했다.

## 위험도

NONE
