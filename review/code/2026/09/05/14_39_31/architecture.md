# Architecture Review — audit-logs 민감정보 유출 수정 + response-contract 테스트 인프라 (2026-09-05 14:39:31)

## 범위 요약

이번 변경 셋의 실질 코드는 (1) `AuditLogsService.findAll` 의 `leftJoinAndSelect` → `leftJoin`+`addSelect` 전환(민감 컬럼 과다 노출 차단), (2) 그 전 라운드(`13_49_54`) 리뷰에서 지적된 `response-contract.ts`/`.spec.ts` 자체의 결함 수정, (3) 4개 e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)의 계약 대조 배선이다. `plan/`·`review/` 하위 파일들은 트래킹 문서·이전 라운드 산출물이라 아키텍처 관점에서 별도 코드 구조 이슈는 없다.

전 라운드(`13_49_54`) `architecture.md` 가 지적한 WARNING(DTO 이름 이중 표현)·INFO 3건(캐싱 불일치·`'missing'` kind 재사용·`code:` glob 미등재)은 이번 diff 에서 실제로 해소됐음을 직접 확인했다 — `DtoContract.name` 이 `Dto.name` 에서 파생되어 호출부 4곳 전부 문자열 인자가 사라졌고(`response-contract.ts:97-102, 299-315`), `'invalid-payload'` kind 가 신설돼 `'missing'` 과 분리됐으며(`response-contract.ts:59-63`), 4개 e2e 스펙 전부 `beforeAll` 에서 계약을 1회 생성하도록 통일됐다(`audit-logs.e2e-spec.ts:38-39`, `session-revocation.e2e-spec.ts:46-47`, `workflow-crud.e2e-spec.ts:121-122`, `workflow-execution.e2e-spec.ts:67-68`).

## 발견사항

- **[WARNING]** 민감정보 과다 노출 수정이 **호출부 하나만** 좁혔을 뿐, 그 결함 클래스를 구조적으로 막는 레이어(엔티티 `select: false` / `@Exclude()` / 전역 `ClassSerializerInterceptor`)가 여전히 없다 — 같은 패턴이 다른 관계(join)에서 재발해도 지금은 아무것도 막지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:47-48`(이번에 고친 자리) / `codebase/backend/src/modules/users/entities/user.entity.ts`(전체 — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 컬럼 어디에도 `select: false` 가 없다)
  - 상세: 이번 수정은 `leftJoin`+`addSelect(['user.id','user.name','user.email'])` 로 **이 쿼리 지점 하나**의 select 를 좁혔다. `RESOLUTION.md`(§Critical #1)가 밝힌 대로, 걸러주는 층이 원래 하나도 없었다 — `User` 엔티티에 `select: false` 0건, `@Exclude()` 0건, 전역 `ClassSerializerInterceptor` 없음, `TransformInterceptor` 는 `{data}` 래핑만 한다. 직접 확인한 결과 지금도 이 구조는 바뀌지 않았다(`user.entity.ts` grep 결과 `select: false`/`@Exclude` 0건, 저장소 전체에 `ClassSerializerInterceptor` 0건). 즉 컨트롤러가 엔티티를 그대로 반환하는 패턴(이 PR 이 만든 게 아니라 기존 관행)과 결합하면, **다음에 `User` 를 조인하는 코드**(신규 모듈이든 기존 모듈의 새 쿼리든)가 습관적으로 `leftJoinAndSelect` 를 쓰면 똑같은 유출이 재발한다. 지금 이를 잡을 수 있는 유일한 안전망은 `response-contract.ts` 기반 e2e 계약 대조인데, 그마저 응답 DTO 60개 중 4개에만 배선돼 있다(plan 문서 자체가 이를 "선행 조건이 아니라 스윕" 으로 명시). 이는 개방-폐쇄 원칙 관점에서 "새 확장(새 조인/새 엔드포인트)이 기존 안전장치를 자동으로 상속받지 못하는" 구조다 — 안전성이 각 개발자의 기억(narrow-select 패턴 재현)에 의존한다.
  - 제안: 이번 PR 범위를 벗어나더라도 후속 항목으로, `User` 엔티티의 인증 비밀 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)에 TypeORM `select: false` 를 걸어 **기본값 자체를 안전 쪽으로** 두는 것을 검토한다(명시적으로 `addSelect` 하지 않는 한 어떤 조인도 이 컬럼을 실어 오지 못하게). 이렇게 하면 이번에 고친 call-site 수정이 없었어도 유출이 원천 차단됐을 것이고, 앞으로 유사 코드가 추가돼도 구조가 방어한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 §5.4 검증자 스윕 항목에 이 대안도 함께 등재해 두는 것을 권한다.

- **[INFO]** `response-contract.ts` 는 "순수 비교 로직"(`visit`/`descend`/`findContractViolations`)과 "Nest 모듈 부트스트랩 부수효과"(`contractForDto`)를 한 파일에 담고 있다 — 응집도는 대체로 괜찮지만 스윕이 커질수록(60개 DTO) 파일이 두 축으로 계속 자란다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:141-219`(순수 트리 대조) vs `:299-315`(`contractForDto` — Nest `Test.createTestingModule` 부트스트랩)
  - 상세: 두 관심사가 지금은 각각 짧아 분리 비용이 이익보다 크지만, 이미 `swagger-probe.ts` 가 "Nest 문서 생성" 책임을 별도 파일로 분리해 둔 선례가 있으므로 대칭을 유지하려면 향후 `contractForDto` 도 별도 모듈로 뽑는 편이 자연스럽다. 지금 당장 조치가 필요한 수준은 아니다.
  - 제안: 조치 불요. 파일이 400줄을 넘거나 새 부트스트랩 변형이 추가되는 시점에 분리를 재검토.

## 요약

핵심 아키텍처 결정(엔티티 select 축소 + 스키마 기반 계약 대조 헬퍼)은 건전하다 — `response-contract.ts` 는 `Type<unknown>` 을 받아 DIP 를 지키고, `swagger-probe.ts` 위에 단일 책임(§5.4 판정)만 얹어 순환 의존 없이 계층화됐으며, 전 라운드에서 지적된 이름 이중 표현·kind 재사용·캐싱 불일치는 모두 실제로 고쳐졌음을 직접 확인했다. 다만 이번 수정이 막은 것은 **이 쿼리 하나**이고, `User` 엔티티에는 여전히 `select: false`/`@Exclude()`/전역 직렬화 인터셉터 같은 구조적 방어가 없어 같은 결함 클래스가 다른 조인 지점에서 재발해도 `response-contract` 스윕이 그 엔드포인트까지 닿기 전에는 아무것도 잡지 못한다. 이는 새로운 결함이 아니라 기존 설계의 연장이지만, 이 PR 이 그 gap 을 정확히 증명한 자리이므로 구조적 보강(엔티티 레벨 기본값 안전화)을 후속 항목으로 명시적으로 등재할 가치가 있다.

## 위험도

LOW
