# 테스트(Testing) 리뷰

## 검토 범위

`guide-error-code-truth` 배치의 누적 diff(라운드 1~4 반영분 포함) 중 테스트 관점 대상:

- 신규/변경 테스트: `llm.service.spec.ts`(반환 필드 `error`→`message` 갱신 + 계약 검증 신규 케이스), `llm-model-config.controller.spec.ts`(HTTP 와이어-레벨 계약 검증 신규 `describe`), `integrations.service.spec.ts`(형제 엔드포인트에 `assertMatchesContract` 배선), `model-config-manager.test.tsx`(실패 토스트 신규 2건), `model-configs.test.ts`(픽스처 정정)
- 신규 가드: `guide-error-code-existence.test.ts` + `guide-error-code-scan.ts`, `guide-sanitized-message-parity.test.ts`, `impl-anchor-existence.test.ts` 주석 정정
- 대상 소스: `llm.service.ts`, `integration-response.dto.ts`, `model-config-response.dto.ts`, `model-configs.ts`

이 PR 은 이미 자체적으로 4라운드의 `/ai-review`를 거쳤고(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36,11_33_23}`), 매 라운드의 testing 카테고리 WARNING 이 `RESOLUTION.md` 에 처분 기록과 함께 남아 있다(라운드1 WARNING#2: 실패 토스트 무테스트 → 고침, 라운드2 WARNING#2: 형제 서비스-레벨 계약 미배선 → 고침). 본 라운드(5차, 세션 `12_00_32`)에서는 그 처분 이후 상태를 대상으로 독립적으로 재검토했다.

## 검증 방법

저장소를 뮤테이션하지 않고, 대상 스위트를 직접 실행해 GREEN 을 확인했다(`git status --short` 로 실행 전후 무변경 확인):

- `npx vitest run guide-error-code-existence.test.ts guide-sanitized-message-parity.test.ts impl-anchor-existence.test.ts` → 3 files / **264 tests PASS**
- `npx jest llm.service.spec.ts llm-model-config.controller.spec.ts integrations.service.spec.ts` → 3 suites / **193 tests PASS**
- `npx vitest run model-config-manager.test.tsx model-configs.test.ts` → 2 files / **33 tests PASS**

## 발견사항

- **[WARNING]** MakeShop "미해결 경로변수" 콜아웃의 정확한 메시지 문자열에 SoT 대조 가드가 없다 — 이 PR 이 같은 파일에서 이미 겪은 결함 클래스의 재발 가능 지점
  - 위치: `codebase/frontend/src/content/docs/02-nodes/integrations.en.mdx:295`, `codebase/frontend/src/content/docs/02-nodes/integrations.mdx:306` (`<Callout>` 안 `MAKESHOP_UNRESOLVED_PATH_PARAM: operation '...' has unresolved path placeholder(s): ...` 문구), SoT `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:436`
  - 상세: 이 PR 은 정확히 같은 위험(가이드가 SoT 문자열을 손으로 옮겨 적었다가 SoT 가 바뀌면 조용히 낡는다)을 `models{,.en}.mdx` 의 LLM 8갈래 문장표에서 발견해 `guide-sanitized-message-parity.test.ts` 로 양방향 대조 가드를 만들었다(라운드 1 architecture WARNING#1 처분). 그런데 같은 라운드에서 새로 추가한 MakeShop 콜아웃의 메시지 문자열(`"...operation '...' has unresolved path placeholder(s): ..."`)은 `makeshop.handler.ts:436` 의 템플릿 리터럴을 그대로 손으로 옮긴 것인데, 이를 대조하는 테스트가 없다. 기존 `guide-error-code-existence.test.ts` 는 **토큰 존재**만 보므로(`MAKESHOP_UNRESOLVED_PATH_PARAM` 자체는 handler 소스에 실재해 통과) 이 gap 을 못 잡는다 — 실제로 이 가드 파일 자신의 주석(`guide-error-code-scan.ts:42-59`)이 "존재 검사이지 방출 검사가 아니다" 를 명시하고 있고, 라운드 4 plan 기록(`plan/in-progress/guide-error-code-truth.md` §J)은 이 정확한 술어 한계 때문에 CRITICAL(naming_collision, 다른 코드 이름 오귀속)이 이 PR 을 이미 한 번 통과했었다고 적고 있다. 문구 자체(사람이 읽는 설명 문장)가 오탈자여도, 또는 handler 가 메시지 포맷을 바꿔도 이 가드는 초록이다.
  - 제안: `guide-sanitized-message-parity.test.ts` 와 같은 패턴으로 MakeShop 템플릿 리터럴 접두(`MAKESHOP_UNRESOLVED_PATH_PARAM: operation '...'`)를 소스에서 추출해 두 MDX 파일의 `<Callout>` 문구와 대조하는 소규모 가드를 추가하거나, 최소한 이 자리가 미가드 상태임을 `guide-error-code-scan.ts` 상단 "이 가드가 못 보는 것" 표에 추가 항목으로 명시할 것(현재 표는 `MAKESHOP_UNRESOLVED_PATH_PARAM` 을 "가드가 못 잡은 실례"로만 언급하고, 그 gap 이 여전히 열려 있다는 점은 명시하지 않는다).

## 확인만 하고 조치 불요로 남긴 것 (이미 트래킹됨 — 재-flag 아님)

- **[INFO]** 형제 `/api/integrations/:id/test` 는 서비스 레벨 `assertMatchesContract` 만 있고(`integrations.service.spec.ts:696`), `llm-model-config.controller.spec.ts` 처럼 `TransformInterceptor` 를 통과하는 HTTP 와이어-레벨 계약 테스트가 없다. 이 비대칭은 이미 `plan/in-progress/guide-error-code-truth.md` §J("ai-review W#2 | 등재")에 라운드 4에서 발견·등재됐고, 정본 근거(라운드 1 이 원래 결함을 정확히 이 층 — 서비스 반환과 와이어 사이의 인터셉터 — 에서 발견했었다)도 코드 주석(`llm-model-config.controller.spec.ts:130-144`)에 명시돼 있다. 새 결함 아님, 확인 목적.
- **[INFO]** `ModelTestConnectionResultDto.message?: string | null` 의 `null` 분기는 어떤 테스트로도 커버되지 않는다. 라운드 2·3 RESOLUTION 모두 "프로덕션 발행 케이스 없음"을 사유로 조치 불요 처리했고, 이번에도 `LlmService`/`ModelConfigService` 어디에도 `message: null` 을 만드는 경로가 없음을 grep 으로 재확인했다 — 반복 관찰이지만 새로 액션할 근거는 없다.

## 잘 된 점 (다음 리뷰어를 위한 확인 기록)

- `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 는 **vacuity floor**(코퍼스 크기·토큰 수 하한, `mdxFiles.length > 50` 등)와 **대조군**(축별로 "이건 잡고 이건 놓친다"를 합성 입력으로 명시)을 갖춰, baseline-0 단언 하나만으로는 스캐너를 `return []` 로 바꿔도 통과하는 함정을 막는다.
- `llm-model-config.controller.spec.ts` 의 신규 `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')` 는 서비스 mock 대신 실제 `LlmService` 를 DI 에 넣고 하위 의존만 mock 해, "내가 적은 리터럴을 내가 단언"하는 vacuous 패턴을 피했다. 코드 내 표(뮤턴트 3종 × 단언 3종 RED/GREEN 매트릭스)가 각 단언이 실제로 어떤 회귀를 가르는지 근거를 남긴다.
- `model-config-manager.test.tsx` 신규 케이스는 정확 문자열 단언 + 사유가 빈 경우의 대조군을 짝지어, `stringContaining` 류의 느슨한 단언이 버그를 통과시켰을 반례를 코드로 고정했다.
- 세 스위트 모두 직접 실행해 GREEN 을 확인했고(위 검증 방법), 격리 측면에서 `integrations.service.spec.ts` 는 `beforeEach` 마다 새 `service` 인스턴스를 생성해 `registerEntityTester` 상태가 테스트 간 누수되지 않는다.

