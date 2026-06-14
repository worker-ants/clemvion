# 보안(Security) 리뷰

## 발견사항

### 인젝션 취약점

- **[WARNING]** `pattern` 필드를 통한 ReDoS(정규식 서비스 거부) 위험
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 내 `new RegExp(def.pattern)` (diff 기준 추가 블록)
  - 상세: `def.pattern` 은 서버가 신뢰하는 formConfig 에서 추출된다. formConfig 가 외부 사용자 입력(API 페이로드)으로 제어 가능한 경우, 공격자가 `(a+)+$` 와 같은 파국적 역추적(catastrophic backtracking) 정규식을 주입하면 `re.test(value)` 호출이 이벤트 루프를 블로킹할 수 있다. 현재 코드는 잘못된 정규식(throw) 만 방어하고, 유효하지만 악의적인 정규식은 통과시킨다.
  - 제안: (1) formConfig 의 `pattern` 필드가 신뢰된 소스(노드 config DB, spec-validated schema)에서만 오는지 확인하고 문서화한다. (2) 신뢰 경계가 불명확하다면 `safe-regex` 또는 `re2` 라이브러리를 도입하여 선형 시간 보장 정규식으로 제한하거나, 최대 패턴 길이(예: 200자) 제한을 추가한다.

- **[INFO]** `extractFormFields` 에서 `field.label` 및 `field.description` 은 원본 문자열을 그대로 저장
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`
  - 상세: `label`, `description` 값은 길이 확인 외 별도 새니타이징 없이 저장된다. 이 값이 이후 HTML 렌더링 경로(채널 메시지, modal 빌더)에서 이스케이프 없이 삽입된다면 XSS 위험이 있다. 현재 diff 범위(서버측 검증 로직) 내에서는 직접 렌더링이 없으나, 소비 경로 전체를 추적해야 한다.
  - 제안: `label`/`description` 이 채널 메시지 등 외부 출력에 삽입되는 경로에서 HTML 이스케이프 여부를 확인한다.

### 입력 검증

- **[INFO]** `min`/`max` 의 논리적 역전 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields` min/max 정규화 블록
  - 상세: `min > max` 인 경우(예: `validation: { min: 100, max: 10 }`)를 거부하지 않는다. `validateFormSubmission` 에서 min 검사와 max 검사를 각각 독립적으로 수행하므로, 이 경우 모든 값이 min 또는 max 중 하나에 걸려 항상 오류를 반환한다. 기능적 오동작이며 서비스 장애를 유발할 수 있다.
  - 제안: `extractFormFields` 에서 `Number.isFinite(min) && Number.isFinite(max) && min > max` 조건 시 두 값 모두 미반영(undefined)하거나 경고 로그를 남긴다.

- **[INFO]** `FIELD_NAME_RE` 정규식의 최대 반복 한도
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `const FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/`
  - 상세: 1–64 자 제한이 있어 경로 탐색 및 SQL 인젝션 특수 문자를 허용하지 않는다. 현재 구현은 적절하다. 다만 이 정규식 자체는 선형이므로 ReDoS 위험 없음.
  - 제안: 현재 구현 유지. 별도 조치 불요.

### 에러 처리

- **[INFO]** 검증 오류 메시지에 min/max 값이 직접 노출됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-validation-minmax-pattern-81db34/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` min/max 오류 반환
  - 상세: `` `최솟값은 ${def.min} 이상이어야 합니다.` ``, `` `최댓값은 ${def.max} 이하여야 합니다.` `` 처럼 실제 숫자 경계가 오류 메시지에 포함되어 API 응답으로 클라이언트에 전달된다. 이 자체는 의도된 UX이며 min/max 는 노드 config 에서 오는 비밀이 아니므로 보안 위험은 낮다.
  - 제안: 오류 메시지에 포함되는 값이 비밀 정보(API 키 등)가 아님을 재확인. 현재 구현은 의도적이며 수용 가능.

### 하드코딩된 시크릿

- **[INFO]** 해당 없음. diff 범위 내 하드코딩된 시크릿, API 키, 토큰 없음.

### 인증/인가

- **[INFO]** `validateFormSubmission` 은 순수 함수(pure)로 자체 인증/인가 로직을 갖지 않음. 호출 계층(`assertFormSubmissionValid`)에서 인증된 컨텍스트 내에서만 호출되는지 확인이 필요하나, 이는 이번 diff 외부 범위다.

### 암호화

- **[INFO]** 해당 없음. 이번 변경에 암호화/해시 관련 코드 없음.

### 의존성 보안

- **[INFO]** 신규 외부 의존성 추가 없음. 표준 JavaScript `RegExp`, `Number` 내장 API만 사용.

---

## 요약

이번 변경은 form 검증에 `min`/`max`(숫자 범위)와 `pattern`(정규식) 서버측 검증을 추가하는 내용이다. 전반적으로 입력 정규화(`Number.isFinite`, 비어있는 문자열 거부, 잘못된 정규식 방어적 통과)가 잘 구현되어 있고, 필드명 화이트리스트(`FIELD_NAME_RE`)도 경로 탐색 및 인젝션 특수 문자를 차단하고 있다. 주요 보안 우려 사항은 `new RegExp(def.pattern)` 경로에서의 ReDoS 가능성이며, `pattern` 을 공급하는 formConfig 의 신뢰 경계가 명확히 문서화되지 않은 경우 위험이 현실화될 수 있다. `min > max` 논리 역전과 `label`/`description` 의 렌더링 경로 추적은 낮은 수준의 보완 권고 사항이다.

---

## 위험도

LOW
