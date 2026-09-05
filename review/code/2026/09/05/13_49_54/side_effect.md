# 부작용(Side Effect) 리뷰

## 대상 요약

`spec/5-system/2-api-convention.md` §5.4 (응답 vs DTO 선언 대조)를 시행하는 테스트 전용
헬퍼(`response-contract.ts`/`.spec.ts`)를 신설하고, 4개 e2e spec(`audit-logs`,
`session-revocation`, `workflow-crud`, `workflow-execution`)에 실 응답 1건 대조 단언을
배선했다. 나머지 두 파일(`plan/in-progress/*.md`)은 진행 상황 문서 갱신이다.

## 발견사항

- **[INFO]** `schemaForDto()` 를 `beforeAll` 대신 `it()` 본문 안에서 매 테스트마다 호출 —
  그때마다 새 NestJS 테스트 모듈을 컴파일→`init()`→(내부적으로) `close()` 하는 전체
  부트스트랩 사이클이 반복된다.
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts:76` (`assertMatchesDtoSchema` 호출부,
    `await schemaForDto(AuditLogDto)` 인라인), 동일 패턴이
    `codebase/backend/test/session-revocation.e2e-spec.ts:107`,
    `codebase/backend/test/workflow-crud.e2e-spec.ts` (`schemaForDto(WorkflowDto)` 호출부,
    `mine` 대조 블록)에도 있다. 반대로 `codebase/backend/test/workflow-execution.e2e-spec.ts:68`
    는 `beforeAll` 에서 `executionSchema` 로 캐싱해 한 번만 부트스트랩한다.
  - 상세: `buildSwaggerDocument`(`codebase/backend/src/shared/testing/swagger-probe.ts:46-57`)는
    호출마다 `Test.createTestingModule(...).compile()` → `app.init()` → `finally` 블록의
    `app.close()` 로 정리되므로 **각 호출 자체는 격리되어 있고 리소스 누수는 없다** — 이건 진짜
    결함이 아니라 동일 DTO 스키마를 매 `it()` 마다 다시 생성하는 반복 작업이다. 부작용 관점에서
    "의도치 않은 상태 변경"은 아니지만, 같은 PR 안에서 캐싱 패턴이 파일마다 다른 것은 다음
    사람이 "왜 이 파일만 다르게 짰나"를 궁금해할 소지가 있다.
  - 제안: 필수 수정 아님. 원한다면 `audit-logs`/`session-revocation`/`workflow-crud` 도
    `workflow-execution` 처럼 `beforeAll` 캐싱으로 통일하는 정도의 정리.

- **[INFO]** (확인 완료, 결함 아님) `src/shared/testing/**` 는 `tsconfig.build.json` 의
  `exclude` 에 이미 등재돼 있어(2026-08-27 선례, 이번 PR 이전부터 존재) `response-contract.ts`
  가 devDependency `@nestjs/testing`/`@nestjs/swagger` 테스트 유틸을 import 해도 프로덕션
  `dist` 로 새지 않는다. 신규 소비처 4곳(`audit-logs`/`session-revocation`/`workflow-crud`/
  `workflow-execution` e2e-spec) 전부 `test/**` 또는 `*.spec.ts` 이며 프로덕션 모듈에서의
  import 는 0건(grep 전수 확인). 인터페이스·빌드 영향 없음.

- **[INFO]** (확인 완료, 결함 아님) `findContractViolations`/`formatViolations`/
  `assertMatchesDtoSchema`/`schemaForDto`(`codebase/backend/src/shared/testing/response-contract.ts:74,145,162,181`)
  전부 신규 export이고 기존 함수 시그니처를 바꾸지 않았다. `env`/`global`/`fs` 접근 grep
  결과 0건 — 새 전역 변수·환경 변수 읽기/쓰기·파일시스템 부작용 없음. `schemaForDto` 내부의
  동적 `ProbeController`(`response-contract.ts:184-190`)는 매 호출마다 새 클래스를 선언하고
  고정 라우트 `'__contract_probe__'` 를 쓰지만, 각 호출이 완전히 독립된 Nest 테스트 앱
  인스턴스(별도 DI 컨테이너) 위에서 도는 데다 실제 HTTP 리스닝을 하지 않으므로(스키마 생성만
  목적) 라우트 충돌·네트워크 노출 위험이 없다.

- **[INFO]** 4개 e2e spec 파일에 추가된 단언은 기존 테스트 케이스 본문에 새 `expect`/
  `assertMatchesDtoSchema` 호출을 덧붙이는 형태라, 실제 응답이 DTO 선언과 어긋나면 **기존에
  통과하던 테스트가 새로 실패할 수 있다**(의도된 회귀 방지 목적). 이는 "부작용"이 아니라
  설계된 동작이지만, 배포 전 CI 에서 4개 DTO(37 required 필드) 전부가 그대로 통과하는지
  1회 관측 필요 — 이 리뷰에서는 실행하지 않았다(e2e 인프라 기동 필요, 범위 밖).

## 요약

신설된 `response-contract.ts`/`swagger-probe.ts` 계열 헬퍼는 전역 상태·환경 변수·
파일시스템·네트워크에 손대지 않으며, Nest 테스트 앱을 호출마다 생성·`try/finally` 로 확실히
닫는 격리된 설계다. 프로덕션 빌드 제외(`tsconfig.build.json`)도 이미 확보돼 있고 새 export 는
전부 신규 함수라 기존 시그니처·공개 API 를 깨지 않는다. e2e spec 4곳에 추가된 대조 단언은
기존 테스트 흐름에 검증 스텝을 얹는 것이라 향후 실패를 유발할 잠재력은 있으나 그것이 이
변경의 목적이다. 발견된 항목은 전부 INFO 수준(캐싱 패턴 불일치, 확인 완료 사항)이며 CRITICAL/
WARNING 급 부작용은 없다.

## 위험도

NONE
