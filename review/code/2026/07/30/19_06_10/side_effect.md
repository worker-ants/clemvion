# 부작용(Side Effect) 코드 리뷰 — workflow duplicate 캔버스 복사

대상: `WorkflowsService.duplicate()` 재구현(`codebase/backend/src/modules/workflows/workflows.service.ts`) +
`workflows.controller.ts`(Swagger 설명 텍스트) + `workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`(테스트).
`git diff --stat 71ce6c12b HEAD -- codebase/` 로 실제 런타임 코드 변경이 이 4개 파일뿐임을 확인했다(그 외
CHANGELOG.md·ui-tour.mdx(ko/en)·plan 문서·review 산출물은 문서/보고서이며 코드 실행 경로가 아니므로 본
관점(부작용)의 핵심 대상에서 제외).

## 발견사항

- **[INFO]** `duplicate()`의 신규 2-인자 `transaction(isolationLevel, cb)` 호출이 파일 전체가 공유하는 Jest
  테스트 더블 `mockDataSource.transaction` 의 호출 계약을 바꿔야 했음 — 검증 결과 하위호환 안전
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:245`(`this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})`, 2-인자) — 같은 파일의 다른 3개 호출부는 여전히 1-인자: `:169`(`create`), `:409`(`importWorkflow`), `:531`(`saveCanvas`). 대응하는 테스트 더블: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:90-99`
  - 상세: `mockDataSource` 는 `describe('WorkflowsService', ...)` 최상위 스코프에 단 한 번 선언되어(spec.ts:90) `create`/`update`/`remove`/`duplicate`/`saveCanvas`/`importWorkflow` 등 파일 내 **모든** `describe` 블록이 공유한다. 기존 구현은 `transaction: jest.fn().mockImplementation((cb) => cb(mockTransactionManager))` 로 "콜백은 항상 첫 번째이자 유일한 인자" 를 가정했는데, `duplicate()` 가 `transaction(isolationLevel, cb)` 형태로 호출하면서 이 가정이 깨져(콜백이 두 번째 인자) 이 한 줄의 mock 변경이 파일 전체 테스트 스위트에 영향을 줄 수 있는 변경이었다. 실제 반영된 수정은 `args.find((a) => typeof a === 'function')` 로 인자 개수/위치와 무관하게 콜백을 찾도록 일반화했다(`executions.service.spec.ts` 선례 재사용, RESOLUTION.md WARNING #1에도 기록). 직접 검증한 결과: (1) 1-인자 호출부(`create`/`importWorkflow`/`saveCanvas`) 는 `args.find` 가 인덱스 0에서 그대로 콜백을 찾아 동작 변화 없음, (2) `mockDataSource.transaction` 에 대한 기존 단언은 전부 `toHaveBeenCalled()`/`not.toHaveBeenCalled()` 뿐(`spec.ts:362,712,762`)이라 인자 개수·형태를 강제하는 단언이 없어 깨질 여지가 없음. 즉 공유 테스트 더블의 계약 변경이 필요했지만 하위호환적으로 안전하게 처리됐다.
  - 제안: 조치 불필요(이미 안전 확인됨). 향후 `duplicate()` 처럼 isolation level 을 지정하는 새 호출부를 추가할 때는 이 variadic 어댑터 패턴을 그대로 재사용할 것 — `mockDataSource` 가 파일 전역 공유 상태이므로 어떤 describe 블록이든 이 mock 의 호출 계약을 바꾸면 전체 스위트에 영향을 준다는 점을 기억해 둘 필요가 있다.

- **[INFO]** `duplicate` describe 의 `beforeEach` 가 파일 전역 공유 객체 `mockTransactionManager` 의
  `.find`/`.save` 를 재대입해 인접 `saveCanvas` describe 로 오염이 전파될 수 있었으나, 같은 diff 안에서 이미
  명시적으로 차단됨
  - 위치: 오염원 — `codebase/backend/src/modules/workflows/workflows.service.spec.ts:502-513`(`duplicate` describe 의 `beforeEach` 가 `mockTransactionManager.find`/`.save` 를 5노드/2엣지 fixture 로 재정의). 방어 코드 — `:729-735`(`saveCanvas` describe 자신의 `beforeEach` 가 동일 두 속성을 `[]`/기본 페이로드로 재설정, 주석에 "실제 계측 확인됨" 명시)
  - 상세: `mockTransactionManager` 는 여러 `describe` 블록이 공유하는 모듈 스코프 객체이고, 최상위 `beforeEach`(`spec.ts:124`)의 `jest.clearAllMocks()` 는 호출 이력만 지울 뿐 `mockImplementation` 자체는 지우지 않는다. 따라서 `duplicate` describe 가 먼저 실행되며 `.find`/`.save` 에 자신의 fixture 를 얹어두면, 파일 순서상 다음에 오는 `saveCanvas` describe(및 그 중첩 `graphWarningRules backend enforcement` 등)가 이를 그대로 물려받아 "기존 노드/엣지 없음" 을 전제한 테스트에 유령 데이터가 섞여 들어갈 수 있었다 — 이는 정확히 이 리뷰 관점의 1번 항목("함수가 예상 외의 전역/공유 상태를 변경하는지")에 해당하는 사례다. 다만 이 diff 자체가 `saveCanvas` 의 `beforeEach` 에 명시적 재설정을 추가해 이미 차단했고(주석이 재현 절차까지 기록), 직접 소스를 읽어 그 방어 코드가 실제로 존재함을 확인했다. 순수 테스트 인프라 범위이며 런타임 프로덕션 코드에는 영향 없음.
  - 제안: 조치 불필요(이미 반영됨). 향후 `mockTransactionManager` 의 메서드를 재대입하는 새 describe 를 추가할 때는 이번에 적용된 패턴(그 describe 자신의 `beforeEach` 에서 명시적으로 되돌리기)을 표준으로 따를 것 — 암묵적으로 이전 describe 의 잔여값에 의존하지 말 것.

- **[INFO]** (긍정적 변경) `tags`/`settings` 방어적 얕은 복사로 사본↔원본 참조 공유(에일리어싱) 부작용 제거
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:252`(`tags: [...(original.tags ?? [])]`), `:254`(`settings: { ...(original.settings ?? {}) }`) — cf. 기존 코드(`git show 71ce6c12b:...workflows.service.ts` 199-206행 부근) `tags: original.tags` / `settings: original.settings`
  - 상세: 수정 전 코드는 `original`(트랜잭션 밖에서 조회된, 인메모리에 남아있는 엔티티)의 `tags` 배열과 `settings` 객체 참조를 그대로 사본 엔티티에 얹었다 — 사본을 이후 어디선가 변이하면(예: `copy.tags.push(...)`) 원본 인메모리 객체까지 함께 오염되는 잠재적 side-channel 이었다(실제로 트리거되려면 반환된 `Workflow` 를 호출부가 in-place 로 변이해야 하므로 이번 diff 이전에도 발현 확률은 낮았음). 이번 diff 는 두 필드 모두 방어적 복사로 바꿔 이 경로를 원천 차단했다 — 새로 생긴 리스크가 아니라 기존 잠재 리스크의 제거이며, unit 테스트("원본의 node·edge row 를 수정하지 않는다", `.spec.ts:663` 부근)가 원본 fixture 가 in-place 로 변이되지 않음을 함께 고정하고 있다.
  - 제안: 없음 — 참고용 긍정 기록.

## 확인 완료 (부작용 관점 — 문제 없음)

- **시그니처 변경 없음**: `duplicate(id: string, workspaceId: string, userId: string): Promise<Workflow>` 파라미터·반환 타입 모두 변경 없음(`git show 71ce6c12b:...workflows.service.ts` 대비 동일). 저장소 전체에서 이 메서드의 유일한 호출자는 `workflows.controller.ts:229` 뿐이며(grep 확인, `ioredis` 클라이언트의 무관한 `duplicate()` 제외) 그 호출부도 무변경.
- **공개 인터페이스**: `POST /api/workflows/:id/duplicate` 의 라우트·HTTP 메서드·`@Roles('editor')`·응답 래퍼(`WorkflowDto`)가 전부 불변. 유일한 변경은 `@ApiOperation.description` 텍스트뿐(`workflows.controller.ts:215`) — 스키마·계약 변경 아님.
- **전역 변수**: 신규 모듈 스코프 상수/싱글턴 도입 없음. 기존 `MANUAL_TRIGGER_TYPE`/`AI_NODE_TYPES_WITH_LLM_CONFIG` 등은 이 diff 의 대상이 아님.
- **파일시스템**: `workflows.service.ts`/`workflows.controller.ts` 는 파일 I/O 를 전혀 수행하지 않는다(순수 DB 트랜잭션 코드). CHANGELOG.md·ui-tour.mdx(ko/en)·plan 문서·`review/**` 산출물은 이번 세션이 명시적으로 작성하는 SDD 워크플로 문서이지, `duplicate()` 코드 실행이 유발하는 예기치 못한 파일 부작용이 아니다.
- **환경 변수**: 이번 diff 의 4개 코드 파일 어디에도 `process.env` 읽기/쓰기 없음.
- **네트워크/외부 서비스 호출**: 추가된 서비스 호출 없음. 특히 `ModelConfigService.findDefault`(기본 LLM 자동 주입)와 `WorkflowVersionsService.createVersion`(버전 스냅샷) 이 `duplicate()` 경로에서 호출되지 않음을 신규 unit 테스트가 직접 단언한다(`import 전용 게이트를 적용하지 않는다 — ...`, `버전 이력을 승계하지 않는다 — ...`, 두 테스트 모두 `.spec.ts` `describe('duplicate', ...)` 내부).
- **이벤트/콜백**: 신규 이벤트 발행이나 감사 로그(`audit-actions`) 호출 추가 없음 — 해당 레지스트리가 workflow CRUD 액션 자체를 아직 구현하지 않은 기존 상태를 그대로 유지(별도 consistency-checker 산출물의 확인과 일치).
- **트랜잭션 경계 이탈 없음**: `duplicate()` 트랜잭션 콜백(`:245-332`) 내부는 전부 주입된 `manager.*` 로만 DB 접근하며, 콜백 안에서 `this.workflowRepository`/`this.nodeRepository`/`this.edgeRepository`(트랜잭션 밖 기본 레포지토리)를 실수로 사용해 트랜잭션 경계를 이탈하는 코드가 없음을 직접 확인.

## 요약

`WorkflowsService.duplicate()` 를 "메타 row 단일 저장"에서 "workflow+node+edge 를 `REPEATABLE READ` 트랜잭션으로 원자적 복제"로 재구현한 변경이며, 부작용 관점의 8개 점검 축(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트) 중 실질적 결함은 발견되지 않았다. 공개 메서드 시그니처와 HTTP 계약은 완전히 보존되고, 새로운 전역 변수·파일 I/O·환경 변수 접근·네트워크 호출·이벤트 발행은 없다(뒤 세 가지는 직접 unit 테스트 단언으로 재확인). 유일하게 "부작용" 이라는 렌즈에서 실제로 흥미로운 지점은 테스트 인프라 층위였다 — `duplicate()` 가 도입한 2-인자 `transaction()` 호출이 파일 전체가 공유하는 `mockDataSource.transaction` 더블의 계약을 바꿔야 했고, `duplicate` describe 의 `beforeEach` 가 공유 객체 `mockTransactionManager` 의 `.find`/`.save` 를 재대입해 인접 `saveCanvas` describe 를 오염시킬 수 있었다. 두 사안 모두 직접 소스를 읽어 확인한 결과, 같은 diff 안에서 이미 하위호환적으로(전자) 또는 명시적 재설정으로(후자) 안전하게 처리되어 있다. 부수적으로, 사본 생성 시 `tags`/`settings` 를 원본과 참조를 공유하던 기존 코드의 잠재적 에일리어싱 위험도 이번 diff 가 방어적 얕은 복사로 제거했다(긍정적 부수 개선). 프로덕션 런타임 코드에 남아 있는 미해결 부작용 리스크는 없다고 판단한다.

## 위험도

LOW
