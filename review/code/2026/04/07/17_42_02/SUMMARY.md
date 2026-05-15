파일 쓰기 권한이 필요합니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — back-edge 기반 순환 실행 구현은 전반적으로 양호하나, `targetIndex=-1` 무한루프 위험, `executedNodes` 미초기화로 인한 루프 재진입 오작동, DB N+1 쿼리 증폭 등 실제 동작에 영향을 줄 수 있는 구조적 결함이 다수 발견됨.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 안전성 | **`targetIndex = -1` 무한루프 위험**: back-edge target이 `sortedNodeIds`에 없을 때 `indexOf`가 `-1` 반환 → `pointer = -1` → `while` 조건 통과 → 무한루프 또는 `undefined` 노드 실행 | `execution-engine.service.ts`, backEdgeMap 구성 루프 | `targetIndex < 0`인 경우 `continue`로 skip |
| 2 | 정확성 | **루프 재진입 시 `executedNodes` 미초기화**: back-edge 점프 시 `portRoutingSkipped`는 초기화하지만 `executedNodes`는 유지되어, 재실행 구간 노드가 이전 캐시 출력을 입력으로 사용함 | `execution-engine.service.ts`, back-edge 활성화 후 포인터 되감기 구간 | `activated.targetIndex ~ pointer` 범위 노드를 `executedNodes`에서 제거하거나 의도라면 주석 명시 |
| 3 | 정확성 | **back-edge 타겟이 스타트 노드일 때 루프 데이터 미전달**: `incomingEdges.length === 0`인 스타트 노드가 back-edge 타겟이면 매 반복마다 원래 `workflowInput`이 사용됨 | `execution-engine.service.ts`, `gatherNodeInput` 메서드 | back-edge 타겟 노드에 back-edge 소스 출력을 입력으로 주입하는 로직 추가 |
| 4 | 보안/안정성 | **`MAX_NODE_ITERATIONS=0` 무제한 루프 DoS 위험**: `0` 설정 시 반복 가드 비활성화 → 무한루프 시 OOM 또는 영구 응답 불가 | `execution-engine.service.ts:296-304` | `0` 설정 시 경고 로그 필수 출력. 절대 상한선 또는 전체 실행 타임아웃 Guard 추가 |
| 5 | 성능/DB | **DB N+1 쿼리 순환 실행으로 증폭**: `executeNode`의 `findOneBy + save` 패턴이 `MAX_NODE_ITERATIONS`배로 증폭. 단일 노드만으로 최대 200번의 DB 왕복 가능 | `execution-engine.service.ts`, `executeNode` 내 `executionPath` 업데이트 | 인메모리 누적 후 실행 완료 시 일괄 저장. 또는 `array_append` 원자적 UPDATE로 교체 |
| 6 | 데이터 정합성 | **트랜잭션 부재로 순환 실행 중 상태 불일치 위험 증가**: 반복 실행 중 서버 크래시 시 `Execution.status=RUNNING`과 불완전한 `NodeExecution` 불일치 상태 | `execution-engine.service.ts`, `runExecution` 전체 흐름 | 노드 실행 완료 처리를 단일 트랜잭션으로 묶음 |
| 7 | 보안 | **에러 메시지에 내부 노드 정보 노출**: 반복 초과 에러에 `node.label ?? node.type`, `maxNodeIterations` 포함 → API 응답으로 내부 구조 노출 | `execution-engine.service.ts:298` | 에러 코드(`MAX_ITERATIONS_EXCEEDED`)와 일반 메시지로 분리 |
| 8 | 호환성 | **순환 그래프 에러 응답 메시지 Breaking Change**: 기존 즉시 실패 → 반복 초과 후 실패로 변경. 에러 메시지 파싱 클라이언트에 behavioral breaking change | WebSocket `execution.failed` 이벤트 | `errorCode: "MAX_ITERATIONS_EXCEEDED"` 필드 추가 |
| 9 | 테스트 | **`service['configService']` private 필드 직접 접근**: 필드명 변경 시 런타임에 조용히 실패하거나 잘못된 값으로 테스트 통과 위험 | `execution-engine.service.spec.ts` (~line 851, 905) | 별도 `describe` + `overrideProvider`로 독립 모듈 구성 |
| 10 | 테스트 | **self-loop (`A → A`) 케이스 미테스트**: 자기 참조 엣지가 back-edge로 올바르게 분류되는지 검증 없음 | `back-edge-identifier.spec.ts` | `A → A` 단위 테스트 추가 |
| 11 | 테스트 | **`portRoutingSkipped` 리셋 동작 검증 테스트 없음**: 첫 루프에서 스킵된 노드가 back-edge 이후 재실행 구간에서 정상 실행되는지 검증 없음 | `execution-engine.service.spec.ts` | 순환 실행 + 포트 라우팅 분기 조합 테스트 추가 |
| 12 | 설계 | **`_selectedPort` 없는 노드의 back-edge 항상 활성화**: pass-through 노드가 back-edge 소스인 경우 무조건 루프백되어 탈출 불가 | `execution-engine.service.ts`, `findActivatedBackEdge` | 스펙에 탈출 방법 명시. 필요시 `isDefault` 플래그 또는 명시적 활성화 조건 도입 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | **`sortedNodeIds.indexOf()` O(n) 반복**: back-edge마다 배열 선형 탐색 O(k×n) 누적 | `execution-engine.service.ts`, backEdgeMap 구성 루프 | 사전 `Map<id, index>` 생성 후 O(1) 조회로 교체 |
| 2 | 성능 | **`portRoutingSkipped` 초기화 O(range)**: 루프 구간이 넓을수록 범위 삭제 연산 누적 | `execution-engine.service.ts:~435` | 현재 제한 하에서 실질적 영향 제한적. 버전-카운터 방식 개선 가능 |
| 3 | 성능 | **`configService.get()` 매 실행마다 호출**: 정적 설정값을 constructor에서 캐싱 가능 | `execution-engine.service.ts:~284` | `private readonly maxNodeIterations`로 constructor에서 1회 캐싱 |
| 4 | 문서화 | **`findActivatedBackEdge` JSDoc 불완전**: `@param`/`@returns` 없음. `null` 반환 의미 미기술 | `execution-engine.service.ts`, `findActivatedBackEdge` | `@param`, `@returns` 태그 추가 |
| 5 | 문서화 | **`backEdgeMap` 구성 주석 부재**: `targetIndex` 선계산 의도와 런타임 사용 방식 설명 없음 | `execution-engine.service.ts:267-278` | 블록 상단에 선계산 의도 주석 추가 |
| 6 | 문서화 | **`MAX_NODE_ITERATIONS` `.env.example` 미반영** | `backend/.env.example` | `MAX_NODE_ITERATIONS=100` 항목 추가 (기본값, `0=무제한` 주석 포함) |
| 7 | 정리 | **`cycle-detector.ts` dead code 가능성**: `detectCycle` 제거 후 해당 파일 미참조 가능성 | `execution-engine.service.ts:22` | 미사용 확인 후 삭제 검토 |
| 8 | 설정 | **`ConfigModule` 중복 등록 가능성**: `AppModule`에서 `isGlobal: true`이면 feature 모듈에서 import 불필요 | `execution-engine.module.ts:20` | 전역 등록 확인 후 중복 제거 |
| 9 | 설계 | **외부 참조 엣지의 `forwardEdges` 자동 분류 미문서화**: `nodeIds` 미포함 엣지가 암묵적으로 `forwardEdges`에 포함 | `back-edge-identifier.ts:26-30` | 인라인 주석으로 의도 명시 |
| 10 | DB | **`nodeExecutionCount` 인메모리 한정**: 서버 재시작 후 카운터 초기화로 무한루프 방어 우회 가능 | `execution-engine.service.ts:284` | Resume 기능 구현 시 DB/Redis 영속화 고려 |
| 11 | DB | **`NodeExecution` 복합 인덱스 확인 필요**: 순환 실행으로 동일 노드 레코드 N개 생성 → `(execution_id, node_id)` 조회 빈도 증가 | `node_executions` 테이블 | 복합 인덱스 설정 여부 확인 |
| 12 | 테스트 | **재실행 구간 노드의 실제 입력값 검증 없음**: 두 번째 루프에서 올바른 데이터 전달 assertions 없음 | `execution-engine.service.spec.ts` | 루프 재실행 중 노드 input 캡처하여 검증 추가 |
| 13 | 테스트 | **순환 + Form 노드 조합 시나리오 미테스트** | `execution-engine.service.spec.ts` | Form 노드 일시 정지/재개 + back-edge 활성화 조합 테스트 추가 |
| 14 | 테스트 | **순환 실행 중 노드 에러 정책 조합 미테스트** | `execution-engine.service.spec.ts` | `skip`/`stop_workflow`/`use_default` 정책 + 순환 실행 조합 테스트 추가 |
| 15 | 동시성 | **동시 실행 제한 미구현**: 스펙 §8의 동시 실행 제한이 코드 레벨에서 강제되지 않음 | `execute()` 메서드 | 현재 범위 밖이라면 TODO 주석으로 gap 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | **MEDIUM** | `targetIndex=-1` 무한루프, `executedNodes` 미초기화 |
| architecture | **MEDIUM** | `targetIndex` 방어코드 누락, `runExecution` 단일책임 위반 심화 |
| requirement | **MEDIUM** | `executedNodes`/`nodeOutputCache` 미초기화, 스타트 노드 back-edge 데이터 미전달 |
| testing | **MEDIUM** | private 필드 접근 취약성, self-loop 미테스트, `targetIndex=-1` 미가드 |
| database | **MEDIUM** | N+1 쿼리 순환 증폭, 트랜잭션 부재 |
| security | **LOW** | `MAX_NODE_ITERATIONS=0` DoS, 에러 메시지 내부 정보 노출 |
| performance | **LOW** | `indexOf` O(n) 반복, `portRoutingSkipped` 초기화 비용 |
| maintainability | **LOW** | `runExecution` 과도한 길이, private 접근 패턴 |
| api_contract | **LOW** | 순환 에러 메시지 behavioral breaking change |
| documentation | **LOW** | JSDoc 불완전, `.env.example` 누락 |
| concurrency | **LOW** | `executedNodes` 상태 불일치 가능성 |
| scope | **LOW** | 외부 엣지 암묵적 처리 미문서화 |
| dependency | **NONE** | 신규 외부 패키지 없음 |

