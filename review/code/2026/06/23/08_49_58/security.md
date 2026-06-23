# 보안(Security) Review 결과

## 발견사항

### 발견 없음 — 취약점 해당 없음

이번 변경(M-8 1단계 완결 커밋 `b135e6c6`)은 순수 리팩터(API 호출 경유 레이어 통일)이며 새로운 보안 취약점이 없다. 점검 항목별 상세:

#### 1. 인젝션 취약점

- **위치**: `/codebase/frontend/src/lib/api/triggers.ts` — `delete`, `getHistory`, URL 구성 전반
- **상세**: `triggersApi.delete(id)`, `triggersApi.getHistory(id, ...)` 에서 `id` 는 string 타입으로 URL 경로에 템플릿 리터럴로 삽입된다(`/triggers/${id}`, `/triggers/${id}/history`). 이 `id` 는 서버에서 발급된 엔티티 식별자를 그대로 전달하는 클라이언트-사이드 API 레이어이며, Axios 가 HTTP 요청을 구성하는 과정에서 경로 구분자 조작(path traversal)을 실현하려면 `id` 에 `/` 등이 포함되어야 한다. 클라이언트가 `trigger.id` 를 직접 변조하지 않는 이상 공격면이 없으며, 실제 검증/접근 제어는 백엔드가 담당한다. **클라이언트 레이어 자체 취약점 없음**.
- **XSS**: `trigger-history-dialog.tsx` 에서 `entry.status` 를 `<Badge>` 에 렌더하고 `entry.startedAt` 을 `formatDate` 를 통해 표시한다. React/JSX 는 기본적으로 문자열 출력을 이스케이프하고, `dangerouslySetInnerHTML` 사용이 없다. **XSS 위험 없음**.

#### 2. 하드코딩된 시크릿

- 변경된 파일 전체에 API 키·비밀번호·토큰·인증서 등 하드코딩된 시크릿 없음.
- `triggers.test.ts` 에서 `"123456:ABCDEF"` 형태의 Telegram bot token 포맷 문자열이 테스트 픽스처로 사용되나, 이는 테스트 파일 내 명백한 가짜(mock) 값이며 실제 자격증명이 아니다.

#### 3. 인증/인가

- 변경 범위는 프론트엔드 API 클라이언트 레이어로 한정된다. 인증/인가 검증은 기존 `apiClient`(`@/lib/api/client`)에 내장된 인터셉터가 처리하며, 이번 변경은 호출 경유 경로를 `apiClient.delete`/`apiClient.get` 직접 호출에서 `triggersApi.delete`/`triggersApi.getHistory` 래퍼로 교체한 것에 불과하다. 인증 헤더 첨부, 401 처리 등의 로직은 `apiClient` 에 그대로 유지된다.

#### 4. 입력 검증

- `trigger-delete-dialog.tsx` 의 삭제 확인 입력(`confirmText.trim() === trigger.name.trim()`) 은 UI 차원의 사용자 의도 검증 게이트이며, 실제 삭제 권한 검증은 백엔드가 책임진다. 이 패턴 자체의 보안 문제 없음.
- `trigger-history-dialog.tsx` 에서 `triggerId as string` 캐스팅은 `enabled: !!triggerId && open` 가드로 `null` 진입이 차단된 후 호출되므로 런타임 안전.

#### 5. OWASP Top 10

- **A01 (Broken Access Control)**: 해당 없음 — 접근 제어는 백엔드에 위임.
- **A02 (Cryptographic Failures)**: 해당 없음 — 프론트엔드 API 클라이언트 레이어에서 암호화 연산 없음.
- **A03 (Injection)**: 위 1번 항목 참조. 해당 없음.
- **A05 (Security Misconfiguration)**: 해당 없음.
- **A07 (Identification and Authentication Failures)**: 해당 없음 — 인증 로직 변경 없음.

#### 6. 암호화

- 변경된 코드에서 암호화/해시 알고리즘 사용 없음.

#### 7. 에러 처리

- `trigger-delete-dialog.tsx` 의 `onError` 핸들러는 404(concurrent delete) 시 `toast.message(t("triggers.notFoundOnDelete"))` 를 표시하고, 일반 오류 시 `toast.error(t("triggers.deleteFailed"))` 를 표시한다. 오류 객체의 내부 메시지나 스택 트레이스가 UI에 노출되지 않으며, i18n 키로만 사용자 메시지를 표현한다. **민감 정보 노출 없음**.
- `trigger-history-dialog.tsx` 의 `isError` 상태도 `t("triggers.history.loadFailed")` 만 표시한다.

#### 8. 의존성 보안

- 변경된 코드는 기존 의존성(`@tanstack/react-query`, `lucide-react`, `sonner`, `axios` via `apiClient`)을 변경하지 않고 사용한다. 신규 의존성 추가 없음.

---

## 요약

이번 변경은 프론트엔드 트리거 도메인의 API 호출을 `apiClient` 직접 호출에서 `triggersApi` 래퍼 레이어로 이관하는 순수 리팩터다. 보안 관점에서 신규 공격면이 전혀 도입되지 않았다. URL 경로에 사용되는 `id` 파라미터는 서버 발급 식별자이며 조작 가능성이 없고, UI 출력은 React 의 기본 이스케이프 메커니즘으로 보호되며, 에러 핸들러는 내부 오류 상세를 사용자에게 노출하지 않는다. 인증/인가 로직은 변경되지 않았으며, 하드코딩된 시크릿도 없다.

## 위험도

NONE
