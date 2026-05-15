# Code Review 통합 보고서

## 전체 위험도
**LOW** - 신규 유틸리티 모듈과 테스트 파일로, Critical/High 이슈 없음. 주요 개선 포인트는 falsy 값 테스트 누락과 JSDoc 불일치에 집중됨.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `resolveNestedValue`에서 `??` 연산자를 `\|\|`로 실수 변경 시 falsy 정상값(`0`, `false`, `""`)이 `null`로 오판될 수 있으나 방어 테스트가 없음 | `resolve-nested-path.ts:59`, `resolve-nested-path.test.ts` | `count: 0`, `flag: false`, `name: ""` 케이스에 대한 테스트 추가 |
| 2 | Testing | `use-expression-suggestions.test.ts`의 커서 위치가 매직 넘버로 하드코딩되어, 입력 문자열 변경 시 수동 동기화가 필요한 암묵적 의존성 존재 | `use-expression-suggestions.test.ts:47, 55, 63, 70...` | `value.indexOf(". }}") + 1` 같은 동적 계산식 또는 마커 기반 헬퍼로 대체 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `splitPathAndLeaf` JSDoc의 `"body.data." → never happens` 주석이 실제 구현 및 테스트와 모순됨 (trailing dot 입력이 정상 처리됨) | `resolve-nested-path.ts` `splitPathAndLeaf` JSDoc | `"body." → { parentPath: "body", leafPrefix: "" }` 예시로 수정하거나 해당 라인 제거 |
| 2 | Type System | `resolveNestedValue` 반환 타입이 `unknown \| null`로 선언되어 있으나, `unknown`은 이미 `null`을 포함하므로 중복 표기 | `resolve-nested-path.ts:42` | `unknown` 단독 사용 또는 JSDoc에 null 반환 조건 명시 |
| 3 | Testing | `MAX_DEPTH = 10` 상수가 존재하지만 깊이 초과(depth ≥ 11) 케이스에 대한 테스트 없음 | `resolve-nested-path.ts:6`, `resolve-nested-path.test.ts` | depth 11 이상 경로에서 `null` 반환을 검증하는 테스트 추가 |
| 4 | Testing | `splitPathAndLeaf`에서 브래킷 포함 경로(`items[0].name`)에 대한 동작 검증 없음 | `resolve-nested-path.test.ts` | `splitPathAndLeaf("items[0].name")` → `{ parentPath: "items[0]", leafPrefix: "name" }` 테스트 추가 |
| 5 | Testing | `$node` 중첩 경로에 대한 `tokenStart`/`tokenEnd` 위치 검증 없음 | `use-expression-suggestions.test.ts` | `$node` 경로에 대한 토큰 위치 케이스 추가 |
| 6 | Testing | 배열 필드(`items`)의 `isExpandable` 동작이 명시적으로 검증되지 않음 | `use-expression-suggestions.test.ts` | 배열 필드의 `isExpandable: true` 동작 검증 추가 |
| 7 | Architecture | `parsePath`가 단일 숫자 브래킷(`items[0]`)만 지원하며, 중첩 브래킷(`items[0][1]`)이나 문자열 키 브래킷은 미지원 | `resolve-nested-path.ts:28-37` | JSDoc에 지원 범위 제약 명시: `// Note: only supports single numeric bracket per segment` |
| 8 | Architecture | `getNestedKeys`가 배열의 첫 번째 요소(`[0]`) 스키마만 기준으로 키를 반환, 이종 배열에서 불완전한 자동완성 발생 가능 | `resolve-nested-path.ts:75-83` | JSDoc에 "배열은 첫 번째 요소의 스키마를 사용" 및 이종 배열 한계 명시 |
| 9 | Security | `resolveNestedValue`/`getNestedKeys`에서 `__proto__`, `constructor`, `prototype` 키에 대한 명시적 차단 없음 (읽기 전용·내부 데이터이므로 실질 위험은 낮음) | `resolve-nested-path.ts` | `const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"])` 가드 추가 고려 |
| 10 | Security | `getNestedKeys`에서 `Object.keys()` 너비 제한 없어, `inputSample`이 외부 API 응답일 경우 대량 키 처리 가능 | `resolve-nested-path.ts` | 외부 출처 `inputSample`인 경우 키 개수 상한선 추가 고려 |
| 11 | Documentation | `MAX_DEPTH` 상수에 값 선택 근거 및 초과 시 동작에 대한 주석 없음 | `resolve-nested-path.ts:6` | `/** Maximum nesting depth; prevents runaway traversal */` 주석 추가 |
| 12 | Performance | 루프 내 정규식 리터럴(`/^([^[]+)\[(\d+)\]$/`, `/^\[(\d+)\]$/`)이 인라인으로 반복 평가됨 (JS 엔진 캐싱으로 실질 영향 미미) | `resolve-nested-path.ts` | `BRACKET_RE`, `INDEX_RE` 모듈 상수로 추출하여 의도 명확화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `__proto__` 차단 없음, `Object.keys` 너비 제한 없음 |
| Performance | LOW | 루프 내 정규식 인라인 리터럴, `useMemo` 적용 여부 확인 권장 |
| Maintainability | LOW | 매직 넘버 커서 위치, JSDoc 모순, `MAX_DEPTH` 경계 테스트 누락 |
| Architecture | LOW | JSDoc 계약-테스트 불일치, 브래킷 지원 범위 미문서화, 이종 배열 처리 전략 암묵성 |
| Testing | LOW | falsy 값 테스트 누락(WARNING), 매직 넘버 커서 위치(WARNING), `MAX_DEPTH` 경계 미검증 |
| Scope | LOW | `splitPathAndLeaf` JSDoc 주석 모순 |
| Side Effect | LOW | `splitPathAndLeaf` trailing dot 계약 불명확, `unknown \| null` 중복 타입 |
| Requirement | LOW | JSDoc 불일치, 중첩 브래킷 미지원, 이종 배열 정의 부재 |
| Documentation | LOW | JSDoc 불일치, `MAX_DEPTH` 근거 부재, 브래킷 지원 범위 미문서화 |
| Dependency | NONE | 신규 외부 의존성 없음, 기존 devDependency만 사용 |
| Database | NONE | 해당 없음 |
| Concurrency | NONE | 해당 없음 |
| API Contract | NONE | 해당 없음 |

