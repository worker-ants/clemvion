# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `testMutation.onSuccess` — async 핸들러에서 발생하는 암묵적 사이드이펙트 (자동 PATCH)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-manager.tsx` `testMutation.onSuccess`
- 상세: `mutationFn`은 `testConnection` 한 번 호출을 의도하지만, `onSuccess` 핸들러가 `embedding` kind이고 `result.dimension`이 존재하면 `modelConfigsApi.update(config.id, { dimension: dim })` 를 추가로 실행한다. 즉, "연결 테스트" 버튼 클릭 한 번이 서버 상태를 두 번(testConnection + PATCH) 변경하는 숨겨진 사이드이펙트를 발생시킨다. 사용자 인지 없이 저장이 이루어지며, TanStack Query의 `onSuccess`는 반환 Promise를 무시하므로 이 `await` 체인의 에러가 React Query 오류 경계에 도달하지 않는다. 현재는 catch로 소화하지만, 이 패턴이 복잡해지면 silent failure가 늘어날 위험이 있다.
- 제안: 의도는 명확하며 기능 동작에 즉각적 결함은 없다. 단, `onSuccess` 에 한 줄 주석으로 "이 핸들러는 testConnection 외에 PATCH /model-configs/:id 를 추가로 발생시킴" 을 명시하거나, `useTestConnection` 커스텀 훅으로 사이드이펙트를 캡슐화해 호출자가 인지할 수 있도록 구조화하는 것을 권장한다.

### [WARNING] `testMutation` `mutationFn` 인자 타입 변경 — 잠재적 호출자 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-manager.tsx` L453, L213
- 상세: `mutationFn`이 `(id: string)` 에서 `(config: ModelConfigData)` 로 변경됐다. diff 내 호출부(`onClick`)도 동시에 `config.id` → `config`로 갱신됐으므로 현재 코드는 일관성이 있다. 그러나 이 mutation을 외부 또는 다른 컴포넌트에서 `testMutation.mutate(someId)` 형태로 직접 호출하는 경우가 있다면 TypeScript 컴파일 오류가 아닌 런타임에서 잘못된 인자(`string` → `ModelConfigData`)가 전달될 수 있다. diff 범위에서는 단일 `onClick` 호출자만 보이므로 현재 사용처에서는 문제없다.
- 제안: 이 mutation이 내부 전용(`model-config-manager.tsx` 스코프)임이 명확하면 현 상태로 충분하다. 만약 다른 컴포넌트에서 재사용 중이라면 TypeScript 타입 오류로 컴파일 시점에 포착되므로 낮은 위험이다.

### [INFO] `LlmService.testConnection` 반환 타입 확장 — 기존 호출자의 `dimension` 미처리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/backend/src/modules/llm/llm.service.ts` L249
- 상세: 반환 타입이 `{ success: boolean; error?: string }` 에서 `{ success: boolean; error?: string; dimension?: number }` 로 확장됐다. 선택적 필드 추가이므로 기존 호출자(컨트롤러 등)가 `dimension`을 무시하면 이전과 동일하게 동작한다. 하위 호환성은 유지된다. 단, 컨트롤러가 `ModelTestConnectionResultDto`로 매핑할 때 `dimension`을 명시적으로 포함시켜야 프론트엔드가 실제로 값을 수신한다. diff 범위에서 컨트롤러 코드는 포함되지 않아 매핑이 올바른지 확인이 필요하다.
- 제안: 컨트롤러 응답 매핑 코드(`model-config.controller.ts` 의 testConnection 핸들러)에서 `{ ...result }` 또는 명시적 `dimension: result.dimension` 전달이 이루어지는지 확인할 것.

### [INFO] `findEntity` 호출 시 `kind` 파라미터 제거 — 기존 동작 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/backend/src/modules/llm/llm.service.ts` `testConnection` L257, `listModels` L292
- 상세: 기존 `this.modelConfigService.findEntity(configId, workspaceId, 'chat')` 에서 `'chat'` 인자가 제거됐다. 이는 의도된 버그픽스이나, `findEntity`의 3번째 인자(`kind`)가 선택적이어야 함을 전제한다. `ModelConfigService.findEntity`의 시그니처가 `kind`를 필수로 받는 경우 TypeScript 컴파일 에러가 발생하므로 빌드 통과가 이를 간접 증명하나, 런타임에서 `kind` 인자 없이 조회 결과가 예상과 다른 레코드를 반환하는 엣지케이스는 없는지 `findEntity` 구현을 별도 확인하는 것이 좋다.
- 제안: `ModelConfigService.findEntity(id, workspaceId)` — kind 없이 호출 시 어떤 설정 레코드가 반환되는지(복수 레코드 중 임의 선택 여부 등) `findEntity` 구현을 일독 권장. 현재 테스트 통과(unit 4253 passed, e2e 188/188)로 정상 동작은 확인됐다.

