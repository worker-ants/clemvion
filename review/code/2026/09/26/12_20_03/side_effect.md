# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `roles.guard.ts` 의 문턱 계산이 `workspace-roles.ts` 로 추출됨 — 동작 동치 확인됨
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:222` (`const threshold = lowestRequiredRole(requiredRoles);`), `codebase/backend/src/common/constants/workspace-roles.ts:38-44` (`lowestRequiredRole` 정의)
  - 상세: 기존 인라인 `requiredRoles.reduce(...)` 가 `workspace-roles.ts` 의 `lowestRequiredRole` 로 이동했다. `roles.guard.ts:17` 에서 `workspaceRoleLevel` 을 `roleLevel` 이라는 별칭으로 그대로 import 해 쓰고 있고, `lowestRequiredRole` 내부도 같은 `workspaceRoleLevel` 을 쓰므로 두 계산은 동일 함수를 공유한다 — 값이 갈릴 여지가 없다. `RolesGuard` 의 공개 표면(`RolesGuard`, `Roles`, `ROLES_KEY`)과 시그니처는 변경되지 않았고, `lowestRequiredRole` 은 신규 export 라 기존 호출자에게 영향이 없다. 순수 함수(전역 상태·I/O 없음)이므로 부작용 관점에서 중립.
  - 제안: 없음 — 참고용 확인.

- **[INFO]** 신규 repo-guard 테스트가 `src/modules` 하위 전 컨트롤러 파일을 동적 `import()` 로 로드한다 — 정적 스캔 대비 실행 표면이 넓어짐
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:69-86` (`loadControllers` 함수, `await import(file)`)
  - 상세: 형제 가드인 `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 는 `fs.readFileSync` 로 소스 텍스트만 읽어 AST/정규식으로 판정하는 반면(코드 미실행), 이번에 추가된 `loadControllers` 는 `@nestjs/swagger` 데코레이터가 남긴 reflection 메타데이터(`swagger/apiResponse` 등)를 봐야 하므로 각 `*.controller.ts` 를 실제로 `import()` 해 모듈 코드를 실행한다. 이는 컨트롤러가 참조하는 서비스·DTO 등 전체 의존성 그래프를 테스트 프로세스 안에서 로드한다는 뜻이다. 데코레이터 자체는 메타데이터만 붙이므로(네트워크·DB 호출 없음) 일반적으로 안전하지만, 만약 어느 컨트롤러의 의존 모듈이 **모듈 스코프에서** 환경변수를 읽거나 싱글턴 클라이언트를 생성하는 등 import-time 부작용을 갖고 있다면 이 스펙이 CI 에서 매번 그 부작용을 유발한다. 이번 diff 에서 직접 건드린 두 순수 파일(`workspace-roles.ts`, `forbidden-descriptions.ts`)에는 그런 부작용이 없음을 확인했으나, `src/modules` 전체(30여 개 컨트롤러 + 전이 의존성)를 전수 감사하지는 못했다.
  - 제안: 이미 `NODE_ENV=test`/Jest 환경에서 AppModule 전체를 부트하는 e2e 스위트가 존재한다면 이 표면은 이미 노출돼 있어 추가 위험이 낮다고 볼 수 있다. 추가 안전장치가 필요하면 "컨트롤러 모듈은 import-time 부작용을 갖지 않는다" 는 불변식을 별도 컨벤션으로 명문화하는 것을 고려.

- **[INFO]** `@ApiForbiddenResponse` 설명 문자열 변경은 의도된 공개 인터페이스(OpenAPI 문서) 변경
  - 위치: 약 29개 컨트롤러 파일(`agent-memory.controller.ts`, `alerts.controller.ts`, `workspaces.controller.ts` 등) 전반의 `@ApiForbiddenResponse({ description: ... })`
  - 상세: 하드코딩된 한국어 403 설명 문자열이 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole(role)` 호출로 대체되면서, 생성되는 OpenAPI 문서의 403 응답 설명 텍스트가 바뀐다(예: `'워크스페이스 멤버가 아님'` → `'워크스페이스 멤버가 아님(NOT_A_MEMBER)'`). 이는 자동 생성 API 클라이언트나 문서를 소비하는 외부/내부 도구 입장에서는 공개 계약 텍스트 변경이다. 저장소 내 검색으로는 옛 원문 문자열(`'워크스페이스 멤버가 아님'` 등)을 정확히 단언하는 다른 spec/e2e 테스트나 커밋된 OpenAPI 스냅샷 파일(`openapi*.json` 등)을 찾지 못했으므로, 이번 변경으로 깨지는 기존 소비자는 확인되지 않았다. `spec/conventions/swagger.md` §5-4 준수가 명시된 목적이므로 의도된 변경으로 보인다.
  - 제안: 없음 — 의도된 변경이며 실제 소비자 파손 근거는 발견되지 않음. 참고로 기록.

