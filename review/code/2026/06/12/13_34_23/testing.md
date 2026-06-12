# Testing Review — code-followups-impl

## 발견사항

### **[INFO]** `resolveMemoryLimitMb()` 단위 테스트 — 경계값 커버리지 양호하나 부동소수점 입력 케이스 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.spec.ts` `resolveMemoryLimitMb` describe 블록 (L821–L859)
- 상세: `'abc'`, `'0'`, `'-5'`, `''`, `'   '` 의 invalid 케이스를 `it.each` 로 커버하며 기본값 반환을 확인한다. 그러나 `Number.parseInt('256.9', 10)` 은 `256`으로 파싱돼 정상 동작하므로, `'256.9'` 입력이 `256` (유효한 in-range 값)을 반환하는지 또는 기본값을 반환하는지 명시적으로 문서화된 테스트가 없다. `parseInt`는 소수점 이하를 절사하므로 현재 구현상 `256`을 반환하며 이는 의도된 동작이다. 문서화 차원에서 테스트 추가를 고려할 수 있다.
- 제안: `'256.9'` 케이스를 valid 케이스 배열에 추가해 `256`을 반환함을 명시 (또는 기존 주석으로 설명 보완).

### **[INFO]** `resolveMemoryLimitMb()` 는 module-load-time 상수를 간접 테스트 — 실제 격리 한도 적용 여부를 직접 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` L1089
- 상세: `ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb()` 는 모듈 로드 시 한 번만 평가된다. 따라서 `resolveMemoryLimitMb()` 직접 테스트는 함수 로직을 올바르게 검증하지만, `process.env` 변경 → isolate 실제 메모리 한도 적용 경로는 테스트할 수 없다. 이는 의도적 설계(코멘트에 명시)이며 메모리 한도 통합 테스트의 경우 단일 Jest 프로세스 내에서 모듈 재로드 없이 env 변경이 반영 안 된다는 점이 명확하게 주석으로 서술돼 있다.
- 제안: 현재 설계로 수용 가능. 운영 변경 시 인스턴스 재시작이 필요함을 `.env.example` 주석과 일치시켜 문서화 (이미 완료).

### **[INFO]** `base64` 비문자열 TypeError 테스트 — `it.each` 케이스 서술에 `%s` placeholder 형식 오류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.spec.ts` L752–L769
- 상세: `it.each` 배열 항목이 `[_op, code]` 형태이고, 테스트 제목 문자열이 `'should route non-string $helpers.base64.%s input to the error port (TypeError)'`로 작성돼 있다. Jest `it.each` 의 `printf` 포맷(`%s`, `%d` 등)은 배열 인덱스 순으로 치환되므로 `%s`가 `_op` (첫 번째 값 `'encode'`/`'decode'`)로 치환되어 테스트명은 올바르게 렌더된다. 기능 이상은 없으나, 테스트 제목의 `%s` 포맷 사용 패턴이 다른 `it.each` 블록(문자열 단일 파라미터 + `%s`)과 혼용돼 읽는 사람에게 혼동을 줄 수 있다.
- 제안: 배열 destructuring `it.each` 에서는 `$op` 같은 named 포맷을 사용하는 것이 더 명확하다 (Jest `it.each` template-literal 스타일 또는 `$variable` 문법).

### **[INFO]** `_buildIsolateContext` 와 `_runWithTimeout` private 메서드 — 직접 단위 테스트 미존재 (설계상 수용 가능)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` L1887, L1961
- 상세: 리팩터링으로 `execute()` 내부 로직이 두 private 메서드로 추출됐다. private 메서드 자체는 `handler.execute()` 통합 테스트를 통해 간접 커버된다. `_runWithTimeout`은 특히 dual-timeout race 로직을 포함하므로 별도 단위 테스트가 있으면 유지보수성이 높아지나, `ivm.Script`·`ivm.Context` 를 mocking 없이 사용하기 어렵고 기존 `execute` 테스트로 이미 race 시나리오를 커버하고 있다.
- 제안: 현재 설계로 수용 가능. `_runWithTimeout` 의 wall-clock timeout 분기(`EXECUTION_TIMEOUT` 코드를 host 가 직접 설정)는 기존 timeout 테스트로 커버된다. 추가 테스트 불필요.

