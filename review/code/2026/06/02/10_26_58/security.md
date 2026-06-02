# 보안(Security) 리뷰 결과

리뷰 대상: cafe24-allowlist-ui (Cafe24 MCP server allowlist UI 신설)
리뷰 일시: 2026-06-02

---

## 발견사항

### 1. [WARNING] `onChange`의 타입 강제 우회로 인한 런타임 계약 위반 가능성

- 위치: `codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` L569
- 상세: `commit` 함수 내부에서 `undefined as unknown as string[]` 캐스트를 사용해 `onChange(enabledTools: string[])` 타입 계약을 위반한다. TypeScript 타입 시스템이 완전히 우회되므로, 부모 컴포넌트가 수신한 값을 `string[]` 로 가정하고 `.length`, `.includes()` 등을 호출하면 런타임 TypeError 가 발생한다. 이것은 보안 취약점 직접 유발은 아니지만 allowlist 상태가 의도치 않게 "전부 허용(undefined)" 으로 전파될 때 상위 컴포넌트가 이를 빈 배열로 잘못 해석해 allowlist 를 빈 채로 저장할 수 있어, 실질적으로 **모든 operation 을 차단**하거나 반대로 **유효성 검증이 없는 경우 전부 허용**이 되는 논리 오류로 이어질 수 있다.
- 제안: `onChange` Props 타입을 `onChange: (enabledTools: string[] | undefined) => void` 로 변경하거나, 또는 `commit` 이 `undefined` 를 반환할 때 별도 `onReset` 콜백을 분리해 타입 캐스트 없이 의도를 명확히 한다.

---

### 2. [WARNING] 백엔드 서버로부터 받은 `extras` 객체의 신뢰도 문제 — 클라이언트측 보안 결정에 활용

- 위치: `codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` `readCafe24Extras()` 전체
- 상세: `getNodeDefinition("cafe24").extras` 는 백엔드 `GET /nodes/definitions` 응답에서 온 데이터다. 현재 코드는 `operationsByResource` 와 `plannedByResource` 의 존재 여부만 확인하고, 각 `operation.id` 와 `operation.labelKey` 의 내용은 무검증으로 사용한다. 이 데이터가 중간자 공격(MITM) 이나 악의적 백엔드 응답으로 오염되면 렌더링 시 `op.labelKey` 가 XSS 페이로드를 포함할 수 있다. `resolveCafe24OperationLabel` 이 dict miss 시 `labelKey` 를 **그대로** 반환(`dict[labelKey] ?? labelKey`)하며, `cafe24-allowlist-editor.tsx` 는 이 값을 `<span className="truncate">{resolveCafe24OperationLabel(...)}</span>` 로 렌더링한다. React 는 기본적으로 텍스트 노드 이스케이프를 처리하므로 직접 스크립트 실행은 차단되지만, 공격자가 제어하는 문자열이 UI 라벨로 노출되는 것(UI Redressing) 은 가능하다.
- 제안: 백엔드 응답 데이터를 클라이언트에서 allowlist 키로 사용하기 전에 `id` 필드가 alphanumeric + underscore 패턴(`/^[a-zA-Z0-9_]+$/`) 만 허용하는 화이트리스트 정규식으로 검증하고, `labelKey` 도 마찬가지로 `cafe24.<resource>.<id>` 패턴에 맞는지 검증한다. 현재 React 의 자동 이스케이프로 XSS 직접 실행 위험은 낮지만, 검증이 추가되면 백엔드 응답 오염 시 UI 에 이상한 텍스트가 노출되는 것을 방어할 수 있다.

---

### 3. [INFO] `enabledTools` 배열 출처 및 저장 경로의 CSRF 위험

- 위치: `codebase/frontend/src/components/integrations/mcp-server-selector.tsx` `patch()` 함수
- 상세: `onChange` → `patch()` 콜백이 `enabledTools` 를 부모 컴포넌트를 통해 백엔드에 저장할 것으로 추정된다. 이 데이터 흐름에서 CSRF 보호가 적용되는지는 현재 변경 코드만으로 확인하기 어렵다. `Cafe24AllowlistEditor` 가 직접 API 를 호출하지 않고 `onChange` 콜백으로만 전파하므로, CSRF 토큰 포함 여부는 상위 레이어(AI Agent 노드 설정 저장 API 호출부)에 달려 있다.
- 제안: 변경 코드 자체에는 직접 위험이 없으나, 설정 저장 API 호출 시 CSRF 토큰이 HTTP 헤더(`X-CSRF-Token` 또는 `Authorization` Bearer) 로 전송되는지 integration test 에서 확인한다.

---

### 4. [INFO] `_retry_state.json` 에 절대 경로 포함

- 위치: `review/consistency/2026/06/02/10_09_21/_retry_state.json`
- 상세: `session_dir`, `prompt_file`, `output_file` 필드에 `/Volumes/project/private/clemvion/` 로 시작하는 로컬 절대 경로가 하드코딩되어 있다. 이 파일이 리포지토리에 커밋되어 공개 저장소로 배포될 경우, 개발 환경의 파일 시스템 구조(경로, 프로젝트 이름)가 외부에 노출된다. 직접적인 취약점이 아니지만 정보 노출(OWASP A05:2021 Security Misconfiguration)에 해당한다.
- 제안: `_retry_state.json` 을 `.gitignore` 에 추가하거나, 절대 경로 대신 상대 경로를 사용하도록 orchestrator 를 수정한다. 혹은 `review/**/_retry_state.json` 패턴을 gitignore 로 처리한다.

---

### 5. [INFO] 에러 메시지에 내부 서비스 구조 노출

- 위치: `codebase/frontend/src/components/integrations/mcp-server-selector.tsx` L1057
- 상세: 에러 메시지 "Failed to load MCP servers. Check the integrations service and reload." 에서 "integrations service" 라는 내부 서비스 명칭이 사용자에게 그대로 노출된다. 공격자가 이를 통해 시스템 내부 구조를 파악할 수 있다. OWASP A09:2021 Security Logging and Monitoring Failures 의 information leakage 관점에서 경미한 수준이다.
- 제안: 에러 메시지를 i18n 키로 처리하고, 기술적 세부사항(서비스 이름)은 제거하거나 일반화한다. 예: `t("errors.mcpServersLoadFailed")`.

---

## 요약

이번 변경은 순수 프론트엔드 UI 컴포넌트(Cafe24 MCP allowlist 편집기 신설, 공유 헬퍼 추출, i18n 추가)로, 직접적인 인젝션 취약점이나 하드코딩된 시크릿은 없다. 가장 주목할 점은 두 가지다: (1) `onChange` 타입 계약을 `undefined as unknown as string[]` 로 강제 우회하는 패턴이 allowlist 상태의 논리적 오류로 이어질 수 있어 WARNING 수준으로 수정이 권장된다. (2) 백엔드 응답 extras 의 `op.id` / `op.labelKey` 가 무검증으로 렌더링 라벨 및 allowlist 키로 사용되는 점은 React 자동 이스케이프로 XSS 직접 실행 위험은 낮지만, MITM 시나리오에서 UI 표시가 오염될 수 있어 입력 검증 강화가 권장된다. `_retry_state.json` 의 절대 경로 하드코딩은 gitignore 처리로 해소할 수 있다. 암호화, 세션 관리, 인증/인가 레이어는 이번 변경 범위에 포함되지 않는다.

## 위험도

LOW
