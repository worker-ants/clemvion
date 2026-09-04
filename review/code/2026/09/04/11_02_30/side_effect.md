# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 공유 tmpdir 픽스처 헬퍼가 `fn` 을 동기 함수로만 가정한다 — async 콜백을 넘기면 정리(rmSync)가 작업 완료 전에 실행돼 파일이 먼저 사라진다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:28-32` (`withFiles` 함수 본문 `try { return fn(paths); } finally { fs.rmSync(dir, ...) }`)
  - 상세: `withFiles<T>(files, fn: (paths) => T, prefix): T` 의 타입 시그니처는 `T = Promise<X>` 를 허용한다 — 즉 async 콜백을 넘겨도 컴파일 타임에 막히지 않는다. `fn(paths)` 가 async 함수라면 즉시 pending `Promise` 를 반환하고, `try`/`finally` 는 그 반환값을 기다리지 않은 채 `finally` 블록의 `fs.rmSync(dir, { recursive: true, force: true })` 를 곧바로 실행한다. 결과적으로 콜백 안의 비동기 작업(예: `await someAsyncRead(file)`)이 실제로 파일을 읽기 **전에** 임시 디렉터리가 지워질 수 있다 — 조용한 `ENOENT` 로 나타나는 레이스 컨디션.
    현재 소비처(`nullable-type-lie-cast.spec.ts`, `swagger-dto-contract.spec.ts`) 는 전부 동기 콜백만 쓰므로 지금 당장 발현하지 않는다. 다만 이 파일의 docstring 이 "저장소 가드 spec 들이 공유하는" 헬퍼라고 명시하고, 실제로 이번 PR 에서 두 번째 소비처가 이미 생겼다 — 공유 폭이 넓어질수록 다음 소비처가 async 콜백(예: `fs.promises` 기반 스캔, 외부 프로세스 호출 등)을 넘길 확률이 올라간다. 이 함수는 원래 `nullable-type-lie-cast.spec.ts` 안의 지역 함수였던 것을 그대로 옮긴 것이라 신규 결함은 아니지만, 지역 스코프에서 공유 유틸로 승격되며 이 레이스의 blast radius 가 커졌다.
  - 제안: `fn` 의 반환 타입을 `T` 로 두되 문서에 "동기 콜백 전용" 이라고 명시하거나, `Promise` 반환을 감지해 `await` 한 뒤 정리하도록 (`const result = await fn(paths); return result;` + 함수 자체를 `async` 로) 고쳐 async 콜백도 안전하게 만드는 편이 낫다. 최소한 JSDoc 에 "콜백은 동기여야 한다 — 비동기 콜백을 넘기면 파일이 조기 삭제된다" 를 명시해 다음 소비처가 이 함정을 밟지 않게 한다.

- **[INFO]** `background-run-response.dto.ts` 의 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 전환은 런타임 검증에는 영향이 없지만 생성된 OpenAPI 스키마의 `required` 값을 `false`→`true` 로 바꾼다
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`BackgroundRunNodeExecutionDto.finishedAt` 등 게이트 43·46·49-55·58-64·67-73, `BackgroundRunNodeExecutionsPageDto.nextCursor` 게이트 84-87, `BackgroundRunResponseDto.completedAt`/`durationMs` 게이트 142-143·145-148)
  - 상세: `@ApiProperty`/`@ApiPropertyOptional` 데코레이터는 Swagger 문서 생성 전용이며 `class-validator`/`class-transformer` 런타임 검증·직렬화 경로에는 관여하지 않는다 — 확인 결과 실제 응답 조립 로직은 변경되지 않았고, 이 필드들은 이전에도 항상 키가 존재했다(단지 문서가 `required:false` 로 잘못 선언했을 뿐). 따라서 백엔드 자체의 실행 시 부작용은 없다. 다만 이 변경은 **공개 OpenAPI 계약**의 `required` 필드를 바꾸므로, 이 스키마로부터 클라이언트 코드를 생성하는 소비자가 있다면(현재 frontend 는 이 DTO 들을 손으로 타이핑한 것으로 확인돼 즉각적인 빌드 파손은 없음) 그 생성기 출력이 바뀐다. plan 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 항목 "계약 거짓 9곳")가 이 변경을 의도된 것으로 명시하고 있어 CRITICAL 로 올리지 않는다.
  - 제안: 해당 없음(문서화된 의도된 변경) — 다만 외부 SDK/코드젠 소비자가 있다면 배포 노트에 남기는 것을 권장.

- **[INFO]** `create-assistant-session.dto.ts` 의 `llmConfigId?: string` → `llmConfigId?: string | null` 은 타입 시그니처 확장(위칭)이며 런타임 검증 동작은 이미 이 값을 처리하고 있었다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `workflow-assistant-session.service.ts:91` 가 이미 `dto.llmConfigId ?? null` 로 `null` 케이스를 다루고 있어, 이번 타입 변경은 이미 존재하던 실제 동작을 타입 선언에 맞춘 것이다(`@ApiPropertyOptional({ nullable: true })` 는 이번 diff 이전부터 있었음 — swagger 선언과 TS 타입의 괴리를 메운 것). `@IsOptional()` 은 `class-validator` 관례상 `null`/`undefined` 모두 스킵하므로 검증 동작도 바뀌지 않는다. 시그니처가 넓어지는 방향(narrower → wider)이라 기존 호출자를 깨뜨리지 않는다.
  - 제안: 없음.

## 요약

핵심 변경은 (1) 테스트 전용 tmpdir 픽스처 헬퍼를 5개 파일에 흩어져 있던 사본에서 `common/__test-utils__/temp-fixture.ts` 하나로 통합한 리팩터, (2) 새 AST 기반 repo-guard(`swagger-dto-contract-guard.ts`/`.spec.ts`)로 Swagger `@ApiProperty*` 선언과 TS 타입의 nullable/presence 불일치를 잡는 것, (3) 그 가드가 실제로 잡아낸 계약 거짓 9곳(`background-run-response.dto.ts` 8곳 + `create-assistant-session.dto.ts` 1곳)을 고친 것, (4) 두 plan 문서 갱신이다. 파일시스템 부작용은 전부 `os.tmpdir()` 안에 격리되고 `try/finally` 로 정리되어 저장소 트리를 건드리지 않는다. DTO 데코레이터 변경은 `class-validator`/런타임 로직에 영향을 주지 않는 순수 Swagger 문서 변경이며, 이미 코드가 다루고 있던 동작을 타입/문서에 맞춘 것으로 확인된다. 유일하게 실질적으로 지적할 부작용은 공유화된 `withFiles`/`withFixture` 헬퍼가 async 콜백을 받으면 정리(rmSync)가 작업 완료 전에 실행되는 레이스인데, 현재 모든 소비처가 동기 콜백만 써서 지금 당장 발현하지 않는다 — 다만 공유 유틸로 승격되며 향후 소비처가 이 함정을 밟을 위험이 커졌다.

## 위험도
LOW