## 요약

이 PR 은 원래 결함(3층 필드명 불일치로 실패 사유가 화면에 도달하지 않음)에 대해 UI 레벨부터 HTTP 와이어 레벨까지 계약 테스트를 두텁게 배선했고, 그 과정에서 발견된 부수 결함(가이드가 지어낸/은퇴한 에러 코드를 적던 문제)에도 vacuity floor 와 대조군을 갖춘 신규 정적 가드를 추가했다. 4라운드에 걸친 자체 리뷰가 testing 카테고리의 실질 결함(무테스트 UI 경로, 서비스-레벨 계약 미배선)을 이미 찾아 고쳤음을 코드·plan 양쪽에서 확인했다. 독립적으로 재검토한 결과 남은 결함은 하나 — MakeShop 콜아웃의 메시지 문자열이 이 PR 이 다른 곳(LLM 8문장)에는 이미 만든 SoT-패리티 가드의 사각지대에 있다는 것이며, 이는 이 PR 이 스스로 문서화한 "존재≠방출" 한계와 같은 뿌리에서 나온 남은 위험이다. 그 외 이미 트래킹된 두 항목(형제 엔드포인트 와이어-레벨 미배선, `message: null` 미커버)은 새 결함이 아니라 반복 확인이다. 세 대상 스위트 모두 직접 실행해 GREEN(총 490 테스트)을 확인했다.

## 위험도

LOW
