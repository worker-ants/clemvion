# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 항목 없음.

모든 변경이 커밋 메시지 및 plan `c1-engine-split.md` 의 PR1 체크리스트와 1:1 대응한다.

---

파일별 범위 적합성 요약:

| 파일 | 판정 | 근거 |
|---|---|---|
| `execution-engine.module.ts` | 적합 | WORKFLOW_EXECUTOR 토큰·NodeBootstrapService provider 등록 — PR1 체크리스트 3번 |
| `execution-engine.service.ts` | 적합 | ALL_NODE_COMPONENTS·componentRegistry·handlerDeps·registerHandlers 제거 — PR1 체크리스트 4번 |
| `node-bootstrap.service.ts` | 적합 | 신규 서비스 본체 — PR1 체크리스트 2번 |
| `node-bootstrap.service.spec.ts` | 적합 | 신규 서비스 단위 테스트 — PR1 체크리스트 6번 |
| `nodes.module.ts` | 적합 | gratuitous forwardRef 제거 — PR1 체크리스트 5번에 명시 |
| `node-component.interface.ts` | 적합 | stale 주석 2건 갱신(registerHandlers → NodeBootstrapService) — PR1 체크리스트 4번 후단 |
| `workflow-executor.interface.ts` | 적합 | WORKFLOW_EXECUTOR 토큰 co-locate — PR1 체크리스트 1번 |
| `plan/in-progress/refactor/c1-engine-split.md` | 적합 | plan 라이프사이클 규약(CLAUDE.md) 준수 |

세부 점검 결과:

- **의도 이상의 변경**: 없음. `execution-engine.service.ts` 에서 제거된 임포트(`Inject`, `forwardRef`, `NodeComponentRegistry`, `ALL_NODE_COMPONENTS`, `NodeHandlerDependenciesProvider`)와 생성자 파라미터(`componentRegistry`, `handlerDeps`) 는 모두 `registerHandlers` 제거의 직접 연쇄이며, `onModuleInit` 잔류 코드(queue depth gauge 등록)는 신규 서비스 범위 밖 기존 책임으로 올바르게 유지된다.
- **불필요한 리팩토링**: 없음. `nodes.module.ts` 의 forwardRef 제거는 `NodeBootstrapService` 신설로 실제 순환이 해소됐기 때문에 발생한 필수 후속 정리이며, 커밋 메시지가 명시한다.
- **기능 확장**: 없음. `NodeBootstrapService` 는 `registerHandlers` 의 책임 이동만이다.
- **무관한 수정**: 없음. 변경된 파일 8개 전부 선언된 작업과 직접 연관된다.
- **포맷팅 변경**: 없음. 순수 의미 변경만 존재하며 공백·줄바꿈 drift 없음.
- **주석 변경**: `node-component.interface.ts` 2건은 `ExecutionEngineService.registerHandlers` 라는 이미 사라진 경로를 가리키는 stale 주석의 교정이다. 적합.
- **임포트 변경**: 제거된 임포트 전부 dead import가 됐기 때문에 제거됨. 추가된 임포트(WORKFLOW_EXECUTOR, NodeBootstrapService)는 신규 코드가 필요로 한다.
- **설정 변경**: 없음.

## 요약

8개 파일 전체가 커밋 메시지에 명시된 C-1 strangler-fig step1(PR1) 범위 내에 있다. 신규 서비스 신설·토큰 추출·god-class 의존 제거·순환 참조 해소·stale 주석 정정·테스트·plan 추적까지 선언된 체크리스트와 빠짐없이 대응하며, 선언 범위 밖 변경은 발견되지 않았다.

## 위험도

NONE