- **[INFO]** `integrations.controller.ts` / `workspaces.controller.ts` 의 로컬 403 문구 상수가 공용 헬퍼 호출로 교체됨 — 값 동일성 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (구 `FORBIDDEN_MEMBER`/`FORBIDDEN_MEMBER_OR_ADMIN` 등 → `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole` 조합), `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (구 `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` → 동일)
  - 상세: 두 파일 모두 로컬로 계산하던 `\`워크스페이스 멤버가 아님(${NOT_A_MEMBER.code})\`` 형태의 상수를 지우고 공용 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole()` 로 치환했다. 보간에 쓰이는 원본 상수(`NOT_A_MEMBER.code`, `ROLE_REQUIRED[role].code`)가 같으므로 생성되는 문자열 값은 텍스트 그대로 동일하다 — 중복 상태 제거일 뿐 동작 변화 없음.
  - 제안: 없음.

- **[INFO]** 전역 변수·환경 변수·네트워크 호출·파일시스템 부작용 — 해당 없음
  - 상세: 이번 diff 전체(리뷰 대상 32개 파일)에서 `process.env` 읽기/쓰기, 파일 생성·삭제, 외부 서비스 호출, 이벤트/콜백 발행 패턴은 발견되지 않았다. 신규 상수(`FORBIDDEN_NOT_A_MEMBER`, `ROLE_SHORTFALL`, `FORBIDDEN_EDITOR_OR_NOT_OWNER`, `FORBIDDEN_OWNER_OR_PERSONAL` 등)는 모두 모듈 스코프에서 다른 상수를 보간해 만드는 순수 계산이며 요청마다 재평가되지 않는 정적 문자열이다. `forbidden-response-codes.spec.ts` 의 "모델 캐너리" 테스트도 `RolesGuard` 를 `new` 로 직접 생성해 `WorkspacesService.getMemberRole` 을 인메모리 스텁으로 대체하므로 실제 DB/네트워크 접근이 없다.
  - 제안: 없음.

## 뮤테이션 검증 메모

이번 리뷰는 코드를 직접 고쳐보는 뮤테이션 없이 `Read`/`Bash grep` 만으로 진행했다. 저장소 트리에는 아무것도 쓰지 않았으며, 세션 종료 시 `git status --short` 결과 리뷰 산출물 디렉터리(`review/code/2026/09/26/12_20_03/`) 외의 변경은 없다.

## 요약

이 변경 집합은 대부분(약 30개 컨트롤러) `@ApiForbiddenResponse` 의 하드코딩 문자열을 공용 헬퍼(`forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER`)로 치환하는 기계적 리팩터링이며, 그 자체로는 상태·전역변수·파일시스템·네트워크·환경변수에 부작용이 없는 순수 문자열 계산이다. 유일하게 로직이 이동한 `lowestRequiredRole` 추출은 `roles.guard.ts` 가 기존과 동일한 `workspaceRoleLevel` 함수를 계속 사용하도록 확인했으므로 동작 동치이며, 공개 시그니처(`RolesGuard`, `Roles`)도 그대로다. 유일하게 주목할 만한 새로운 표면은 신규 repo-guard 테스트(`forbidden-response-codes-guard.ts`)가 `src/modules` 전체 컨트롤러를 동적 `import()` 로 로드해 reflection 메타데이터를 읽는 방식인데, 이는 형제 가드가 쓰는 정적 텍스트 스캔과 달리 모듈 코드를 실제로 실행시키는 새로운 메커니즘이다 — 이번에 직접 검토한 두 파일은 순수했지만 전체 컨트롤러 의존성 그래프를 전수 감사하지는 못했으므로 참고 사항으로 남긴다. OpenAPI 403 설명 텍스트 변경은 의도된 공개 문서 변경이며 이를 깨뜨리는 기존 소비자(스냅샷·단언 테스트)는 발견되지 않았다.

## 위험도

LOW
