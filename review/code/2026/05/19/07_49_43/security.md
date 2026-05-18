# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] system-context-prefix.ts — `process.env.TZ` 를 신뢰 입력 없이 timezone 결정에 사용
- **위치**: `system-context-prefix.ts` L54, `resolveSystemContextTimezone()`
- **상세**: `process.env.TZ` 가 `Workspace.settings.timezone` 의 대체 경로로 사용된다. 컨테이너·런타임 환경이 외부에서 `TZ` 를 주입할 수 있는 경우, 운영자가 의도하지 않은 timezone 이 전체 테넌트에 적용될 수 있다. 다만 `isValidIanaTimezone` 으로 IANA 유효성 검증을 거치므로 임의 문자열 주입은 차단된다. 보안 위험보다는 운영 혼선 수준.
- **제안**: 이미 유효성 검증이 있으므로 즉각 수정 필요는 없다. 문서/주석에 "`process.env.TZ` 는 서버 전체에 적용되므로 멀티테넌트 환경에서 workspace 별 timezone 은 `Workspace.settings.timezone` 을 항상 설정할 것"을 명시하면 충분.

---

### [INFO] `workspace` section — workspace id/name 을 LLM system prompt 에 노출
- **위치**: `system-context-prefix.ts` L105–L110, `renderSection('workspace', ...)` / `buildSystemContextPrefixFromContext()` L276–L281
- **상세**: `systemContextSections` 에 `'workspace'` 를 포함하면 내부 `workspaceId` 가 LLM system prompt 에 그대로 노출된다. 현재 default sections 는 `['time', 'timezone']` 이라 기본 경로에서는 발생하지 않는다. 그러나 사용자가 `systemContextSections` 에 `'workspace'` 를 추가하면 외부 LLM API 요청에 내부 식별자가 포함된다.
- **제안**: `'workspace'` 섹션 사용 시 `workspaceId` 대신 외부 공개가 의도된 workspace 이름만 전송하거나, UI hint 에 "내부 ID 가 LLM 공급자에게 전송됩니다" 경고를 추가하는 것을 고려.

---

### [INFO] execution-engine.service.ts — `workflow?.workspace?.settings?.['timezone']` 의 무검증 타입 접근
- **위치**: `execution-engine.service.ts` diff L173
  ```
  const workspaceTimezone = workflow?.workspace?.settings?.['timezone'];
  ```
- **상세**: `settings` 가 JSONB 컬럼인 경우 런타임에 임의 타입이 올 수 있다. 이후 `buildSystemContextPrefixFromContext` 내 `typeof workspaceTimezone === 'string'` 분기가 존재하지만, 엔진 레이어에서는 `typeof workspaceTimezone === 'string' ? workspaceTimezone : ''` 로 이미 방어하고 있다. 코드 흐름 상 문자열 검증이 두 번 중복되나 양쪽 모두 안전 처리를 하므로 취약점은 없다. 다만 `''` 를 context 에 주입하면 helper 내에서 `resolveSystemContextTimezone(undefined)` 와 다르게 동작할 수 있다.
- **제안**: 엔진에서 `''` 대신 `undefined` 를 전달하거나, helper 에서 빈 문자열도 `undefined` 와 동등하게 처리하도록 통일하면 혼선 감소.

---

### [INFO] `node` section — `nodeId` 노출
- **위치**: `system-context-prefix.ts` L282–L284
- **상세**: `'node'` 섹션 활성화 시 내부 node UUID 가 LLM system prompt 에 포함된다. `'workspace'` 와 동일한 수준의 내부 식별자 노출 우려.
- **제안**: default 가 `['time', 'timezone']` 으로 제한되어 있으므로 현재 위험도는 낮다. `'workspace'` 섹션과 함께 UI 경고 추가 시 동일하게 처리.

---

### [INFO] package-lock.json — `uglify-js` dev 플래그 제거
- **위치**: `codebase/backend/package-lock.json` diff L110
- **상세**: `uglify-js 3.19.3` 의 `"dev": true` 가 제거되어 production dependency 로 승격되었다. `uglify-js` 는 알려진 CVE(예: ReDoS, 프로토타입 오염) 이력이 있으나 3.x 최신 버전은 대부분 패치되어 있다. 이 변경 자체가 보안 취약점을 신규 도입하지는 않지만, 불필요하게 production 번들에 포함되면 공격 표면이 늘어날 수 있다.
- **제안**: `uglify-js` 가 실제 runtime 에 필요한지 확인하고, 불필요하다면 `devDependencies` 로 명시적 고정. `optional: true` 로 선언되어 있으므로 즉각 위험은 낮다.

---

## 요약

이번 변경은 AI 노드(AI Agent, Text Classifier, Information Extractor)의 시스템 프롬프트에 현재 시각·타임존 prefix 를 자동 prepend 하는 기능과 Cafe24 API metadata 에 KST timezone suffix 를 추가하는 기능이 핵심이다. 보안 관점에서 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화, 에러 메시지를 통한 민감 정보 노출 등 OWASP Top 10 범주의 중대 취약점은 발견되지 않았다. `resolveSystemContextTimezone` 함수는 `Intl.DateTimeFormat` 을 통한 IANA 유효성 검증으로 임의 문자열 주입 가능성을 차단하고 있으며, `normalizeSystemContextConfig` 도 `Array.includes` 화이트리스트 필터링으로 허용 섹션 외 값을 걸러낸다. 주요 유의점은 `'workspace'`/`'node'` 섹션 활성화 시 내부 식별자가 외부 LLM 공급자 API 요청에 포함될 수 있다는 점이나, 현재 default 가 `['time', 'timezone']` 으로 제한되어 있어 실질적 위험은 낮다. `uglify-js` 의 dev 플래그 제거는 모니터링이 권장되나 현재 `optional: true` 선언으로 즉각 위험은 없다.

## 위험도

LOW
