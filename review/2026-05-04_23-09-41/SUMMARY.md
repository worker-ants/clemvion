# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `executor.email` PII 노출과 `findById` 상세 엔드포인트 신규 필드 누락이 운영 환경에서 실질적 영향을 줄 수 있음. 나머지 구현 품질은 전반적으로 양호.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / API Contract | `findById`(실행 상세) 엔드포인트에 `triggerSource`/`triggerLabel` 누락. `ExecutionDetailDto extends ExecutionDto`이므로 Swagger 스펙은 두 필드 포함을 선언하지만 실제 응답에는 없음 | `executions.service.ts` — `findById()` | `findById`에도 `toExecutionDto()` + `loadParentWorkflowNames()` 변환 적용; 또는 상세 뷰가 요구사항 범위 밖임을 스펙에 명시 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / PII | `executor.name`이 null이면 `executor.email`이 `triggerLabel`로 API 응답에 그대로 노출. 같은 워크스페이스 내 모든 열람자가 실행자 이메일 확인 가능 | `execution-trigger.ts:36`, `executions.service.ts` `addSelect(['executor.email'])` | 이메일 직접 포함 금지. 마스킹(`a***@x.com`) 또는 `executorId`만 반환 후 프론트에서 별도 권한으로 조회 |
| 2 | Security / Tenant | `loadParentWorkflowNames` 쿼리에 워크스페이스 범위 필터 없음. DB 무결성 제약 미흡 시 타 테넌트 `workflow.name` 유출 가능 | `executions.service.ts:130-145` | `find` 쿼리에 `workspaceId` 조건 추가 |
| 3 | Security / IDOR | `findByWorkflow` 서비스 레이어에 소유권 검증 없음. 서비스 직접 호출 경로 추가 시 IDOR 취약점 | `executions.service.ts:49-83` | `userId`/`workspaceId` 파라미터 추가하거나 컨트롤러 가드 처리됨을 주석 명시 |
| 4 | Concurrency | `stop()`: `findOne` → 상태 체크 → `save` 구간에 트랜잭션/락 없음. 동시 stop 요청 시 TOCTOU 경쟁 조건 | `executions.service.ts` — `stop()` | 낙관적 락(`@Version()`) 또는 단일 원자 UPDATE 적용 |
| 5 | Concurrency | `cancelWaitingExecution` 호출에 `await` 누락. 다음 줄 `findOne` re-fetch가 stale 상태 반환 가능 | `executions.service.ts` — `stop()` WAITING_FOR_INPUT 분기 | `await` 추가 또는 fire-and-forget 설계라면 `findOne` re-fetch를 재시도 루프로 교체 |
| 6 | Architecture / Consistency | `findById`는 raw `Execution` 엔티티 반환, `findByWorkflow`는 `ExecutionDto` 반환으로 같은 서비스 내 추상화 계층 불일관 | `executions.service.ts:27` vs `:49` | `findById`도 `ExecutionDetailDto` 반환으로 통일 |
| 7 | Architecture / Dependency | `ExecutionTriggerSource` 유니온 타입이 백엔드 2곳 + 프론트엔드 1곳에 각각 중복 선언. 누락 시 컴파일 에러 미발생 | `execution-trigger.ts:1`, `execution-response.dto.ts:4`, `frontend/.../executions.ts:32` | `as const` 배열 + `typeof` 파생 패턴으로 단일 정의; 중기적으로 `packages/shared-types` 도입 |
| 8 | Requirement / Type | 프론트 `triggerSource?` optional vs 백엔드 required 타입 계약 불일치. `?? "unknown"` 방어 코드가 불일치를 숨김 | `execution-response.dto.ts:33`, `frontend/.../executions.ts:48` | `triggerSource: ExecutionTriggerSource`(필수)로 변경 |
| 9 | Performance | `loadParentWorkflowNames`가 `workflow.name` 하나를 위해 `Execution` + `Workflow` 전체 컬럼(JSON 포함) 로드 | `executions.service.ts:131` | QB로 `pe.id`, `wf.name` 두 컬럼만 SELECT |
| 10 | Requirement | `executor.name === ""`(빈 문자열)일 때 `??`가 email로 폴백하지 않아 빈 문자열이 `triggerLabel`로 반환됨 | `execution-trigger.ts:38` | `?? executor?.email` → `\|\| executor?.email` |
| 11 | Testing | `executionRepo.find` 호출 인자(`In(parentIds)`, `relations: ['workflow']`) 미검증. 쿼리 조건 변경 시 테스트 통과 | `executions.service.spec.ts:141` | `toHaveBeenCalledWith` 인자 검증 추가 |
| 12 | Testing | 서로 다른 `parentExecutionId` 혼합 배치 케이스 미검증. 현재 테스트는 모두 `p1` 공유 | `executions.service.spec.ts:113-143` | `p1`, `p2` 두 부모를 가진 케이스 추가 |
| 13 | Testing / Maintainability | 테스트 픽스처에 `null as never` 캐스팅 5회 반복. `Execution` 엔티티 nullable 컬럼이 non-nullable로 잘못 선언됨 | `executions.service.spec.ts:58, 66, 68, 101, 105` | `Execution` 엔티티에서 nullable 컬럼을 `string \| null`로 정확히 선언 |
| 14 | Frontend / Architecture | JSX 렌더 루프 내 IIFE 사용. 행마다 클로저 생성, 재사용·메모이제이션 불가 | `page.tsx:300-330` | `<TriggerCell source={...} label={...} />` 컴포넌트 추출 |
| 15 | Side Effect | `findByWorkflow` 반환 타입 변경 영향이 diff 미포함 컨트롤러에서 미검증 | `executions.controller.ts` (미포함) | 반환 타입을 `ExecutionDto`로 명시적으로 맞출 것 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | Database | `getCount()` 쿼리에 LEFT JOIN 2개가 포함될 수 있음 | `executions.service.ts:58-73` |
| 2 | Database | `getCount()` + `getMany()` 분리 실행. `getManyAndCount()` 단일 호출 검토 | `executions.service.ts:73-81` |
| 3 | Documentation | 중첩 서브워크플로우 1단계 한계 미문서화 | `executions.service.ts:125-143` |
| 4 | Documentation | `toIso` TypeORM 드라이버 의존성 주석 없음 | `executions.service.ts:183-185` |
| 5 | Documentation | `unknown: "—"` i18n em-dash 이유 불명확 | `en.ts:1940`, `ko.ts:1933` |
| 6 | Requirement | 미지원 트리거 타입 silent fallback — 신규 타입 도입 시 탐지 어려움 | `execution-trigger.ts:41-47` |
| 7 | Testing | webhook 서비스 레벨 통합 경로 미검증 | `executions.service.spec.ts` |
| 8 | Testing | `executor: { name: null, email: null }` 케이스 미검증 | `execution-trigger.spec.ts` |
| 9 | Testing | `findById`, `stop` 메서드 테스트 없음 (기존 기술 부채) | `executions.service.spec.ts` |
| 10 | Maintainability | `EXECUTION_TRIGGER_SOURCES` 배열에 `as const` 없음 | `execution-response.dto.ts:4-9` |
| 11 | Architecture | 새 트리거 타입 추가 시 변경 지점 6곳 이상 산재 | 전체 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | `executor.email` PII 노출, 워크스페이스 범위 필터 누락, IDOR |
| Requirement | **MEDIUM** | `findById` 신규 필드 누락, 프론트 타입 계약 불일치 |
| Concurrency | **LOW~MEDIUM** | `stop()` TOCTOU, `cancelWaitingExecution` await 누락 |
| API Contract | **LOW** | `findById` 스키마 불일치, required vs optional 불일치 |
| Architecture | **LOW** | 타입 중복 정의, 반환 타입 불일관, IIFE |
| Maintainability | **LOW** | 3중 타입 중복, `as never` 캐스팅, 반환 계층 불일치 |
| Testing | **LOW** | webhook/배치 케이스 누락, 호출 인자 미검증 |
| Performance | **LOW** | `loadParentWorkflowNames` 전체 컬럼 과잉 로드 |
| Database | **LOW** | `getCount()` LEFT JOIN 포함 가능성 |
| Side Effect | **LOW** | 컨트롤러 반환 타입 영향 미확인 |
| Documentation | **LOW** | 비자명한 설계 결정 미문서화 |
| Dependency | **LOW** | 타입 중복 (신규 외부 패키지 없음) |
| Scope | **NONE** | 범위 일탈 없음 |

