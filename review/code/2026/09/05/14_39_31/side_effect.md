# 부작용(Side Effect) 리뷰

## 대상 요약

이번 diff 는 (a) `AuditLogsService.findAll` 의 `user` 조인을 `leftJoinAndSelect` →
`leftJoin` + `addSelect(3필드)` 로 좁힌 보안 수정(민감정보 과다노출 차단), (b) 그 unit
테스트 갱신, (c) `response-contract.ts`/`.spec.ts`(§5.4 응답-DTO 대조 헬퍼, 이전 라운드
`13_49_54` 산출물 그대로 유지) 와 4개 e2e 배선, (d) 두 plan 문서 갱신, (e) 이전
`review/code`·`review/consistency` 라운드 산출물(마크다운/JSON, 실행되지 않는 문서)로
구성된다. `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 와
`audit-logs.spec.ts` 는 이전 라운드(`13_49_54`) 프롬프트에는 없던 파일로, 이번이 그
수정에 대한 첫 side-effect 리뷰다.

## 발견사항

- **[WARNING]** `AuditLogsService.findAll` 의 반환 항목에서 `AuditLog.user` 가 이제
  **부분 hydration** 되는데, 엔티티 타입 선언은 여전히 전체 `User` 를 약속한다 — 타입과
  런타임 형태가 어긋나는 새 latent 갭
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:47-48`
    (`.leftJoin('al.user', 'user').addSelect(['user.id', 'user.name', 'user.email'])`)
  - 상세: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:28` 은
    `@ManyToOne(() => User) user: User;` 로 `user` 를 **전체 `User` 엔티티** 타입으로
    선언한다. 이번 diff 전에는 `leftJoinAndSelect('al.user','user')` 가 실제로 전체
    컬럼을 실었으므로 타입과 실 데이터가 일치했다. 이번 수정으로 실제 쿼리는 `id`·
    `name`·`email` 세 컬럼만 채우지만, `findAll()` 의 반환 타입은 여전히
    `Promise<PaginatedResponseDto<AuditLog>>` 이고 `AuditLog.user` 는 여전히 `User` 타입
    (`passwordHash`·`twoFactorSecret` 등 전 필드를 갖는 것처럼 타입에 나타남)이라, `tsc`
    는 이 축소를 전혀 인지하지 못한다. 지금은 `findAll` 의 유일한 소비처가 컨트롤러
    pass-through(가공 없이 그대로 HTTP 응답)뿐이라 실질 위험은 없지만(grep 으로 확인 —
    다른 소비처 0건), 이후 누군가 `findAll()` 을 서비스 레이어에서 직접 호출해
    `result.data[0].user.passwordHash` 처럼 타입이 있다고 믿는 필드에 접근하면 컴파일은
    통과하고 런타임엔 조용히 `undefined` 가 나온다. 같은 파일의 RESOLUTION(이전 라운드)이
    비교 대상으로 든 `workspaces.service.ts:212-218` 의 멤버 목록 조회는 같은 TypeORM
    부분 select 패턴을 쓰지만, 반환 직전 `members.map((m) => ({ id: m.id, ... }))` 로
    **명시적으로 좁은 plain object 타입**을 만들어 반환하므로 타입이 실 데이터 형태를
    정확히 반영한다 — 이번 수정은 그 패턴을 따르지 않고 원본 엔티티 타입을 그대로
    유지한 채 데이터만 좁혔다.
  - 제안: `AuditLogsService.findAll` 의 반환 타입에서 `user` 필드를
    `Pick<User, 'id' | 'name' | 'email'> | null` 같은 좁은 타입으로 명시하거나(예:
    별도 `AuditLogWithPartialUser` 인터페이스), 최소한 select 축소 지점에 "이 축소는
    반환 타입에 반영되지 않는다 — 이 서비스의 유일한 소비처가 컨트롤러 pass-through 라는
    전제가 깨지면(예: 다른 서비스가 `findAll` 을 재사용) 타입이 거짓말을 하게 된다" 는
    주석을 남긴다.

- **[INFO]** (확인 완료, 결함 아님) `AuditLogsService.findAll` 의 유일한 호출부는
  `AuditLogsController.findAll` 뿐이다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts:40`
  - 상세: 저장소 전체 grep 결과 `auditLogsService.findAll`/`AuditLogsService` 참조 중
    `.record(...)` 를 쓰는 12개 이상의 다른 모듈은 전부 별개 메서드(`record`, 이번 diff
    로 안 바뀜)를 쓴다. `findAll` 을 직접 호출하는 자리는 컨트롤러 하나뿐이라 위
    WARNING 의 실질 폭발 반경은 지금은 0이다.

