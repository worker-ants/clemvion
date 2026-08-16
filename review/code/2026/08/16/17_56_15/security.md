# 보안(Security) 코드 리뷰

## 스코프 요약

이번 changeset 의 실질 코드 변경은 6개 backend 파일(`shared/utils/redact-stored-error.ts`
신설 + `.spec.ts`, `executions.service.ts`, `executions.service.spec.ts`,
`background-runs.service.ts` + `.spec.ts`, 응답 DTO 2개)에 한정되고, 나머지는
`plan/**` · `spec/**` · `review/**` · `CHANGELOG.md` 문서다. 핵심은 DB `Execution.error` /
`NodeExecution.error` (jsonb) 컬럼 값이 **읽기 경로**(`GET /api/executions/:id`,
`GET /executions/:id/chain`, `POST /executions/:id/stop`, `GET /executions?workflowId=`
목록, `GET /executions/:id/background-runs/:id`, WS `execution.snapshot`)에서 자격증명
형태 부분문자열(Bearer 토큰, DB 연결 문자열 userinfo 등)까지 원문으로 나가고 있던 정보
노출(CWE-209/CWE-200 계열) 결함을 닫는 방어적 수정이다. 기존 `deepRedactSecrets`
(`sanitize-error-message.ts`, 이번 diff 로 로직 변경 없음)를 감싸는
`redactStoredErrorForResponse` 를 신설해 `ExecutionsService` 의 독립 반환 지점 4곳
(`findById`/`getChain`/`stop`/`toExecutionDto`) + 형제 필드(`nodeExecutions[].error`) +
자매 컨트롤러(`BackgroundRunsService`)까지 단일 관문으로 적용했다. 같은 코드베이스에
대한 3라운드 선행 보안 리뷰(`review/code/2026/08/16/17_12_34/security.md`,
`17_35_49/security.md`)가 모두 위험도 **NONE** 으로 판정했고, 그 이후 커밋
(`9dee1caa0`, `6d57cc7ae`)은 타입 안전성 강화(`ResponseNodeExecution` 도입으로
`as NodeExecution` 캐스트 제거)·copy-on-change 참조 동일성 테스트 추가·Swagger
JSDoc 갱신 등 견고화 조치이며, 인가/인증/쿼리 로직은 손대지 않았다. 실측 결과
(`git diff`, `grep`)로 아래 항목을 직접 대조 확인했다.

## 검증한 항목

- **인젝션**: 변경분에 신규 raw SQL·동적 커맨드·경로 조합이 없다. 기존
  `createQueryBuilder(...).where('e.id = :id', { id })` 류의 파라미터 바인딩 패턴이
  그대로 유지되고(`executions.service.ts` 전역), `background-runs.service.ts` 의
  JSONB `#>>` 연산자도 named parameter(`:backgroundRunId`)로 바인딩된다. SQL
  인젝션 신규 표면 없음. 마스킹 로직 자체는 정규식 `String.replace` 치환뿐이라
  실행 가능 코드를 만들지 않는다.
- **인증/인가**: `verifyOwnership`/`isOwnerOrAdmin`/워크스페이스 소유권 검증
  (`executions.service.ts` 249~410행 부근)은 이번 diff 로 변경되지 않았다.
  `GET /api/executions/:id` 계열에 `@Roles` 게이트가 없는 것은 기존 설계(spec
  R-5 가 "boundary masking parity" 로 의도적으로 문서화)이며, 이번 PR 은 그
  전제(마스킹 parity)를 실제로 메우는 방향으로만 작동한다 — 인가 로직 약화·우회
  없음.
- **하드코딩된 시크릿**: 없음. `redact-stored-error.spec.ts` 의
  `sk-live-abc123def456`/`Bearer zzz`/`postgres://u:pw@db.internal/prod` 등은
  마스킹 대상을 검증하기 위한 합성 fixture이고, 동일 패턴이 기존
  `sanitize-error-message.spec.ts` 에도 이미 쓰인다. `git diff` 전수에서 실
  자격증명 형태(`AKIA…`, `ghp_…`, PEM 키 등) 매칭은 0건.
