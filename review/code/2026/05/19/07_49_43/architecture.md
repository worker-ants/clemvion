# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `shared/system-context-prefix.ts` 신설 — 횡단 관심사(cross-cutting concern)의 적절한 중앙화
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts`
  - 상세: 3개 AI 핸들러(AiAgent, TextClassifier, InformationExtractor)가 공통으로 필요한 "시스템 컨텍스트 prefix 생성" 로직을 `shared/` 아래 단일 모듈로 격리했다. 각 핸들러는 `buildSystemContextPrefixFromContext` 한 함수만 호출하므로 단일 책임 원칙(SRP)과 DRY 모두 만족한다. `resolveSystemContextTimezone`, `buildSystemContextPrefix`, `normalizeSystemContextConfig` 세 함수로 책임을 명확히 분리한 것도 적절하다.
  - 제안: 현재 설계대로 유지 권장. 이후 AI 노드가 추가될 경우 동일 경로에서 재사용하면 된다.

- **[INFO]** timezone 해석 책임의 레이어 분리가 명확함
  - 위치: `execution-engine.service.ts` L1272–1183, `system-context-prefix.ts` `resolveSystemContextTimezone`
  - 상세: ExecutionEngine이 workspace timezone을 DB에서 한 번 조회해 `__workspaceTimezone` 변수로 Context에 주입하고, 각 핸들러는 Context에서 읽기만 한다. 핸들러가 직접 DB를 조회하지 않으므로 N+1 문제를 원천 차단하고 데이터 레이어 접근이 서비스 레이어에만 국한된다. 레이어 책임 분리 원칙을 잘 따르고 있다.
  - 제안: 현재 설계대로 유지 권장.

- **[WARNING]** `buildSystemContextPrefixFromContext`에 `now: new Date()` 를 직접 주입 — 테스트 가능성 저하
  - 위치: `ai-agent.handler.ts` L292–297, L309–313; `information-extractor.handler.ts` L593–597, L616–620; `text-classifier.handler.ts` L789–793
  - 상세: 세 핸들러 모두 `now: new Date()`를 인라인으로 호출해 함수에 전달한다. 함수 시그니처 레벨에서는 `now` 파라미터로 분리되어 있어 `buildSystemContextPrefix` 자체의 단위 테스트는 가능하지만, 핸들러 단위 테스트에서 시각을 제어하려면 `jest.useFakeTimers()` 또는 모킹이 필요하다. 현재 핸들러 스펙 테스트는 `## System Context\n` 존재 여부와 timezone 문자열 포함 여부만 검증하므로 실용적 문제는 없지만, 미래에 "특정 시각 기준 포맷" 검증이 필요해질 경우 다소 번거로운 구조다.
  - 제안: 허용 범위 내 현실적 타협으로 즉시 수정 불필요. 단, 멀티턴 코드 주석("$now가 execution-frozen")과 일관성을 위해 장기적으로는 ExecutionContext에 `startedAt: Date` 필드를 추가하고 핸들러가 그것을 `now`로 사용하는 구조로 발전시키면 더 일관된다.

- **[WARNING]** `buildSystemContextPrefixFromContext`의 `config` 파라미터가 `Record<string, unknown>` 타입 — 인터페이스 분리 미흡
  - 위치: `system-context-prefix.ts` L260–287
  - 상세: `config` 를 `Record<string, unknown>`으로 받아 내부에서 `config['includeSystemContext']`, `config['systemContextSections']`를 동적으로 꺼낸다. 세 핸들러 각각의 schema 타입(`AiAgentConfig`, `TextClassifierConfig`, `InformationExtractorConfig`)이 이미 두 필드를 포함하고 있음에도 공유 함수 레벨에서 타입 안전성을 포기하고 있다. 타입 오류가 런타임에서야 드러날 수 있다.
  - 제안: 두 필드를 명시한 인터페이스를 `system-context-prefix.ts`에 선언하고 `config` 파라미터에 적용하는 것을 권장한다. 예: `interface SystemContextConfigFields { includeSystemContext?: boolean; systemContextSections?: string[]; }`. 각 핸들러의 config 타입이 이 인터페이스를 구조적으로 만족하므로 호출 측 변경 없이 타입 안전성 확보가 가능하다.

