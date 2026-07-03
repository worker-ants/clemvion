# 요구사항(Requirement) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — M-4(06-concurrency, Option B): `executeAsync` fire-and-forget catch 에 `failFirstSegmentSetup` best-effort 마감 추가 + `runExecutionFromQueue`/`executeAsync` 공유 헬퍼 `failFirstSegmentSetupBestEffort` 추출(review-fix)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 단위 테스트 2건
- `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/refactor/README.md` — M-4 완료 마킹 + 집계 동기화
- `review/code/2026/07/03/22_35_54/**` — 직전 리뷰 세션 산출물(SUMMARY/RESOLUTION 등, 자체 리뷰 대상 아님— 이전 사이클 기록)

## 점검 결과

### 1. 기능 완전성
`executeAsync`(sub-workflow 비동기 fire-and-forget)의 `runExecution(...).catch()` 가 기존엔 로그만 남기고 종료해 setup 단계 throw 시 Execution 이 `PENDING`/`RUNNING` 에 잔류하는 결함을, 큐 경로(`runExecutionFromQueue`)와 동일한 `failFirstSegmentSetup` best-effort 마감으로 닫았다. 목표(M-4: "setup 2차 실패 시 RUNNING 잔류" 해소)를 정확히 구현. 두 진입점의 "호출+2차실패 로그흡수" 쌍이 `failFirstSegmentSetupBestEffort` 로 추출돼 중복 없이 공유된다 — 기능 동일성 유지(로그 문구 불변) 확인됨(코드 직접 대조, `execution-engine.service.ts:541-556` vs 기존 인라인 로직).

### 2. 엣지 케이스
- setup 단계 1차 throw 후 `failFirstSegmentSetup` 내부에서 이미 terminal(COMPLETED/FAILED/CANCELLED)이면 no-op(`execution-engine.service.ts:503-510`) — 정상 흐름과 경합해도 이중 마킹 없음.
- `failFirstSegmentSetup` 2차 실패(마킹 자체 실패) 시에도 `failFirstSegmentSetupBestEffort` 의 `.catch` 가 흡수해 재throw 하지 않음 — fire-and-forget 컨텍스트의 unhandled rejection 방지, 큐 경로의 BullMQ 이중 재시도 방지와 동일 계약.
- sub-workflow 는 `executeExecutionRouting` 미등록이므로 `releaseExecutionRouting` 미호출 — 주석으로 근거 명시, 큐 경로와의 유일한 의도적 비대칭.

### 3. TODO/FIXME
diff 범위 내 TODO/FIXME/HACK/XXX 없음.

### 4. 의도와 구현 간 괴리
`failFirstSegmentSetupBestEffort` 함수명·JSDoc(`execution-engine.service.ts:533-540`)이 "호출+2차실패 로그흡수 쌍" 이라는 실제 동작과 정확히 일치. 헬퍼 추출 전후 로그 문구(`failFirstSegmentSetup secondary error for ${executionId}: ...`)가 불변이라 기존 W5/W7 테스트가 그대로 통과 — 리팩터링이 관찰 가능한 동작을 바꾸지 않았음을 테스트로 확인(아래 5번 실행 결과).

### 5. 에러 시나리오
1차 실패(setup throw)·2차 실패(마킹 자체 실패) 두 시나리오 모두 테스트로 커버(`execution-engine.service.spec.ts:2211-2267`). 실제로 실행해 확인:

```
npx jest execution-engine.service.spec.ts -t "M-4"
Tests: 333 skipped, 2 passed, 335 total
npx jest execution-engine.service.spec.ts   (전체)
Tests: 335 passed, 335 total
```

전체 스위트 그린 — 헬퍼 공유 리팩터링이 기존 큐 경로(W5/W7) 테스트를 깨지 않았고 신규 M-4 테스트도 통과.

### 6. 데이터 유효성
`failFirstSegmentSetup` 은 기존 로직 그대로(변경 없음) — row 조회 실패/조회 결과 null 처리, `startedAt` null 가드(`durationMs` 계산 조건부) 등 기존 유효성 검증 유지. 신규 코드는 이 기존 헬퍼를 호출만 하므로 별도 데이터 유효성 신규 리스크 없음.

### 7. 비즈니스 로직
plan(`06-concurrency.md:169-179`)이 정의한 "단기 옵션 2"(큐 경로와 동일한 catch 복제)를 정확히 구현. Option A(execution-run 큐로 완전 통일)는 의도적으로 후속 연기 — plan 본문에 사유(PR2b admission "대상 한정" 결정과 결합 필요, 중첩 sub-workflow cap self-starvation 검토 선행)가 명시돼 있고 코드 주석(`execution-engine.service.ts:3404-3409`)도 동일 취지로 일관됨. 비즈니스 규칙과 코드 사이 괴리 없음.

