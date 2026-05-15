## 발견사항

---

### [INFO] 미사용 상수 (`WARNING`) 잔존

- **위치**: `node-config-summary.ts:36`
  ```ts
  const WARNING = Object.freeze<ConfigSummaryResult>({ text: "\u26a0 Not configured", isWarning: true });
  ```
- **상세**: `warning()` 함수 도입으로 이 상수는 더 이상 내부적으로 사용되지 않음. 단, `getConfigSummary`의 fallback 경로(`if (!result) return { ...WARNING }`)에서 여전히 참조되고 있어 완전한 dead code는 아님. 향후 모든 formatter가 `warning()`을 반환하므로 이 fallback 자체도 도달 불가(unreachable) 코드가 됨.
- **제안**: fallback 경로와 `WARNING` 상수를 함께 제거하여 코드 명확성 확보.

---

### [INFO] 설정값 직접 삽입 — XSS 잠재 가능성

- **위치**: `node-config-summary.ts` 다수 formatter
  ```ts
  // 예시
  return { text: `${method} ${url}`, isWarning: false };   // httpRequestSummary
  return { text: `${queryType} \u00b7 ${firstLine}`, isWarning: false };  // databaseQuerySummary
  return { text: `${pageSize} ${orientation} \u00b7 ${fileName}`, isWarning: false };  // pdfSummary
  ```
- **상세**: `NodeConfig = Record<string, unknown>` 에서 가져온 사용자 입력 값이 sanitization 없이 summary 텍스트로 삽입됨. React의 기본 렌더링(텍스트 노드)은 자동 escape하므로 현재 구조에서 XSS는 발생하지 않음. 그러나 이 `text` 값이 향후 `dangerouslySetInnerHTML`이나 외부 HTML 렌더러에 전달될 경우 XSS로 직결됨.
- **제안**: 현재 렌더링 경로를 명시적으로 주석/문서화하여 미래 소비자가 raw 문자열을 HTML로 렌더링하지 않도록 안내. 혹은 타입 수준에서 `ConfigSummaryResult.text`가 plain text임을 명시 (`PlainText` branded type 등).

---

### [INFO] SQL 쿼리 첫 줄 노출

- **위치**: `node-config-summary.ts:154-158`
  ```ts
  const nlIndex = query.indexOf("\n");
  const firstLine = nlIndex === -1 ? query : query.slice(0, nlIndex);
  return { text: `${queryType} \u00b7 ${firstLine}`, isWarning: false };
  ```
- **상세**: DB 쿼리의 첫 번째 줄을 캔버스 UI에 노출함. 쿼리에 연결 문자열, 자격증명, 내부 스키마 정보 등이 포함되어 있을 경우 화면을 공유하는 환경(화면 공유, 스크린샷)에서 민감 정보가 노출될 수 있음. 스펙에서 의도한 UX 기능이나, 정보 노출 위험이 있음.
- **제안**: 쿼리 내용 대신 `SELECT · 23 chars` 형태로 길이만 표시하거나, 표시 전 민감 패턴(자격증명, 비밀번호 파라미터 등) 마스킹 정책 수립 고려.

---

### [INFO] `Object.hasOwn` 사용 — 긍정적 패턴

- **위치**: `node-config-summary.ts:330`
  ```ts
  const formatter = Object.hasOwn(FORMATTERS, nodeType) ? FORMATTERS[nodeType] : undefined;
  ```
- **상세**: `nodeType in FORMATTERS` 또는 `FORMATTERS[nodeType]` 직접 접근 대신 `Object.hasOwn`을 사용함으로써 prototype pollution을 통한 임의 formatter 삽입을 차단. 올바른 보안 패턴.

---

### [INFO] 타입 캐스팅 전반적 의존

- **위치**: `node-config-summary.ts` 전반
  ```ts
  const url = config.url as string | undefined;
  const query = config.query as string | undefined;
  ```
- **상세**: `Record<string, unknown>` 에서 모든 값을 `as string | undefined`로 강제 캐스팅. TypeScript 컴파일러가 실제 타입을 검증하지 않음. 런타임에서 `config.url`이 객체나 배열인 경우 truthy check는 통과하지만 `text`에 `[object Object]`가 삽입될 수 있음.
- **제안**: 중요 필드에 `typeof value === 'string'` 가드 추가 검토.
  ```ts
  const url = typeof config.url === 'string' ? config.url : undefined;
  ```

---

## 요약

이번 변경은 기존의 단일 "Not configured" 경고 메시지를 노드별 구체적 누락 항목 메시지로 세분화한 순수 UX 개선 작업이다. 보안 관점에서 새로운 취약점이 도입되지 않았으며, `Object.hasOwn` 사용 등 기존 코드의 보안 패턴도 유지되고 있다. 주요 주의 사항은 config 값이 summary 텍스트에 직접 삽입되는 패턴인데, 현재 React 렌더링 환경에서는 XSS 위험이 없으나 해당 `text` 값이 HTML 컨텍스트에서 소비될 경우를 대비한 가이드라인이 필요하다. DB 쿼리 첫 줄 노출은 화면 공유 시나리오에서 정보 노출 위험이 있으며, 미사용 `WARNING` 상수는 코드 혼란 요소로 정리가 권장된다.

---

## 위험도

**LOW**