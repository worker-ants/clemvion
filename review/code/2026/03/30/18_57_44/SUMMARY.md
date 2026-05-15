파일 쓰기 권한이 필요합니다. 아래는 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 인증 흐름의 초기 로딩 상태 미관리와 실행 엔진 연동 시 RCE/SSRF/SQLi 설계적 위험, 핵심 컴포넌트 테스트 누락이 주요 위험 요인

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 인증 | `isLoading` 초기값이 `false`로 세션 복원 전 `children`이 즉시 렌더링됨. 보호된 페이지 순간 노출 | `auth-provider.tsx:50-56` | `isLoading` 초기값을 `true`로 설정 |
| 2 | 인증 | `setLoading`이 deps 배열에 있으나 `restoreSession` 내부에서 미호출. 로딩 스피너가 실제로 표시되지 않음 | `auth-provider.tsx:41-47` | `restoreSession` 시작/완료 시 `setLoading(true/false)` 호출 |
| 3 | 인증 | 세션 복원 실패 시 `/login` 리다이렉트 후 `logout()` 호출. `/login`이 `AuthProvider` 내부에 있을 경우 무한 루프 발생 가능 | `auth-provider.tsx:40-44` | `/login` 경로를 `AuthProvider` 외부에 배치하거나 pathname 체크로 스킵 |
| 4 | 보안 | `redirect=${pathname}` 패턴에서 로그인 완료 후 redirect 처리 시 외부 URL 허용 시 open redirect 취약점 | `auth-provider.tsx:42` | redirect 처리 시 내부 경로(`/`로 시작) 여부 반드시 검증 |
| 5 | 인증 | `getMe()` 실패를 silent catch 후 `/dashboard`로 이동. `user === null`인 채 앱 동작 가능 | `login-form.tsx:62-70` | `getMe()` 실패 시 `setAuthenticated` 호출 건너뛰거나 `AuthProvider`에서 `user === null && isAuthenticated` 케이스 처리 |
| 6 | 아키텍처 | `AuthProvider`가 세션 복원 실패 시 `router.replace` 직접 호출로 라우팅 정책 혼재 | `auth-provider.tsx:42` | Next.js `middleware.ts`에서 세션 검증 처리하거나 리다이렉트 로직을 레이아웃에 위임 |
| 7 | 상태관리 | 컨텍스트 메뉴 삭제 시 `removeNode → pushUndo`와 `onNodesChange(remove) → pushUndo` 이중 실행 | `editor-store.ts:60-90`, `workflow-canvas.tsx:75-80` | 한 경로에서만 undo 관리 일원화 |
| 8 | 상태관리 | Code 탭에서 JSON 적용 시 config 전체 교체로 Settings 탭의 `notes`, `errorPolicy` 등 유실 | `node-settings-panel.tsx:237-251` | `{ ...currentConfig, ...parsed }` 병합 방식 사용 |
| 9 | 아키텍처 | `SettingsTab`/`CodeTab`에서 `useEditorStore.getState().pushUndo()`와 `setState()` 직접 호출 (레이어 우회) | `node-settings-panel.tsx:130, 235` | `editorStore.saveNodeSettings(id, data)` 액션 추출 후 컴포넌트는 액션만 호출 |
| 10 | API 계약 | `NotFoundException`에 객체 전달 시 `message` 필드가 `object`로 직렬화되어 다른 엔드포인트와 에러 형식 불일치 | `users.controller.ts:16-19` | 프로젝트 전체에 일관된 에러 형식 통일 |
| 11 | API 계약 | `'trigger'` enum 값 추가 시 프론트엔드 exhaustive switch/타입 단언에서 런타임 오류 발생 가능 | `V003__add_trigger_category.sql:2` | 프론트엔드 타입 및 switch문에 `'trigger'` 카테고리 명시적 추가 |
| 12 | API 계약 | 글로벌 인터셉터 없이 `{ data: ... }` 래퍼를 컨트롤러에서 수동 조립. 이중 래핑 또는 누락 위험 | `users.controller.ts:21-28` | 글로벌 인터셉터로 응답 래핑 일원화 또는 컨벤션 명문화 |
| 13 | 보안 | `CodeConfig` 사용자 정의 코드가 서버에서 샌드박싱 없이 실행될 경우 RCE 위험 | `data-configs.tsx:CodeConfig` | VM2/isolated-vm 등 샌드박스 환경 필수. 코드 크기 및 금지 패턴 서버 검증 |
| 14 | 보안 | `HttpRequestConfig`의 임의 URL이 서버에서 실행될 경우 SSRF 위험 | `integration-configs.tsx:HttpRequestConfig` | private IP 범위 차단, DNS rebinding 방어, `http(s)` 스킴만 허용 |
| 15 | 보안 | `DatabaseQueryConfig`의 Raw SQL이 파라미터 바인딩 없이 실행될 경우 SQL Injection 위험 | `integration-configs.tsx:DatabaseQueryConfig` | 항상 parameterized query 강제. Raw SQL 권한 별도 역할로 제한 |
| 16 | 테스트 | `AuthProvider` 세션 복구, 로딩, 리다이렉트, 중복 초기화 방지 테스트 전무 | `auth-provider.tsx` | 세션 복원 성공/실패, 리다이렉트, 스피너, 중복 실행 방지 케이스 추가 |
| 17 | 테스트 | 30개 이상 노드 타입별 설정 컴포넌트(`IfElseConfig`, `HttpRequestConfig` 등) 및 `NodeConfigRenderer` 테스트 없음 | `node-configs/` 전체 | 동적 필드 추가/제거, 조건부 렌더링, 알 수 없는 타입 처리 케이스 추가 |
| 18 | 테스트 | `WorkflowCanvas` 컨텍스트 메뉴 전이, `canDeleteNode` 가드, 삭제 로직 테스트 없음 | `workflow-canvas.tsx` | manual_trigger 삭제 방지, 외부 클릭 닫기, 일반 노드 삭제 케이스 추가 |
| 19 | 테스트 | `editor-store` `onNodesChange`의 필터링, 엣지 제거, undo 스냅샷, `selectedNodeId` 초기화 테스트 없음 | `editor-store.ts` | 각 처리 경로별 스토어 단위 테스트 추가 |
| 20 | 테스트 | `sidebar.tsx` 로그아웃 플로우, 외부 클릭 감지, 유저 정보 표시 테스트 없음 | `sidebar.tsx` | 로그아웃 성공/실패, 외부 클릭, 유저 이니셜 표시 케이스 추가 |
| 21 | 문서화 | `GET /users/me` 엔드포인트에 Swagger 데코레이터 누락 | `users.controller.ts:8-29` | Phase 1 Swagger 미사용이라면 컨트롤러 주석으로 결정 명시 |
| 22 | 문서화 | `V003.sql`에 PostgreSQL enum 비가역성 운영 주의사항 미기재 | `V003__add_trigger_category.sql:1` | 롤백 시 타입 재생성 필요 주석 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 성능 | `removedIds` 계산이 edges 필터링 콜백에서 O(n×m) 반복 | `editor-store.ts:70-76` |
| 2 | 성능 | `canDeleteNode()` 렌더마다 `nodes.find()` 선형 탐색 반복 | `workflow-canvas.tsx` |
| 3 | 유지보수 | `type Config`/`type OnChange` 6개 파일 중복 선언 | `ai-configs.tsx` 외 5개 |
| 4 | 유지보수 | 동적 목록 렌더링에서 `key={i}` 배열 인덱스 사용 | `logic-configs.tsx` 등 |
| 5 | 동시성 | `pushUndo()`와 `setState()` 별도 호출로 비원자적 업데이트 | `node-settings-panel.tsx:130, 235` |
| 6 | 아키텍처 | `LoginForm`의 `getMe()` 호출로 프로필 페치 로직이 `AuthProvider`와 분산 | `login-form.tsx:60-68` |
| 7 | 아키텍처 | `locale ?? 'ko'` 등 기본값 처리가 컨트롤러 레이어에 위치 | `users.controller.ts:22-23` |
| 8 | 아키텍처 | `NodeConfigRenderer` 30개 이상 switch-case (OCP 위반 가능성) | `node-configs/index.tsx:55-100` |
| 9 | 아키텍처 | 로그아웃 로직(API+스토어+라우팅)이 `Sidebar`에 직접 구현 | `sidebar.tsx:46-53` |
| 10 | 보안 | `USER_NOT_FOUND` 에러 메시지가 공격자에게 명확한 피드백 제공 | `users.controller.ts:15-20` |
| 11 | 성능 | `GET /users/me`에서 불필요한 전체 row 로드 (`passwordHash` 포함) | `users.controller.ts:14` |
| 12 | 보안 | `CheckboxField` label 기반 DOM id 충돌 가능 | `shared.tsx:121` |
| 13 | 인증 | `pathname` deps로 라우트 변경 시 effect 재실행, 리마운트 시 ref 초기화 위험 | `auth-provider.tsx:20, 44` |
| 14 | 동작 | `deleteKeyCode` 재활성화로 엣지 삭제도 제한 없이 가능 (의도 확인 필요) | `workflow-canvas.tsx:172` |
| 15 | 동작 | `logout()` → `router.push()` 순서 역전으로 라우팅 후 store 업데이트 | `sidebar.tsx:50-56` |
| 16 | 동작 | `SettingsTab`/`CodeTab` 분리된 로컬 state로 탭 전환 시 미저장 변경 손실 | `node-settings-panel.tsx` |
| 17 | 요구사항 | `NodeConfigRenderer`에 `manual_trigger` case 미명시 (암묵적 null 반환) | `node-configs/index.tsx` |
| 18 | DB | `BEFORE 'logic'` enum 순서 지정으로 비교 연산자 영향 | `V003__add_trigger_category.sql:3` |
| 19 | 문서화 | `AuthProvider` 비자명한 `initAttempted` ref 로직에 주석 부재 | `auth-provider.tsx:20-47` |
| 20 | 문서화 | `editor-store.ts` `onNodesChange` 3가지 부작용에 주석 부재 | `editor-store.ts:58-103` |
| 21 | 문서화 | `spec/` 경로에 `GET /users/me` 엔드포인트 명세 미반영 | 프로젝트 수준 |
| 22 | 테스트 | `mockUser`가 `beforeEach` 외부 생성으로 테스트 간 오염 위험 | `users.controller.spec.ts:12-21` |
| 23 | 테스트 | 테스트 픽스처에 `passwordHash: 'hashed-secret'` 등 민감 필드 패턴 | `users.controller.spec.ts:17-18` |
| 24 | 성능 | `NodeConfigRenderer` 30개 이상 컴포넌트 즉시 import로 코드 스플리팅 없음 | `node-configs/index.tsx` |
| 25 | 범위 | 노드 설정 패널 리팩토링과 에디터 삭제 UX 개선이 인증 변경과 동일 커밋에 혼재 | 전체 |
| 26 | API | API 버전 관리 prefix 부재 | `users.controller.ts:7` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | RCE/SSRF/SQLi 설계적 위험, open redirect |
| testing | MEDIUM | AuthProvider/NodeConfigs/WorkflowCanvas/editor-store/Sidebar 핵심 테스트 전무 |
| requirement | MEDIUM | AuthProvider 로딩 상태 오류, undo 이중 push, CodeTab config 덮어쓰기 |
| side_effect | MEDIUM | AuthProvider 리다이렉트 루프, isLoading 미갱신 |
| api_contract | MEDIUM | 에러 응답 불일치, enum 확장 클라이언트 영향, 수동 래핑 |
| maintainability | LOW | Config 타입 중복, 배열 인덱스 key, removedIds 중복 계산 |
| database | LOW | enum 비가역성 문서화 미흡, 전체 row 불필요 로드 |
| documentation | LOW | Swagger 누락, SQL 롤백 주의사항 미기재 |
| performance | LOW | O(n×m) 계산, canDeleteNode 반복 탐색, 코드 스플리팅 미적용 |
| architecture | LOW | AuthProvider 라우팅 혼재, store 직접 접근, 인증 플로우 분산 |
| concurrency | LOW | pushUndo+setState 비원자적, pathname 의존성 재실행 |
| scope | LOW | 3개 독립 피처가 단일 커밋에 혼재 |
| dependency | **NONE** | 외부 패키지 추가 없음, 내부 의존성 방향 적절 |

