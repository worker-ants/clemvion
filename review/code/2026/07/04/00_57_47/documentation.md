# 문서화(Documentation) Review — PR3 크래시/재시작 RUNNING 세그먼트 제어된 re-drive

대상 커밋 범위: `codebase/backend/src/modules/execution-engine/{execution-engine.service.ts,execution-engine.service.spec.ts,types/graph-dispatch.types.ts}`, `codebase/backend/src/modules/executions/executions.controller.ts`, `codebase/backend/test/execution-crash-redrive.e2e-spec.ts`, `plan/in-progress/{exec-park-durable-resume.md,spec-draft-crash-running-redrive.md}`, `spec/1-data-model.md`, `spec/5-system/{3-error-handling.md,4-execution-engine.md}`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, `review/consistency/**`(자동 산출물).

## 발견사항

- **[INFO]** 신규 private 메서드 JSDoc 은 상세하나 일부는 "왜"보다 "무엇"에 치중 — 다만 실질적 문제 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2610-2794` (`recoverStuckExecutions`, `reclaimStuckRunningExecution`, `redriveStuckExecution`, `driveStuckRedrive`)
  - 상세: 4개 신규/개정 메서드 모두 spec 앵커(§7.1/§7.2/§7.3/§7.5)를 명시적으로 인용하는 JSDoc 을 갖추고 있고, "옛 동작 → 새 동작" 전환 이유, 동시성 가드(affected=1 패턴), fire-and-forget 예외 처리 방침까지 기술해 문서화 품질이 높다. `runStuckRecoveryScan`(L744) 도 "왜 이 test-only 트리거가 필요한가"(e2e 러너가 백엔드를 재시작할 수 없음)를 정확히 설명한다. 개선 여지가 있다면 `driveStuckRedrive`(L2794) JSDoc 이 "무엇을 하는지"는 상세하나 reachability seed 알고리즘의 downstream propagate 로직 자체(내부 for 루프, L2814-2821)에는 별도 인라인 주석이 없어, 향후 유지보수자가 "왜 executedNodes 전체에 대해 propagateReachability 를 호출하는가"를 JSDoc 앞부분만 보고는 정확히 재구성해야 한다. 이는 CRITICAL/WARNING 급은 아니다.
  - 제안: 별도 조치 불요(선택적으로 `driveStuckRedrive` 내부 reachability 루프에 1줄 인라인 주석 추가 시 향후 유지보수 시간 단축 가능).

- **[INFO]** CHANGELOG.md 미갱신 — 프로젝트 관행과 일치, 문제 아님
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 이번 PR3 변경은 `CHANGELOG.md` 에 새 "Unreleased" 항목을 추가하지 않는다. 저장소 관행을 확인한 결과, `CHANGELOG.md` 는 보안 수정·API 계약 변경(웹훅 body 게이트, 400 검증 `error.details[]`, model-config 타입 검증 등)처럼 **외부 소비자에게 가시적인 변경**만 기록하며, 내부 엔진 동시성/복구 로직 리팩터(예: 06 C-2 재개 원자 claim, PR #791 `fix(engine): 06 C-2...`)는 CHANGELOG 에 등재되지 않는 것이 기존 패턴이다(`git log --oneline -- CHANGELOG.md` 확인). 본 PR3(`recoverStuckExecutions` 내부 동작 전환)도 외부 API 계약·클라이언트 응답 포맷 변화가 없는 순수 내부 복구 메커니즘 전환이므로 이 패턴과 일치한다. 신규 엔드포인트(`_test/recover-stuck-executions`)도 `@ApiExcludeEndpoint()` + `NODE_ENV==='test'` 게이팅으로 프로덕션 표면이 아니라고 명시돼 있어 CHANGELOG 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `execution-engine-residual-gaps.md` G2 cross-reference 가 2-hop stale 로 남아있음 (developer 단계 후속 예정으로 이미 인지됨)
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md` G2 (본 diff 범위 밖, 미갱신) ↔ `plan/in-progress/exec-intake-queue-impl.md` PR3(L57, "exec-park-durable-resume 로 이관"으로 이미 갱신) ↔ 실제 신규 절 `plan/in-progress/exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개"
  - 상세: `plan_coherence` checker(`review/consistency/2026/07/03/23_50_01/plan_coherence.md`)가 이미 INFO 로 지적한 사항으로, `execution-engine-residual-gaps.md` G2 가 `exec-intake-queue-impl.md` PR3 를 가리키지만 그 PR3 항목 자체가 다시 `exec-park-durable-resume.md` 로 이관되어, G2 → (경유) → 실제 구현 위치까지 2단계 참조를 거쳐야 한다. `exec-park-durable-resume.md` "### 구현 시퀀싱" 항목 3(L841)이 "plan 갱신: … `execution-engine-residual-gaps.md` G2 부분 해소 표기"를 developer 단계 후속 작업으로 이미 계획해 두었으므로, 이 diff 범위에서 미반영된 것 자체는 예정된 후속 작업이지 누락이 아니다.
  - 제안: G2 갱신 시 `exec-intake-queue-impl.md` 를 거치지 말고 `exec-park-durable-resume.md#pr3` 절을 직접 가리키도록 정정(이미 plan 자체에 이 지시가 있으므로 별도 조치 불요, 후속 커밋에서 이행 여부만 확인 권장).

