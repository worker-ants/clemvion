# 보안(Security) 리뷰 — exec-history-panel (§7 인-에디터 실행 히스토리 패널)

## 발견사항

### [INFO] workflowId URL 삽입 — React href 보호로 XSS 위험 낮음
- 위치: `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`, `href={/workflows/${workflowId}/executions}` 라인
- 상세: `workflowId` 가 외부 사용자 입력이 아닌 라우트 파라미터(신뢰할 수 있는 서버 소스)에서 비롯되며, React는 `href` 속성에 대해 `javascript:` 프로토콜을 기본 차단(React 16.9+)한다. 실질적 XSS 위험은 낮다. 단, `workflowId` 가 URL에 직접 삽입되므로 UUID 형식 검증이 없는 상태다.
- 제안: `workflowId` 값이 UUID 형식임을 컴포넌트 경계에서 확인하거나, 최소한 TypeScript 타입으로 브랜드 타입(`WorkflowId`)을 사용하면 안전성이 높아진다. 현재 상태는 저위험이며 즉각 수정 불필요.

### [INFO] Viewer 역할 패널 접근 가능 — 서버 API 권한이 실 방어선
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`, `editor-execution-history-menu` 버튼 disabled 조건
- 상세: `disabled={!workflowId || isCancellable}` 조건만 존재하며, Viewer 역할 사용자도 에디터 더보기 메뉴의 "실행 히스토리" 버튼에 접근할 수 있다. 그러나 이 패널은 실행 내역 read-only 조회만 수행하며, 재실행(Re-run)은 드로어에서 `allowReRun` hidden 게이트로 이미 차단된다. 실제 보안 방어선은 `GET /executions/workflow/:id` 및 `GET /executions/:id` 서버 API의 권한 검증이다.
- 제안: 의도된 설계라면 추가 프론트엔드 게이트 불필요. 단, spec §7 에 Viewer 역할 접근 허용 여부를 명시하면 추후 모호함을 방지한다.

### [INFO] 에러 메시지에 민감 정보 미노출 — 적절한 처리
- 위치: `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`, `handleSelect` catch 블록
- 상세: 에러 발생 시 `console.error("Load execution history failed:", error)` 로 원본 에러를 콘솔에 기록하고, 사용자에게는 `t("editor.executionHistoryLoadFailed")` i18n 문자열만 toast로 노출한다. 서버 에러 메시지, 스택 트레이스, 내부 상태 등이 UI에 직접 노출되지 않아 에러 처리가 적절하다.
- 제안: 추가 조치 불필요.

### [INFO] 하드코딩된 시크릿 없음
- 위치: 변경된 전체 파일
- 상세: 변경된 파일 전체에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. i18n 딕셔너리 파일(`en/editor.ts`, `ko/editor.ts`)도 UI 문자열만 포함한다.
- 제안: 추가 조치 불필요.

### [INFO] 인젝션 취약점 없음
- 위치: 변경된 전체 소스 파일
- 상세: SQL/커맨드/LDAP 인젝션 가능 지점 없음(순수 프론트엔드 컴포넌트). XSS 관련해서는 React JSX가 동적 콘텐츠(`ex.triggerLabel`, `ex.status` 등)를 텍스트로 안전하게 이스케이프하며, `dangerouslySetInnerHTML` 사용 없음. `timeAgo`, `formatDuration`, `getStatusLabel` 등 유틸리티 함수 출력이 JSX에서 텍스트 노드로만 렌더되어 XSS 공격 벡터 없음.
- 제안: 추가 조치 불필요.

### [INFO] `target="_blank"` + `rel="noopener noreferrer"` 적절히 적용
- 위치: `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`, "All Executions" 앵커 태그
- 상세: `target="_blank"` 링크에 `rel="noopener noreferrer"` 가 함께 명시되어 있어 탭나빙(tabnapping) 공격을 방지한다.
- 제안: 추가 조치 불필요.

### [INFO] 의존성 보안 — 신규 의존성 없음
- 위치: 변경된 전체 파일
- 상세: 기존 의존성(`@tanstack/react-query`, `lucide-react`, `sonner`, `zustand` 등)을 재사용하며, 신규 npm 패키지 추가 없음. 알려진 취약점이 있는 신규 라이브러리 도입 위험 없음.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경(§7 인-에디터 실행 히스토리 패널)은 순수 프론트엔드 read-only UI 기능으로, 보안 관점의 실질적 취약점이 없다. XSS 방어(React 이스케이프 + `rel="noopener noreferrer"`), 에러 처리(민감 정보 미노출), 시크릿 관리(하드코딩 없음) 모두 적절하다. `workflowId`의 URL 삽입과 Viewer 역할 접근은 저위험 INFO 항목이며, 전자는 서버 소스에서 오는 라우트 파라미터이고 후자는 서버 API 권한이 실 방어선으로 작동한다. 인증/인가 우회 가능성, 인젝션, 암호화 문제 등은 해당 없다.

## 위험도

NONE
