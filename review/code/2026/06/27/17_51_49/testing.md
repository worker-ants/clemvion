# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `SENSITIVE_ACTION_THROTTLE` 상수 값에 대한 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/common/constants/throttle.ts`
- 상세: `ttl: 60_000`, `limit: 10` 값이 정책 SoT 이나 이 값을 직접 검증하는 테스트가 없다. 누군가 값을 실수로 변경해도 테스트가 잡지 못한다. 다만 순수 상수라 테스트 ROI가 낮으며, `PROVIDER_PROBE_THROTTLE`·`INVITATION_THROTTLE` 별칭의 동작은 e2e 에서 간접 커버된다.
- 제안: 필수는 아니지만 `SENSITIVE_ACTION_THROTTLE.default.limit === 10`, `ttl === 60_000` 을 검증하는 sanity 테스트를 throttle.spec.ts 1개로 추가하면 정책 수치 drift 를 컴파일 전에 잡을 수 있다. (tech-debt 수준, 차단 불필요)

### [INFO] `LlmModelConfigController` throttle 데코레이터 동작의 컨트롤러 레벨 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm-model-config.controller.ts` (세 핸들러 전체)
- 상세: `@Throttle(PROVIDER_PROBE_THROTTLE)` 데코레이터가 세 핸들러에 적용되었으나, 11회 연속 요청 시 429 반환 여부를 검증하는 컨트롤러 단위 테스트 또는 e2e 가 확인되지 않는다. RESOLUTION.md 에 e2e 215 tests PASS 로 기재되어 있어 간접 커버 가능성이 있으나 throttle 전용 e2e 시나리오 존재 여부는 불명확하다.
- 제안: 기존 e2e 스위트에 throttle 429 시나리오가 없다면 별도 트랙으로 추가. 현재 PR 범위에서는 차단 불필요.

### [INFO] 서비스 통합 테스트에서 cap 경고 로그 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm-preview.service.spec.ts`, `llm.service.spec.ts`
- 상세: 두 서비스 스펙에 추가된 cap 통합 테스트(`caps a pathologically large ...`)는 응답 길이와 첫 요소 ID 만 검증한다. 서비스 인스턴스 내부 `this.logger.warn` 이 실제 호출되었는지는 확인하지 않는다. `capModelList` 단위 테스트(`list-models-cap.spec.ts`)가 로거 경로를 완전히 커버하므로 중복 검증 부재는 수용 가능하나, 서비스 레이어에서 `this.logger` 가 올바르게 `capModelList` 에 전달되는지(즉 logger 파라미터가 생략된 채 호출되지 않는지)는 통합 테스트 수준에서 보장되지 않는다.
- 제안: 서비스 통합 테스트에 `jest.spyOn(service['logger'], 'warn')` 으로 실제 경고 호출을 추가 검증하는 어설션 1줄을 넣으면 "logger 전달 망각" 류 회귀를 방어할 수 있다. 차단 불필요, low-priority.

### [INFO] 캐시 히트 경로에서 cap 비적용이 명시적으로 테스트되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm.service.spec.ts`
- 상세: `LlmService.listModels` 구현에서 `capModelList` 는 네트워크 응답 수신 후 캐시 저장 직전에 적용되어, 캐시에는 이미 상한 적용된 목록이 저장된다. 캐시 히트 경로에서는 `capModelList` 가 재호출되지 않는다. 이 동작은 의도적이고 올바르나, 현재 테스트 스위트에 "대량 응답 → 캐시 저장 → 캐시 히트 반환" 연속 시나리오가 없어 캐시 히트 시 cap 이 우회되지 않는다는 것을 명시적으로 검증하지 않는다. RESOLUTION.md 에서 I-10/I-11/I-12 로 보류 처리된 항목과 동일 맥락.
- 제안: 기존 캐시 히트 테스트에 대량 응답 mock 후 2회차 호출 시 동일 상한 결과 반환 어설션을 추가하면 완전한 커버리지 확보. 차단 불필요.

### [INFO] `MODEL_TYPE_ENUM` / `ModelTypeFilter` 공유 SOT 에 대한 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/model-config/dto/model-type.ts`
- 상세: 컨트롤러의 `ParseEnumPipe` 와 `LlmService.listModels` 가 동일 타입 출처를 공유하므로, 허용값이 달라지면 양쪽에 영향을 준다. 현재 허용값('chat', 'embedding')의 정확성을 검증하는 테스트가 없다. TypeScript 컴파일이 타입 정합을 보장하나 런타임 enum 값('chat' 문자열 자체)의 오탈자는 잡지 못한다.
- 제안: 기존 controller 또는 service spec 에서 `MODEL_TYPE_ENUM` 값을 import 하여 `Object.values(MODEL_TYPE_ENUM)` 가 `['chat', 'embedding']` 과 일치하는지 검증하는 1줄 테스트. 차단 불필요.

---

## 긍정 평가

- **`list-models-cap.spec.ts` 설계 우수**: 세 시나리오(상한 이하·정확히 상한·초과)를 `toBe`(참조 동일) 어설션으로 올바르게 구분하고, 경고 로그 테스트에 `try/finally` 로 spy 복원을 보장한다. W-3 이슈가 최종 코드에서 해결되어 있음을 확인.
- **순수 함수 + optional logger 패턴**: `capModelList` 가 순수 함수로 설계되어 테스트 시 logger 없이 호출 가능하며, 프로덕션 경로에서만 logger 를 주입하는 방식이 테스트 용이성과 격리성을 동시에 만족한다.
- **통합 커버리지**: `LlmService`·`LlmPreviewService` 양 경로 모두 cap 통합 테스트가 추가되어 신규 기능의 end-to-end 흐름이 단위 테스트 수준에서 검증된다.
- **격리 보장**: 첫 두 테스트는 side-effect 없는 순수 함수 호출이라 별도 정리 코드가 불필요하며, spy 를 사용하는 세 번째 테스트는 `try/finally` 로 격리가 보장된다.
- **테스트 가독성**: 테스트 이름이 동작 의도를 명확히 설명하고, 인라인 주석(앞 N개 provider 순서 그대로)이 기대값 배경을 제공한다.

## 요약

테스트 관점에서 이번 변경셋의 핵심 신규 로직(`capModelList`)은 전용 단위 테스트 파일에서 경계값·경고 경로·격리까지 충실히 커버되며, 양 서비스 통합 경로에도 cap 시나리오가 추가되어 전체 테스트 품질은 양호하다. 이전 리뷰에서 지적된 spy 격리 이슈(W-3)가 `try/finally` 로 최종 코드에 정상 반영되어 있다. 잔여 갭은 모두 INFO 수준이며 RESOLUTION.md 에서 이미 인지·보류 처리된 항목(I-10/I-11/I-12)과 맥락을 같이한다. 새로운 차단 이슈는 없다.

## 위험도

LOW

---

STATUS=success ISSUES=0
