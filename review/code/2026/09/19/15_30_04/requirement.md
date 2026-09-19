# 요구사항(Requirement) 리뷰 — Database · HTTP 연결 테스터

## 컨텍스트

대상 spec: `spec/2-navigation/4-integration.md` §5.3(HTTP/REST) · §5.4(Database) · §9.2(`preview-test`) ·
§9.4(공통 응답 포맷) · §14.1(에러 코드 vocabulary) · `## Rationale`("연결 테스트 — Database · HTTP 는 실제로
접속한다", 2026-09-19). 구현 plan `plan/in-progress/integration-db-http-testers.md`. 이미 두 라운드의
`consistency-check`(`review/consistency/2026/09/19/13_03_41`, `13_21_00`)와 세 라운드의 `/ai-review`
(`13_58_22`, `14_29_33`, `15_02_57`)가 이 변경을 검토했고, 그 발견사항 다수가 이번 diff 에 반영·트래커
등재돼 있다. 본 리뷰는 그 위에서 요구사항 충족·spec fidelity 만 재검증한다(중복 발견은 재기재하지 않고
위치만 표기).

## 발견사항

- **[INFO]** 저장소 워킹트리가 리뷰 도중 라이브로 변경됨(내가 만든 변경 아님) — 보고 의무에 따라 명시
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 메서드,
    `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 같은 테스트
  - 상세: 리뷰 시작 시 `sed -n`으로 읽은 `rotate()`는 프롬프트 diff와 동일하게 `Object.assign(entity, changes)` +
    `updatedAt: now`(명시값)로 응답을 만들었다. 그런데 리뷰 종료 무렵 `git status --short`를 다시 실행하니 같은
    파일이 `M`(수정)으로 나타났고, `git diff`로 보니 `rotate()`가 이미 "부분 save 값을 메모리에 반영" 방식에서
    "저장 뒤 `findOne`으로 다시 읽어 응답을 만드는" 방식으로 바뀌어 있었다(주석: "DB 가 정한 updatedAt 과... e2e
    실측 1ms" — 아마 다른 세션이 `updatedAt` 정밀도 불일치를 실측 후 실시간으로 고치는 중). 이 변경은 내가
    `Write`/`Edit`을 쓴 적이 없으므로 내가 만든 것이 아니다 — 병렬 세션이 같은 워킹트리를 동시에 쓰고 있다는
    신호다. 이 리뷰의 판정 대상은 **프롬프트에 주어진 diff**(= 커밋된 스냅샷)이므로 아래 모든 발견사항은 그
    스냅샷 기준이며, 라이브 트리의 후속 수정은 검증하지 않았다(이미 스냅샷보다 앞서 있을 수 있다).
  - 제안: 다음 라운드가 이 파일을 다시 볼 때 stale 판정하지 않도록, 이 알림을 SUMMARY 취합자가 인지할 것. 나는
    이 파일에 아무것도 쓰지 않았다(`git status`는 조회만, mutation 없음).

- **[SPEC-DRIFT]** Database 연결 테스트의 "연결 대기 10초" 서술이 실제 2단계(연결+쿼리 각 10초) 타임아웃을
  가리지 않는다
  - 위치: `spec/2-navigation/4-integration.md` §5.4, "테스트: ... 연결 대기는 10초." 문장(§5.4 본문, `SELECT 1`
    설명 바로 다음 문장)
  - 상세: 구현(`codebase/backend/src/modules/integrations/database-connection-tester.ts`)은
    `connectionTimeoutMillis: DB_TEST_TIMEOUT_MS`(연결)와 `query_timeout: DB_TEST_TIMEOUT_MS`(PG) /
    `timeout: DB_TEST_TIMEOUT_MS`(mysql2 쿼리)를 **각각 독립적으로** 10초씩 건다 — worst-case 총 대기는 약
    20초(+ close grace 1초)다. 이 설계는 의도적이고 정확히 문서화돼 있다 — `CHANGELOG.md`("연결 · 쿼리 각
    10초"), 두 사용자 가이드 mdx(`integration-management.mdx`: "각각 최대 10초", `.en.mdx`: "waits up to 10
    seconds **each** for the connection and for `SELECT 1`"), 유닛 테스트 제목("10초 대기(연결 · 쿼리)")이 모두
    "각각"을 명시한다. 그런데 spec 본문 §5.4 의 단일 문장 "연결 대기는 10초"는 쿼리 단계의 별도 10초 예산을
    언급하지 않아, HTTP §5.3 의 "대기는 10초"(리다이렉트 체인 전체를 포�함한 **단일** 10초 예산, `AbortSignal`
    하나로 구현)와 대칭인 것처럼 오독될 수 있다. 코드·CHANGELOG·가이드 셋이 일치하고 spec 문장만 그 뉘앙스를
    빠뜨린 전형적인 spec-drift 형태다.
  - 제안: 코드는 유지. `spec/2-navigation/4-integration.md` §5.4 의 "연결 대기는 10초"를 "연결·쿼리 대기는 각각
    10초(합쳐 최대 20초)"로 갱신해 HTTP §5.3(전체 10초 단일 예산)과의 비대칭을 명시한다.

- **[WARNING]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 spec(422)과 구현(400)에서 어긋난 채로, 이번
  PR 이 그 경로를 처음 실사용으로 굳힌다 — 이미 트래커에 있으나 재확인 차 기재
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` —
    `throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', ... })` vs
    `spec/2-navigation/4-integration.md` §9.4 "`INTEGRATION_TEST_FAILED` (422)"
  - 상세: 이미 `--impl-prep`(`review/consistency/2026/09/19/13_21_00` WARNING #1)과
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-19 등재 항목, `spec/5-system/
    11-mcp-client.md`는 400 을 실측 서술, `spec/5-system/2-api-convention.md §6` 일반 원칙은 422 지지)에서
    삼각 불일치로 투명하게 등재돼 있고, e2e(`integration-connection-test.e2e-spec.ts` D)도 의도적으로 상태
    코드를 단언하지 않는다. 새 결함은 아니지만, Database·HTTP 에 실제 연결 테스트가 붙으면서 이 경로(rotate 의
    자격증명 거부)가 실무에서 훨씬 자주 트리거되게 된다 — 결정을 미룰수록 400 이 e2e·클라이언트 코드에 더 깊이
    고정된다.
  - 제안: 코드 수정 불요(이미 트래커가 추적). spec 반영 시점에 400/422 중 하나로 통일하고 세 문서를 동시 갱신할
    것(이미 tracker item 에 반영된 계획).

- **[INFO]** HTTP §5.3 이 선언한 `auth_type=none`·`default_headers` 입력 UI 가 서비스 레지스트리에 없음 —
  이미 트래커에 있음
  - 위치: `spec/2-navigation/4-integration.md` §5.3 필드 표 "auth_type을 none / api_key / bearer / basic 중
    선택" vs `codebase/backend/src/modules/integrations/services/service-registry.ts`(`type: 'http'`)
    `authVariants` — `api_key`/`bearer_token`/`basic` 셋뿐, `none` 없음
  - 상세: `resolveHttpCredentials`(`http-credentials.ts`)도 `none`을 처리하지 않아(스위치 default 는
    `INTEGRATION_AUTH_UNSUPPORTED`), `serviceType:'http', authType:'none'` 조합은 `validateCredentials`
    단계에서 "Unknown service/auth combination"으로 걸러져 테스터에 도달조차 못한다. 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-19 등재, "§5.3 HTTP 필드 표의
    `none` 인증 · `default_headers` 가 서비스 레지스트리 `http` 항목에 없다")에 등재된 기존 갭이며 이번 PR 이
    새로 만든 문제는 아니다.
  - 제안: 조치 불요(트래커 추적 중). 참고용 재확인.

## 정합성 확인 (문제 없음 — 실측)

- **HTTP §5.3 결과 매핑**: 2xx/Location-없는 3xx→success, 401·403→`HTTP_AUTH_FAILED`, 그 밖 4xx→success+안내,
  5xx→`HTTP_SERVER_ERROR`, SSRF·5홉 초과→`HTTP_BLOCKED`, 전송 실패→`HTTP_CONNECT_FAILED` — 전부
  `http-connection-tester.ts`의 `classify()`/`blocked()`/catch 분기와 line-level 일치. 대응 유닛 테스트
  (`http-connection-tester.spec.ts`, 26개 케이스: 401/403·404/405/400·500/503·리다이렉트 추종/초과/대상
  차단·타임아웃·잘못된 URL·`none` 처리 등)가 각 분기를 실제로 구동한다.
- **Database §5.4 결과 매핑**: `DB_HOST_BLOCKED`(SSRF)·`DB_AUTH_FAILED`(PG class 28, MySQL
  `ER_ACCESS_DENIED_ERROR`/`ER_DBACCESS_DENIED_ERROR`)·`DB_CONNECT_FAILED`(그 밖) 이
  `database-connection-tester.ts`와 정확히 일치. 연결을 반드시 닫는 동작(`closeWithin`, 응답 없는 서버 대비
  소켓 파괴 fallback)까지 유닛 테스트가 fake timer 로 검증한다.
- **공유 로직 재사용**: `appendQueryParams`/`resolveHttpCredentials`(HTTP), `buildPgConnection`/
  `buildMysqlSsl`/`DB_HOST_BLOCKED_MESSAGE`(DB), `followRedirectsSafely`/`MAX_REDIRECT_HOPS`,
  `SSRF_BLOCKED_CLIENT_MESSAGE` 가 노드 핸들러(`http-request.handler.ts`, `database-query.handler.ts`)와
  실제로 같은 모듈을 import 해서 쓴다 — "테스트 통과가 실행 성공을 뜻한다"는 plan 의 설계 의도가 코드에 그대로
  구현돼 있다. `http-request.handler.ts`의 리다이렉트 추종 리팩터도 원래의 `authentication==='integration'`
  게이트·5홉 상한을 그대로 보존한다(회귀 테스트 `toHaveBeenCalledTimes(6)`로 off-by-one 방지).
- **동시 상한**: `dispatchTest`·`testConnection`(entity tester 경로) 모두 `connectionTestLimit`
  (`pLimit(CONNECTION_TEST_MAX_CONCURRENCY=2)`)을 거친다 — CHANGELOG 의 "MCP·Email·Database·HTTP(저장된
  Cafe24·MakeShop 테스트 포함) 2개까지" 서술과 일치.
