# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] Regenerate·Delete 버튼에 Admin RBAC UI 가드 누락
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (RefreshCw·Trash2 버튼 렌더링 섹션)
- 상세: Reveal(Eye)·Edit(Pencil) 버튼은 `{isAdmin && …}` 조건으로 가드되어 있으나, Regenerate(RefreshCw)·Delete(Trash2) 버튼은 동일한 가드 없이 인증된 모든 사용자에게 노출된다. 백엔드는 `@Roles('admin')`으로 두 엔드포인트를 fail-closed 보호하므로 실제 권한 상승은 없다. 그러나 비-admin 사용자가 버튼을 클릭하면 403 응답을 받게 되어 RBAC 정책이 UI에서 일관되게 반영되지 않는다(spec/5-system/1-auth.md §3.2). 이번 변경(God-split 리팩토링)에서 새로 도입된 것이 아닌 기존 merge-base 상태이며, 플랜 파일에 별도 작업 항목으로 등재되어 있다.
- 제안: `{isAdmin && <Button ... onClick={() => setRegenerateTarget(config.id)}>...</Button>}` 및 `{isAdmin && <Button ... onClick={() => setDeleteTarget(config.id)}>...</Button>}` 형태로 가드를 추가한다.

### [WARNING] 평문 비밀값(generatedKey) 자동 만료 없음
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (generatedKey useState), `codebase/frontend/src/app/(main)/authentication/page.tsx` (regenerateMutation onSuccess)
- 상세: 발급 직후 평문 API 키·토큰·HMAC 시크릿이 `generatedKey` React state에 string으로 저장되어 DOM에 렌더링된다. `revealedSecret`은 30초 후 `window.setTimeout(() => setRevealedSecret(null), 30_000)`으로 자동 클리어되는 반면, `generatedKey`에는 유사한 타임아웃이 없다. 또한 `regenerateMutation` 성공 시 `form.setGeneratedKey(secret)` 만 호출하고 `form.close()`가 호출되지 않아(createMutation과 달리 다이얼로그가 열리지 않은 상태에서 generatedKey가 세트됨) 표시 경로 일관성이 떨어진다. close() 호출 없이 다른 행을 클릭해 regenerate 플로우를 재진입하면 이전 generatedKey가 상태에 잔존할 수 있다.
- 제안: `generatedKey` 노출 후 일정 시간(revealedSecret과 동일하게 30초 또는 5분 등) 경과 시 자동으로 `setGeneratedKey(null)` 처리하거나, regenerate 흐름에서 별도 state를 사용하여 create 다이얼로그와 라이프사이클을 분리한다.

### [INFO] pickPlaintextSecret: 서버 응답 config 객체에 대한 타입 검증 미흡
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` (`pickPlaintextSecret` 함수)
- 상세: `key ?? token ?? secret ?? password` 우선순위 체인은 `typeof v === "string"` 가드가 있어 기본 방어는 충분하다. 그러나 `config: Record<string, unknown>` 타입을 그대로 수용하여 서버 응답 구조가 예상과 다를 경우(신규 필드 추가, 구조 변경 등) 의도하지 않은 값을 비밀값으로 처리할 수 있다. 프레젠테이션 레이어 전용 함수로 실제 보안 위험은 제한적이다.
- 제안: 서버 응답 타입을 엄격히 정의하고 zod 등 런타임 스키마 검증을 적용하거나, `pickPlaintextSecret`이 처리하는 config 형태를 명시적 타입(예: `{ key?: string; token?: string; secret?: string; password?: string }`)으로 한정한다.

### [INFO] IP Whitelist 클라이언트 측 검증 단독 의존 가능성
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (`validateAndProceed`)
- 상세: `validateAuthConfigForm`을 통한 IP/CIDR 형식 검증이 클라이언트 측 전용이다. 공격자가 API를 직접 호출하면 임의 문자열을 ipWhitelist 배열로 전달할 수 있다. 이번 변경 범위(프론트엔드 리팩토링) 외의 문제이나, 백엔드 DTO에서도 동일한 검증이 수행되는지 확인이 필요하다.
- 제안: 백엔드 DTO에 IP/CIDR 형식 검증(class-validator의 `@IsIP()`, CIDR 패턴 정규식 등)이 적용되어 있는지 확인하여 Defense-in-Depth를 확보한다.

### [INFO] username 필드 autoComplete="off" 실효성 제한
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` (username Input, 라인 약 1253)
- 상세: `autoComplete="off"`는 대부분의 현대 브라우저에서 무시된다. password 필드는 `autoComplete="new-password"`로 올바르게 설정되어 있으나 username 필드는 `autoComplete="off"`를 사용한다. 관리자 설정 화면에서 브라우저 자동완성이 적용될 경우 이전 사용자의 자격증명이 자동 입력될 수 있다.
- 제안: username 필드에 `autoComplete="username"` 또는 `autoComplete="off"` 대신 `autoComplete="new-password"` 조합 패턴(폼 전체 `autocomplete="off"` + 개별 필드 명시적 지정)을 사용하는 것을 고려한다.

## 요약

이번 변경은 `authentication/page.tsx` God Component를 `useAuthConfigForm` 훅, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `auth-config-types.ts`로 분리한 순수 구조 리팩토링으로, 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 경로 탐색, 안전하지 않은 암호화 알고리즘, 민감 정보 에러 노출 등의 취약점은 발견되지 않았다. 주요 보안 우려사항은 두 가지다: (1) Regenerate·Delete 버튼의 Admin RBAC UI 가드 누락으로 이번 변경이 아닌 기존 상태이며 백엔드 `@Roles('admin')`으로 실제 권한 상승은 차단되나 UI 일관성 문제가 있고, (2) `generatedKey`에 `revealedSecret`과 달리 자동 만료 타임아웃이 없어 평문 비밀값이 무기한 상태에 잔존할 수 있다. 두 항목 모두 플랜에 인지된 이슈로 등재되어 있다.

## 위험도

LOW
