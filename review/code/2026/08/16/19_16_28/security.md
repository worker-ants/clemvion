# 보안(Security) Review

## 스코프 확인

`git diff origin/main...HEAD --stat -- codebase/backend/src` 로 실측한 실질 코드 변경은 8개
파일(신규 유틸 `redact-stored-error.ts`+`.spec.ts`, `executions.service.ts`+`.spec.ts`,
`background-runs.service.ts`+`.spec.ts`, DTO JSDoc 2곳)에 한정된다. 나머지(`.claude/docs/**`,
`CHANGELOG.md`, `plan/**`, `review/**`)는 문서/리뷰 산출물이며 보안 관점 코드 변경이 아니다.
이 changeset 은 이미 같은 브랜치에서 **6라운드**의 ai-review 를 거쳤고(`17_12_34` ~
`18_58_22`), 매 라운드 security reviewer 가 독립적으로 위험도 NONE 을 판정했다. 아래는 그
이력을 신뢰하는 대신 소스를 직접 열어 8개 관점을 재검증한 결과다.

## 발견사항

없음 — Critical/Warning 없음.

## 분석 메모

### 1. 인젝션 취약점

`executions.service.ts`/`background-runs.service.ts` 의 신규·변경 코드는 전부 TypeORM
`createQueryBuilder`/`findOne`/`find` 의 파라미터 바인딩(`:id`, `:...stoppable` 등)을 그대로
사용한다. 신규로 추가된 것은 `redactStoredErrorForResponse` 호출 4~5곳뿐이고, 이 함수는
DB 에서 이미 조회된 JSONB 값을 문자열 치환하는 순수 함수라 쿼리 구성에 관여하지 않는다.
새 SQL 조립 지점 없음. `computeChainDepth` 의 재귀 CTE 도 이번 diff 대상이 아니고 파라미터
바인딩(`$1`, `$2`)을 그대로 쓴다.

### 2. 하드코딩된 시크릿

없음. `redact-stored-error.spec.ts`/`.ts` 의 `Bearer sk-live-…`, `postgres://u:pw@…` 는
전부 테스트 fixture/JSDoc 예시이지 실제 자격증명이 아니다(`sk-live-abc123def456` 는 형식만
갖춘 더미).

### 3. 인증/인가

- `GET /api/executions/:id`(`executions.controller.ts` `findOne`)는 `@Roles` 게이트가
  없어 **워크스페이스 멤버 전원**(viewer 포함)이 호출 가능 — 이는 기존 설계이고 이번
  diff 의 회귀가 아니다. 대신 `verifyOwnership()` 으로 IDOR 는 차단되고(다른 워크스페이스
  실행 조회 시 404 통일 — enumeration 방지), 이번 diff 는 바로 그 "인가된 viewer 가
  민감 값을 볼 수 있다" 는 표면에 값-마스킹을 추가해 정보노출(CWE-209)을 좁히는 방향이다.
- `background-runs.controller.ts` 도 같은 패턴: `@Roles` 없음 + `getBackgroundRun` 내부
  `verifyOwnership`(workspaceId 대조, `background-runs.service.ts:178-193`)로 IDOR 차단.
  변경분(`error: redactStoredErrorForResponse(row.error)`)은 이 가드 이후 단계라 인가
  로직에 영향 없음.
- `stop()`/`getChain()`/`reRun()` 의 기존 IDOR·RBAC 가드(`verifyOwnership`,
  `isOwnerOrAdmin`, `@Roles('editor')`)는 이번 리팩터(`stop`/`stopInternal` 분리,
  `toResponseExecution` 도입)로 로직·호출 순서가 바뀌지 않았음을 직접 확인
  (`executions.service.ts:813-907`) — 마스킹은 인가 판정 **이후** 반환값에만 적용된다.
- e2e 전용 backdoor 엔드포인트(`_test/recover-stuck-executions`,
  `:id/_test/simulate-execution-run-redelivery`)는 이번 diff 대상이 아니며 기존 이중 게이트
  (`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` + `@Roles('owner')` + `verifyOwnership`)가
  그대로 유지된다.

### 4. 입력 검증

컨트롤러 파라미터는 기존과 동일하게 `ParseUUIDPipe`/DTO validation 을 거친다. 이번 diff 가
새로 받는 입력은 없다 — `redactStoredErrorForResponse` 의 인자는 사용자 입력이 아니라 이미
DB 에 저장된 `error` 컬럼 값이다. `redact-stored-error.spec.ts` 가 `null`/`undefined`/문자열/
숫자 등 비정형(legacy JSONB) 입력에도 타입을 보존하며 안전히 통과함을 캐너리로 고정한다
(`redact-stored-error.spec.ts:39-42`, `:59-74`).

### 5. OWASP Top 10 (정보노출 A01/A09 계열)

이번 diff 의 본질은 **CWE-209 (Information Exposure Through Error Message)** 방어 강화다.
`#1177`(종결 emit 경로)이 이미 처리한 마스킹을 **내부 REST 읽기 경로 4곳**
(`findById`/`getChain`/`stop`/`toExecutionDto`) + **background-runs 읽기 경로** +
**형제 필드 우회 지점**(`nodeExecutions[].error`, §2.14 "복사" 관계)까지 넓혀, 같은 문자열이
한쪽 필드만 가려지고 다른 필드로 새는 우회를 닫는다. 신규 공격 표면을 만들지 않고 기존
표면 하나를 좁히는 변경.

