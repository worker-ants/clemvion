# 보안(Security) Review

## 발견사항

- **[INFO]** 클라이언트 MIME 검증은 우회 가능 (의도된 설계)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 함수
  - 상세: 브라우저의 `File.type` 은 파일 확장자 기반 추정값이며 조작 가능하다. 코드 주석에도 명시되어 있듯, 이 함수는 "서버 왕복 전 1차 가드" 역할이고, 실제 강제 집행은 서버측 `validateFileField` 가 담당한다. 따라서 클라이언트 우회가 가능해도 서버 차단이 존재하므로 실질적 위험은 없다.
  - 제안: 현 설계 (클라이언트 UX 가드 + 서버 강제 집행 이중 레이어) 는 적절하다. 추가 조치 불필요.

- **[INFO]** 서버측 MIME 검증도 metadata의 `type` 필드 값에 의존
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField`, 라인 `if (typeof m.type === 'string' && !allowed.includes(m.type))`
  - 상세: binary 파일 본문이 전달되지 않으므로 실제 magic-byte 검사는 수행되지 않는다. 코드와 spec(§1.5)이 이를 명시적으로 인정하고 있으며, "metadata-only payload" 라고 선언되어 있다. 파일 실행이나 직접 처리가 이 레이어에서 발생하지 않는다면 허용 가능한 설계 결정이다.
  - 제안: 만약 서버가 추후 파일 바이너리를 직접 수신·처리하는 경로가 추가되면 magic-byte 기반 MIME 검증(예: `file-type` 라이브러리)이 필요하다. 현 시점에서는 해당 없음.

- **[INFO]** Slack 어댑터 등 다른 shape의 file payload — MIME/size 체크 자연 bypass
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField` 방어적 분기
  - 상세: `size`·`type` 필드가 없는 payload(Slack `{fileId, mimeType, ...}`)는 해당 체크를 skip한다. 이는 코드와 spec(§1.5 divergence 주석)에 명시적으로 의도된 설계다. 다만 이 어댑터가 실제 파일을 처리한다면, 해당 어댑터 레벨에서 별도 검증이 필요하다.
  - 제안: Slack 어댑터 파일 처리 경로가 있다면 해당 레이어에서 MIME/size 검증 추가 여부를 spec 레벨에서 명확히 결정할 것을 권고.

- **[INFO]** `new RegExp(def.pattern)` ReDoS 부분적 방어
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateScalarField`, pattern 검증 블록
  - 상세: `MAX_PATTERN_LENGTH = 512` 로 패턴 길이를 제한하고, try/catch 로 잘못된 regex를 방어한다. 그러나 512자 이내의 패턴도 catastrophic backtracking을 유발할 수 있다 (예: `(a+)+$`). 코드 주석은 이를 인식하고 "pattern 은 노드 관리자 config(신뢰 경계) 전용"이라고 명시하고 있어, 공격자가 폼 제출자가 아닌 관리자만 패턴을 설정할 수 있다.
  - 제안: 현 신뢰 모델(관리자 config 전용)에서는 위험도가 낮다. 미래에 일반 사용자가 패턴을 설정할 수 있게 된다면 linear-time regex 라이브러리(`re2`, `safe-regex`) 도입을 검토할 것.

- **[INFO]** 에러 메시지에 사용자 입력값 미포함 — 양호
  - 위치: 모든 validation 에러 메시지 (`validateScalarField`, `validateFileField`)
  - 상세: 에러 메시지는 `def.minLength`, `def.max`, `def.maxFiles` 등 config 값만 포함하며, 사용자가 제출한 실제 값이나 파일명은 포함하지 않는다. 민감 정보 누출 위험 없음.
  - 제안: 현재 패턴 유지.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff
  - 상세: API 키, 비밀번호, 토큰, 인증서 등 시크릿 성격의 하드코딩된 값이 없다. 상수는 모두 파일 크기 제한(10MB, 50MB), 파일 수(5), 허용 MIME 목록 등 설정값이다.
  - 제안: 해당 없음.

- **[INFO]** `image/svg+xml` 허용 — XSS 잠재 위험 (조건부)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `DEFAULT_FILE_ALLOWED_MIME_TYPES`
  - 상세: SVG는 JavaScript를 포함할 수 있어, 서버가 SVG 파일을 `<img>` 태그가 아닌 인라인으로 렌더링하거나 직접 서브도메인에서 제공하면 XSS 벡터가 된다. 현재 코드는 binary 전송 없이 metadata만 처리하므로 즉각적 위험은 없다.
  - 제안: SVG 파일을 실제로 저장·서빙하는 경로가 추가될 때 인라인 렌더링 금지, CSP 헤더, 별도 origin 서빙 정책을 반드시 적용할 것.

- **[INFO]** 입력 검증 — `extractFormFields`의 allowedMimeTypes 필터링 양호
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`, 라인 `f.allowedMimeTypes.filter((m): m is string => typeof m === 'string')`
  - 상세: config에서 전달되는 MIME 목록에서 문자열이 아닌 값을 사전에 필터링한다. injection 위험 없음.
  - 제안: 양호. MIME 형식의 추가 정규식 검증(`^[a-z]+/[a-z0-9.+\-]+$`)을 고려할 수 있으나 신뢰 경계(관리자 config) 상 필수 수준은 아님.

## 요약

이번 변경은 file 필드에 대한 MIME 타입·크기·개수 검증을 클라이언트(1차 UX 가드)와 서버(강제 집행)에 이중으로 구현한 것으로, 보안 설계 방향 자체는 올바르다. 하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증 우회, 민감 정보 에러 노출 등 Critical/Warning급 취약점은 발견되지 않았다. `image/svg+xml` 의 기본 허용은 향후 파일 서빙 경로 구현 시 XSS 위험이 될 수 있으나 현 metadata-only 처리 범위에서는 위험이 없으며, ReDoS는 신뢰 경계(관리자 config 전용 pattern)에 의해 실질 위험이 낮다. 전반적으로 방어적 코딩 패턴(타입 가드, 배열 필터링, 무효값 기본값 fallback, 에러 try/catch)이 잘 적용되어 있다.

## 위험도

LOW
