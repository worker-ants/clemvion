### 발견사항

- **[INFO]** `deepFreeze` 재귀 함수 — prototype 오염 가능성 (낮음)
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `deepFreeze` 함수 (신규 추가 블록)
  - 상세: `Object.values(value as Record<string, unknown>)` 는 own enumerable property 만 순회하므로 `__proto__` 직접 할당 공격은 해당 없음. 그러나 cache 값 출처가 외부 API 응답(신뢰 경계 밖)일 경우, 배열/함수 타입 값에 대한 재귀 처리 시 예외 없이 freeze 가 적용된다. `typeof value !== 'object'` 분기가 함수 타입(`typeof === 'function'`)을 걸러내지 않아 함수 값이 포함된 cache 항목에 `Object.freeze` 가 호출될 수 있다. freeze 된 함수의 `.name`/`.prototype` 변경은 strict mode 에서 TypeError 를 일으키므로 production 이 아닌 환경에서 부수 효과 가능.
  - 제안: `if (value === null || typeof value !== 'object' || typeof value === 'function') return;` 으로 함수 타입을 명시 배제하거나, cache 값이 plain object/array 만 담는다는 타입 제약(`JsonValue` 등)을 컴파일 타임에 강제.

- **[INFO]** `FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production'` — 환경 변수 조작 가능성
  - 위치: `parallel-executor.ts` 상단 모듈 레벨 상수
  - 상세: `NODE_ENV` 가 설정되지 않은 채 배포되면 `FREEZE_BRANCH_CACHE = true` 가 되어 production 에서도 deep freeze 가 동작한다. freeze 자체는 동작 변경(읽기 전용)이므로 프로덕션 기능 오동작을 유발할 수 있다. 보안 취약점은 아니나, 잘못된 환경 구성이 silent 기능 장애를 만든다.
  - 제안: `NODE_ENV === 'development' || NODE_ENV === 'test'` 방식의 명시 allowlist 로 변경해 미정의 환경을 안전하게 production 동작(freeze 없음)으로 fallback.

- **[INFO]** `sanitizeForLog` — 로그 인젝션 방어 적용 범위 확인
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `sanitizeForLog` 메서드 + `publish`, `nextSeq`, `acquireLock`, `releaseLock` 내 로깅
  - 상세: `publish` 의 catch 블록에서 `err.message` 를 `sanitizeForLog` 없이 직접 interpolation 한다 (`err instanceof Error ? err.message : String(err)`). 외부에서 조작된 Redis 에러 메시지나 큐 연결 에러가 제어 문자를 포함할 경우 로그 인젝션이 가능하다. 현재 `msg.type` 과 `msg.executionId` 는 `sanitizeForLog` 로 보호되지만 에러 메시지 자체는 미처리.
  - 제안: 에러 메시지도 `sanitizeForLog(err instanceof Error ? err.message : String(err))` 로 wrapping. 또는 에러를 별도 구조화 필드로 로깅하는 방식을 채택.

- **[INFO]** Redis Lua script 인라인 문자열 — 주입 위험 없음 확인
  - 위치: `continuation-bus.service.ts` `releaseLock` 메서드 — `const script = "if redis.call('get', KEYS[1]) == ARGV[1] then ..."`
  - 상세: `KEYS[1]` 과 `ARGV[1]` 은 `client.eval(script, 1, key, this.lockToken)` 의 별도 인자로 전달되어 스크립트 본문에 문자열 보간되지 않는다. Redis 프로토콜 수준에서 인자가 분리되므로 Lua 인젝션 위험 없음. 이미 올바른 패턴 사용 중.
  - 제안: 없음 (확인 사항).

- **[INFO]** `fallback random seq` — `Math.random()` 비암호학적 난수 사용
  - 위치: `continuation-bus.service.ts` `nextSeq` 메서드 — `return Math.floor(Math.random() * 65536) + 1_000_000;`
  - 상세: Redis 장애 시 fallback seq 로 `Math.random()` 을 사용한다. BullMQ jobId 의 충돌 방지가 목적이라면 이미 import 된 `randomUUID` (`node:crypto` 기반 CSPRNG) 를 활용하는 것이 더 안전하다. 현재 구현에서 `1_000_000 + [0, 65535]` 범위는 65,536 가지로 동일 executionId 에서 충돌 확률이 비무시(~1.5% after 1000 calls, birthday). 중복 jobId 는 BullMQ 가 두 번째를 거부하는 설계이므로 기능적 oops 이지 보안 취약점은 아님.
  - 제안: `const fallback = Number(randomUUID().replace(/-/g, '').slice(0, 8), 16)` 또는 `crypto.randomInt` (Node 14.10+) 사용.

- **[INFO]** `_retry_state.json` — 절대 경로 포함
  - 위치: `review/consistency/2026/06/10/21_36_50/_retry_state.json`
  - 상세: 파일에 `/Volumes/project/private/clemvion/...` 로컬 절대 경로가 하드코딩 되어 있다. 이 파일이 공개 저장소에 커밋될 경우 운영 환경의 디렉터리 구조가 노출된다. 개발 머신의 경로 정보가 포함되어 있어 OSINT 보조 정보로 활용될 수 있다.
  - 제안: `_retry_state.json` 은 `.gitignore` 에 추가하거나, 경로를 상대 경로 또는 환경 변수로 처리. 이미 `review/` 폴더가 내부 전용이라면 공개 저장소 여부를 확인.

---

### 요약

이번 변경의 핵심은 deprecated `toEiaEvent` alias 제거, `registerContinuationHandlers`/`on()` dead code 삭제, 그리고 parallel branch cache 에 dev/test 전용 deep freeze 추가다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증·인가 우회, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10 주요 항목에 해당하는 취약점은 발견되지 않았다. `sanitizeForLog` 가 로그 인젝션 방어로 명시적으로 구현된 점과 Lua script의 파라미터 분리 패턴은 긍정적이다. 다만 에러 메시지 자체에 `sanitizeForLog` 가 미적용된 일부 로깅 경로, `Math.random()` 기반 fallback seq, `NODE_ENV` 미정의 시 freeze 활성화 위험, `_retry_state.json` 에 하드코딩된 로컬 절대 경로 등 낮은 수준의 개선 여지가 존재한다.

### 위험도

LOW

STATUS: SUCCESS