- **[INFO]** e2e 테스트 파일의 문서화 수준은 최우수 — 참고용 긍정 기록
  - 위치: `codebase/backend/test/execution-crash-redrive.e2e-spec.ts:1-20` (파일 헤더 JSDoc), `:706-790` (인라인 주석)
  - 상세: 파일 상단에 spec 앵커(§7.1/§7.2 point3/§7.5 case B)·시나리오·검증 항목(1~3) 을 모두 명시하는 JSDoc 블록이 있고, 크래시를 합성하는 각 DB 조작 단계(`DELETE FROM node_execution`, `UPDATE execution SET status='running'...`)마다 "왜 이 시점에 이 조작을 하는가"를 설명하는 인라인 주석이 붙어 있다. 특히 "Execution status='completed' 는 원 실행·재구동 양쪽에서 나타나 모호하므로 판정 신호로 쓰지 않는다"(L742-746)는 테스트 설계 의도를 명시한 주석은 향후 유지보수자가 assertion 순서를 오해하지 않도록 돕는 모범 사례다. 특별한 개선 요청 없음.
  - 제안: 없음(우수 사례로 기록).

- **[INFO]** `graph-dispatch.types.ts` 의 신규 `skipExecutedNodes` 필드 JSDoc — 정확하고 충분
  - 위치: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts:415-422`
  - 상세: 신규 옵션 필드에 "언제 true 인지(case B 전용)", "언제 false/미전달인지(기본 경로 cycle 재실행 보존)", "왜 그런 차이가 필요한지(pointer 되감기 vs exactly-once)"를 모두 담은 JSDoc 이 달려 있어 인터페이스 문서화로서 충분하다.
  - 제안: 없음.

- **[INFO]** spec 4개 파일(§7.1/§7.2/§7.3/§7.5, data-model, error-handling, error-codes, data-flow) 동시 갱신 — cross-spec WARNING 이 실제로 해소됐는지 확인 완료
  - 위치: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md:466`(L469 error 필드), `spec/5-system/3-error-handling.md:76`, `spec/conventions/error-codes.md:63`, `spec/data-flow/3-execution.md`(§1.1/§3.1/§3.3)
  - 상세: consistency-check(--spec, `review/consistency/2026/07/03/23_50_01`)가 W1(§4.2 재검증)·W2(error-code 이중 배정 정리)·W3(`data-flow/3-execution.md` 동시 갱신 필수)·W4(`active_running_ms` under-count 정직화)를 WARNING 으로 지적했다. 실제 diff 를 대조한 결과 4건 모두 spec 본문에 반영됐다 — W1 은 `4-execution-engine.md` 신규 Rationale 절 "§4.2 active-running 직렬화 불변식 재검증"(잔여 zombie race 명시), W2 는 "PR3 기간 `WORKER_HEARTBEAT_TIMEOUT` 미발동, 실제 terminal 은 `EXECUTION_TIME_LIMIT_EXCEEDED`" 로 단일화, W3 은 `data-flow/3-execution.md` §3.1 mermaid self-loop 추가 + §3.3 표 정정, W4 는 "Graceful Shutdown … under-count" Rationale 문단에 "PR3 에서 자연 해소" 문구를 "정정 — PR3 는 해소하지 않는다" 로 명시적으로 되돌리고 대안 1차 bound(boot-only 트리거)를 추가했다. 이는 문서화 관점에서 우수한 이행이다 — WARNING 이 실제로 spec 반영 커밋에서 닫혔는지를 자동화 없이 별도로 검증해야 했던 부분이라 기록해 둔다.
  - 제안: 없음(검증 완료, 향후 유사 PR 의 "consistency WARNING → 실제 spec 반영" 추적에 참고).

- **[INFO]** `error-codes.md`/`3-error-handling.md`/`1-data-model.md` 3곳의 `WORKER_HEARTBEAT_TIMEOUT` 문구가 미세하게 다른 표현("PR4 재정의" vs "PR4 예약" vs "PR3 기간 미발동")을 쓰나 의미는 일치
  - 위치: `spec/1-data-model.md:469`, `spec/5-system/3-error-handling.md:76`, `spec/conventions/error-codes.md:63`
  - 상세: 세 곳 모두 "PR3 기간에는 이 코드가 발동하지 않는다"는 핵심 사실은 정확히 전달하지만 표현이 "PR4 예약"(data-model)/"PR3 기간 미발동"(error-handling)/"PR4 재정의"(error-codes) 로 약간씩 다르다. 의미상 모순은 없으나(모두 "PR3=dormant, PR4=재활성" 골격 공유), 완전히 동일한 정형 문구로 통일하면 향후 grep 기반 감사가 더 쉬워진다. `convention_compliance` checker 가 이미 이 뉘앙스를 INFO 로 지적했고 실제로 이번 반영이 그 지적을 상당 부분 흡수했다(3곳 모두 갱신됨) — 남은 것은 문구 완전 통일이라는 매우 사소한 스타일 이슈뿐이다.
  - 제안: 선택 사항 — 필요 시 후속 정리 PR 에서 3곳 표현을 동일 템플릿으로 통일.

## 요약

이번 변경은 문서화 관점에서 전반적으로 모범적이다. 신규/개정된 모든 공개·비공개 메서드(`recoverStuckExecutions`, `reclaimStuckRunningExecution`, `redriveStuckExecution`, `driveStuckRedrive`, `runStuckRecoveryScan`, 컨트롤러의 `triggerStuckRecoveryForTest`)가 spec 절 번호를 인용하는 JSDoc 을 갖추고 있고, 옛 동작과의 차이(일괄 fail → 원자 re-claim + 재구동)를 명확히 설명한다. 신규 e2e 테스트 파일은 시나리오·검증 근거·판정 신호 선택 이유까지 인라인 주석으로 남겨 우수 사례로 꼽을 만하다. 무엇보다 이 PR 은 SDD 관행에 따라 코드 변경 전에 spec(§7.1/§7.2/§7.3/§7.5, data-model, error-handling, error-codes, data-flow/3-execution)을 5개 checker 로 검증하고 발견된 WARNING(§4.2 재검증·error-code 이중배정·data-flow 동시 갱신·active_running_ms under-count 정직화) 을 모두 실제 spec 반영에서 해소했음을 diff 대조로 확인했다. CHANGELOG 미갱신은 이 저장소가 내부 엔진 리팩터에는 CHANGELOG 를 쓰지 않는 기존 관행과 일치해 결함이 아니다. 발견된 항목은 전부 INFO 수준(문구 표현 통일, 2-hop plan 참조 정리, 선택적 인라인 주석 보강)이며 이미 후속 작업으로 계획돼 있거나 실질적 영향이 없다.

## 위험도

NONE
