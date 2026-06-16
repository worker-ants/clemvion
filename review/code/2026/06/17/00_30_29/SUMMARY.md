# Code Review 통합 보고서

리뷰 대상: `refactor(execution-engine): NodeBootstrapService + WORKFLOW_EXECUTOR 토큰 추출 (C-1 step1/m-3)`
커밋: `7e38716ac3dc9972cf2941a673797b4adbc387d6`

## 전체 위험도

**LOW** — 순수 내부 리팩토링(god-class strangler-fig 1단계). 공개 API·인증·외부 의존성 변경 없음. Critical 발견 없음. 경고 4건은 모두 기능적 오류가 아닌 가독성·테스트 정리 사항.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `NodeBootstrapService` 가 `execution-engine` 레이어에 배치됐으나 `nodes/` 레이어의 `ALL_NODE_COMPONENTS` 를 직접 import — 현재 아키텍처에서 순환 회피를 위한 유일한 무순환 경로이므로 차선책이나 허용 | `node-bootstrap.service.ts` | PR2 이후 `EngineDriver` 도입 시 플러그인 등록 패턴으로 역전 (설계 이미 수립됨) |
| 2 | Architecture | `ExecutionEngineService` 가 여전히 9,670줄 god-class (ctor 의존성 26→24 감소에 그침) — 이 PR 의 의도된 한계이며 stacked PR2–4 로 점진 해소 예정 | `execution-engine.service.ts` | PR2 `AiTurnOrchestrator` → PR3 Form/Button → PR4 Retry 계획 진행 |
| 3 | Testing | `execution-engine.service.spec.ts` 의 여러 `TestingModule` 블록에 생성자에서 이미 제거된 `NodeHandlerDependenciesProvider` 가 불필요하게 잔류 — 기능적 오류 없으나 "엔진이 이 의존성을 여전히 필요로 한다"는 오해 유발 | `execution-engine.service.spec.ts` lines 294, 15326, 15739, 16145 | 각 `TestingModule` 블록에서 `NodeHandlerDependenciesProvider` 등록 제거 (현 PR 또는 후속 PR) |
| 4 | Maintainability | `ExecutionEngineService.onModuleInit` 에 `registerHandlers()` 이전 사실을 명시하는 주석 없음 — `implements OnModuleInit` 을 보는 개발자가 bootstrap 책임이 남아있다고 오해할 수 있음 | `execution-engine.service.ts` line 1255 | `// NOTE: 노드 핸들러 bootstrap 은 NodeBootstrapService(C-1 step1)로 이전됨. 본 hook 은 큐 깊이 gauge 등록 전용.` 주석 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `WORKFLOW_EXECUTOR` DI 토큰이 평문 문자열 — 코드베이스 기존 관용과 일치. 이론적 이름 충돌 리스크 존재하나 현재 사용처 단일로 실질 위험 없음 | `workflow-executor.interface.ts` | 선택적: `Symbol('WORKFLOW_EXECUTOR')` 전환으로 원천 차단 가능 |
| 2 | Security | `assertSameWorkspace` fail-open 정책 — 이번 PR 미변경이나 후속 PR(PR2–4)에서 node handler 가 `executeAsync`/`executeInline` 경로를 활발히 사용할 때 fail-closed 전환 검토 필요 | `execution-engine.service.ts` `assertSameWorkspace` | 후속 PR 에서 `parentWorkspaceId` 전달 필수화 일정을 plan 에 명시 |
| 3 | Architecture | `NodeHandlerDependenciesProvider` 의 `@Optional()` 주입 패턴 — 타입 레벨 일관성 유지, 최소 픽스처 가능, 레거시 호환 | `node-handler-dependencies.provider.ts` | 현재 구조 유지 |
| 4 | Architecture | `forwardRef(() => ExecutionEngineModule)` 제거 — 실제 순환 없음 확인 후 단행, e2e 통과로 검증됨 | `nodes.module.ts` | 현재 구조 유지 |
| 5 | Architecture | `NodeBootstrapService.onModuleInit` → `ExecutionEngineService.onApplicationBootstrap` lifecycle 체인 — NestJS 계약에 의해 순서 보장, race 조건 없음 | 두 서비스 lifecycle hook | 현재 구조 유지 |
| 6 | Requirement | `WORKFLOW_EXECUTOR` DI 토큰이 spec `4-nodes/0-overview.md` 에 미언급 — spec 이 DI 바인딩 세부사항에 침묵함은 의도적. spec 갱신 불필요 | `spec/4-nodes/0-overview.md` | 변경 없음 |
| 7 | Requirement | `NodeBootstrapService` 신설로 spec `§1.0` 핵심 계약("NodeComponentRegistry 가 서버 부팅 시 ALL_NODE_COMPONENTS 를 순회하여 등록") 불변 유지 | 해당 없음 (트리거 진입점만 이동) | 변경 없음 |
| 8 | Testing | `node-bootstrap.service.spec.ts` 2번째 테스트 케이스가 1번째와 동일한 단언 수행 — 중복 (기능적 오류 없음) | `node-bootstrap.service.spec.ts` | 2번째 케이스 제거 또는 다른 시나리오로 대체 |
| 9 | Testing | `assertConsistency` 를 직접 단언하는 통합 테스트 없음 — e2e 스모크가 실부팅 커버하므로 필수 아님 | `execution-engine.service.spec.ts` | 선택적 통합 테스트 추가 |
| 10 | Documentation | `ExecutionEngineService` 클래스 레벨 JSDoc 의 책임 범위 설명이 PR1 이후 상태를 완전히 반영하지 않음 — god-class 분해 진행 중이므로 PR4 완료 시 일괄 업데이트 적절 | `execution-engine.service.ts` 클래스 JSDoc | PR 시리즈 완료(PR4) 시 일괄 업데이트 |
| 11 | Documentation | 신설 `NodeBootstrapService` 클래스 JSDoc 우수 — 역할·배경·spec 참조·lifecycle 시점 안전성 5개 측면 서술 | `node-bootstrap.service.ts` lines 10–29 | 없음 |
| 12 | Scope | 8개 변경 파일 전체가 PR1 체크리스트와 1:1 대응, 범위 이탈 없음 | 전체 diff | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | DI 토큰 평문 문자열 (관용 패턴), assertSameWorkspace fail-open (기존 코드) — 즉각적 위협 없음 |
| architecture | LOW | NodeBootstrapService 레이어 배치 차선책(PR2에서 개선 예정), god-class 잔류(의도된 점진 전략) |
| requirement | NONE | spec 계약 완전 충족, forwardRef 제거 안전성 확인, 기능 완전성 검증 |
| scope | NONE | 범위 이탈 없음, 8개 파일 전부 PR1 체크리스트와 대응 |
| side_effect | NONE | 공개 API 시그니처 불변, 런타임 핸들러 디스패치 결과 동일, 전역 부작용 없음 |
| maintainability | LOW | onModuleInit 주석 누락(WARNING), 테스트 케이스 중복(INFO) |
| testing | LOW | service.spec.ts 에 불필요한 NodeHandlerDependenciesProvider 잔류(WARNING) |
| documentation | NONE | 신설 파일 JSDoc 우수, stale 주석 갱신 완료, README/CHANGELOG 업데이트 불필요 |

## 라우터 결정

- **실행 (ran)**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
- **제외 (skipped)**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명) — DI 리팩토링이라 실행경로·의존성·DB·동시성·API계약·유저가이드 무관

## 권장 조치사항 (developer 처분)

1. **(즉시 fix)** W4 — `onModuleInit` 에 bootstrap 이전 명시 주석 추가.
2. **(즉시 fix)** W3 — `execution-engine.service.spec.ts` 의 불필요한 `NodeHandlerDependenciesProvider` 잔류 제거.
3. **(즉시 fix)** INFO-8 — 중복 테스트 케이스 정리.
4. **(수용)** W1·W2 — 의도된 strangler-fig step1 한계. PR2(`EngineDriver`)·PR3·PR4 로 해소 (plan 명시).
5. **(후속 plan 반영)** INFO-2 — `assertSameWorkspace` fail-closed 전환 검토를 후속 PR plan 에 명시.
