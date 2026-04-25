### 발견사항

- **[INFO]** `system-prompt.ts`의 모듈 스코프 가변 캐시 (`expressionReferenceCache`)
  - 위치: `system-prompt.ts` — `let expressionReferenceCache: string | null = null;` 및 `getExpressionReferenceSection()`의 lazy-init 패턴
  - 상세: 모듈 스코프 `let` 변수를 null 체크 후 쓰는 check-then-act 패턴은 멀티스레드 환경에서 TOCTOU 경쟁 조건이 된다. 그러나 Node.js는 단일 스레드 이벤트 루프를 사용하고 `buildExpressionSection()` 호출이 완전히 동기적이므로, 인터리빙이 발생할 수 없다. 다만 `resetExpressionCacheForTesting()`이 `export`로 노출되어 있어, 향후 Worker Thread를 도입하거나 이 함수가 실수로 프로덕션 경로에서 호출되면 즉시 경쟁 조건으로 전환된다.
  - 제안: `resetExpressionCacheForTesting`에 `/* @visibleForTesting */` 등의 명시적 경계 표시를 추가하거나, 별도 테스트 전용 export 파일로 분리해 프로덕션 번들에서 제외되도록 관리하는 것이 방어적으로 더 안전하다. 현재 주석(`프로덕션 코드는 호출하지 말 것`)은 충분하지만 런타임 guard는 없다.

- **[INFO]** `review-workflow.ts` — 모든 상태가 함수 스코프 로컬
  - 위치: `buildReviewChecklist`, `collectOrphans`, `collectDanglingOutputPorts` 등 전체
  - 상세: `Map`, `Set`, `Array` 등 모든 컬렉션이 함수 호출마다 새로 생성된다. 모듈 스코프 공유 상태가 전혀 없으므로 동시 요청 간 간섭 없음.

---

### 요약

리뷰 대상 코드는 대부분 순수 동기 연산으로 구성되어 있으며, 공유 가변 상태는 `system-prompt.ts`의 `expressionReferenceCache` 하나뿐이다. Node.js 단일 스레드 이벤트 루프 모델에서는 동기 블록 내 check-then-act가 원자적으로 실행되므로 실질적인 경쟁 조건은 발생하지 않는다. 다만 테스트 전용 리셋 함수가 `export`로 노출되어 있어 Worker Thread 도입이나 실수 호출 시 위험 표면이 열릴 수 있으며, 이 점이 현재 코드에서 유일하게 주의가 필요한 부분이다.

### 위험도

**LOW**