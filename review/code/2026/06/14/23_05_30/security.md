### 발견사항

- **[INFO] ReDoS — pattern 컴파일 방어 조치 충분 (기존 W3 fix 확인)**
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 내 `new RegExp(def.pattern)` 블록
  - 상세: `MAX_PATTERN_LENGTH = 512` cap 과 `try/catch` 방어가 모두 적용됨. 주석·JSDoc 에 "노드 관리자 config(신뢰 경계) 전용, 폼 제출자 입력 아님"이 명시되어 있음. 이전 리뷰(22_49_26 W3)에서 지적한 미문서화 문제가 fix 적용된 상태. 단, JavaScript `new RegExp` 는 backtracking 기반 엔진으로 512자 이하의 정교하게 설계된 ReDoS 패턴(`(a+)+`, `([a-zA-Z]+)*` 등)은 여전히 catastrophic backtracking 을 일으킬 수 있음. 현재 신뢰 경계(노드 관리자 한정)를 전제로 허용 가능한 수준이나, 외부 입력 경로가 추가될 경우 재검토 필요.
  - 제안: 현재 신뢰 경계가 유지되는 한 현상 유지 허용. 향후 pattern 을 외부 사용자 입력에서도 설정 가능하게 되면 `re2`(node-re2) 또는 선형 시간 엔진 도입 검토.

- **[INFO] 입력 검증 — `label`/`description` 필드 새니타이징 없음**
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` 내 `label`, `description` 할당부
  - 상세: `label`·`description` 은 본 PR 신규 추가가 아닌 기존 필드이므로 이번 변경의 책임 범위 밖. 단, 이번 PR 에서 `pattern` 문자열도 `FormModalField` 에 그대로 저장되며, 이 값이 UI 에 에러 메시지와 함께 표시된다면 XSS 표면이 될 수 있음. 현재 `validateFormSubmission` 는 오류 메시지에 `def.pattern` 을 포함하지 않고 고정 메시지(`형식이 올바르지 않습니다.`)를 반환하므로 직접 노출은 없음.
  - 제안: 렌더 경로에서 `label`/`description`/`pattern` 을 HTML 컨텍스트에 삽입할 경우 반드시 이스케이프 처리 확인. 본 PR 코드 자체는 문제 없음.

- **[INFO] 인증/인가 — `extractFormFields` 는 인증 없이 formConfig 를 신뢰**
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`
  - 상세: `extractFormFields` 가 받는 `formConfig` 가 어떤 경로로 주입되는지 이 파일 단독으로는 확인 불가. 단, `FIELD_NAME_RE` (`/^[a-zA-Z0-9_-]{1,64}$/`) 로 field name 을 allowlist 검증하고, min/max 는 `Number.isFinite` 로 타입 안전하게 처리하며, pattern 은 `typeof` + 길이 + try/catch 로 다층 방어한다. 입력 자체가 노드 관리자의 워크플로 config 라면 신뢰 경계 내 처리로 적절함.
  - 제안: 이 함수가 외부 HTTP 요청 body 를 직접 받는 경로가 생기면 별도 schema validation(Zod 등) 계층 추가 권장.

- **[INFO] 에러 처리 — 범위 오류 메시지에 실제 경계값 포함**
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 내 min/max 오류 반환
  - 상세: `최솟값은 ${def.min} 이상이어야 합니다.` 형태로 노드 config 의 경계값이 사용자에게 노출됨. 이는 비즈니스 로직상 정보 공개 수준의 문제(사용자가 허용 범위를 알 수 있음)로, 의도적 UX 디자인으로 볼 수 있음. 민감 데이터 노출에는 해당하지 않음.
  - 제안: 경계값 노출이 정책상 불필요하다면 고정 메시지(`범위를 벗어난 값입니다.`)로 교체 가능. 현재는 기능 상 허용 가능한 수준.

### 요약

이번 변경(form `validation.min`/`max` 숫자 범위 및 `pattern` 정규식 서버측 검증 추가)은 보안 관점에서 전반적으로 양호하다. 이전 리뷰(22_49_26)에서 지적된 ReDoS 위험(W3)은 `MAX_PATTERN_LENGTH=512` cap, `try/catch` 방어, 신뢰 경계 JSDoc 명시로 충분히 완화되었고, `min > max` 논리 역전 방어(I4)도 적용되어 있다. `FIELD_NAME_RE` allowlist 로 경로 탐색 및 SQL 특수문자를 차단하고, min/max 는 `Number.isFinite` 로 타입-안전하게 처리하며, 하드코딩된 시크릿이나 인증 우회 경로는 발견되지 않는다. 잔여 위험은 INFO 수준으로, `label`/`description` 의 XSS 새니타이징은 렌더 경로 책임이고 현재 코드에서 직접 노출은 없다. 신뢰 경계(노드 관리자 config 전용) 가정이 유지되는 한 추가 조치는 불필요하다.

### 위험도

LOW
