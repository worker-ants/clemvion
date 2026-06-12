# Security Review

## 발견사항

### **[INFO]** `.env.example` — 개발용 플레이스홀더 자격증명
- 위치: `codebase/backend/.env.example` 라인 94–96, 163–165, 199, 205
- 상세: `DB_PASSWORD=workflow_dev`, `S3_ACCESS_KEY=minioadmin` / `S3_SECRET_KEY=minioadmin`, `ENCRYPTION_KEY=000...000`, `INTEGRATION_ENCRYPTION_KEY=change-me-to-a-32-byte-secret` 등이 파일에 포함되어 있으나, 파일 이름이 `.env.example`이고 상단 주석에 "Secrets show 'change-me-*' placeholders — replace before running"이라고 명시되어 있으며 production guard(`NODE_ENV=production` 시 부팅 거부)도 존재하여 의도된 예시 파일임이 명확합니다. 신규 추가된 `CODE_NODE_MEMORY_LIMIT_MB=128`은 시크릿을 포함하지 않는 일반 설정값입니다.
- 제안: 현재 상태로 적절. `.env.example`이 `.gitignore`에 없고 실제 `.env`가 실수로 커밋되지 않는지 CI에서 별도 검증 권장.

### **[INFO]** `code.handler.ts` — 메모리 한도를 환경변수에서 읽어 모듈 로드 시 고정
- 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` `resolveMemoryLimitMb()` (라인 1412–1418), `ISOLATE_MEMORY_LIMIT_MB` 상수 (라인 1422)
- 상세: `CODE_NODE_MEMORY_LIMIT_MB` 환경변수를 `Number.parseInt`로 파싱 후 양수 여부 확인 및 512MB 상한 clamp가 정확히 구현되어 있습니다. 모듈 로드 시 1회만 읽어 고정하므로 런타임 조작이 불가합니다. 공격자가 환경변수를 제어할 수 있는 경우에도 512 ceiling으로 DoS 영향이 제한됩니다.
- 제안: 현재 구현 충분. 별도 조치 불필요.

### **[INFO]** `code.handler.ts` — base64 호스트 콜백 타입 강제변환 제거
- 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` `hostB64Encode` / `hostB64Decode` (라인 1530–1552)
- 상세: 이전 코드에서 `String(data)` 강제변환을 사용하여 비문자열이 조용히 처리되었으나, 이번 변경에서 `TypeError` throw로 명시화되었습니다. 호스트-격리 경계에서 타입 강제변환 제거는 보안 측면에서 개선입니다 — 비문자열 객체가 `String(data)`를 통해 `[object Object]`로 변환되어 인코딩/디코딩되는 예상치 못한 동작이 차단됩니다.
- 제안: 현재 방향 올바름.

### **[INFO]** `execution-failure-classifier.ts` — 민감 정보 노출 여부 확인
- 위치: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 라인 529–537
- 상세: unknown code fallback 시 `JSON.stringify({ kind, code, triggerId, hasDetails })` 형태로 structured warn log를 기록합니다. `code`(에러 코드 문자열), `triggerId`, `hasDetails` 플래그만 포함하며, `error.message`, `nodeId`, `executionId`, `details.url` 등 민감 필드는 명시적으로 제외되어 있습니다(주석 및 코드 모두 일치). `CODE_MEMORY_LIMIT` 분류 변경은 댓글 수정만이며 동작 변경 없음.
- 제안: 현재 구현 충분.

### **[INFO]** 격리 hardening bootstrap — `globalThis` 삭제
- 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` `BOOTSTRAP_SOURCE` (라인 1568–1639)
- 상세: `eval`, `Function`, `Reflect`, `Proxy`, `Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl`, `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `globalThis` 등이 삭제됩니다. `globalThis` 자체를 삭제하는 것은 이미 삭제된 다른 전역 객체를 `globalThis.eval` 등으로 재접근하는 경로를 차단하는 defense-in-depth 조치로 적절합니다. isolated-vm의 V8 Isolate 경계가 기본 격리를 제공하고, 이 삭제 목록은 추가 하드닝입니다.
- 제안: 현재 구현 충분. `Date`가 삭제 목록에 없어 사용자 코드에서 `new Date()`로 현재 시각 접근이 가능하지만, 이는 의도된 동작으로 보입니다 (`$helpers.date` 제공과 별개).

### **[INFO]** 스택 트레이스 — 비프로덕션 환경에서만 노출
- 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` `failure()` 메서드 (라인 2007)
- 상세: `process.env.NODE_ENV !== 'production'` 조건으로 스택 트레이스를 프로덕션에서 억제합니다. 내부 파일 경로, 라이브러리 버전 정보가 외부에 노출되지 않습니다. 이번 변경에서는 이 로직에 변경 없으며 기존 안전 설계가 유지됩니다.
- 제안: 현재 구현 충분.

## 요약

이번 변경의 핵심은 Code 노드 격리 메모리 한도를 환경변수 `CODE_NODE_MEMORY_LIMIT_MB`로 런타임 튜닝 가능하게 만든 것입니다. 보안 관점에서 전반적으로 견고한 설계를 유지하고 있습니다: 환경변수 파싱 시 숫자 유효성 검증 및 512MB 상한 clamp로 DoS 위험을 제한하고, base64 호스트 콜백에서 타입 강제변환을 제거하여 격리 경계에서의 예상치 못한 동작을 차단하며, 에러 분류 로직에서 민감 필드를 명시적으로 제외하고 있습니다. 격리 hardening bootstrap(eval/Function/Reflect 등 삭제)과 스택 트레이스 프로덕션 억제 패턴도 그대로 유지됩니다. 하드코딩된 시크릿은 없으며, 모든 플레이스홀더는 명시적으로 교체를 요구하는 `.env.example` 내에만 존재합니다. 새로 노출된 공격 표면이 없습니다.

## 위험도

NONE
