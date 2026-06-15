# Security Review — exec-history-panel

## 발견사항

### 발견사항 없음 (모든 영역 양호)

#### 1. 인젝션 취약점
- **[INFO]** `execution-history-panel.tsx` href 속성에 `workflowId` 를 직접 삽입
  - 위치: `execution-history-panel.tsx` 라인 `href={/workflows/${workflowId}/executions}`
  - 상세: `workflowId` 는 부모(`editor-toolbar.tsx`)에서 `useEditorStore` 를 통해 내려오며, 해당 store 값은 서버에서 받은 UUID 계열 식별자다. React 는 `href` 속성을 자동으로 안전하게 렌더하므로, `javascript:` 스킴 등의 XSS 는 React 18 기준 `href` sanitization 에 의해 차단된다. 단, 서버 측에서 `workflowId` 가 UUID 포맷을 보장하지 않는다면 조작된 값이 일반 경로 문자열로 삽입될 가능성이 있으나, 실질 영향은 URL 이동에 국한되고 XSS 로 이어지지 않는다.
  - 제안: `workflowId` 가 UUID 형식임을 API 응답 타입 수준에서 강제하거나, 컴포넌트 내에서 간단한 정규식(`/^[\w-]+$/`) 검사를 추가하면 방어 심층화가 가능하다 (현재는 저위험).

#### 2. 하드코딩된 시크릿
- 변경된 파일 전체에 걸쳐 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 발견되지 않았다.

#### 3. 인증/인가
- **[INFO]** `ExecutionHistoryPanel` 은 `workflowId` 를 받아 API를 호출하지만, 컴포넌트 자체에는 별도의 권한 검사(`useHasRole` 등)가 없다.
  - 위치: `execution-history-panel.tsx` 전체
  - 상세: 권한 검사가 없더라도, 실제 접근 제어는 서버 API(`GET /api/executions/workflow/:id`, `GET /api/executions/:id`) 레이어에서 수행되어야 한다. `editor-toolbar.tsx` 를 보면 메뉴 항목 노출은 `workflowId` 존재 여부로만 제어(`disabled={!workflowId}`)하며, `canEdit` 역할 체크는 삭제 메뉴 등에는 적용되어 있으나 실행 히스토리 메뉴에는 적용되지 않는다. Viewer 역할 사용자도 패널을 열어 실행 히스토리를 조회할 수 있다.
  - 제안: 이 동작이 의도된 설계인지 spec 에 명시하는 것이 좋다. 만약 Editor+ 전용이어야 한다면 `disabled={!workflowId || !canEdit}` 또는 `useHasRole` 가드를 추가한다. 현재 상태에서는 서버 권한 검사가 실질 방어선이므로 취약점으로 분류하지 않는다.

#### 4. 입력 검증
- **[INFO]** `handleSelect` 함수에서 API 에서 수신한 `ex.id` 를 그대로 `getById` 로 전달한다.
  - 위치: `execution-history-panel.tsx` `handleSelect` 함수
  - 상세: `ex.id` 는 서버가 반환한 목록 응답의 ID 값이다. 클라이언트-사이드에서 추가 포맷 검증 없이 넘기지만, 이 값은 사용자가 직접 입력하는 것이 아니고 서버 응답에서 왔으며 REST API 경로 파라미터로 전달된다. 서버 측에서 적절히 처리되어야 한다.
  - 제안: 서버 API 가 ID 포맷을 검증한다고 가정하면 저위험이다.

- **[INFO]** `loadHistoricalExecution` 은 `ExecutionData` 타입을 받아 `applyExecutionSnapshot` 에 전달하며, 타입 검사 외의 런타임 스키마 검증은 없다.
  - 위치: `apply-execution-snapshot.ts` `loadHistoricalExecution` 함수
  - 상세: API 응답 신뢰도가 높은 내부 서비스이므로 현재 수준은 적절하다.

#### 5. OWASP Top 10
- **A01 (Broken Access Control)**: 위 인증/인가 항목 참조. 서버 레이어에서 실질 제어가 이루어진다고 전제하면 문제없다.
- **A03 (Injection)**: React JSX 는 텍스트 콘텐츠를 자동으로 이스케이프하므로 XSS 위험이 없다. `triggerLabel`, `workflowName` 등 서버 데이터가 JSX 내 텍스트로만 렌더되며 `dangerouslySetInnerHTML` 사용이 없다.
- **A05 (Security Misconfiguration)**: `rel="noopener noreferrer"` 가 `target="_blank"` 링크에 올바르게 설정되어 있어 탭나이팅(tabnabbing) 공격이 차단된다.
- **A09 (Security Logging and Monitoring)**: `console.error` 로 에러 로그를 남기며, 토스트 메시지는 i18n 키를 통해 일반적 실패 메시지만 노출한다. 민감 정보(스택 트레이스, API 에러 상세)는 `console.error` 에만 기록되고 사용자 UI 에 노출되지 않는다.

#### 6. 암호화
- 변경 범위 내에서 암호화 알고리즘 사용이 없다. 데이터 전송은 상위 HTTP 레이어(HTTPS)에 위임하며, 이 컴포넌트는 그 계층에 관여하지 않는다.

#### 7. 에러 처리
- **[INFO]** `handleSelect` catch 블록에서 `console.error("Load execution history failed:", error)` 를 통해 전체 에러 객체를 콘솔에 기록한다.
  - 위치: `execution-history-panel.tsx` 라인 ~404
  - 상세: 콘솔 로그에 에러 상세가 기록되며, 사용자 UI 에는 `t("editor.executionHistoryLoadFailed")` — 번역된 일반 문구만 노출된다. 개발자 콘솔에서 에러 상세를 볼 수 있는 것은 개발 디버깅 목적으로 허용 가능한 수준이나, 프로덕션 환경에서 민감한 서버 에러 메시지가 콘솔에 노출될 수 있다.
  - 제안: 프로덕션 빌드에서는 `console.error` 를 구조적 로깅 라이브러리로 교체하거나, 에러 상세를 마스킹하는 것을 검토할 수 있다. 현재는 다른 핸들러(`handleLoadFromHistory`, `handleSaveDataset` 등)와 일관된 패턴이므로 이 PR의 단독 문제는 아니다.

#### 8. 의존성 보안
- 변경된 파일에서 새로운 외부 패키지 의존성이 추가되지 않았다. 기존에 사용 중인 `@tanstack/react-query`, `sonner`, `lucide-react` 등은 이 PR 이전부터 사용 중인 라이브러리다.

---

## 요약

이번 변경은 프론트엔드 전용 인-에디터 실행 히스토리 패널 구현으로, 신규 백엔드 코드나 엔드포인트 없이 기존 검증된 API를 재사용한다. XSS 방어(React JSX 자동 이스케이프, `dangerouslySetInnerHTML` 미사용), 오픈 리다이렉트 방지(`rel="noopener noreferrer"`), 에러 메시지 일반화(토스트에 i18n 일반 문구만 노출) 등 기본 보안 관행이 잘 지켜지고 있다. 하드코딩된 시크릿이나 인젝션 취약점은 발견되지 않았다. `workflowId` 의 URL 삽입과 Viewer 역할에서의 히스토리 패널 접근 가능성이 정보성 수준으로 확인되었으나, 전자는 React의 속성 렌더링 보호로, 후자는 서버 API 권한 제어로 실질 위험이 없다. 전반적으로 보안 위험이 낮은 변경이다.

---

## 위험도

NONE