### 6. 암호화 / 값-패턴 마스킹 보장 경계

`SECRET_LEAK_PATTERNS`(`sanitize-error-message.ts`, 이번 diff 의 변경 대상은 아니고 재사용
대상)를 직접 열어 ReDoS 표면을 확인했다 — 6개 정규식 모두 중첩 정량자(nested quantifier)나
겹치는 문자 클래스의 반복(`(a+)+` 류)이 없는 선형 패턴이다. `\bBearer\s+[...]+`,
alternation 기반 키워드 매칭, `\r\n` 제외 탐욕 매치, bounded `{10,}` JWT 패턴, lookbehind/
lookahead 기반 URI userinfo 매칭 — 전부 단일 패스로 선형 시간에 종료한다. `MAX_REDACT_DEPTH
=10` 재귀 상한도 응답 크기에 비례한 블로킹을 막는다(`deepRedactSecrets` 자체는 이번 diff
대상 아님, 소비만 신규).

`redactStoredErrorForResponse` 는 값-패턴(정규식) 마스킹만 하고 저장은 건드리지 않는다 —
DB 컬럼은 원문 그대로 유지(egress-only, `redact-stored-error.ts:16`)되어 서버 로그·감사
추적성은 보존된다. 이는 스펙(EIA §R17)이 명시한 설계이고, 이번 diff 의 `.spec.ts` 가
"입력을 변이하지 않는다(복사본 반환)"·"DB 원문 불변"을 각각 테스트로 고정한다
(`redact-stored-error.spec.ts:44-49`, `executions.service.spec.ts` "DB 원문은 건드리지
않는다 — egress-only (§R17)" 케이스).

### 7. 에러 처리

정확히 이 항목이 이번 diff 의 목적이다 — 자격증명 형태(`Bearer …`, URI userinfo, JWT,
`secret=`/`api_key=` 류 키-값)가 HTTP 응답 `error.message`/`error.details` 에 원문으로
남는 것을 막는다. `code`/`nodeId` 는 값 공간이 닫혀 있어 마스킹 대상에서 제외 — 진단
정밀도와 보안의 트레이드오프가 합리적으로 설계됐다. 평문 에러 메시지(예:
`Node "Send Email" failed`)는 캐너리 테스트로 무손상이 고정된다
(`redact-stored-error.spec.ts:92-99`).

### 8. 의존성 보안

`git diff --stat` 확인 결과 `package.json`/lockfile 변경 0건. 신규 함수는 저장소 내
기존 leaf 모듈(`sanitize-error-message.ts`)만 재사용하며 신규 외부 패키지 도입 없음.

## 잔여 갭 (이번 diff 범위 밖 — 참고용, 신규 결함 아님)

- WS `execution.node.*` emit 경로의 값-마스킹 미적용
- `inputData`/`outputData` 값-마스킹 미적용
- `workflow-assistant` LLM 도구(`explore-tools.service.ts`)의 `maskSensitiveFields` 는
  키-이름 기반만 적용돼 `error.message` 안의 `Bearer …` 를 통과시킴 — RESOLUTION(`17_12_34`
  #7)에서 값-패턴 마스킹 합성을 시도했으나 기존 `****9876` 접미 힌트 UX 와 충돌해 되돌리고
  결정 항목으로 등재됨(코드 변경 없음, 이번 diff 에 포함되지 않음)
- `triggerToken` 평문 저장 — 별도 spec(`secret-store.md`) 결정 사항, 이번 diff 미포함

이상은 전부 이번 changeset 이 스스로 CHANGELOG/spec/트래커에 명시적으로 등재한 범위 밖
항목이며, 새로 발견된 결함이 아니라 이미 알려진 상태로 확인했다.

## 요약

이번 changeset 은 신규 취약점을 도입하지 않는다. 오히려 기존 CWE-209(정보노출) 계열
결함 — 종결 이벤트 경로만 마스킹되고 내부 REST/WS 읽기 경로 4표면 + 형제 필드
(`nodeExecutions[].error`)는 원문 그대로 나가던 비대칭 — 을 닫는 방어적 보안 수정이다.
인가 로직(IDOR 가드·RBAC·e2e 백도어 이중 게이트)은 리팩터(`stop`/`stopInternal` 분리,
`toResponseExecution` 관문 도입) 과정에서 변경·훼손되지 않았음을 소스 레벨에서 직접
확인했다. 값-패턴 마스킹에 쓰이는 정규식은 ReDoS 표면이 없는 선형 패턴이고, DB 원문은
egress-only 원칙에 따라 보존되며, 입력 비변이·null 정규화·레거시 타입 통과가 테스트로
고정돼 있다. 새 외부 의존성 없음. 잔여 갭(WS node emit·inputData/outputData·assistant
도구·`triggerToken` 평문)은 전부 이번 diff 가 스스로 범위 밖으로 명시하고 트래커에 등재한
항목이며 이번 리뷰에서 새로 지적할 사항이 아니다.

## 위험도

NONE
