# Security Review — audit-record-factory (2026-09-01 15:25:56, 3라운드 누적)

## 검토 범위 요약

이번 프롬프트는 `origin/main...HEAD` 전체 changeset(47개 파일)이며, 실질 코드/스펙 변경은
아래로 좁혀진다 — 나머지(파일 12~44)는 앞선 두 리뷰 라운드(`14_31_12`, `15_10_38`)와
consistency-check(`15_00_54`) 산출물이 그대로 커밋된 것으로, 이번 라운드가 새로 만든 코드가
아니다.

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 실패 시
  관측성 강화(카운터 + 상세 로그 필드) + `@Optional()` metrics 주입
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `recordAudit()`
  의 `action` 파라미터를 맨 union(`AuditAction`)에서 리소스 바인딩 타입
  (`AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`)으로 강화 — **실제 감사 오귀속 결함
  수정**
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordAuditWriteFailed()`
  신설(OTel counter, label clamping), `clampLabel`/`PROMETHEUS_LABEL_MAX_LEN` 공유 상수화
- 신규 정적 가드 `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` +
  `audit-action-binding.spec.ts` — AST 기반, 읽기 전용, 고정 경로(`MODULES_DIR`)만 스캔
- `spec/5-system/_product-overview.md`, `spec/data-flow/1-audit.md`,
  `spec/data-flow/9-observability.md` — NF-OB-07 카탈로그 등재 + swallow 서술 정정 (문서만)
- `plan/**`, `CHANGELOG.md` — 문서만

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서
**새로 도입된 취약점을 발견하지 못했다.** DB 접근은 전부 TypeORM `QueryBuilder` 파라미터
바인딩(`:workspaceId` 등)이고 이 diff 는 SQL 조립부를 건드리지 않는다. 신규 가드 3파일은
`fs.readdirSync`/`fs.readFileSync` 로 고정 디렉터리(`codebase/backend/src/modules`)만
재귀 스캔하는 테스트 전용 코드로, 외부 입력을 받지 않아 경로 탐색 표면이 없다. 시크릿은
여전히 자동 발급(`randomBytes`)이며 하드코딩된 값은 없다.

## 앞선 두 라운드와의 차이 — 독립 재검증

이전 라운드(`14_31_12`) security.md 의 INFO #1(`record()` catch 안 metrics 호출 무보호)은
이번 소스에서 **해소 확인**: `audit-logs.service.ts` 의 `this.metrics?.recordAuditWriteFailed(...)`
호출이 자체 `try { … } catch { /* best-effort */ }` 로 감싸져 있다(현재 파일 실측, 게이트
109-113). `RESOLUTION.md`(`15_10_38`)가 뮤테이션 X5(try 제거) 로 GREEN→RED 전환을 실측했다는
서술도 소스 상태와 일치한다.

`AuditActionFor<P>` 가 실제로 컴파일 타임 좁히기를 하는지 `audit-action.const.ts` 를 직접
읽어 확인했다 — `Extract<AuditAction, \`${P}.${string}\`>` 이고, 넓어지는 회귀를 잡는
`_NoCrossDomain` 컴파일 가드(게이트 139-142)까지 있어 `any` 로 무력화되지 않는다.
`auth-configs.service.ts` 의 `AUTH_CONFIG_RESOURCE_TYPE`(`'auth_config'`) 와 타입 인자가
정확히 일치함도 확인했다 — 이번 diff 가 고친 것은 실질적인 감사 오귀속 방어다.

## 발견사항

- **[INFO]** 새 경고 로그가 `action`·`resourceType`·`resourceId`·`workspaceId` 를 비구조화
  문자열로 결합한다 — 값에 제어문자(개행 등)가 섞이면 구조적으로 로그 위조(CWE-117)가
  가능한 포맷이지만, **실제 호출 경로 전수 확인 결과 현재는 악용 불가**.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`record()` catch
    블록의 `logger.warn` 호출, 새 로그 포맷 부분 — 프롬프트 파일 2 diff 게이트 114-119)
  - 상세: `entry.action` 은 `AuditAction`(닫힌 리터럴 유니온)이라 임의 문자열이 들어올 수
    없다. `entry.resourceType`/`resourceId`/`workspaceId` 는 시그니처상 `string`(열림)이지만,
    `record()` 를 호출하는 12곳 producer 를 전수 확인(`grep -rn "auditLogsService.record("`)한
    결과 (1) `resourceId`/`workspaceId`(또는 `memberId`/`invitationId`)는 전부 컨트롤러의
    `@Param('...', ParseUUIDPipe)` 검증을 통과한 라우트 파라미터이거나(`workspaces.controller.ts`,
    `triggers.controller.ts`, `schedules.controller.ts`, `model-config.controller.ts` 등에서
    직접 확인), (2) DB row 의 `saved.id`(TypeORM UUID PK) 또는 (3) JWT `payload.sub`/
    `payload.workspaceId` 다. 개행·제어문자를 담을 수 있는 자유 텍스트 경로는 없었다.
  - 제안: 즉시 조치는 불요(방어 심층화 성격). 다만 이 로그 포맷은 12개+ producer 가 **공유**하는
    chokepoint 라, 향후 어떤 producer 가 검증되지 않은 자유 텍스트를 `resourceId`/`workspaceId`
    로 넘기면(현재는 라우트 레벨 관례로만 회피) 로그 위조로 이어질 수 있다. 구조화 로깅
    (`logger.warn({ msg, action, resourceType, resourceId, workspaceId })`) 또는 값의
    개행/제어문자 제거 유틸로 전환하면 향후 producer 추가 시에도 관례에 의존하지 않는
    구조적 방어가 된다.

