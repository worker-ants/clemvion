# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 OpenAPI 문서(403 `description`)의 문구가 대량으로 바뀐다 — 인터페이스 변경(문서 계약)
  - 위치: 129곳 전수(`codebase/backend/src/modules/**/*.controller.ts`), 대표로
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts:129`
    (`FORBIDDEN_ADMIN_ROUTE` → `forbiddenForRole('admin')`),
    `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:98-100`
    (`'소유자 아님'` → `` `${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)` ``)
  - 상세: `@ApiForbiddenResponse({ description: ... })` 문자열이 생성되는 OpenAPI 스키마에 그대로 실린다. 이 저장소에는 커밋된
    정적 `openapi.json`/`swagger.json` 이 없고(검색 결과 0건), 기존 테스트·프론트엔드 코드가 이 옛 한국어 문장을 문자열
    그대로 단언하는 곳도 없음을 확인했다(`grep` — 유일한 잔존 참조는 신설 가드의 "옛 문장" 픽스처 자체). 따라서 이 저장소
    안에서는 부수 파손이 없다. 다만 이 문서 문자열을 그대로 소비하는 **외부** 클라이언트(예: 자동 생성된 SDK의 doc-comment,
    사람이 읽는 API 포털)가 있다면 문구가 광범위하게 달라진다 — 이는 이번 변경의 의도된 목적(§5-4, 거부 코드 명시)이므로
    부작용이라기보다 계획된 인터페이스 변경이지만, "129곳 동시 변경"이라는 규모 때문에 명시적으로 적어 둔다.
  - 제안: 별도 조치 불요. 배포 노트/CHANGELOG 에 이미 반영되어 있다면(커밋 이력상 `e3b6437f2`) 충분.

- **[INFO]** 신설 저장소 가드(`forbidden-response-codes-guard.ts`)가 테스트 시점에 모든 `*.controller.ts` 를 동적 `import()` 한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts` 의 `loadControllers` 함수
    (`const mod = (await import(file))`)
  - 상세: `src/modules` 하위 전체 컨트롤러 파일을 로드해 그 모듈 최상위 코드(그리고 거기서 참조하는 다른 모듈들)를 평가한다.
    데코레이터(`@Controller`·`@Roles` 등)는 `reflect-metadata` 등록만 하고 부작용은 없지만, import 그래프를 타고 원치 않는
    최상위 부작용이 있는 모듈을 끌어올 이론적 여지는 있다. 다만 주석이 밝히듯 이 패턴은 **기존에 있던 자매 가드
    `http-status-advertised` 와 동일한 사정**이라고 코드 자신이 명시하므로, 이번 diff 가 새로 도입한 위험 등급이 아니라
    기존에 이미 받아들여진 패턴을 한 번 더 적용한 것이다. 이 파일은 `__tests__/` 아래에 있어 `tsconfig.build.json` 빌드
    산출물(런타임 서버)에는 포함되지 않는다 — 프로덕션 영향 없음.
  - 제안: 조치 불요(기존 관례를 따름). 필요 시 sibling 가드와 동일 근거를 명시적으로 재확인.

## 시그니처·전역 상태·파일시스템·환경변수·네트워크·이벤트 관점 — 문제 없음

- **함수 시그니처**: `lowestRequiredRole`(신설, `workspace-roles.ts`)은 `roles.guard.ts` 안에 인라인으로 있던 동일한
  `reduce` 로직을 그대로 옮긴 것이다. 두 호출부(`RolesGuard.assertMember`, 신설 가드 `guardRejectionCodes`)가 완전히 같은
  구현을 공유하도록 만든 목적의 추출이며, 로직 자체는 바뀌지 않았다(직접 대조 확인). 기존 함수(`workspaceRoleLevel` 등)의
  시그니처 변경은 없다.
- **전역 변수**: 새 전역 mutable 상태 없음. `FORBIDDEN_NOT_A_MEMBER`(문자열 상수)·`ROLE_SHORTFALL`(불변 `Readonly` 맵)는
  모듈 스코프 상수이며 어디서도 재할당되지 않는다.
- **파일시스템**: 저장소 트리에 새로 쓰거나 지우는 파일시스템 부작용 없음(`forbidden-response-codes-guard.ts` 의 동적
  import 는 읽기 전용, `source-scan.ts` 의 `collectTsFiles` 도 `fs.readdirSync` 읽기 전용이며 이번 diff 대상도 아니다).
- **환경 변수**: 이번 변경 어디에서도 `process.env` 를 읽거나 쓰지 않는다.
- **네트워크 호출**: 없음. 순수 문자열 조합 함수와 reflection 기반 정적 분석뿐이다.
- **이벤트/콜백**: `RolesGuard.assertMember` 의 예외 발생 조건(거부 시점·`ForbiddenException` 을 던지는 시점)은 리팩터 전과
  동일 — `threshold` 계산을 공용 함수로 옮겼을 뿐 호출 순서·타이밍·던지는 예외 종류는 그대로다(`roles.guard.ts:222-228`
  직접 대조).
- **컨트롤러 129곳의 변경**: 전부 `@ApiForbiddenResponse({ description: <literal> })` → `@ApiForbiddenResponse({ description: <상수|함수호출> })` 형태의 동형(isomorphic) 치환이다. 데코레이터 인자는 클래스 정의 시점(모듈 import 시점)에
    한 번 평가되는 순수 문자열 계산이라 런타임 요청 처리 경로·핸들러 시그니처·서비스 호출에는 전혀 영향이 없다. 훑어본
    대표 파일(`workspaces.controller.ts`, `integrations.controller.ts`, `workflow-test-datasets.controller.ts` 등)에서
    본문(핸들러 로직)에 대한 변경은 없고 데코레이터 인자만 바뀌었다.

## 요약

이 변경은 ①`RolesGuard` 내부에 있던 "요구 역할 중 최저 문턱" 계산을 `lowestRequiredRole` 로 추출해 가드와 신설 저장소
가드(`forbidden-response-codes`)가 같은 함수를 공유하도록 하고, ②`common/swagger/forbidden-descriptions.ts` 에 순수
문자열 헬퍼(`FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole`)를 신설해 ③129개 컨트롤러 라우트의 `@ApiForbiddenResponse`
설명 문자열을 하드코딩 리터럴에서 헬퍼 호출로 치환한 것이 전부다. 추출된 함수는 로직 변경 없이 그대로 옮겨졌고(직접
대조 확인), 신설 함수들은 부작용 없는 순수 함수이며, 129곳의 치환은 전부 데코레이터 인자(모듈 로드 시 1회 평가되는 문서
문자열)에 국한되어 런타임 요청 처리·전역 상태·파일시스템·환경변수·네트워크·이벤트 발생 경로에 아무 영향이 없다. 유일하게
주목할 점은 OpenAPI 403 응답 설명 문구가 129곳에서 동시에 바뀐다는 것인데, 이는 이번 작업의 명시적 목적이고 저장소 내
어디에도 옛 문구를 문자열로 단언하는 잔존 테스트가 없음을 확인했으므로 실질적 파손 위험은 없다. 신설 테스트 인프라
(`forbidden-response-codes-guard.ts`)가 컨트롤러 파일을 동적 `import()` 하는 것도 기존 자매 가드와 동일한 이미 받아들여진
패턴이며 빌드 산출물에는 포함되지 않는다.

## 위험도

NONE
