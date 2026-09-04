# 보안(Security) 리뷰

## 리뷰 범위

실질 코드 변경은 2개 파일뿐이다.

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은(dead) 쿼리 파라미터 `workflowId`(및 `@IsUUID()`, `@Transform`) 제거
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 거절 동작을 고정하는 신규 테스트(+ 대조군) 추가

나머지는 문서/트래커(`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`), 순수 JSDoc 주석 변경(`swagger-dto-contract-guard.ts`, 로직 변경 없음 확인), 그리고 직전 리뷰 세션(`18_34_04`)·직전 consistency 세션(`18_51_26`) 산출물이 신규 파일로 저장소에 커밋된 것이다. 이들은 코드가 아니라 리뷰 리포트 자체이므로 보안 관점 분석 대상이 아니다.

## 검증 절차 (읽기 전용, 저장소 뮤테이션 없음)

- `codebase/backend/src/modules/executions/executions.controller.ts:91-119` `findByWorkflow` — **경로** `workflowId` 는 `ParseUUIDPipe` 로 여전히 검증되고, `verifyWorkflowOwnership(workflowId, workspaceId)` 로 IDOR 차단(W-44)이 그대로 적용된다. 이번 diff 가 지운 것은 **쿼리** DTO 의 동명 필드이며 인가 경로와 무관함을 코드로 확인했다.
- `codebase/backend/src/common/pipes/validation.pipe.ts:29-32` — 전역 `whitelist: true, forbidNonWhitelisted: true` 확인. DTO 에서 필드를 지우면 해당 키를 보내는 요청은 조용히 무시되던 것에서 **명시적 400** 으로 바뀐다(fail-closed 방향이며 보안 회귀 아님).
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 전체 diff 재확인 — JSDoc 블록만 변경, `findSwaggerContractMismatches` 등 실행 로직은 무변경.
- 신규 테스트(`validation.pipe.spec.ts:84-108`)는 `pipe.transform({known:'ok', removedParam:'anything'}, ...)` 이 `BadRequestException` 을 던짐을 단언하고, 대조군으로 알려진 키만 있을 때 통과함을 단언한다 — whitelist 강제(입력 검증)를 고정하는 방향의 테스트로 보안 관점에서 긍정적.

## 발견사항

- **[INFO]** DTO 필드 제거로 `@IsUUID()` 검증도 함께 사라졌으나, 검증 공백이 아니라 검증 대상 자체가 없어진 것
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:1` (게이트, import), `:15-38` (전체 파일 컨텍스트, 클래스 본문)
  - 상세: `IsUUID`/`Transform` import 와 `workflowId` 필드가 함께 제거됐다. 이 필드는 서비스(`findByWorkflow`)가 한 번도 읽은 적이 없는 죽은 파라미터였고, 남은 `status` 필드는 `@IsIn([...])` 화이트리스트 검증이 그대로 유지된다. 새로 생긴 입력 검증 공백은 없다.
  - 제안: 조치 불요.

- **[INFO]** breaking change(외부 클라이언트 `200`→`400`)는 보안 하드닝 방향이지 취약점이 아님
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:31` (전역 `forbidNonWhitelisted: true`, 게이트 확인 안 됨 — 이 파일은 이번 diff 범위 밖이라 그대로 인용, 함수 `transform`)
  - 상세: 다른 reviewer(api_contract/side_effect)가 이미 WARNING 으로 잡은 항목과 같은 사실관계이나, 보안 관점에서는 "무시하던 파라미터를 거절"하는 방향이라 위험이 아니라 오히려 fail-closed 강화다. 회귀 테스트 부재는 이 리뷰의 관점(testing) 소관이라 여기서는 등급을 올리지 않는다.
  - 제안: 조치 불요(보안 관점).

CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지의 민감정보 노출, 취약 의존성 추가 — 어느 항목에서도 이번 diff 에 해당하는 변경이 없다. 프롬프트에 포함된 리뷰 리포트 텍스트 내 `sk-live-…`/`postgres://user:pw@host/db` 류 문자열은 과거 세션이 "마스킹 동작 설명용 예시"로 명시한 placeholder 이며 실제 발급된 시크릿이 아니다(해당 리포트 자체 내 확인).

## 요약

이번 변경의 유일한 실질 코드 변경은 한 번도 소비되지 않던 쿼리 파라미터(`QueryExecutionDto.workflowId`)와 그 검증 데코레이터를 함께 제거한 것이며, IDOR 차단에 쓰이는 **경로** `workflowId` 검증·소유권 확인 로직은 전혀 건드리지 않았다. 전역 `forbidNonWhitelisted: true` 로 인해 제거된 파라미터를 보내는 외부 클라이언트는 이제 400 을 받게 되는 breaking change 가 있으나 이는 입력 화이트리스트를 더 엄격히 강제하는 방향이라 보안 취약점이 아니다. 신규 테스트는 그 화이트리스트 거절 동작을 회귀 테스트로 고정해 보안 관점에서 긍정적이다. 인젝션·시크릿 하드코딩·인증/인가 우회·암호화 약화·에러 정보 노출·취약 의존성 어느 항목에도 해당 사항이 없다.

## 위험도

NONE
