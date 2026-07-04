# Rationale 연속성 Check 결과

## 검토 메타

- 검토 대상 (실제): `f76237b8c refactor(06-concurrency): exec-limits 응집 (ARCH#4·6·MAINT#9)` —
  `plan/in-progress/exec-limits-refactor.md` 기준 ARCH#4(함수 이관)·ARCH#6(JSDoc 확장)·MAINT#9(파싱
  정합화) 3건, 전부 "동작 보존" 로 스코프 확정된 리팩터.
- 관련 코드: `codebase/backend/src/modules/execution-engine/execution-limits.ts`,
  `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`(+`.spec.ts`),
  `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts`,
  `codebase/backend/src/modules/system-status/system-status.constants.ts`
- 관련 spec: `spec/5-system/4-execution-engine.md`(§7.4, §8, §11 env 표),
  `spec/5-system/16-system-status-api.md`(§1~§4, Rationale R-1~R-5)
- diff-base: `origin/main...HEAD` (payload fallback 사용, 아래 참고)

**payload mis-scope**: 오케스트레이터가 작성한 `_prompts/rationale_continuity.md` (1,843줄) 는
`spec/5-system/1-auth.md`(WebAuthn/2FA/세션 등)·`10-graph-rag.md`·`0-overview.md` 등 exec-limits-refactor
와 무관한 대량 spec 덤프로만 채워져 있고, 실제 diff·target(`execution-limits.ts`/`system-status.constants.ts`/
MAINT#9/ARCH#4/ARCH#6/`resolveContinuationWorkerConcurrency`) 관련 내용이 전혀 포함되어 있지 않다(grep
0건). 이전(23_21_53) 동일 checker 실행에서도 같은 misrouting 이 보고된 바 있어 이번 세션에서도 재발한
것으로 보인다. 지시에 따라 `git -C <worktree> diff origin/main...HEAD`, `plan/in-progress/exec-limits-refactor.md`,
관련 spec·코드를 직접 읽어 분석했다. misrouting 자체는 checker 범위 밖이라 발견사항에는 포함하지 않는다.

## 실제 diff 요약

1. **ARCH#4** — `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
   (+JSDoc) 를 `queues/execution-run.queue.ts` → `execution-limits.ts` 로 순수 이관. 함수 본문·정규식
   (`^\d+$` 선검증)·상수값 무변경. import 갱신처(`execution-run.processor.ts`, `system-status.constants.ts`)
   갱신. 테스트도 `execution-run.queue.spec.ts` → `execution-limits.spec.ts` 로 이관(assertion 내용 동일).
2. **ARCH#6** — `execution-limits.ts` 파일 top JSDoc 을 "PR2a 한정" 서술에서 "모듈 전체 resolve* 파서
   응집" 서술로 확장. 코드 로직 변경 없음.
3. **MAINT#9** — `system-status.constants.ts` 의 `continuationConcurrency` 계산을 inline
   `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1`(loose) 에서 기존에 이미 존재하던
   canonical `resolveContinuationWorkerConcurrency()`(strict, `continuation-execution.queue.ts`) 재사용으로
   교체. 정상 입력(양의 정수)에는 두 경로 결과가 동일하고, 비정수·음수·공학표기·`Infinity` 등 edge
   입력에서만 결과가 달라진다(strict 는 spec §11 fallback 계약대로 `1`).

## 점검 관점별 분석

### 1. 기각된 대안의 재도입
없음. `system-status.constants.ts` 의 옛 inline loose 파싱은 spec Rationale 이 "채택"으로 확정한 대안이
아니라, spec 이 처음부터 선언한 strict 계약(§11 env 표: "비양수·비정수·비숫자 입력은 1 로 fallback")과
어긋나 있던 **사전 존재 drift**였다. MAINT#9 는 그 drift 를 이미 합의된 유일 계약(strict)에 맞추는
정합화이지, 과거에 거부된 대안을 다시 들여오는 패턴이 아니다.

