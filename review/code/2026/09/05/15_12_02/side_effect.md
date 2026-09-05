# 부작용(Side Effect) 리뷰

## 대상 요약

이번 프롬프트는 `origin/main..HEAD` 9개 커밋 전체(§5.4 응답-DTO 대조 헬퍼 신설 → audit-logs
민감정보 노출 수정 → 자기참조 DTO 순환 가드 수정 → 각 라운드의 `review/code`·`review/consistency`
산출물 커밋)를 조립한 것이다. 실질 코드 변경은 (1) `AuditLogsService.findAll` 의 `user` 조인
축소(`leftJoinAndSelect` → `leftJoin`+`addSelect`) + 반환 타입 좁히기(`AuditLogListItem`),
(2) `response-contract.ts`/`.spec.ts` 신설(§5.4 검증 헬퍼, 자기참조 순환 가드 포함), (3) 4개
e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)에 계약 대조
단언 배선이다. 나머지(`plan/*.md`, `review/**`)는 이전 두 라운드(`13_49_54`, `14_39_31`)
자신의 산출물을 커밋한 문서/JSON이라 실행되는 코드가 아니다.

이 정확히 같은 코드 셋(audit-logs.service.ts, response-contract.ts, 4개 e2e 스펙)은 이미
`review/code/2026/09/05/13_49_54/side_effect.md`(NONE)와
`review/code/2026/09/05/14_39_31/side_effect.md`(LOW, WARNING 1건)에서 두 차례 부작용
관점으로 검토됐다. 이번 라운드는 (a) 그 WARNING 이 이번 diff 안에서 실제로 해소됐는지,
(b) 해소 과정에서 새 부작용이 생기지 않았는지를 저장소의 **현재 최종 상태**를 직접 열어
재검증했다(뮤테이션 없이 `Read`만 사용).

## 발견사항

