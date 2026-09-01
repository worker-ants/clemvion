# Security Review — audit-record-factory (6라운드, 2026-09-01 16:53:16)

## 검토 범위 및 방법

`origin/main...HEAD` 의 실질 코드(`.ts`) 변경분은 이번 라운드에서 **추가로 바뀌지 않았다** —
`git log` 상 최신 코드 커밋은 5라운드의 `4b15f0393`(fix(audit): 리뷰 5R)이고, `git status
--short` 결과 이번 세션에서 신규 생성된 것은 `review/code/2026/09/01/16_53_16/`(이 리뷰 자신)
뿐이다. 이번 프롬프트에 새로 편입된 파일은 5라운드 자신의 리뷰 산출물
(`review/code/2026/09/01/16_29_11/*`)과 `review/consistency/**` 산출물, `spec/*.md` 뿐이다.

프롬프트 diff 가 크기 제한으로 생략한 파일(`audit-logs.spec.ts`, `audit-action-binding-
{fixture,guard}.ts`, `audit-action-binding.spec.ts`)을 포함해 다음을 저장소에서 직접
`Read`/`grep`으로 재확인했다(뮤테이션 없음, 읽기 전용):

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 실패 관측성
  (카운터 + 상세 로그), `@Optional() metrics` 주입
- `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — swallow 계약 + 관측 회귀 테스트
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `recordAudit` 의 `action`
  타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힘,
  주변 secret 발급(`randomBytes`)·마스킹(`SECRET_CONFIG_KEYS`)·HMAC 알고리즘 화이트리스트 로직
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` /
  `business-metrics.service.spec.ts` — `recordAuditWriteFailed()` 신설, `clampLabel()` 공유 헬퍼
- `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`,
  `.spec.ts` — 리소스 바인딩 강제 AST 정적 가드(빌드/테스트 전용 코드), 5라운드에서 추가된
  `findMisboundHelpers`(선언 단계 오귀속 검사)가 현재 소스에 반영돼 있음을 확인

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서 **신규
도입된 취약점은 없다.** DB 접근은 전부 TypeORM 파라미터 바인딩(`:workspaceId` 등)이고 이
changeset 은 쿼리 조립부를 건드리지 않는다. 시크릿은 여전히 `randomBytes` 로 자동 발급되며
(`auth-configs.service.ts` `create()`/`regenerate()`), `SECRET_CONFIG_KEYS`(`key`/`token`/
`secret`/`password`)로 update 경로에서 비밀값 덮어쓰기를 차단하는 로직도 이번 diff 와 무관하게
그대로다. 하드코딩된 자격증명은 diff 어디에도 없음을 재확인했다(0건).

## 발견사항

- **[INFO]** `AuditLogsService.record()` 의 경고 로그가 `action`/`resourceType`/`resourceId`/
  `workspaceId` 를 이스케이핑 없이 단일 문자열로 결합한다 (구조적 로그 위조/CWE-117 방어 부재,
  방어 심층화 성격 — 5라운드에서 이미 INFO 로 확인된 항목, 이번 라운드에서 코드 변동 없이 재확인)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch 블록
    `this.logger.warn(...)` 호출부
  - 상세: `auth-configs.service.ts` 의 5개 호출부(`create`/`update`/`regenerate`/`remove`/
    `reveal`) 전부 `resourceId` 가 서버 생성 UUID(`saved.id`/`id`)이고 사용자 입력 원문이 아니다.
    `workspaceId` 는 라우트 컨텍스트 유래, `action` 은 `AUDIT_ACTIONS.*` 닫힌 상수다. 즉 현재
    producer 4곳에는 악용 가능 경로가 없다. 실제 secret 값(`config.key`/`token`/`secret`)이
    `resourceId`/로그 메시지에 실리는 경로는 확인되지 않았다. 다만 향후 다른 producer(12개
    파일 중 미검토분)가 사용자 통제 문자열을 실어 보내면 로그 라인 위조로 이어질 수 있는 구조는
    남아 있다.
  - 제안: 필수는 아니나 구조화 로깅(`logger.warn({ msg, action, resourceType, resourceId,
    workspaceId })`)으로 바꾸면 향후 producer 가 검증 안 된 값을 넘겨도 구조로 방어된다.

