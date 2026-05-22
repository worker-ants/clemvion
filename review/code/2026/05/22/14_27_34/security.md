# 보안(Security) 리뷰 결과

## 발견사항

### 인젝션 취약점

- **[INFO]** trigger ID 가 URL 경로에 직접 보간됨
  - 위치: `codebase/frontend/src/components/triggers/trigger-history-dialog.tsx` — `queryFn` 내 `apiClient.get(\`/triggers/${triggerId}/history\`, ...)`
  - 상세: `triggerId` 는 부모 컴포넌트(`page.tsx`)에서 서버 API 응답의 `trigger.id` 를 그대로 사용한다. 프론트엔드 단에서 ID 형식 검증(UUID 패턴 등)은 수행되지 않는다. 실질적 익스플로잇 가능성은 `apiClient` 내부에서 axios 등 HTTP 라이브러리가 경로를 직렬화하는 방식에 달려 있으며, `..` 형태의 경로 탐색은 URL 레이어에서 보통 차단되나 서버 라우터 구현에 따라 다를 수 있다.
  - 제안: 클라이언트에서 UUID 형식 검증(`/^[0-9a-f-]{36}$/i`)을 추가하거나, `enabled` 조건에 ID 형식 검증을 포함시켜 예상 밖의 ID 값이 API 경로에 삽입되지 않도록 방어하는 것을 권고한다. 실질적 위험도는 낮으나, 서버 사이드 라우팅과의 경계를 명확히 하는 차원에서 유의미하다.

- **[INFO]** `triggerName` 이 i18n 보간 후 `DialogTitle` 에 렌더링됨
  - 위치: `trigger-history-dialog.tsx` — `{t("triggers.history.title", { name: triggerName ?? "" })}`
  - 상세: React 는 기본적으로 텍스트 노드를 이스케이프하므로 XSS 위험은 없다. 다만 i18n 라이브러리(`useT`)가 내부에서 `dangerouslySetInnerHTML` 을 사용하는 경우 보간된 `name` 값이 HTML 로 해석될 수 있다. 현재 코드만으로는 `useT` 구현을 확인할 수 없어 INFO 수준으로 기록한다.
  - 제안: `useT` / `t()` 구현이 보간값을 `dangerouslySetInnerHTML` 로 처리하지 않는지 확인한다. 만약 그렇다면 `triggerName` 을 별도 텍스트 노드로 분리해 렌더링하는 방식으로 변경한다.

### 하드코딩된 시크릿

- **[NONE]** 변경된 파일 전체에서 API 키, 비밀번호, 토큰, 인증서 등 시크릿을 하드코딩한 코드는 발견되지 않는다.

### 인증/인가

- **[WARNING]** 이력 조회 Dialog 는 인가(authorization) 검사 없이 모든 로그인 사용자에게 노출됨
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `DropdownMenuItem onSelect={() => setHistoryTarget({...})}`
  - 상세: "상세 보기" 와 "삭제" 메뉴 항목은 각각 `TriggerDetailDrawer` 와 `canEdit` 가드로 렌더링 범위가 제한되는 반면, "호출 이력" 메뉴 항목은 `canEdit` 혹은 역할 게이트 없이 모든 사용자에게 노출된다. 호출 이력(시각, 성공/실패 여부)은 운영 민감 정보일 수 있다. 서버 API(`GET /api/triggers/:id/history`)가 권한 검사를 올바르게 수행한다면 실제 데이터는 보호되지만, UI 단에서도 최소 권한 원칙을 적용하는 것이 바람직하다.
  - 제안: 호출 이력 조회에 필요한 최소 역할(`viewer` 또는 그 이상)을 결정하고, 필요하다면 `<RoleGate>` 혹은 `canEdit` 가드와 동등한 조건으로 메뉴 항목을 래핑한다. 서버가 인가 경계를 올바르게 처리하고 있다면 현재 구조는 정보 노출 최소화 관점의 권고 수준이다.

