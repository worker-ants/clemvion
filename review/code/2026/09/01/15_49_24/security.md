# Security Review — audit-record-factory (4라운드, 2026-09-01 15:49:24)

## 검토 범위

`origin/main...HEAD` 누적 diff. 실질 코드 변경은 커밋 `9a2e860dc`(신규 기능) →
`4a65b12c6`(1R fix) → `1b7334098`(2R fix) → `86bd4bd90`(3R fix)로 이미 3라운드에 걸쳐
수정·검증됐고, 이번 라운드에서 코드(`.ts`)에 새로 diff 된 라인은 없다(리뷰/consistency
산출물과 `spec/` 3문서만 추가). 아래는 소스를 직접 `Read`/`grep`으로 다시 열어 **독립적으로**
재검증한 결과다 — 이전 3라운드의 판정을 그대로 옮기지 않고, 저장소 트리를 뮤테이션하지 않은 채
(읽기 전용) 실제 최신 코드를 대조했다.

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 실패 관측성(카운터+상세 로그), `@Optional() metrics` 주입
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `recordAudit`의 `action` 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`로 좁힘
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordAuditWriteFailed()` 신설, `clampLabel()` 공유 헬퍼
- `codebase/backend/src/modules/audit-logs/audit-action.const.ts`(컨텍스트, 이번 diff 밖) — `AuditActionFor<P>` 정의 + 컴파일타임 `_NoCrossDomain` 회귀 가드
- `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`, `.spec.ts` — 리소스 바인딩 강제 AST 정적 가드(신규)

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서
**새로 도입된 취약점은 없다.** DB 접근은 전부 TypeORM 파라미터 바인딩이고 이 diff는 쿼리
조립부를 건드리지 않는다. 시크릿은 여전히 `randomBytes`로 자동 발급되며(`auth-configs.service.ts`
`create()`), 하드코딩된 값은 diff 어디에도 없다.

## 발견사항

- **[INFO]** `AuditLogsService.record()`의 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId`를 이스케이핑 없이 단일 문자열로 결합한다 — 구조적 로그 위조(CWE-117) 방어가 코드 레벨에는 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:114-119` (`this.logger.warn(...)`)
  - 상세: 값에 개행 등 제어문자가 섞이면 로그 라인을 위조할 수 있는 구조다. 다만 실제 호출부 전수(`grep -rn "auditLogsService.record(\|recordAudit(" codebase/backend/src/modules`, 12개 producer)를 직접 대조한 결과 `resourceId`는 전부 서버가 생성한 DB row id(`saved.id`/`id`/`trigger.id`/`newExecutionId` 등)이고, `workspaceId`는 세션/라우트 컨텍스트에서만 유래한다 — 사용자가 자유 텍스트를 직접 주입할 수 있는 경로는 현재 없다. `action`은 닫힌 상수 유니온이라 안전하다. 즉 **현재는 악용 가능한 경로가 없는 방어 심층화 이슈**이며, 이 결론은 3라운드 전(1R)의 security 리뷰가 이미 같은 근거로 내린 것과 일치한다(재검증 결과 변동 없음).
  - 제안: 필수는 아니나, 구조화 로깅(`logger.warn({ msg, action, resourceType, resourceId, workspaceId })`)으로 바꾸면 향후 producer가 검증되지 않은 값을 넘기더라도 관례가 아니라 구조로 방어된다.

- **[INFO]** 신규 정적 가드 `findUnboundHelpers`가 `AuditActionFor<` **접두 문자열**만 검사하고 제네릭 인자(어느 리소스에 묶였는지)는 비교하지 않는다 — 감사 오귀속을 막는 방어선치고 판정이 느슨함
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157` (`findUnboundHelpers` — `!s.actionType?.startsWith(\`${BOUND_TYPE_NAME}<\`)`)
  - 상세: 예컨대 `TriggersService.recordAudit`의 `action` 타입이 실수로 `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`(다른 리소스 바인딩)로 잘못 복붙되어도 이 가드는 접두사만 보므로 통과시킨다 — 이번 PR이 고친 "맨 union" 결함과 같은 계열의, 더 은밀한 오귀속을 못 잡는다. 다만 `audit-action.const.ts`의 `_NoCrossDomain` 컴파일타임 가드(파일 끝 `type _NoCrossDomain = 'trigger.created' extends AuditActionFor<'workflow'> ? never : true;`)가 **이미 다른 도메인 액션이 다른 서비스의 `AuditActionFor<P>`에 대입되는 것 자체를 컴파일 단계에서 차단**하고 있어(실측: `tsc` 0 에러 vs 대조군 `TS2322`), 이 가드가 놓치는 조합("리소스 X의 서비스가 리소스 X 자신을 가리키는 `AuditActionFor<X>`를 정확히 쓰되, X 상수가 실제 파일 상수와 다른 경우")은 발생 표면이 극히 좁다. Critical/Warning으로 올릴 사안은 아니다.
  - 제안: 각 서비스 파일의 `resourceType` 상수(`AUTH_CONFIG_RESOURCE_TYPE` 등)를 함께 추출해 `AuditActionFor<typeof X>`의 `X`가 같은 파일의 `resourceType` 상수와 동일한지까지 비교하면 이 구멍이 완전히 닫힌다. 우선순위 낮음.

