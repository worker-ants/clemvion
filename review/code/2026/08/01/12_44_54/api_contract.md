# API 계약(API Contract) Review

## 리뷰 범위 요약

`git diff origin/main...HEAD` 로 실제 변경분을 직접 대조했다. 이번 변경은
`workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` 4개 리소스군에 대한
CRUD 감사 로깅(audit logging) 도입이며, 구체적으로는:

- `audit-action.const.ts`: `AUDIT_ACTIONS` 에 13개 신규 액션 상수 추가 + 문서(docstring) 갱신.
- `audit-log-response.dto.ts`: `action` 필드의 Swagger `description` 문구 갱신(값 목록 하드코딩 제거, SoT 를 const 로 일원화).
- `model-config` / `schedules` / `triggers` / `workflows` 의 controller: 기존 `create`/`update`/`remove`(+ model-config `setDefault`) 핸들러에 `@CurrentUser('sub') userId` 파라미터 **추가**, service 호출에 `userId` 인자 전달.
- 각 module: `AuditLogsModule` import 추가(신규 DI 의존성).
- 각 service: private `recordAudit()` 헬퍼 + 각 mutation 메서드 말미(커밋 **후**)에 `auditLogsService.record(...)` 호출 추가.

컨트롤러의 `@Roles(...)`, `@ApiOkPaginatedResponse`/`@ApiOkWrappedResponse`/`@ApiCreatedWrappedResponse`,
HTTP status code(`@HttpCode`), URL 경로, 요청 DTO(`Create*Dto`/`Update*Dto`/`Query*Dto`)는
**diff 에 포함되어 있지 않다** — 즉 이번 변경은 엔드포인트 시그니처·요청 검증·응답 스키마·
페이지네이션·URL 설계를 건드리지 않는다. `@CurrentUser('sub')` 는 이미 인증된 요청의 JWT 에서
값을 뽑아내는 파라미터 데코레이터이므로 클라이언트가 보내는 요청 바디/헤더에는 아무 영향이 없다.

## 발견사항

- **[INFO]** 신규 감사 액션의 verb 시제가 리소스군마다 다르다(`model_config.*` 는 현재형 `create/update/delete/set_default`, `workflow/trigger/schedule.*` 는 과거분사 `created/updated/deleted`).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:76-88` (`AUDIT_ACTIONS` 블록)
  - 상세: `AuditLogDto.action` (`codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:41`) 은 이 문자열을 그대로 API 응답에 노출한다. 리소스군별 verb 시제가 갈리면 이 필드를 소비하는 클라이언트(관리 콘솔 필터 UI 등)가 패턴 매칭 규칙을 하드코딩하기 어려워질 수 있다. 다만 파일 상단 docstring(동 파일 32-36줄)에 `auth_config` 와 동일 근거로 의도된 설계임이 명문화되어 있고, `action` 필드 자체가 이미 `string`(비-enum) 타입으로 선언되어 "클라이언트는 enum 으로 단정하지 말 것"이라는 계약이 명시돼 있어 실질적 breaking 위험은 없다.
  - 제안: 조치 불필요(의도된 설계, 근거 문서화됨). 후속 리소스군 추가 시에도 동일 문서에 시제 규칙을 이어서 남길 것.

- **[INFO]** `AuditLogDto.action` Swagger `description` 이 여전히 자연어로 리소스군 목록(`integration · auth_config · workspace · member · execution · user · workflow · trigger · schedule · model_config`)을 나열한다.
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:27-40`
  - 상세: 이번 diff 자체가 "목록을 여기 복제하면 액션이 늘 때마다 낡는다"는 것을 스스로 지적하며 SoT 를 `AUDIT_ACTIONS` const 로 명시했음에도, description 은 여전히 리소스군 이름을 하드코딩한다(다음 리소스군 추가 시 다시 낡을 수 있음). 문서 자체가 이 위험을 인지하고 있으므로 실무적으로는 허용 가능한 트레이드오프.
  - 제안: 향후 리소스군이 아니라 액션 값 자체를 열거하던 과거 패턴이 반복되지 않도록, 이 description 도 "리소스군 열거" 자체를 제거하고 `AUDIT_ACTIONS` 참조만 남기는 것을 고려할 수 있다(선택 사항).

## 관점별 점검 결과

1. **하위 호환성**: breaking change 없음. 신규 액션 문자열 추가는 순수 additive(응답 필드 `action` 은 이미 free-string). 기존 클라이언트가 특정 action 값 집합만 화이트리스트로 파싱하고 있었다면 신규 값은 무시되거나 "알 수 없는 액션"으로 표시될 수 있으나, 이는 API 계약 위반이 아니라 클라이언트 측 확장성 문제다.
2. **버전 관리**: 별도 API 버전 필드/헤더 변경 없음. 해당 없음.
3. **응답 형식**: 컨트롤러 반환 타입·DTO 스키마(`ModelConfigDto`/`ScheduleDto`/`TriggerDto`/`WorkflowDto`) 변경 없음. `AuditLogDto` 는 문서 문구만 변경.
4. **에러 응답**: 변경된 서비스 메서드(`create`/`update`/`remove`/`setDefault`) 내 기존 `BadRequestException`/`NotFoundException` 발생 로직·코드(`MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND` 등)는 diff 밖 — 감사 기록은 실제 mutation 커밋 **이후**에 실행되도록 각 서비스에서 일관되게 배치되어 있어(`schedules.service.ts` W6 순서 가드, `triggers.service.ts` 동일 패턴), 감사 기록 자체가 새로운 실패 모드로 요청을 실패시키지 않는다.
5. **요청 검증**: 요청 DTO 변경 없음. `@CurrentUser('sub')` 는 서버 내부에서 이미 인증 미들웨어가 채워둔 JWT claim 을 읽는 파라미터 데코레이터이므로 클라이언트 요청 스키마에 영향 없음.
6. **URL/경로 설계**: 라우트 데코레이터(`@Post`/`@Patch`/`@Delete` 등) 변경 없음.
7. **페이지네이션**: 목록(`findAll`) 핸들러는 diff 대상이 아님 — 페이지네이션 동작 불변.
8. **인증/인가**: 변경된 4개 컨트롤러의 mutation 엔드포인트는 기존에 이미 `@Roles('editor')` + `@ApiBearerAuth('access-token')` 가 적용돼 있었고 이번 diff 로 추가/축소되지 않았다. `@CurrentUser('sub')` 추가는 인가 로직이 아니라 감사 주체(actor) 식별용으로, 인가 게이트를 우회하거나 약화시키지 않는다.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` CRUD 경로에 감사 로깅을 추가하는
내부 계측(instrumentation) 작업으로, 엔드포인트 URL·HTTP 메서드·요청 검증·응답 DTO 스키마·
페이지네이션·인증/인가 게이트를 전혀 건드리지 않는 순수 additive 변경이다. 유일하게 API 응답에
노출되는 부분은 `AuditLogDto.action` 필드에 새 값이 추가되는 것인데, 해당 필드는 이미
비-enum(`string`) 타입으로 설계되어 있어 클라이언트가 이를 열거형으로 가정하지 않는 한 하위
호환성 문제가 없다. 신규 액션 verb 시제 불일치는 문서화된 의도적 설계이므로 실질적 리스크가
아니다. Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE
