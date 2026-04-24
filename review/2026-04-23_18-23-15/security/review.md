## 발견사항

### **[INFO] 서버 에러 메시지 직접 렌더링**
- **위치**: `model-combobox.tsx:81-82`
- **상세**: `err.response?.data.message`를 직접 `setErrorMessage`에 저장 후 JSX에서 렌더링. React의 기본 HTML 이스케이핑으로 XSS는 방지되나, 백엔드 sanitize 수준에 완전히 의존하는 구조.
- **제안**: 현행 유지 가능. 단, 백엔드 `sanitizeErrorMessage`가 항상 앞에서 필터링한다는 계약이 깨지면 내부 정보가 UI에 표시될 수 있음.

### **[INFO] 프론트엔드 baseUrl 클라이언트측 검증 부재**
- **위치**: `model-combobox.tsx:50-56`
- **상세**: `baseUrl`을 trim만 하고 형식·스킴 검증 없이 API로 전달. SSRF 방어는 백엔드 DTO의 `@IsUrl()` 단일 레이어에만 의존. Defense-in-depth 관점에서 프론트엔드 정규식 검증이 없음.
- **제안**: 큰 위험은 아니나, `new URL(baseUrl)` 파싱 후 `protocol`이 `http:`/`https:`인지 확인하는 가드를 `canLoad` useMemo에 추가하면 불필요한 네트워크 왕복 방지.

### **[INFO] 테스트 파일 내 평문 API 키 패턴**
- **위치**: `model-combobox.test.tsx:41`, `llm-configs.test.ts:27`, `llm-config.controller.spec.ts:31`
- **상세**: `"sk-xxx"`, `"sk-new-key"`, `"bad-key"` 등이 하드코딩. 현재 값은 명백히 더미이고 실제 키가 아님. 다만 향후 개발자가 실제 키로 테스트 후 커밋하는 패턴 오염 가능성.
- **제안**: CI에서 `sk-[a-zA-Z0-9]{20,}` 패턴 시크릿 스캔 룰(예: gitleaks) 추가 권장. 테스트 값 자체는 문제없음.

### **[INFO] 에러 배열 join시 구분자 노출**
- **위치**: `model-combobox.tsx:75`
- **상세**: `Array.isArray(raw) ? raw.join(", ") : raw` — NestJS ValidationPipe가 반환하는 배열 메시지를 쉼표로 조합. 배열 내 각 항목이 이미 sanitize된 경우 문제없으나, 검증 오류 메시지가 여러 필드 정보를 포함할 수 있음.
- **제안**: 현행 유지. 이미 서버측에서 sanitize 거친 후이고, React JSX 이스케이핑으로 XSS 방지됨.

---

## 요약

리뷰 대상 파일들은 이전 라운드에서 식별된 주요 보안 이슈(SSRF, 로깅 sanitize, Rate Limiting, Timeout)가 RESOLUTION.md 기준으로 모두 조치된 상태의 코드와 테스트를 담고 있다. `model-combobox.tsx` 구현에서 API 키 trim 처리와 React의 기본 HTML 이스케이핑이 제대로 동작하며, 테스트 파일에는 실제 자격증명이 포함되지 않았다. 잔여 위험은 모두 INFO 수준으로, 백엔드 단일 레이어 SSRF 방어(프론트 검증 부재)와 서버 에러 메시지 UI 렌더링의 백엔드 신뢰 의존성이 주요 관찰 사항이다.

## 위험도

**LOW**