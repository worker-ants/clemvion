### 발견사항

- **[INFO]** `renderNodeCatalog` 미캐시 — 매 LLM 턴마다 재계산
  - 위치: `system-prompt.ts` — `buildSystemPrompt` 내 `renderNodeCatalog(nodeDefs)` 호출
  - 상세: `nodeDefs`는 프로세스 수명 동안 변하지 않는 정적 레지스트리 데이터임에도, 매 턴 `.map().join()` 문자열 조립이 반복된다. `EXPRESSION_REFERENCE_CACHE`와 동일한 모듈 스코프 캐시를 적용할 수 있는 대상이다. 단, 파라미터로 전달되므로 배열 참조 동등성(`lastDefs === nodeDefs`)을 키로 쓰거나 호출 측에서 한 번만 넘기도록 구조를 바꿔야 한다.
  - 제안: 호출 측(서비스 레이어)에서 `renderNodeCatalog` 결과를 생성 시 1회 계산 후 저장하거나, 모듈 내부에서 `WeakRef` / identity 비교로 캐시.

- **[INFO]** `EXPRESSION_REFERENCE_CACHE` 캐시 무효화 부재
  - 위치: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE: string | null = null`
  - 상세: 정상 경로에선 문제없다. 단, `getAllFunctionNames()`가 런타임 플러그인 등록(dynamic import) 이후에 함수가 추가될 수 있다면 캐시가 stale해진다. 주석에 "프로세스 수명 동안 불변"이라고 명시되어 있으므로 현재 설계상 의도적이지만, 미래에 동적 함수 등록이 생기면 무효화 트리거가 없어 버그로 이어진다.
  - 제안: 캐시 무효화가 필요한 경우를 대비해 `resetExpressionReferenceCache()` 내부 함수(또는 테스트용 export)를 준비해 두면 테스트 격리에도 유리하다.

- **[INFO]** `sanitizeUserText` 연쇄 regex 6회
  - 위치: `system-prompt.ts` — `sanitizeUserText` 함수
  - 상세: 200자 상한의 짧은 문자열에 대해 6개의 `.replace()` 체이닝이 별도 문자열을 생성한다. 현재 입력 크기에서 측정 가능한 오버헤드는 없으나, 단일 `replace` 콜백으로 통합하면 V8 문자열 할당을 4회 줄일 수 있다.
  - 제안: 반드시 수정할 수준은 아님. 핫패스가 아니라면 현행 유지.

- **[INFO]** `renderActivePlanSection` — 개별 `.push()` 호출 다수
  - 위치: `system-prompt.ts` — `renderActivePlanSection` 함수
  - 상세: 30회 이상의 개별 `lines.push()` 호출 후 `.join('\n')`을 사용하는 패턴은 올바른 접근이다(문자열 누산보다 효율적). 별도 문제 없음. 다만 `ctx.plan.steps` 루프 안에서 문자열 보간이 반복되는 정도는 입력 크기(step 수)에 비례하므로, 수백 개 step이 생기는 경우를 원천 차단하려면 step 수에 상한을 두는 것이 좋다.
  - 제안: `ctx.plan.steps.length > N` 초과 시 잘라내는 가드 추가(현재는 maxLen만 있고 step 수 상한이 없음).

---

### 요약

이번 변경의 핵심 성능 개선은 두 가지다: (1) `EXPRESSION_REFERENCE_CACHE`로 `getAllFunctionNames().sort().join()` 재실행을 제거하고, (2) 동적 상태(snapshot JSON, activePlan)를 프롬프트 말미로 이동해 LLM provider의 prefix-cache hit rate를 높인 것. 두 최적화 모두 방향이 옳고 효과가 명확하다. 남은 미최적화 지점은 `renderNodeCatalog`의 매 턴 재계산으로, 노드 타입이 수십~백 개 수준이면 실질 지연은 무시할 수 있으나 `EXPRESSION_REFERENCE_CACHE`와 일관성 있게 캐싱하는 것이 권장된다. 전반적으로 성능 관점의 위험 요소는 없다.

### 위험도

**LOW**