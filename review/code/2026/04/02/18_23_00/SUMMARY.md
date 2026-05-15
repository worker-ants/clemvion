# Code Review 통합 보고서

## 전체 위험도
**HIGH** - 혼합 표현식(mixed text + expression) 처리 로직 버그로 인해 대부분의 노드에서 잘못된 string 보간이 발생할 수 있으며, 실행 컨텍스트 데이터 부정확성 및 보안·성능 이슈 다수 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 로직 버그 | `resolveString()`의 혼합 표현식 처리 미구현. `FULL_EXPRESSION_PATTERN` 분기와 mixed 분기가 모두 동일하게 `return result`를 실행하여 타입 보존 의도가 없음. 스펙 §8.3.1은 "혼합 텍스트+표현식은 항상 string 반환"을 요구하나, `evaluate()`가 mixed 템플릿을 string으로 보간하지 않으면 `"Hello {{ $input.name }}"` → `"Alice"` (텍스트 유실) 또는 잘못된 타입 반환 | `expression-resolver.service.ts` — `resolveString()` | `FULL_EXPRESSION_PATTERN`이 불일치하는 경우(혼합 텍스트) `{{ }}` 블록별로 분리하여 `evaluate()` 후 나머지 텍스트와 조합하는 로직을 구현하거나, mixed 분기에서 명시적으로 `return String(result)` 처리 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 정확성 | `$execution.mode`가 항상 `'manual'`로 하드코딩. 스케줄·웹훅·API 트리거 실행 시에도 잘못된 값이 반환되어, mode 기반 분기를 사용하는 모든 워크플로우 표현식이 오동작 | `expression-resolver.service.ts:43` — `buildExpressionContext()` | `ExecutionContext` 인터페이스에 `mode` 필드를 추가하고 실제 실행 트리거 유형을 전달 |
| 2 | 정확성 | `$execution.startedAt`이 실제 실행 시작 시각이 아닌 표현식 해석 시점의 `new Date()`를 사용. 장시간 실행 워크플로우에서 노드마다 다른 `startedAt`이 주입됨 | `expression-resolver.service.ts:38` — `buildExpressionContext()` | `ExecutionContext`에 `startedAt` 필드 추가, 또는 `Execution` 엔티티에서 실제 시작 시각 전달 |
| 3 | 보안 | `MAX_DEPTH` 초과 시 미해석된 `{{ }}` 표현식 문자열을 포함한 원본 객체를 그대로 핸들러에 전달. SQL 쿼리·HTTP URL 등에 raw 표현식 문자열이 삽입될 수 있음 | `expression-resolver.service.ts` — `resolveObject()`, `if (depth > MAX_DEPTH) return obj` | 깊이 초과 시 에러를 throw하거나, 최소한 `Logger.warn()`으로 경고 로깅 후 추적 가능하게 처리 |
| 4 | 보안 | 에러 메시지에 `value`(실제 config 원본값) 포함. config에 비밀번호·API 토큰 등이 있을 경우 로그/에러 추적 시스템에 민감 정보가 노출될 수 있음 | `expression-resolver.service.ts` — `resolveString()` `throw new Error(... template: "${value}" ...)` | `template` 부분 제거, 또는 길이 제한·마스킹 후 포함 |
| 5 | 스펙 불일치 | `ExpressionHighlight`가 `multiline=true` 입력(System Prompt, Query, Body 등 핵심 필드)에서 완전히 비활성화. 스펙 §8.4.1은 모든 `ExpressionInput`에 `{{ }}` 하이라이트를 요구 | `expression-input.tsx:165` — `{hasExpression && !multiline && ...}` | textarea에도 하이라이트 오버레이 적용, 또는 `contenteditable` 기반으로 교체. 의도적 미구현이라면 스펙에 명시 |
| 6 | 정확성 | `validate()` 호출 시 이중 래핑 가능성. `EXPR_BLOCK_RE`가 `{{ expr }}`에서 `expr`을 캡처한 뒤 다시 `` `{{ ${m[1]} }}` ``로 래핑하여 `validate()` 호출 — `validate()`가 순수 표현식 텍스트를 받는다면 `` {{ {{ expr }} }} ``이 전달됨 | `expression-input.tsx` — `validateExpressions()` | `expression-engine`의 `validate()` 시그니처 확인 후 호출 방식 정렬 |
| 7 | UX 버그 | `autocompleteOpen`이 `true`인 상태에서 사용자 입력으로 `suggestions` 목록이 변경될 때 `selectedIndex`가 리셋되지 않음. 목록 개수가 줄어들면 `clampedIndex`로 보정되지만 직관적이지 않은 선택 상태 발생 | `expression-input.tsx` — `handleInput` 콜백 | `suggestions` 변경 시 `setSelectedIndex(0)` 호출하는 `useEffect` 추가 |
| 8 | 경계값 버그 | `getExpressionToken()` 역방향 스캔에서 `i === 0`일 때 `value[-1]`(`undefined`) 접근. `}}` 닫힘 감지가 문자열 맨 앞에서 누락될 수 있음 | `use-expression-suggestions.ts` — `getExpressionToken()` | `i > 0 && value[i] === "}" && value[i-1] === "}"` 조건으로 수정 |
| 9 | 빌드 | `next build --webpack` 플래그가 Turbopack을 강제 비활성화. 빌드 성능 저하를 유발하는 임시 우회책이며 이유가 명시되지 않음 | `frontend/package.json:7` | 로컬 패키지 `main`/`exports`·`tsconfig` 설정으로 Turbopack 호환 해결 후 플래그 제거, 또는 이유를 주석으로 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 품질 | `Logger` 인스턴스 선언 후 미사용. 에러 catch 블록에서도 logger 호출 없음 | `expression-resolver.service.ts:14` | `MAX_DEPTH` 초과, 표현식 에러 등에서 `this.logger.warn()` 활용 또는 선언 제거 |
| 2 | 안전성 | `nodeMap` optional 파라미터로 인해 미전달 시 `{{ }}` 표현식이 해석 없이 핸들러에 전달되는 경로 존재 | `execution-engine.service.ts:494` — `executeNode(nodeMap?: ...)` | 필수 파라미터로 변경하거나, `undefined`일 때 명시적 경고 로그 추가 |
| 3 | 성능 | `buildExpressionContext()`에서 `$execution.startedAt`, `$now`, `$today`가 각각 `new Date()` 호출하여 미세하게 다른 시각이 주입될 수 있음 | `expression-resolver.service.ts` — `buildExpressionContext()` | 메서드 상단 `const now = new Date()` 한 번만 호출 후 재사용 |
| 4 | 성능 | `getAllFunctionNames()`가 `useMemo` 의존성(`nodes, edges, nodeResults, selectedNodeId`) 변경 시마다 재호출. 함수 목록은 정적임 | `use-expression-context.ts` — `useMemo` 내부 | 모듈 최상단 상수로 추출: `const FUNCTION_NAMES = getAllFunctionNames()` |
| 5 | 성능 | `ExpressionHighlight`가 키 입력마다 전체 문자열을 재파싱. `validateExpressions`(`matchAll`)와 이중 파싱 발생 | `expression-highlight.tsx` — while 루프 | 파싱 결과를 `useMemo`로 캐싱하거나, highlight와 validation을 단일 파싱 패스로 통합 |
| 6 | 성능 | `expressionData` 객체 전체가 `useExpressionSuggestions` 의존성으로 전달되어 autocomplete가 닫혀 있어도 불필요한 재계산 발생 | `use-expression-suggestions.ts` | `autocompleteOpen === false` 또는 커서가 표현식 블록 외부일 때 조기 반환 |
| 7 | 의존성 | `@workflow/expression-engine`의 `dayjs: ^1.11.13`과 `backend`의 `dayjs: ^1.11.20` 버전 불일치. 동일 패키지 중복 번들링 가능성 | `backend/package.json`, `packages/expression-engine/package.json` | `expression-engine`의 `dayjs` 버전을 `^1.11.20`으로 통일 또는 workspace hoist 설정 |
| 8 | 의존성 | `expression-engine` 패키지 자체 테스트가 모노레포 루트 CI 파이프라인에 포함되지 않으면 공유 패키지 품질 검증이 누락될 수 있음 | `packages/expression-engine` | 루트 `package.json` 또는 CI 스크립트에 `packages/expression-engine` 테스트 실행 포함 |
| 9 | 테스트 | `resolveString` mixed-text 케이스에서 `typeof result === 'string'` assertion 누락. `$execution.mode !== 'manual'` 케이스 테스트 없음 | `expression-resolver.service.spec.ts` | mixed-text 타입 검증 assertion 추가, mode/startedAt 필드 테스트 케이스 추가 |
| 10 | 테스트 | `ExpressionInput` 자동완성 핵심 기능(토큰 교체, 키보드 탐색) 및 multiline 하이라이트 비활성화 동작 테스트 없음 | `expression-input.test.tsx` | 자동완성 선택 흐름, `multiline` 조건 분기 테스트 추가 |
| 11 | 테스트 | `useExpressionSuggestions`, `useExpressionContext` 훅 자체 테스트 파일 없음. 복잡한 토큰 파싱 로직이 직접 테스트되지 않음 | `frontend/src/components/editor/expression/` | `__tests__/use-expression-suggestions.test.ts` 파일 추가 |
| 12 | 테스트 | `MAX_DEPTH` 초과 동작에 대한 테스트 없음 | `expression-resolver.service.spec.ts` | 11단계 중첩 객체에서 최대 깊이 이상은 원본 반환됨을 검증하는 테스트 추가 |
| 13 | 자동완성 UX | 다중 입력 엣지의 경우 `inputFields`에 소스 노드 UUID가 push되어 자동완성에서 의미 없는 제안이 표시됨 | `use-expression-context.ts:57-61` | 다중 입력 시 각 소스의 출력 필드를 합집합으로 제공, 또는 스펙에 다중 입력 `$input` 구조 정의 |
| 14 | 스코프 | `auth.controller.ts`, `auth.controller.spec.ts`에 표현식 엔진과 무관한 포맷팅 전용 변경 혼입 | `auth.controller.ts:81-83` | 피처와 무관한 변경은 별도 PR로 분리 |
| 15 | 문서 | `@workflow/expression-engine` 공유 패키지에 README 없음. `evaluate`, `validate`, `getAllFunctionNames` 공개 API 문서 부재 | `packages/expression-engine/` | `README.md`에 설치 방법, 공개 API 목록, 기본 사용 예제 추가 |
| 16 | 문서 | 스펙 `4-execution-engine.md`에 `5.4` 섹션 번호 중복 가능성 | `spec/5-system/4-execution-engine.md` | 기존 `5.4 노드 유형별 리트라이 정책` 이후 섹션 번호 일괄 재확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `resolveString` 혼합 표현식 보간 누락(CRITICAL), `$execution` 컨텍스트 부정확, multiline 하이라이트 미구현 |
| security | MEDIUM | MAX_DEPTH 미해석 데이터 노출, 에러 메시지 민감정보 포함, mode 하드코딩으로 보안 정책 우회 가능성 |
| performance | MEDIUM | `ExpressionHighlight` 이중 파싱, `getAllFunctionNames()` 불필요한 재계산, `useExpressionSuggestions` 과다 재계산 |
| testing | MEDIUM | 자동완성 핵심 기능 테스트 누락, `getExpressionToken` 경계값 테스트 없음, mode/startedAt 오동작이 테스트에 드러나지 않음 |
| architecture | MEDIUM | `resolveString` 타입 보존 분기 버그, `startedAt` 부정확, MAX_DEPTH 미해석 데이터 노출, multiline 하이라이트 미구현 |
| api_contract | LOW | `$execution.mode` 하드코딩으로 실행 컨텍스트 부정확, 표현식 에러 시 클라이언트 에러 스키마 정합성 확인 필요 |
| concurrency | LOW | `resolveString` 타입 변환 누락, `$execution.startedAt` 호출 시점 불일치 |
| database | LOW | `$execution.startedAt`이 DB 저장값과 불일치, `nodeMap` optional로 인한 표현식 미해석 경로 |
| dependency | LOW | `dayjs` 버전 불일치, `--webpack` 플래그 기술 부채, `expression-engine` CI 누락 |
| maintainability | LOW | `resolveString` 분기 불일치, mode/startedAt 하드코딩, logger 미사용, MAX_DEPTH 무음 실패 |
| side_effect | LOW | 혼합 표현식 타입 강제 미흡, `startedAt` 부정확, `--webpack` 불필요 |
| scope | LOW | auth 파일 무관 변경 혼입, `resolveString` 스펙 불일치, `nodeMap` optional 동작 불명확 |
| documentation | LOW | 신규 패키지 README 없음, `resolveString` 주석-코드 불일치, 스펙 섹션 번호 중복 |

