# 테스트(Testing) 리뷰 — rotate-bot-token-body

## 검증 절차 메모

- `npm test -- executions-continue-body.spec.ts hooks-webhook-body.spec.ts triggers-rotate-bot-token-body.spec.ts` 를 직접 실행해 **11개 전부 통과**를 실측 확인했다 (plain `npx jest` 는 `--experimental-vm-modules` 부재로 ESM 로딩 오류가 나 실패했으나, 이는 내 호출 방식의 문제였고 `npm test` 스크립트로는 정상 통과 — 실제 결함 아님, 기록만 남긴다).
- `chat-channel-rotate-bot-token-request.dto.ts` 의 `@ApiProperty({ writeOnly: true })` 를 `@ApiProperty({})` 로 뮤테이션해 plan 이 주장한 M2(`KILLED`)를 스팟 재현했다 — 실제로 RED(`Expected: true / Received: undefined`)를 확인했다. 뮤테이션은 저장소 밖 스크래치에 백업 없이 `sed -i.bakmut` → `cp` 로 원복했고, 원복 후 `git status --short` 는 이 리뷰 세션 산출물(`review/code/2026/09/26/17_55_14/`)만 남기고 깨끗함을 확인했다(diff 0). 다른 파일은 건드리지 않았다.

## 발견사항

- **[WARNING]** `swagger-probe.ts` 신규 함수 `bodyParamDesignType` 의 두 에러 분기가 이 파일 자신의 테스트 관례를 어기고 무테스트 상태
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:150-153` (`@Body() 가 없다` throw), `:159-162` (`design:paramtypes 가 없다` throw)
  - 상세: `swagger-probe.spec.ts` 파일 머리 주석은 이 헬퍼 모음의 **존재 이유가 에러 경로**라고 명시한다 — "행복 경로는 네 소비처 스펙이 이미 매 실행마다 검증하므로 여기서 다시 세지 않는다... 여기서 고정하는 것은 틀렸을 때 무엇을 말해 주는가" (`swagger-probe.spec.ts:11-17`). 실제로 `schemaOf`/`propertyOf`/`schemasOf` 는 그 관례대로 `swagger-probe.spec.ts` 안에 전용 에러-경로 테스트를 갖고 있다. 그런데 이번 PR 이 추가한 `bodyParamDesignType` 은 두 개의 `throw new Error(...)` 분기(`@Body()` 부재, `design:paramtypes` 부재)를 갖고 있음에도 `swagger-probe.spec.ts` 는 이번 diff 에서 전혀 손대지 않았다(`git log` 상 마지막 수정은 이 PR 이전 커밋 `b541484c2`). 세 소비처 스펙(`executions-continue-body`·`hooks-webhook-body`·`triggers-rotate-bot-token-body`)은 모두 행복 경로(정상적으로 `@Body()` 가 있고 `design:paramtypes` 가 emit 되는 컨트롤러)만 통과하므로, 이 두 분기는 **현재 어떤 테스트로도 실행되지 않는다.** 함수 자체의 JSDoc 이 "조용히 `undefined` 를 내면 캐너리가 공허해진다" 는 정확한 우려를 담고 있으면서, 정작 그 우려가 실현되는지(즉 이 두 조건이 제대로 트리거되는지) 확인하는 테스트가 없다 — 이 헬퍼가 향후 다른 컨트롤러(예: `@Body()` 파라미터가 없는 메서드, 또는 데코레이터가 전혀 없어 `design:paramtypes` 가 비는 메서드)에 재사용될 때 조건식이 실제로 맞는지 아무도 검증하지 않은 채로 남는다.
  - 제안: `swagger-probe.spec.ts` 의 기존 `ProbeController`/`EmptyController` 패턴처럼, `@Body()` 가 없는 스텁 메서드와 (가능하면) `design:paramtypes` 가 비는 스텁 메서드를 하나씩 추가해 두 `throw` 를 직접 호출·단언하는 테스트를 보태길 권한다. 이 파일 자신이 선언한 "존재 이유는 에러 경로" 원칙과의 정합을 맞추는 차원이다.

- **[INFO]** `bodyParamDesignType` 은 메서드당 `@Body()` 파라미터가 하나뿐이라는 전제를 문서화하지 않은 채 갖고 있다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:147-149` (`Object.entries(args).find(...)` — 첫 매치만 사용)
  - 상세: 현재 3개 호출 자리(`rotateBotToken`·`continueExecution`·`receiveWebhook`)는 전부 `@Body()` 가 정확히 하나씩이라 문제가 드러나지 않는다. 다만 NestJS 는 `@Body('key')` 형태로 같은 메서드에 여러 개의 `@Body()` 데코레이터를 허용하는데, 그 경우 `.find()` 는 Object.entries 순회 순서상 첫 번째 항목만 반환한다. 이 캐너리가 그런 형태의 컨트롤러에 재사용될 가능성은 낮지만, 전제가 코드에도 JSDoc 에도 명시돼 있지 않아 다음 사람이 다중 `@Body()` 메서드에 그대로 적용했을 때 조용히 잘못된 파라미터의 설계 타입을 반환할 수 있다.
  - 제안: JSDoc 에 "`@Body()` 는 메서드당 하나로 가정한다" 를 한 줄 추가하거나, 둘 이상 발견 시 던지도록 방어하면 향후 오용을 막을 수 있다. 차단 사유는 아니다.

