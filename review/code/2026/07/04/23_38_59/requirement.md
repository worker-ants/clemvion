# 요구사항(Requirement) 리뷰 — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 검토 방법

payload(`_prompts/requirement.md`)는 실제 변경 파일(execution-limits.ts/.spec.ts,
execution-run.queue.ts/.spec.ts, execution-run.processor.ts,
system-status.constants.ts, plan 2건, review/consistency 산출물 8건)을 정확히
포함하고 있어 mis-scope 가 아니었다(`git diff origin/main...HEAD --stat` 로 대조
확인, 16개 파일 일치). 따라서 fallback 없이 payload 원본으로 검토했다. 추가로
worktree 실물 코드(`Read`)·spec 원문(`Grep`)·유닛테스트 실행(`jest`)·lint
(`eslint`)로 교차검증했다.

## 배경 확인

- ARCH#4: `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
  를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 이관.
- ARCH#6: `execution-limits.ts` 모듈 JSDoc 을 PR2a 한정 서술 → §8+§11 모듈 경계 서술로 확장.
- MAINT#9: `system-status.constants.ts` 의 `continuationConcurrency` 계산을
  inline loose `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 에서
  canonical strict `resolveContinuationWorkerConcurrency()` 재사용으로 교체.
- 계획 문서(`plan/in-progress/exec-limits-refactor.md`)는 "전부 동작 보존 —
  MAINT#9 만 문서화된 strict 계약으로 정합" 을 명시.

## 발견사항

- **[INFO]** 이관 함수 바이트 동일성 — 확인 완료, 회귀 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:102-122`
    vs `git show origin/main:.../queues/execution-run.queue.ts` 구 정의(L100-120)
  - 상세: `resolveExecutionRunWorkerConcurrency` 본문·`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
    값(1)·정규식 선검증(`^\d+$`)·`Number.isInteger && >0` 가드가 문자 그대로 동일함을
    직접 diff 로 확인. 순수 함수 재배치이며 로직 변경 없음 — "이관 함수 동일성" 요구
    충족.
  - 제안: 없음(정상).

- **[INFO]** 단일 SoT 유지, 재-export 배럴 없음 — 확인 완료
  - 위치: `queues/execution-run.queue.ts:99-100` (구 정의 자리에 주석만 남김),
    `execution-run.processor.ts:11`, `system-status.constants.ts:7,51`
  - 상세: `grep -rn resolveExecutionRunWorkerConcurrency codebase/backend/src`
    결과 정의는 `execution-limits.ts` 1곳뿐이고, 소비처(processor·system-status)는
    모두 새 경로로 import 갱신됨. 이중 정의·죽은 re-export 없음.
  - 제안: 없음.

- **[INFO]** MAINT#9 — spec §11 이 문서화한 strict 계약과 코드의 line-level 일치
  - 위치: `spec/5-system/4-execution-engine.md:1245` (`CONTINUATION_WORKER_CONCURRENCY`
    행: "비양수·비정수·비숫자 입력은 1 로 fallback"), `1246`(`EXECUTION_RUN_WORKER_CONCURRENCY`
    행: "`CONTINUATION_WORKER_CONCURRENCY` 패턴 준용"); 코드
    `system-status.constants.ts:51` (`resolveExecutionRunWorkerConcurrency()`,
    ARCH#4 이관 전부터 canonical 이미 사용) / `:53`(신규 `resolveContinuationWorkerConcurrency()`).
  - 상세: 이관 전 `continuationConcurrency`는 `Number(env) || 1`로 계산돼
    `"1e10"`(공학표기)·`"2.5"`(소수)·`"-1"`(음수, `-1 || 1`→`-1`) 입력에서 spec
    문서 계약과 실제로 어긋났다(코드가 spec 보다 loose). 이번 변경은 그 갭을
    해소하는 방향 — spec 이 옳고 과거 코드가 정합하지 않았던 상태를 코드로
    맞춘 정상적인 conformance fix 다(spec 자체 수정 불요, `spec_impact: none`
    과 일치).
  - 검증: `continuation-execution.queue.spec.ts`(既存, 미변경)에 `1e10`·`2.5`·
    `-2`·`abc`·`0`·`0x10`·공백 케이스가 이미 모두 `1` 로 fallback 함을 커버하는
    `it.each` 테스트가 존재. `jest` 로 4개 관련 스펙 파일(execution-limits,
    execution-run.queue, system-status.constants, continuation-execution.queue)
    실행 결과 39/39 통과, 회귀 없음.
  - 제안: 없음(정상 동작, "코드가 spec 을 따라잡음" 케이스이지 SPEC-DRIFT 아님 —
    spec 이 이미 정확했고 코드가 늦게 정합된 경우이므로 재분류 불필요).

- **[INFO]** ARCH#6 JSDoc 확장 — spec §8/§11 인용과 실제 export 목록 일치
  - 위치: `execution-limits.ts:1-18`
  - 상세: 확장된 모듈 JSDoc 이 열거한 4개 resolve* 함수(`resolveMaxActiveRunningMs`,
    `resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs`,
    `resolveExecutionRunWorkerConcurrency`)가 실제 파일의 export 전체와 정확히
    일치(누락·초과 없음). "SoT: spec/5-system/4-execution-engine.md §8·§11" 인용도
    각 함수 설명에 대응하는 절 번호와 부합.
  - 제안: 없음.

- **[INFO]** 소비처 주석 정합성 — `execution-engine.service.ts` 내 함수명 참조는
  경로 무관이라 이관 후에도 유효
  - 위치: `execution-engine.service.ts:679-685`
  - 상세: 해당 주석은 `resolveExecutionRunWorkerConcurrency` 를 함수명으로만
    언급(경로 언급 없음) — 이관 후에도 참조가 깨지지 않는다. `spec/data-flow/3-execution.md:116`
    의 `execution-limits.ts` 언급은 `EXECUTION_MAX_ACTIVE_RUNNING_MS`/
    `resolveMaxActiveRunningMs` 전용 문맥이라 이번 이관 대상과 무관 — 갱신 불요.
  - 제안: 없음.

- **[INFO]** plan 체크리스트 — "관측 회귀 테스트" 항목은 신규 테스트 불필요로
  이미 충족(delegate)
  - 위치: `plan/in-progress/exec-limits-refactor.md` 체크리스트
    "MAINT#9 strict 파싱은 기존 resolveContinuationWorkerConcurrency own-spec 이
    커버(delegate)"
  - 상세: 실제로 `continuation-execution.queue.spec.ts`가 이미 해당 strict
    fallback 계약(edge case 전체)을 검증 중임을 확인했고(위 항목 참조),
    `system-status.constants.ts` 자체에는 이 계산의 edge-case 전용 유닛 테스트가
    없으나 순수 delegate(`const continuationConcurrency = resolveContinuationWorkerConcurrency();`)
    라 own-spec 커버로 충분 — plan 의 delegate 주장은 코드 사실과 일치.
  - 제안: 없음(선택 사항 — 원한다면 `system-status.constants.spec.ts`에 "정상
    입력에서 두 concurrency 상수 값이 canonical resolver 반환값과 동일" 통합
    검증 1건 추가 가능하나, 필수는 아님).

- **[INFO]** ARCH#5 defer 정당성 — 본 PR 범위에 포함되지 않음, 스코프 밖 정확히 분리
  - 위치: `plan/in-progress/exec-limits-refactor.md` "스코프 결정" 절,
    `exec-intake-followups.md` ARCH#5 항목
  - 상세: 실제 diff 에 `error-codes.ts` 변경 없음 확인 — plan 이 선언한 분리
    스코프와 실제 변경 파일 목록이 일치.
  - 제안: 없음.

## 검증 결과 요약

- 관련 unit test 4개 스위트(`execution-limits.spec.ts`, `execution-run.queue.spec.ts`,
  `system-status.constants.spec.ts`, `continuation-execution.queue.spec.ts`) 및
  `execution-run.processor.spec.ts` 전부 통과(39+8 = 47 테스트).
- eslint 대상 4개 변경 파일 warning/error 0.
- TODO/FIXME/HACK/XXX 마커 diff 내 부재.
- 함수 시그니처·기본값·에러 fallback 규칙·env 변수명 전부 이관 전후 불변 — "동작
  보존" 주장과 실제 코드가 일치.
- MAINT#9 는 spec §11(L1246)이 명시한 "`CONTINUATION_WORKER_CONCURRENCY` 패턴
  준용" 계약과 코드를 정합화하는 것으로, spec 본문과 line-level 로 어긋나던
  과거 loose 코드가 이번 변경으로 spec 을 따라잡는 정상적 conformance fix다
  (SPEC-DRIFT 아님 — spec 이 이미 옳았음).

## 요약

ARCH#4(함수 이관)·ARCH#6(JSDoc 확장)·MAINT#9(continuation concurrency 파싱
canonical 통일) 세 항목 모두 계획대로 "동작 보존" 리팩터로 구현됐다. 이관된
`resolveExecutionRunWorkerConcurrency`는 원본과 바이트 단위로 동일하며 단일
SoT·import 갱신이 빠짐없이 이뤄졌다. MAINT#9 는 spec §11이 이미 명시한 strict
fallback 계약(비양수·비정수·비숫자→1)에 기존 loose 코드가 미달했던 상태를
canonical strict resolver 재사용으로 바로잡는 정상적인 정합화이며, 정상 입력
범위(env 미설정 또는 유효 양의 정수)에서는 반환값이 완전히 동일해 기능 회귀가
없다. 관련 유닛 테스트 전량 통과·lint 클린·TODO 부재를 확인했다. spec 본문과의
불일치·요구사항 누락·에러 경로 누락은 발견되지 않았다. Critical/Warning 없음.

## 위험도

NONE

STATUS: SUCCESS