---

## 발견 없는 에이전트
없음 (모든 에이전트가 발견사항을 보고함)

---

## 권장 조치사항

1. **[CRITICAL] `resolveString()` 혼합 표현식 보간 구현** — `evaluate()`가 mixed template을 string으로 보간하는지 확인하고, 그렇지 않다면 `{{ }}` 블록별 분리 평가 후 텍스트 조합 로직 구현. 미구현 시 HTTP 요청 URL·이메일 본문 등 대부분의 혼합 표현식 노드가 오동작함

2. **[WARNING] `ExecutionContext`에 `mode`·`startedAt` 필드 추가** — 하드코딩된 `'manual'`과 `new Date()`를 실제 실행 엔티티의 값으로 교체

3. **[WARNING] `MAX_DEPTH` 초과 시 로깅 및 처리 방식 개선** — 미해석 표현식 문자열이 핸들러에 전달되지 않도록 에러 throw 또는 경고 로그 추가

4. **[WARNING] 에러 메시지에서 `template: "${value}"` 제거** — 민감 정보 로그 노출 방지

5. **[WARNING] multiline 하이라이트 구현 또는 스펙 예외 명시** — `!multiline` 조건 제거 또는 스펙에 textarea 제외 사유 기술

6. **[WARNING] `validate()` 이중 래핑 검증** — `expression-engine`의 `validate()` 시그니처 확인 후 호출 방식 정렬

7. **[WARNING] `selectedIndex` 리셋 로직 추가** — `suggestions` 변경 시 `setSelectedIndex(0)` 호출

8. **[WARNING] `getExpressionToken()` 경계값 수정** — `i > 0 &&` 가드 조건 추가

9. **[INFO] 테스트 보강** — mixed-text 타입 assertion, MAX_DEPTH 동작, 자동완성 핵심 흐름(토큰 교체·키보드 탐색), `useExpressionSuggestions` 훅 단위 테스트 추가

10. **[INFO] 성능 최적화** — `getAllFunctionNames()` 모듈 상수로 추출, `ExpressionHighlight` `useMemo` 캐싱, autocomplete 미열림 시 suggestion 재계산 방지