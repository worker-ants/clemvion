# 보안(Security) 리뷰 결과

## 발견사항

### **[INFO]** generatedKey 가 React state 에 평문으로 보관됨
- 위치: `use-auth-config-form.ts` (`useState<string | null>(null)`), `auth-config-create-form.tsx` (`const { generatedKey } = form`)
- 상세: create/regenerate/reveal 응답에서 추출된 평문 비밀키를 React state 에 저장해 화면에 표시한다. 이 자체는 설계 의도(1회 표시)이고, `close()` 호출 시 `setGeneratedKey(null)` 로 즉시 제거되므로 구조상 문제없다. 다만 React DevTools 를 통해 개발 빌드에서 state 값이 노출될 수 있다는 점은 인지해야 한다.
- 제안: 프로덕션 빌드는 DevTools를 비활성화(Next.js 기본 동작)하므로 현 구조는 허용 수준. 추가 강화가 필요하다면 key 를 `useRef` 로 유지하고 표시 직전에만 state 로 승격하는 방식을 검토할 수 있으나 현 범위에서는 불필요.

### **[INFO]** Reveal 흐름: 30초 타이머 후 평문 자동 hide
- 위치: `page.tsx` (`window.setTimeout(() => setRevealedSecret(null), 30_000)`)
- 상세: Reveal 성공 후 30초 뒤 `revealedSecret` 를 null 로 초기화한다. 설계 의도에 부합하나, 탭이 백그라운드로 가도 타이머가 계속 동작(브라우저 스로틀링 대상)하는 점에 주의. 실제 노출 창이 30초보다 길어질 수 있다.
- 제안: `visibilitychange` 이벤트를 구독해 탭 숨김 즉시 hide 하거나, 실제 경과시간 기반 검증을 추가할 수 있다. 현 구현은 UX 보조 수준이므로 심각도는 낮다.

### **[INFO]** Clipboard API 에러 처리 양호 — silent-fail 없음
- 위치: `page.tsx` `copyToClipboard` 함수
- 상세: `navigator.clipboard.writeText().then(onSuccess, onError)` 패턴으로 실패 시 toast 에러를 표시한다. 평문이 클립보드 API 실패 시 조용히 유실되지 않고 사용자에게 안내된다. HTTPS 컨텍스트에서만 Clipboard API 가 동작하므로, 배포 환경이 HTTPS 임을 전제하고 있다.
- 제안: 현 구현은 적절. 비-HTTPS 로컬 개발 환경에서 fallback 없이 조용히 실패할 수 있음을 팀에 공유.

### **[INFO]** IP Whitelist 입력 검증 — 클라이언트 측 올바름, 서버 측 검증 확인 권장
- 위치: `use-auth-config-form.ts` (`validateAuthConfigForm` 호출)
- 상세: `validateAuthConfigForm` 함수가 IP/CIDR 형식을 검증해 잘못된 항목 명시와 함께 제출을 차단한다. 클라이언트 측 검증은 올바르게 구현됐다. 그러나 이 변경 세트는 프론트엔드만이므로 백엔드 DTO 레벨에서 `ipWhitelist` 배열의 각 항목을 독립적으로 검증하는지는 본 리뷰 범위 밖이다.
- 제안: 백엔드 DTO에서 `@IsIP()` 또는 `@Matches(CIDR_REGEX)` 검증이 각 배열 원소에 적용됐는지 별도 확인 권장. 클라이언트 검증 우회 시 잘못된 IP 가 DB 에 기록되는 경우를 방어.

### **[INFO]** `pickPlaintextSecret` 타입 가드로 비문자열 값 방어
- 위치: `auth-config-types.ts` (`typeof v === "string"` 가드)
- 상세: 서버 응답의 예기치 않은 타입(숫자, 객체 등)이 화면에 렌더링되는 경우를 방어한다. 테스트(`auth-config-types.test.ts`)에서도 이 경계를 검증한다. 보안적으로 양호한 방어적 구현이다.

