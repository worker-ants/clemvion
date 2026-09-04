# API 계약(API Contract) 리뷰

## 범위 요약

이번 diff 의 실질 API 계약 변경은 **`GET /api/executions/workflow/:workflowId` 의 쿼리
파라미터 `workflowId` 제거** 하나다. 관련 파일 4개:

1. `CHANGELOG.md` — 새 Unreleased 항목 추가(변경 서술·영향 분석)
2. `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 실제 DTO 변경(코드)
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 무관한 저장소
   가드의 주석(문서) 갱신, `@Transform` 예외의 실사례가 이 필드 제거로 0건이 됐다는 후속 기록
4. `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 체크박스 갱신(트래킹)

아래는 코드 변경(파일 2)을 중심으로, CHANGELOG(파일 1)의 주장을 실측으로 교차검증한 결과다.

## 검증 절차 (읽기 전용, 저장소 뮤테이션 없음)

- `grep forbidNonWhitelisted codebase/backend/src` → 전역 `ValidationPipe`
  (`common/pipes/validation.pipe.ts:31`)가 `whitelist + forbidNonWhitelisted: true`. CHANGELOG 의
  "제거 후 미지 쿼리 키는 400" 주장과 일치.
- `executions.controller.ts:110` `@Query() query: QueryExecutionDto` — 이 DTO 가 실제로 전역
  파이프를 타는 진입점임을 확인(즉 `workflowId` 제거가 런타임에서 실제로 효과를 낸다).
- `executions.service.ts:746 findByWorkflow` 구조분해 확인 — `workflowId` 를 읽지 않음(서비스가
  `{page,limit,sort,order,status}` 만 소비).
- `spec/2-navigation/14-execution-history.md:345-350` "목록 API 쿼리 파라미터" 표 — `page` ·
  `limit` · `sort` · `order` · `status` 만 문서화, `workflowId` 없음. spec 이 애초에 이 파라미터를
  약속한 적이 없다는 CHANGELOG 주장과 일치 — 즉 spec 동기화 불요.
- `codebase/frontend/src/lib/api/executions.ts:87-93` `ExecutionListParams` — `workflowId` 없음
  (경로 파라미터로만 전달, `executions.ts:205-208`). 프런트 미전송 주장과 일치.
- `grep workflowId` 전체 `.spec.ts`/`.e2e-spec.ts` — `executions.service.spec.ts` ·
  `workflow-execution.e2e-spec.ts` 어디에도 쿼리 필터로서의 `workflowId` 테스트 없음(경로
  파라미터 값으로만 등장). 회귀 테스트가 없어도 깨질 표면이 없다는 뜻과 일치.
- 저장소에 committed OpenAPI/swagger JSON 스냅샷 없음(`find … -iname "*swagger*.json"` 0건) —
  "코드젠 소비자 없음" 주장과 일치.
- 가드 fixture(`swagger-dto-contract.spec.ts:182`)가 합성 문자열 `class D { … workflowId?: …}` 로
  바뀌어 있어, 실제 제거된 필드를 참조하지 않는 대조군으로 정상 전환됨을 확인.

전 항목이 CHANGELOG 의 서술과 실측이 일치했다 — 근거 없는 주장(unfounded claim)은 발견되지 않았다.

## 발견사항

### INFO — 명시적 breaking change, 완화 근거는 충분하나 버전 신호가 없다

- 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:5-14` (전체 파일
  컨텍스트 게이트, JSDoc) / `CHANGELOG.md:17-21` (게이트, "영향" 절)
- 상세: `workflowId` 를 쿼리로 보내던 클라이언트는 `forbidNonWhitelisted: true` 로 인해 종전
  `200`(단, 필터는 결코 적용되지 않아 무시됐음)에서 이제 `400` 을 받는다. 저장소 내부
  소비자(서비스·프런트·spec·OpenAPI 코드젠) 부재는 위 검증 절차로 실측 확인됐고, 이 저장소는
  URL 버전 세그먼트를 쓰지 않는 기존 아키텍처(다른 CHANGELOG 항목에서도 반복 언급)라 이 변경
  자체가 그 관례를 벗어나지 않는다. 다만 **저장소 밖 제3자 클라이언트**가 이 파라미터를 보내고
  있었다면(응답이 무시되는 걸 모른 채 방어적으로 계속 보내는 경우 등) 이번 배포 시점에 발견 없이
  400 회귀를 겪는다 — "관측 범위 미발견" 이지 "부재 확인" 은 아니다(같은 diff 의 다른 항목,
  `POST /executions/:id/re-run` INVALID_TRIGGER_PARAMETERS 케이스가 스스로 구분한 것과 같은 신중함이
  이 항목에는 "결과는 전후가 같다"는 판단 아래 생략되어 있다).
- 제안: 현 상태로도 병합 가능한 수준의 위험도(문서화·실측 완료)이나, 배포 노트/릴리즈 공지에 이
  400 회귀 가능성을 한 줄 명시하면 제3자 연동 이슈 접수 시 원인 추적이 빨라진다. 코드 변경은
  불필요.

### INFO — 검증 완화(`@IsUUID` 제거)는 필드 삭제의 자연스러운 부수효과, 별도 검증 공백 없음

- 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:1-2` (게이트, import 변경)
- 상세: `IsUUID`·`Transform` import 가 함께 제거됐고 필드 자체가 사라졌으므로 "검증이 약해졌다"가
  아니라 "검증 대상이 없어졌다"에 해당한다. `status`(`@IsIn`)의 검증은 그대로 유지된다. 요청 검증
  관점에서 새로 생긴 공백은 없다.
- 제안: 없음(정보 제공용).

CRITICAL/WARNING 은 발견되지 않았다.

## 요약

이번 PR 의 API 계약 변경은 `GET /api/executions/workflow/:workflowId` 에서 개념적으로 성립하지
않던(경로가 이미 워크플로우를 한정하므로 쿼리 필터가 no-op 이거나 빈 결과만 내던) `workflowId`
쿼리 파라미터를 제거한 것이 전부다. CHANGELOG 의 모든 정량적 주장(서비스 미소비, 프런트 미전송,
spec 미약속, OpenAPI 코드젠 소비자 부재, `@Transform` 가드 예외 실사례 0건)을 코드 실측으로
교차검증했고 전부 일치했다. `forbidNonWhitelisted: true` 전역 파이프로 인해 이 파라미터를 보내던
클라이언트는 `200`(무시됨) → `400` 으로 바뀌는 **명시적 breaking change** 이지만, CHANGELOG 가 이를
숨기지 않고 영향·근거를 상세히 기록했고 실제 응답 데이터는 전후 동일하다(필터가 애초에 적용된
적이 없으므로). 에러 응답 형식·요청 검증·페이지네이션·인증/인가·URL 설계에는 영향이 없다.
저장소가 URL 버전 세그먼트를 쓰지 않는 기존 정책과 일관되며, 별도의 버전 관리 조치는 불필요하다.
CRITICAL/WARNING 없음, INFO 2건(문서화 권고 수준).

## 위험도

LOW