- **[INFO]** `CAFE24_TIMEZONE_SUFFIX` 상수의 위치 — 약한 모듈 경계
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts` L902–903
  - 상세: `CAFE24_TIMEZONE_SUFFIX` 상수가 `metadata/index.ts`에 추가되어 `cafe24-mcp-tool-provider.ts`(AI 노드 도구 제공자)가 이를 import한다. AI 노드 계층이 Cafe24 통합 계층의 metadata 모듈에 직접 의존하는 형태는 현재 아키텍처에서도 이미 존재하던 패턴이므로 새로운 문제는 아니다. 단, 해당 상수의 의미론적 소유자가 "AI 노드가 Cafe24 도구를 다루는 방식"에 가까우므로 `cafe24-mcp-tool-provider.ts` 내 상수로 이동하거나 별도 `cafe24-ai-conventions.ts`로 분리하는 것이 모듈 경계를 더 명확히 할 수 있다.
  - 제안: 즉시 수정 불필요. 단, Cafe24 metadata 모듈이 AI 노드의 도구 생성 정책을 알 필요가 없다는 관점에서, 향후 리팩토링 시 이동 고려.

- **[INFO]** 동일한 schema 블록(includeSystemContext + systemContextSections)이 세 schema 파일에 중복
  - 위치: `ai-agent.schema.ts` L341–370, `information-extractor.schema.ts` L646–676, `text-classifier.schema.ts` L824–854
  - 상세: 세 schema 파일에 거의 동일한 Zod 필드 정의 블록이 복붙되어 있다. 현재는 `order` 값과 주석만 다르고 실질 내용은 동일하다. 개방-폐쇄 원칙(OCP) 관점에서 새 AI 노드가 추가될 때마다 이 블록을 다시 복사해야 하는 구조다.
  - 제안: `shared/system-context-prefix.ts`에 `systemContextSchemaFields` 헬퍼(또는 Zod object)를 export하고 세 schema에서 `.merge()` 또는 spread로 재사용하면 중복을 제거할 수 있다. `order` 값이 schema마다 달라야 하는 제약이 있다면 파라미터로 받는 팩토리 함수 형태로 제공할 수 있다.

- **[INFO]** `execution-engine.service.ts`의 findOne 쿼리 — 기존 findOneBy와 책임 혼재
  - 위치: `execution-engine.service.ts` L1269–1172
  - 상세: 기존 코드는 `findOneBy({ id: workflowId })`를 사용했으나 변경 후 `findOne({ where: { id: workflowId }, relations: ['workspace'] })`로 교체했다. 변경 자체는 N+1 방지 목적으로 정당하며 ExecutionEngine이 실행 컨텍스트를 구성하는 책임을 유지한다는 점에서 레이어 책임에 위배되지 않는다. 다만 이 조회가 "컨텍스트 구성을 위한 조회"임을 주석으로 명시하고 있어 가독성은 양호하다.
  - 제안: 현재 설계 유지 권장.

- **[INFO]** 순환 의존성 없음 확인
  - 위치: 전체 변경 파일
  - 상세: `shared/system-context-prefix.ts` → `core/node-handler.interface.ts` 단방향. 각 AI 핸들러 → `shared/` 단방향. `cafe24-mcp-tool-provider.ts` → `metadata/index.ts` 단방향. 변경 범위 내 순환 참조 없음.
  - 제안: 없음.

---

## 요약

이번 변경은 "AI 노드에 workspace timezone을 주입해 LLM의 시각 추론 오류를 방지"하는 단일 기능을 구현한 것으로, 아키텍처 관점에서 전체적으로 건전한 설계를 따른다. timezone 해석 및 DB 조회를 ExecutionEngine 레이어에서 한 번만 수행해 컨텍스트로 전달하고, 실제 prefix 생성 로직은 `shared/system-context-prefix.ts`로 명확히 격리했다. 핸들러들은 공유 함수를 동일한 방식으로 호출하므로 응집도가 높고 핸들러 간 일관성도 유지된다. 주요 개선 기회는 두 가지로, `config` 파라미터의 타입 안전성 강화(현재 `Record<string, unknown>`)와 세 schema 파일에 중복되는 Zod 필드 블록의 공유 헬퍼 추출이다. 전자는 런타임 오류 위험을 내포하고 후자는 새 AI 노드 추가 시 누락 위험을 만든다. 두 사항 모두 지금 당장 시스템을 위협하는 수준은 아니나 코드베이스 성장에 따라 부채가 될 수 있다.

---

## 위험도

LOW
