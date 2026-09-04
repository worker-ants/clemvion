# API 계약(API Contract) 리뷰

## 범위

실질적으로 API 계약에 관여하는 파일은 3개다.

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `GET /api/executions/workflow/:workflowId` 의 `workflowId` 쿼리 파라미터(`@IsOptional() @IsUUID() @Transform(...)`) 제거
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 거절 동작을 고정하는 신규 테스트(제네릭 `NarrowDto` 기반, 이 엔드포인트 전용은 아님)
- `CHANGELOG.md` — 위 변경의 breaking 영향 문서화

나머지(`swagger-dto-contract-guard.ts` JSDoc, `plan/in-progress/...md` 트래커, `review/code/.../18_34_04/*`, `review/consistency/.../18_51_26/*`)는 문서·이전 리뷰/consistency 세션의 산출물이며 API 표면을 바꾸지 않는다.

이 변경은 직전 리뷰 라운드(`18_34_04`, api_contract WARNING #1 = W1)에서 이미 breaking change 로 지적된 항목이고, 이번 diff 는 그 `RESOLUTION.md` 가 기록한 후속 조치(CHANGELOG 문구 축소 + 테스트 추가)를 포함한다. 아래는 코드로 재검증한 결과다.

## 실측 검증

- `executions.service.ts:748` `findByWorkflow` 는 `{page, limit, sort, order, status}` 만 구조분해 — `workflowId` 쿼리 값을 읽지 않음을 직접 확인.
- `codebase/frontend/.../workflows/[id]/executions/page.tsx` 는 `getByWorkflow(workflowId, params)` — `workflowId` 는 경로 인자로만 전달, 쿼리 파라미터로 보내지 않음.
- `spec/2-navigation/14-execution-history.md` §5 목록 API 쿼리 파라미터 표는 `page/limit/sort/order/status` 만 약속 — `workflowId` 쿼리 필터는 spec 에도 없었음.
- `executions.controller.ts:91-119` — 엔드포인트는 `@ApiBearerAuth` + `verifyWorkflowOwnership` (IDOR 차단) 그대로 유지, 인증/인가는 이번 diff 로 영향받지 않음.
- `main.ts:217` `app.setGlobalPrefix('api')` 만 있고 버전 프리픽스(`/v1` 등)나 `enableVersioning()` 은 이 저장소에 없음 — API 버전 관리 체계 자체가 부재한 것은 기존 컨벤션이며 이 diff 가 새로 만든 갭이 아니다.

## 발견사항

- **[WARNING]** breaking change(200→400)를 완화하는 배포 절차(단계적 사용 중단·유예 기간)가 없고, 유일한 완화책이 CHANGELOG 문서화뿐이다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (`QueryExecutionDto` 클래스, `workflowId` 필드 삭제) / `CHANGELOG.md:17-24` (게이트 기준 신규 섹션)
  - 상세: `forbidNonWhitelisted: true` 전역 설정 때문에, `?workflowId=<유효 UUID>` 를 보내던 외부 클라이언트는 종전엔 `200`(필터가 조용히 무시됨)을 받았지만 이제는 `400 VALIDATION_ERROR` 를 받는다. 저장소 안의 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠)는 이번 검증으로도 부재가 재확인됐지만, 저장소 밖 제3자 클라이언트의 존재 여부는 액세스 로그 없이는 확정할 수 없다("미발견"≠"부재 확인", CHANGELOG 스스로도 이를 명시). 이 파라미터가 애초에 개념적으로 성립하지 않는 필드(경로가 이미 워크플로우를 한정)였다는 설계 근거는 타당하고, 이번 라운드에서 CHANGELOG 문구를 "저장소 안에서 확인한 것"으로 좁혀 과잉 주장을 제거한 점도 확인했다. 다만 API 계약 관점에서는 여전히 **사전 고지·유예 기간 없는 즉시 breaking cutover**라는 사실 자체는 남는다.
  - 제안: 이미 병합 가능한 수준이라는 판단(직전 SUMMARY)에 동의하되, 배포 노트/릴리즈 공지에 이 400 회귀를 한 줄 명시하는 것을 실제로 배포 프로세스에 반영할 것. 향후 유사 케이스에서는 (a) 한 릴리즈 동안 파라미터를 조용히 무시하도록 남겨 두거나 (b) `Deprecation`/`Sunset` 헤더로 예고하는 절차를 컨벤션화하는 것을 고려.

- **[INFO]** 엔드포인트 전용 negative 회귀 테스트는 여전히 없다 — 이번에 추가된 테스트는 `GET /api/executions/workflow/:workflowId` 가 아니라 합성 `NarrowDto` 로 `CustomValidationPipe` 의 일반 동작만 고정한다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:84-108` (`describe('CustomValidationPipe — forbidNonWhitelisted', ...)`)
  - 상세: 직전 라운드 SUMMARY WARNING #2 의 권고는 "e2e 케이스 추가 **또는** 유닛 테스트 추가"였고 이번 조치는 후자를 택해 요건을 충족한다. 다만 실제 라우트(`?workflowId=...` → `400`)를 직접 찌르는 e2e 는 여전히 없어, 이 특정 엔드포인트의 계약 변화가 라우팅·가드·인터셉터 체인을 통과한 실제 응답으로는 아직 고정되지 않았다.
  - 제안: 필수는 아니나, `workflow-execution.e2e-spec.ts` 에 `?workflowId=<uuid>` → `400 VALIDATION_ERROR` 를 단언하는 negative 케이스를 추가하면 파이프 레벨 테스트와 실제 라우트 사이의 간극이 닫힌다.

- **[INFO]** URL/경로 설계 관점에서는 이번 변경이 오히려 계약을 개선한다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 클래스 JSDoc
  - 상세: 경로 파라미터(`:workflowId`)와 쿼리 파라미터(`workflowId`)가 같은 리소스를 이중으로 지시하던 구조적 모순(같으면 no-op, 다르면 항상 빈 결과)을 제거했다. RESTful 관점에서 "경로가 이미 리소스를 한정하면 쿼리에 동일 축의 필터를 두지 않는다"는 원칙에 부합하는 정정이며, 페이지네이션(`page/limit/sort/order`)·상태 필터(`status`)는 그대로 유지돼 목록 API 의 나머지 계약은 변경되지 않았다.
  - 제안: 조치 불요 — 참고용 긍정 소견.

## 요약

핵심 API 계약 변경은 죽은 쿼리 파라미터 하나(`QueryExecutionDto.workflowId`) 제거이며, 이는 경로·쿼리 이중 필터라는 설계 모순을 없애는 정당한 정정이다. 서비스·프런트엔드·spec·컨트롤러 전부를 직접 재확인한 결과 저장소 내부 소비자는 없다는 주장이 사실과 일치했다. 다만 `forbidNonWhitelisted: true` 로 인해 이 파라미터를 보내던 외부 클라이언트는 `200`(무시)에서 `400`으로 응답이 바뀌는 실질적 breaking change이며, 완화책은 CHANGELOG 문서화뿐이고 버전 관리·유예 기간·Deprecation 헤더 같은 절차적 장치는 없다(다만 이 저장소 자체가 API 버전 관리 체계를 갖고 있지 않으므로 이 diff 만의 신규 결함은 아니다). 이번 라운드에서 추가된 테스트는 일반 `forbidNonWhitelisted` 동작만 고정하고 이 엔드포인트 전용 negative e2e 는 여전히 비어 있다. 인증/인가·에러 응답 포맷·페이지네이션은 변경 없이 기존 계약을 그대로 유지한다.

## 위험도

LOW