- **입력 검증**: `redactStoredErrorForResponse` 는 `null`/`undefined` 를 안전하게
  `null` 로 정규화하고, 위임 대상 `deepRedactSecrets` 는 `MAX_REDACT_DEPTH=10` 로
  재귀 깊이를 캡핑해(기존 로직, 변경 없음) 비정상 깊이의 jsonb 값에 의한 스택
  오버플로/DoS 를 방지한다. `SECRET_LEAK_PATTERNS`(`sanitize-error-message.ts`)는
  이번 diff 의 변경 대상이 아니며, 각 패턴이 앵커·경계 위주로 구성돼 중첩
  정량자로 인한 catastrophic backtracking 형태는 관측되지 않는다 — 다만 호출
  빈도가 REST 읽기 경로 전체로 확대되므로(이하 INFO 참고).
- **암호화**: 변경 없음. `AuthConfig.config`/`notification.signing.secretRef` 는
  여전히 AES-256-GCM/`SecretResolver` 경유. 이번 diff 의 마스킹은 저장 암호화가
  아니라 응답 egress 값 마스킹(§R17 egress-only 원칙 — DB 는 원문 보존)이라
  암호화 정책과는 직교하고, `redact-stored-error.spec.ts` 의
  `'입력 객체를 변이하지 않는다'`·`executions.service.spec.ts` 의
  `'DB 원문은 건드리지 않는다 — egress-only'` 테스트가 이 불변식을 고정한다.