---

## 발견 없는 에이전트
- **Scope** — 9개 파일 전체가 단일 피처에 집중, 범위 일탈 없음

---

## 권장 조치사항

**즉시 (운영 영향)**
1. **[Security]** `executor.email` PII 노출 제거 — `triggerLabel` email 폴백 로직 수정
2. **[Requirement]** `findById`에 trigger 정보 매핑 적용 — Swagger 계약과 실제 응답 일치

**단기 (다음 PR)**

3. **[Concurrency]** `stop()` 원자적 상태 전환 — 단일 원자 UPDATE로 TOCTOU 방지
4. **[Concurrency]** `cancelWaitingExecution` await 추가
5. **[Architecture]** `findById` 반환 타입 `ExecutionDetailDto`로 통일
6. **[Requirement]** `executor.name === ""` → `||` 연산자로 빈 문자열 정규화
7. **[Maintainability]** 프론트 `triggerSource?` optional 제거

**중기 (기술 부채 해소)**

8. **[Architecture]** `ExecutionTriggerSource` 3중 중복 → `as const` + `typeof` 단일 정의
9. **[Performance]** `loadParentWorkflowNames` QB로 필요 컬럼만 SELECT
10. **[Testing]** webhook, 다중 parentExecutionId, `find` 호출 인자 검증, `as never` 제거
11. **[Maintainability]** IIFE → `<TriggerCell>` 컴포넌트 추출
12. **[Security]** `loadParentWorkflowNames` 워크스페이스 필터 추가
