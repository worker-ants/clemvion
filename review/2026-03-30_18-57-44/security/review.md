### 발견사항

---

**[WARNING] `GET /users/me` — 삭제된 계정의 유효 JWT로 탐색 가능 (수정됨)**
- 위치: `users.controller.ts:15-20`
- 상세: 이미 `NotFoundException`으로 수정되어 있으나, 에러 바디에 `code: 'USER_NOT_FOUND'` 구조화 메시지를 포함하여 반환. 공격자가 토큰 재사용 시 명확한 피드백을 얻을 수 있음. 인증 맥락에서는 이 정보가 불필요.
- 제안: `throw new NotFoundException()` (메시지 없음) 또는 generic `throw new UnauthorizedException()` 사용 권장

---

**[WARNING] `AuthProvider` — open redirect 가능성**
- 위치: `auth-provider.tsx:42`
- 상세: `router.replace(\`/login?redirect=${encodeURIComponent(pathname)}\`)` — pathname은 Next.js 내부 경로이므로 직접적인 open redirect 위험은 낮으나, 로그인 후 redirect 처리 로직(미제공)이 외부 URL을 허용하면 취약해짐
- 제안: 로그인 완료 후 redirect 처리 시 내부 경로(`/`로 시작) 여부를 반드시 검증

```ts
const safeRedirect = redirect?.startsWith('/') ? redirect : '/dashboard';
router.push(safeRedirect);
```

---

**[WARNING] `CodeConfig` — 사용자 코드 주석에 `$input`, `$vars` 노출**
- 위치: `data-configs.tsx:CodeConfig`
- 상세: 실행 엔진이 `$input`, `$vars`, `$execution`, `$helpers`를 코드에 주입하는 구조로 보임. 이 코드가 서버에서 `eval()`/`new Function()` 방식으로 실행된다면 **임의 코드 실행(RCE)** 위험. 클라이언트 에디터 자체는 취약하지 않으나, 실행 엔진의 샌드박싱 여부가 핵심.
- 제안: 실행 엔진에서 반드시 VM2/isolated-vm 등 샌드박스 환경으로 실행할 것. 코드 저장 시 서버에서 크기 및 금지 패턴 검증 추가

---

**[WARNING] `integration-configs.tsx:HttpRequestConfig` — SSRF 위험**
- 위치: `HttpRequestConfig`, URL 입력 필드
- 상세: 사용자가 임의의 URL (`placeholder: "https://api.example.com/endpoint"`)을 입력하고 서버가 이를 실행하는 구조. 내부 네트워크(`169.254.x.x`, `10.x.x.x`, `localhost`, `metadata.google.internal` 등)로 요청이 가능하면 SSRF(Server-Side Request Forgery) 발생
- 제안: 서버 실행 엔진에서 URL 검증 필수 — private IP 범위 차단, DNS rebinding 방어, `http(s)` 스킴만 허용

---

**[WARNING] `DatabaseQueryConfig` — SQL Injection 위험**
- 위치: `integration-configs.tsx:DatabaseQueryConfig`, Query/Parameters 필드
- 상세: Raw SQL 입력(`queryType: 'raw'`)과 parameters를 JSON 배열로 직접 입력받는 구조. 서버 실행 시 파라미터가 prepared statement로 바인딩되지 않으면 SQL Injection 발생
- 제안: 실행 엔진에서 항상 parameterized query 사용 강제. Raw SQL 실행 권한을 별도 역할(admin)로 제한 검토

---

**[INFO] `login-form.tsx` — catch 블록 silent failure**
- 위치: `login-form.tsx:63-68`
- 상세: `usersApi.getMe()` 실패 시 완전히 무시됨. 인증 상태가 불완전하게 설정된 채로 대시보드로 이동할 수 있음. 실제로는 AuthProvider가 복구하지만, 인증 상태 일관성 문제.
- 제안: 실패 시 최소한 `console.warn` 또는 `setAuthenticated` 호출 건너뛰기

---

**[INFO] `shared.tsx:CheckboxField` — label id 충돌 가능성**
- 위치: `shared.tsx:CheckboxField`
- 상세: `id = \`cb-${label.replace(/\s+/g, "-").toLowerCase()}\`` — 동일한 label을 가진 필드가 여러 개 렌더링되면 DOM id 충돌 발생. 보안 이슈는 아니나 예측 가능한 id 패턴이 자동화 공격 타겟이 될 수 있음
- 제안: `useId()` 훅 사용

---

**[INFO] `workflow-canvas.tsx` — context menu 위치가 viewport 밖으로 벗어날 수 있음**
- 위치: `workflow-canvas.tsx:192-193` `style={{ left: contextMenu.x, top: contextMenu.y }}`
- 상세: `event.clientX/Y` 기반으로 `fixed` 포지션 설정. 보안 이슈는 아니나 XSS 가능성 없음(값이 숫자).

---

**[INFO] `users.controller.spec.ts` — 테스트에 민감 필드 평문 포함**
- 위치: `users.controller.spec.ts:17-18`
- 상세: `passwordHash: 'hashed-secret'`, `twoFactorSecret: 'totp-secret'` — 테스트 환경이므로 실질적 위험 없음. 다만 실제 해시/시크릿이 테스트 픽스처에 혼입되는 패턴의 선례가 됨.
- 제안: `passwordHash: 'REDACTED'` 등 명시적으로 더미임을 표기

---

### 요약

이번 변경사항의 직접적인 코드 레벨 보안 취약점은 낮습니다. `UsersController`는 JWT 가드와 `NotFoundException`이 이미 적용되어 있고, 프론트엔드 컴포넌트들은 클라이언트 상태 관리에 집중합니다. 그러나 **설계 수준의 위험**이 존재합니다: `CodeConfig`의 사용자 정의 코드가 서버에서 실행될 때 샌드박싱 없으면 RCE, `HttpRequestConfig`의 임의 URL이 서버에서 실행되면 SSRF, `DatabaseQueryConfig`의 Raw SQL이 실행 엔진에서 파라미터 바인딩 없이 처리되면 SQLi로 이어집니다. 이 세 가지는 현재 리뷰 파일 범위를 벗어나지만 실행 엔진과 연동될 때 반드시 방어가 필요합니다. `AuthProvider`의 redirect 처리도 로그인 완료 시 경로 검증이 없으면 open redirect로 발전할 수 있습니다.

### 위험도
**MEDIUM** — 현재 코드 자체의 직접 취약점은 낮으나, 실행 엔진 연동 시 RCE/SSRF/SQLi로 이어질 수 있는 설계적 위험이 존재