# 보안(Security) 리뷰 결과

## 발견사항

### **[INFO]** `FREEZE_BRANCH_CACHE` allowlist 전환 — 보안 개선 확인
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (diff 라인 35–37)
- 상세: 이전 `process.env.NODE_ENV !== 'production'` (음성 판별) 에서 `=== 'development' || === 'test'` (양성 allowlist) 로 전환됐다. 이전 방식은 `NODE_ENV` 미정의 시 production에서도 deep freeze가 활성화되어 의도치 않은 동작 변경 및 잠재적 기능 장애를 유발할 수 있었다. 이번 변경으로 미정의 환경이 안전하게 freeze off로 fallback된다. 보안 관점에서 이는 올바른 방어적 코딩이다.
- 제안: 조치 완료. 현행 유지.

### **[INFO]** `@internal` JSDoc 추가 — test-only export 명시
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (diff 라인 35–36)
- 상세: `/** @internal — test-only export (M-5 가드의 환경 전제 단언용). 프로덕션 코드에서 사용 금지. */` JSDoc이 추가됐다. production 공개 API 네임스페이스에 테스트 전용 심볼이 노출된 점을 명확히 표시해 오용 가능성을 낮췄다. FREEZE_BRANCH_CACHE 자체가 boolean 플래그(dev/test=true, production=false)이므로 악용 시나리오는 없으나, 오인한 소비자가 production 코드에서 이 값을 조건 분기에 사용하는 실수를 방지하는 효과가 있다.
- 제안: 현행 유지.

### **[INFO]** `deepFreeze` 함수 — 배열 처리 주석 추가 확인
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (diff 라인 40–42)
- 상세: `// 배열도 typeof value === 'object' 이므로 본 분기에서 함께 처리된다 (엘리먼트는 Object.values 순회로 재귀 freeze).` 주석이 추가됐다. 보안 관점에서 `deepFreeze` 의 `Object.values(value as Record<string, unknown>)` 패턴은 own enumerable property만 순회하므로 `__proto__` 오염 공격은 원천 차단된다. cache 값에 함수 타입이 포함될 경우 `typeof value !== 'object'` 분기가 함수를 걸러내지 않는 잠재적 문제(`typeof function === 'function'` 이지만 freeze는 동작)는 이번 변경 대상이 아니나 `nodeOutputCache` 값이 직렬화 가능한 plain object/array 라는 전제(코드 주석에 명시됨)가 유지되는 한 실질 위험은 없다.
- 제안: cache 값 타입을 `JsonValue` 같은 sealed 타입으로 컴파일 타임 강제하면 이 전제를 코드로 보장할 수 있다. 현재는 INFO 수준.

### **[INFO]** `sanitizeForLog` — 에러 메시지 미적용 경로 (기존 코드, 본 변경 범위 외)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (기존 `publish` catch 블록)
- 상세: 이번 변경 diff에 포함되지 않은 기존 코드이나, 이전 리뷰 사이클(22_00_04 INFO5)에서도 지적됐고 미해결 상태다. `publish` catch에서 `err.message`가 `sanitizeForLog` 없이 로그에 직접 interpolation된다. Redis/BullMQ 에러 메시지가 외부에서 조작된 제어 문자를 포함할 경우 로그 인젝션이 가능하다. 본 PR 변경 범위 밖이므로 즉각 차단 사항은 아니나 후속 수정이 권장된다.
- 제안: `sanitizeForLog(err instanceof Error ? err.message : String(err))` 로 wrapping. 후속 refactor 백로그에 추가.

### **[INFO]** `Math.random()` 기반 fallback seq (기존 코드, 본 변경 범위 외)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` `nextSeq` 메서드 (기존 코드)
- 상세: Redis 장애 시 fallback으로 `Math.random()`(비암호학적 PRNG)을 사용해 BullMQ jobId를 생성한다. 65,536가지 범위로 동일 executionId에서 충돌 확률이 비무시적이며(~1.5% after 1000 calls, birthday), 보안이 아닌 기능 신뢰성 문제다. 이미 `node:crypto`의 `randomUUID`가 import되어 있어 교체가 용이하다. 본 PR 변경 범위 밖.
- 제안: `Math.random()` → `crypto.randomInt(1, 65536)` (Node 14.10+) 또는 UUID 기반 숫자 슬라이싱으로 교체. 후속 백로그.

### **[INFO]** `_retry_state.json` 로컬 절대 경로 노출 — review/ 내부 파일
- 위치: `review/code/2026/06/10/22_00_04/_retry_state.json` (diff omitted 처리됨)
- 상세: 이전 리뷰(22_00_04 INFO8)에서도 확인됨. `/Volumes/project/private/clemvion/...` 로컬 절대 경로가 파일에 하드코딩되어 있다. 공개 저장소에 커밋 시 개발 머신의 디렉터리 구조가 노출되어 OSINT 보조 정보로 활용될 수 있다. 내부 전용 저장소이면 위험도가 낮지만, 습관적으로 절대 경로를 커밋하는 패턴은 개선이 권장된다.
- 제안: `_retry_state.json`을 `.gitignore`에 추가하거나 상대 경로로 처리. 저장소가 내부 전용이라면 현행 유지 가능.

---

## 요약

이번 변경 세트는 내부 dead code 제거(`toEiaEvent` alias, `on()`, `registerContinuationHandlers`, deprecated 상수)와 dev/test 전용 deep freeze 가드(`FREEZE_BRANCH_CACHE` + `deepFreeze` + `freezeSharedCacheValues`) 강화로 구성된다. 보안 관점에서 긍정적 변화가 두 가지 있다. 첫째, `FREEZE_BRANCH_CACHE` allowlist 방식(`=== 'development' || === 'test'`)으로의 전환으로 `NODE_ENV` 미정의 환경에서 production 기능 오동작 위험이 제거됐다. 둘째, `@internal` JSDoc 추가로 test-only export의 오용 가능성이 명시적으로 차단됐다. OWASP Top 10 주요 항목(SQL 인젝션, XSS, 커맨드 인젝션, 인증/인가 우회, 하드코딩 시크릿, 안전하지 않은 암호화)에 해당하는 신규 취약점은 이번 변경에서 도입되지 않았다. Redis Lua 스크립트의 파라미터 분리 패턴(인젝션 방어)과 `sanitizeForLog` 구현은 긍정적이다. 잔여 우려 사항(에러 메시지 `sanitizeForLog` 미적용, `Math.random()` fallback seq, `_retry_state.json` 절대 경로)은 모두 기존 코드 또는 내부 파일에 해당하여 본 PR 범위 밖이며, 후속 refactor 백로그 처리가 적절하다.

---

## 위험도

LOW

STATUS=success ISSUES=0
