# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 기존 의존성만 재사용
  - 위치: `codebase/backend/package.json`, `codebase/backend/pnpm-lock.yaml` (변경 없음 — `git diff --stat origin/main...HEAD -- '**/package.json' '**/pnpm-lock.yaml'` 결과 0건)
  - 상세: 이번 diff(50개 파일, +2481/-35)는 OpenAPI 성공 응답 스키마 광고(`@ApiOkWrappedResponse` 계열 데코레이터 추가) + 저장소 가드(`http-status-advertised`) 강화 + 관련 spec/plan/review 문서로 구성된다. 코드에서 새로 `import` 되는 심볼은 전부 다음 두 부류다.
    1. 이미 설치된 `@nestjs/swagger` 의 기존 export (`ApiNoContentResponse`, `ApiOkResponse`, `ApiFoundResponse`, `ApiResponse`) — `webauthn.controller.ts`, `interaction-stream.controller.ts`, `workflow-assistant.controller.ts`, `sample.controller.ts` fixture.
    2. 프로젝트 내부 모듈(`codebase/backend/src/common/swagger/api-wrapped.ts` 의 신설 함수 `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`, 신설 DTO 파일 `trigger-secret-issue-response.dto.ts`) — 둘 다 순수 사내 코드이며 외부 패키지가 아니다.
    e2e 테스트가 쓰는 `pg`(`Client`), `supertest`, `@jest/globals` 도 `advertised-response-contract.e2e-spec.ts` 신설 파일에서 새로 등장하지만, 동일 저장소의 다른 `*.e2e-spec.ts` 파일들이 이미 동일 패키지를 import 하고 있어(예: `chat-channel-trigger-create.e2e-spec.ts`) 신규 도입이 아니라 기존 관행의 반복이다.
  - 제안: 없음 — 새 의존성이 없으므로 버전 고정·라이선스·취약점·번들 크기 항목은 해당 없음(N/A)으로 판정.

- **[INFO]** 내부 모듈 의존 방향은 기존 계층 구조를 그대로 따름
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:47-50` (신규 DTO import), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:41-52` (common/swagger 확장 함수 + 자기 모듈 DTO import)
  - 상세: `triggers.controller.ts` → `./dto/responses/trigger-secret-issue-response.dto` (같은 모듈 하위), `workflow-assistant.controller.ts` → `../../common/swagger`(공용 유틸) + `./dto/responses/assistant-session-response.dto`(같은 모듈). 둘 다 `controller → dto`, `controller → common/swagger` 방향으로 기존 아키텍처(공용 swagger 래퍼를 각 모듈 controller 가 소비)와 일치하며 순환 의존이나 계층 역전은 관측되지 않는다. `common/swagger/api-wrapped.ts` 는 특정 도메인 모듈을 import 하지 않아 하위 계층 순수성도 유지된다.
  - 제안: 없음.

- **[INFO]** 저장소 가드 fixture 확장은 실행 의존성이 아닌 테스트 전용 변경
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts:22`(`ApiFoundResponse` import 추가), `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`
  - 상세: 가드 자체(`http-status-advertised-guard.ts`, diff 생략됨 — 프롬프트 크기 제한으로 원본 미확인)는 AST 파싱을 이미 하던 기존 스캐너를 확장한 것으로 보이며, 새 파서 라이브러리 도입 흔적은 없다(diff 에 import 변경이 보이지 않음). fixture 는 `@nestjs/swagger` 의 기존 `ApiFoundResponse`/`ApiResponse` 를 사용한다.
  - 제안: 가드 구현 파일(`http-status-advertised-guard.ts`) 자체 diff 가 프롬프트에서 생략되어 새 AST 파서/유틸 의존 여부를 100% 확증하지 못했다 — 확인이 필요하면 다른 리뷰어(정적분석/아키텍처 담당)가 해당 파일 diff 를 직접 열어 대조할 것을 권장.

## 요약

이번 변경은 OpenAPI 성공 응답 스키마 문서화(신규 DTO 2개, 공용 swagger 래퍼 함수 1개 추가)와 저장소 가드 강화, 그에 따른 e2e/unit 테스트 보강이 전부다. `package.json`/`pnpm-lock.yaml` 등 매니페스트 파일은 이번 diff 범위에 전혀 포함되지 않았고(`git diff --stat` 로 확인), 코드에서 새로 등장하는 import 는 모두 (a) 이미 설치돼 있는 `@nestjs/swagger`/`pg`/`supertest`/`@jest/globals` 의 기존 export, 또는 (b) 이번 PR 이 만든 사내 모듈(신규 DTO 파일, `wrapNullableDataSchema`)이다. 따라서 버전 고정·라이선스 호환성·취약점·번들 크기·기존 의존성과의 충돌 항목은 모두 해당 없음이며, 내부 모듈 의존 방향도 controller → dto / controller → common 유틸이라는 기존 계층 구조를 벗어나지 않는다. 유일한 잔여 불확실성은 저장소 가드 구현 파일(`http-status-advertised-guard.ts`) 자체의 diff 가 프롬프트 크기 제한으로 생략되어 있어 그 파일 내부에서 새 파서 의존을 추가했는지 여부를 직접 확인하지 못했다는 점이나, fixture/spec 변화의 성격상(기존 AST 스캐너 확장) 새 의존성 도입 가능성은 낮다.

## 위험도

NONE