- **[INFO]** `BusinessMetricsService.recordAuditWriteFailed` 의 `resource_type` 라벨이
  닫힌 유니온이 아니라 `clampLabel()`(64자 truncate)만으로 cardinality 를 방어한다 — 소스인
  `record()` 시그니처가 `resourceType: string`(열림)이라 컴파일러가 닫힘을 증명하지 못한다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts`
    (`recordAuditWriteFailed`, 게이트 159-183 부근 — `clampLabel(resourceType)` 호출부)
  - 상세: 이 라벨은 코드가 정하는 값(실측 12종)으로 사실상 유계지만, 타입으로 증명되지
    않으므로 이론상 향후 producer 가 사용자 입력을 그대로 `resourceType` 에 흘려보내면
    Prometheus 라벨 cardinality 폭발(가용성 저하 방향의 경미한 DoS 표면)로 이어질 수 있다.
    JSDoc(게이트 172-178, "왜 클램핑인가")이 이 트레이드오프를 이미 명시적으로 인지·정당화하고
    있고, `error_code` 라벨에 동일 패턴이 선례로 존재한다.
  - 제안: 없음 — 문서화된 설계 선택. `record()` 가 향후 닫힌 유니온을 받도록 바뀌면 그때
    같이 좁히면 된다(코드 주석에 이미 그 조건이 적혀 있음).

- **[INFO]** 신규 정적 가드(`findUnboundHelpers`)의 판정이 타입 생성자 이름
  접두사(`AuditActionFor<`)만 검사하고 **제네릭 인자(어느 리소스에 바인딩됐는지)는 검사하지
  않는다** — 감사 추적 무결성을 지키는 회귀 방지 가드치고는 판정 범위가 좁다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    (`findUnboundHelpers` — 프롬프트 파일 8 diff 게이트 120-125,
    `s.actionType?.startsWith(\`${BOUND_TYPE_NAME}<\`)`)
  - 상세: 예컨대 `TriggersService.recordAudit` 의 `action` 타입이 실수로
    `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`(다른 리소스에 바인딩)로 잘못 복붙돼도
    이 가드는 `AuditActionFor<` 접두사만 보므로 통과시킨다 — 이번 PR 이 고친 "맨 union" 결함
    (다른 리소스의 액션을 조용히 기록)과 같은 계열이지만 더 은밀한 오귀속 형태를 못 잡는다.
    가드 자신의 JSDoc/`plan/in-progress/spec-sync-auth-gaps.md` 뮤테이션 5축에도 이 축은
    없다(가드가 존재하는 목적은 정확히 "다른 리소스의 액션을 기록해도 컴파일러가 못 잡는" 것을
    막는 것인데, 정적 가드 자체는 리소스 일치까지는 재확인하지 않는다).
  - 제안: 각 서비스 파일에서 `resourceType` 상수(예: `AUTH_CONFIG_RESOURCE_TYPE`)를 함께
    추출해 `AuditActionFor<typeof X>` 의 `X` 가 같은 파일의 `resourceType` 상수와 일치하는지도
    검사하면 이 구멍이 닫힌다. 우선순위는 낮음 — 컴파일러(`_NoCrossDomain` 타입 가드,
    `audit-action.const.ts`)가 "완전히 다른 도메인" 오귀속은 어차피 정적으로 막고 있고, 이번
    diff 의 직접 목표("맨 union")는 가드가 정확히 잡는다.

## 요약

이번 changeset 은 신규 인젝션·인증 우회·하드코딩 시크릿·암호화 약화를 도입하지 않았고,
오히려 두 방향에서 보안 태세를 개선한다 — (1) `auth-configs.service.ts` 의 `recordAudit`
`action` 파라미터를 `AuditActionFor<...>` 로 좁혀 다른 리소스의 액션이 `auth_config` 로
기록되는 감사 오귀속을 컴파일 타임에 차단했고(타입 정의·`_NoCrossDomain` 가드까지 직접
확인해 실질적임을 검증), (2) 감사 적재 실패가 조용히 묻히던 것을 OTel 카운터 + 상세 로그로
가시화해 "특권 작업(시크릿 회전·삭제) 성공, 감사 행 유실" 시나리오의 탐지·조사를 가능하게
했다. 관측 호출 자체가 새 실패 경로가 되지 않도록 자체 try/catch 로 감싼 것도(이전 라운드
WARNING 을 뮤테이션 테스트로 검증 완료) 소스에서 직접 확인했다. 새 경고 로그의 필드
결합(구조화되지 않은 문자열)은 이론적 로그 위조 표면이지만, 12개+ 호출부를 전수 확인한 결과
전부 `ParseUUIDPipe`/DB PK/JWT claim 유래 값이라 즉시 악용 가능한 경로는 없다. 신규 정적
가드는 읽기 전용·고정 경로 스캔으로 그 자체가 공격 표면을 만들지 않으며, 판정 느슨함(제네릭
인자 미비교)은 방어 심층화 관점의 INFO 다. 즉시 조치가 필요한 CRITICAL/WARNING 급 결함은
없다.

## 위험도

LOW