- **에러 처리(본론)**: 종전엔 `execution.failed` **종결 emit** 경로(#1177)만
  마스킹되고 **읽기 경로**는 원문이었다 — 같은 소켓에서 `execution.failed` 는
  마스킹된 값을, `execution.snapshot` 은 원문을 보내는 비일관 상태. 이번 diff 가
  4개 독립 반환 지점 + 형제 필드(`nodeExecutions[].error`, §2.14 "복사" 관계로
  최상위와 동일 문자열을 담아 최상위만 가리면 우회됨) + 자매 컨트롤러
  (`background-runs.service.ts`)까지 전수 커버하도록 단일 관문
  (`toResponseExecution`)으로 묶었다. `executions.service.spec.ts` 의
  "Execution.error 응답 마스킹 — 표면 전수" describe 블록이 ①~⑤(+ⓑ/ⓒ 파생)
  케이스로 각 표면을 **독립적으로** 단언해, 한 표면에서 호출을 지워도 스위트가
  green 으로 남는 취약한 커버리지를 피했다.
- **의존성 보안**: `package.json`/lock 파일 변경 0건(`git diff --stat` 로 확인).
  신규 외부 패키지 도입 없이 기존 내부 leaf 유틸(`deepRedactSecrets`)만
  재사용한다.

## 발견사항

- **[INFO]** 잔여 마스킹 갭 — 이번 PR 이 스스로 범위 밖으로 명시한 3개 표면 (신규 결함 아님)
  - 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여(범위 밖)" 불릿,
    `CHANGELOG.md` 해당 항목
  - 상세: (1) WS `execution.node.*` **emit** 경로의 `error` 는 여전히 원문 —
    읽기 표면이 아니라 별도 emit 계약이라 이번 마스킹 관문을 지나지 않는다.
    (2) `inputData`/`outputData` 컬럼은 이번 마스킹 대상에 포함되지 않는다 —
    외부 EIA `getStatus` 는 `stripAndRedact` 를 거는데 내부 REST 는 걸지 않는
    비대칭이 그대로 남는다. (3) `explore-tools.service.ts` (workflow-assistant
    LLM 도구, 이번 diff 범위 밖)는 같은 두 컬럼을 `maskSensitiveFields`
    (키-이름 기반)로만 내보내 자유 텍스트 속 `Bearer …` 를 통과시킨다 —
    `RESOLUTION.md`(`17_12_34`)에 값-패턴 마스킹을 단순 합성했다가 기존 접미
    힌트(`****9876`) 테스트가 RED 로 반증돼 되돌리고 별도 결정 항목으로
    등재했다는 실측 기록이 있다. 세 표면 모두 PR 스스로 CHANGELOG/spec 에
    "잔여(의도, 트래커 등재)"로 명시했고 새 결함이 아니다.
  - 제안: 별도 조치 불요(이미 등재·추적 중). 후속 PR 에서 동일한 단일 관문
    설계를 재사용해 닫는 것을 권장.

- **[INFO]** `Trigger.config.interaction.triggerToken` 평문 JSONB 보관 — 기존
  설계를 이번에 문서화만 함 (신규 코드 변경 아님)
  - 위치: `spec/conventions/secret-store.md` §1 하단 신설 블록
  - 상세: 코드/저장 방식 자체는 변경되지 않고, 기존에 이미 평문으로 저장되던
    값에 "명시적 비대상 예외"로 근거(hot-path timing-safe 비교, rotation 으로
    즉시 무효화, 서버 발급 랜덤 hex 값공간이라 노출 범위가 해당 트리거 1건으로
    한정)를 문서화했다. DB 유출 시나리오에서는 여전히 평문 토큰이 노출된다는
    점만 기록해 둔다.
  - 제안: 조치 불요 — 이미 근거를 갖춘 의식적 트레이드오프이며 문서 스스로
    "다른 필드가 이 근거를 무단 재사용하면 안 된다" 캐비엇을 두고 있다.

- **[INFO]** 응답 DTO(`ExecutionDto.error`/`NodeExecutionSummaryDto.error`/
  `BackgroundRunNodeExecutionDto.error`)가 여전히 `Record<string, unknown>` 로
  느슨하게 선언 — 신규 결함 아님, 마스킹 부수효과는 JSDoc 으로 갱신됨
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`,
    `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
  - 상세: 이번 커밋이 세 곳 모두에 "자격증명으로 판별된 값은 마스킹되어 반환된다
    (DB 원문과 다를 수 있음)" JSDoc/`@ApiPropertyOptional description` 을 추가해
    API 문서-동작 비대칭을 해소했다(`--impl-done` WARNING 반영, 6d57cc7ae).
    `error` 필드 자체의 타입이 여전히 열려 있는 것(`additionalProperties: true`)은
    이번 PR 의 스코프가 아니고 값 마스킹과 직교하는 사안이다.
  - 제안: 조치 불요.

## 요약

이번 변경은 신규 취약점을 도입하지 않는다. 오히려 실제로 존재하던 정보 노출
취약점 — `@Roles` 게이트 없이 워크스페이스 viewer 를 포함한 전원이 조회 가능한
내부 REST/WS 읽기 경로에서 `Execution.error`/`NodeExecution.error` jsonb 컬럼에
담긴 Bearer 토큰·DB 연결 문자열 자격증명 조각이 원문으로 노출되던 결함 — 을
4개 독립 반환 경로 + 형제 필드 + 자매 컨트롤러까지 전수로 닫는 방어적 수정이다.
쿼리 파라미터 바인딩·인가 검증·암호화 정책은 변경되지 않았고, 신규 외부
의존성도 없다. 마스킹 로직은 기존에 검증된 `deepRedactSecrets` 를 재사용하며
DB 비변이(egress-only) 불변식이 전용 테스트로 고정돼 있다. 동일 changeset 에
대한 선행 2라운드 보안 리뷰(`17_12_34`, `17_35_49`)도 모두 NONE 으로 판정했고,
그 이후 커밋은 타입 안전성·테스트 판별력·문서 정합성을 강화하는 후속 조치일 뿐
보안 표면을 새로 열지 않는다. 남은 항목(WS `execution.node.*` emit,
`inputData`/`outputData`, workflow-assistant 도구, `triggerToken` 평문)은 전부
PR 자신이 명시적으로 범위 밖 잔여로 등재한 기존 갭이다.

## 위험도

NONE — 신규 보안 결함 없음. 이번 diff 는 기존 CWE-209/CWE-200 계열 정보노출
취약점을 해소하는 방향의 수정이며, 발견사항은 전부 이미 인지·추적 중인 범위
밖 잔여 항목에 대한 참고용 INFO다.