---

## 발견 없는 에이전트
- **dependency**: 신규 외부 패키지 도입 없음. `@nestjs/config`는 기존 표준 패키지. 의존성 관련 위험 없음.

---

## 권장 조치사항

### 즉시 처리 필요
1. **`targetIndex = -1` 방어 코드** — back-edge 타겟이 `sortedNodeIds`에 없을 때 `continue` 처리로 무한루프 방지 (WARNING #1)
2. **`executedNodes` 재실행 구간 초기화** — back-edge 점프 시 해당 범위 노드 제거 또는 의도라면 주석 명시 (WARNING #2)
3. **back-edge 타겟 스타트 노드 입력 처리** — `gatherNodeInput`에서 back-edge 데이터 주입 로직 추가 또는 스펙 명시 (WARNING #3)

### 단기 처리 권장
4. **`MAX_NODE_ITERATIONS=0` 경고 로그** (WARNING #4)
5. **WebSocket 에러 코드 필드 추가** (WARNING #8)
6. **DB `executionPath` 업데이트 최적화** — 인메모리 누적 후 일괄 저장 (WARNING #5)
7. **self-loop 테스트 추가** (WARNING #10)
8. **`configService` 테스트 패턴 개선** — `overrideProvider` 사용 (WARNING #9)

### 중기 처리 권장
9. **`sortedNodeIds` 인덱스 맵 최적화** O(n) → O(1) (INFO #1)
10. **JSDoc 보완** — `findActivatedBackEdge`, `backEdgeMap` 블록 (INFO #4, #5)
11. **`backend/.env.example`** — `MAX_NODE_ITERATIONS=100` 추가 (INFO #6)
12. **`cycle-detector.ts` dead code 정리** (INFO #7)
13. **트랜잭션 처리 도입** (WARNING #6)