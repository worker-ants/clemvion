## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] Viewer가 auth-config 실행 메타데이터 무제한 조회 가능**
- 위치: `auth-configs.controller.ts` — `getUsage()` 메서드 (L125-133), `auth-configs.controller.spec.ts` L38-42
- 상세: `getUsage` 엔드포인트는 `@Roles` 미적용 상태이며 테스트에서도 `undefined`(무제한)로 의도적으로 검증됨. 응답에 "최근 호출 20건의 실행 메타"가 포함되는데, 이 메타데이터에 요청 IP, 입력 파라미터, 인증 시도 패턴 등 민감한 운영 정보가 포함될 경우 Viewer 역할이 과도한 정보에 접근하게 됨.
- 제안: `AuthConfigUsageDto`의 실제 필드를 검토하여 민감 필드(IP, payload 등)가 포함된 경우 `@Roles('editor')` 추가 또는 Viewer 전용 응답 DTO로 민감 필드를 제거.

---

**[WARNING] Editor가 워크스페이스 내 모든 인증 키/토큰 무효화 가능**
- 위치: `auth-configs.controller.ts` — `regenerate()` 메서드 (L137-155)
- 상세: `@Roles('editor')` 하나로 모든 편집자가 워크스페이스의 어떤 인증 설정이든 즉시 키를 교체할 수 있음. 키 교체는 기존 토큰을 즉시 무효화하므로(설명에 명시됨) 다른 서비스가 이 키를 사용 중이라면 서비스 중단으로 이어짐. 일반적으로 키 순환(rotation)은 Admin 이상에게만 허용하는 것이 표준 보안 관행임.
- 제안: `regenerate`에 `@Roles('admin')` 또는 최소 `@Roles('editor')` + 생성자(creator) 검증을 서비스 레이어에 추가. 혹은 설계 결정으로 유지하되 spec에 명시.

---

**[INFO] 프론트엔드 RBAC는 UI 은닉에 한정 — 백엔드 가드에 의존**
- 위치: `schedules/page.tsx`, `triggers/page.tsx`, `editor-toolbar.tsx`의 `<RoleGate>` 래핑
- 상세: `RoleGate`는 React 렌더 조건으로만 동작하므로, 브라우저 DevTools로 API를 직접 호출하는 Viewer를 막지 못함. 실제 보안은 백엔드 `RolesGuard`에 위임되어 있음. 현재 백엔드 가드가 적절히 구현되어 있으므로 허용 가능한 Defense-in-depth 구조이나, 프론트엔드 mutation 함수들(toggleMutation, deleteMutation 등)이 호출 전 역할 검증을 하지 않는 점은 명확히 인지 필요.
- 제안: 현행 구조 유지 가능. 단, 프론트 mutation의 onError 핸들러에서 403 응답 시 권한 오류임을 사용자에게 적절히 안내하는지 확인 필요.

---

**[INFO] `structuredConfig` 타입 정보 손실**
- 위치: `execution-engine.service.ts` L1514
- 상세: 기존 `as Record<string, unknown> | undefined` 명시적 캐스트가 제거됨. `structured?.config`의 타입이 unknown이나 any로 추론될 경우, 이후 코드에서 타입 안전성 없이 이 값을 사용하게 될 수 있음. 런타임 동작은 동일하지만 타입 가드 의도가 희석됨.
- 제안: 소스 타입이 명확히 정의된 경우 현행 유지 무방. 그렇지 않다면 `as Record<string, unknown> | undefined` 캐스트 복원 또는 소스 타입 강화 고려.

---

**[INFO] 긍정 사항 — ParseUUIDPipe 및 워크스페이스 격리 일관 적용**
- 위치: 양 컨트롤러 전체 `:id` 파라미터
- 상세: 모든 경로 파라미터에 `ParseUUIDPipe`를 사용해 UUID가 아닌 입력(경로 탐색, 인젝션)을 사전 차단하고 있음. `@WorkspaceId()` 데코레이터로 모든 서비스 호출이 인증된 사용자의 워크스페이스로 스코핑되어 크로스 테넌트 접근이 차단됨. 올바른 구현.

---

### 요약

이번 변경은 auth-configs, folders 백엔드 컨트롤러에 `RolesGuard`·`@Roles('editor')` 가드를 추가하고, 프론트엔드 Schedules/Triggers/EditorToolbar 페이지에 `RoleGate`로 쓰기 UI를 은닉하는 RBAC 확장 구현이다. 전반적으로 서버 측 가드와 클라이언트 측 UI 제어가 계층적으로 적용되어 있고 ParseUUIDPipe·WorkspaceId 기반 테넌트 격리도 일관성 있게 유지된다. 주요 보안 리스크는 구현 버그보다 설계 결정의 범주에 가깝다: Viewer에게 노출되는 `getUsage` 메타데이터의 민감도와, Editor 누구든 즉시 인증 키를 무효화할 수 있는 `regenerate` 권한 범위를 재검토할 필요가 있다. 인젝션, 하드코딩 시크릿, 암호화 취약점 등 OWASP Top 10에 해당하는 치명적 결함은 발견되지 않았다.

### 위험도

**LOW**