# 요구사항(Requirement) 리뷰 — 감사 로그 유출 수정 + §5.4 응답 계약 검증자 (2026-09-05 15:12:02)

## 검증 방법

`git log --oneline origin/main..HEAD` 로 이번 diff 가 10개 커밋
(`ab6fa6863` feat → `df8be1859` test → `abc87b2d4` docs(plan) → `45c1cdf63` fix →
`2fa650b5a`/`9d0b876ad` docs(review) → `db45d1b09` fix → `ee755efbe` docs(review), 그리고 최상단
`0498d7362` docs(review))로 구성됨을 확인했다. 이는 `review/code/2026/09/05/13_49_54` 와
`14_39_31` 두 라운드가 **이미 이 diff 전체를 리뷰하고 지적을 반영한 뒤의 최종 상태**라는 뜻이라,
두 RESOLUTION.md 의 조치 항목을 각각 현재 소스에서 재확인하는 방식으로 진행했다. 저장소에는
아무것도 쓰지 않았다(`git status --short` 로 확인 — 본 세션 산출물 디렉터리 외 변경 없음).

핵심 파일을 전문 열람했다: `audit-logs.service.ts`, `audit-logs.spec.ts`,
`response-contract.ts`(400줄 전체), `response-contract.spec.ts`(408줄 전체),
`audit-logs.e2e-spec.ts`, `audit-log-response.dto.ts`, `user.entity.ts`,
`audit-log.entity.ts`, `swagger-probe.ts`, `spec/5-system/2-api-convention.md` §5.4,
`spec/data-flow/1-audit.md` §2.1.

## 발견사항

- **[INFO]** 이전 두 라운드(`13_49_54`, `14_39_31`)가 지적한 requirement 급 결함이 현재 코드에서
  모두 실측 확인됨 — 재발 없음
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 전체,
    `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19-21,60-61,87-90`
  - 상세: (1) 원 결함 — `AuditLogsService.findAll` 이 `leftJoinAndSelect('al.user','user')` 로
    `User` 전 컬럼(26키)을 실어 컨트롤러가 그대로 반환하던 것은 `.leftJoin` +
    `.addSelect(['user.id','user.name','user.email'])` 로 좁혀졌고(`:60-61`), 반환 타입도
    `AuditLogListItem`(`Omit<AuditLog,'user'> & { user: Pick<User,'id'|'name'|'email'>|null }`,
    `:19-21`)으로 좁혀 타입이 런타임보다 넓지 않다. (2) `findContractViolations` 의 순환 가드가
    스키마 이름 기준이라 자기참조 DTO 내부를 전혀 검사하지 않고 통과시키던 결함(C1)은 방문
    집합을 **payload 객체 동일성**으로 교체해 고쳤고(`response-contract.ts:180-217`),
    `response-contract.spec.ts:284-322` 가 "1단계 검사됨/2단계까지 내려감/자기참조 payload 종료/
    유효 payload 통과" 4갈래로 나눠 재발을 판별력 있게 잡는다. (3) 판별자 없는 `oneOf`/`anyOf`
    아래에 숨은 과다노출을 못 잡던 사각지대(W1)는 `referencedNames`/`visitUnion`(`:132-144,
    284-303`)이 "어느 변형에도 없는 키" 를 무는 약한 판정으로 메웠고, `UnionDto` 픽스처
    4테스트(`:325-363`)가 대조군이다. (4) JSDoc 규칙 표가 "키 생략형 + nullable → null 허용"
    의 출처를 §5.4 로 잘못 표기했던 것(W5)은 표 넷째 행에 "**§5.4 아님** — 아래 참조" 주석과
    본문 설명(`:42-55`)으로 정정됐고, §5.4 원문(`spec/5-system/2-api-convention.md:178,189`,
    tri-state 는 요청 DTO 전용)과 대조해 지금 서술이 정확함을 확인했다. (5) `ContractViolationKind`
    가 "필드 누락" 과 "payload 자체가 객체 아님" 에 같은 `'missing'` 을 재사용하던 것은
    `'invalid-payload'` 로 분리됐고(`:72-76`), `response-contract.spec.ts:371-377` 가 `kind` 값
    자체를 단언한다. (6) `dtoName` 을 호출부가 문자열로 다시 타이핑해야 했던 API(`schemaForDto`+
    `assertMatchesDtoSchema`)는 `contractForDto(Dto)` 가 `{ name: Dto.name, schema, schemas }`
    를 함께 반환하는 `DtoContract` 로 대체돼(`:112-117,383-399`), 4개 e2e 호출부
    (`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution` e2e-spec) 어디에도
    더 이상 `'AuditLogDto'` 류 문자열 리터럴이 없다 — 이름-리네임 drift 클래스 자체가 제거됐다.
    이는 새 결함 없음의 확인이므로 조치 불요.

