# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `MODEL_TYPE_ENUM` 이 컨트롤러 파일 내부에 비공개(unexported)로 정의됨
- 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L279-280
- 상세: `MODEL_TYPE_ENUM` 과 `ModelTypeFilter` 타입이 컨트롤러 모듈 스코프에만 선언되고 `export` 가 없다. `LlmService.listModels` 의 `type` 파라미터 시그니처가 독립적으로 타입을 정의하거나 `string` 을 허용한다면, 허용 값의 진실 원본이 컨트롤러(ParseEnumPipe 인자)와 서비스 레이어에 분리되는 잠재적 이중 SOT 상황이 생긴다. 현재 변경 범위 기준으로는 서비스 시그니처를 볼 수 없어 잠재 수준에 머문다.
- 제안: `MODEL_TYPE_ENUM` 과 `ModelTypeFilter` 를 DTO 파일(`model-config-response.dto.ts` 또는 별도 `model-config.types.ts`)로 이동 후 export 하고, 컨트롤러와 서비스 시그니처 모두에서 import 해 단일 SOT 를 유지하는 것을 장기적으로 고려. 현재는 컨트롤러 경계에서만 사용하므로 즉각 차단은 아님.

---

### [INFO] `PROVIDER_PROBE_THROTTLE` 내부 속성 순서가 원본 인라인 리터럴과 역전됨
- 위치: `/codebase/backend/src/modules/llm/llm-model-config.controller.ts` L276 vs 기존 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`
- 상세: 기존 코드는 `{ limit: 10, ttl: 60_000 }` 순서였으나 상수로 추출하면서 `{ ttl: 60_000, limit: 10 }` 으로 순서가 바뀌었다. 기능적 영향은 없으나 `git blame` 이나 diff 검토 시 의도치 않은 변경인지 오해를 줄 수 있다.
- 제안: 속성 순서를 원본(`limit, ttl`)과 일치시키거나, 팀 컨벤션대로 고정. 가독성보다 trivial 하므로 즉각 수정 필요는 없음.

---

### [INFO] `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 항목이 단일 초장문 단락으로 누적 확장됨
- 위치: `plan/in-progress/refactor/02-architecture.md` L1074 (변경된 줄)
- 상세: 이번 PR 의 변경은 "PR 대기" → "PR #714 `000d8963` 머지 완료" 업데이트이며, 이 자체는 적절하다. 그러나 해당 리스트 항목이 이미 5,000자 이상의 단일 문장으로 성장해 있어 향후 스캔·diff 가독성이 낮다. 이번 변경이 이 문제를 야기한 것은 아니나 추가 확장이 이루어졌다.
- 제안: 항목이 완료되면 핵심 결정과 PR 번호만 남기고 상세 서술을 `plan/complete/` 로 이동하는 것이 장기 유지보수에 유리함. 현 PR 범위에서 강제 사항은 아님.

---

## 긍정적 발견 (장점)

- **DRY 준수**: `@Throttle` 설정이 3곳에서 각각 인라인 리터럴(`{ default: { limit: 10, ttl: 60_000 } }`)로 중복되던 것을 `PROVIDER_PROBE_THROTTLE` 단일 상수로 통합했다. 한도·TTL 값을 한 곳에서 조정할 수 있다.
- **단일 SOT 파생**: `@ApiQuery enum` 과 `ParseEnumPipe` 인자가 각각 `['chat', 'embedding']` 하드코딩이었던 것을 `MODEL_TYPE_ENUM` 에서 `Object.values(...)` 로 파생시켜 동기화 오류 가능성을 제거했다.
- **의도 명확성**: 두 상수 위 주석이 "왜 이 구조인가"를 설명하고 있어 후임자가 설계 배경 없이도 파악 가능하다.
- **함수 길이/중첩**: 핸들러 3개 모두 1~3줄 본체, 중첩 없음. 단일 책임.
- **테스트 배치**: `ParseEnumPipe` 검증을 단위 테스트로 커버할 수 없는 이유(pipe wiring 우회)를 e2e 주석에 명시해 향후 테스트 레이어 선택의 근거를 기록했다.

## 요약

이번 변경의 핵심인 `llm-model-config.controller.ts` 수정은 유지보수성 관점에서 전반적으로 개선 방향이다. 매직 넘버·중복 리터럴을 제거하고 단일 SOT 상수로 대체했으며, 코드 자체는 간결하고 의도가 명확하다. 식별된 발견사항은 모두 INFO 등급으로, `MODEL_TYPE_ENUM` 의 비공개 범위가 서비스 레이어 타입과 분리될 가능성을 장기적으로 모니터링할 필요가 있으나 현재 기능 계약에 영향을 주지 않는다. 문서·플랜 파일 변경은 참조 갱신 수준이며 유지보수성에 별다른 부담을 추가하지 않는다.

## 위험도

LOW
