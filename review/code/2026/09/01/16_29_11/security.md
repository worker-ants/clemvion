# Security Review — audit-record-factory (5라운드, 2026-09-01 16:29:11)

## 검토 범위 및 방법

`origin/main...HEAD` 누적 diff 중 실질 코드(`.ts`) 변경분(파일 1~9)과 그 변경이 참조하는
런타임 컨텍스트를 소스에서 직접 `Read`/`grep`으로 재확인했다. 나머지 다수 파일(10건+)은
이전 4라운드의 `review/code/**`, `review/consistency/**` 산출물 자신과 `plan/*.md`,
`spec/*.md` 문서로, 이번 changeset 이 이미 4라운드에 걸쳐 code review 를 받은 뒤의 누적
상태다. 저장소 트리는 읽기 전용으로만 열람했고 뮤테이션은 하지 않았다(`git status --short`
확인 결과 사전 변경 없음, 본 리뷰에서도 아무것도 쓰지 않음).

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 실패 관측성
  (카운터 + 상세 로그), `@Optional() metrics` 주입
- `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — swallow 계약 + 관측 회귀 테스트
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `recordAudit` 의
  `action` 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`
  로 좁힘
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` /
  `business-metrics.service.spec.ts` — `recordAuditWriteFailed()` 신설, `clampLabel()` 공유 헬퍼
- `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`,
  `.spec.ts` — 리소스 바인딩 강제 AST 정적 가드(신규, 빌드/테스트 전용 코드)

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서
**새로 도입된 취약점은 없다.** DB 접근은 전부 TypeORM 파라미터 바인딩(`:workspaceId` 등)이고
이 diff 는 쿼리 조립부를 건드리지 않는다. 시크릿은 여전히 `randomBytes` 로 자동 발급되며
(`auth-configs.service.ts` `create()`/`regenerate()`), 하드코딩된 자격증명은 diff 어디에도
없음을 `grep`(API 키/시크릿/패스워드/토큰 패턴)으로 재확인했다(0건).

## 발견사항

- **[INFO]** `AuditLogsService.record()` 의 경고 로그가 `action`/`resourceType`/`resourceId`/
  `workspaceId` 를 이스케이핑 없이 단일 문자열로 결합한다 — 구조적 로그 위조(CWE-117) 방어가
  코드 레벨에는 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch 블록의
    `this.logger.warn(...)` 호출 (`Failed to write audit log (action=... resourceType=...
    resourceId=... workspaceId=...)` 문자열 결합부)
  - 상세: `auth-configs.service.ts` 의 5개 호출부(`create`/`update`/`regenerate`/`remove`/
    `reveal`)를 직접 대조한 결과 `resourceId` 는 전부 서버가 생성한 DB row UUID(`saved.id`/
    `id`)이고 사용자 입력 원문이 아니다. `workspaceId` 는 라우트 컨텍스트에서만 유래하고,
    `action` 은 닫힌 상수 유니온(`AUDIT_ACTIONS.*`)이다. 즉 이 diff 가 만든 4개 auth_config
    호출부에는 악용 가능 경로가 없다. 다만 로그 메시지 자체는 값이 무엇이든 개행 등 제어문자를
    이스케이프하지 않고 그대로 결합하는 구조라, 향후 다른 producer(현재 12개 파일 중 미검토
    분)나 새 리소스 타입이 사용자 통제 문자열을 `resourceId`/`resourceType` 에 흘려보내면
    로그 라인 위조로 이어질 수 있는 **방어 심층화 이슈**다. 실제 secret 값(auth_config 의
    `config.key`/`token`/`secret`)은 `record()` 호출부 어디에서도 `resourceId`/로그 메시지에
    실리지 않음을 확인했다 — secret 노출 경로는 없다.
  - 제안: 필수는 아니나 구조화 로깅(`logger.warn({ msg, action, resourceType, resourceId,
    workspaceId })`)으로 바꾸면 향후 producer 가 검증되지 않은 값을 넘기더라도 관례가 아니라
    구조로 방어된다.

- **[INFO]** `recordAuditWriteFailed(resourceType: string)` 의 `resourceType` 라벨이 열린
  `string` 타입이라 OTel/Prometheus 카운터 cardinality 가 시그니처상 무제한
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts`
    `recordAuditWriteFailed()` 메서드, `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` 정의부
  - 상세: `clampLabel()` 이 64자로 잘라 무제한 증식은 막지만, 잘린 64자 접두어가 서로 다른
    입력이면 여전히 다수의 distinct 라벨 값을 만들 수 있다. 다만 `AuditLogsService.record()`
    호출부(12개 producer 전수 대조 결과)가 넘기는 `resourceType` 은 전부 코드 내 상수
    (`AUTH_CONFIG_RESOURCE_TYPE` 등, distinct 10종)이고 사용자 입력이 아니므로 현재 악용 가능
    경로는 없다. `recordExecutionError` 와 동일 패턴이라 이 diff 가 새로 만든 위험이 아니다.
    (DB 자체가 아닌 관측 인프라 리소스 소모 관점의 방어 심층화.)
  - 제안: 조치 불필요. 코드 주석이 이미 "`record()` 가 닫힌 유니온으로 바뀌면 이쪽도 좁힌다"
    고 명시하고 있어 향후 방향이 문서화돼 있다.