- **[INFO]** (기존 추적 항목, 이번 diff 범위 밖) `AuditLogDto.user`/`ipAddress` 자신의 선언이
  §5.4 응답 바디 규칙과 어긋난다 — `response-contract.ts` 는 이를 의도적으로 판정하지 않는다
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26`
    (`@ApiPropertyOptional({ type: () => AuditLogUserDto, nullable: true }) user?: AuditLogUserDto | null`),
    `:52-53`(`ipAddress?: string | null` 도 동일 패턴)
  - 상세: `spec/5-system/2-api-convention.md` §5.4(`:178,189`)는 "키 생략형(optional)" 필드에
    `| null` 을 명시적으로 금지하고, `optional + nullable` tri-state 조합은 **요청 DTO(PATCH
    부분 업데이트)에 한해서만** 정당하다고 적는다. `AuditLogDto.user`/`ipAddress` 는 응답 DTO인데
    둘 다 이 tri-state 형태로 선언돼 있어 **선언 층 §5.4 위반**이다. 다만 이 파일은 이번 diff 의
    변경 대상이 아니고(diff 목록에 없음), `response-contract.ts` 의 JSDoc(`:42-49`)이 "선언 자체가
    §5.4 를 지키는지는 이 도구가 아니라 다른 층(`repo-guards/swagger-dto-contract` + 트래커의
    drift 항목)이 본다" 고 설계 경계를 명시하며, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 "§5.4 관련 필드를 가진 DTO 60개" 전수 스윕 백로그로 이미 이 클래스의 항목을 일반적으로
    추적하고 있다. 새로 발견된 결함이 아니라 이미 알려진 선언 drift 의 한 사례이므로 이번 PR
    범위에서 조치를 요구하지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖). 향후 §5.4 선언-레벨 스윕(위 plan 문서 "2단계") 진행 시
    `AuditLogDto.user`/`ipAddress` 도 대상에 포함해 `nullable: true` 를 유지할지(응답에서
    `user`/`ipAddress` 가 상시 present 라면 required+nullable 로) `?` 를 유지할지(그렇다면
    `nullable: true` 제거) 결정한다.

- **[INFO]** 감사 로그의 `user` 관계는 현재 DB 제약상 실질적으로 항상 non-null 이지만 DTO 는
  nullable 로 선언돼 있다 — 모순은 아니고 방어적 선언으로 보이나 근거 주석이 없다
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts:24-29`
    (`userId: string` not-null 컬럼 + `@ManyToOne(() => User) user: User` — `onDelete` 미지정)
  - 상세: `userId` 컬럼이 not-null 이고 `User` 관계에 `onDelete` 옵션이 없어(기본은 RESTRICT/NO
    ACTION 계열), 정상 운영에서는 `user` 가 항상 매치돼 `left join` 결과가 null 이 되는 경로가
    보이지 않는다. `AuditLogDto.user` 를 nullable 로 선언한 것 자체는 미래의 유저 삭제 정책
    변경에 대한 방어적 설계일 수 있어 결함이라 보기 어렵지만, 왜 nullable 인지 근거 주석이
    없어 다음 사람이 "이 경로가 실제로 null 이 될 수 있나" 를 다시 조사해야 한다. 이번 diff 가
    이 DTO 파일을 건드리지 않았으므로 범위 밖이다.
  - 제안: 조치 불요 — 참고 기록.

## 요약

이번 diff 는 (1) `GET /api/audit-logs` 가 `User` 엔티티 전 컬럼(비밀번호 해시·2FA 복구 코드·
계정 탈취용 토큰 포함 26키)을 응답으로 내보내던 실제 보안 결함을 `leftJoinAndSelect` →
`leftJoin`+`addSelect(3필드)` 로 좁혀 근본 수정하고, 반환 타입도 `AuditLogListItem` 으로 좁혀
타입이 런타임 형태보다 넓어지지 않게 했으며, (2) 이 클래스의 재발을 잡기 위해 "실 응답 1건
vs DTO 선언" 을 중첩 DTO·배열·판별자 없는 union 까지 내려가 대조하는 일반 §5.4 검증
헬퍼(`response-contract.ts`)를 신설해 4개 e2e 스펙에 배선했다. 코드를 직접 열람해 확인한 결과,
이전 두 리뷰 라운드(`13_49_54`, `14_39_31`)가 지적한 requirement 급 결함(엔티티 패스스루,
자기참조 스키마 거짓 통과, union 사각지대, kind 재사용, dtoName 중복, JSDoc-구현 불일치)은
모두 현재 소스에서 고쳐진 상태로 실측됐고, 대응하는 판별력 있는 테스트(뮤턴트가 실제로 RED 를
내는 형태)도 갖춰져 있다. spec 본문(`spec/5-system/2-api-convention.md` §5.4,
`spec/data-flow/1-audit.md` §2.1)과 line-level 로 대조해도 필터·페이지네이션·정렬 whitelist·
권한(§4.2 Admin+)·부재 표현 규칙 모두 일치한다. 발견한 것은 이번 PR 범위 밖의 기존 선언 drift
(`AuditLogDto.user`/`ipAddress` 자체가 tri-state 로 선언돼 있는 것)뿐이며, 이는 이미 plan
트래커가 일반 스윕 항목으로 추적 중이라 조치를 요구하지 않는다. 이번 diff 자체에서는 기능
완전성·엣지 케이스·에러 시나리오·반환값 어느 관점에서도 새로운 CRITICAL/WARNING 급 결함을
찾지 못했다.

## 위험도

NONE
