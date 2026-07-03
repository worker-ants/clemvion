# Architecture Review — PR3 크래시 RUNNING 세그먼트 제어된 re-drive

대상: `execution-engine.service.ts`(+spec.ts), `graph-dispatch.types.ts`, `executions.controller.ts`, 신규 e2e, plan/spec draft 문서.

## 발견사항

- **[INFO]** `ExecutionEngineService` 가 이번 변경으로 다시 커진다 (기존 god-class 경향 지속)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (전체 7281 lines), 신규 `reclaimStuckRunningExecution`/`redriveStuckExecution`/`driveStuckRedrive` (약 L2680-2880)
  - 상세: 이 서비스는 이미 이전 리팩터 백로그(M-1 계열)에서 "god-handler" 문제로 인지되어 있던 클래스다. 이번 PR3 는 case A(`driveResumeAwaited`)와 구조적으로 대칭되는 case B 드라이브 세트(`reclaimStuckRunningExecution` / `redriveStuckExecution` / `driveStuckRedrive`)를 같은 클래스 내부 private 메서드로 추가해 파일을 더 키운다. 기능 자체는 기존 패턴(`finalizeResumedExecutionOutcome`, `finalizeRehydrationCleanup`, `markExecutionCancelled`, `recordRunningSegmentStart` 공유 재사용)을 그대로 따르고 있어 국소적으로는 일관성이 있으나, 클래스 전체의 응집도 문제를 해소하지는 않는다.
  - 제안: 신규 이슈는 아니므로 이번 PR 을 막을 사유는 아니다. 다만 case A/B 드라이브 로직 쌍(`driveResumeAwaited`/`driveStuckRedrive`, `rehydrateContext`, `runNodeDispatchLoop` 등)을 향후 `ResumeDriver`/`RedriveDriver` 같은 별도 협력 객체로 추출하는 리팩터가 기존 백로그(M-3/M-8 등)에 이미 반영돼 있는지 확인하고, 없다면 항목화를 권장.

- **[INFO]** case A/B 코드 중복(완결 처리부) — 의도된 대칭이나 추상화 추출 여지
  - 위치: `driveStuckRedrive` L2847 부근 COMPLETED 마감 블록 vs `driveResumeAwaited` 의 동일 블록(주석에 "동일 형식" 명시)
  - 상세: `driveStuckRedrive` 는 `driveResumeAwaited` 의 "turn 이후 forward + 완결/park/에러 처리" 구조를 의도적으로 복제하되 turn 단계만 제거한 형태다. 두 메서드가 (1) `runNodeDispatchLoop` 호출, (2) parked 여부 분기, (3) COMPLETED 마감 필드 세팅, (4) `finalizeResumedExecutionOutcome`/`finalizeRehydrationCleanup` catch/finally 구조를 거의 동일하게 반복한다.
  - 제안: 현재는 라인수 관리 가능한 수준의 중복이라 즉시 강제할 사항은 아니나, "완결 마감(complete-or-park epilogue)"을 공통 private 헬퍼로 뽑아 case A/B 양쪽이 호출하도록 하면 향후 세 번째 진입 경로(PR4 stalled 재배달 등) 추가 시 중복이 3배로 늘어나는 것을 예방할 수 있다. 확장성 관점에서 권고.

- **[INFO]** `NodeDispatchLoopParams.skipExecutedNodes` 불리언 플래그 방식의 모드 분기
  - 위치: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` L81-88, `runNodeDispatchLoop` 내부 분기(L1436-1444 부근)
  - 상세: `runNodeDispatchLoop` 는 이미 `dispatchMeta.mode: 'manual'` 같은 모드성 필드를 갖고 있었고, 이번에 `skipExecutedNodes?: boolean` 이 추가돼 "cycle 재실행 허용" vs "완료 노드 skip(exactly-once)" 두 정책이 같은 루프 함수 안에서 플래그로 분기된다. SRP 관점에서는 하나의 함수가 두 가지 멱등 정책을 다루게 되지만, 이 함수가 이미 여러 진입 경로(runExecution/case A/case B)의 공용 forward 엔진으로 설계돼 있어 정책을 파라미터화하는 것 자체는 합리적 트레이드오프다. 다만 boolean 플래그가 하나씩 늘어나는 패턴(mode, skipExecutedNodes, …)이 반복되면 향후 진입 경로가 늘어날 때(PR4) 분기 조합 폭발 위험이 있다.
  - 제안: 현재 1개 플래그 추가는 문제없음. PR4(BullMQ stalled 자동 재배달) 도입 시 플래그가 하나 더 늘어난다면, `DispatchPolicy` 같은 명시적 enum/객체로 통합하는 것을 고려.

- **[INFO]** 테스트 전용 라우트의 환경변수 기반 게이팅 (`NODE_ENV==='test'` → 404)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` L198-214, `_test/recover-stuck-executions`
  - 상세: 프레젠테이션 레이어(컨트롤러)에 "이 라우트는 test 환경에서만 존재한다"는 정책을 하드코딩된 `process.env.NODE_ENV` 분기로 넣었다. `@ApiExcludeEndpoint()` 로 Swagger 노출은 막았고 PR 주석에도 "운영용 on-demand trigger 는 PR4" 로 명시돼 있어 임시적/의도적 스코프임이 분명하다. 모듈 경계상 순수 프로덕션 표면은 아니지만, 런타임에 라우트 존재 여부가 바뀌는 패턴은 라우팅 테이블을 예측 불가하게 만들 수 있다(다른 e2e 전용 엔드포인트가 이미 이 패턴을 쓰는지 여부는 미확인).
  - 제안: 기존 코드베이스에 유사 `_test/*` 게이팅 엔드포인트가 이미 존재한다면 기존 컨벤션을 따른 것이므로 문제 없음. 없다면, 모듈 등록 시점(`ExecutionsModule` 에서 `NODE_ENV` 체크 후 컨트롤러 자체를 조건부 등록)으로 옮겨 컨트롤러 코드 자체에서 프로덕션/테스트 분기 로직을 제거하는 편이 레이어 책임상 더 깨끗하다. 이번 PR 범위에서 강제할 필요는 없음(INFO).

- **[INFO]** 크래시 재구동 경로에서 `routing context 재등록`(`registerExecutionRouting`) 처리가 컨트롤러가 아닌 서비스 내부에 인라인
  - 위치: `redriveStuckExecution` 내 `this.eventEmitter.registerExecutionRouting(...)` 호출부(try/catch best-effort)
  - 상세: case A(`driveResumeAwaited`) 경로와 동일한 관심사(outbound routing context 재등록)를 case B 에도 복제해 넣었다. 이는 §7.5/CCH-AD-05 계약을 두 진입점 모두에서 지켜야 하므로 기능적으로 타당하나, 이 로직이 이미 두 곳(추정컨대 case A, case B)에 중복돼 있다면 추후 세 번째 경로 추가 시 또 복제될 위험이 있다. 이번 diff 범위에서는 case A 원본 코드를 보지 못해 정확한 중복 여부는 미확인.
  - 제안: 향후 리팩터 시 "routing context 재등록"을 `rehydrateContext` 또는 공용 헬퍼로 승격해 재개 진입점이 늘어나도 각자 복제하지 않도록 하는 것을 고려. 이번 PR 자체는 기존 패턴을 따른 것으로 판단되어 차단 사유 아님.

## 요약

이번 변경은 §7.2 point 3("재시작 시 running 을 체크포인트에서 resume")과 실제 구현(일괄 FAILED 마킹) 사이의 오랜 spec-impl 불일치를 해소하는 PR로, 기존 case A(`claimResumeEntry` → `driveResumeAwaited`) 재개 아키텍처의 구조·명명·에러 처리 관용구를 그대로 따라 case B(`reclaimStuckRunningExecution` → `redriveStuckExecution` → `driveStuckRedrive`)를 대칭적으로 추가한 설계다. 원자 re-claim(단일 조건부 UPDATE…RETURNING), 완료 노드 skip 을 위한 `skipExecutedNodes` 파라미터화, `finalizeResumedExecutionOutcome`/`finalizeRehydrationCleanup`/`markExecutionCancelled` 등 기존 종결 헬퍼의 재사용은 모두 결합도를 낮추고 기존 관용구와의 일관성을 지키는 방향으로 잘 설계되어 있다. 다만 `ExecutionEngineService` 자체가 여전히 7000줄이 넘는 단일 클래스로, 이번 PR 이 그 경향을 완화하기보다 유사 패턴을 한 벌 더 추가하는 방향으로 진행된 점, case A/B 완결부의 상당한 구조적 중복, 테스트 전용 라우트의 런타임 게이팅은 모두 새로운 CRITICAL 리스크라기보다 기존에 인지된 리팩터 백로그의 연장선상 관찰 사항이다. SOLID/순환의존성/레이어 경계 관점에서 이번 diff 자체가 새로 도입하는 구조적 결함은 발견되지 않았다.

## 위험도
LOW