### 8. 반환값
`executeAsync` 는 catch 분기와 무관하게 `executionId` 를 즉시 반환(fire-and-forget 계약 불변) — catch 콜백 자체는 `Promise<void>` 이고 상위 `.catch()` 체인 반환값에 영향 없음. `failFirstSegmentSetupBestEffort` 는 모든 경로(성공/2차실패)에서 `Promise<void>` 를 resolve — 반환 누락 경로 없음.

### 9. spec 본문 일치 여부 (spec fidelity)
관련 spec: `spec/5-system/4-execution-engine.md` §4(Worker 모델)·§7.1/§7.4(장애 복구, stale fail 30분).

- §7.4 (`4-execution-engine.md:906`)의 "`STUCK_RECOVERY_STALE_MS`(30분) 는 RUNNING 대상" 서술과 코드 주석("§7.1 stale fail(30분) 까지 방치")이 일치 — 최후 방어망으로서의 stale-fail 언급이 spec 과 정합.
- §4(`4-execution-engine.md:379`)는 `execute()` 의 `execution-run` 큐 발행 모델을 target 으로 명시하나, `executeAsync`(sub-workflow 비동기 진입점)에 대해서는 침묵 — spec 이 이 경로를 별도로 규정하지 않는다. plan 자체가 "**spec 대조: B**(spec 무언급, 드리프트 아님)" 로 정확히 분류했고(`06-concurrency.md:173`), 코드도 "spec 무변경" 으로 처리 — 판정 일치.
- Option A(큐 완전 통일)는 spec §4 target 모델과 정합하는 방향이지만 아직 미채택 — 이는 spec 위반이 아니라 **점진적 접근의 중간 상태**로, plan 이 근거(Option A 채택 시 흡수되는 "일시 부채")를 명시했으므로 CRITICAL 대상 아님.
- `failFirstSegmentSetup` 자체 로직(FAILED 전환·`error.message`·`finishedAt`·`durationMs` 계산·`EXECUTION_FAILED` 이벤트 발행)은 본 diff 의 변경 대상이 아니며(기존 로직 재사용) 별도 회귀 없음.

spec 침묵 영역에 대한 합리적 확장이며 [SPEC-DRIFT] 태깅이 필요한 "코드가 옳고 spec 이 낡은" 케이스도 아니다(spec 이 애초에 이 세부 catch 동작을 규정한 적이 없어 갱신 누락이 아님) — INFO 수준의 관찰.

## 발견사항

- **[INFO]** spec 침묵 영역(§4 intake 모델에 `executeAsync` 커버 없음)
  - 위치: `spec/5-system/4-execution-engine.md` §4 (`379-425`행 부근)
  - 상세: `execute()`(§4.1) 는 `execution-run` 큐 발행이 명시돼 있으나 sub-workflow 용 `executeAsync` 는 spec 이 별도로 규정하지 않는 fire-and-forget in-process 경로. 이번 diff 는 그 경로의 에러 마감만 큐 경로와 대칭화했을 뿐, 모델 자체를 바꾸지 않았다.
  - 제안: 조치 불요. plan 이 이미 "spec 대조: B(무언급, 드리프트 아님)" 로 정확히 판정했고 Option A(큐 통일) 채택 시 별도 planner 위임으로 spec 갱신 판단 예정.

## 요약

M-4 목표(`executeAsync` fire-and-forget 의 setup 2차 실패 시 RUNNING/PENDING 잔류 방지)를 큐 경로와 동일한 `failFirstSegmentSetup` best-effort 마감 패턴으로 정확히 구현했다. 직전 리뷰(22_35_54)의 WARNING 2건(catch 로직 중복·plan 체크박스 미동기화)도 `failFirstSegmentSetupBestEffort` 헬퍼 추출과 plan/README 갱신으로 해소됐으며, 헬퍼 추출이 로그 문구·호출 계약을 불변으로 유지해 기존 W5/W7 테스트와 신규 M-4 테스트(335/335) 전부 통과함을 직접 실행으로 확인했다. spec 대조 결과 관련 §4/§7 본문과 모순 없음 — `executeAsync` 세부 catch 동작은 spec 이 애초에 규정하지 않는 영역(무언급)이라 CRITICAL/SPEC-DRIFT 대상이 아니다. TODO/FIXME, 반환값 누락, 데이터 유효성 결함, 비즈니스 로직 불일치 모두 발견되지 않았다.

## 위험도
NONE
