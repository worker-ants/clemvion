# Architecture Review

## 발견사항

### 발견사항 1
- **[WARNING]** `workspaces.controller.ts` — `const` 선언이 두 `import` 블록 사이에 삽입되어 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` diff hunk (SENSITIVE_ACTION_THROTTLE import 직후, WorkspacesService import 직전)
  - 상세: `import { SENSITIVE_ACTION_THROTTLE } ... ` 다음에 `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 가 오고, 그 아래에 `import { WorkspacesService } ...` 가 따라온다. TypeScript/ESM 에서 import 는 호이스팅되므로 런타임 버그는 없으나, NestJS 코드베이스 관례(imports 전부 → 모듈 레벨 선언 순서)를 위반한다. 리뷰어·린터가 혼동할 수 있는 패턴이고, 일부 import 재정렬 자동화 도구가 이 `const` 를 잘라내거나 오해할 위험이 있다.
  - 제안: 모든 `import` 블록을 파일 상단에 모으고 `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 는 import 블록 종료 후에 배치한다.

### 발견사항 2
- **[INFO]** `model-type.ts` 의 위치 — `model-config/dto/` 내에 있으나 주 소비자는 `llm` 모듈이다.
  - 위치: `codebase/backend/src/modules/model-config/dto/model-type.ts`
  - 상세: `MODEL_TYPE_ENUM` / `ModelTypeFilter` 는 `LlmService.listModels` opts 타입 및 `LlmModelConfigController` 에서 소비된다. 값(chat/embedding)의 원천은 `llm/interfaces/llm-client.interface.ts` 의 `ModelInfo['type']` 이다. 현재 배치는 기존 llm → model-config 단방향 의존 방향을 따르므로 순환 의존성이 없으나, 파일 경계상 `model-config/dto` 가 `llm` 도메인 필터를 소유하는 역할 혼재가 생긴다. 실용적 관점에서는 `ParseEnumPipe` + Swagger 용도상 model-config DTO 레이어가 자연스러운 위치이므로 수용 가능하다. 단, 주석에서 값이 `ModelInfo['type']` 과 정렬됨을 명시하고 있어 추후 타입 불일치 위험을 스스로 경고하고 있다. 이 연결을 코드 수준에서 `satisfies` 또는 타입 단언으로 강제하면 정합 보장이 명시적이 된다.
  - 제안: 현 배치 유지 가능. 강화하려면 `MODEL_TYPE_ENUM` 값이 `ModelInfo['type']` 의 부분집합임을 TypeScript 타입 시스템으로 단언하는 한 줄을 추가한다 (`type _AssertSubset = ModelTypeFilter extends ModelInfo['type'] ? true : never`).

### 발견사항 3
- **[INFO]** `SENSITIVE_ACTION_THROTTLE` 공유 — 성격이 다른 두 도메인(workspace 초대·provider probe)이 동일 상수를 참조하는 구조.
  - 위치: `codebase/backend/src/common/constants/throttle.ts`
  - 상세: 현재 설계는 "우연히 같은 값이 아니라 동일 tier" 임을 주석으로 명시하고, 소비처마다 named 별칭(`INVITATION_THROTTLE`, `PROVIDER_PROBE_THROTTLE`)을 두어 의미를 보존한다. 이는 SOT + Facade alias 패턴의 올바른 적용이다. 다만 향후 두 도메인의 정책이 갈릴 경우(예: 초대는 5회, probe 는 20회) 별도 상수로 분리해야 한다는 진화 지점이 존재한다. 주석이 이미 이를 안내("특정 라우트의 정책이 갈리면 이 상수를 공유하지 말고 라우트별 자체 `@Throttle` 로 분리한다")하므로 별도 조치 불필요.
  - 제안: 현재 구조 유지. 정책이 갈릴 시 주석 지침대로 분리하는 것으로 충분.

### 발견사항 4
- **[INFO]** `capModelList` 의 logger 파라미터 — optional 주입 패턴.
  - 위치: `codebase/backend/src/modules/llm/list-models-cap.ts`
  - 상세: logger 가 `undefined` 이면 경고를 무시한다. 이는 테스트에서 logger 없이 함수를 호출할 수 있게 하는 유연한 설계다. 그러나 프로덕션 경로(`LlmService`, `LlmPreviewService`)에서는 반드시 logger 를 전달하므로 경고 누락 위험은 없다. 순수 함수 + optional logger 조합은 테스트 용이성과 재사용성을 모두 만족한다. 아키텍처 우려 없음.

## 요약

전체적으로 본 변경셋은 아키텍처 품질을 개선하는 리팩터다. `SENSITIVE_ACTION_THROTTLE` 추출은 DRY + SOT 를 올바르게 적용하며 named 별칭 패턴으로 라우트별 의미를 보존한다. `list-models-cap.ts` 는 SRP 를 준수하는 단일 책임 유틸리티 모듈이고, `model-type.ts` 는 컨트롤러-서비스 간 타입 SOT 를 수립한다. 순환 의존성은 도입되지 않았으며 레이어 책임(cap 로직은 서비스 계층, 스로틀 정책은 common 계층)이 올바르게 배치되어 있다. 유일한 경계 이슈는 `workspaces.controller.ts` 에서 import 블록 사이에 삽입된 `const` 선언으로, 런타임 영향은 없으나 파일 구조 관례를 위반한다.

## 위험도

LOW