- **[INFO]** `response-contract.ts`/`swagger-probe.ts` 는 전역 상태·환경 변수·파일시스템·
  실제 네트워크 리스닝에 손대지 않는다 (이전 라운드 side_effect 리뷰와 동일 결론, 이번
  라운드에서도 소스를 직접 열어 재확인)
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:46-57`
    (`buildSwaggerDocument` — `Test.createTestingModule().compile()` → `app.init()` →
    `SwaggerModule.createDocument()` → `finally` 블록의 `app.close()`)
  - 상세: `app.init()` 은 Nest DI 컨테이너를 초기화할 뿐 `app.listen()` 을 호출하지 않으므로
    실제 포트를 열지 않는다 — 문서 생성만 목적인 in-process 호출이다. `env`/`global`/`fs`
    접근을 grep 했으나 0건. `contractForDto`(`response-contract.ts:299-315`) 가 호출마다
    선언하는 `class ProbeController` 는 매번 새 익명 클래스이고 고정 라우트
    `'__contract_probe__'` 를 쓰지만, 각 호출이 독립된 테스트 모듈 인스턴스 위에서 도는
    데다 리스닝하지 않으므로 라우트 충돌·네트워크 노출 위험이 없다.

- **[INFO]** 새 export(`contractForDto`/`findContractViolations`/`assertMatchesContract`/
  `formatViolations`/`ContractViolation`/`ContractCheckOptions`/`DtoContract` 등)는 전부
  신규 함수·타입이며 기존 함수 시그니처를 바꾸지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 전체
  - 상세: 이전 라운드(`13_49_54`)의 `assertMatchesDtoSchema(payload, schema, dtoName)` 형태
    (문자열 DTO 이름을 별도 인자로 받던 구 시그니처, `13_49_54/architecture.md`·
    `maintainability.md` 가 WARNING 으로 지적)는 이번 diff 에서 `assertMatchesContract
    (payload, contract)` 로 **교체**됐고 4개 e2e 호출부 전부가 새 시그니처를 따른다(구
    시그니처 잔존 호출 0건, grep 확인). 이 파일이 아직 신규(이번 PR 로 처음 도입)라
    "기존 호출자에게 주는 영향"은 없다 — export 가 사라진 것이 아니라 이름·시그니처
    자체가 이번 PR 안에서 한 번에 확정된 것.

- **[INFO]** e2e 4개 스펙에 추가된 `assertMatchesContract` 단언은 실제 HTTP 응답이
  DTO 선언과 어긋나면 **기존에 통과하던 테스트를 새로 실패시킬 수 있다** — 의도된
  회귀 방지 목적이라 부작용이 아니라 설계된 동작
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts:79-91`,
    `codebase/backend/test/session-revocation.e2e-spec.ts:110-111`,
    `codebase/backend/test/workflow-crud.e2e-spec.ts:161-165`,
    `codebase/backend/test/workflow-execution.e2e-spec.ts:144-155`
  - 상세: 각 파일은 기존 테스트가 이미 fetch 해 둔 리소스에 대조 단언 한 줄만 얹는
    형태다. `audit-logs.e2e-spec.ts:89-91` 은 추가로 `Object.keys(user!).sort()` 를
    독립 캐너리로 남겨 계약 검증기 자체의 회귀도 잡는다. 새 전역 fixture·DB 시딩 로직
    변경은 없다(기존 `beforeAll` 시딩 그대로).

## 검증 방법

`AuditLogsService`/`AuditLogsController` 를 직접 `Read` 했고, `findAll` 의 유일한 호출부를
저장소 전수 `grep` 으로 확인했다(`.record(...)` 호출부 12개 이상은 무관 — 별개 메서드).
`AuditLog.user`/`workspaces.service.ts` 의 대응 패턴을 대조해 타입 안전성 격차를 실측했다.
`swagger-probe.ts`/`response-contract.ts` 전문을 열어 `env`/`global`/`fs`/`listen` 호출
여부를 확인했다(0건). 저장소 트리에는 아무것도 쓰지 않았다 — 읽기 전용 조사만 수행.

## 요약

핵심 보안 수정(`leftJoin`+`addSelect` 로 `user` 조인 축소)은 목적한 부작용(민감정보 과다
노출)을 정확히 제거하지만, 그 대가로 `AuditLog.user` 의 **타입 선언(전체 `User`)과 실제
런타임 형태(3필드)가 어긋나는 새로운 latent 갭**을 남긴다 — 지금은 유일한 소비처가
컨트롤러 pass-through 라 위험이 없지만, 같은 서비스 메서드를 다른 곳에서 재사용하면 타입이
있다고 믿는 필드가 조용히 `undefined` 가 될 수 있다(WARNING 1건). 그 외 `response-contract.ts`
/`swagger-probe.ts` 계열 신규 헬퍼는 전역 상태·환경 변수·파일시스템·실 네트워크 리스닝에
손대지 않고, 신규 export 는 전부 추가적이라 기존 시그니처를 깨지 않는다. e2e 4곳에 추가된
계약 대조 단언은 향후 실패를 유발할 잠재력이 있으나 그것이 이 변경의 설계 목적이다.
CRITICAL 급 부작용은 없다.

## 위험도

LOW
