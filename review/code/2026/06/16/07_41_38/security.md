### 발견사항

- **[WARNING]** "Add Auth Method" 버튼에 isAdmin 가드 없음 — 인가(Authorization) 불일치
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 263 (`<Button onClick={form.openCreate}>`)
  - 상세: `isAdmin` 체크가 Reveal(line 518)·Edit(line 529) 버튼에는 적용되지만, "Add Auth Method" 버튼은 가드 없이 모든 역할(Editor/Viewer 포함)에 노출된다. 사용자가 폼을 열어 제출하면 백엔드 `@Roles('admin')`이 403을 반환하지만, UI 레벨 통제 부재로 권한 없는 사용자가 동작을 시도할 수 있다. 이는 OWASP A01:2021 (Broken Access Control)에 해당한다. 백엔드가 최종 방어선이므로 기능 보안은 유지되지만, 최소 권한 원칙(PoLP) 위반이다.
  - 제안: `<Button onClick={form.openCreate}>` 를 `{isAdmin && <Button ...>}` 로 감싸 spec `§3.2 RBAC` 와 일치시킨다.

- **[WARNING]** Regenerate 버튼에 isAdmin 가드 없음 (pre-existing) — 인가 불일치
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 541–548 (Regenerate 버튼, `onClick={() => setRegenerateTarget(config.id)}`)
  - 상세: Regenerate(`auth_config.regenerate`)는 Admin+ 전용 액션이지만(spec §4.1, §3.2 RBAC), 버튼이 모든 역할에 노출된다. Reveal·Edit 버튼은 `{isAdmin && (...)}` 패턴이 적용된 반면 Regenerate만 누락됐다. 이번 변경이 도입한 이슈는 아니나, 리팩터링 diff 범위에서 발견된 pre-existing 취약점이다.
  - 제안: `{isAdmin && (<Button ... onClick={() => setRegenerateTarget(config.id)}>...</Button>)}` 로 감싸 Reveal·Edit 버튼과 동일한 패턴을 적용한다.

- **[WARNING]** Delete 버튼에 isAdmin 가드 없음 — 인가 불일치
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 549–557 (Delete 버튼)
  - 상세: Delete(`auth_config` 삭제) 역시 Admin+ 전용 CRUD 액션이지만 `isAdmin` 가드 없이 모든 역할에 노출된다. Regenerate와 동일한 pre-existing 이슈. 클릭 시 삭제 확인 다이얼로그가 표시되고 백엔드가 최종 차단하지만, UI 통제는 누락됐다.
  - 제안: Delete 버튼도 `{isAdmin && (...)}` 로 감싸 RBAC 원칙을 UI 레벨에서 강제한다.

- **[INFO]** Toggle(활성/비활성) 버튼에 isAdmin 가드 없음 — 역할 정책 확인 필요
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 503–517 (Toggle 버튼)
  - 상세: `toggleMutation`은 `isActive` 필드만 PATCH한다. spec §3.2 RBAC에서 Auth Config CRUD가 Owner/Admin only로 명시되므로 isActive 변경도 Admin+ 대상인지 확인이 필요하다. 현재 Toggle 버튼은 모든 역할에 노출된다.
  - 제안: spec §3.2에서 isActive toggle의 RBAC 범위를 확인하고, Admin+ 전용이라면 `{isAdmin && (...)}` 추가.

- **[INFO]** `pickPlaintextSecret` — 평문 비밀값 표시 경로 보안 정합 확인
  - 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` line 58–64
  - 상세: `key ?? token ?? secret ?? password` 우선순위 체인은 create/regenerate/reveal 3 경로에서만 호출된다. `generatedKey`와 `revealedSecret`은 30초 자동 클리어 타이머(`SECRET_AUTOCLEAR_MS = 30_000`)가 설정되어 있다. 평문이 React 상태에만 존재하고 localStorage/sessionStorage에 기록되지 않는 설계는 적절하다. 개선 사항 없음.

- **[INFO]** IP Whitelist 입력 검증 — 클라이언트 측 UX 가드 + 백엔드 시행
  - 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` line 46–54 (`isValidIpOrCidr`)
  - 상세: `isValidIpOrCidr`는 클라이언트 측 UX 가드이며, 주석에 "최종 시행은 백엔드의 `ip-address` 라이브러리 기반 fail-closed 매칭"으로 명시되어 있다. IPv4·IPv6(CIDR 포함)을 처리하며 `javascript:alert(1)` 같은 인젝션 시도는 기본적으로 차단된다. 프론트엔드 검증만으로 보안을 보장하지 않고 백엔드가 최종 시행하는 구조는 올바르다.

- **[INFO]** HTTP 헤더명 검증 — RFC 7230 token 검사로 헤더 인젝션 방지
  - 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` line 57–59 (`isValidHeaderName`)
  - 상세: 정규식이 개행(`\r\n`) 문자·콜론·공백을 차단해 HTTP Header Injection 공격을 방지한다. 클라이언트 UX 가드로서 적절하다.

- **[INFO]** `formStateFromAuthConfig`에서 비밀값 제외 처리
  - 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` line 154–179
  - 상세: 편집 폼 초기값 조립 시 `password: ""`로 비밀값을 명시 제외한다. 마스킹된 응답의 `config`에서 `key`/`token`/`secret`/`password` 필드가 있더라도 폼 상태에 싣지 않는 구조가 비밀값 누출을 차단한다.

- **[INFO]** `revealMutation`에서 사용자 패스워드를 요청 body로 전송
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` line 219–235
  - 상세: POST `/auth-configs/${id}/reveal` body에 `{ password }` 포함. HTTPS 전송 전제 시 평문 전송 위험은 없으나, HTTPS 강제 여부는 인프라 레벨 확인 필요. 코드 자체의 취약점은 없음.

### 요약

이번 변경은 `authentication/page.tsx` God Component를 `useAuthConfigForm` 훅·`AuthConfigCreateForm`·`AuthConfigEditDialog`·`AuthConfigFormFields`·`auth-config-types.ts`로 분리한 순수 리팩터링이다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 안전하지 않은 암호화, 민감 정보 에러 노출, 알려진 취약 의존성 등은 발견되지 않았다. 보안 관점의 핵심 리스크는 UI 레벨 RBAC 가드 누락 3건이다: "Add Auth Method" 버튼(WARNING, 이번 diff로 독립 핸들러가 되면서 가드 추가 기회)과 Regenerate·Delete 버튼(WARNING, pre-existing). 세 경우 모두 백엔드 `@Roles('admin')`이 최종 방어선으로 기능 보안은 유지되지만, OWASP A01(Broken Access Control) 및 최소 권한 원칙 위반에 해당하므로 수정이 권장된다. 비밀값 생명주기(30초 자동 클리어, 편집 폼 비밀값 제외, 다이얼로그 닫힘 시 상태 초기화)는 적절히 관리된다.

### 위험도

MEDIUM
