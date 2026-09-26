# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `capabilities`·`serverInfo`·`preview` 세 필드의 데코레이터·JSDoc 이 `PreviewTestResultDto` 와 `TestConnectionResultDto` 두 클래스에 그대로 복제되어 있다 (중복 코드)
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:264`~`281` (`PreviewTestResultDto`) 와 `:503`~`520` (`TestConnectionResultDto`)
  - 상세: `@ApiProperty({ required: false, additionalProperties: true, description: '...' })` + JSDoc 블록이 필드 3개 × 두 클래스에서 문자 그대로 반복된다. 한쪽만 고치고 다른 쪽을 잊으면 같은 `dispatchTest` 결과가 두 엔드포인트에서 다르게 광고된다 — 실제로 이번 PR 이 고치는 결함(`TestConnectionResultDto` 미선언)이 이 비대칭에서 비롯됐다. PR 은 이를 인지하고 서비스 spec 에 "[형제 대조]" 테스트(`integrations.service.spec.ts` 신규 `it`)를 추가해 두 선언의 드리프트를 회귀 테스트로 잡도록 했고, 필드 옆 주석에도 "형제와 같게 둔다" 는 의도를 명시했다. 즉 중복 자체는 인지·테스트로 방어되어 있으나, 소스 오브 트루스는 여전히 두 곳에 복사된 텍스트이지 공유 선언이 아니다.
  - 제안: 지금 당장 막을 필요는 없음(테스트가 드리프트를 잡음). 다음에 이 필드들을 다시 만질 일이 있으면 공통 데코레이터 팩토리나 mixin(`applyMcpTestFields(cls)` 류)으로 추출해 물리적 복제를 없애는 것을 고려. 프로젝트 메모(`cafe24/makeshop 미러 중복은 의도`)와 같은 맥락의 "의도된 중복" 이므로 이 PR 범위에서 강제할 사안은 아님.

- **[INFO]** `serverInfo` 의 TS 타입이 실제 OpenAPI 스키마(열린 맵)보다 좁다 — 이미 알려졌고 스코프 밖으로 명시적 유예됨
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:516` (`serverInfo?: { name: string; version: string };`), 형제 선언은 `:277`
  - 상세: `@ApiProperty({ additionalProperties: true, ... })` 로 스키마는 열려 있는데 TS 타입은 `{ name; version }` 닫힌 2필드다. SDK 가 그 밖의 키를 실어도 타입 시스템은 경고하지 않는다. 이 자체는 이번 PR 이 만든 결함이 아니라 형제 `PreviewTestResultDto` 의 기존 패턴을 그대로 복제한 것이며, `--impl-prep` 컨시스턴시 리뷰(INFO 2)가 이미 같은 지점을 짚고 "이번 PR 스코프 밖" 으로 명시 유예했다.
  - 제안: 이번 PR 에서 처리할 필요 없음. 후속으로 `Record<string, unknown> & { name?: string; version?: string }` 류로 넓히는 것을 트래커에 남겨 두면 다음에 두 클래스 중 하나만 넓히다 갈리는 사고를 막을 수 있다.

- **[INFO]** DTO 필드 옆에 커밋 해시·과거 결함 서사를 담은 장문 주석이 반복된다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:493`~`497`, `:522`~`528` (신규/기존 혼재)
  - 상세: "이 선언은 `latencyMs` 의 정반대 방향 결함을 닫는다", "형제와 같은 이유다" 등 역사적 맥락을 코드 주석에 길게 남기는 패턴이 이 파일 전반(예: 기존 `:118`~`131`, `:159`~`165`)에 이미 확립되어 있다. 신규 추가분도 같은 밀도·톤을 유지해 파일 내 일관성은 지킨다. 다만 DTO 정의부가 필드 선언보다 주석이 길어 한눈에 스키마 형태를 파악하기 어려워지는 트레이드오프는 존재한다.
  - 제안: 기존 파일 컨벤션과 일치하므로 이번 PR 단독으로 고칠 사안 아님. 언급만 해 둔다.

그 외 — `integrations.controller.ts` 의 diff 는 `@ApiOkWrappedResponse` description 문자열 한 줄을 두 줄로 나눈 것뿐이라 복잡도·가독성에 영향 없음. 신규 `integrations.controller.wire.spec.ts` 는 헬퍼(`session()`, `post()`) 로 반복을 적절히 추출했고 각 테스트 케이스가 짧고 목적이 명확하며 UUID 등은 이름 붙은 상수로 관리되어 매직 넘버 문제가 없다. `integrations.service.spec.ts` 에 추가된 두 테스트·한 줄 assertion 도 기존 describe 패턴과 일관된 스타일이다.

## 요약

이번 변경은 범위가 작고(DTO 필드 3개 선언 추가, 설명 문자열 정정, 테스트 2파일 보강) 기존 코드베이스의 서술적 주석 스타일·테스트 구조를 그대로 따른다. 유일하게 주목할 점은 `capabilities`/`serverInfo`/`preview` 세 필드가 형제 DTO(`PreviewTestResultDto`)와 데코레이터·JSDoc 을 그대로 복제하고 있다는 것인데, PR 이 이를 인지하고 회귀 테스트("형제 대조")로 드리프트를 방어했으므로 즉각적인 유지보수 위험은 낮다. 함수 길이·중첩 깊이·순환 복잡도 측면에서 문제가 되는 신규 로직은 없다.

## 위험도

LOW