### [INFO] `ModelTestConnectionResultDto.dimension` 추가 — Swagger 공개 API 계약 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` L204-210
- 상세: `@ApiPropertyOptional`로 `dimension?: number`가 추가됐다. Swagger 문서에 새 필드가 노출되는 것은 additive 변경이므로 기존 API 소비자를 깨뜨리지 않는다. 이것이 의도된 공개 API 확장임은 명확하다. 사이드이펙트 없음.
- 제안: 이상 없음.

### [INFO] `invalidate()` 호출 — QueryClient 캐시 전체 무효화 범위 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-manager.tsx` `onSuccess` 내 `invalidate()` 호출
- 상세: `dimension` 자동 저장 후 `invalidate()`를 호출하는데, `invalidate`의 구현 범위(특정 쿼리 키만 무효화하는지, 전체 캐시를 무효화하는지)에 따라 의도치 않은 리패치가 발생할 수 있다. diff에서 `invalidate`가 어떻게 정의됐는지 보이지 않으므로(컴포넌트 상위에서 정의된 것으로 추정), 범위가 좁은지 확인이 필요하다. 기존에 이미 사용 중인 패턴이라면 문제없다.
- 제안: `invalidate()`가 현재 `kind` 의 model-configs 쿼리 키만 무효화하는지 확인. 의도보다 넓은 범위를 무효화하면 불필요한 네트워크 요청이 발생한다.

### [INFO] `model-config-form-dialog.tsx` — `dimensionAutoDetected` 기반 `readOnly` 적용이 form 상태에 영향
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/components/models/model-config-form-dialog.tsx` L373-374, L382-383
- 상세: `readOnly={dimensionAutoDetected}` 는 `editConfig?.dimension != null` 조건으로 결정된다. 편집 모드에서 차원이 이미 저장된 경우 필드가 잠기는 것은 의도된 동작이다. 단, `readOnly` HTML 속성은 폼 제출을 막지 않으며 여전히 `form.dimension` 값은 제출 시 포함된다. 사용자가 `readOnly` 상태를 JS로 우회해 값을 변경해도 현재 `onChange`가 붙어 있으므로 실제로는 onChange가 호출된다. `readOnly`만으로는 완전한 잠금이 보장되지 않는다.
- 제안: 서버에서 "차원이 이미 감지된 경우 사용자 변경을 거부"하는 검증이 없다면, 악의적 또는 실수에 의한 값 변경을 클라이언트 단에서 `disabled`로 추가 방어하거나 서버 검증으로 보완하는 것을 고려할 것. 단, UX 의도(감지값 표시 + 수동 입력 허용 안 함)가 명확하므로 현재는 INFO 수준이다.

### [INFO] i18n 딕셔너리 — 전역 공유 객체에 키 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/lib/i18n/dict/en/models.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/codebase/frontend/src/lib/i18n/dict/ko/models.ts`
- 상세: `dimensionAutoHint`, `dimensionManualHint`, `connectionSucceededDim` 세 키가 추가됐다. i18n 딕셔너리는 `as const` 전역 공유 객체이므로 추가된 키가 en/ko 양 언어에 정합하는지 확인이 필요하다. 두 파일 모두 동일한 키가 추가됐고 내용도 의미상 대칭적이므로 정합성은 유지된다. 사이드이펙트 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경은 embedding 설정의 연결 테스트 경로를 kind-agnostic으로 수정하고 probe embed 결과로 차원을 자동 감지·저장하는 기능을 추가한다. 부작용 관점에서 가장 주목할 점은 프론트엔드 `testMutation.onSuccess`가 연결 테스트 외에 PATCH 요청을 추가로 발생시키는 숨겨진 사이드이펙트이며, 이는 의도적이지만 사용자에게 명시적으로 안내되지 않는다. `mutationFn` 인자 타입이 `string` 에서 `ModelConfigData` 로 변경된 점도 내부 전용 사용이라면 문제없으나 외부 재사용 가능성을 고려해야 한다. 백엔드에서 `findEntity` 호출 시 `kind` 인자를 제거한 것은 회귀 수정의 핵심이며, 이미 테스트(unit 4253 passed, e2e 188/188)로 정상 동작이 검증됐다. 반환 타입 확장(`dimension?`)은 additive 변경으로 하위 호환성을 유지한다. 전역 상태 오염, 환경 변수 변경, 예상치 못한 파일시스템 부작용, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
