## 보안 코드 리뷰

### 발견사항

---

**[WARNING] expression-resolver.service.ts: 혼합 표현식의 타입 손실 버그**
- 위치: `expression-resolver.service.ts` `resolveString()` 메서드 (하단부)
- 상세: 주석에는 "Mixed text + expression: always string"이라고 명시되어 있으나, `evaluate(value, ctx)`는 전체 문자열을 평가한 단일 결과를 반환합니다. 혼합 텍스트(`"Hello {{ $input.name }}"`)에서 `FULL_EXPRESSION_PATTERN` 분기와 관계없이 동일한 `result`를 반환하고 있어, 실제로는 혼합 표현식에서도 non-string 타입이 반환될 수 있습니다. `evaluate()`가 혼합 텍스트를 문자열 interpolation으로 처리하지 않으면 의도치 않은 타입이 config에 주입될 수 있습니다.
- 제안: `@workflow/expression-engine`의 `evaluate()`가 혼합 텍스트를 실제로 string interpolation으로 처리하는지 확인하고, 처리하지 않는다면 직접 정규식으로 치환하도록 수정 필요.

---

**[WARNING] expression-resolver.service.ts: MAX_DEPTH 초과 시 원본 객체 반환**
- 위치: `resolveObject()` 메서드, `if (depth > MAX_DEPTH) return obj;`
- 상세: 깊이 제한 초과 시 미해석 상태의 원본 config 서브트리가 그대로 핸들러에 전달됩니다. `{{ }}` 표현식이 포함된 채로 핸들러가 실행되면, 핸들러 구현에 따라 해석되지 않은 표현식 문자열이 SQL 쿼리나 HTTP URL에 그대로 삽입될 수 있습니다.
- 제안: 깊이 초과 시 에러를 던지거나, 해당 서브트리의 문자열 값에 `{{ }}`가 포함된 경우 에러를 발생시키도록 수정.

---

**[WARNING] expression-resolver.service.ts: 에러 메시지에 템플릿 값 노출**
- 위치: `resolveString()` 메서드, `throw new Error(\`Expression error in config.${path}: ${message} (template: "${value}")\`)`
- 상세: 에러 메시지에 `value` (실제 config 값)를 포함하여 로그에 기록될 경우, `value`에 포함된 민감 정보(비밀번호, 토큰 등이 config에 있을 경우)가 로그/에러 추적 시스템에 노출될 수 있습니다.
- 제안: `template` 부분을 제거하거나, 길이 제한 및 값 마스킹 후 포함.

---

**[WARNING] buildExpressionContext: execution.mode 하드코딩**
- 위치: `expression-resolver.service.ts`, `$execution` 객체의 `mode: 'manual'`
- 상세: 실제 실행 모드(스케줄/웹훅/수동)와 관계없이 항상 `'manual'`로 고정되어 있습니다. `$execution.mode`를 기반으로 분기 로직이 있는 워크플로우에서 보안 정책 우회가 발생할 수 있습니다 (예: mode가 'scheduled'일 때만 허용되는 동작을 에디터에서 강제 실행).
- 제안: `ExecutionContext`에 `mode` 필드를 추가하여 실제 값을 전달.

---

**[WARNING] use-expression-context.ts: 실행 결과 데이터 전체 노출**
- 위치: `use-expression-context.ts`, `outputSample` 매핑 부분
- 상세: `availableNodes`의 `outputSample`에 노드 실행 결과 전체가 포함됩니다. 이 데이터는 자동완성 UI에 활용되지만, 이전 노드 출력에 인증 토큰, API 응답의 민감 데이터 등이 포함될 경우 클라이언트 메모리/store에 평문으로 유지됩니다. 현재 자동완성에서 `outputSample`을 직접 사용하지 않으므로 불필요한 노출입니다.
- 제안: `outputSample`을 `availableNodes`에서 제거하거나, 필드 키 목록만 유지.

---

**[INFO] expression-exclusions.ts: 제외 규칙이 전역 정적 객체로 관리**
- 위치: `expression-exclusions.ts`
- 상세: `EXPRESSION_EXCLUSIONS`가 불변 정적 객체로 관리되는 것은 올바른 패턴입니다. 단, 향후 동적으로 핸들러를 등록하는 플러그인 시스템 도입 시 이 목록을 업데이트하는 경로가 없어 커스텀 핸들러의 민감 필드가 표현식 해석 대상이 될 수 있습니다.
- 제안: 플러그인 핸들러 등록 시 제외 키도 함께 등록할 수 있는 인터페이스 설계 고려.

---

**[INFO] auth.controller.ts: refresh token 쿠키 설정 확인**
- 위치: `setRefreshTokenCookie()` 메서드
- 상세: `httpOnly: true`, `secure: true`, `sameSite: 'none'`, `path: '/'` 설정은 적절합니다. `sameSite: 'none'`은 크로스사이트 요청을 허용하므로 `secure: true`와 함께 사용되어야 하는데, 현재 코드는 이를 준수하고 있습니다.
- 제안: 현재 설정 유지. 단, 개발환경에서 `secure: true`로 인해 HTTP로는 쿠키가 전송되지 않으므로 환경별 분기(`process.env.NODE_ENV`) 고려 가능.

---

**[INFO] package.json: 로컬 file: 의존성 사용**
- 위치: `backend/package.json`, `frontend/package.json`
- 상세: `file:../packages/expression-engine`은 내부 패키지 참조로 공급망 공격(supply chain attack) 위험은 없습니다. 단, CI/CD 환경에서 패키지 경로 접근 권한 및 빌드 순서에 주의 필요합니다.
- 제안: 현재 구현 수준에서 보안 문제 없음.

---

### 요약

이번 변경의 핵심은 표현식 엔진(`@workflow/expression-engine`) 통합으로, 보안 설계 방향(eval 미사용, 1회 패스 제한, 재귀 해석 방지, 핸들러별 제외 키 관리)은 적절합니다. 주요 위험은 `resolveString()`의 혼합 표현식 처리 일관성 부재, 깊이 초과 시 미해석 템플릿 문자열이 핸들러에 그대로 전달되는 문제, 그리고 에러 메시지의 잠재적 민감 정보 노출입니다. 인증 관련 변경(auth.controller.ts)은 쿠키 보안 설정이 올바르게 유지되고 있으며, 프론트엔드의 표현식 자동완성 컴포넌트는 클라이언트 측에서만 동작하므로 서버 측 보안에 직접적인 영향은 없습니다.

### 위험도

**MEDIUM**