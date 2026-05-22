# 보안(Security) 리뷰 결과

대상 커밋: `b3820314b9010b20e78994e5fac0628e72520659`
feat(triggers): row dropdown + type-specific delete confirmation (Plan A)

---

## 발견사항

### 인증/인가

- **[INFO]** 삭제 액션의 프론트엔드 RBAC 가드는 적절하게 구현됨
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `canEdit && (...)` 조건
  - 상세: `useHasRole("editor")` 훅으로 toggle/delete/schedule-edit 항목을 editor+ 역할에만 노출한다. viewer 는 메뉴 트리거 버튼 자체는 볼 수 있으나 파괴적 액션 항목은 렌더링되지 않는다. 다만 이 가드는 **순수 UI-레이어 보호**이며, 코드 변경 설명 상 백엔드 `DELETE /api/triggers/:id` 엔드포인트에는 기존부터 `editor+` 인가 검증이 존재한다고 명시되어 있다 (`editor+, 204, NotFound`). 단, 본 리뷰에서 실제 백엔드 가드 코드는 변경 범위에 포함되지 않아 직접 확인이 불가하다.
  - 제안: 백엔드 인가 로직이 실제로 `editor+` 를 강제하는지 별도 확인 권장. 프론트엔드 RBAC 는 UX 목적으로는 충분하나 보안 경계선으로는 신뢰할 수 없다.

- **[INFO]** `trigger.id` 가 URL 파라미터로 직접 삽입됨
  - 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` line 1128 — `` apiClient.delete(`/triggers/${id}`) ``
  - 상세: `id` 는 서버 응답에서 파생된 값이므로 클라이언트 측에서 임의 조작 위험이 있으나, 실질적인 인가 보호는 백엔드에서 이루어져야 한다. 또한 `deleteMutation.mutate(trigger.id)` 호출 경로상 입력 검증(이름 일치)을 통과해야 하므로 임의 호출 경로는 제한된다.
  - 제안: 문제없음. 백엔드에서 리소스 소유권 및 권한 검증이 정상 동작하는 한 별도 조치 불필요.

### 입력 검증

- **[INFO]** 이름 일치(confirm gate) 검증은 trim() 기반으로 구현됨
  - 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` line 1165 — `confirmText.trim() === trigger.name`
  - 상세: 사용자가 앞뒤 공백을 포함해 입력해도 trim() 처리로 정상 매칭된다. 이는 의도된 UX 이지만, trigger.name 자체에 leading/trailing 공백이 있을 경우 예상치 못한 쉬운 우회가 발생할 수 있다(trim은 입력만에 적용, 트리거 이름에는 미적용).
  - 제안: `confirmText.trim() === trigger.name.trim()` 으로 양쪽 모두 trim() 처리하거나, 트리거 이름 생성 단계에서 공백 정규화를 보장할 것.

### XSS 및 인젝션

- **[INFO]** i18n 템플릿 변수 (`{{url}}`, `{{cron}}`, `{{nextRunAt}}`, `{{workflowName}}`) 가 HTML 문자열로 삽입되지 않음
  - 위치: `trigger-delete-dialog.tsx` `DialogDescription` — `{confirmBody}` 렌더링
  - 상세: `confirmBody` 는 i18n 함수를 통해 생성된 문자열이며, React JSX 내 텍스트 노드로 렌더링된다. React 는 기본적으로 텍스트 노드를 이스케이프하므로 XSS 위험이 없다. `dangerouslySetInnerHTML` 사용 없음 확인.
  - 제안: 현재 구현 양호. 향후 i18n 렌더링에서 HTML 마크업을 허용하는 방식(dangerouslySetInnerHTML 등)으로 변경 시 재검토 필요.

- **[INFO]** 딥링크 URL 파라미터 (`/schedules?triggerId=${trigger.id}`)
  - 위치: `page.tsx` — `<Link href={...}>`
  - 상세: `trigger.id` 가 URL 쿼리 파라미터로 삽입된다. Next.js `<Link>` 컴포넌트는 href 를 문자열로 처리하며 React DOM 에서 속성으로 주입되므로 HTML 인젝션 위험은 없다. 다만 `triggerId` 값에 URL 특수문자가 포함된 경우 URL 파싱 오류가 발생할 수 있다.
  - 제안: `encodeURIComponent(trigger.id)` 로 명시적 인코딩 적용을 권장. `id` 가 서버에서 생성된 UUID 형식이라면 실질적 위험은 낮다.

### 에러 처리

