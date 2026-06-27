# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] PROVIDER_PROBE_THROTTLE 공유 객체 참조 — 변경 무방 확정
- 위치: `llm-model-config.controller.ts` L45 (`const PROVIDER_PROBE_THROTTLE = ...`)
- 상세: 모듈 스코프 상수 `PROVIDER_PROBE_THROTTLE`이 동일 객체 참조를 3개 핸들러의 `@Throttle()` 데코레이터에 전달한다. 데코레이터가 이 객체를 변이할 경우 세 핸들러가 공유 상태에 영향을 받을 수 있다는 이론적 우려가 있다. 그러나 `@nestjs/throttler` 데코레이터 구현 (`throttler.decorator.js`)을 직접 확인한 결과 `setThrottlerMetadata` 는 `options[name].ttl / .limit / .blockDuration` 등을 읽어 `Reflect.defineMetadata`를 호출할 뿐 입력 객체를 일절 변이하지 않는다. 부작용 없음 확정.
- 제안: 현행 유지.

### [INFO] ParseEnumPipe 배열 인수 — NestJS 11 호환 확정
- 위치: `llm-model-config.controller.ts` L218 (`new ParseEnumPipe(['chat', 'embedding'], ...)`)
- 상세: `ParseEnumPipe`는 통상 TypeScript enum 객체를 기대하지만 배열도 전달 가능하다. NestJS 11 실제 구현 (`parse-enum.pipe.js`)의 `isEnum` 메서드는 `Object.keys(enumType).map(k => enumType[k])` 로 값 목록을 수집한다. 배열을 인수로 전달하면 `Object.keys(['chat', 'embedding'])` = `['0', '1']` → `enumType['0'] = 'chat'`, `enumType['1'] = 'embedding'` → 최종 열거값 `['chat', 'embedding']`. 입력 검증 결과는 순수 enum 객체와 동일하다. 호환성 확정.
- 제안: 현행 유지. 코드 가독성이 우려된다면 `as unknown as Record<string, string>` 캐스팅 또는 `const ModelType = { chat: 'chat', embedding: 'embedding' }` 객체 선언으로 대체할 수 있으나 동작 차이 없음.

### [WARNING] listModels 엔드포인트 — 인텐션널 API 동작 변경
- 위치: `llm-model-config.controller.ts` L218–219
- 상세: 변경 전 `@Query('type')` 는 어떤 문자열 값도 그대로 `llmService.listModels`로 전달했다. 변경 후 `ParseEnumPipe({ optional: true })`가 삽입되어 `'chat'`/`'embedding'` 이외의 값이 오면 HTTP 400 Bad Request가 반환된다. 이는 의도된 엔드포인트 하드닝이나, **이전에 임의 문자열을 `type` 쿼리로 전달하던 클라이언트가 존재할 경우 동작이 400으로 변한다**. `optional: true` 옵션 덕분에 `type` 미전달은 종전과 동일하게 `undefined`로 처리된다.
  - 발생 가능한 callee-side 부작용: `llmService.listModels`가 종전에는 유효하지 않은 `type` 값도 수신하여 서비스 계층에서 처리(또는 무시)했을 수 있다. 이제 그 경로는 컨트롤러 계층에서 차단된다.
  - 공개 클라이언트 영향 범위: spec(6-config.md §3 R-7)이 유효값을 `chat`/`embedding`으로 명문화하므로 spec 준수 클라이언트에게는 영향 없다. 직접 API 호출자(비정상 값 전달)만 영향.
- 제안: 의도된 변경으로 판단. 다만 Swagger `@ApiQuery` 의 `enum: ['chat', 'embedding']` 선언과 `ParseEnumPipe` 가 동일 제약을 이중 표현하므로 단일 진실 소스(DTO enum 상수)로 통합하면 나중에 허용 값이 바뀔 때 두 곳을 동기화해야 하는 위험이 줄어든다. 긴급 사항 아님.

### [INFO] plan 완료 파일 spec_impact 수정 — Gate C 버그 수정 확인
- 위치: `plan/complete/web-chat-loader-queue-replay-arguments.md` frontmatter
- 상세: `spec_impact: []` (빈 배열) → `spec_impact: none` (문자열). Gate C 게이트 테스트 (`spec-plan-completion.test.ts`)의 `hasValidSpecImpact` 함수는 빈 배열(`impact.length > 0` 실패)을 **유효하지 않은 값**으로 처리하여 CI에서 실패할 수 있었다. `none`은 `NONE_VALUES` 집합(`"none"`, `"없음"`, `"n/a"`, `"na"`)에 포함된 적법한 no-op 선언이다. 이 변경은 기존 Gate C 위반을 교정하는 것으로 부작용 없음.
- 제안: 현행 유지.

### [INFO] 플랜 파일 상태 텍스트 갱신 — 순수 문서 변경
- 위치: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 항목
- 상세: `PR 대기` → `PR #714 000d8963 머지 완료`, authz follow-up `PR #716 3e102ed3 머지 완료` 추가. 순수 텍스트 추적 갱신이며 코드·상태·이벤트에 아무런 부작용 없음.
- 제안: 현행 유지.

---

## 요약

리뷰 대상 3개 파일 중 실질적인 코드 변경은 `llm-model-config.controller.ts` 하나다. 스로틀 설정 상수화(`PROVIDER_PROBE_THROTTLE`)는 `@Throttle` 데코레이터 소스 확인 결과 입력 객체 변이가 전혀 없어 부작용이 없다. `ParseEnumPipe` 도입은 NestJS 11에서 배열 인수로도 올바르게 동작함이 확인되었다. 동작 변화는 단 한 가지 — `?type=<유효하지 않은 값>` 요청이 서비스 계층 처리 대신 HTTP 400으로 조기 차단된다 — 이며 이는 spec R-7이 명문화한 의도된 API 하드닝이다. 나머지 두 파일은 Gate C 스키마 교정(빈 배열 → `none`)과 PR 머지 기록 갱신이며 코드 부작용 없다.

## 위험도

LOW
