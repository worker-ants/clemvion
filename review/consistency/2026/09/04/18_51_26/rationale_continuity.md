# Rationale 연속성 검토 — spec/2-navigation (impl-done)

## 검토 범위 및 방법

- `spec/2-navigation/` 자체 델타는 0 (이 브랜치는 해당 spec 영역을 수정하지 않음).
- 구현 diff 3파일 121줄을 대상으로, 관련 spec 의 `## Rationale` (특히 `spec/2-navigation/14-execution-history.md`,
  `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`) 및 diff 자체가 인용하는 근거를
  절대경로 워킹트리에서 직접 대조했다.
- 대상 diff:
  1. `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 축 회귀 테스트 신설.
  2. `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터) 제거.
  3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` null 축 예외 주석을 재실측치(0건)로 갱신, 예외 자체는 존치.

## 발견사항

없음 — Rationale 연속성 관점에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 확인되지 않았다.

검증 내역 (참고용):

- **`workflowId` 제거가 과거 결정의 재도입/번복이 아닌지**: `git log --oneline -- codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 는 이 필드가 `codebase/` wrapper 이관 이후 이번 커밋(`fe977e922`) 전까지 한 번도 손대지지 않았음을 보여준다 — 과거에 폐기됐다가 되살아난 이력이 없다. `spec/2-navigation/14-execution-history.md:345` 는 `GET /api/executions/workflow/:workflowId` 가 "페이지네이션, 상태 필터, 정렬"만 약속한다고 명시하고 있어(직접 Read 로 확인), diff 의 근거 주석("spec 도 이 세 축만 약속한다")과 정확히 일치한다. 이 문서의 `## Rationale`(R-1~R-6)에도 `workflowId` 쿼리 필터를 의도적으로 설계했다는 기록이 없다 — 즉 애초에 합의된 기능이 아니라 죽은 파라미터였다는 diff 의 주장이 spec 상으로도 뒷받침된다.
- **프론트엔드 암묵적 의존 여부**: `codebase/frontend/src/lib/api/executions.ts` 의 `getExecutionsByWorkflow` 는 `workflowId` 를 **경로** 세그먼트로만 사용하고 쿼리로 보내지 않는다(grep 확인) — 제거로 깨지는 소비자가 없다.
- **`api-convention.md` Rationale "비-페이징 고정 컬렉션은 `{data:{items}}` 유지"와의 긴장 여부**: 그 항목은 "이미 로드베어링인 wire 계약은 breaking change 비용이 커서 유지한다"는 원칙이다. 본 건은 반대 조건(서버가 애초에 값을 읽지 않았고, 유일한 클라이언트도 보내지 않음 — 즉 로드베어링이 아님)이라 같은 원칙 하에서도 결론이 다른 것이 자연스럽다. 두 결정이 상충하지 않는다.
- **`swagger-dto-contract-guard.ts` 의 `@Transform` null 축 예외**: 실사례가 0건이 됐음에도 예외 자체(원리)는 유지하고, 그 이유("원리가 사라진 것이 아니라 형태가 지금 없을 뿐 — 지우면 다음 재발 시 오탐")를 명시적으로 기록했다. 이는 결정을 번복하면서 새 Rationale 을 남기지 않는 패턴이 아니라, 오히려 결정을 유지하면서 실측치 변화를 반영한 사례다. 분기 생존을 위해 `swagger-dto-contract.spec.ts` 의 대조군 픽스처도 함께 갱신했다고 주석에 명시돼 있어(코드 확인은 diff 범위 밖), self-consistent 하다.
- **`validation.pipe.spec.ts` 신설 테스트**: `forbidNonWhitelisted: true` 는 기존 파이프 설정을 그대로 단언하는 회귀 테스트로, 신규 정책 도입이 아니라 기존 동작(및 §2.의 워크플로 필드 제거)에 대한 커버리지 보강이다.

## 요약

이번 diff 는 `spec/2-navigation/14-execution-history.md` 가 명시적으로 약속하지 않는 죽은 쿼리 파라미터(`QueryExecutionDto.workflowId`)를 제거하고, 그 제거로 인해 유일하게 남아 있던 `@Transform` null-축 예외 실사례가 소멸한 사실을 코드 가드 주석에 정직하게 반영한 것이다. spec 인용은 실측(직접 Read)과 일치했고, 프론트엔드 소비자 부재도 grep 으로 확인됐으며, 관련 spec Rationale(`api-convention.md`, `swagger.md`, `14-execution-history.md`) 어디에도 이 결정과 상충하는 기각된 대안·합의 원칙이 없었다. 오히려 "예외 원리는 실사례 소멸과 무관하게 존치한다"는 판단을 근거와 함께 남긴 점은 이 저장소의 Rationale 연속성 관행(무근거 번복 금지)에 부합하는 사례다.

## 위험도

NONE