- **rotate 검증 순서**: 구조 검증(`validateCredentials`) → 연결 테스트(`dispatchTest`) → 실패 시
  `BadRequestException`(저장 안 함) → 성공 시 바뀌는 컬럼만 `save`하고 `updatedAt`을 명시 — "틀린 값으로의
  교체를 막지 못했다"는 CHANGELOG 의 버그 서술을 정확히 겨냥해 고친다. e2e(`integration-connection-test.
  e2e-spec.ts` D/E)가 회전 거부 시 DB 무변경, 성공 시 암호문 변경·시각 갱신을 확인한다.
- **DTO 계약**: `PreviewTestResultDto.code?: string` 신설 + `assertMatchesContract(result,
  contractForDto(PreviewTestResultDto))` 배선(`integrations.service.spec.ts`)으로
  `spec-draft-nullable-notation-followups.md` L3592 트래커 항목이 실제로 닫혔다(뮤턴트로 선언 제거 시 RED
  확인은 plan 문서에 기록됨).
- TODO/FIXME/HACK/XXX 주석 없음(신규 파일 전수 grep 0건).

## 요약

CHANGELOG 가 서술하는 핵심 버그(Database·HTTP 연결 테스트가 필드 구조만 보고 실제 접속하지 않아 틀린
비밀번호·만료 토큰도 통과했고, 같은 결과를 쓰는 rotate 도 틀린 값 교체를 막지 못함)는 새 테스터
(`database-connection-tester.ts`, `http-connection-tester.ts`)와 `dispatchTest`/`rotate` 배선으로 spec
§5.3·§5.4·§9.2·§9.4·§14.1 과 line-level 로 일치하게 구현됐다. 결과 코드 매핑·SSRF 가드 공유·리다이렉트 추종·
동시 상한·연결 반드시 닫기 등 요구사항 전반이 유닛(26+21개 케이스)·e2e(5개 시나리오)로 실제 분기를 구동해
검증된다. 반환값 누락이나 미완성 TODO 는 없다. 새로 찾은 것은 spec §5.4 의 "연결 대기 10초" 문장이 실제
"연결·쿼리 각 10초(최대 20초)" 구현·CHANGELOG·가이드와 어긋나는 SPEC-DRIFT 뿐이며(코드는 CHANGELOG/가이드와
일치하므로 코드 fix 대상 아님), 나머지 발견은 이미 이전 라운드 리뷰·트래커가 투명하게 추적 중인 항목의
재확인(`INTEGRATION_TEST_FAILED` 400/422, HTTP `none` auth 갭)이다. 리뷰 도중 워킹트리가 라이브로(내
조작이 아닌 병렬 세션에 의해) 추가 변경된 것을 관측해 위에 명시했다 — 이 리뷰의 판정은 프롬프트에 주어진
diff 스냅샷을 대상으로 한다.

## 위험도

LOW — CRITICAL 없음. 핵심 요구사항은 spec·CHANGELOG·테스트와 정합하며, 남은 항목은 문서 정밀도(SPEC-DRIFT
1건)와 기존에 트래킹 중인 spec 불일치(WARNING 1건, 이미 등재)뿐이다.
