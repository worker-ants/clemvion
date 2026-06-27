# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] SENSITIVE_ACTION_THROTTLE 공유 객체 참조 — 런타임 변경 시 교차 도메인 전파
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/common/constants/throttle.ts`, `llm-model-config.controller.ts`, `workspaces.controller.ts`
- 상세: `PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE` 와 `INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE` 가 동일 객체를 참조한다. `as const` 가 TypeScript 타입 레벨에서 변경을 차단하지만 JavaScript 런타임에서는 `Object.freeze` 가 없으므로 이론적으로 `PROVIDER_PROBE_THROTTLE.default.limit = 5` 형태의 런타임 변경이 `INVITATION_THROTTLE` 에도 즉시 전파된다. 실제 코드베이스에서 throttle config 객체를 변경하는 경로가 없고 `@Throttle` 데코레이터는 모듈 로드 시 메타데이터로 읽히므로 현재 실질 위험은 없다. 정책이 갈릴 경우 주석이 명시적으로 분리 지침을 제공한다.
- 제안: 실질 위험 없음 — 현행 유지. 강화하려면 `Object.freeze(SENSITIVE_ACTION_THROTTLE)` 및 `Object.freeze(SENSITIVE_ACTION_THROTTLE.default)` 를 적용해 런타임 변경 시도를 즉시 오류로 표면화할 수 있다.

### [INFO] capModelList — 상한 이하 시 입력 배열 원본 참조 반환
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/list-models-cap.ts` (line: `if (models.length <= MAX_MODEL_LIST_SIZE) return models;`)
- 상세: 500 개 이하이면 `slice` 없이 입력 참조를 그대로 반환한다. `llm.service.ts` 는 이 반환값을 `listModelsCache` 에 저장하는데, 만약 LLM 클라이언트가 같은 배열 참조를 내부적으로 재사용(캐싱)하고 있다면 서비스 캐시와 클라이언트 내부 상태가 같은 배열을 공유하게 된다. 현재 각 `listModels` 호출이 새 배열을 반환하는 것으로 추정되며, 코드베이스에 해당 배열을 in-place 변경하는 경로가 없다. `previewModels` 는 캐시가 없으므로 해당 없음.
- 제안: 실질 위험 없음 — 현행 유지. LLM 클라이언트가 내부 상태를 공유하지 않는 한 안전하다.

### [INFO] LlmService.listModels opts.type 타입 변경 — 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm.service.ts` (line: `opts?: { type?: ModelTypeFilter }`)
- 상세: 이전 `'chat' | 'embedding'` 인라인 유니온에서 `ModelTypeFilter`(`= 'chat' | 'embedding'`) 타입 별칭으로 전환되었다. 런타임 값과 TypeScript 구조 타입 모두 동일하므로 기존 호출자(`LlmModelConfigController`)에게 어떠한 행동 변경도 발생하지 않는다. 순수한 타입 레벨 리팩터.
- 제안: 조치 불필요.

### [INFO] capModelList 캐시 전 적용 순서 — 의도적 정상 동작
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm.service.ts` (line: `models = capModelList(models, this.logger); this.listModelsCache.set(...)`)
- 상세: cap 이 캐시 쓰기 직전에 적용된다. 캐시 히트 경로는 이미 capped 된 목록을 반환하며, cap 은 한 번만 실행된다. 이 순서가 전도되면(캐시에 원본 저장 후 cap 적용) 캐시 히트 시 cap 이 바이패스되는 버그가 생기므로 현재 순서가 올바르다. 의도치 않은 상태 변경 없음.
- 제안: 조치 불필요.

## 요약

이번 변경셋은 부작용 관점에서 안전하다. 신규로 도입된 전역 변수가 없고(새 파일의 `export const` 는 모듈 스코프), 파일시스템 부작용이 없으며, 의도치 않은 네트워크 호출이 없고, 이벤트/콜백 등록 변경이 없다. `LlmService.listModels` 시그니처 변경은 타입 별칭 교체로 런타임에 투명하며 기존 호출자에 영향이 없다. 공개 API 동작(엔드포인트 경로·메서드·응답 shape)은 무변경이다. `@ApiTooManyRequestsResponse` 및 `enumName` 추가는 OpenAPI 메타데이터 전용으로 런타임 핸들러 동작에 영향을 주지 않는다. 유일한 주의점은 `SENSITIVE_ACTION_THROTTLE` 공유 객체 참조와 `capModelList` 원본 참조 반환이나, 두 경우 모두 실질적인 변경 경로가 없어 현재 코드베이스에서 문제가 발생하지 않는다.

## 위험도

LOW

---

STATUS=success ISSUES=0
