# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `interpolate` 함수의 module-scope regex 공유 — `lastIndex` 재진입 안전
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/core.ts` L677 (`INTERPOLATION_RE`)
- 상세: `INTERPOLATION_RE`는 `g` 플래그를 가진 모듈 스코프 정규식이다. `String.prototype.replace`에 `g` 정규식을 넘길 때는 JS 엔진이 매 호출 전 `lastIndex`를 0으로 리셋하므로 재진입 문제는 없다. 그러나 `interpolate`가 `export`되어 외부에서 직접 `INTERPOLATION_RE`를 exec-loop로 쓰는 코드가 생기면 문제가 될 수 있다. 현재 변경에서 `interpolate`만 export되어 있고 `INTERPOLATION_RE`는 module-private이므로 실질 위험 없음.
- 제안: 현 구조 유지 적절. 추후 외부 직접 사용 방지를 위해 `INTERPOLATION_RE`에 non-export를 명시적으로 주석으로 남겨도 좋음.

### [INFO] `interpolate` export — 이전 module-internal 함수의 공개 API 노출
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/core.ts` L690 (`export function interpolate`)
- 상세: 이전에 module-private이었던 `interpolate`가 `export`로 변경됐다. 함수 시그니처 자체(`(template, params?) => string`)는 그대로이므로 기존 내부 호출자(`translate` 함수)에는 영향 없다. 다만 이제 모듈 외부에서 임포트 가능해졌으므로 공개 API로 취급되어야 한다. `backend-labels.ts`가 유일한 신규 소비자이며 의도된 용도임.
- 제안: 문제 없음. 단, 향후 시그니처 변경이 필요하면 `backend-labels.ts`도 함께 수정해야 함을 인지.

### [INFO] `GraphWarningRule.evaluate` 반환 타입 확장 — 하위호환
- 위치: `/Volumes/project/private/clemvion/codebase/packages/graph-warning-rules/src/types.ts` L1304
- 상세: `evaluate` 반환 타입이 `{ message: string }` → `{ message: string; params?: Record<string, string | number> }` 로 변경됐다. `params`가 optional이므로 기존 rule 구현은 변경 없이 컴파일된다. 호출자(`evaluator.ts`)도 `triggered.params` 존재 여부를 확인 후 spread 하므로 결함 없음.
- 제안: 문제 없음.

### [INFO] `evaluator.ts` — `params` 조건부 spread가 `GraphWarningRuleResult` 타입에 부합
- 위치: `/Volumes/project/private/clemvion/codebase/packages/graph-warning-rules/src/evaluator.ts` L1058
- 상세: `...(triggered.params ? { params: triggered.params } : {})` 패턴은 `params`가 없을 때 result 객체에 `params` 키 자체를 만들지 않는다. `GraphWarningRuleResult.params`가 optional이므로 이는 올바른 동작이다. 상태 변이 없음.
- 제안: 문제 없음.

### [INFO] `EditorState` 인터페이스 `graphWarnings.results` 요소 타입 확장
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/stores/editor-store.ts` L1758
- 상세: 인터페이스 수준에서만 `params?` 필드를 추가한 변경이다. Zustand store의 실제 상태(객체 내용)는 서버 응답을 그대로 담는 구조이며 상태 초기화나 reset 로직에는 영향 없다. 기존 `graphWarnings` 구독자(custom-node, editor-toolbar 등)는 `params`를 소비하거나 무시해도 무방하다.
- 제안: 문제 없음.

### [INFO] `custom-node.tsx` — `graphWarningMessage` useMemo 의존성 배열에 `locale` 추가
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/canvas/custom-node.tsx` L714-717
- 상세: 기존 의존성 배열 `[graphWarnings]`에 `locale`이 추가됐다. 로케일 변경 시 재연산이 발생한다. 로케일이 앱 수명 동안 거의 변경되지 않는 값이면 성능 영향 없음. 공유 상태(`graphWarnings`, `locale`)를 읽기만 하고 변경하지 않으므로 부작용 없음.
- 제안: 문제 없음.

