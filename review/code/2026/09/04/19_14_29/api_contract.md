# API 계약(API Contract) 리뷰

## 범위

API 표면에 실질적으로 관여하는 파일은 3개다.

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `GET /api/executions/workflow/:workflowId` 의 `workflowId` 쿼리 파라미터(`@IsOptional() @IsUUID() @Transform(...)`) 제거
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — 전역 `forbidNonWhitelisted` 거절 동작(unknown key → 400)을 고정하는 신규 유닛 테스트
- `CHANGELOG.md` — 위 변경의 breaking 영향 문서화

나머지(`swagger-dto-contract-guard.ts` JSDoc, `plan/in-progress/...md` 트래커, `review/code/.../18_34_04/*`·`review/code/.../18_56_22/*`·`review/consistency/.../18_51_26/*`)는 이전 두 리뷰 라운드 + 1회 consistency check 의 산출물이며 API 표면을 바꾸지 않는다. 이 변경은 이미 `18_34_04`(1라운드) API 계약 WARNING → `18_56_22`(2라운드) 재검증을 거쳤고, 이번이 세 번째 통과다. 코드 자체(핵심 3파일)는 두 라운드 사이 실질적으로 바뀌지 않았으므로, 아래는 독립적으로 코드를 다시 열어 검증한 결과다.

## 실측 검증

- `codebase/backend/src/modules/executions/executions.controller.ts` `findByWorkflow` — 클래스 레벨 `@ApiBearerAuth('access-token')` + 메서드 내 `verifyWorkflowOwnership(workflowId, workspaceId)` (IDOR 차단, W-44) 그대로 유지. 이번 diff 는 인증/인가 로직을 전혀 건드리지 않는다.
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 남은 필드는 `status`(`@IsIn`) 뿐이고 `PaginationQueryDto` 상속은 불변. 페이지네이션(`page/limit/sort/order`) 계약은 이 diff 로 변하지 않는다.
- `codebase/backend/src/common/pipes/validation.pipe.ts:29-39` — 에러 응답은 `{code: 'VALIDATION_ERROR', message, details}` 형태로 기존 컨벤션과 동일. 신규 테스트(`validation.pipe.spec.ts`)가 `body.code === 'VALIDATION_ERROR'` 를 단언해 응답 스키마 일관성을 고정한다.
- 프런트엔드 `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:127` — `executionsApi.getByWorkflow(workflowId, params)` 에서 `workflowId` 는 경로 인자로만 전달되고 쿼리로는 보내지 않음을 직접 확인. 내부 소비자 없음.
- `codebase/backend/src/main.ts` — `setGlobalPrefix('api')` 만 있고 `enableVersioning()`/`/v1` 접두는 이 저장소에 존재하지 않음. API 버전 관리 체계 부재는 기존 상태이며 이 diff 가 새로 만든 갭이 아니다.
- `CHANGELOG.md` 과거 항목(예: 182·595·625·999·1566·1661·1870행 부근)은 breaking change 를 `**Behavior change (breaking): ...**` 또는 `### Breaking changes` 헤더로 명시적으로 태깅해 왔다. 이번 신규 항목(게이트 3행)은 본문에서 영향을 상세히 서술하지만 헤더·본문 어디에도 "breaking" 키워드를 쓰지 않는다.

## 발견사항

- **[WARNING]** `workflowId` 쿼리 파라미터 제거 + 전역 `forbidNonWhitelisted: true` 로, 이 파라미터를 보내던 클라이언트는 `200`(무시)에서 `400`(거절)으로 응답이 바뀌는 breaking change.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (`QueryExecutionDto` 클래스 — `workflowId` 필드가 삭제돼 게이트 없음, 대체 서술은 JSDoc 게이트 5~14행) / `CHANGELOG.md:17~24`
  - 상세: 저장소 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠)는 부재가 재확인됐지만, 저장소 밖 제3자 클라이언트의 존재 여부는 액세스 로그 없이 확정할 수 없다("미발견"≠"부재 확인" — CHANGELOG 자신도 이를 명시). 유예 기간이나 `Deprecation`/`Sunset` 헤더 같은 절차적 완화 장치 없이 즉시 cutover 된다. 다만 설계 근거(경로가 이미 워크플로우를 한정하므로 쿼리 필터가 개념적으로 성립하지 않았다)는 타당하고, 두 차례 리뷰가 이미 "병합 가능"으로 판정했다 — 이번 라운드도 동의한다.
  - 제안: 코드 변경 불필요. 배포 노트/릴리즈 공지에 이 400 회귀를 한 줄 명시하는 것을 실제 배포 프로세스에 반영할 것. 향후 유사 케이스는 유예 기간 또는 `Deprecation`/`Sunset` 헤더 절차를 컨벤션화 고려.

