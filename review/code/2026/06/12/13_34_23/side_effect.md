# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] 모듈 로드 시점 환경 변수 고정 — 런타임 재설정 불가
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `const ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb();`
- **상세**: `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수가 모듈 로드 시점에 한 번만 읽혀 `ISOLATE_MEMORY_LIMIT_MB` 상수에 고정된다. 이는 의도된 설계이며 주석에도 명시되어 있다("Resolved once at module load"). 그러나 부작용 관점에서, 이 상수는 모든 `execute()` 호출에서 공유 상태로 작용한다. 환경 변수를 프로세스 실행 중에 변경하더라도 이미 로드된 모듈의 상수는 갱신되지 않는다. 테스트 환경에서는 `resolveMemoryLimitMb()`를 직접 호출해 단위 테스트하도록 설계되어 있으나, 통합 테스트에서 `CODE_NODE_MEMORY_LIMIT_MB`를 변경한 뒤 모듈을 재임포트하지 않으면 변경이 적용되지 않는다.
- **제안**: 현재 설계는 문서화된 의도(isolate-lifetime semantics)와 일치하므로 변경 필요 없음. 다만 테스트 코드(`code.handler.spec.ts`)가 모듈 레벨 상수(`ISOLATE_MEMORY_LIMIT_MB`)가 아닌 `resolveMemoryLimitMb()`를 직접 테스트하는 점이 이 한계를 올바르게 인식하고 우회한 설계임.

### [WARNING] `process.env` 직접 읽기 — NestJS ConfigService 우회
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `resolveMemoryLimitMb()` 내 `process.env.CODE_NODE_MEMORY_LIMIT_MB`
- **상세**: 다른 환경 변수들은 NestJS `ConfigService`를 통해 타입 안전하게 읽히지만, `CODE_NODE_MEMORY_LIMIT_MB`는 `process.env`를 직접 읽는다. 이는 모듈 로드 시점(NestJS 부트스트랩 이전 가능성)에 값을 확정해야 하기 때문으로 보이나, 타입 검증·기본값·유효성 검사가 `resolveMemoryLimitMb()` 내에서 직접 구현되어 ConfigModule 스키마 검증을 우회한다. 환경 변수 설정 오류가 부트 시 감지되지 않고 런타임에 기본값으로 silent-fallback된다.
- **제안**: 중요도 낮음 — `resolveMemoryLimitMb()`가 잘못된 값을 128로 fallback하므로 안전하다. 단, 프로덕션에서 설정 오류가 조용히 무시될 수 있으므로 모듈 초기화 시 warn 로그 추가를 권장.

### [INFO] `syntaxIsolate` 모듈 레벨 변경 가능 상태 — 기존 패턴, 변경 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `let syntaxIsolate: ivm.Isolate | undefined`
- **상세**: `syntaxIsolate`는 모듈 레벨 변경 가능 변수로, `validate()` 호출 간 상태를 공유한다. 이번 PR에서 새로 도입된 것이 아니라 기존 코드이며, 이번 변경으로 인한 추가 부작용은 없다. 그러나 `_buildIsolateContext`와 `_runWithTimeout`을 private 메서드로 분리한 리팩터링에서 이 공유 상태(`syntaxIsolate`)가 여전히 `validate()`에서만 접근되고 `execute()` 흐름(새 private 메서드들)에서는 접근하지 않음을 확인함 — 격리 올바름.
- **제안**: 기존 설계 유지. 변경 없음.

### [INFO] `hostB64Encode` / `hostB64Decode` 신규 도입 — 동작 변경 (TypeError 추가)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `hostB64Encode`, `hostB64Decode` 함수
- **상세**: 이전 코드는 `__host_b64encode`/`__host_b64decode` 콜백 내에서 `String(data)` 암묵적 강제변환을 사용했다. 이번 변경으로 비문자열 입력 시 `TypeError`를 throw하도록 변경되었다. 이는 `$helpers.base64.encode(42)` 같은 기존 코드 노드가 있다면 조용히 성공하던 것이 `error` 포트로 라우팅되는 행동 변화(breaking change)다. 그러나 이 변경은 스펙 §2.2의 "입력 타입 계약"을 명시적으로 구현한 것이며, 기존 `$helpers.crypto.hash`의 타입 가드와 일관성을 맞춘 의도적 변경이다.
- **제안**: 기존 워크플로우 중 `base64.encode/decode`에 비문자열을 전달하는 경우 에러 포트로 분기됨을 마이그레이션 노트에 기재할 것. 부작용은 의도적이고 명시적이나, 기존 워크플로우에 대한 하위 호환성 영향이 있다.

### [INFO] `_buildIsolateContext` private 메서드 분리 — 공개 API 변경 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `_buildIsolateContext`, `_runWithTimeout` 메서드
- **상세**: `execute()` 내 인라인 로직을 private 메서드로 추출한 순수 리팩터링이다. `CodeHandler`의 공개 인터페이스(`execute`, `validate`)는 변경 없음. `NodeHandler` 인터페이스 준수 유지. 부작용 없음.
- **제안**: 이상 없음.

### [INFO] 테스트에서 `process.env` 직접 조작 — beforeEach/afterEach 복원 패턴 올바름
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.spec.ts` — `resolveMemoryLimitMb` describe 블록
- **상세**: 테스트가 `process.env[ENV_KEY]`를 직접 설정/삭제하며, `beforeEach`에서 저장하고 `afterEach`에서 복원한다. 이 패턴은 환경 변수 누출을 올바르게 방지한다. `jest.retryTimes(2)` / `afterAll(() => jest.retryTimes(0))` 패턴도 다른 describe 블록에 영향을 주지 않도록 올바르게 초기화된다.
- **제안**: 이상 없음.

### [INFO] 문서 및 i18n 변경 — 부작용 없음
- **위치**: `codebase/frontend/src/content/docs/02-nodes/data.en.mdx`, `data.mdx`, `codebase/frontend/src/lib/i18n/backend-labels.ts`
- **상세**: 문서와 i18n 문자열에서 "128MB" 하드코딩을 제거하고 "메모리 한도" / "128MB by default" 표현으로 변경. 이는 순수 문서 변경으로, 런타임 상태·API·이벤트에 영향을 주지 않는다.
- **제안**: 이상 없음.

---

## 요약

이번 변경의 핵심 부작용은 두 가지다. 첫째, `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수가 모듈 로드 시점에 한 번 읽혀 프로세스 수명 동안 고정된다(의도된 설계이나 테스트 격리 시 주의 필요). 둘째, `$helpers.base64.encode`/`decode`에 비문자열을 전달하던 기존 워크플로우가 이제 `error` 포트로 분기되는 행동 변화가 발생한다(스펙 §2.2 준수를 위한 의도적 breaking change). 전역 변수 오염, 파일시스템 부작용, 의도치 않은 네트워크 호출, 공개 API 시그니처 변경은 없다. `_buildIsolateContext`/`_runWithTimeout` 분리는 순수 리팩터링이며 격리 불변식(각 exec마다 fresh isolate)을 그대로 유지한다. 환경 변수 읽기가 `process.env`를 직접 사용해 ConfigService를 우회하지만, 잘못된 값에 대한 safe fallback이 구현되어 있어 안전성은 유지된다.

## 위험도

LOW
