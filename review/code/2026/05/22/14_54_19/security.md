# 보안(Security) 리뷰 결과

**리뷰 대상**: Cafe24 조건부 필수(`constraints`) backend 구현 (파일 1–20)
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [INFO] 에러 메시지에 내부 필드명 노출
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts` — `checkOne()` 함수, 전 구간
- **상세**: 위반 메시지에 Cafe24 API 필드명(`member_id`, `group_no`, `since` 등)이 그대로 포함된다. 예:
  ```
  "constraint violated: oneOf [member_id, group_no, since] requires at least one of these fields to be provided"
  "constraint violated: allOrNone [since, until] — provided [since] but missing [until] (all or none required)"
  "constraint violated: implies — when "a" is provided, [b, c] are required (missing: [b])"
  ```
  이 메시지는 `CAFE24_MISSING_FIELDS` 에러 envelope 의 `error.message` 필드로 LLM·클라이언트에 전달된다. 필드명 자체는 Cafe24 공개 API 명세에 있는 값이므로 외부 공격자에게 의미 있는 새 정보는 아니다. 다만 `implies` 케이스에서 `c.if` 필드명이 따옴표 미이스케이프 상태로 포함(`when "${c.if}" is provided`)되는데, 메시지가 JSON 직렬화되는 경로에서는 `JSON.stringify`가 처리하므로 즉각적 JSON 파싱 이슈는 없다.
- **제안**: 현 설계상 LLM 가독성이 목적이므로 필드명 포함이 의도된 것으로 판단된다. 위험도는 낮으나, 향후 `implies.if` 값이 사용자 제공 데이터를 직접 반영할 가능성이 있다면 메시지 포맷에 이스케이프 처리를 명시적으로 추가하는 것이 권장된다.

---

### [INFO] `isAbsent` 함수의 의도적 falsy 범위 제한 — 숫자 0·false·빈 배열 처리
- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts:13–15`
  ```ts
  function isAbsent(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }
  ```
- **상세**: 숫자 `0`, boolean `false`, 빈 배열 `[]`은 "present"로 간주한다. 이는 의도된 설계(테스트 코드에서도 `{ b: 1, c: true }` 를 present 로 처리)이며 Cafe24 API의 필드 유형상 문제가 없다. 그러나 Cafe24 API에서 `shop_no`가 `0`으로 전달될 경우 유효한 값인지 별도 검증이 없다. 현재 구현에서 constraint validator는 존재 여부만 검사하고 값의 유효성은 검사하지 않는다. 이는 기능 범위 밖이므로 INFO 수준으로 분류하나, 향후 숫자형 필드를 포함한 constraint 확장 시 `0`/`false`의 의미론을 명시적으로 정의할 필요가 있다.
- **제안**: 현 설계를 TSDoc 주석으로 명시("숫자 0, false, 빈 배열은 present로 처리한다")하면 이후 유지보수 시 오해를 방지할 수 있다.

---

### [INFO] MCP 경로에서 `constraintViolation` 메시지가 `error.error` 필드에 중복 노출
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — diff 내 `constraintViolation` 처리 블록
  ```ts
  return {
    toolCallId: call.id,
    content: JSON.stringify({
      error: {
        code: 'CAFE24_MISSING_FIELDS',
        message: constraintViolation,
      },
    }),
    status: 'error',
    error: constraintViolation,   // ← top-level error 필드에 동일 메시지 반복
  };
  ```
- **상세**: `error` 필드(top-level)와 `content` JSON 내부의 `error.message` 에 동일한 constraint 위반 메시지가 두 번 포함된다. 보안 관점에서 내부 상세 정보가 두 채널로 동시에 유출되는 구조로, 로그 집계 시 중복이 발생할 수 있다. 에러 메시지에 민감 정보(시크릿, 경로, 스택 트레이스)는 없으므로 직접적 취약점은 아니다. 그러나 top-level `error` 필드가 외부 클라이언트에 노출되는지 여부에 따라 의도치 않은 정보 과다 노출이 될 수 있다.
- **제안**: top-level `error` 필드의 노출 범위를 확인하고, 내부 로깅 전용이라면 현 구조를 유지하되 주석으로 명시하는 것이 좋다. 외부 클라이언트에도 전달된다면 `content` JSON 한 곳으로 통일을 권장한다.

---

