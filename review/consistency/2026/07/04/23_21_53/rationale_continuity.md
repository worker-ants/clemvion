# Rationale 연속성 Check 결과

## 검토 메타

- 검토 대상 (실제): `plan/in-progress/exec-limits-refactor.md` (ARCH#4·ARCH#6·MAINT#9 — 동작 보존 리팩터), 관련 코드
  `codebase/backend/src/modules/execution-engine/execution-limits.ts`,
  `codebase/backend/src/modules/system-status/system-status.constants.ts`,
  `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`,
  `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts`
- 관련 spec: `spec/5-system/4-execution-engine.md` (§7.4, §11 env 표), `spec/5-system/16-system-status-api.md` (§1, §3, Rationale R-1~R-5)

**payload mis-scope 경고**: 오케스트레이터가 작성한 `_prompts/rationale_continuity.md` 는 `spec/5-system/1-auth.md`·`10-graph-rag.md` 등 exec-limits-refactor 와 무관한 대량 spec 덤프(1,841줄, `1-auth.md`/`graph-rag`/`0-overview` 등 다수 문서 Rationale 발췌)로 채워져 있고, 실제 target 인 `execution-limits.ts`/`system-status.constants.ts`/`MAINT#9`/`resolveContinuationWorkerConcurrency` 관련 언급이 **전혀 없다**. 지시에 따라 payload 를 신뢰하지 않고 `plan/in-progress/exec-limits-refactor.md`, `plan/in-progress/exec-intake-followups.md`, 관련 spec·코드를 직접 읽어 분석했다. 이 misrouting 자체는 별도 orchestration 이슈로 보고할 사안이나 본 checker 의 역할(Rationale 연속성) 밖이라 본문 발견사항에는 포함하지 않는다.

## 점검 관점별 분석

### 1. 기각된 대안의 재도입
`system-status.constants.ts` 의 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` (loose) 는 과거 spec Rationale 에서 "채택"으로 확정된 대안이 아니다 — 오히려 spec 자체가 처음부터 strict 계약(§11 env 표: "비양수·비정수·비숫자 입력은 1 로 fallback")만 문서화하고 있고, 이 loose 코드는 spec 이 선언한 계약과 **애초에 어긋나 있던 사전 존재 drift**다. MAINT#9 가 strict 계약을 "재도입"하는 게 아니라, 이미 성립된 유일한 계약(strict)에 코드를 맞추는 것이다. 기각된 대안을 다시 들여오는 패턴이 아니다.

### 2. 합의된 원칙 위반 여부
- `spec/5-system/4-execution-engine.md:892` (§7.4 Worker 동시성) — "비양수·비정수·비숫자 입력은 1 로 fallback"
- `spec/5-system/4-execution-engine.md:1245` (§11 env 표, `CONTINUATION_WORKER_CONCURRENCY`) — 동일 문구 반복
- `spec/5-system/4-execution-engine.md:1246` (§11 env 표, `EXECUTION_RUN_WORKER_CONCURRENCY`) — "`CONTINUATION_WORKER_CONCURRENCY` 패턴 준용"

세 곳 모두 strict parsing 을 SoT 로 명시한다. 실제 실측(Node 실행)으로 loose vs strict 차이를 확인:

| 입력 | loose (`Number(x)||1`) | strict (`resolveContinuationWorkerConcurrency`) | spec 계약 |
|---|---|---|---|
| `"2.5"` | `2.5` (비정수 채택) | `1` | 위반 사례 — loose 는 비정수를 허용 |
| `"-3"` | `-3` (음수 채택) | `1` | 위반 사례 — loose 는 비양수를 허용 |
| `"1e2"` | `100` (공학표기 채택) | `1` | 위반 사례 |
| `"Infinity"` | `Infinity` | `1` | 위반 사례 |

즉 **현재 코드(리팩터 전)가 이미 spec 의 문서화된 원칙을 위반하고 있었고**, MAINT#9 는 이를 되돌리는 게 아니라 정합화하는 방향이다. `resolveContinuationWorkerConcurrency`(continuation-execution.queue.ts:70-81)는 이미 이 strict 계약대로 구현되어 있고, `resolveExecutionRunWorkerConcurrency`(execution-run.queue.ts:109-120, 자체 JSDoc 에서 "`resolveContinuationWorkerConcurrency` 와 동일 규약" 명시)·`execution-limits.ts` 의 `resolveMaxActiveRunningMs`/`resolveQueueWaitTimeoutMs` 도 전부 동일 정규식 선검증 패턴이다. MAINT#9 는 이 기존에 이미 합의된 "canonical strict resolver" 원칙에 `system-status.constants.ts` 를 뒤늦게 정렬시키는 조치로, 원칙을 위반하는 방향이 아니라 원칙을 완성하는 방향이다.

### 3. 결정의 무근거 번복 여부
"결정 번복"으로 볼 결정 자체가 없다 — `system-status.constants.ts` 의 loose 파싱이 의도된 설계 결정이었다는 근거(Rationale, 코드 주석, plan 기록)가 어디에도 없다. 해당 라인의 코드 주석(`system-status.constants.ts:39-43`)은 "continuation worker 의 concurrency 는 env 로 조정 가능(기본 1)" 만 서술하며 loose/strict 구분에 대한 의도적 근거를 전혀 남기지 않는다. 번복이 아니라 spec 이 이미 선언한 유일 계약으로의 **최초 정합화**이므로, "새 Rationale 동반 필요" 요건(결정 번복 시에만 적용)이 발동하지 않는다. plan 문서(`exec-limits-refactor.md:21`) 자체가 "계약 준수, spec §11/env 표 '비정수→1' 이미 명시" 라고 근거를 정확히 인용하고 있어 투명성도 충분하다.

### 4. 암묵적 가정 충돌 여부
- `spec/5-system/4-execution-engine.md:892` 의 "재개 진입이 §7.5 의 DB 원자 claim 으로 gate 되므로 concurrency 상향·멀티 인스턴스에서도 '동일 turn 이중 실행 0' 불변식이 유지된다 — 이 기본값은 성능 파라미터이지 정합성 전제가 아니다" 라는 invariant 는 MAINT#9 와 무관하다 (동시성 **값** 자체를 바꾸는 게 아니라 **비정수 입력의 파싱 결과**만 정합화). 정상 정수 입력에 대해서는 loose/strict 결과가 동일(`Number.isInteger(raw) && raw>0` 인 입력에서는 두 경로 모두 같은 값)하므로 운영 중인 정상 설정값의 동작은 전혀 바뀌지 않는다.
- ARCH#4(`resolveExecutionRunWorkerConcurrency` 이관)는 순수 `process.env` 함수(순환 의존 없음, plan 명시)이며 `execution-limits.ts` 는 이미 동일 부류의 `resolve*` 파서 3종을 보유한 모듈이다 — 이관은 모듈 경계 정리이지 시스템 invariant 우회가 아니다.
- `system-status.constants.ts` 의 `concurrency` 필드는 `16-system-status-api.md` §2(`QueueStatusDto.concurrency`)의 `utilization = active/concurrency` 계산에 쓰인다. loose 파싱이 비정수·음수를 그대로 반영하면 `utilization` 계산이 오염될 수 있는(예: `concurrency=-3` 이면 `utilization` 음수) **잠재적 버그**였다 — strict 통일은 오히려 §2 계약("소수 2자리 utilization")의 암묵 전제(양의 정수 concurrency)를 보호하는 방향이다.

## 발견사항

없음. Rationale 연속성 관점에서 CRITICAL/WARNING 급 충돌을 발견하지 못했다.

- **[INFO]** MAINT#9 정합화 근거를 spec 에 명시적으로 흔적화할 필요는 낮음
  - target 위치: `plan/in-progress/exec-limits-refactor.md` §MAINT#9, 구현 후 `system-status.constants.ts`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.4(라인 892)·§11 env 표(라인 1245-1246)의 strict fallback 계약
  - 상세: MAINT#9 는 이미 spec 에 명시된 유일 계약(strict)에 코드를 맞추는 조치이며 새 결정을 도입하는 게 아니므로 spec 본문 수정은 불필요하다. 다만 리팩터 완료 후 `system-status.constants.ts` 의 코드 주석(현재 loose/strict 구분 언급 없음)에 "canonical `resolveContinuationWorkerConcurrency()` 재사용 — 이전 inline loose 파싱은 spec §11 계약 미준수 drift 였음" 정도의 1줄 회고를 남기면, 향후 다시 inline 파싱으로 되돌리려는 시도(재발 방지)를 막는 데 도움이 된다.
  - 제안: 필수는 아님 — 구현 시 JSDoc/주석에 한 줄 추가 권장. spec 자체는 이미 계약을 정확히 서술하고 있어 변경 불필요.

## 요약

target(exec-limits-refactor: ARCH#4/ARCH#6/MAINT#9)은 `spec/5-system/4-execution-engine.md` §7.4·§11 에 이미 명시된 "비양수·비정수·비숫자 입력→1 fallback" strict 계약을 근거로 삼고 있으며, 실측 결과 현재 `system-status.constants.ts` 의 inline loose 파싱(`Number(x)||1`)이 오히려 이 계약을 위반하고 있던 사전 drift 였음을 확인했다. MAINT#9 는 기각된 대안의 재도입이 아니라 기존에 합의된 canonical strict resolver 패턴(`resolveContinuationWorkerConcurrency`/`resolveExecutionRunWorkerConcurrency`/`execution-limits.ts` 의 기존 `resolve*` 파서들과 동일 규약)으로의 **최초 정합화(계약 준수)** 이고, 정상 입력(양의 정수)에 대해서는 동작이 동일해 "동작 보존" 주장과도 부합한다. ARCH#4/ARCH#6 은 순수 코드 위치·문서 이관으로 Rationale 충돌 소지가 없다. 다만 입력 payload 자체가 무관한 spec 대량 덤프였다는 별도 orchestration 이슈는 확인되었다(본 checker 범위 밖, 참고용으로 상단에 기록).

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