---

## 발견 없는 에이전트

- **dependency** — 외부 패키지 추가 없음. 내부 모듈 간 의존 방향 단방향으로 순환 의존 없음.

---

## 권장 조치사항

1. **[즉시] AuthProvider 인증 초기화 흐름 수정** — `isLoading` 초기값 `true`, `setLoading(true/false)` 호출 추가, `/login` 경로 AuthProvider 외부 배치
2. **[즉시] 핵심 컴포넌트 테스트 추가** — `AuthProvider`, `editor-store onNodesChange`, `WorkflowCanvas` 컨텍스트 메뉴, `Sidebar` 로그아웃
3. **[즉시] undo 이중 push 수정** — `removeNode` 또는 `onNodesChange` 중 한 경로로 일원화
4. **[즉시] CodeTab config 병합 수정** — `{ ...currentConfig, ...parsed }` 방식으로 교체
5. **[즉시] 실행 엔진 보안 대책 확인** — RCE/SSRF/SQLi 방어 적용 여부 확인 및 미적용 시 즉시 구현
6. **[단기] login-form.tsx getMe 실패 처리** — 실패 시 `setAuthenticated` 호출 건너뛰기
7. **[단기] API 에러 응답 형식 통일** — GlobalExceptionFilter 또는 string 형식 통일
8. **[단기] `'trigger'` 카테고리 프론트엔드 타입 반영**
9. **[단기] SettingsTab store 직접 접근 리팩토링** — `saveNodeSettings` 액션 추출
10. **[단기] removedIds Set 최적화**
11. **[중기] 글로벌 응답 래핑 인터셉터 적용**
12. **[중기] NodeConfigRenderer 코드 스플리팅 적용**
13. **[중기] spec/ API 문서 업데이트**
14. **[중기] Config/OnChange 타입 중복 제거**
15. **[중기] V003 마이그레이션 롤백 주의사항 주석 추가**