## 발견사항

### [INFO] 페이지 파라미터 상한선 미설정
- **위치**: `use-page-param.ts:13-17`
- **상세**: `parsePage()` 함수가 하한(1)만 검증하고 상한은 없음. `?page=9999999999` 같은 극단적 값이 API에 그대로 전달됨.
- **제안**: 서버에서 범위 검증을 해야 하며, 클라이언트에서도 `Math.min(n, MAX_SAFE_PAGE)` 형태로 합리적 상한을 두는 것이 권장됨.

---

### [INFO] 숫자 입력 필드의 음수값 클라이언트 미검증
- **위치**: `knowledge-bases/page.tsx:70-71`, `llm-configs/page.tsx` (chunkSize/chunkOverlap/temperature/maxTokens)
- **상세**: `parseInt(formChunkSize) || 1000` 패턴은 `-100`을 truthy로 판단해 음수값을 서버로 전달함. HTML `min` 속성은 브라우저 힌트에 불과하며 DevTools나 `fetch()` 직접 호출로 우회 가능.
  ```typescript
  parseInt("-100") || 1000  // → -100 (통과됨)
  ```
- **제안**: 서버에서 반드시 범위 검증. 클라이언트 보조 검증 추가 (`n > 0` 등).

---

### [INFO] `const PAGE_SIZE` 선언이 import 블록 앞에 위치
- **위치**: `llm-configs/page.tsx` (diff의 `+const PAGE_SIZE = 20;` 이후 `import {` 블록)
- **상세**: 보안 취약점은 아니나, 코드 실행 순서가 의도와 달리 읽힐 수 있는 코드 배치. JavaScript 호이스팅 특성상 실행에는 문제 없으나 코드 일관성 저하.
- **제안**: `import` 블록 이후에 상수 선언 배치.

---

### [INFO] `searchParams.toString()`으로 임의 쿼리 파라미터 전파
- **위치**: `use-page-param.ts:30`
- **상세**: 페이지 변경 시 기존 URL의 모든 쿼리 파라미터를 그대로 보존함. 악의적으로 조작된 파라미터(예: `?redirect=...`, `?_csrf=...`)가 의도치 않게 전파될 수 있음. 현재 구조에서는 `router.replace`로 클라이언트 내부 라우팅만 수행하므로 직접적 위협은 낮음.
- **제안**: 허용 파라미터 명시적 화이트리스트(allowlist) 방식 검토.

---

### [INFO] API 응답 데이터 타입 단언
- **위치**: `schedules/page.tsx`, `triggers/page.tsx` (any[] 캐스팅)
- **상세**: `const raw: any[] = ...` 패턴으로 응답 데이터를 타입 검증 없이 매핑. 악의적 백엔드 응답(또는 MitM)에서 예상치 못한 필드가 UI에 렌더링될 수 있으나, React의 자동 이스케이프로 XSS는 방어됨.
- **제안**: 런타임 스키마 검증(예: zod)으로 API 응답 구조 보장.

---

## 요약

이번 변경은 공통 `Pagination` 컴포넌트와 `usePageParam` 훅을 추출하는 UI 리팩토링이 주목적으로, 신규 보안 취약점을 도입하지 않는다. `parsePage()`의 입력 정제, React의 자동 XSS 이스케이프, i18n 키 기반 에러 메시지로 주요 클라이언트 보안 기준을 충족한다. 다만 숫자 입력 필드(chunkSize, temperature 등)의 음수·범위 검증은 서버 의존도가 높으므로 백엔드에서 반드시 재검증해야 하며, 페이지 파라미터 상한선 미설정은 서버 부하 공격(비정상적 페이지 번호)에 대한 방어를 백엔드에 전적으로 위임하는 구조다.

## 위험도

**LOW**