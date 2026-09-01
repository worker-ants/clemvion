# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 CRITICAL/보안 취약점은 없으나(security/requirement/side_effect 모두
LOW~NONE), testing 리뷰어가 실측 뮤테이션으로 재현한 WARNING 2건이 "테스트/가드가 실제로
잡는다"는 것과 "plan·RESOLUTION.md 가 잡는다고 적은 것" 사이의 간극을 드러냈다 — 그 중 하나는
두 차례의 RESOLUTION.md 가 "이미 가드 헤더에 문서화됨"이라고 명시했지만 실제로는 grep 0건으로
그런 문서화가 존재하지 않음을 확인한 것이라, 개별 결함을 넘어 **리뷰 파이프라인 자체의 자기
서술 신뢰성** 문제이기도 하다. forced(router_safety) reviewer 7명 전원의 결과가 확보되어
있어 화이트리스트 미이행 사각지대는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | TESTING | `@Optional()` 회귀를 검증한다고 이름 붙은 테스트(`'metrics 없이 조립해도 감사 기록은 동작한다 (@Optional)'`)가 `new AuditLogsService(repo)` 로 NestJS DI 를 거치지 않고 직접 생성자를 호출해, `@Optional()` 데코레이터 유무와 무관하게 항상 통과한다. `@Optional()` 을 실제로 제거해 뮤테이션 재현한 결과 RED 는 발생하지만, 실패하는 것은 이름 붙은 그 테스트가 아니라 무관한 기존 `findAll — 필터` DI 스위트(`UnknownDependenciesException`)다. 그 스위트가 나중에 리팩터/삭제되면 `@Optional()` 회귀는 조용히 아무 테스트도 잡지 못한 채 넘어간다 | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:223-233`(이름 붙은 테스트), `:28-80`(실제로 잡는 무관한 `findAll` 스위트), `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19` | `Test.createTestingModule({...}).compile()` 을 `BusinessMetricsService` provider 없이 호출하고 reject 하지 않음을 직접 단언하는 `@Optional` 전용 테스트를 추가해, `findAll` 스위트의 존재/형태와 독립적으로 계약을 고정할 것 |
| 2 | TESTING | 신규 감사 액션 바인딩 가드(`findAuditHelpers`)가 `ts.isMethodDeclaration` 만 검사해, 클래스 필드에 화살표 함수로 선언된 `recordAudit = (params) => {...}` 형태(`PropertyDeclaration`, NestJS 서비스에서 `this` 바인딩용으로 흔함)를 완전히 놓친다 — 저장소 밖 scratch 사본으로 직접 재현: `sites found: []`(0건). 이 형태로 `recordAudit` 를 작성하면 "묶이지 않음"으로도 잡히지 않고 존재하지 않는 것처럼 통과하는데, 이는 이 PR 이 고친 것과 정확히 같은 클래스의 결함(리소스에 안 묶인 `action`)이 재도입될 수 있는 경로다. 게다가 두 차례의 `RESOLUTION.md` 가 이 정확한 항목을 "가드 헤더에 이미 트레이드오프로 문서화됨"이라 명시했으나, 가드/fixture/spec 3파일 전체를 `grep -n "화살표\|arrow\|트레이드오프\|한계\|제약"` 로 확인한 결과 일치 0건 — 그 문서화는 실재하지 않는다 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:78-96`(`findAuditHelpers`/`visit`), `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`(화살표 필드 케이스 부재), 잘못된 claim 출처: `review/code/2026/09/01/14_31_12/RESOLUTION.md:66-71`, `review/code/2026/09/01/15_10_38/RESOLUTION.md:45-47` | (a) fixture 에 화살표 필드 케이스를 추가하고 현재 동작(무시)이 의도라면 가드 헤더에 실제로 트레이드오프를 적을 것, 또는 (b) `visit` 에 `ts.isPropertyDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)` 분기를 추가해 이 형태도 판정 대상에 포함시킬 것(후자 권장). 어느 경우든 두 RESOLUTION.md 의 "이미 문서화됨" 서술은 정정 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 신규 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId` 를 비구조화 문자열로 결합 — 이론적 로그 위조(CWE-117) 표면이나, 12개+ 호출부 전수 확인 결과 전부 `ParseUUIDPipe`/DB PK/JWT claim 유래 값이라 현재 악용 불가 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`(`record()` catch 블록 `logger.warn`) | 구조화 로깅(`logger.warn({ msg, action, resourceType, ... })`) 전환 시 향후 producer 추가에도 관례 의존 없는 구조적 방어가 됨 — 즉시 조치 불요 |
| 2 | SECURITY | `recordAuditWriteFailed` 의 `resource_type` 라벨이 닫힌 유니온이 아니라 `clampLabel()`(64자 truncate) 만으로 cardinality 방어 — 이론적 DoS 표면이나 JSDoc 이 트레이드오프를 이미 명시 | `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`recordAuditWriteFailed`) | 없음 — 문서화된 설계 선택 |
| 3 | SECURITY / REQUIREMENT | 신규 정적 가드(`findUnboundHelpers`)가 `action` 이 리소스에 "묶여 있는지"만 검사하고, 제네릭 인자(어느 리소스에 바인딩됐는지)가 그 서비스의 실제 `resourceType` 과 일치하는지는 검사하지 않음 — 위 WARNING #2 의 blind spot(가드 문자열 접두 비교 의존)과 연관된 판정 범위의 한계 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`(`findUnboundHelpers`) | 각 서비스 파일의 `resourceType` 상수와 `AuditActionFor<X>` 의 `X` 일치 검사 추가 — 우선순위 낮음(컴파일러 `_NoCrossDomain` 가드가 완전히 다른 도메인 오귀속은 이미 정적으로 막음) |
| 4 | REQUIREMENT | `recordAuditWriteFailed` 의 `resourceType` 에 빈 문자열이 오면 `clampLabel('')` 이 그대로 통과 — 현재 12개 호출부 전수 확인상 발동 경로 없음 | `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`clampLabel`) | 조치 불요 — 발동 경로 없음, 기존 open-string 시그니처의 연장 |
| 5 | SCOPE | 독립된 두 plan 항목(가드 W4 + 감사 적재 실패 관측성)이 여전히 한 커밋(`9a2e860dc`)에 번들 — 3라운드 연속 동일 지적 | `plan/in-progress/spec-sync-auth-gaps.md:52,99` | 이미 3라운드째 병합 진행 중이라 재작업 불요 — 기록만 |
| 6 | SCOPE | `review/code/**`·`review/consistency/**` 프로세스 산출물이 순수 코드/spec diff 대비 파일 수 과반 — 저장소 관례상 정상 커밋 대상이나 diff 크기만으로 변경 규모를 과대평가하기 쉬움 | `review/code/2026/09/01/{14_31_12,15_10_38}/*`, `review/consistency/2026/09/01/15_00_54/*` | 조치 불요 |
| 7 | SCOPE | `recordExecutionError` 클램핑을 `clampLabel()` 공유 헬퍼로 교체한 3줄이 표면상 audit 범위 밖 파일을 건드림 — 이 PR 자신이 만든 매직넘버 중복(1라운드 W3)을 같은 PR 안에서 해소한 것으로 근거 문서화됨 | `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`clampLabel` 신설, `recordExecutionError` 호출부 교체) | 조치 불요 |
| 8 | MAINTAINABILITY | `AuditLogsService.record()` 의 관측 보호용 이중 `try`/`catch` 로 함수 내 중첩이 한 단계 증가 — 뮤테이션(X5)으로 검증된 필요한 방어이나 순수 가독성 관점의 사실 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`(`record()`) | 조치 불요 — 3번째 보호 대상이 생기면 `safeguard(() => X)` 형태 헬퍼 추출 고려 |
| 9 | MAINTAINABILITY | 테스트 조립 헬퍼 이름/형태 불일치(`makeService` vs `build(true/false)` boolean flag), `entry` 픽스처 중복 선언 — 3라운드 연속 이월, 내용 불일치는 없음 | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-94,146-152,154-167` | 급하지 않음 — 다음에 파일을 만질 계기에 `build({ saveRejects })` named-option 형태로 정리 |
| 10 | MAINTAINABILITY | 가드 바인딩 판정이 AST 노드 종류가 아닌 타입 텍스트 접두 문자열 비교(`startsWith`)에 의존 — WARNING #2(화살표 함수 필드 미인식)의 근본 원인 중 하나 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125` | `ts.isTypeReferenceNode` 기반 AST 판정으로 전환 시 서식 독립적인 검사 가능 |
| 11 | MAINTAINABILITY | rationale 주석/JSDoc 비중이 실제 로직 대비 큼(예: JSDoc 21줄 vs 본문 3줄) — plan/CHANGELOG 와 거의 동일 문장 반복으로 SoT 분산 — 3라운드 연속 이월 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:97-108`, `codebase/backend/src/modules/metrics/business-metrics.service.ts:159-179` | 즉시 조치 불요(팀 관례상 유예) — 파일 확장 계기에 plan 정리 범위 포함 |
| 12 | TESTING | `record()` catch 블록의 `err instanceof Error ? err.message : String(err)` 중 `false` 분기(Error 아닌 값 throw)가 신규 테스트에서 커버되지 않음 — 기존 패턴, 이번 diff 신설 아님 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:118` | 급하지 않음 — 다음에 이 블록을 건드릴 때 `mockRejectedValue('plain string reject')` 케이스 추가 |
| 13 | DOCUMENTATION | `AuditLogsService.record()` JSDoc 이 이번 changeset 이 추가한 관측 동작(카운터 증가·로그 필드 4종 확장)을 여전히 언급하지 않음 — 3라운드 연속 동일 지적, 의도된 이월 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` | 다음에 이 메서드를 건드릴 기회에 `{@link BusinessMetricsService.recordAuditWriteFailed}` 참조를 JSDoc 에 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. 오히려 `auth-configs.service.ts` 의 `AuditActionFor<...>` 타입 좁힘으로 감사 오귀속을 컴파일 타임 차단(개선). INFO 3건(로그 위조 표면·라벨 cardinality·가드 판정 범위) |
| requirement | NONE | plan 이 추적하던 감사 로깅 잔여 2건(액션 바인딩 구멍·적재 실패 관측성) 이 코드/가드/spec/plan 4층에서 정합되게 닫힘. jest 3세트 실행 GREEN(97 tests). SPEC-DRIFT 없음 |
| scope | LOW | 4개 커밋 전부 자신의 커밋 메시지 범위와 일치. 신규 결함 없음, INFO 4건(plan 번들·산출물 비중·spec 경로·클램핑 공유화) 재확인 |
| side_effect | NONE | 코드(.ts) 신규 diff 라인 없음(이전 라운드 이미 다룬 파일). 1·2라운드 WARNING 전량 해소 유지 재확인. 새 부작용 없음 |
| maintainability | LOW | 1라운드 매직넘버 중복·2라운드 JSDoc/주석 분리 결함 모두 해소 확인. INFO 4건(중첩 증가·헬퍼 명명 불일치·문자열 접두 판정·rationale 비대화) |
| testing | MEDIUM | WARNING 2건 실측 재현 — `@Optional` "전용" 테스트가 실제로는 무관한 스위트에 의해서만 보호됨, 신규 가드가 화살표 함수 필드 `recordAudit` 를 완전히 놓치는데 RESOLUTION.md 가 이를 "이미 문서화됨"이라 오기록. 잘된 점(경계값 fixture·`[전제]` vacuity 가드)도 다수 |
| documentation | LOW | 직전 두 라운드+consistency-check 가 지적한 WARNING 8건 전부 실제 파일 대조로 반영 확인, 새 결함 없음. INFO 2건(JSDoc 절반 서술 3회 이월·README 갱신 불요 확인) |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 INFO 이상의 항목을 보고했다(대부분 이전 라운드 해소 재확인 포함).

## 권장 조치사항

1. `audit-action-binding-guard.ts` 의 `findAuditHelpers`(`visit`) 에 `ts.isPropertyDeclaration`
   + 화살표 함수 초기화 분기를 추가해, 클래스 필드로 선언된 `recordAudit` 도 바인딩 판정
   대상에 포함시킬 것 — 이 PR 이 고친 것과 동일 클래스의 결함이 재도입될 수 있는 실측된 구멍이다.
   (WARNING #2)
2. `audit-logs.spec.ts` 에 `BusinessMetricsService` provider 없이 `Test.createTestingModule()`
   로 조립해 reject 하지 않음을 직접 단언하는 `@Optional` 전용 테스트를 추가할 것 — 현재는
   무관한 `findAll` DI 스위트의 부수효과로만 이 계약이 지켜지고 있다. (WARNING #1)
3. 두 `RESOLUTION.md`(`14_31_12`, `15_10_38`)의 "화살표 함수 필드가 이미 가드 헤더에 문서화된
   트레이드오프"라는 서술을 정정할 것 — grep 0건으로 그런 문서화가 존재하지 않음이 확인됐다.
   틀린 "이미 알려진 한계"라는 기록은 이 갭을 영구히 재점검 대상에서 빠뜨린다.
4. (낮은 우선순위, 다음에 해당 파일을 만질 계기가 있을 때) 가드의 문자열 접두 비교를
   AST 노드 종류 기반 판정으로 전환, 테스트 헬퍼 명명 통일, `AuditLogsService.record()` JSDoc
   에 신규 관측 동작 한 줄 추가 — 전부 3라운드 연속 이월된 INFO 로 즉시 차단 사유는 아니다.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 7명 전원 결과 확보됨(화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset 범위 밖(비관련) |
  | architecture | router 판단상 이번 changeset 범위 밖(비관련) |
  | dependency | router 판단상 이번 changeset 범위 밖(비관련) |
  | database | router 판단상 이번 changeset 범위 밖(비관련) |
  | concurrency | router 판단상 이번 changeset 범위 밖(비관련) |
  | api_contract | router 판단상 이번 changeset 범위 밖(비관련) |
  | user_guide_sync | router 판단상 이번 changeset 범위 밖(비관련) |

  (제외 사유 상세는 라우터 출력 원문에 개별 근거가 없어 카테고리 통칭으로 기재 — 7개 reviewer
  모두 이번 감사 로깅/메트릭/가드 중심 changeset 과 직접 관련이 낮은 영역이며, forced 화이트
  리스트가 보안·요구사항·범위·부작용·유지보수성·테스트·문서화 7축을 이미 커버해 커버리지
  공백은 없다.)