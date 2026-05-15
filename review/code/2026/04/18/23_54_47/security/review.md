## 보안 코드 리뷰

### 발견사항

---

**[WARNING] `unescapeDoubleQuotedKey` — 과도한 이스케이프 해제로 검증 우회 가능**
- 위치: `validate-scope.ts:52`
- 상세: `raw.replace(/\\(.)/g, "$1")`는 모든 백슬래시 시퀀스를 제거합니다. 공격자가 `$node["..\\\/sensitive"]` 형태로 입력하면 언이스케이프 결과가 실제 키와 다를 수 있어 `allNodeKeys` 검사를 우회해 `unknown-node` 에러가 누락될 수 있습니다 (false-negative). 내부 데이터라 즉각적 위협은 낮지만 검증 무결성 파괴입니다.
- 제안: `\"` 시퀀스만 처리하도록 제한

```ts
function unescapeDoubleQuotedKey(raw: string): string {
  return raw.replace(/\\"/g, '"');
}
```

---

**[WARNING] 모듈 수준 `/g` 정규식 `lastIndex` 공유 — React Concurrent Mode 검증 오염**
- 위치: `validate-scope.ts:46–49`, `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`
- 상세: 보안 관점에서 이 패턴의 핵심 위험은 **검증 누락(false-negative)**입니다. Concurrent Mode에서 두 컴포넌트가 같은 모듈 인스턴스의 정규식을 동시에 사용하면 `lastIndex`가 오염되어 `$loop`/`$item`/`$itemIndex` 스코프 검사가 조용히 통과될 수 있습니다. 표현식 에디터가 보안 경계(접근 불가 노드 참조 차단)를 담당하므로 검증 누락은 직접적 보안 위험입니다.
- 제안: `/g` 플래그 제거 (`.test()` 전용이므로 불필요) — `lastIndex` 관리 코드 전체 제거 가능

---

**[WARNING] 에러 메시지에 사용자 입력 토큰 직접 삽입 — 잠재적 XSS**
- 위치: `validate-scope.ts:55–68`, `messageFor` 함수
- 상세: `token` 값이 정규식 매치 결과(사용자 입력 유래)이며 `"Node \"${token}\" does not exist"` 형태로 메시지에 그대로 삽입됩니다. React의 기본 텍스트 렌더링은 안전하지만, 이 `message` 필드를 `dangerouslySetInnerHTML`로 렌더링하는 컴포넌트가 있다면 XSS가 됩니다. 현재 렌더러 구현을 코드만으로 확인할 수 없습니다.
- 제안: `message` 필드를 렌더링하는 컴포넌트에서 `dangerouslySetInnerHTML` 미사용 확인. 추가로 `token` 길이 상한 적용 권장.

---

**[INFO] 입력 크기 제한 없음 — 클라이언트 DoS 가능성**
- 위치: `validate-scope.ts:72`, `reachable-nodes.ts:65`
- 상세: `validateExpressionScope`는 임의 길이 문자열을 처리하고, `getAncestorsInScope`는 임의 크기 그래프를 순회합니다. 악의적으로 조작된 워크플로우 파일을 임포트하는 경우 브라우저 메인 스레드 블로킹이 가능합니다.
- 제안: 워크플로우 최대 노드 수 및 표현식 최대 길이를 스펙에 정의하고 입력 상한 체크 추가 고려.

---

**[INFO] `NODE_REF_RE` 패턴의 ReDoS 안전성 확인**
- 위치: `validate-scope.ts:44`, `(?:[^"\\]|\\.)*`
- 상세: 이 패턴은 두 대안이 상호 배타적(비-백슬래시 vs 백슬래시 시작)이므로 catastrophic backtracking은 발생하지 않습니다. 현재는 안전합니다.
- 제안: 현 상태 유지.

---

### 요약

이 코드는 순수 클라이언트 사이드 유틸리티로 외부 I/O·인증·DB가 없어 공격 표면이 좁습니다. 가장 실질적인 보안 위험은 두 가지입니다: (1) `unescapeDoubleQuotedKey`의 과도한 이스케이프 해제로 노드 키 검증이 우회될 수 있고, (2) 모듈 수준 `/g` 정규식의 `lastIndex` 오염이 Concurrent Mode에서 스코프 검증을 조용히 통과시킬 수 있습니다. 두 이슈 모두 보안 경계인 표현식 검증의 무결성에 직접 영향을 주므로 수정이 필요합니다. 에러 메시지의 XSS 위험은 렌더러 구현에 의존하므로 렌더러 측 확인이 필요합니다.

### 위험도

**LOW** — 내부 편집기 도구이고 신뢰 경계가 명확하나, `unescapeDoubleQuotedKey`와 `/g` 정규식 이슈는 검증 우회 가능성이 있어 즉시 수정 권장.