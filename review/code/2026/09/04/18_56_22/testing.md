# 테스트(Testing) 리뷰

## 범위 요약

실질 코드 변경은 `QueryExecutionDto.workflowId`(죽은 쿼리 파라미터) 제거 하나이고, 이번 diff 는 이전 리뷰 라운드(`18_34_04`)의 WARNING #2("이 breaking 동작을 고정하는 테스트가 없다")를 직접 해소하는 신규 테스트를 포함한다. 나머지 파일(`CHANGELOG.md`, plan 트래커, `swagger-dto-contract-guard.ts` JSDoc, `review/**` 산출물)은 문서·주석·리포트로 테스트 대상 코드가 아니다.

## 검증 절차 (읽기 전용, 저장소 뮤테이션 없음)

- `codebase/backend/src/common/pipes/validation.pipe.ts` 를 직접 읽어 `whitelist: true` + `forbidNonWhitelisted: true` 가 실제로 설정돼 있음을 확인.
- `app.module.ts:202` — `{ provide: APP_PIPE, useClass: CustomValidationPipe }` 로 파이프가 **전역** 적용됨을 확인. 즉 새 테스트가 파이프 레벨에서 이 축을 단언하면 `QueryExecutionDto` 뿐 아니라 전 컨트롤러에 적용되는 일반 회귀 가드가 된다 — 엔드포인트 전용 e2e 보다 오히려 더 넓은 커버리지.
- `executions.controller.ts:110` — `@Query() query: QueryExecutionDto` 로 실제 라우트가 이 DTO/전역 파이프를 탐을 확인. `executions.controller.spec.ts`, `executions.service.spec.ts` 전체에 `workflowId` 쿼리 필드 참조가 **없음**을 grep 으로 확인 — 필드 제거로 깨지는 기존 테스트 없음(회귀 없음).
- `codebase/backend/test/workflow-execution.e2e-spec.ts` — `workflowId` 는 경로 파라미터로만 등장(라인 108), 쿼리 필터로서의 negative(400) 케이스는 없음. 이전 리뷰가 지적한 e2e 갭은 **이번에도 e2e 로는 메워지지 않았고**, 대신 파이프 유닛 테스트로 메워졌다(아래 참고).
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` 신규 `describe` 블록의 `it(` 개수를 세어 총 5개(기존 3 + 신규 2)임을 확인 — `RESOLUTION.md` 의 "9,322 → 9,324(+2)" 산술과 일치.
- `RESOLUTION.md` 의 뮤테이션 표(`forbidNonWhitelisted: true → false` ⇒ RED 1 / 4 pass)를 직접 재현하지 않고 **논리적으로 재구성**해 대조: 기존 3 테스트는 원인이 다른 검증 실패(enum/타입 오류)라 그대로 GREEN, 신규 거절 단언 1개만 전제가 깨져 RED, 대조군 1개는 extra key 가 없어 그대로 GREEN → 합계 1 RED / 4 pass, 총 5 — 표와 정합. (직접 재실행은 하지 않았음, 사유는 아래 명시.)
- `swagger-dto-contract.spec.ts` 의 `[대조군] @Transform 예외` 픽스처(173행대)를 열어 합성 클래스 문자열(`class D { … workflowId? … }`)임을 확인 — 실제 `QueryExecutionDto` 를 참조하지 않는 독립 픽스처라 이번 필드 제거로 깨지지 않는다. 이전 리뷰 INFO#1(픽스처가 이번 diff 밖인 이유)과 일치.

> 뮤테이션을 이번 세션에서 직접 재실행하지 않은 이유: 병렬 fan-out 리뷰 중 저장소 공유 트리를 건드리지 말라는 규약 때문에, `cp` 로 격리한 사본에서 재현하는 비용 대비 `RESOLUTION.md` 의 산술이 테스트 개수·실패 축과 독립적으로 검증 가능했다(위 재구성). 확신도는 "재구성으로 정합 확인" 수준이며 "직접 재실행 확인"은 아니다.

## 발견사항

- **[INFO]** 파이프 레벨 유닛 테스트가 엔드포인트 전용 e2e negative case 를 대체 — 설계상 타당하나 "정확히 이 라우트가 400 을 낸다"는 종단 확인은 아니다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` (신규 `describe('CustomValidationPipe — forbidNonWhitelisted', …)` 블록, 게이트 84~108)
  - 상세: 이전 리뷰(`18_34_04` W2)는 "e2e negative case 추가 **또는** 파이프 유닛 테스트 추가" 를 택일 제안했고, 이번 커밋은 후자를 선택했다. `CustomValidationPipe` 가 `APP_PIPE` 로 전역 적용되므로(위 검증 절차) 이 선택은 `QueryExecutionDto` 하나가 아니라 모든 DTO 에 적용되는 더 일반적인 회귀 가드라는 점에서 합리적이다. 다만 이 유닛 테스트는 `pipe.transform()` 을 직접 호출해 수기로 만든 `ArgumentMetadata`(`{ metatype: NarrowDto, type: 'query' }`) 를 넘긴다 — 실제 HTTP 요청이 Nest 라우팅·쿼리스트링 파싱을 거쳐 `GET /api/executions/workflow/:workflowId?workflowId=…` 로 들어왔을 때도 동일하게 400 이 나는지는 이 테스트만으로는 보증되지 않는다(다만 컨트롤러 코드 검증으로 라우팅 배선 자체는 확인했다).
  - 제안: 이미 병합 가능한 수준이나, 후속으로 `workflow-execution.e2e-spec.ts` 에 `?workflowId=<uuid>` → 400 하나짜리 negative e2e 를 추가하면 "배선까지 포함한 종단 보증"이 완성된다. 필수 아님(INFO).

- **[INFO]** 신규 거절 단언이 응답 바디 형태(`code`/`details`)를 검증하지 않아, 같은 파일의 기존 테스트들과 검증 깊이가 다르다.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts` 게이트 92~99 (`'DTO 에 없는 키가 오면 400 이다'` 케이스), vs 같은 파일 게이트 34~54 의 `'emits path-qualified details for nested array errors'` (기존 테스트, `body.code`/`details` 단언)
  - 상세: 신규 테스트는 `rejects.toBeInstanceOf(BadRequestException)` 까지만 단언한다. `CustomValidationPipe.transform` 은 모든 검증 실패를 동일한 `{code:'VALIDATION_ERROR', details}` 포맷으로 감싸므로(파이프 구현 확인) 기능적으로 큰 공백은 아니지만, 같은 파일 안에서 검증 깊이가 들쭉날쭉해 "이 신규 축이 다른 검증 실패와 동일한 응답 포맷을 유지하는지"는 이 테스트만으로 보증되지 않는다.
  - 제안: 필요시 `body.code === 'VALIDATION_ERROR'` 한 줄만 추가하면 파일 내 일관성이 올라간다. Blocking 아님.

- **[INFO]** `RESOLUTION.md` 의 뮤테이션 검증 결과를 이번 세션에서 직접 재실행하지 않고 정적 재구성으로만 대조했다.
  - 위치: `review/code/2026/09/04/18_34_04/RESOLUTION.md` "W2 — 뮤테이션 검증" 표
  - 상세: 표의 "RED 1 / 4 pass" 산술은 파일 내 `it(` 개수(5) 및 각 테스트의 실패 원인 축(신규 거절 단언만 `forbidNonWhitelisted` 에 의존)과 논리적으로 정합했으나, 이는 재구성이지 재실행 확인이 아니다. 병렬 리뷰 중 공유 트리 뮤테이션 금지 규약 때문에 직접 재현을 생략했다.
  - 제안: 조치 불요(다음 라운드에서 필요시 scratch 사본으로 재현 가능).

CRITICAL/WARNING 은 발견되지 않았다. 신규 테스트는 이전 리뷰가 지적한 실질 커버리지 갭(200→400 breaking 동작 미고정)을 직접 메우며, 뮤테이션 산술도 정적으로 정합했다. 기존 회귀 테스트(컨트롤러·서비스·e2e·swagger 가드)는 `workflowId` 를 참조하지 않아 이번 필드 제거로 깨지지 않는다.

## 요약

이번 diff 의 핵심 테스트 변경은 `validation.pipe.spec.ts` 에 추가된 `forbidNonWhitelisted` 거절/대조군 테스트 쌍이며, 이는 전역 파이프(`APP_PIPE`) 레벨에서 검증되므로 개별 엔드포인트 e2e 보다 오히려 넓은 회귀 커버리지를 제공한다. 이전 리뷰 라운드가 지적한 "요점 동작 변화를 고정하는 테스트 부재"는 실질적으로 해소됐고, 뮤테이션 산술(1 RED/4 pass, 총 5)도 정적으로 재구성해 정합을 확인했다(직접 재실행은 아님). `QueryExecutionDto.workflowId` 제거로 깨지는 기존 테스트는 없음을 grep 으로 확인했다. 남은 것은 전부 INFO 수준의 선택적 보강(엔드포인트 종단 e2e, 응답 바디 형태 단언 일관성)이며 블로킹 사유는 없다.

## 위험도

LOW