### [INFO] `buildToolDescription` 함수에서 `integrationName` 미검증 삽입
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — `buildToolDescription()` 함수
  ```ts
  `(Cafe24 ${op.method} ${op.path} — via Internal Bridge: ${integrationName})`
  ```
- **상세**: `integrationName`은 `integration.name` 에서 온다. 이 값이 데이터베이스에 저장된 사용자 정의 이름이라면, 악의적 사용자가 통합 이름에 특수 문자나 마크다운/프롬프트 인젝션 페이로드를 삽입했을 때 LLM tool description에 포함될 수 있다. 이 description은 LLM에게 tool 정보를 제공하는 컨텍스트로 사용되므로 프롬프트 인젝션(Prompt Injection) 벡터가 될 수 있다.
  - 기존 코드(`-` 줄)에도 동일 패턴이 존재했으므로 이번 변경에서 새로 도입된 취약점은 아니다.
- **제안**: `integrationName` 을 LLM 컨텍스트에 삽입하기 전에 특수 문자 필터링 또는 길이 제한을 적용하는 것을 검토한다. 특히 LLM tool description은 신뢰 경계 내에서 제어돼야 한다.

---

### [INFO] `constraintToSuffixLine`의 `implies` 분기에서 필드명 미이스케이프
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — `constraintToSuffixLine()` 함수
  ```ts
  return `Constraint: when ${c.if} is provided, ${c.then.join(', ')} are also required.`;
  ```
- **상세**: `c.if`와 `c.then` 은 `Cafe24FieldConstraint` 타입의 정적 메타데이터에서 오며 외부 사용자 입력이 아니다. 현재 `customer.ts` 처럼 코드에 하드코딩된 값만 사용하므로 즉각적 위험은 없다. 다만 향후 `constraints` 필드가 외부 소스(데이터베이스, API 응답 등)에서 동적으로 로드되는 방향으로 확장된다면 인젝션 경로가 생길 수 있다.
- **제안**: 현 설계에서는 문제없으나, 정적 컴파일타임 메타데이터라는 전제를 명시적으로 문서화하는 것이 권장된다.

---

### [INFO] `_retry_state.json`에 절대 경로 하드코딩
- **위치**: `review/consistency/2026/05/22/14_22_18/_retry_state.json`
  ```json
  "/Volumes/project/private/clemvion/.claude/worktrees/..."
  ```
- **상세**: 리뷰 세션 상태 파일에 로컬 개발 환경의 절대 경로가 포함되어 있다. 이 경로는 개발자의 로컬 파일 시스템 구조와 프로젝트 위치를 노출한다. 코드베이스에 커밋되면 외부 공격자가 리포지토리를 통해 개발 환경 경로 정보를 획득할 수 있다. 단, `review/` 디렉토리가 내부 전용으로 공개 리포지토리에 포함되지 않는다면 즉각적 위험은 낮다.
- **제안**: 상태 파일에 절대 경로 대신 상대 경로나 플레이스홀더를 사용하거나, `_retry_state.json`을 `.gitignore`에 추가하는 것을 검토한다.

---

## 요약

이번 변경은 Cafe24 API의 조건부 필수 필드 검증 로직(`Cafe24FieldConstraint`, `validateCafe24Constraints`, `buildToolDescription`, `constraintToSuffixLine`)을 신규 도입한 것이다. 하드코딩된 시크릿, SQL/커맨드/LDAP 인젝션, 인증·인가 우회, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10의 주요 취약점은 발견되지 않는다. 검증 대상인 `fields` 객체는 정적 메타데이터와 런타임 args를 분리하여 처리하며, 에러 응답은 고정된 에러 코드(`CAFE24_MISSING_FIELDS`)를 재사용하고 스택 트레이스나 내부 경로가 노출되지 않는다. 다만 네 가지 INFO 수준의 주의사항이 존재한다: (1) `integrationName`이 LLM description에 비검증 삽입되어 프롬프트 인젝션 벡터가 될 수 있으나 이는 기존 패턴과 동일, (2) constraint 위반 메시지가 MCP 응답의 두 필드에 중복 노출, (3) `isAbsent`의 falsy 처리 범위가 명시적으로 문서화되지 않음, (4) 상태 파일에 로컬 절대 경로 포함. 전체적으로 보안 관점에서 안전한 구현이며 즉각적인 대응이 필요한 Critical/High 수준의 위험은 없다.

---

## 위험도

LOW

---

STATUS: success