- **[INFO]** onError 핸들러에서 에러 메시지를 사용자에게 직접 노출하지 않음
  - 위치: `trigger-delete-dialog.tsx` line 1143 — `toast.error(t("triggers.deleteFailed"))`
  - 상세: API 오류 시 번역 키(`triggers.deleteFailed`)로 고정된 메시지를 표시하며, 서버 에러 세부 정보(스택 트레이스, 내부 에러 메시지 등)를 토스트에 노출하지 않는다. 올바른 패턴.
  - 제안: 현재 구현 양호. `err.message` 나 `err.response.data` 를 직접 노출하는 방식으로 변경하지 않도록 주의.

- **[INFO]** 404 silent invalidate 처리의 정보 노출 수준
  - 위치: `trigger-delete-dialog.tsx` line 1139 — `toast.message(t("triggers.notFoundOnDelete"))`
  - 상세: 404 응답 시 "이미 삭제된 트리거예요" 메시지를 표시한다. 이 메시지는 리소스 존재 여부를 간접적으로 노출하나(resource enumeration), 트리거 목록 UI 에서 이미 해당 항목이 표시된 상태에서만 접근 가능하므로 실질적 위험은 낮다.
  - 제안: 현재 수용 가능한 수준.

### 의존성 보안

- **[INFO]** `chokidar@3.6.0` (backend) 및 `fsevents@2.3.2` (frontend) 신규 락파일 항목 추가
  - 위치: `codebase/backend/package-lock.json`, `codebase/frontend/package-lock.json`
  - 상세: `chokidar@3.6.0` 은 `@nestjs-modules/mailer` 의 optional peer dependency 로 추가된 항목이다. 2026-05 기준 해당 버전의 공개된 critical CVE 는 없다. `fsevents@2.3.2` 및 `uglify-js@3.19.3` 의 `dev: true` 태그 추가는 devDependency 분류 수정으로 런타임 노출면 변경 없다.
  - 제안: 정기적인 `npm audit` 실행 및 의존성 자동 취약점 스캔(예: Dependabot, Snyk) 유지를 권장.

- **[INFO]** `@radix-ui/react-dropdown-menu` 신규 의존성 도입
  - 위치: `codebase/frontend/src/components/ui/dropdown-menu.tsx` import
  - 상세: Radix UI 는 UI 프리미티브 라이브러리로 보안 취약점 이력이 적다. 이번 변경에서 lockfile 에 직접적인 신규 radix 버전 추가 내용은 diff 에 나타나지 않으나, 패키지 의존성 추가에 따른 공급망 리스크는 일반적 수준이다.
  - 제안: 설치된 버전을 `npm audit` 으로 주기적 검증 권장.

### OWASP Top 10 기타 항목

- **[INFO]** IDOR(Insecure Direct Object Reference) 관점 검토
  - 위치: 전반적 흐름
  - 상세: 삭제 요청 시 `trigger.id` 를 직접 API 경로에 사용한다. 프론트엔드에서는 현재 세션 워크스페이스의 트리거 목록에서만 id 를 획득할 수 있으나, 공격자가 다른 워크스페이스의 trigger id 를 알고 있을 경우 백엔드의 소유권 검증이 핵심 방어선이 된다.
  - 제안: 백엔드 `DELETE /api/triggers/:id` 핸들러에서 요청 사용자의 워크스페이스 소속 여부 및 역할을 검증하는지 반드시 확인 필요.

---

## 요약

이번 변경은 프론트엔드 전용 UI 기능(드롭다운 메뉴 + 삭제 확인 다이얼로그) 추가이며, 백엔드 코드 변경이 없다. 보안 관점에서 중요한 발견사항은 없다. RBAC 가드는 `useHasRole` 훅으로 적절히 구현되어 있고, 삭제 API 호출 전 이름 일치 confirm gate 를 요구하는 구조는 의도치 않은 삭제를 방지하는 합리적인 UX 보안 레이어다. XSS 위험은 React JSX 텍스트 노드 렌더링 방식으로 자연스럽게 차단된다. 에러 처리에서도 내부 정보가 노출되지 않는다. 주요 잠재 리스크는 프론트엔드 RBAC 만으로는 충분하지 않고 백엔드에서 IDOR 방지 및 인가 검증이 반드시 이루어져야 한다는 점이며, 이는 이번 PR 범위 밖에서 이미 처리되어 있다고 명시되어 있다. `trigger.id` URL 삽입 시 `encodeURIComponent` 적용 및 confirm gate 의 양쪽 trim() 처리는 소규모 개선 제안 수준이다.

---

## 위험도

**LOW**