### **[INFO]** `execution-failure-classifier.ts` — comment-only 변경이므로 기존 테스트로 회귀 완전 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`
- 상세: 변경은 `CODE_MEMORY_LIMIT` 코드 위 주석 텍스트만 수정한 것이다. `execution-failure-classifier.spec.ts` 에 `CODE_MEMORY_LIMIT` → `executionFailedInternal` 검증이 포함돼 있으며, 주석 변경은 로직에 영향을 주지 않는다. 기존 테스트가 유효하게 유지된다.
- 제안: 없음.

### **[INFO]** `error-codes.ts` — comment-only 변경이므로 기존 테스트로 회귀 완전 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/core/error-codes.ts`
- 상세: `CODE_MEMORY_LIMIT` 코드 위 주석 텍스트만 변경됐다. `ErrorCode` 상수값 자체는 변경 없으며 로직·타입에 영향 없다.
- 제안: 없음.

### **[INFO]** i18n 레이블 변경 (`backend-labels.ts`) — 프론트엔드 parity guard 테스트로 커버 여부 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/frontend/src/lib/i18n/backend-labels.ts` L3012–L3013
- 상세: `ERROR_KO.CODE_MEMORY_LIMIT` 값이 `"코드 실행 중 메모리 한도(128MB)를 초과했어요."` → `"코드 실행 중 메모리 한도를 초과했어요."`로 변경됐다. 파일 내 주석에 따르면 `__tests__/backend-labels.test.ts` 가 parity guard 를 수행한다. 이 guard 가 키의 존재 유무만 검사하는지, 아니면 값의 패턴/내용도 검증하는지에 따라 해당 변경이 회귀 위험을 일으킬 수 있다.
- 제안: `backend-labels.test.ts` 에서 `ERROR_KO['CODE_MEMORY_LIMIT']` 값의 정확한 스냅샷을 검사하는 테스트가 있다면 업데이트 필요. 키 존재만 검사하는 guard 라면 추가 조치 불필요.

### **[INFO]** MDX 문서 변경 — 자동화 테스트 외부 (문서 레벨 변경)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/frontend/src/content/docs/02-nodes/data.en.mdx`, `data.mdx`
- 상세: 문서 텍스트 변경은 프론트엔드 컴포넌트 렌더링 테스트 범위를 벗어난다. 변경 내용(메모리 한도 128MB 하드코딩 → 조정 가능 표현)은 기능 로직에 영향 없다.
- 제안: 없음.

### **[INFO]** `jest.retryTimes(2)` 사용 — CI 불안정성 완화 전략의 적절성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.spec.ts` L793–L795
- 상세: memory-limit 테스트가 CPU timeout 과 race 하는 CI 불안정성을 `jest.retryTimes(2)` + `afterAll(() => jest.retryTimes(0))` 로 완화한다. 재시도 범위를 describe 블록으로 한정하고 `afterAll` 에서 리셋하는 패턴은 테스트 격리를 적절히 유지한다. 재시도 후에도 실패하면 진짜 회귀로 감지된다.
- 제안: 현재 구현 적절. 다만 이 describe 블록 내 non-race 테스트(예: 향후 추가 테스트)에도 재시도가 적용되므로, 실제 race 가 발생하는 특정 `it` 에만 `{ retry: 2 }` 옵션을 적용하는 더 세밀한 접근도 고려 가능.

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. 핵심 신기능인 `resolveMemoryLimitMb()` 는 기본값·유효 범위·512 상한 클램핑·다양한 invalid 입력을 `it.each` 로 망라하여 직접 단위 테스트한다. `$helpers.base64` 비문자열 TypeError 는 `it.each` 4개 케이스로 encode/decode 양방향을 검증하며, invalid base64 string 의 silent 처리와 명확히 구분된다. 리팩터링된 `_buildIsolateContext`·`_runWithTimeout` private 메서드는 기존 `execute()` 통합 테스트로 간접 커버된다. `execution-failure-classifier.ts` 와 `error-codes.ts` 의 comment-only 변경은 기존 테스트로 회귀 검증이 충분하다. 주목할 사항은 `ISOLATE_MEMORY_LIMIT_MB` 가 모듈 로드 시 한 번 평가되어 env 변경 후 재시작 없이는 반영 안 되는 구조이며, 이를 직접 검증하는 통합 테스트는 단일 Jest 프로세스 내에서 구조적으로 불가능하다는 점이다. 이는 함수 직접 단위 테스트로 적절히 보완되었다. i18n 레이블 변경이 `backend-labels.test.ts` 의 스냅샷 테스트에 영향을 줄 수 있으므로 해당 테스트 파일 확인이 필요하다.

## 위험도

LOW