### 2. 합의된 원칙 위반 여부
- `spec/5-system/4-execution-engine.md` §7.4(Worker 동시성) — "비양수·비정수·비숫자 입력은 1 로 fallback"
- 동 문서 §11 env 표(`CONTINUATION_WORKER_CONCURRENCY`, `EXECUTION_RUN_WORKER_CONCURRENCY`) — 동일
  strict 계약 반복 선언 (`EXECUTION_RUN_WORKER_CONCURRENCY` 는 "`CONTINUATION_WORKER_CONCURRENCY` 패턴
  준용"이라 명시)

세 곳 모두 strict parsing 을 SoT 로 이미 못 박고 있다. 리팩터 **이전** 코드(`system-status.constants.ts`
inline loose)가 이 원칙을 위반하고 있었고(`"2.5"`→`2.5` 채택, `"-3"`→`-3` 채택, `"1e2"`→`100` 채택 등
비정수·음수·공학표기를 그대로 수용), MAINT#9 는 이를 되돌리는 방향이 아니라 원칙 쪽으로 정렬하는
방향이다. `resolveExecutionRunWorkerConcurrency`(이관 후 `execution-limits.ts`)도 동일 정규식 선검증
패턴을 그대로 유지하며 로직 변경이 없다. 따라서 본 diff 는 원칙 위반이 아니라 원칙 완성이다.

### 3. 결정의 무근거 번복 여부
"번복"으로 볼 결정 자체가 없다. 옛 loose 파싱이 의도된 설계 결정이었다는 근거(Rationale·코드 주석·
plan 기록)가 어디에도 없고, 해당 위치의 옛 주석("continuation worker 의 concurrency 는 env 로 조정
가능(기본 1)")도 loose/strict 구분에 대한 의도적 근거를 전혀 남기지 않는다. 새 JSDoc(diff `+` 라인)은
오히려 "종전 inline `Number(env) || 1` 은 spec §11 이 문서화한 계약과 어긋나 있었다"고 drift 사실을
명시적으로 기록해 정합화 근거를 남긴다. `plan/in-progress/exec-limits-refactor.md` 의 MAINT#9 항목도
"비정수 env 의 edge 동작이 loose-accept → 문서화된 fallback(1)로 정합(계약 준수, spec §11/env 표
'비정수→1' 이미 명시)"이라고 근거를 정확히 인용한다. "결정 번복 시 새 Rationale 필요" 요건은 기존
결정을 뒤집을 때 발동하는데, 본 건은 기존 결정(spec strict 계약)을 뒤집는 게 아니라 그 결정에 맞춰
drift 를 없애는 것이라 요건이 발동하지 않는다.

### 4. 암묵적 가정 충돌 여부
- §7.4 의 invariant("재개 진입이 §7.5 DB 원자 claim 으로 gate 되어 concurrency 상향·멀티 인스턴스에서도
  '동일 turn 이중 실행 0' 이 유지되며, 이 기본값은 성능 파라미터이지 정합성 전제가 아니다")는 본 diff 와
  무관하다 — 동시성 **값**을 바꾸는 게 아니라 **비정수 입력의 파싱 결과**만 정합화하는 것이고, 정상
  운영 입력(양의 정수)에서는 loose/strict 결과가 동일해 실제 동시성 값·큐 동작이 전혀 바뀌지 않는다.
- ARCH#4 이관은 `execution-limits.ts` 가 `process.env` 만 참조하는 순수 함수 3~4종을 이미 보유한
  모듈이라는 사실과 일관되며, 순환 의존을 만들지 않는다(plan 명시, 실제 import 방향도 단방향).
- `system-status.constants.ts` 의 `concurrency` 필드는 `16-system-status-api.md` §2
  (`QueueStatusDto.concurrency`, `utilization = active/concurrency`) 계산에 쓰인다. loose 파싱이 비정수·
  음수를 그대로 반영하면 `utilization` 이 오염될 수 있는 잠재적 버그 표면이었는데, strict 통일은 오히려
  §2 계약(양의 정수 concurrency 전제)을 보호하는 방향이다 — 가정 우회가 아니라 가정 보호.

## 발견사항

없음. Rationale 연속성 관점에서 CRITICAL/WARNING 급 충돌을 발견하지 못했다.

- **[INFO]** MAINT#9 drift 재발 방지용 회고 주석 — 이미 반영됨, 확인만
  - target 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (diff 상단
    JSDoc, `MAINT#9` 명시 라인)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.4(라인 892 부근)·§11 env 표
  - 상세: 이전 세션(23_21_53 rationale_continuity)에서 "canonical resolver 재사용 — 이전 inline loose
    파싱은 spec §11 계약 미준수 drift 였음" 같은 1줄 회고를 코드 주석에 남기라고 권고했었다. 실제 diff
    확인 결과 이번 구현이 이미 그 취지의 JSDoc("종전 inline `Number(env) || 1` 은 spec §11 이 문서화한
    ... 계약과 어긋나(...) 있었다")을 반영했다.
  - 제안: 추가 조치 불필요. spec 본문 수정도 불필요 — spec 은 이미 strict 계약을 정확히 서술 중이다.

## 요약

target(`f76237b8c`, ARCH#4/ARCH#6/MAINT#9)은 `spec/5-system/4-execution-engine.md` §7.4·§11 에 이미
명시된 "비양수·비정수·비숫자 입력→1 fallback" strict 계약을 근거로 삼고 있으며, 실제 diff 확인 결과
`system-status.constants.ts` 의 옛 inline loose 파싱(`Number(x)||1`)이 오히려 이 계약을 위반하던
사전 drift였음을 재확인했다. MAINT#9 는 기각된 대안의 재도입이 아니라 기존에 이미 합의된 canonical
strict resolver 패턴(`resolveContinuationWorkerConcurrency`/`resolveExecutionRunWorkerConcurrency`)으로의
정합화(conformance fix)이고, 정상 입력(양의 정수)에서는 동작이 동일해 "동작 보존" 주장과 부합한다.
ARCH#4(함수 이관)·ARCH#6(JSDoc 확장)은 순수 코드 위치·문서 정리로 Rationale 충돌 소지가 없다. 이번
회차 payload 역시(2회 연속) 무관한 spec 대량 덤프로 mis-scope 되어 있었으나 fallback(`git diff
origin/main...HEAD`)으로 실제 diff·plan·spec 을 직접 확인해 결론의 근거를 확보했다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
