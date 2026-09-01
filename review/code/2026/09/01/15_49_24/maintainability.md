# 유지보수성(Maintainability) 리뷰 — audit-record-factory (2026-09-01 15:49:24, 4라운드)

## 사전 확인

이 changeset 은 이미 세 라운드(`14_31_12`, `15_10_38`, `15_25_56`)의 유지보수성 리뷰·수정을
거쳤다. 실제 소스(`audit-logs.service.ts`, `audit-logs.spec.ts`, `auth-configs.service.ts`,
`business-metrics.service.ts`, `business-metrics.service.spec.ts`,
`repo-guards/__tests__/audit-action-binding-*.ts`)를 `Read`/`Grep` 으로 직접 열어, 이전
라운드가 "해소했다"고 적은 항목들이 현재 코드에 실제로 반영돼 있는지 재검증했다(저장소는
쓰기 없이 읽기만 했다 — `git status --short` 결과 이 세션이 만든 변경은
`review/code/2026/09/01/15_49_24/`(이 리뷰 산출물 자신) 뿐).

- 1라운드 WARNING(클램핑 `64` 매직넘버 중복) → `business-metrics.service.ts:48-60` 에
  `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` 공유 확인. 해소 유지.
- 2라운드 WARNING 2건(클래스 JSDoc·`recordRedisFailOpen` 설명 주석이 삽입으로 원래 대상에서
  분리) → `business-metrics.service.ts:48-74`(유틸 블록이 클래스 JSDoc 위, 클래스 JSDoc 이
  `@Injectable()` 바로 위), `business-metrics.service.spec.ts:59-90`(`recordRedisFailOpen`
  주석이 그 테스트 바로 위, 신규 `recordAuditWriteFailed` 주석은 "아래" 로 정방향 참조) 확인.
  해소 유지.
- 3라운드 WARNING 2건(화살표 함수 클래스 필드 미탐지, `@Optional` 테스트가 DI 를 안 태워
  vacuous) → `audit-action-binding-guard.ts:105-126`(`auditHelperParams` 가 `PropertyDeclaration`
  + 화살표/함수 표현식 분기 처리), `audit-logs.spec.ts:223-237`(`Test.createTestingModule` 로
  실제 DI 조립) 확인. 해소 유지 — 신규 회귀 없음.

이번 라운드는 (a) 위 해소가 현재 코드에도 유지되는지 확인하고, (b) 지금까지 세 라운드가
다루지 않은 새 관점에서 관찰한 것만 보고한다.

## 발견사항