- **[INFO]** 세션/토큰 관리는 이번 변경 범위 밖임 — 기존 `apiClient` 인증 메커니즘을 그대로 상속하므로 별도 위험이 추가되지 않는다.

### 입력 검증

- **[INFO]** `entry.status` 를 서버 응답에서 직접 Badge 텍스트로 렌더링
  - 위치: `trigger-history-dialog.tsx` — `<Badge ...>{entry.status}</Badge>`
  - 상세: 서버가 예상치 못한 값(예: 긴 문자열, 특수 문자)을 반환할 경우 UI 레이아웃이 깨질 수 있다. React 텍스트 노드이므로 XSS는 없다. 다만 프론트엔드에서 상태 값을 화이트리스트로 제한하지 않으므로 악의적인 서버 응답이나 중간자 공격 시나리오에서 예기치 않은 값이 노출될 수 있다.
  - 제안: 허용 상태 목록(`"success" | "error" | "failed" | ...`)으로 Zod 스키마 또는 타입 가드를 적용하거나, 화이트리스트 이외의 값을 `"unknown"` 등으로 대체하는 처리를 추가하면 방어적 프로그래밍이 강화된다.

- **[INFO]** `trigger.name` 이 클라이언트 상태(`historyTarget.name`)에 저장되어 Dialog 에 전달됨 — 서버 응답에서 온 값이므로 추가 입력 검증 필요성은 낮으나, 위 i18n 보간 이슈와 연계하여 인지할 것.

### OWASP Top 10

- **[INFO]** A01 (Broken Access Control): 위 인증/인가 항목 참조.
- **[INFO]** A05 (Security Misconfiguration): `getWebhookUrl` 함수가 `window.location.origin` 에서 포트를 교체하여 웹훅 URL 을 생성하는 패턴(`replace(/:\d+$/, ":3011")`)은 개발 환경 편의용 하드코딩으로 보이며, 프로덕션 배포 시 환경 변수 또는 서버에서 제공하는 URL 을 사용해야 한다. 이번 PR 의 직접 변경 대상은 아니나 연관 코드로 기록한다.

### 암호화

- **[NONE]** 변경된 코드에서 암호화 알고리즘 직접 사용은 없다. `crypto.randomUUID()` 사용은 표준 Web Crypto API 이며 안전하다.

### 에러 처리

- **[INFO]** 로드 실패 시 에러 상세 정보를 렌더링하지 않음 — `isError` 분기에서 i18n 키 `triggers.history.loadFailed` 만 표시하므로 서버 에러 메시지나 스택 트레이스가 UI 에 노출되지 않는다. 적절한 처리이다.

### 의존성 보안

- 이번 변경에서 신규 외부 의존성 추가는 없다(`@tanstack/react-query`, `lucide-react` 등 기존 의존성만 활용).
- `package-lock.json` 은 워킹 트리 diff 에 수정으로 나타나나 실제 변경 내용은 이번 PR 페이로드에 포함되지 않았다. 별도 의존성 감사가 필요하다면 `npm audit` 결과를 확인해야 한다.

---

## 요약

이번 변경은 "호출 이력" 진입을 별도 Dialog 로 분리하는 UI 리팩터링으로, 신규 네트워크 통신 경로(`GET /api/triggers/:id/history`)와 상태 관리가 추가된다. 하드코딩된 시크릿, 민감 정보 에러 노출, 암호화 문제는 발견되지 않았다. 주요 관찰은 두 가지이다: (1) `triggerId` 가 URL 경로에 무검증 보간되므로 서버 라우터 구현과 연계하여 ID 형식 검증을 클라이언트에서도 추가하면 방어 깊이가 개선된다; (2) "호출 이력" 메뉴 항목이 역할 가드 없이 모든 로그인 사용자에게 노출되는데, 실질적 방어는 서버 인가에 의존하더라도 최소 권한 원칙에 따라 UI 단 가드를 정비할 것을 권고한다. 나머지 항목은 INFO 수준으로 즉각적인 조치가 필요하지 않다.

---

## 위험도

LOW
