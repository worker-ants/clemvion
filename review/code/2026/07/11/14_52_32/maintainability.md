# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `status` 리터럴 유니온 + swagger `enum` 배열이 두 신규 파일에 그대로 중복되고, 공유 타입 alias 가 없음
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:505-521` (`ExecutionStatusDto.status`) / `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts:803-820` (`InteractAckDto.currentStatus`)
  - 상세: `'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'` 6개 값 유니온과 동일한 `@ApiProperty({ enum: [...] })` 배열이 두 파일에 각각 손으로 다시 적혀 있다. 원본 SoT 는 `execution.entity.ts` 의 `ExecutionStatus` enum(`PENDING/RUNNING/COMPLETED/FAILED/CANCELLED/WAITING_FOR_INPUT`)인데, 두 DTO 모두 그 enum 을 참조하지 않고 자체 리터럴을 선언한다(순서도 서로 다르게 나열돼 있어 "같은 값 집합을 각자 다시 타이핑"했음이 드러난다). `interaction.service.ts` 의 `execution.status as ExecutionStatusDto['status']` 캐스트도 이 분리로 인해 필요해진 우회다. 상태값이 추가/변경될 때 entity·`ExecutionStatusDto`·`InteractAckDto` 세 곳을 컴파일러 도움 없이 동기화해야 하며, 하나라도 누락하면 런타임에는 문제없지만 문서(OpenAPI 스키마)만 조용히 stale 해진다.
  - 동일 모듈 내 이미 반대 사례(공유 타입 alias 사용)가 있다: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` 는 `export type BackgroundRunStatus = ...` 를 선언해 필드 타입으로 재사용한다(swagger `enum:` 배열 자체는 런타임 메타데이터라 여전히 리터럴 나열이 불가피하지만, 최소한 TS 타입 레벨의 이중 선언은 막는다). 신규 DTO 2개는 이 기존 관례를 따르지 않는다.
  - 제안: 공용 `type ExecutionStatusLiteral = 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';` (또는 `keyof typeof ExecutionStatus` 매핑)를 한 곳(예: `execution-status-response.dto.ts` 또는 별도 `execution-status.types.ts`)에 선언하고 두 DTO 필드 타입에서 재사용. `enum:` 배열도 `Object.values(ExecutionStatus)` 등으로 파생 가능하면 파생.

