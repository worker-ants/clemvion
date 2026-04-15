## 발견사항

### [INFO] `getEnabledProviders` 테스트의 환경변수 격리 방식
- 위치: `auth-oauth.service.spec.ts` - `getEnabledProviders` describe block
- 상세: `beforeEach`에서 env를 설정하고, 각 테스트에서 `process.env`를 직접 변경하나 `afterEach`에서 원상복구하지 않음. `afterAll`에서 `originalEnv`를 복구하지만 각 테스트 사이에서는 이전 테스트의 환경변수가 잔류할 수 있음. 현재는 `beforeEach`가 다음 테스트 전에 재실행되므로 영향이 없지만, 테스트 순서 의존성이 잠재적으로 존재함.
- 제안: `afterEach`에서 변경된 env를 복구하거나, `jest.replaceProperty`/`jest.spyOn`으로 env 모킹

### [INFO] `getOauthProviders` 컨트롤러 테스트 - Cache-Control 미검증 케이스
- 위치: `auth.controller.spec.ts:108` - "returns empty list when no providers are configured"
- 상세: 빈 배열 반환 테스트에서 `Cache-Control` 헤더 설정 여부를 검증하지 않음. 빈 배열인 경우에도 `setHeader`가 호출되어야 하는데, 이 동작이 테스트되지 않음.
- 제안:
```typescript
it('returns empty list when no providers are configured', () => {
  oauthService.getEnabledProviders.mockReturnValue([]);
  const result = controller.getOauthProviders(mockRes as never);
  expect(result).toEqual({ data: { providers: [] } });
  expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
});
```

### [INFO] `fetchEnabledOauthProviders` 프론트엔드 함수 단위 테스트 부재
- 위치: `frontend/src/lib/api/auth-providers.ts`
- 상세: 신규 파일임에도 대응하는 테스트 파일이 없음. 다음 경로를 테스트하지 않음: (1) 정상 응답에서 providers 추출, (2) `res.ok`가 false인 경우 빈 배열 반환, (3) 네트워크 예외 시 빈 배열 반환, (4) 응답 body에 `data.providers`가 없는 경우
- 제안: `frontend/src/lib/api/auth-providers.test.ts` 생성하여 위 케이스 커버

### [INFO] `LoginForm`/`RegisterForm` 컴포넌트 테스트 부재
- 위치: `frontend/src/components/auth/login-form.tsx`, `register-form.tsx`
- 상세: `enabledProviders` prop 추가로 OAuth 버튼 표시 로직이 변경되었으나, 이 동작을 검증하는 프론트엔드 컴포넌트 테스트가 없음. 특히 (1) 빈 배열 시 OAuth 섹션 미표시, (2) 일부 provider만 포함 시 단일 컬럼 레이아웃, (3) 양쪽 모두 포함 시 2컬럼 레이아웃 등의 UI 분기가 테스트되지 않음.
- 제안: 기존 컴포넌트 테스트가 있다면 케이스 추가, 없다면 RTL 기반 테스트 파일 생성

### [INFO] `RegisterForm` default parameter 형태 비일관성
- 위치: `register-form.tsx:63`
- 상세: `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps = {})` — 함수 파라미터에 `= {}`가 있으나, `LoginForm`은 `{ enabledProviders = [] }: LoginFormProps` 형태로 일관성이 없음. 기능상 동일하지만 코드 스타일이 다름.
- 제안: `LoginForm`과 동일하게 `= {}` 제거

---

## 요약

백엔드 테스트(`getEnabledProviders`, `getOauthProviders`)는 핵심 케이스를 잘 커버하고 있으며 mock 사용도 적절하다. 다만 빈 배열 케이스에서 Cache-Control 헤더 검증 누락, 환경변수 격리의 잠재적 취약점이 존재한다. 더 중요한 갭은 프론트엔드 쪽으로, 신규 `auth-providers.ts` 유틸리티 함수와 `enabledProviders` prop을 받는 폼 컴포넌트의 UI 분기 로직에 단위 테스트가 전혀 없다. 실패 시 빈 배열로 graceful degradation되는 동작은 스펙상 중요한 요구사항임에도 검증되지 않는다.

## 위험도

**LOW** — 백엔드 로직은 잘 테스트되어 있고, 미커버 프론트엔드 경로들은 단순한 조건 분기로 런타임 오류 위험이 낮다. 단, `fetchEnabledOauthProviders`의 실패 처리 경로는 스펙의 핵심 안전장치이므로 테스트 추가를 권장한다.