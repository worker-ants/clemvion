# 부작용(Side Effect) 리뷰 — integration-testers-5c2d91

## 발견사항

- **[WARNING]** 리뷰 대상 파일이 이 리뷰 세션 도중 커밋 없이 계속 편집되고 있다 — 프롬프트의 diff 는 이미 스테일
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (특히 `rotate()` 메서드), `codebase/backend/src/modules/integrations/integrations.service.spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: `git status --short` 에 위 세 파일이 `M`(uncommitted) 으로 떠 있다. 프롬프트 번들(`_prompts/side_effect.md`, mtime 15:30:04)은 커밋 `6bf7c026d` 기준 diff 를 실었는데, `integrations.service.spec.ts` 는 15:34:39, `integrations.service.ts` 는 15:34:58, `spec-draft-nullable-notation-followups.md` 는 15:31:46 에 각각 수정됐다(전부 프롬프트 생성 시각보다 뒤, 현재 시각 15:36 기준 1~5분 전) — 즉 지금 이 순간에도 누군가(리뷰 대상 세션 자신으로 추정, 리뷰 fan-out 규약상 다른 reviewer 는 저장소를 쓰지 않기로 돼 있다) 이 파일을 계속 고치고 있다. 실제로 디스크의 `rotate()` 는 프롬프트가 보여준 `Object.assign(entity, changes); return this.toPublic(entity);` 방식이 아니라, 저장 뒤 `integrationRepository.findOne` 으로 행을 재조회해 그 값을 응답·audit log·broadcast 에 쓰는 방식으로 이미 바뀌어 있다(직접 `Read`/`git diff` 로 확인). 즉 지금 이 리포트가 인용하는 프롬프트 상의 `rotate()` 관련 줄 번호·코드는 현재 파일 내용과 더 이상 일치하지 않는다.
  - 이 세션(리뷰어)이 이 상태를 만들지 않았음: 나는 `Read`/`Bash`(읽기 전용: `cat`, `grep`, `git diff`, `git status`, `stat`) 만 사용했고 `git status --short` 는 세션 시작 전후로 동일한 4개 파일만 가리킨다.
  - 제안: 이 라운드의 code-review fan-out 을 이 편집이 끝나고 커밋된 뒤 다시 돌릴 것. 지금 통합되는 SUMMARY 는 `rotate()` 에 대해 이미 낡은 스냅샷을 근거로 판정하게 되므로, 해당 부분 판정은 재검증 전까지 잠정으로 취급해야 한다.

- **[INFO]** `previewTest`/`testConnection`/`rotate` 가 database·http 서비스에 대해 처음으로 실제 아웃바운드 I/O 를 수행한다 — 의도된 핵심 변경이며 문서화·추적됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `dispatchTest()`(약 1533~1552행) · `codebase/backend/src/modules/integrations/database-connection-tester.ts` `testDatabaseConnection` · `codebase/backend/src/modules/integrations/http-connection-tester.ts` `testHttpConnection`
  - 상세: 종전엔 `database`/`http` service_type 이 `transportTesters` 에 없어 구조 검증만 통과하면 항상 `{success:true}` 였다. 이제 실제 TCP 연결(Postgres/MySQL)과 `fetch` GET(최대 5홉 리다이렉트 추종)이 일어난다. 이는 이 PR 의 목적 그 자체이고 `CHANGELOG.md`·`spec/2-navigation/4-integration.md`·가이드 mdx 두 언어판에 전부 반영돼 있어 "의도치 않은" 부작용은 아니다. 다만 `preview-test`(저장 전, 워크스페이스/역할 검사 없음, 분당 20회 throttle 만)가 인증된 사용자에게 임의 host 로의 제한적 네트워크 프로브 오라클이 된다는 점은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-19 등재, `/ai-review 13_58_22` security WARNING)에 별도 항목으로 추적 중이라 재-flag 하지 않는다.
  - 제안: 없음(이미 추적됨). 참고로만 남김.

- **[INFO]** 연결 테스트 동시 상한(`pLimit(2)`)이 프로세스 전역 싱글턴 큐 — 테넌트 구분 없이 공유
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:410` 부근 `private readonly connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY)`
  - 상세: `IntegrationsService` 는 기본(싱글턴) 스코프라 `connectionTestLimit` 은 프로세스에 하나뿐이고, `previewTest`·`testConnection`(entity tester 경로 포함)·`rotate` 를 부르는 모든 워크스페이스가 이 큐 하나를 공유한다. 코드 주석(114~127행)이 이 설계를 명시적으로 근거와 함께 설명하고 있고, "상한 뒤 줄에 길이 제한이 없어 한 사용자가 연결 테스트 기능 자체를 느리게 만들 수 있다"는 잔여 위험도 `spec-draft-nullable-notation-followups.md` 에 이미 developer 후속 항목으로 등재돼 있다. 새로 발견한 결함이 아니라 설계상 알려진 트레이드오프.
  - 제안: 없음(이미 추적됨).