- **[INFO]** `AuditLogsService` 생성자의 `@Optional() metrics?` 및 관측 호출 이중 `try`/`catch` — 재검증 결과 정상
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:14-20`(생성자), `:96-120`(바깥 `try`/`catch`), `:109-113`(관측 호출을 감싸는 안쪽 `try`/`catch`)
  - 상세: 1라운드 WARNING("관측 호출이 무방비라 swallow 계약을 이 diff 자신이 깰 수 있다")이 안쪽 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`로 해소돼 있음을 소스에서 직접 확인했다. `metrics`가 `undefined`(DI 미주입)여도 옵셔널 체이닝으로 안전하고, 주입돼 있어도 던지면 즉시 삼킨다 — "감사 실패가 본 요청(회전·삭제 등 특권 작업)을 절대 깨뜨리지 않는다"는 계약이 이 새 경로에도 유지된다. `audit-logs.spec.ts`의 `'metrics 호출이 던져도 삼킨다'` 테스트(신설)가 이를 뮤테이션 대상으로 고정한다.
  - 제안: 없음 — 확인 목적 기재.

- **[INFO]** `AuthConfigsService.recordAudit`의 `action` 타입 좁힘(`AuditAction` → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`) — 컴파일타임 전용, 재검증 결과 실제로 좁혀짐
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:86` (`action: AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>;`), `:32`(`AUTH_CONFIG_RESOURCE_TYPE` 상수)
  - 상세: 이 변경 자체가 보안 강화다 — 종전에는 `action`이 전체 `AuditAction` union이라 `auth_config`가 아닌 다른 리소스의 액션(예: `trigger.created`)을 `resourceType: 'auth_config'`로 기록해도 컴파일러가 잡지 못했다(사고 조사 시 감사 로그 신뢰성 저해 가능성). `AuditActionFor<P>`(`audit_action.const.ts`의 `Extract<AuditAction, \`${P}.\${string}\`>`)로 좁혀 이 조합을 타입 레벨에서 배제했고, 파일 끝 `_NoCrossDomain` 가드가 이 좁힘이 실제로 작동함을 빌드 시 검증한다(회귀 시 `tsc` 에러). `recordAudit`은 `private`이고 파일 내 5개 호출부(`create/update/regenerate/remove/reveal`)가 전부 `AUDIT_ACTIONS.AUTH_CONFIG_*`만 넘겨 런타임 동작 변화는 없다.
  - 제안: 없음 — 개선으로 확인.

- **[INFO]** 신설 repo-guard(`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`)의 파일시스템 접근 — 읽기 전용, 스캔 범위 고정
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:38-57` (`collectSourceFiles` — `fs.readdirSync`/`fs.readFileSync`만 사용, 쓰기·삭제 API 없음), `MODULES_DIR = 'codebase/backend/src/modules'`(같은 파일 `:13`)
  - 상세: 스캔 루트가 상수로 고정돼 있고 `path.join(repoRoot, MODULES_DIR)`을 벗어나는 입력을 받지 않는다(경로 탐색 표면 없음). `audit-action-binding-fixture.ts`는 파싱 대상 문자열 템플릿일 뿐 실행되지 않으며 `MODULES_DIR` 밖이라 자기 자신을 스캔하지 않는다(자기반증 회피).
  - 제안: 없음 — 확인 목적.

## 요약

이번 changeset은 신규 인젝션·인증 우회·하드코딩 시크릿·암호화 약화를 도입하지 않았고, 오히려
보안 태세를 두 방향으로 개선한다: (1) `auth-configs.service.ts`의 `recordAudit` action 타입을
리소스 바인딩 타입(`AuditActionFor<...>`)으로 좁혀 감사 로그 오귀속(다른 리소스의 액션이
`auth_config`로 기록되는 것)을 컴파일 타임에 차단하고 빌드 불변식(`_NoCrossDomain`)으로 고정했으며,
(2) 감사 적재 실패가 조용히 묻히던 것을 카운터(`clemvion.audit.write_failed`)+상세 로그로 가시화해
"특권 작업(시크릿 회전·삭제)은 200으로 성공, 감사 행만 유실"이라는 시나리오의 탐지를 가능하게
했다. 신규 관측 호출은 이중 `try`/`catch`로 보호돼 있어 swallow 계약(감사 실패가 본 요청을
깨뜨리지 않는다)을 스스로 위반하지 않는다. 새 정적 가드는 읽기 전용이며 스캔 범위가 고정돼 있다.
로그 메시지 구조화 부재·가드의 제네릭 인자 미비교는 실제 악용 경로가 확인되지 않는 방어
심층화 성격의 INFO이며, 즉시 조치가 필요한 결함은 없다. 3라운드에 걸친 이전 리뷰(모두 Critical
0·Warning 0~2, 위험도 LOW 이하)의 판정을 소스 재대조로 재확인했고 신규 회귀는 발견되지 않았다.

## 위험도

LOW