### [INFO] `editor-toolbar.tsx` — IIFE 방식의 `title` prop 계산
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L1399-1406
- 상세: `title={(() => { ... })()}` 형태의 IIFE는 매 render 시 새 함수를 생성한다. 단순한 early-return 패턴이며 상태 변경이 없으므로 부작용 없음. 다만 `useMemo`로 추출하면 render 빈도가 높을 때 더 효율적이다.
- 제안: 기능상 문제 없음. 성능 민감 컴포넌트라면 `useMemo`로 분리 고려.

### [INFO] `no-internal-refs.test.ts` — 정규식 패턴 확장
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/no-internal-refs.test.ts` L2020
- 상세: `GRAPH_WARNING_KO`가 금지 패턴 목록에 추가됐다. 해당 정규식은 `g` 플래그를 가지며, 테스트 루프 내에서 `pat.regex.lastIndex = 0` 으로 명시적으로 초기화되므로 stateful regex의 재사용 문제가 없다.
- 제안: 문제 없음.

### [INFO] `backend-labels.ts` — `ERROR_KO`, `GRAPH_WARNING_KO` 신규 module-level 상수 도입
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` L2517-2532
- 상세: 두 상수는 모듈 스코프 `Record<string, string>` 타입의 순수 데이터 객체이며 가변 전역 상태가 아니다(`const`). 런타임에서 수정하지 않는다. `export`로 노출되어 테스트(`backend-labels.test.ts`)가 직접 참조하는 것이 의도된 설계이다.
- 제안: 문제 없음.

### [INFO] `validation-errors.mdx` / `.en.mdx` — 신규 파일 생성
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` 및 `.en.mdx`
- 상세: 신규 문서 파일이 `05-run-and-debug` 섹션에 추가됐다. `order: 5` 가 다른 기존 문서와 충돌하지 않는지 확인 필요. 파일 생성 자체가 사이드이펙트이나 이는 의도된 변경이다.
- 제안: 같은 `section: 05-run-and-debug` 내 `order: 5` 중복 여부를 기존 MDX 파일들과 대조 확인 권장.

### [INFO] e2e 테스트 — `depthErr!.params`의 non-null assertion
- 위치: `/Volumes/project/private/clemvion/codebase/backend/test/graph-warning-save.e2e-spec.ts` L492
- 상세: `depthErr`를 `find`로 찾고 `toBeDefined()` 로 undefined가 아님을 단언한 뒤 `depthErr!.params` 를 접근한다. Jest에서 `expect(...).toBeDefined()`가 실패해도 다음 라인이 실행되므로, `depthErr`가 실제로 undefined이면 `depthErr!.params`에서 런타임 TypeError가 발생한다. 테스트 코드이므로 프로덕션 부작용은 없으나 테스트 실패 메시지가 TypeError로 가려질 수 있다.
- 제안: `if (!depthErr) throw new Error(...)` 또는 `assert(depthErr)` 패턴 사용을 고려하면 실패 메시지가 명확해짐. 단, 현 코드도 테스트 목적상 허용 가능.

## 요약

이번 변경은 `params` 필드를 graph warning rule 결과에 추가하고 frontend에서 한국어 i18n 템플릿 보간을 지원하는 순수 additive(추가적) 변경이다. `GraphWarningRule.evaluate` 반환 타입과 `GraphWarningRuleResult`에 optional `params` 필드를 추가하여 기존 구현과의 하위호환성이 유지된다. `interpolate` 함수를 module-private에서 `export`로 변경한 것이 유일한 공개 API 확장이나 기존 내부 호출에 영향을 주지 않는다. 전역/공유 상태 변경, 파일시스템 부작용, 네트워크 호출, 환경 변수 조작은 발견되지 않았다. 신규 `const` 상수(모듈 레벨 lookup table)는 불변이며 부작용이 없다. 전반적으로 의도치 않은 부작용은 없다.

## 위험도

NONE
