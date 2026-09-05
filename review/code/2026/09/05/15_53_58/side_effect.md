# 부작용(Side Effect) 리뷰

## 대상 요약

`origin/main..HEAD` 전체(13개 커밋) 중 실행 코드는 `AuditLogsService.findAll`(select 축소 +
반환 타입 좁히기, `workspace`/`user` 둘 다 `Omit`), §5.4 응답-DTO 대조 헬퍼
(`response-contract.ts`/`.spec.ts`, 내부 `visitUnion` 파라미터 정리), 신규 `ExecutionDto`
스키마 가드(`execution-response.dto.spec.ts`), 4개 e2e 스펙(`audit-logs`/`session-revocation`/
`workflow-crud`/`workflow-execution`)에 대한 계약 대조 배선이다. `CHANGELOG.md`·
`plan/in-progress/*.md`·`review/code/**`·`review/consistency/**` 는 문서/이전 라운드 산출물
이며 실행되는 코드가 아니다.

`git log --oneline origin/main..HEAD` 로 실측한 결과, 이 코드 셋에 대한 부작용 관점 검토는
이번이 **다섯 번째**다 — `13_49_54`(NONE) → `14_39_31`(NONE) → `15_12_02`(NONE) →
`15_31_41`(NONE) 이 이미 같은 실행 코드를 반복 검토했다. `15_31_41` 이후 실제로 추가된
코드 커밋은 `bf02fe328`(`response-contract.spec.ts`/`.ts` — union `allowUndeclared` 캐너리 +
미사용 내부 파라미터 제거), `5fcb5c625`(`audit-logs.service.ts` — `AuditLogListItem` 이
`workspace` 도 함께 `Omit`, 주석 오탈자 정정 + 신규 `execution-response.dto.spec.ts`) 둘뿐이고,
`6a6621ecd` 는 리뷰 산출물 문서 커밋이다. 이 두 커밋을 직접 열어 대조했다(아래 발견사항).
저장소에는 어떤 뮤테이션도 가하지 않았다 — `Read`/`Grep`/`git show`/`git diff` 만 사용했고,
`git status --short` 로 본 세션 산출물 디렉터리(`review/code/2026/09/05/15_53_58/`,
`review/consistency/2026/09/05/15_53_59/`) 외 변경이 없음을 확인했다.

## 발견사항

- **[INFO]** (확인 완료, 결함 아님) `AuditLogListItem` 이 `workspace` 도 `Omit` 하도록
  넓어졌다 — 순수 타입 레벨 변경이라 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`
    (`AuditLogListItem` 타입 선언, `Omit<AuditLog, 'user' | 'workspace'>`)
  - 상세: 이 커밋(`5fcb5c625`)은 쿼리(`leftJoin`/`addSelect`/`where` 등)를 전혀 건드리지
    않았다 — 바뀐 것은 반환 타입 표기뿐이다. `grep -rn "AuditLogListItem"` 결과 이 타입은
    선언 파일 자신 안에서만 쓰이고, `findAll` 의 유일한 호출부(`audit-logs.controller.ts:40`)는
    가공 없이 그대로 리턴하는 pass-through 라 타입이 넓어져도 컴파일이 깨지지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (확인 완료, 결함 아님) `visitUnion` 의 파라미터 시그니처가 바뀌었지만
  비공개(모듈 내부) 함수라 폭발 반경이 0이다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `visitUnion` 함수
    선언(`_onPath: ReadonlySet<object>` 파라미터 제거), 호출부 `descend` 내
    `visitUnion(value, nested, path, walk)`
  - 상세: `visitUnion` 은 `export` 되지 않은 모듈 내부 함수이고 호출부는 같은 파일의
    `descend` 한 곳뿐이다(grep 확인). export 되는 공개 함수(`findContractViolations`/
    `assertMatchesContract`/`formatViolations`/`contractForDto`)의 시그니처는 이번 두 커밋
    모두에서 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** (확인 완료, 결함 아님) 신규 `execution-response.dto.spec.ts` 는 기존
  `swagger-probe.ts`/`buildSwaggerDocument` 패턴을 그대로 재사용 — 새 전역 상태·환경 변수·
  파일시스템·네트워크 부작용 없음
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts`
    전체(신규 파일)
  - 상세: `beforeAll` 에서 `buildSwaggerDocument({ controllers: [StubController] })` 를
    1회만 호출해 재사용하고(캐싱 통일 패턴 준수), `StubController` 는 매 테스트 파일 로드 시
    한 번만 선언되는 정적 클래스라 `response-contract.ts`(호출마다 익명 `ProbeController`
    재선언)와 다르지만 어느 쪽도 실 HTTP 리스닝을 하지 않는다(`app.listen()` 미호출,
    `finally` 블록에서 `app.close()` 보장 — `swagger-probe.ts:46-57`, 이번 diff 대상 아님).
    `process.env`/`global`/`fs.`/`fetch(` grep 결과 이 파일 안에서 0건.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 새 결함 아님) e2e 4개 스펙(`audit-logs`/`session-revocation`/
  `workflow-crud`/`workflow-execution`)은 `15_31_41` 라운드 이후 변경분이 없다
  - 상세: `git log --oneline -- codebase/backend/test/audit-logs.e2e-spec.ts
    codebase/backend/test/session-revocation.e2e-spec.ts
    codebase/backend/test/workflow-crud.e2e-spec.ts
    codebase/backend/test/workflow-execution.e2e-spec.ts` 로 확인한 결과, 이번 diff 범위
    안에서 이 4개 파일을 건드린 마지막 커밋은 `45c1cdf63`/`df8be1859`/`ab6fa6863`(모두
    `15_31_41` 이전)이다. 새로 추가된 `process.env.E2E_BASE_URL` 읽기도 없다 — 그 줄은
    diff 밖의 기존 코드다.
  - 제안: 조치 불요.

- **[NONE]** `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**`
  변경은 전부 마크다운/JSON 문서이며 실행되는 코드가 아니다 — 프로세스 상태·전역 변수·
  파일시스템(문서 자체 생성을 제외한)·네트워크에 영향을 주지 않는다.

## 요약

이 코드 셋에 대한 다섯 번째 부작용 검토다. `15_31_41` 이후 실제로 추가된 코드는 내부(비공개)
함수의 미사용 파라미터 제거, 순수 타입 레벨 `Omit` 확장, 그리고 기존 스키마-가드 패턴을
그대로 재사용하는 신규 테스트 파일 하나뿐이며, 이 중 어느 것도 전역 상태·환경 변수·
파일시스템·네트워크·공개 시그니처에 새로운 영향을 만들지 않는다. e2e 4개 스펙과
`response-contract.ts`/`.spec.ts` 의 핵심 부트스트랩 로직(호출마다 격리된 Nest 앱 생성 후
`finally` 로 확실히 닫는 설계)은 이전 네 라운드에서 이미 검증되었고 이번 라운드에서 변경되지
않았음을 `git log`/`git diff` 로 직접 확인했다. 저장소에 어떤 뮤테이션도 가하지 않았다.
CRITICAL/WARNING 급 부작용은 없다.

## 위험도

NONE