## 긍정 관찰 (참고용)

- 신규 캐너리 3종(`executions-continue-body.spec.ts`, `hooks-webhook-body.spec.ts`, `triggers-rotate-bot-token-body.spec.ts`)은 서로 독립적이고 공유 가변 상태가 없다 — 각 파일이 자체 `describe` 블록과 (필요 시) 자체 `StubController` 를 구성해 `buildSwaggerDocument` 로 격리된 Nest 모듈을 세우고 `finally` 에서 `app.close()` 하는 기존 패턴(`swagger-probe.ts`)을 그대로 재사용한다. Jest open-handle 누수 위험이 없다.
- Mock 사용이 실제 필요한 곳에만 국한돼 있다 — 세 스펙 모두 서비스 계층을 목킹하지 않고 `Reflect.getMetadata` 로 메타데이터만 직접 조회한다(DI 불필요). "본문이 실제로 어떻게 검증되는가"(핸들러의 수동 `INVALID_BOT_TOKEN` 체크, `FormValidationError` 처리 등)에 대한 행위 테스트는 이미 존재하는 `triggers.controller.spec.ts`·`executions` 관련 스펙이 서비스 mock 을 통해 커버하고 있고, 이번에 추가된 캐너리는 그와 중복하지 않고 "OpenAPI 문서 전용 DTO가 런타임 파이프를 우회한다" 는 더 좁고 새로운 계약만 고정한다 — 관심사 분리가 적절하다.
- 회귀 안전성: 전역 Swagger 문서를 통째로 스냅샷/조립하는 다른 테스트가 저장소에 없음을 확인했다(`grep -rln "SwaggerModule.createDocument"`) — 이번 PR 이 3개 라우트에 `@ApiBody` 를 추가해도 깨질 기존 문서 스냅샷 테스트가 없다.
- "여기가 RED 면 계약 변경" 주석이 붙은 캐너리(설계 타입 `Object` 단언, 여분 키·비-string 값이 파이프를 통과한다는 단언)는 스팟 뮤테이션으로 실제 KILL 을 확인했고(`writeOnly` 제거 뮤턴트가 RED), plan 의 뮤턴트 표(6/6 KILLED)와 부합한다.
- `bodyParam?.required` 단언이 `.toBeFalsy()` 가 아니라 `.toBe(false)` 로, `bodyParam?.type` 단언이 존재 확인 없이 값 비교로 쓰여 있어 `undefined` 를 우연히 통과시키는 공허한 단언(vacuous assertion) 패턴이 아니다.

## 요약

새 코드(3개 라우트의 문서 전용 `@ApiBody` DTO + 공유 헬퍼 `bodyParamDesignType`)에 대한 테스트는 각 라우트마다 "설계 타입이 `Object` 로 남아 파이프를 우회한다" · "여분 키/비-string 값이 그대로 통과한다" · "`@ApiBody` 가 올바른 DTO 를 가리킨다" · "렌더된 스키마가 기대한 형태다" 4갈래를 빠짐없이 캐너리로 고정하고 있고, 실행·뮤테이션 스팟체크 모두 plan 의 주장과 일치했다 — 테스트 존재·엣지케이스·격리·가독성·회귀 관점에서 전반적으로 탄탄하다. 유일한 갭은 이번에 신설된 공유 헬퍼 `bodyParamDesignType` 의 두 방어적 에러 분기가 `swagger-probe.spec.ts` 자신이 선언한 "이 파일의 존재 이유는 에러 경로" 관례를 벗어나 무테스트 상태로 남아 있다는 점이다 — 현재 3개 소비처에서는 문제가 드러나지 않지만, 이 헬퍼가 향후 재사용될 때 조건식의 정확성을 아무도 검증하지 않은 채로 두는 구조적 갭이다.

## 위험도

LOW
