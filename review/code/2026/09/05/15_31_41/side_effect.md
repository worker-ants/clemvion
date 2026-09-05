# 부작용(Side Effect) 리뷰

## 대상 요약

이번 프롬프트가 조립한 59개 파일 중 실제 실행 코드는 9개(`CHANGELOG.md` 제외)뿐이다 —
`AuditLogsService.findAll`(select 축소 + 반환 타입 좁히기), `response-contract.ts`/
`.spec.ts`(§5.4 응답-DTO 대조 헬퍼 신설), 4개 e2e 스펙(`audit-logs`/`session-revocation`/
`workflow-crud`/`workflow-execution`)에 계약 대조 배선. 나머지 `plan/*.md`,
`review/code/2026/09/05/{13_49_54,14_39_31,15_12_02}/**`, `review/consistency/2026/09/05/12_48_13/**`
는 이전 라운드 자신의 산출물을 그대로 커밋한 마크다운/JSON 문서이며 실행되는 코드가 아니다.

`git log --oneline origin/main..HEAD` 로 실측한 결과, 이 코드 셋은 **이번이 네 번째** 부작용
관점 검토다 — `13_49_54/side_effect.md`(NONE), `14_39_31/side_effect.md`(NONE, WARNING 1건
해소 확인), `15_12_02/side_effect.md`(NONE, `AuditLogListItem` 타입 좁히기 재확인)에서 이미
같은 소스를 검토했고, 이번 라운드가 추가하는 코드 커밋은 없다(HEAD 최상단 `4d8118956`은
`15_12_02` 라운드 자신의 산출물 커밋일 뿐). 저장소에는 어떤 뮤테이션도 가하지 않았다 —
`Read`/`Grep` 만 사용했고 `git status --short` 로 본 세션 산출물 디렉터리 외 변경 없음을
확인했다.

## 발견사항

