## 보안 코드 리뷰 결과

### 발견사항

---

**[INFO]** URL에 민감 정보 노출 가능성
- 위치: `node-config-summary.ts` — `httpRequestSummary()`
- 상세: `config.url`을 그대로 노드 요약 텍스트로 노출합니다. URL에 API 키, 토큰 등 인증 정보가 쿼리 파라미터로 포함된 경우(예: `GET https://api.example.com?api_key=secret`), 캔버스를 볼 수 있는 모든 사용자에게 노출됩니다.
- 제안: URL을 표시할 때 쿼리스트링을 제거하거나 마스킹 처리. `new URL(url).origin + pathname` 형태로 표시.

---

**[INFO]** SQL 쿼리 첫 번째 줄 노출
- 위치: `node-config-summary.ts` — `databaseQuerySummary()`
- 상세: `query.split("\n")[0]`으로 SQL 첫 줄을 캔버스에 그대로 표시합니다. 테이블 구조, 컬럼명, 인라인 주석에 포함된 연결 정보 등이 노출될 수 있습니다.
- 제안: 쿼리 타입과 행 수만 표시하거나(`SELECT · 4 lines`), 테이블명만 파싱해서 표시.

---

**[INFO]** 런타임 타입 검증 없는 `as` 캐스팅
- 위치: `node-config-summary.ts` — 전체 포매터 함수들
- 상세: `config.conditions as Array<{...}>`, `config.inputCount as number` 등 런타임 검증 없이 TypeScript 타입 단언만 사용합니다. 외부에서 조작된 워크플로우 정의 파일이 로드되는 경우, 예상치 못한 타입이 주입돼 런타임 오류나 예기치 않은 렌더링이 발생할 수 있습니다.
- 제안: 핵심 필드에 타입 가드 또는 `typeof` 검사 추가. 특히 배열 여부 확인 시 `Array.isArray()` 사용.

```typescript
// 현재
const variables = config.variables as Array<{ name: string }> | undefined;

// 개선
const variables = Array.isArray(config.variables)
  ? (config.variables as Array<{ name: string }>)
  : undefined;
```

---

**[INFO]** FORMATTERS 레지스트리 프로토타입 조회
- 위치: `node-config-summary.ts` — `getConfigSummary()`
- 상세: `FORMATTERS[nodeType]` 조회에서 `nodeType`이 `__proto__`, `constructor`, `toString` 등이 될 경우 의도치 않은 값이 반환될 수 있습니다. 실제 익스플로잇 가능성은 매우 낮으나 방어적 코딩 관점에서 점검 필요합니다.
- 제안: `Object.hasOwn(FORMATTERS, nodeType)` 검사 추가 또는 `Object.create(null)`로 레지스트리 생성.

```typescript
const formatter = Object.hasOwn(FORMATTERS, nodeType) ? FORMATTERS[nodeType] : undefined;
```

---

**[INFO]** `merge` 노드 — `inputCount` 숫자 타입 미검증
- 위치: `node-config-summary.ts` — `mergeSummary()`
- 상세: `inputCount == null` 체크만 하고 실제 숫자인지 검증하지 않아, 문자열이나 객체가 오면 `"[object Object] inputs · strategy"` 같은 이상한 텍스트가 표시될 수 있습니다. XSS 위험은 없지만 정보 신뢰성 문제가 있습니다.
- 제안: `typeof inputCount === "number"` 검사 추가.

---

### 요약

분석 대상 코드는 순수 프론트엔드 UI 컴포넌트로, React의 JSX 렌더링이 자동으로 HTML 이스케이프를 처리하므로 XSS 위험은 없습니다. 하드코딩된 시크릿, 인증/인가 로직, 암호화 문제도 해당 범위 내에 존재하지 않습니다. 주요 보안 관심사는 **정보 노출** 영역으로, HTTP URL과 SQL 쿼리 내용이 캔버스 화면에 그대로 표시되어 협업 환경에서 민감한 설정값(API 키, 테이블 구조 등)이 의도치 않게 노출될 수 있습니다. 또한 런타임 타입 검증 없이 `as` 캐스팅을 광범위하게 사용하는 점은 외부 파일 로드나 데이터 조작 시나리오에서 방어력이 낮습니다.

---

### 위험도

**LOW**