## 보안 코드 리뷰

### 발견사항

---

**[WARNING] 모듈 수준 RegExp 객체의 `lastIndex` 상태 공유 — `validate-scope.ts`**
- 위치: `validate-scope.ts:46–49` (`LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 선언부)
- 상세: `g` 플래그를 가진 RegExp를 모듈 수준 상수로 선언하면 `.test()` 호출마다 `lastIndex`가 변이됩니다. 코드에서 `.test()` 후 `lastIndex = 0` 으로 수동 리셋하고 있으나, **동시(Concurrent) 실행 환경**(React의 Concurrent Mode / 서버 사이드 렌더링 등)에서는 두 호출이 같은 인스턴스를 공유해 `lastIndex`가 잘못된 위치를 가리킬 수 있습니다. 결과적으로 오류가 누락되거나 잘못된 양성(false positive)이 발생할 수 있습니다.
- 제안: RegExp를 함수 내부에서 매번 새로 생성하거나, 상수는 `source` 문자열로만 보관하고 호출부에서 `new RegExp(...)` 로 인스턴스화하세요.

```ts
// 안전한 패턴
const LOOP_ROOT_SRC = String.raw`(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])`;
// 함수 내부에서:
if (!context.containerScope.hasLoop && new RegExp(LOOP_ROOT_SRC).test(block)) { ... }
```

---

**[WARNING] `unescapeDoubleQuotedKey` — 이스케이프 처리 범위가 지나치게 광범위 — `validate-scope.ts`**
- 위치: `validate-scope.ts:52–54`
- 상세: `raw.replace(/\\(.)/g, "$1")` 는 `\\n`, `\\t` 등 모든 백슬래시 시퀀스를 무조건 제거합니다. 노드 키 비교 시 `\n` (newline)이 포함된 키가 저장된 방식과 다르게 언이스케이프되어 **false-negative(유효하지 않은 키를 유효로 판단)**가 발생할 수 있습니다. 실제 위협은 낮지만, 내부 로직 일관성 파괴로 검증 우회가 가능합니다.
- 제안: `\"` 시퀀스만 처리하도록 제한하세요.

```ts
function unescapeDoubleQuotedKey(raw: string): string {
  return raw.replace(/\\"/g, '"');
}
```

---

**[INFO] 그래프 순회 시 입력 크기 제한 없음 — `reachable-nodes.ts`**
- 위치: `reachable-nodes.ts:getAncestorsInScope`
- 상세: `nodes`와 `edges` 배열이 외부(워크플로우 상태)에서 유입될 경우, 매우 큰 그래프(수천 노드/엣지)가 BFS 스택을 과도하게 성장시킬 수 있습니다. `visited` 셋으로 무한 루프는 방지되나, 처리 시간/메모리 면에서 브라우저 메인 스레드를 블로킹할 수 있습니다. 현재는 편집기 내부 데이터라 신뢰 경계가 명확하여 실제 위협은 낮습니다.
- 제안: 워크플로우 최대 노드/엣지 수를 스펙에서 정의하고, 방어적으로 상한 체크를 추가하는 것을 고려하세요.

---

**[INFO] 테스트 코드에 악의적 입력 케이스 부재 — `validate-scope.test.ts`**
- 위치: `validate-scope.test.ts` 전체
- 상세: 정상/경계 케이스만 테스트되어 있습니다. `$node["<script>alert(1)</script>"]` 같은 XSS 페이로드나 매우 긴 키, 중첩 `{{` 등에 대한 동작이 검증되지 않습니다. 이 코드는 오류 메시지를 UI에 직접 렌더링하므로(`message` 필드), 토큰 값이 그대로 메시지에 삽입되는 구조(`messageFor`)가 렌더러에서 안전하게 처리되는지 확인이 필요합니다.
- 제안: 에러 메시지를 렌더링하는 컴포넌트가 `token` 값을 `dangerouslySetInnerHTML` 없이 처리하는지 확인하세요 (React의 기본 텍스트 렌더링은 안전). 테스트에 비정상 입력 케이스를 추가하는 것도 권장합니다.

---

### 요약

이 코드는 클라이언트 사이드 표현식 검증/그래프 탐색 유틸리티로, 외부 시스템과의 직접적인 I/O(DB, 네트워크, DOM 조작)가 없어 구조적으로 공격 표면이 매우 좁습니다. 가장 실질적인 위험은 `g` 플래그 RegExp의 모듈 수준 공유로 인한 상태 오염이며, React Concurrent Mode 또는 SSR 환경에서 검증 누락/오동작을 유발할 수 있습니다. 이스케이프 처리 범위 문제는 내부 로직 일관성에 영향을 주나 즉각적인 보안 위협은 낮습니다. 전반적으로 설계는 안전한 편이며, `WARNING` 2건 수정으로 충분합니다.

### 위험도

**LOW**