### **[INFO]** 비밀값은 편집 폼에 로드하지 않음 — 설계 확인
- 위치: `use-auth-config-form.ts` (`openEdit` 내 `setPassword("")`), `auth-config-form-fields.tsx` (`showPassword={false}`)
- 상세: `openEdit` 호출 시 `password` 를 빈 문자열로 강제하고, 편집 다이얼로그는 `showPassword={false}` 로 비밀 입력란 자체를 렌더링하지 않는다. 마스킹된 config(예: `wfk_***1234`)가 폼 state 에 들어가지 않으므로 PATCH 페이로드에 마스킹값이 포함될 위험이 없다.
- 제안: 현 구현은 설계 의도에 부합. 양호.

### **[INFO]** 하드코딩된 시크릿 없음
- 위치: 전체 변경 파일
- 상세: API 키, 토큰, 비밀번호 등의 하드코딩된 자격증명이 존재하지 않는다. 테스트 코드의 `"wfk_live_abc123"` 은 mock 응답 픽스처로 실제 자격증명이 아니다.

### **[WARNING]** Regenerate 버튼에 Admin 가드 없음
- 위치: `page.tsx` Regenerate 버튼 렌더링 영역 (Edit/Reveal 과 달리 `isAdmin &&` 미적용)
- 상세: Edit(`{isAdmin && ...}`)과 Reveal(`{isAdmin && ...}`)은 Admin+ 가드가 있으나, Regenerate 버튼은 가드 없이 모든 인증 사용자에게 표시된다. 버튼 클릭 시 `POST /auth-configs/:id/regenerate` 가 호출되며 기존 키가 즉시 무효화된다. 백엔드에 `@Roles('admin')` 가드가 있다면 요청은 403으로 거부되지만, spec §3.2 RBAC("Editor/Viewer = R") 과 UI 가 불일치하며 불필요한 API 호출이 발생한다. 백엔드 가드가 누락됐을 경우 비-admin 이 키를 무효화할 수 있다.
- 제안: Regenerate 버튼에 `{isAdmin && (...)}` 래핑 적용:
  ```tsx
  {isAdmin && (
    <Button ... onClick={() => setRegenerateTarget(config.id)}>
      <RefreshCw className="h-4 w-4" />
    </Button>
  )}
  ```
  백엔드 `POST /auth-configs/:id/regenerate` 의 `@Roles('admin')` 가드 존재 여부도 함께 확인할 것.

### **[WARNING]** Delete 버튼에도 Admin 가드 없음
- 위치: `page.tsx` Delete 버튼 렌더링 영역 (Trash2 아이콘 버튼)
- 상세: Regenerate 와 동일하게 Delete 버튼도 `isAdmin` 가드 없이 모든 사용자에게 렌더링된다. 비-admin 이 인증 설정을 삭제하는 확인 모달을 열고 `DELETE /auth-configs/:id` 를 호출할 수 있다. 이는 spec §3.2 RBAC 과 불일치하며, 백엔드 가드가 약할 경우 DoS 성격의 설정 삭제 공격 경로가 된다.
- 제안: Delete 버튼 및 확인 모달 렌더링을 `isAdmin` 조건으로 보호:
  ```tsx
  {isAdmin && (
    <Button ... onClick={() => setDeleteTarget(config.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  )}
  ```
  백엔드 `DELETE /auth-configs/:id` 의 `@Roles('admin')` 가드도 별도 확인 권장.

---

## 요약

이번 변경은 `authentication/page.tsx` God Component 를 단일-목적 컴포넌트와 커스텀 훅으로 리팩토링한 순수 구조 분리다. 하드코딩된 시크릿 없음, 평문 비밀값의 1회 표시 및 즉시 초기화, 편집 폼에서 비밀값 제외, IP 화이트리스트 클라이언트 검증, `pickPlaintextSecret` 타입 가드 등 기존 보안 구현이 리팩토링 후에도 유지됐다. 다만 Regenerate 와 Delete 버튼이 Edit/Reveal 과 달리 Admin 클라이언트 가드 없이 렌더링되는 점이 RBAC 일관성에서 벗어나며, 백엔드 가드가 미흡하다면 비-admin 사용자가 키 무효화 또는 설정 삭제를 수행할 수 있다. 이 두 항목의 수정이 권장되며, 나머지 발견사항은 설계 의도에 부합하거나 낮은 심각도이다.

---

## 위험도

MEDIUM