- **[INFO]** `interactionType` 리터럴 유니온이 동일 파일 안에서 두 번 중복 선언됨
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:416-420` (`CurrentNodeDto.interactionType`, nullable) / `:438-439` (`WaitingContextBaseDto.interactionType`, non-nullable)
  - 상세: `'form' | 'buttons' | 'ai_conversation'` 유니온과 그에 대응하는 `@ApiProperty({ enum: [...] })` 배열이 같은 파일 안에서 두 클래스에 걸쳐 각각 손으로 반복된다. 같은 파일이라 drift 위험은 낮지만, 세 번째 인터랙션 종류가 추가될 경우 두 지점을 모두 고쳐야 하고 컴파일러가 누락을 잡아주지 않는다.
  - 제안: 파일 상단에 `type InteractionType = 'form' | 'buttons' | 'ai_conversation';` 을 선언하고 두 클래스에서 재사용(`CurrentNodeDto` 쪽은 `InteractionType | null`).

- **[INFO]** "열린 map" swagger 메타데이터 보일러플레이트(`type: 'object', additionalProperties: true`)가 5개 필드에 반복
  - 위치: `execution-status-response.dto.ts` 의 `conversationThread`(:453-458), `buttonConfig`(:464-471), `nodeOutput`(:481-487), `result`(:550-556), `error`(:558-565)
  - 상세: 파일 자체 JSDoc 이 "봉투만 스키마화하고 내부 payload 는 열린 map 으로 남긴다" 는 설계 원칙을 명시하는데, 그 원칙을 구현하는 `{ type: 'object', additionalProperties: true }` 조합이 5곳에 리터럴로 반복돼 있다(2곳은 `nullable: true` 추가). 기능적 결함은 아니지만, 이 설계 원칙을 코드로도 한 곳에 응집시키면(design intent 를 문서뿐 아니라 타입으로도 강제) 향후 실수로 `additionalProperties` 를 빠뜨리는 회귀를 줄일 수 있다.
  - 제안: `const OPEN_MAP_SCHEMA = { type: 'object', additionalProperties: true } as const;` 같은 공유 상수를 만들어 `@ApiProperty({ ...OPEN_MAP_SCHEMA, description: '...' })` 형태로 spread. 우선순위는 낮음(가독성에 실질적 해는 없음).

- **[INFO]** `interaction.service.ts::getStatus()` 는 이번 diff 의 변경 대상이 아니지만(순수 import 경로 변경만 포함), 전체 파일 컨텍스트 기준으로 여전히 길고(~130줄) 중첩이 깊은 함수(최대 4단계: `if (waiting) → if (nodeExec?.node) → if (interactionType) → 삼항(buttons/else)`)이며, `result`/`error` 두 필드가 `deepRedactSecrets(execution.outputData ?? null) as Record<string, unknown> | null` 삼항 블록을 상태값만 다르게 해서 그대로 반복한다(:1846-1859).
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:1735-1867`
  - 상세: 이 함수는 이번 PR 의 실질 변경분이 아니며(런타임 동작 무변경, DTO import 경로만 갱신), `plan/in-progress/eia-context-schema-followups.md` 의 "비고" 섹션에 `getStatus 의 buildWaitingContext() 헬퍼 추출 — 원 PR 은 '런타임 무변경' 이 계약이라 범위 밖. 다음 관련 변경 시 후보" 로 이미 추적 중이다. 새로 발견된 결함이 아니라 참고용으로만 남긴다.
  - 제안: 별도 조치 불필요(이미 계획된 후속 항목). 다음에 이 메서드를 실제로 건드릴 기회가 있으면 `buildWaitingContext()`/`buildResultOrError()` 분리를 함께 고려.

- **[INFO]** `plan/in-progress/eia-context-schema-followups.md` 의 "`external-interaction` 모듈 응답 DTO 위치 정규화" 항목이 미체크(`- [ ]`) 상태로 남아있으나, 본 diff 가 정확히 그 작업(`dto/responses.dto.ts` 단일 파일 → `dto/responses/*-response.dto.ts` 분리 + import 표면 갱신, swagger.md §5-1 준수)을 수행한 것으로 보인다.
  - 위치: `plan/in-progress/eia-context-schema-followups.md:2012-2013`
  - 상세: 코드 자체의 유지보수성 문제는 아니지만, plan 체크박스가 실제 완료 상태를 반영하지 못하면(project 관례상 "체크박스 = 실제 상태") 이후 세션에서 이미 끝난 항목을 중복 착수하거나, 반대로 완료 커밋을 이 plan 항목과 연결 짓지 못하는 추적 갭이 생길 수 있다.
  - 제안: 본 PR 이 해당 작업의 완료분이 맞다면 같은 커밋에서 체크박스를 갱신할 것. 별도 후속 PR 로 남길 의도라면 plan 본문에 그 경계를 명시.

## 요약
이번 변경은 EIA 응답 DTO 를 모놀리식 `dto/responses.dto.ts` 에서 모듈 관례(`dto/responses/*-response.dto.ts`)에 맞춰 파일 단위로 분리하고, `context` 필드를 판별자 없는 닫힌 `oneOf` union 으로 정밀화한 작업이다. 새 DTO 파일들은 클래스/파일 네이밍이 기존 25개 모듈 관례와 일관되고, 각 필드마다 설계 근거(왜 nullable 인지, 왜 열린 map 인지, 왜 discriminator 를 안 쓰는지)를 spec 섹션과 함께 상세히 문서화해 가독성이 높다. 신규 스펙 테스트(`execution-status-response.dto.spec.ts`)도 실제 OpenAPI 문서를 빌드해 검증하는 방식으로 함수 길이·중첩·네이밍 모두 양호하다. 다만 `status`/`interactionType` 리터럴 유니온이 여러 지점(특히 파일 간)에 손으로 중복 선언되어 있어 향후 상태값 추가 시 동기화 누락 위험이 있고, 이는 같은 모듈 계열에 이미 존재하는 "공유 타입 alias" 관례(`BackgroundRunStatus`)와도 어긋난다. 나머지 발견사항은 보일러플레이트 경미 중복과 diff 범위 밖 사전 존재 이슈에 대한 참고 수준으로, 전반적으로 유지보수성 리스크는 낮다.

## 위험도
LOW