- **[INFO]** 신규 정적 가드 `findUnboundHelpers` 가 `AuditActionFor<` **접두 문자열**만
  검사하고 제네릭 인자(어느 리소스에 묶였는지)는 비교하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    `findUnboundHelpers()` (`!s.actionType?.startsWith(\`${BOUND_TYPE_NAME}<\`)`)
  - 상세: 예컨대 다른 서비스의 `recordAudit` 의 `action` 타입이 실수로 다른 리소스에 묶인
    `AuditActionFor<...>` 로 잘못 지정돼도 이 가드는 접두사만 보므로 통과시킨다. 다만
    `audit-action.const.ts` 의 `_NoCrossDomain` 컴파일타임 가드가 이미 "다른 도메인 액션이
    다른 서비스의 `AuditActionFor<P>` 에 대입되는 것" 자체를 컴파일 단계에서 차단하고 있어
    (판별 프로브: `action: 'trigger.created'` 를 `auth-configs` 에 넣으면 tsc 0-에러였던
    구멍이 `_NoCrossDomain` 도입 이후로는 잡힌다, 대조군 `schedules` 는 애초 TS2322), 이 가드가
    놓치는 조합의 발생 표면은 좁다. 이는 이 changeset 을 심사하는 **가드 자체의 결함**이지
    운영 코드의 보안 결함은 아니다. 이전 라운드(4R)가 이미 같은 항목을 INFO 로 남겼고 이번
    라운드에서도 코드 변동이 없어 재확인만 한다.
  - 제안: 각 서비스 파일의 `resourceType` 상수를 함께 추출해 `AuditActionFor<typeof X>` 의
    `X` 가 같은 파일의 `resourceType` 상수와 동일한지까지 비교하면 이 구멍이 닫힌다. 우선순위
    낮음 — 컴파일러 가드가 실질적 방어를 이미 제공.

- **[INFO]** `AuditLogsService` 생성자의 `@Optional() metrics?` 및 관측 호출 이중
  `try`/`catch` — 재검증 결과 정상
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 생성자,
    `record()` catch 블록 전체(바깥 `try`/`catch` + 관측 호출을 감싸는 안쪽
    `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`)
  - 상세: `metrics` 가 `undefined`(DI 미주입)여도 옵셔널 체이닝으로 안전하고, 주입돼 있어도
    던지면 즉시 삼킨다 — "감사 실패가 본 요청(회전·삭제 등 특권 작업)을 절대 깨뜨리지 않는다"
    는 swallow 계약이 새 관측 경로에도 유지된다. `audit-logs.spec.ts` 의 `'metrics 호출이
    던져도 삼킨다'` 테스트가 이를 뮤테이션 대상으로 고정하고, `'metrics provider 없이 DI
    조립이 성공한다'` 테스트가 실제 Nest DI 컨테이너를 통해 `@Optional()` 을 검증한다(3R 에서
    이 테스트가 `new AuditLogsService(repo)` 직접 생성이라 vacuous 했던 결함이 수정됨 —
    이번 라운드에서 코드를 다시 열어 실측 확인).
  - 제안: 없음 — 확인 목적 기재.

- **[INFO]** 신설 repo-guard(`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`)의 파일시스템
  접근 — 읽기 전용, 스캔 범위 고정
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    `collectSourceFiles()`(`fs.readdirSync`/`fs.readFileSync` 만 사용, 쓰기·삭제 API 없음),
    `MODULES_DIR = 'codebase/backend/src/modules'` 상수
  - 상세: 스캔 루트가 상수로 고정돼 있고 `path.join(repoRoot, MODULES_DIR)` 을 벗어나는
    입력을 받지 않는다(경로 탐색 표면 없음, 외부 입력이 경로 구성에 관여하지 않음).
    `audit-action-binding-fixture.ts` 는 파싱 대상 문자열 템플릿일 뿐 실행되지 않으며
    (`ts.createSourceFile` 로 파싱만 함, `eval`/`Function` 등 동적 실행 없음) `MODULES_DIR`
    밖이라 자기 자신을 스캔하지 않는다. 빌드/테스트 전용 코드로 프로덕션 공격 표면에
    포함되지 않는다.
  - 제안: 없음 — 확인 목적.

## 요약

이번 changeset 은 신규 인젝션·인증 우회·하드코딩 시크릿·암호화 약화를 도입하지 않았고,
오히려 보안 태세를 두 방향으로 개선한다: (1) `auth-configs.service.ts` 의 `recordAudit`
action 타입을 리소스 바인딩 타입(`AuditActionFor<...>`)으로 좁혀 감사 로그 오귀속(다른
리소스의 액션이 `auth_config` 로 기록되는 것)을 컴파일 타임에 차단했고, (2) 감사 적재 실패가
조용히 묻히던 것을 카운터(`clemvion.audit.write_failed`) + 상세 로그로 가시화해 "특권 작업
(시크릿 회전·삭제)은 200 으로 성공, 감사 행만 유실" 시나리오의 탐지를 가능하게 했다. 신규
관측 호출은 이중 `try`/`catch` 로 보호돼 swallow 계약을 스스로 위반하지 않으며, `resourceId`
로 실제 secret 값이 로그·메트릭 라벨에 흘러드는 경로는 확인되지 않았다. 새 정적 가드는
읽기 전용이고 스캔 범위가 고정돼 있어 공격 표면이 아니다. 로그 메시지 구조화 부재·카운터
라벨 클램핑·가드의 제네릭 인자 미비교는 전부 실제 악용 경로가 확인되지 않는 방어 심층화
성격의 INFO 로, 이전 4라운드 리뷰의 판정(Critical 0, 위험도 LOW 이하)을 소스 재대조로
재확인했으며 이번 라운드에서 신규 코드 변경이나 신규 회귀는 발견되지 않았다.

## 위험도

LOW
