# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 응답 egress 마스킹이 "프레임워크가 강제"가 아니라 "개발자가 매 호출부에서 기억해서 부르는" 패턴에 계속 의존한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:905-928`(`toResponseExecution`),
    `codebase/backend/src/modules/executions/executions.service.ts:886-888`(`toExecutionDto` 개별 호출),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:285-304`(`toNodeExecutionDto`)
  - 상세: 이번 변경은 `Execution.error`/`NodeExecution.error` egress 노출을 4~5개 독립 반환 경로(`findById`·`getChain`·`stop`·`toExecutionDto`·`background-runs` body 노드)에 각각 손으로 배선한다. `toResponseExecution` 을 단일 관문으로 묶은 것은 좋은 완화지만, `toExecutionDto`(목록 경로)와 `background-runs.service.ts`(자매 모듈)는 **여전히 별도 call-site**에서 같은 유틸을 각자 호출한다. 이 저장소는 이 클래스의 결함("자매 넷 중 하나만 마스킹")을 이미 3회 이상 반복 겪었다고 스스로 기록하고 있다(`redact-stored-error.ts` 주석, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`). `class-transformer`/`ClassSerializerInterceptor` 같은 프레임워크 수준 직렬화 계층이 이 코드베이스에 응답 마스킹 용도로 쓰인 전례가 없어(전부 입력 DTO validation 용) 이번 PR 이 기존 관용(수작업 DTO 매퍼 함수)을 그대로 따른 것은 일관적이다. 다만 구조적으로는 새 반환 경로가 추가될 때마다 재발 가능한 OCP 리스크가 여전히 남는다 — 이번 PR 자체가 이미 알고 있는 잔여 갭(WS `execution.node.*` emit, `inputData`/`outputData`)을 백로그로 명시적으로 남긴 것이 그 증거다.
  - 제안: 당장 이 PR 범위는 아니지만, 향후 후속으로 "Execution 응답을 만드는 모든 지점은 공통 응답 빌더/인터셉터를 반드시 거친다"는 구조적 보장(예: `Execution`/`NodeExecution` 응답 DTO 조립을 단일 팩토리로 강제하거나, 컨트롤러 레벨 인터셉터에서 `error` 필드를 후처리)을 검토할 가치가 있다. 지금 방식(문서화 + 카나리 테스트 + 뮤테이션 커버리지)은 재발을 사람이 감시하는 구조이지 타입/프레임워크가 막는 구조는 아니다.

- **[INFO]** `toResponseExecution` 이 관계-제거(관심사 A)와 값-마스킹(관심사 B) 두 책임을 한 함수에 의도적으로 결합
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:905-928`
  - 상세: 종전 `stripPrivateRelations`는 `trigger`/`executor` 관계 객체 제거(민감 관계 정보 은닉)만 했다. 이번 변경은 같은 함수에 `error` 컬럼 값 마스킹을 추가하며 이름도 `toResponseExecution`으로 바꿨다. 엄격한 SRP 관점에서는 서로 다른 두 관심사(관계 shape 정리 vs 필드 값 새니타이즈)가 한 메서드에 묶인 것이지만, 함수 docstring(`## 왜 둘을 한 함수에 묶나`)이 그 트레이드오프를 명시적으로 밝히고 있고 — "호출부마다 마스킹을 걸면 한 곳씩 빠진다"는 이 저장소의 실측된 반복 결함 패턴을 근거로 든다. 응답 egress 경계라는 단일 책임(= "엔티티를 안전하게 응답으로 내보내기")으로 재정의하면 두 관심사 모두 그 책임의 하위 항목으로 정당화된다. 안티패턴이라기보다 "God 함수"로 발산하지 않는 한 유지 가능한 boundary facade 패턴이다.
  - 제안: 세 번째 유사 관심사(예: 향후 `inputData`/`outputData` 마스킹)가 추가될 때는 이 함수가 계속 팽창하기보다, 작은 파이프라인(`applyResponseTransforms(execution, [stripRelations, redactError, redactIO])`)으로 리팩터하는 편이 함수 하나에 무한정 얹는 것보다 낫다. 지금 규모(2개 관심사)에서는 시기상조.

