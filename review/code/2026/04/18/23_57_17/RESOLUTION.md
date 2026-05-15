# 코드 리뷰 조치 내역

리뷰 보고서: [`SUMMARY.md`](./SUMMARY.md) — 2026-04-18 23:57 실행

## 경고 (WARNING) 처리

| # | 내용 | 조치 | 위치 |
|---|------|------|------|
| 1 | 모듈 레벨 `/g` 정규식 `lastIndex` 공유 상태 → scope 검사 오탐 위험 | 모듈 레벨 상수를 `PATTERN` suffix로 이름 변경 후 **매 호출마다 `new RegExp(src, flags)` 로 로컬 인스턴스 생성**. `.test()` 용 LOOP/ITEM/ITEM_INDEX 패턴은 `g` 플래그 제거 | `validate-scope.ts` |
| 2 | scope 에러(amber)인데 `ExpressionHighlight`가 빨간 배경으로 표시됨 | `ExpressionHighlight`에 `hasWarning` prop 추가, `hasError → hasWarning → default(blue)` 우선순위 적용. `expression-input.tsx`에서 `hasSyntaxError`/`hasScopeWarning` 를 분리 전달 | `expression-highlight.tsx`, `expression-input.tsx` |
| 3 | `expression-autocomplete.tsx` 테스트 없음 | 신규 테스트 파일 작성 — 키보드 네비(ArrowUp/Down/Enter/Tab), 마우스 클릭, 20개 슬라이스 캡, visible false 동작 | `__tests__/expression-autocomplete.test.tsx` |
| 4 | `expression-highlight.tsx` 테스트 없음 | 신규 테스트 파일 작성 — 단일/인접/미완료 블록 파싱, hasError/hasWarning 색상 우선순위, whitespace 처리 | `__tests__/expression-highlight.test.tsx` |
| 5 | `variable-picker.tsx` containerScope UI 미검증 | 신규 테스트 파일 작성 — 4가지 스코프 조합에 따른 `$loop`/`$item`/`$itemIndex` 표시 여부 | `__tests__/variable-picker.test.tsx` |
| 6 | syntax + scope 에러 동시 발생 시 우선순위 미검증 + 유효 scope 참조 긍정 케이스 없음 | `expression-input.test.tsx`에 우선순위 테스트와 유효 scope 참조 테스트 추가 | `__tests__/expression-input.test.tsx` |
| 7 | 사이클 테스트에 `fromA.has("A") === false` 단언 없음 | 단언 추가 (자기 자신이 조상에 포함되지 않음을 명시) | `__tests__/reachable-nodes.test.ts` |
| 8 | `loop`/`foreach` 노드 자신 선택 시 containerScope 결과 미검증 | 컨테이너 노드 자체는 `{hasLoop:false, hasItem:false}` 임을 검증하는 테스트 추가 | `__tests__/use-expression-context.test.ts` |
| 9 | 컨테이너 스코프 게이팅 로직이 3곳에 중복 | `expression-constants.ts`에 `scopeKey: keyof ContainerScopeFlags` 메타데이터 추가 + `filterRootVariablesByScope()` 헬퍼. `use-expression-suggestions.ts`, `variable-picker.tsx` 양쪽에서 메타데이터 기반 필터 사용 | `expression-constants.ts` + 소비자들 |
| 10 | `variable-picker.tsx` IIFE 패턴 | `useMemo`로 스코프 필터링된 빌트인 목록을 훅 레벨에서 계산 | `variable-picker.tsx` |
| 11 | `getContainerChain`이 `byId` Map 중복 생성 | optional `byIdOverride` 인자 추가. `getAncestorsInScope`와 `use-expression-context.ts` 둘 다 자신의 `byId`를 전달하여 재사용 | `reachable-nodes.ts`, `use-expression-context.ts` |
| 12 | `allDisambiguatedKeys` 역방향 탐색 O(n) | `useMemo` 내에서 `nodeIdByResolvedKey: Map<string,string>` 사전 구축 → O(1) 조회 | `use-expression-context.ts` |
| 13 | 복수 블록 간 `(kind, token)` dedup 동작 문서화/테스트 없음 | `validate-scope.test.ts`에 "두 블록에서 동일 Ghost 참조 → 1건으로 병합" 테스트 추가 및 주석 보강 | `__tests__/validate-scope.test.ts` |

## 참고 (INFO) 처리

| # | 내용 | 조치 |
|---|------|------|
| 8 | null/undefined 입력 early-return 테스트 없음 | `validate-scope.test.ts`에 `null`, `undefined`, `""` 입력 테스트 추가 |
| 9 | `hasLoop && hasItem` 동시 true 테스트 없음 | `use-expression-suggestions.test.ts` 컨테이너 스코프 섹션에 케이스 추가 |
| 10 | 단일 블록 내 `unknown-node` + `unknown-variable` 동시 발생 미검증 | `validate-scope.test.ts`에 케이스 추가 |

## 미조치 항목 (근거)

| # | 내용 | 근거 |
|---|------|------|
| INFO 1 | 에러 메시지에 토큰을 문자열 interpolation — JSX 이스케이프에 의존 | React가 기본적으로 이스케이프하므로 현재 XSS 위험 없음. `dangerouslySetInnerHTML` 금지 규칙은 프로젝트 전역 정책 영역으로 이번 스코프 외 |
| INFO 2 | `unescapeDoubleQuotedKey` 결과의 `__proto__` 같은 위험 키 검증 | 해당 값은 `Set.has()` 조회에만 사용되며 객체 키로 쓰이지 않음. 방어 코드는 불필요한 현재로서 과잉 설계로 판단 |
| INFO 3 | `suggestions.slice(0, 20)` 매 렌더 실행 | 수십 요소의 slice는 측정 가능한 병목이 아니며 실제 사용 패턴에서 렌더 횟수도 제한적. 필요 시 후속 개선 |
| INFO 4 | `setSyntaxError + setScopeErrors` 순차 호출 | 현재 타겟 React 18+ 이므로 자동 배칭 적용. 일시적 불일치 없음 |
| INFO 5 | `runScopeValidation`과 `validateExpressionScope`의 early-return 중복 | 외부 wrapper의 `!value.includes("{{")`는 **`expressionData` 재계산 의존성 축소** 효과가 있어(의도된 fast-path) 유지 |
| INFO 6 | `useExpressionContext`의 `useMemo` 콜백 비대화 | 변경 폭이 커 이번 PR 범위 밖의 리팩토링. 별도 작업으로 분리 권장 |
| INFO 7 | 노드 데이터 `unknown` 캐스팅 반복 | 스토어 타입 전반에 영향. 이번 범위는 아님 |
| INFO 11 | `ROOT_VARIABLES` 필터링 힌트 | `filterRootVariablesByScope()` 헬퍼 도입으로 필터 가이드가 API 상으로 명시되어 JSDoc 추가 불필요 |
| INFO 12 | mdx 최종 확인 | 이미 `basics.mdx` / `variables-and-context.mdx` / `1-node-common.md` 에 반영 완료 |

## 검증

```bash
cd frontend
pnpm lint      # 통과
pnpm vitest run src/components/editor/expression/   # 10 파일, 200 테스트 통과
pnpm build     # 통과
```