- **[INFO]** (확인 완료 — 이전 라운드 WARNING 해소) `14_39_31/side_effect.md` 가 지적한
  "`findAll` 반환 타입이 여전히 전체 `User` 를 약속해 런타임(3필드)보다 넓다"는 latent
  타입 갭이 이번 diff 에서 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19-21`
    (`export type AuditLogListItem = Omit<AuditLog, 'user'> & { user: Pick<User, 'id' | 'name' | 'email'> | null };`),
    `:38`(반환 타입을 `PaginatedResponseDto<AuditLogListItem>` 로 변경), `:87-90`
    (`getMany()` 결과에 `as AuditLogListItem[]` 캐스트를 `addSelect` 바로 옆 한 지점에만 배치)
  - 상세: 직접 `Read` 로 확인한 결과 `findAll` 의 시그니처가
    `Promise<PaginatedResponseDto<AuditLog>>` → `Promise<PaginatedResponseDto<AuditLogListItem>>`
    로 바뀌었다 — **공개 메서드 반환 타입 변경**이다. 호출부 영향을 저장소 전수 `grep`
    (`auditLogsService.findAll`)으로 재확인한 결과 유일한 호출부는
    `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts:40` 이고, 이 컨트롤러는
    반환값을 가공 없이 그대로 리턴하는 pass-through 라 타입이 좁아져도 컴파일이 깨지지 않는다
    (다른 12개 이상의 `AuditLogsService` 소비처는 전부 별개 메서드 `record(...)` 를 쓴다 —
    `findAll` 과 무관, 재확인 완료). 즉 시그니처 변경의 실질 폭발 반경은 0이며, 이전에
    WARNING 으로 지적했던 "타입이 런타임보다 넓어 다음 소비자가 `user.passwordHash` 를
    컴파일 통과시킬 수 있다"는 위험이 원천적으로 제거됐다.
  - 제안: 조치 불요 — 이미 올바르게 해소됨. 회귀 방지를 위해 `AuditLogListItem` 을 다른
    모듈에서 재사용하려는 변경이 생기면 그때 이 타입이 여전히 `findAll` 의 실제 select
    구성과 일치하는지 재검증할 것.

- **[INFO]** (확인 완료, 결함 아님) `response-contract.ts`/`swagger-probe.ts` 전문을 다시
  직접 열어 전역 상태·환경 변수·파일시스템·네트워크 부작용을 재확인 — 0건
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`(399줄 전체),
    `codebase/backend/src/shared/testing/swagger-probe.ts`(131줄 전체, 이번 diff 대상은
    아니나 `response-contract.ts` 가 유일하게 의존하는 파일이라 함께 확인)
  - 상세: `env`/`global`/`fs`/`listen` 패턴이 두 파일 어디에도 없다. 상태를 갖는 것은
    `findContractViolations` 안의 지역 `Walk.out` 누산기(함수 호출마다 새로 생성되는
    지역 배열)뿐이고, 모듈 스코프의 mutable 변수는 없다. `contractForDto` 가 호출마다
    선언하는 `class ProbeController`(response-contract.ts:384-391)는 매번 새 익명 클래스이고
    `buildSwaggerDocument`(swagger-probe.ts:46-57)는 `app.listen()` 을 호출하지 않으며
    `finally` 에서 반드시 `app.close()` 한다 — 실제 포트를 열지 않는 in-process 문서
    생성이라 리소스 누수·네트워크 노출 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** (확인 완료, 결함 아님) 신규 테스트 헬퍼가 프로덕션 코드에서 import 되지 않는다
  - 위치: 저장소 전체 `grep "shared/testing/response-contract\|shared/testing/swagger-probe" codebase/backend/src` — `src/shared/testing/**` 자기 자신 밖에서의 참조 0건
  - 상세: 새 export(`ContractViolation`/`DtoContract`/`findContractViolations`/
    `assertMatchesContract`/`formatViolations`/`contractForDto`)는 전부 신규이고 기존 함수
    시그니처를 바꾸지 않는다. 소비처는 `test/*.e2e-spec.ts` 4곳뿐이라 프로덕션 `dist` 로
    새어나갈 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** e2e 4개 스펙에 추가된 `assertMatchesContract` 호출은 기존 `beforeAll`/테스트
  본문이 이미 fetch 해 둔 응답에 대조 단언 한 줄만 얹는 형태 — 새 전역 fixture·DB 시딩·
  네트워크 호출 경로 추가 없음
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts:36-40`(`beforeAll` 에서
    `contractForDto` 1회 호출) 및 `:78-91`(단언), `session-revocation.e2e-spec.ts:44-47,110-111`,
    `workflow-crud.e2e-spec.ts:119-122,161-165`, `workflow-execution.e2e-spec.ts:63-68,144-155`
  - 상세: 응답이 실제로 DTO 선언과 어긋나면 기존에 통과하던 테스트가 새로 실패할 수
    있으나, 이는 이 변경의 설계 목적(회귀 방지)이지 의도치 않은 부작용이 아니다. 각 파일이
    호출하는 `process.env.E2E_BASE_URL` 등은 이번 diff 이전부터 있던 상수 선언이라 이번
    변경이 새로 추가한 환경 변수 읽기가 아니다.
  - 제안: 조치 불요.

- **[NONE]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 변경은 전부
  마크다운/JSON 문서이며 실행되는 코드가 아니다 — 프로세스 상태·전역 변수·파일시스템(문서
  자체를 제외한)·네트워크에 영향을 주지 않는다.

## 검증 방법

`git log --oneline origin/main..HEAD` 로 9개 커밋을 확인하고, 실질 코드 변경 커밋
(`ab6fa6863`/`df8be1859`/`45c1cdf63`/`db45d1b09`)이 마지막으로 건드린 **현재 HEAD 상태의
소스**를 `Read` 로 직접 열어 대조했다(`audit-logs.service.ts` 154줄 전체,
`response-contract.ts` 399줄 전체, `swagger-probe.ts` 131줄 전체). `AuditLogsService.findAll`
호출부는 저장소 전수 `grep` 으로, 테스트 헬퍼의 프로덕션 import 여부도 전수 `grep` 으로
확인했다(둘 다 재확인, 이전 라운드와 동일 결론). 저장소 트리에는 아무 것도 쓰지 않았다 —
`git status --short` 결과 본 세션 산출물 디렉터리(`review/code/2026/09/05/15_12_02/`) 외
변경 없음.

## 요약

이번 diff 가 조립하는 9개 커밋 중 부작용 관점에서 실질적인 코드는 이미 두 차례(`13_49_54`,
`14_39_31`) 이 관점으로 검토됐고, 그중 유일한 WARNING(`findAll` 반환 타입이 런타임 형태보다
넓었던 latent 갭)이 이번 최종 diff 에서 `AuditLogListItem` 타입 도입으로 실제로 해소됐음을
소스를 직접 열어 재확인했다. 그 타입 좁히기 자체가 공개 메서드의 반환 타입을 바꾸는
시그니처 변경이지만, 유일한 호출부가 컨트롤러 pass-through 임을 재확인해 실질 폭발 반경이
없다. 신규 테스트 헬퍼(`response-contract.ts`/`swagger-probe.ts`)는 전역 상태·환경 변수·
파일시스템·네트워크 리스닝 어디에도 손대지 않고, 프로덕션 코드에서 import 되는 경로도
없다. e2e 4곳에 추가된 계약 대조 단언은 기존 흐름에 검증 스텝을 얹을 뿐 새 부작용 표면을
열지 않는다. 새로 발견된 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

NONE
