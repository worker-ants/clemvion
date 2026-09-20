# 부작용(Side Effect) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (3라운드 · 머지 후 확인)

## 검증 방법

- 프롬프트 diff 로 제시된 10개 코드 파일(1~10번) 전부를 `Read` 로 현재 워킹트리에서 직접 열어 게이트 줄 번호와 대조.
- 1라운드(`review/code/2026/09/20/09_35_16`)·2라운드(`review/code/2026/09/20/10_09_56`) 의 side_effect.md 와 RESOLUTION.md 를 읽고, 그 두 라운드가 낸 WARNING(타임아웃 예산 잠식·리다이렉트 홉 미마스킹 등)이 이번 diff 에 실제로 반영돼 있는지 소스 대조로 재확인.
- `outboundBlockReason` 의 전체 소비자를 `grep -rn "outboundBlockReason"` 으로 재확인(2곳: `http-redirect.ts` 내부 `followRedirectsSafely`, `http-connection-tester.ts`) — 새 throw 계약이 두 소비자 모두에서 처리되는지 추적.
- `database-connection-tester.ts` 가 새로 추가한 `sanitizeMessage` import(`../../nodes/integration/_base/integration-handler-base`)가 만드는 모듈 의존 그래프를 추적해 순환 참조 여부를 확인하고, `typescript` API(`transpileModule`)로 `integration-handler-base.ts` 를 실제로 컴파일해 해당 import 가 런타임에 살아남는지 직접 검증.
- 이 세션은 저장소 파일을 쓰지 않았다 — `git status --short` 로 확인(이 리뷰 세션 자체의 출력 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `database-connection-tester.ts` 가 처음으로 `nodes/integration/_base/integration-handler-base.ts` 에서 `sanitizeMessage` 를 import 하면서, `integrations.service.ts → database-connection-tester.ts → integration-handler-base.ts → integrations.service.ts` 형태의 모듈 순환 참조가 새로 생긴다 — 단, 실측으로 무해함을 확인
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (신규 import 문, 파일 상단) / `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:2`(`import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';`, 이 diff 가 건드리지 않은 기존 줄)
  - 상세: `integrations.service.ts` 는 기존부터 `import { testDatabaseConnection } from './database-connection-tester';` 로 이 파일을 가져온다. 이번 diff 는 `database-connection-tester.ts` 에 `import { sanitizeMessage } from '../../nodes/integration/_base/integration-handler-base';` 를 새로 추가하는데, 그 대상 파일은 (diff 밖의 기존 코드로) `IntegrationsService`·`Integration` 를 타입 위치(생성자 파라미터 프로퍼티 타입)로만 참조한다 — 값으로 쓰인 곳은 없다(`grep -n "IntegrationsService" integration-handler-base.ts` 결과 1건, 타입 주석). `codebase/backend` 는 `isolatedModules: true` 지만 `verbatimModuleSyntax` 는 켜져 있지 않아, 타입 전용 import 는 파일별 사용처 분석만으로 컴파일 시 제거된다 — `typescript` 의 `transpileModule` 로 `integration-handler-base.ts` 를 직접 트랜스파일해 확인한 결과, 컴파일된 JS 에는 `@nestjs/common` 의 `Logger` 만 `require` 되고 `integrations.service.js`/`Integration` 관련 `require` 는 전혀 나타나지 않는다 — 즉 **런타임에는 순환 require 가 존재하지 않는다**. 클래스 데코레이터(`@Injectable()` 등)도 이 파일의 `IntegrationHandlerBase` 에는 없어 `emitDecoratorMetadata` 로 인한 강제 값-import 도 발생하지 않는다. `modules/integrations/` 하위에서 `_base/integration-handler-base` 를 import 하는 파일은 이번 diff 로 생긴 `database-connection-tester.ts` 가 유일하다(`grep -rl` 확인) — 즉 이 엣지 자체는 새로운 것이지만, 타입 레벨 순환일 뿐 실행 시점 부작용은 관측되지 않는다.
  - 제안: 조치 불요(실측 결과 무해). 다만 이 파일이 `modules/integrations/` → `nodes/integration/_base/` 로 향하는 첫 실제 값-import(`sanitizeMessage` 는 함수 값이라 런타임에 남는다) 라는 점은 두 계층 사이 경계가 점점 얇아지고 있다는 신호이므로, 다음에 `integration-handler-base.ts` 가 `IntegrationsService` 를 값으로도 쓰게 바뀌면(예: 데코레이터 추가) 이 경로가 실제 순환으로 바뀔 수 있다는 것만 기록해 둔다.

- **[정보 확인 — 새 결함 아님]** 1라운드·2라운드가 지적한 두 부작용 WARNING 이 현재 코드에 모두 반영돼 있음을 직접 대조
  - `http-connection-tester.ts:118-130` — preflight(`outboundBlockReason`)와 `AbortSignal.timeout` 생성이 모두 `try` 안으로, 그리고 타임아웃 신호 생성이 preflight **뒤**로 옮겨져 있다(1라운드 WARNING "가드 DNS 조회 시간이 10초 전송 예산을 잠식" 수정 확인, 커밋 `e8d810405`). 회귀 테스트(`http-connection-tester.spec.ts:246-259`)가 `try`/`finally` 로 `AbortSignal.timeout` 스파이를 복구해, 단언 실패 시에도 스파이가 다음 테스트로 새지 않는다(2라운드 WARNING "스파이 복구가 마지막 줄에만" 수정 확인, 커밋 `fff0d14bf`).
  - `http-request.handler.ts:556-560` — 리다이렉트 **홉** 중 `outboundBlockReason` 이 던진 비판정 오류가 일반 `catch` 의 `HTTP_TRANSPORT_FAILED` 분기로 떨어질 때 `err instanceof Error ? err.message : String(err)`(원문 그대로) 대신 `toLogError(err).message`(마스킹)를 쓰도록 바뀌어 있다 — 2라운드 WARNING("같은 가드 고장 사건이 검사 시점에 따라 마스킹 여부가 갈린다") 수정 확인, 커밋 `fff0d14bf`.
  - `http-redirect.spec.ts:11-15` — 두 가드(`assertSafeOutboundUrl`·`assertSafeOutboundHostResolved`) 모두 `jest.fn()` 으로 대체되고 `beforeEach` 에서 `mockedHostGuard.mockResolvedValue(undefined)` 를 설정해, 1라운드 WARNING("신설 spec 이 실제 DNS 조회를 수행")이 해소돼 있다.
  - 세 곳 모두 실제 소스를 열어 확인했고, 새로 재발한 흔적은 없다.

## 확인했으나 이상 없음 (부작용 관점)

- `outboundBlockReason` 의 throw 계약 변경(판정 아닌 오류를 삼키지 않고 던짐)은 시그니처(`Promise<string | null>`) 자체는 그대로지만 암묵적 동작 계약을 바꾼다 — 저장소 전체에서 이 함수의 비-테스트 소비자는 `followRedirectsSafely`(내부)와 `http-connection-tester.ts` 둘뿐이며, 둘 다 이번 diff 에서 함께 갱신되어 새로 던져진 예외를 각자의 `try`/`catch` 로 흡수한다. 누락된 소비자는 없다.
- 네 소비자(`http-request.handler.ts`·`database-query.handler.ts`·`database-connection-tester.ts`·`http-connection-tester.ts`)에 새로 추가된 `if (!(err instanceof SsrfBlockedError))` 분기는 모두 그 함수가 이미 갖고 있던 단일 `logUsage`/응답-반환 지점을 재사용한다 — 이중 로깅·이중 응답·중복 이벤트 발행은 없다.
- `logger.warn` 신규 호출(`SSRF guard failed (...)​`)은 기존에도 SSRF 차단 시 `logger.warn`을 호출하던 자리를 판정/비판정 두 갈래로 나눈 것뿐이라, 로그 부작용의 양(호출 횟수)이 늘지 않는다 — 메시지 문구만 갈린다.
- 전역 변수·환경 변수 읽기/쓰기는 이번 diff 로 추가/변경되지 않았다(`ALLOW_PRIVATE_HOST_TARGETS` 등 기존 참조 그대로, grep 재확인).
- `SsrfBlockedError`·`INTEGRATION_CALL_FAILED`·`DB_CONNECT_FAILED`·`HTTP_CONNECT_FAILED` 는 모두 이 PR 이전부터 있던 기존 값/클래스이고, 새 공개 enum 멤버나 새 wire 계약을 도입하지 않는다 — 프런트엔드 등 이 코드베이스 밖 소비자에 인터페이스 파급 없음.
- `testDatabaseConnection`·`testHttpConnection`·`DatabaseQueryHandler.execute`·`HttpRequestHandler.execute` 의 공개 시그니처(파라미터·반환 타입)는 변경되지 않았다 — catch 내부 분류 로직만 바뀌었다.
- 새로 추가/이동된 네트워크 호출은 없다. `AbortSignal.timeout` 생성 시점 이동은 fetch 자체를 새로 만들지 않고 기존 신호 생성 위치만 옮긴 것이다.
- `plan/**`·`review/**` 하위에 추가된 markdown/json 파일들(11~44번)은 이 프로젝트 컨벤션이 요구하는 리뷰/플랜 산출물이며 프로덕션 런타임과 무관한 저장소 문서 파일이다 — 예상치 못한 파일시스템 부작용이 아니다.

## 뮤테이션/재현 관련

이번 세션은 저장소 파일에 쓰기를 하지 않았다(`Read`/`Bash`(grep) 만 사용, `typescript` 트랜스파일 검증도 메모리 내 문자열만 생성). `git status --short` 결과 `review/code/2026/09/20/10_38_57/`(이 리뷰 세션 자체의 산출 디렉터리) 외 변경 없음을 확인했다.

## 요약

핵심 변경(SSRF 가드 네 소비자의 catch 를 `instanceof SsrfBlockedError` 로 갈라 판정과 가드 고장을 분리)은 부작용 관점에서 안전하게 배선돼 있다 — 로깅·usage 기록·응답 반환이 모두 기존 단일 지점으로 흡수되고, 재사용하는 에러 코드도 기존 값이라 인터페이스 파급이 없으며, 시그니처 변경도 없다. 1·2라운드 리뷰가 지적했던 두 실질 부작용(연결-테스트 타임아웃 예산 잠식, 리다이렉트 홉 가드-고장 메시지 미마스킹)은 이번 merge 시점 코드에 모두 반영돼 있음을 소스 대조로 재확인했다. 이번 라운드에서 새로 발견한 것은 `database-connection-tester.ts` 가 `nodes/integration/_base/integration-handler-base.ts` 를 처음 import 하며 만드는 모듈 순환 참조 하나뿐인데, 실제 컴파일 결과를 트랜스파일해 확인한 결과 타입 전용 참조라 런타임에는 아무 영향이 없다(INFO). 새 CRITICAL/WARNING 은 없다.

## 위험도

LOW