- **[INFO]** (신규 관점) 3라운드가 vacuous 테스트를 고치며 추가한 테스트가, 세 번째 임시
  조립 방식으로 기존 테스트와 거의 동일한 단언을 중복한다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:239-247`
    (`it('metrics 없이도 감사 기록은 동작한다 (런타임)', ...)`, `new AuditLogsService(repo)`
    직접 호출) — 비교 대상은 같은 파일 `:88-108`
    (`describe('AuditLogsService.record — best-effort (swallow)', ...)` 내부
    `function makeService(...)`(`:89-91`) 로 조립하는 `it('save 가 reject 해도 예외를 삼키고
    resolve 한다 (주 동작 비실패)', ...)`(`:104-108`))
  - 상세: 두 테스트 모두 "`save` 가 reject 하는 repo + metrics 없이 구성한
    `AuditLogsService`" 에 대해 "`record()` 가 여전히 resolve 한다"는 **같은 단언**을 검증한다.
    `makeService(repo)`(`:89-91`)도 `new AuditLogsService(repo as unknown as
    Repository<AuditLog>)` 로 metrics 인자를 아예 넘기지 않으므로, 3라운드가 새로 넣은
    `:239-247` 테스트는 사실상 `:104-108` 과 동일한 시나리오를 다시 검증하는 것과 같다(유일한
    차이는 `:104-108` 이 `expect(repo.save).toHaveBeenCalled()` 를 추가로 단언하는 정도). 이
    파일은 이미 세 라운드에 걸쳐 조립 헬퍼가 `makeService`/`build` 두 갈래로 갈려 있다는 지적을
    받아 왔는데(아래 항목), 이번 3라운드 수정이 **세 번째 조립 스타일**(헬퍼를 쓰지 않는 인라인
    `new AuditLogsService(repo)`)을 하나 더 추가해 그 불일치를 완화가 아니라 확장하는 방향으로
    움직였다. 기능적으로는 문제없다(뮤테이션 검증 대상은 바로 위 `:223-237` DI 테스트이지 이
    테스트가 아니다) — 이 테스트 자체가 없어도 회귀를 못 잡는 것은 아니다.
  - 제안: 이 테스트를 제거하거나(같은 시나리오가 `:104-108` 에 이미 있음), 남기려면
    `makeService` 헬퍼를 재사용해 세 번째 임시 스타일을 만들지 않도록 정리. 급하지 않다 —
    잘못된 통과를 만들지는 않는다.

- **[INFO]** (신규 관점) AST 순회에서 얻은 타입 좁힘 정보가 별도 함수를 거치며 무검증 캐스트로
  다시 넓혀진다 — 이 가드 자신이 막으려는 "구조적 사실이 조용히 깨질 수 있는" 패턴과 같은 결
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:89`
    (`method: (node.name as ts.Identifier).text,`, `findAuditHelpers` 의 `visit` 콜백
    내부(`:78-96`)) — 좁힘의 근거는 별도 함수 `auditHelperParams`(`:105-126`)의
    `ts.isIdentifier(node.name)` 체크(`:110`, `:117`)
  - 상세: `node.name` 이 `Identifier` 라는 사실은 `auditHelperParams` 내부에서만 검사되고,
    그 함수는 boolean 이 아니라 `parameters` 배열(또는 `null`)만 돌려준다. 호출부인 `visit`
    은 `params` 가 `non-null` 이면 `node.name` 이 `Identifier` 라고 **다시 가정**하고
    `(node.name as ts.Identifier).text` 로 무검증 캐스트한다. 두 함수 사이에 이 불변식을
    코드로 강제하는 장치(예: 좁혀진 노드 자체를 반환)가 없다 — 현재는 우연히 맞지만, 나중에
    `auditHelperParams` 가 예를 들어 computed property name(`[Symbol.x] = ...`)이나 다른
    노드 형태를 인식하도록 확장되면 이 캐스트는 컴파일 에러도 테스트 실패도 없이 `method` 필드에
    `undefined` 를 조용히 채운다(타입 선언은 `string` 인데). 이 가드가 존재하는 이유가 바로
    "리소스 바인딩이 조용히 깨지는 것"을 잡기 위해서인데, 가드 자신의 내부 구현이 같은 종류의
    취약한 결합을 갖고 있다는 점이 아이러니하다. 즉시 버그는 아니다 — 현재 두 함수의 로직은
    일치한다.
  - 제안: `auditHelperParams` 가 파라미터 목록 대신 `{ name: ts.Identifier; parameters:
    ts.NodeArray<ts.ParameterDeclaration> } | null` 을 반환하도록 바꾸면, `visit` 은 캐스트 없이
    `result.name.text` 를 쓸 수 있고 두 함수의 불변식이 타입 시스템으로 연결된다. 낮은 우선순위
    — 현재 fixture 5종이 두 함수 모두를 실제로 통과시켜 정합성을 실측으로 보장한다.

- **[INFO]** (이전 세 라운드에서 이미 지적, 여전히 미반영 — 변화 없음 재확인) 조립 헬퍼
  `makeService`/`build` 명명·형태 불일치, `entry` 픽스처 중복
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-91`(`makeService`),
    `:96-101`(`entry` #1), `:146-152`(`entry` #2), `:154-167`(`build`)
  - 상세/제안: 1~3라운드와 동일 판단 유지 — 급하지 않다. 위에서 지적한 신규 세 번째 조립
    스타일(`:239-247`)까지 더해지면 조립 스타일이 이제 셋(`makeService`/`build`/인라인)이라,
    다음에 이 파일을 만질 계기가 있으면 함께 통합할 가치가 조금 더 커졌다.

- **[INFO]** (이전 세 라운드에서 이미 지적, 여전히 미반영 — 변화 없음 재확인) 가드의 바인딩
  판정이 타입 텍스트 접두 문자열 비교(`startsWith`)에 의존, rationale 주석 비중이 로직 대비 큼
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157`
    (`findUnboundHelpers`), `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:96-113`
    (catch 블록 주석), `codebase/backend/src/modules/metrics/business-metrics.service.ts:159-179`
    (`recordAuditWriteFailed` JSDoc)
  - 상세/제안: 1~3라운드와 동일 — 즉시 조치 불필요, 다음 확장 계기에 함께 정리.

## 요약

이번 4라운드에서 소스 자체에 새로 diff 된 코드 변경은 실질적으로 없다(1~3라운드가 이미 다룬
소스와 동일) — 그래서 이번 라운드는 이전 세 라운드가 "해소했다"고 기록한 WARNING 5건(매직넘버
중복, JSDoc/주석 오귀속 2건, 화살표 함수 필드 미탐지, `@Optional` vacuous 테스트)이 현재 소스에
실제로 반영돼 있고 회귀가 없음을 `Read`/`Grep` 으로 직접 재확인하는 데 집중했다 — 전부 확인됨.
새로 관찰한 것은 둘 다 INFO 수준이다: (1) 3라운드가 vacuous 테스트를 고치며 추가한 테스트가
기존 테스트와 거의 동일한 시나리오를 세 번째 임시 조립 스타일로 중복 검증해, 이미 지적돼 있던
헬퍼 명명 불일치를 완화가 아니라 살짝 더 키웠다. (2) 신규 AST 가드 내부에서 `Identifier` 타입
좁힘이 함수 경계를 넘으며 무검증 캐스트로 다시 넓혀지는 결합 — 가드 자신이 잡으려는 "조용히
깨지는 구조적 불변식"과 같은 결의 취약점이 가드 내부에 있다는 점이 흥미롭지만, 현재는 실제
버그가 아니다. 그 외 항목은 세 라운드 연속 동일하게 판정된 저우선순위 INFO(조립 헬퍼 중복,
접두 문자열 비교, rationale 주석 비대화)가 변화 없이 남아 있다. 구조적 결함이나 차단 사유는
없다.

## 위험도

LOW