- **[INFO]** `recordAuditWriteFailed(resourceType: string)` 의 `resourceType` 라벨이 열린
  `string` 타입이라 시그니처상 cardinality 무제한 (5라운드와 동일 결론, 코드 변동 없음)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts`
    `recordAuditWriteFailed()`, `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` 정의부
  - 상세: `clampLabel()` 이 64자로 잘라 무제한 증식은 막는다. `AuditLogsService.record()`
    호출부(현재 12개 producer)가 넘기는 `resourceType` 은 전부 코드 내 상수(`AUTH_CONFIG_
    RESOURCE_TYPE` 등, distinct 10종)이고 사용자 입력이 아니므로 현재 악용 가능 경로는 없다.
    `recordExecutionError` 와 동일 패턴이며 이 changeset 이 새로 만든 위험이 아니다.
  - 제안: 조치 불필요 — 코드 주석이 이미 "`record()` 가 닫힌 유니온으로 바뀌면 이쪽도 좁힌다"
    고 명시.

- **[INFO]** 신설 정적 가드(`audit-action-binding-guard.ts`)의 `findMisboundHelpers` 가 제네릭
  인자를 비교하는 방향으로 5라운드에서 이미 강화됐음을 재확인 — 잔여 한계는 "판정 불가시
  보류"(`normalizeResource` 가 로컬 상수로 해석 안 되면 `null`)뿐
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    `findMisboundHelpers()`, `normalizeResource()`
  - 상세: 4라운드까지는 `findUnboundHelpers` 가 `AuditActionFor<` 접두사만 검사해 "엉뚱한
    리소스에 묶임" 케이스(`AuditActionFor<'workflow'>` 로 선언하고 `resourceType: 'auth_config'`
    기록)를 통과시켰다. 5라운드가 `boundResource`/`recordedResource` 를 상수 해석 후 비교하는
    `findMisboundHelpers` 를 추가해 이 표면을 선언 단계에서 닫았다(뮤테이션 M1~M3 전부 RED —
    RESOLUTION `16_29_11` 기록). 이번 라운드에서 소스를 다시 열어 그 코드가 그대로 있음을
    확인했다. 잔존 한계(로컬 상수가 아닌 import 등으로 해석 불가한 값은 `null` 반환 → 판정
    보류)는 이 가드가 빌드/테스트 전용 인프라라 운영 코드의 보안 결함으로 이어지지 않는다.
  - 제안: 없음 — 확인 목적.

- **[INFO]** `AuditLogsService` 생성자의 `@Optional() metrics?` 및 관측 호출 이중
  `try`/`catch` — swallow 계약 유지 재확인 (변동 없음)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 생성자, `record()`
    catch 블록의 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}`
  - 상세: `metrics` 미주입 시 옵셔널 체이닝으로 안전, 주입돼 있어도 던지면 즉시 삼킨다 —
    "감사 실패가 본 요청(회전·삭제 등 특권 작업)을 절대 깨뜨리지 않는다" 는 계약이 새 관측
    경로에도 유지된다. `audit-logs.spec.ts` 의 `'metrics 호출이 던져도 삼킨다'` 테스트가
    이를 뮤테이션 대상으로 고정한다.
  - 제안: 없음 — 확인 목적.

- **[INFO]** 신설 repo-guard 3파일의 파일시스템 접근은 읽기 전용·스캔 범위 고정 (변동 없음)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
    `collectSourceFiles()`(`fs.readdirSync`/`fs.readFileSync` 만 사용), `MODULES_DIR` 상수
  - 상세: 스캔 루트가 상수로 고정돼 외부 입력이 경로 구성에 관여하지 않는다(경로 탐색 표면
    없음). `ts.createSourceFile` 로 파싱만 하고 `eval`/`Function` 등 동적 실행은 없다.
    빌드/테스트 전용 코드로 프로덕션 공격 표면 밖이다.
  - 제안: 없음.

## 요약

이번(6라운드) changeset 의 실질 코드는 5라운드 이후 변경되지 않았다 — 이번 라운드에 새로
편입된 파일은 이전 라운드 자신의 리뷰/일관성 검토 산출물과 spec 문서뿐이다. 소스를 직접
재대조한 결과 신규 인젝션·인증 우회·하드코딩 시크릿·암호화 약화는 여전히 도입되지 않았고,
보안 태세는 두 방향으로 개선된 상태를 유지한다: (1) `auth-configs.service.ts` 의 `recordAudit`
action 타입을 리소스 바인딩 타입으로 좁혀 감사 로그 오귀속을 컴파일 타임에 차단(5라운드에서
선언 단계 검사 `findMisboundHelpers` 로 가드 자체의 잔여 구멍도 추가로 닫음), (2) 감사 적재
실패가 조용히 묻히던 것을 카운터 + 상세 로그로 가시화해 "특권 작업은 200 으로 성공, 감사 행만
유실" 시나리오의 탐지를 가능하게 함. 신규 관측 호출은 이중 `try`/`catch` 로 보호돼 swallow
계약을 스스로 위반하지 않으며, secret 값이 로그·메트릭 라벨에 흘러드는 경로는 확인되지 않았다.
남은 항목(로그 메시지 구조화 부재·카운터 라벨의 열린 `string` 타입)은 전부 실제 악용 경로가
확인되지 않는 방어 심층화 성격의 INFO 이고, 5라운드에 걸쳐 반복 재확인됐다. Critical/Warning
은 이번 라운드에서도 0건이다.

## 위험도

LOW
