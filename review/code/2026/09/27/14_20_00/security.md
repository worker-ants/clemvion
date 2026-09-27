# 보안(Security) Review — patch-omit-undefined (머지 후 재검토)

## 검토 범위

`origin/main...HEAD`(`1a9d9b414`) diff. 핵심 소스 변경은 공용 헬퍼 1개 + 서비스 3곳:

- `codebase/backend/src/common/utils/omit-undefined.ts` — `NotArray<T>` 타입 가드 추가.
- `codebase/backend/src/modules/{workflows,nodes,auth-configs}/*.service.ts` `update()` — PATCH 부분 본문 병합 전 `omitUndefined()` 적용, 워크플로 `settings` 병합에도 동일 필터 적용(+ `settings != null` null-가드).
- `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` — 응답에서 `workflow` 관계 제거(`const { workflow: _workflow, ...response } = saved;`).
- 나머지(`*.spec.ts`, `test/patch-partial-body.e2e-spec.ts`, `CHANGELOG.md`, `plan/**`, `review/code/2026/09/27/13_50_41/**`, `review/consistency/2026/09/27/13_11_33/**`)는 테스트·문서·이전 리뷰 라운드 산출물이며 실행 코드 변경 없음.

이번 라운드은 직전 `/ai-review` 1R(`review/code/2026/09/27/13_50_41`)에서 나온 requirement CRITICAL(`settings: null` → 500)이 `edd79ca40` 로 이미 수정되고 `e16a35beb`·`a4f57aeb0`·`1a9d9b414` 로 검증·문서화된 뒤의 머지 상태를 재검토한다. 저장소에 아무것도 쓰지 않았다(`git status --short` 확인 — 이 세션 출력 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `Object.assign(entity, omitUndefined(dto))` 패턴은 여전히 DTO 화이트리스트에 의존하는 mass-assignment 형태
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `update()` (`Object.assign(workflow, omitUndefined(rest))`), `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` (`Object.assign(node, omitUndefined(dto))`), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `update()` (`Object.assign(config, omitUndefined(rest))`)
  - 상세: `omitUndefined` 는 `undefined` 값을 가진 키만 걸러낼 뿐 병합되는 **키 집합**을 넓히지 않는다 — 이 diff 이전부터 존재하던 `Object.assign(entity, rest)` 패턴과 동일한 신뢰 경계다. `UpdateWorkflowDto`/`UpdateNodeDto`/`UpdateAuthConfigDto`/`WorkflowSettingsDto` 를 직접 열어 확인한 결과 모두 `class-validator` 데코레이터로 필드가 명시적으로 선언돼 있고, 전역 `CustomValidationPipe`(`whitelist + forbidNonWhitelisted`, `WorkflowSettingsDto` JSDoc 이 명시)가 미선언 키를 400 으로 거부한다. `auth-configs.service.ts` 는 `id`/`workspaceId`/`type` 을 명시적으로 구조분해 제외해 서비스 직접 호출 경로까지 막는다. 새 취약점은 아니며, 신규 필드 추가 시 화이트리스트 유지 여부를 재확인해야 한다는 기존 전제만 남아 있다.
  - 제안: 조치 불요. 새 DTO 필드 추가 시 `forbidNonWhitelisted` 유지 여부·엔티티에 그대로 얹혀도 되는 필드인지(권한/소유자 필드가 아닌지) 재확인 관행 유지.

- **[INFO]** 노드 PATCH 응답의 과다 노출(Excessive Data Exposure, OWASP API3) — 이 diff 안에서 이미 수정
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` `update()`(`const { workflow: _workflow, ...response } = saved; return response;`)
  - 상세: 수정 전에는 IDOR 검사용으로 `relations: ['workflow']` 로 함께 읽은 노드를 그대로 반환해 `NodeDto` 에 선언되지 않은 부모 워크플로 행 전체(이름·설명·태그·`settings`·`createdBy` 등)가 PATCH 응답에 실렸다. 반환 타입도 `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>` 로 좁혀 컴파일 타임에 재발을 막는다. 단위(`nodes.service.spec.ts` "응답에 IDOR 검사용 workflow 관계를 싣지 않는다")·e2e(`patch-partial-body.e2e-spec.ts` 케이스 C, `assertMatchesContract`) 로 고정돼 있다. 인가 체크(`node.workflow?.workspaceId !== workspaceId` → `NotFoundException`)는 `omitUndefined` 삽입 지점 **이전**에 그대로 유지된다.
  - 제안: 조치 완료. 후속 불요.

- **[INFO]** `omitUndefined` 의 `null` 값 보존 설계 + `WorkflowSettingsDto.maxConcurrentExecutions` 의 `@IsOptional()` null 통과 — 기존 설계, 이번 diff 로 악화되지 않음
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts`(JSDoc), `codebase/backend/src/modules/workflows/workflows.service.ts` `update()` 의 `if (settings != null) { … }` 가드
  - 상세: `@IsOptional()` 은 `null` 도 검증을 건너뛰므로 `settings: { maxConcurrentExecutions: null }` 형태가 JSONB 에 `null` 로 저장될 수 있다는 구조는 이 DTO 파일이 이번 diff 의 변경 대상이 아니라 그대로다. 런타임 backstop(`resolveConcurrencyCap` 이 부적합 값을 defaultCap 으로 무시)이 있어 인가/권한 영향은 없다. 이번 diff 가 새로 추가한 `settings != null` 가드(직전 라운드 CRITICAL 수정)는 "명시적 `null` = no-op, 빈 객체 = no-op, 값 있음 = 병합" 세 갈래를 정확히 분기하며, 단위(«settings: null 은 던지지 않고 저장된 설정을 그대로 둔다», «명시적 null 은 로드한 값을 지운다» — 워크플로 최상위 필드용) 및 e2e(케이스 B `settings: null` → 200, 저장값 유지)로 뮤턴트 G1 KILLED 까지 확인됐다(`RESOLUTION.md`). 500 회귀는 이미 닫혔고, 500 자체도 `class-validator` 검증을 통과한 뒤 서버 내부 로직에서 발생한 미처리 예외였을 뿐 사용자 입력이 그대로 에러 메시지에 반영되는 정보 노출 형태는 아니었다(`TypeError: Cannot convert undefined or null to object` 는 일반 NestJS 500 응답이며 스택/쿼리 내용을 노출하지 않는다).
  - 제안: 조치 불요. 참고용.

- **[INFO]** 하드코딩된 시크릿·인젝션·안전하지 않은 암호화 신규 이슈 없음
  - 위치: 전체 diff (`codebase/`, `CHANGELOG.md`, 신규 e2e `test/patch-partial-body.e2e-spec.ts`)
  - 상세: 신규 e2e 는 `registerAndLogin`/`createTeamWorkspace` 헬퍼로 토큰을 런타임에 발급받아 쓰고(`token = owner.accessToken`), 하드코딩된 비밀번호·API 키·인증서는 없다. `type: 'bearer_token'`/`type: 'api_key'` 는 인증 설정 종류를 나타내는 enum 리터럴일 뿐 실제 자격증명이 아니다. SQL/커맨드 인젝션 표면(원시 쿼리 조합, `exec`, 파일 경로 결합)도 diff 에 없다. `auth-configs.service.ts` 의 HMAC 알고리즘 화이트리스트(`HMAC_ALLOWED_ALGORITHMS`)·비밀 키 마스킹(`SECRET_CONFIG_KEYS`)은 이번 diff 로 변경되지 않고 그대로 유지된다. 인증/인가 체크(`assertWorkflowInWorkspace`, `findById(id, workspaceId)`, 노드의 워크스페이스 일치 검사)도 이번 diff 가 건드리지 않는 지점 이후에서만 병합 로직이 바뀐다.
  - 제안: 없음.

- **[INFO]** 리뷰 아티팩트(`review/code/2026/09/27/13_50_41/**`, `review/consistency/2026/09/27/13_11_33/**`)는 문서/JSON — 코드 실행 표면 없음, 비밀정보 없음
  - 위치: 위 두 디렉터리 하위 전 파일
  - 상세: `grep -riE "password|secret|api[_-]?key|BEGIN (RSA|PRIVATE)"` 로 훑었으나 매치는 코드 리뷰 서술 안의 `SECRET_CONFIG_KEYS`/`bearer_token`/`api_key` 같은 식별자·enum 값 인용뿐이었다. 실제 비밀값·토큰 문자열은 없다.
  - 제안: 없음.

## 요약

이번 diff 는 PATCH 부분 본문이 `undefined` 필드로 로드된 엔티티 값을 덮어 응답·DB 값을 잃던 데이터 무결성 결함을 3개 서비스(workflows·nodes·auth-configs)에서 공용 헬퍼(`omitUndefined`)로 고치고, 직전 `/ai-review` 1R 에서 나온 `settings: null` 500 회귀(Critical)도 `settings != null` 가드로 이미 고쳐 병합 상태에 반영돼 있다. 인증/인가 체크 로직 자체는 건드리지 않았고, 부수적으로 노드 PATCH 응답이 IDOR 검사용 부모 워크플로 행 전체를 노출하던 과다 노출(OWASP API3) 결함도 같은 PR 안에서 수정·테스트로 고정됐다. `Object.assign(entity, omitUndefined(dto))` 패턴이 DTO 화이트리스트(`forbidNonWhitelisted`)에 계속 의존한다는 점, `maxConcurrentExecutions` 의 `null` 경유 우회 가능성은 모두 이 PR 이전부터 있던 기존 설계이며 인가·권한 영향이 없어 신규 결함으로 보지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 안전하지 않은 암호화, 민감정보 노출 에러 처리 등 OWASP Top 10 관점의 신규 위반은 발견되지 않았다.

## 위험도

NONE