- **[INFO]** (확인 완료, 결함 아님) `AuditLogsService.findAll` 의 반환 타입 변경은 공개
  메서드 시그니처 변경이지만 실질 폭발 반경이 0이다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:35-38`
    (`Promise<PaginatedResponseDto<AuditLog>>` → `Promise<PaginatedResponseDto<AuditLogListItem>>`),
    `:19-21`(`AuditLogListItem` 신규 타입)
  - 상세: `grep -rn "AuditLogListItem" codebase/backend/src codebase/backend/test` 결과
    이 타입은 선언 파일 자신 안에서만 쓰인다(3곳 전부 `audit-logs.service.ts`). `findAll` 의
    유일한 호출부는 `audit-logs.controller.ts:40` 이고, 반환값을 가공 없이 그대로 리턴하는
    pass-through 라 타입이 좁아져도 컴파일이 깨지지 않는다. `AuditLogsService` 의 다른
    소비처(12곳 이상)는 전부 `record(...)` 를 쓰며 `findAll` 과 무관함을 재확인했다.
  - 제안: 조치 불요 — 이미 안전하게 닫힌 상태.

- **[INFO]** (확인 완료, 결함 아님) `response-contract.ts`(399줄)/`swagger-probe.ts`(131줄,
  이번 diff 대상 아님) 전문에 전역 상태·환경 변수·파일시스템·네트워크 부작용이 없다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 전체
  - 상세: `process.env`/`global`/`globalThis`/`fs.`/`http.`/`fetch(` 패턴 grep 결과 0건.
    상태를 갖는 것은 `findContractViolations` 호출마다 새로 만들어지는 지역 `Walk.out`
    누산기뿐이고 모듈 스코프 mutable 변수는 없다. `contractForDto`(`:383-399`)가 호출마다
    선언하는 `class ProbeController` 는 매번 새 익명 클래스이며, 의존하는
    `buildSwaggerDocument`(`swagger-probe.ts:46-57`)는 `app.listen()` 을 호출하지 않고
    `finally` 에서 반드시 `app.close()` 한다 — 포트를 열지 않는 in-process 문서 생성이라
    리소스 누수·네트워크 노출 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** (확인 완료, 결함 아님) 신규 테스트 헬퍼가 프로덕션 코드에서 import 되지 않는다
  - 위치: `grep -rn "shared/testing/response-contract\|shared/testing/swagger-probe" codebase/backend/src` — 자기 자신(`src/shared/testing/**`) 밖 참조 0건
  - 상세: 새 export(`ContractViolation`/`DtoContract`/`findContractViolations`/
    `assertMatchesContract`/`formatViolations`/`contractForDto`)는 전부 신규 함수/타입이라
    기존 함수 시그니처를 바꾸지 않는다. 소비처는 `test/*.e2e-spec.ts` 4곳뿐이며,
    `tsconfig.build.json` 의 `exclude: ["src/shared/testing/**"]` 로 프로덕션 `dist` 에서도
    이미 제외돼 있다.
  - 제안: 조치 불요.

- **[INFO]** e2e 4개 스펙에 추가된 `assertMatchesContract` 호출은 기존 `beforeAll`/테스트
  본문이 이미 fetch 해 둔 응답에 대조 단언 한 줄만 얹는 형태 — 새 전역 fixture·DB 시딩·
  네트워크 호출 경로 추가 없음
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts:36-40,80`,
    `session-revocation.e2e-spec.ts:44-47,111`, `workflow-crud.e2e-spec.ts:119-122,165`,
    `workflow-execution.e2e-spec.ts:63-68,155` (전부 현재 HEAD 기준 `contractForDto`/
    `assertMatchesContract` 로 리네임 완료된 상태 — 구 식별자 `schemaForDto`/
    `assertMatchesDtoSchema` 잔존 0건, grep 재확인)
  - 상세: 응답이 실제로 DTO 선언과 어긋나면 기존에 통과하던 e2e 테스트가 새로 실패할 수
    있으나, 이는 이 변경의 설계 목적(회귀 방지)이지 의도치 않은 부작용이 아니다.
  - 제안: 조치 불요.

- **[INFO]** (문서화된 wire 변경 — 새 발견 아님) `GET /api/audit-logs` 응답의 중첩 `user`
  객체가 26개 키에서 3개 키로 줄어드는 것은 §5.4/보안 관점에서는 수정이지만, "인터페이스
  변경" 렌즈로 보면 **이미 그 26개 필드에 의존했을 수 있는 소비자**에게 영향을 주는 wire
  변경이다
  - 위치: `CHANGELOG.md:59-98`(신규 `## Unreleased` 항목이 이 사실과 "이미 나간 것은
    회수되지 않는다" 는 영향을 스스로 명시), 실 구현은
    `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:60-61`
  - 상세: 정상적으로 문서화된 DTO(`AuditLogUserDto`, 3필드)만 보고 개발된 소비자는 영향이
    없다. CHANGELOG 가 이 사실과 사후 조치(로그·APM·캐시 점검)를 이미 명시하고 있어 새로운
    발견은 아니며, 이 항목의 아키텍처적 잔여 리스크(엔티티 레벨 `select:false` 부재로 다른
    조인 지점에서 재발 가능)는 이미 `review/code/2026/09/05/14_39_31/architecture.md` 가
    WARNING 으로 등재해 두었다. 부작용 관점에서 추가로 등재할 새 사실은 없다.
  - 제안: 조치 불요 — 기존 WARNING(architecture.md)과 CHANGELOG 고지로 이미 추적 중.

- **[NONE]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 변경은 전부
  마크다운/JSON 문서이며 실행되는 코드가 아니다 — 프로세스 상태·전역 변수·파일시스템(문서
  자체를 제외한)·네트워크에 영향을 주지 않는다.

## 요약

이번 diff 의 실질 코드(감사 로그 select 축소 + 반환 타입 좁히기, §5.4 응답-DTO 대조 헬퍼
신설, 4개 e2e 배선)는 이미 세 차례(`13_49_54`/`14_39_31`/`15_12_02`) 부작용 관점으로 검토돼
NONE 판정을 받았고, 이번 라운드는 그 코드에 새 커밋이 없음을 `git log` 로 확인한 뒤 같은
결론을 재확인했다. 전역 변수·환경 변수·파일시스템·네트워크 호출 어디에도 새 부작용이
없고, 유일한 공개 시그니처 변경(`findAll` 반환 타입)은 폭발 반경이 0으로 닫혀 있으며,
컨트롤러 응답 wire 변경(user 필드 축소)은 CHANGELOG 에 이미 영향까지 포함해 문서화됐다.
CRITICAL/WARNING 급 부작용은 없다.

## 위험도

NONE