- **[INFO]** 신규 leaf 유틸의 의존 방향과 배치는 순환 재유입을 피하도록 설계됨 — 양호
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:1-4`
  - 상세: `redact-stored-error.ts`는 `sanitize-error-message.ts`(`deepRedactSecrets`) 하나만 import하고, `modules/executions/*`는 `shared/utils/*`를 import하는 단방향 의존만 성립한다. 파일 상단 주석이 `terminal-error-payload.ts`와 같은 층(leaf util)임을, 그리고 #1175에서 해소한 `ws.service↔gateway↔event-emitter` ES-module 순환에 재유입하지 않는 이유를 명시적으로 설명한다. `ExecutionError`(제어흐름 예외 클래스, `execution-engine/workflow-errors.ts`)와 이름이 겹치지 않도록 `redactStoredErrorForResponse`로 명명해 이전 라운드에서 지적된 naming collision(부분 문자열 포함)도 회피했다. 계층·명명·의존 방향 모두 기존 아키텍처 원칙(DIP: 상위 모듈이 하위 leaf util에 의존, 역방향 없음)을 준수한다.

- **[INFO]** 마스킹 보장의 경계를 캐너리 테스트로 고정 — 추상화 수준을 스스로 제한
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:59-74`
  - 상세: `deepRedactSecrets`의 `SECRET_LEAK_PATTERNS`는 자격증명만 겨냥하고, 자격증명 없는 연결 문자열·평범한 에러 메시지는 통과시킨다. 이를 "버그"로 넓히지 않고 캐너리 테스트로 고정해, 패턴이 넓어지면 이 테스트가 RED로 바뀌어 "blast radius가 `deepRedactSecrets`의 다른 소비자 전부"라는 사실을 그 시점에 강제로 마주하게 만든다. 공유 유틸의 blast radius를 정확히 인지하고 확장 결정을 별건으로 분리한 것은 추상화 경계 관리의 좋은 예다.

- **[INFO]** `plan/**` frontmatter 의 `pending_plans` 키가 선언 위치에 따라 의미가 갈리는 암묵적 오버로딩
  - 위치: `.claude/docs/plan-lifecycle.md:80-96`
  - 상세: 같은 키 `pending_plans`가 `spec/**`에서 선언되면 "spec의 미구현 surface를 책임지는 plan"(강제 게이트 있음)을, `plan/**`에서 선언되면 "이 plan의 선행 의존 plan"(가드 없음, 사람이 읽는 순서 힌트)을 의미한다. 판별 근거는 선언 파일의 **경로**뿐이고 별도 discriminator 필드는 없다. 문서 자신이 "이미 관행이 됐다"며 금지하지 않는다고 명시하고, plan 레벨에는 완료 판정에 쓰이지 않는다는 이유로 가드를 붙이지 않기로 결정했음을 밝힌다. 코드가 아닌 메타데이터 스키마 설계 결정이지만, 같은 키 이름을 서로 다른 계약(강제 vs 힌트)에 재사용하는 것은 일반적으로 "암묵적 인터페이스 오버로딩" 냄새다. 문서가 트레이드오프를 인지하고 명시적으로 감수하기로 했으므로 차단 사유는 아니다.

## 요약

이번 변경의 핵심은 `Execution.error`/`NodeExecution.error` DB 컬럼 값을 응답 egress 시점에 마스킹하는 공유 leaf 유틸(`redact-stored-error.ts`)을 신설하고, 이를 `ExecutionsService`의 4개 독립 반환 경로와 `BackgroundRunsService`의 자매 표면에 적용한 것이다. 계층 배치(shared/utils, 단방향 의존, 기존 ES-module 순환 재유입 회피), 명명(제어흐름 예외 클래스와 의도적 구분), 보장 경계의 테스트 고정(캐너리) 모두 신중하게 설계되어 있고, 관련 spec 문서(EIA §R17, execution-history R-5, secret-store.md 비대상 예외)도 같은 커밋 사이클에서 함께 갱신되어 "구현이 규정보다 넓다" 는 흔한 실패 모드를 피했다. 유일한 구조적 논점은 이 코드베이스가 응답 마스킹을 여전히 프레임워크 강제(interceptor/serializer)가 아니라 각 서비스의 개별 DTO-매퍼 함수가 명시적으로 호출하는 방식에 의존한다는 점인데, 이는 기존 코드베이스 전반의 관용과 일치하고 이번 PR이 그 안에서 가능한 최선의 완화(단일 관문 함수 + 문서화 + 뮤테이션 테스트 + 남은 갭의 명시적 백로그화)를 취했다는 점에서 이번 PR의 결함이라기보다 저장소 차원의 장기 리스크로 별도 추적할 사안이다. CRITICAL/WARNING 급 발견은 없다.

## 위험도

LOW