---

## 발견 없는 에이전트

- **Database** — 데이터베이스 관련 코드 없음
- **Concurrency** — 동기 순수 함수만 존재, 공유 상태 없음
- **API Contract** — HTTP API 엔드포인트 없음
- **Dependency** — 신규 외부 의존성 없이 기존 devDependency만 활용

---

## 권장 조치사항

1. **(WARNING) falsy 값 테스트 추가** — `resolveNestedValue`에서 `0`, `false`, `""` 반환 케이스 테스트 작성하여 `??` → `||` 실수 변경에 대한 방어막 확보
2. **(WARNING) 커서 위치 매직 넘버 제거** — `use-expression-suggestions.test.ts`에서 `indexOf` 기반 동적 계산식으로 교체하여 테스트 유지보수성 향상
3. **(INFO) `splitPathAndLeaf` JSDoc 수정** — `"body.data." → never happens` 주석을 실제 동작에 맞게 수정
4. **(INFO) `resolveNestedValue` 반환 타입 정리** — `unknown | null` → `unknown`으로 단순화
5. **(INFO) `MAX_DEPTH` 경계 테스트 추가** — depth 11 이상 경로에서 `null` 반환 검증
6. **(INFO) 브래킷 지원 범위 문서화** — `parsePath` JSDoc에 단일 숫자 브래킷만 지원함을 명시
7. **(INFO) `splitPathAndLeaf` 브래킷 경로 테스트 추가** — `items[0].name` 케이스 검증
8. **(INFO) 정규식 상수 추출** — `BRACKET_RE`, `INDEX_RE`를 모듈 스코프 상수로 분리