- **[INFO]** 신규 CHANGELOG 항목이 저장소가 이미 쓰고 있는 breaking-change 태깅 컨벤션(`**Behavior change (breaking): ...**` 또는 `### Breaking changes` 헤더)을 따르지 않는다.
  - 위치: `CHANGELOG.md:3` (`## Unreleased — ... 제거` 헤더)
  - 상세: 본문(게이트 17~24행)이 영향을 충분히 서술하지만, 헤더·본문 어디에도 "breaking" 키워드가 없어 향후 이 CHANGELOG 를 `grep -i breaking` 으로 훑는 릴리즈 담당자가 이 항목을 놓칠 수 있다. 실질 정보 손실은 아니고 검색성 문제.
  - 제안: 헤더 또는 본문 첫 문장에 "(breaking)" 표시를 한 단어 추가.

- **[INFO]** 엔드포인트 전용 negative 회귀 테스트는 여전히 없다 — 추가된 테스트는 실제 라우트가 아니라 합성 `NarrowDto` 로 `CustomValidationPipe` 의 일반 동작만 고정한다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:86~115` (`describe('CustomValidationPipe — forbidNonWhitelisted', ...)`)
  - 상세: 파이프 레벨 유닛 테스트가 전역 파이프를 겨눠 오히려 더 넓게 덮지만, `GET /api/executions/workflow/:workflowId?workflowId=<uuid>` → `400` 을 라우팅·가드·인터셉터 체인까지 통과한 실제 응답으로 고정하는 e2e 는 없다.
  - 제안: 필수는 아니나, `workflow-execution.e2e-spec.ts` 에 negative 케이스 1개 추가 시 종단 보증 완성.

- **[INFO]** URL/경로 설계 관점에서는 이번 변경이 계약을 개선한다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 클래스 JSDoc (게이트 5~14행)
  - 상세: 경로 파라미터(`:workflowId`)와 쿼리 파라미터(`workflowId`)가 같은 리소스를 이중 지시하던 구조적 모순(같으면 no-op, 다르면 항상 빈 결과)을 제거했다. "경로가 이미 리소스를 한정하면 쿼리에 동일 축의 필터를 두지 않는다"는 RESTful 원칙에 부합. 페이지네이션·상태 필터는 그대로 유지돼 목록 API 나머지 계약은 불변.
  - 제안: 조치 불요(긍정 소견).

## 요약

핵심 변경은 개념적으로 성립하지 않던 쿼리 파라미터(`QueryExecutionDto.workflowId`) 제거이며, 저장소 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠) 부재는 이번 라운드에서도 직접 코드를 열어 재확인했다. 유일한 실질 API 계약 이슈는 전역 `forbidNonWhitelisted: true` 로 인해 이 파라미터를 보내던 외부 클라이언트가 `200`→`400` 으로 바뀌는 breaking change 인데, 이는 이미 두 차례 리뷰에서 지적·완화(CHANGELOG 문서화)됐고 이번 diff 는 그 완화를 넘어 회귀 테스트까지 추가했다. 인증/인가·응답 스키마·페이지네이션·에러 코드 형식은 전부 불변이며, 오히려 경로와 쿼리가 같은 리소스를 이중 지시하던 설계 모순을 해소해 URL 설계 관점에서는 개선이다. 코드 변경 요구 없이 병합 가능하며, CHANGELOG 헤더에 "breaking" 키워드를 명시하는 정도만 참고 사항으로 남긴다.

## 위험도
LOW
