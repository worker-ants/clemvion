### 발견사항

---

**[WARNING] 정규식 기반 파서의 ReDoS 잠재 가능성**
- 위치: `validate-scope.ts` — `EXPR_BLOCK_RE = /\{\{([\s\S]+?)\}\}/g`
- 상세: `[\s\S]+?`는 lazy quantifier이므로 대부분의 경우 안전하지만, 닫히지 않는 `{{` 블록이 매우 긴 입력에서 반복되면 백트래킹이 증가할 수 있습니다. 이 코드는 사용자가 입력한 표현식을 실시간으로 파싱하므로, 악의적으로 구성된 입력(예: `{{ ... {{ ... {{ ...` 수천 반복)에 의해 브라우저 UI 스레드 블로킹이 발생할 수 있습니다.
- 제안: 입력 길이 상한(예: 10,000자)을 두거나, `value.indexOf("{{") === -1` 조기 탈출 패턴을 `}}` 미존재 케이스에도 확장하세요.

---

**[WARNING] XSS — 에러 메시지에 사용자 입력이 직접 삽입됨**
- 위치: `validate-scope.ts:messageFor()`, `expression-input.tsx` — `{err.message}` 렌더링
- 상세: `messageFor("unknown-node", token)`은 `token`을 문자열 리터럴로 포함한 메시지를 반환하고, `expression-input.tsx`에서 `{err.message}`로 JSX에 렌더링합니다. React는 기본적으로 텍스트를 이스케이프하므로 직접적인 DOM XSS는 아니지만, `err.message`가 향후 `dangerouslySetInnerHTML`로 변경될 경우 즉시 취약점이 됩니다. 또한 `token`은 워크플로 노드 레이블에서 추출되며, 백엔드 데이터 기원임을 고려해야 합니다.
- 제안: `token`을 메시지 문자열에 직접 삽입하는 대신 `{ template, token }` 구조로 분리하여 UI 레이어에서 렌더링하도록 설계를 고려하세요. 현재 React JSX 텍스트 이스케이프에 의존하는 구조는 유지하되, `dangerouslySetInnerHTML` 사용을 금지하는 린트 규칙 적용을 권장합니다.

---

**[WARNING] 프로토타입 오염 방어가 테스트에만 존재하고 실제 코드에도 필요함**
- 위치: `node-output-schema-enrichers.ts:isSafeFieldName()`, `validate-scope.ts:NODE_REF_RE`
- 상세: `node-output-schema-enrichers.ts`는 `__proto__`, `constructor`, `prototype`을 명시적으로 차단합니다(잘 처리됨). 그러나 `validate-scope.ts`의 `NODE_REF_RE`로 추출된 `key`는 `context.allNodeKeys.has(key)` 및 `context.availableKeys.has(key)` 조회에만 사용되므로 직접적인 오염 위험은 없습니다. 다만, 추후 `key`를 객체 프로퍼티 키로 사용하는 코드가 추가될 경우 위험합니다.
- 제안: `unescapeDoubleQuotedKey` 결과에도 `isSafeFieldName` 수준의 검증을 추가하거나, 최소한 `__proto__` 등 위험 키에 대한 early-return을 두는 것을 권장합니다.

---

**[INFO] 정규식 모듈 스코프 상태(lastIndex) 리셋의 불완전한 처리**
- 위치: `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
- 상세: `/g` 플래그가 붙은 정규식을 모듈 수준 상수로 선언하고 `.test()`를 호출하면 `lastIndex`가 변경됩니다. 현재 코드는 `.test()` 이후 `lastIndex = 0`으로 리셋하지만, `hasItem`이 `true`인 경우 분기 내에서만 리셋이 수행됩니다. `hasItem === true`인 경우 `ITEM_ROOT_RE.test()`, `ITEM_INDEX_ROOT_RE.test()` 후 각각 리셋하는데, 이 경우 `LOOP_ROOT_RE.lastIndex` 리셋은 `hasLoop` 조건 외부에서 항상 수행됩니다. 멀티 블록 처리 루프에서 상태 불일치가 발생할 수 있습니다.
- 제안: 모듈 스코프 `/g` 정규식 대신 함수 내에서 `new RegExp(...)` 또는 `/pattern/g`를 로컬 변수로 선언하세요. 또는 `.test()` 대신 `.exec()` 결과를 확인하는 방식으로 전환하세요.

---

**[INFO] 하드코딩된 시크릿 없음 확인됨**
- 전체 파일에서 API 키, 비밀번호, 토큰 등 하드코딩된 시크릿은 발견되지 않았습니다.

---

**[INFO] 사이클 안전성 및 깊이 제한 적절히 구현됨**
- 위치: `reachable-nodes.ts`, `resolve-nested-path.ts`
- 상세: `getContainerChain`의 `visited` Set, `getAncestorsInScope`의 BFS visited 처리, `resolve-nested-path.ts`의 `MAX_DEPTH = 10` 가드가 모두 적절히 구현되어 있습니다. 악의적으로 구성된 순환 그래프나 깊은 중첩에 대한 방어가 충분합니다.

---

### 요약

이번 변경사항은 프론트엔드 표현식 자동완성 및 스코프 검증 기능 추가로, 전반적으로 보안 의식이 높은 코드입니다. 프로토타입 오염 방어(`isSafeFieldName`), 순환 그래프 방지(visited Set), 깊이 제한(MAX_DEPTH) 등 방어적 구현이 눈에 띕니다. 주요 위험 요소는 두 가지입니다: 모듈 스코프 `/g` 정규식의 `lastIndex` 상태 관리 불완전성(잠재적 검증 오류 유발)과, 사용자 입력 유래 `token` 값이 에러 메시지 문자열에 직접 포함되는 패턴(현재는 React 이스케이프로 안전하나 구조적 위험). 백엔드와의 경계가 없는 순수 프론트엔드 유틸리티 코드이므로 서버 측 취약점은 해당 없습니다.

### 위험도

**LOW**