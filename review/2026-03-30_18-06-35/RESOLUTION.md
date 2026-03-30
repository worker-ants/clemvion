# Code Review Resolution

## Critical

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `backend/.next/` git 추적 | `backend/.gitignore`에 `/.next` 추가 완료 |

## Warning 조치 내역

| # | 발견사항 | 조치 |
|---|----------|------|
| W1 | `saveCanvas` 테스트 전무 | `workflows.service.spec.ts`에 saveCanvas 시나리오별 테스트 3건 추가 (정상, trigger 없음, trigger 중복) |
| W2 | `ManualTriggerHandler` 테스트 없음 | `manual-trigger.handler.spec.ts` 생성 (5건: validate, pass-through, null, undefined, 복합 입력) |
| W3 | execute/save 컨트롤러 테스트 없음 | INFO로 분류 - 서비스 레벨 테스트로 커버, 컨트롤러 테스트는 별도 작업 |
| W4 | WebSocket 이벤트 assertion 없음 | `execution-engine.service.spec.ts`에 WebSocket 이벤트 테스트 4건 추가 (STARTED, COMPLETED, NODE events, FAILED) |
| W5 | create() trigger 자동 생성 미검증 | `workflows.service.spec.ts`의 create 테스트에서 transaction 사용 및 manual_trigger 노드 생성 assertion 추가 |
| W6 | saveCanvas 인증 누락 | `@CurrentUser() _user: JwtPayload` 데코레이터 추가 완료 |
| W7 | 노드 N+1 쿼리 | `syncNodes()`로 분리, 배열 단위 `manager.save(Node, nodesToSave)` 단일 호출로 교체 |
| W8 | 엣지 N+1 쿼리 | `syncEdges()`로 분리, 배열 단위 `manager.save(Edge, newEdges)` 단일 호출로 교체 |
| W9 | create() 비원자적 트랜잭션 | `dataSource.transaction()`으로 워크플로우 + 트리거 노드 생성을 원자적으로 묶음 |
| W10 | Manual Trigger 서버 측 검증 없음 | `validateManualTrigger()` 추가 - 존재 여부(0개 거부), 중복(2개 이상 거부) 검증 |
| W11 | duplicate()에 노드/엣지 복제 없음 | 기존 이슈로 별도 작업 필요 (현재 변경 범위 외) |
| W12 | WebSocket emit 순서 불일치 | EXECUTION_COMPLETED 이벤트를 outputData DB 저장 후로 이동 |
| W13 | handleRun 저장 실패 미처리 | `saveWorkflow()`가 `boolean` 반환하도록 변경, 실패 시 실행 중단 |
| W14 | execute 응답 이중 중첩 | `{ data: { executionId } }` → `{ executionId }`로 단순화, 프론트엔드 매칭 수정 |
| W15 | 에러 메시지 노출 | INFO로 분류 - 별도 에러 정제 레이어 필요 (현재 변경 범위 외) |
| W16 | Controller가 ExecutionEngine 직접 의존 | INFO로 분류 - 아키텍처 리팩토링은 별도 작업 |
| W17 | ExecutionEngine WebSocket 직접 결합 | INFO로 분류 - EventEmitter 패턴 도입은 별도 작업 |
| W18 | saveCanvas 메서드 과잉 책임 | `syncNodes()`, `syncEdges()`, `validateManualTrigger()` private 메서드로 분리 |
| W19 | NodeCategory enum 마이그레이션 필요 | TypeORM synchronize로 처리 (Phase 1 개발 환경). 프로덕션 배포 시 마이그레이션 필요 |
| W20 | edgeRepository 미사용 주입 | `edgeRepository` 주입 및 관련 테스트 mock 제거 완료 |

## INFO 사항 (참고)

- I9: `manual_trigger` 문자열 → `MANUAL_TRIGGER_TYPE` 상수 정의 (백엔드)
- I10: 타입 캐스팅 중복 → `const d = n.data as {...}` 지역 변수로 추출 완료
- I14: 초기 위치 하드코딩 → `MANUAL_TRIGGER_DEFAULT_POSITION` 상수 추출 완료