- **[INFO]** 순수 헬퍼 함수·상수 추출 리팩터는 시그니처 하위호환 — 외부 호출자 영향 없음
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-connection.ts`(신규, `DbCredentials`·`buildPgConnection`·`buildMysqlSsl`·`DB_HOST_BLOCKED_MESSAGE`), `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`(신규, `resolveHttpCredentials`·`appendQueryParams`), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts`(신규, `followRedirectsSafely`·`outboundBlockReason`·`discardBody`), `codebase/backend/src/modules/integrations/clamp-message.ts`(신규), `http-safety.ts` 의 `SSRF_BLOCKED_CLIENT_MESSAGE` 신규 export
  - 상세: 이들은 모두 이전엔 `database-query.handler.ts`/`http-request.handler.ts`/`integrations.service.ts` 안의 **모듈-비공개**(non-exported) 함수·상수였다 — 외부에서 import 할 수 없었으므로 위치 이동 자체가 하위호환을 깨지 않는다. 같은 diff 안에서 세 호출부(`database-query.handler.ts`, `http-request.handler.ts`, `integrations.service.ts`)가 모두 새 import 로 갱신돼 있음을 확인했다(순환 import 회피 목적이 설계 문서·주석에 명시돼 있고 실제로 두 노드 핸들러 쪽에서 `IntegrationsService` 를 import 하는 반대 방향 의존을 만들지 않았다).
  - 제안: 없음.

- **[INFO]** `PreviewTestResultDto.code?: string` 추가 — 애디티브, 하위호환
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`PreviewTestResultDto`)
  - 상세: 선택적 필드 추가라 기존 클라이언트(구버전 프런트)는 그냥 무시한다. 프런트가 아직 이 값을 화면에 반영하지 않는 점은 이미 UX 갭으로 별도 트래킹돼 있다(`spec-draft-nullable-notation-followups.md` "연결 테스트의 «확인 못 함» 안내가 화면에 닿지 않는다").
  - 제안: 없음.

- **[INFO]** 테스트 위생 — fetch/timer 모킹이 각 spec 에서 정확히 복원됨(부작용 누수 없음)
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.spec.ts`(`fetchMock = jest.spyOn(globalThis, 'fetch')` → `afterEach` 에서 `fetchMock.mockRestore()`), `codebase/backend/src/modules/integrations/database-connection-tester.spec.ts`(`jest.useFakeTimers()` 사용처 두 곳 모두 `try/finally` 로 `jest.useRealTimers()` 보장), `codebase/backend/src/modules/integrations/integrations.service.spec.ts`(신규 동시성 테스트가 `finally` 에서 `mockedDbTester.mockReset()` + 기본 성공값 재설정)
  - 상세: 전역 `fetch`/타이머를 건드리는 테스트가 실패 시에도 다음 테스트로 상태를 흘리지 않도록 되어 있다. `database-connection-tester.spec.ts`·`http-connection-tester.spec.ts` 는 `pg`/`mysql2`/`http-safety` 를 전부 모킹해 실제 아웃바운드 호출이 unit 레벨에서 일어나지 않음을 확인했다. `integration-connection-test.e2e-spec.ts` 의 신규 케이스(A~E)도 사설 host(`postgres` 서비스)·loopback(`127.0.0.1`) 을 겨냥해 SSRF 가드에 막히므로 실제 외부 네트워크 의존을 새로 만들지 않는다.
  - 제안: 없음 — 참고용 확인.

## 요약

이번 변경의 핵심 부작용은 "database·http 통합의 연결 테스트가 실제로 접속한다"는 것 자체인데, 이는 스펙·CHANGELOG·가이드 문서에 명시적으로 기술된 **의도된** 부작용이고, 남는 위험(오라클 노출, 전역 동시 상한 공유, dns.lookup 스레드풀 점유)은 모두 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 개별 항목으로 등재돼 있어 재-flag 하지 않았다. 헬퍼 추출·DTO 필드 추가는 전부 하위호환이고, 테스트의 전역 mock(fetch/timer) 복원도 깔끔하다. 가장 중요하게 보고할 점은 코드 결함이 아니라 **리뷰 프로세스 자체의 이상 상태**다 — `integrations.service.ts`/`integrations.service.spec.ts`/`spec-draft-nullable-notation-followups.md` 가 이 리뷰 프롬프트 생성(15:30:04) 이후에도 커밋 없이 계속 수정되고 있어(최신 mtime 15:34~15:35, 현재 15:36), 이 리포트가 참조한 `rotate()` diff 는 이미 디스크 상태와 어긋난다. 이 발견 자체는 내가 만든 게 아니며(읽기 전용 도구만 사용, `git status` 로 확인), 통합 SUMMARY 는 이 사실을 반영해 `rotate()` 관련 판정을 재검증 대상으로 표시해야 한다.

## 위험도
LOW

(코드 자체의 부작용 위험은 낮음 — 유일한 실질 이슈는 리뷰 대상의 stale/in-flight 편집이라는 프로세스 이슈이며, 이는 코드 결함이 아니라 재검증 필요 신호다.)
