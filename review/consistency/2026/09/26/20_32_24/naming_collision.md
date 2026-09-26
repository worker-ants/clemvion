# 신규 식별자 충돌 검토 — `integration-test-contract`

## 검토 대상

- 검토 모드: `--impl-prep` (scope=`spec/2-navigation/`)
- 실질 target: `plan/in-progress/integration-test-contract.md` — `POST /api/integrations/:id/test`
  응답 계약에 MCP 전용 필드 3종(`capabilities` · `serverInfo` · `preview`)을 `TestConnectionResultDto`
  에 선언하고, 서비스 축·와이어 축 계약 검증을 배선하는 구현 plan.
- spec 변경 없음(`spec_impact: none`) — plan 이 스스로 밝히듯 `spec/2-navigation/4-integration.md` §5.6,
  `spec/5-system/11-mcp-client.md` §9 는 이미 이 필드 셋을 문서화하고 있고 낡은 쪽은 DTO 였다(실측 근거는
  plan 본문에 있음, `git blame` 대상 아님).

## 발견사항

이 plan 이 실제로 새로 만드는 식별자는 딱 두 종류다 — ① 기존 DTO(`TestConnectionResultDto`)에 추가할
필드 3개, ② 새 테스트 파일 하나(`integrations.controller.wire.spec.ts`). 나머지(엔드포인트·DTO 클래스명·
서비스 메서드명)는 전부 기존 식별자를 그대로 재사용한다. 각각을 기존 사용처와 대조했다.

- **`capabilities?` / `serverInfo?` / `preview?` 필드 추가 대상: `TestConnectionResultDto`**
  (`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:470`) —
  같은 파일의 형제 DTO `PreviewTestResultDto`(`:246`)가 **이미 동일 이름·동일 타입**으로 이 세 필드를
  선언하고 있다(`capabilities?: Record<string, unknown>`, `serverInfo?: { name; version }`,
  `preview?: McpConnectionPreviewDto`). plan 은 "선언은 `PreviewTestResultDto` 와 **같게** 한다"고 명시하므로
  이는 충돌이 아니라 **의도된 미러링**이다. `capabilities` 필드명을 이 DTO 파일 밖에서 grep 했을 때도
  다른 의미의 재사용은 없었다(`integration-response.dto.ts` 단일 출처).

- **새 파일 `integrations.controller.wire.spec.ts`** — 동일 경로에 파일 목록을 전수 확인한 결과
  이 이름과 겹치는 기존 파일은 없다. 다만 같은 디렉터리에 `integrations.controller.owner.spec.ts`
  라는 `<controller>.<qualifier>.spec.ts` 접미사 패턴이 이미 있어, 새 파일명은 그 로컬 컨벤션에
  **부합**한다. 단, plan 이 "자매 패턴을 따른다"고 지목한 실제 자매 파일
  `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` 를 열어보면, 그 파일은
  별도 파일을 새로 만든 것이 아니라 **같은 파일 안에** `describe('POST /model-configs/:id/test —
  와이어 계약 (HTTP)', …)` 블록을 추가하는 방식이었다(`:153`). 즉 "자매 패턴" 이 가리키는 실물은
  "새 파일" 이 아니라 "같은 파일 내 새 describe" 다.
  - 등급: **INFO** (식별자 충돌은 아님 — 파일명 자체는 유일하고 로컬 `owner` 접미사 컨벤션과도 정합)
  - target 신규 식별자: `integrations.controller.wire.spec.ts` (신규 파일)
  - 기존 사용처: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:153`
    (같은 파일 내 `describe` 블록으로 와이어 계약을 얹는 실제 선례)
  - 상세: 파일 경로 충돌은 없지만, plan 이 근거로 인용한 "자매 패턴" 텍스트와 실제 구현 형태(별도 파일
    vs 같은 파일 내 블록)가 어긋난다. 구현자가 그대로 새 파일을 만들면 이 모듈에 컨트롤러 spec 이
    `owner` / `wire` 두 개로 쪼개져, 향후 세 번째 시나리오가 추가될 때 "새 접미사 파일" 과 "본체
    `integrations.controller.spec.ts` 부재" 조합이 반복될 소지가 있다(현재 이 모듈에는 접미사 없는
    기본 `integrations.controller.spec.ts` 자체가 없다).
  - 제안: 구현 시점에 두 선택지 중 하나를 의식적으로 고르면 된다 — (a) plan 그대로 별도 파일 유지
    (모듈 내 `owner` 선례와 일관), 또는 (b) 실제 자매 파일처럼 기존 컨트롤러 spec에 describe 블록 추가.
    이름 충돌 자체는 없으므로 구현 착수를 막을 사유는 아니다.

- **엔드포인트 `POST /api/integrations/:id/test`, 서비스 메서드 `testMcpTransport` /
  `IntegrationsService.testMcpTransport`, 타입 `IntegrationTestResult` / `IntegrationTestResultCode`,
  `McpConnectionPreviewDto`, `assertMatchesContract` / `contractForDto`(공용 테스트 헬퍼)** — 전부
  기존 코드에 이미 존재하는 식별자를 grep 으로 재확인했고(`integrations.controller.ts`,
  `integrations.service.ts:88`, `connection-test-codes.ts:48`, `integration-response.dto.ts:234`,
  `llm-model-config.controller.spec.ts` import), plan 은 이들을 **재사용**할 뿐 새로 정의하지 않는다.
  다른 의미로 이미 쓰이고 있는 사례는 없었다.

- **요구사항 ID / 환경변수 / 이벤트명 / spec 파일 경로** — 이 plan 은 spec 파일을 신설하거나 새 섹션
  번호(§)를 부여하지 않는다(`spec_impact: none`). §5.6, §9 는 둘 다 사전에 존재함을 grep 으로 확인했다
  (`spec/2-navigation/4-integration.md:528`, `spec/5-system/11-mcp-client.md:517`). ENV var·webhook/queue/
  sse 이벤트명 신설도 plan 본문에 없다.

## 요약

이 plan 이 새로 도입하는 식별자는 사실상 없다 — DTO 필드 3종은 형제 DTO(`PreviewTestResultDto`)의
기존 선언을 의도적으로 그대로 미러링하는 것이고, 유일한 신규 산출물인 테스트 파일명
(`integrations.controller.wire.spec.ts`)도 기존 파일과 경로가 겹치지 않으며 같은 모듈의
`owner` 접미사 선례와 명명 형태가 일치한다. 다만 plan 이 근거로 든 "자매 패턴"의 실물(같은 파일 내
describe 블록)과 제안된 구현 형태(별도 파일)가 어긋난다는 점은 식별자 충돌이 아닌 설계 일관성 메모로
INFO 등급으로만 남긴다. CRITICAL·WARNING 급 충돌은 발견되지 않았다.

## 위험도

NONE
