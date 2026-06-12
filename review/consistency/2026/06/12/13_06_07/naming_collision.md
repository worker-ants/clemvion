# 신규 식별자 충돌 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Target 영역: `spec/4-nodes/5-data/` (0-common.md / 1-transform.md / 2-code.md)

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. `spec/4-nodes/5-data/` 의 frontmatter `id` 값(`common`, `transform`, `code`)은 다른 카테고리 폴더에서도 동명 사용이 있으나 이는 기존에 알려진 패턴(각 카테고리 0-common.md 가 `id: common` 을 보유)이며 `/plan/in-progress/spec-draft-conventions-code-data.md` §잔여 항목에 INFO 로 이미 추적 중이다. 식별자 자체의 의미 충돌은 없다.

### 엔티티/타입명 충돌

충돌 없음. `transformNodeConfigSchema`, `validateTransformConfig`, `codeNodeConfigSchema`, `codeNodeMetadata` 는 해당 파일(`transform.schema.ts`, `code.schema.ts`) 안에만 export 되며, 다른 spec 영역에서 같은 이름이 다른 의미로 정의된 사례를 발견하지 못했다.

### API endpoint 충돌

Data 노드(Transform / Code)는 REST 엔드포인트를 직접 정의하지 않는다. 해당 없음.

### 이벤트/메시지명 충돌

Data 노드는 webhook/queue/SSE 이벤트를 신규 정의하지 않는다. 해당 없음.

### 환경변수·설정키 충돌

- **[INFO]** `CODE_NODE_MEMORY_LIMIT_MB` — target(`spec/4-nodes/5-data/2-code.md §7.2`)에서 신규 도입
  - target 신규 식별자: `CODE_NODE_MEMORY_LIMIT_MB` (env var, isolate memoryLimit 조정용, 기본 128, 최대 512)
  - 기존 사용처: `codebase/backend/src/nodes/data/code/code.handler.ts:17` 주석(`W15: Currently hardcoded. Can be extracted to CODE_NODE_MEMORY_LIMIT_MB`)에서 예고 이름으로만 언급됨. `.env.example` 에는 미등재. spec 본문 내 다른 파일에는 미등장.
  - 상세: 구현 코드의 W15 주석과 spec 이름이 일치한다. 아직 실제 `process.env.CODE_NODE_MEMORY_LIMIT_MB` 읽기 코드가 없으므로 구현 시 추가 필요. 기존 env var 와의 이름 충돌 없음.
  - 제안: 구현 착수 시 `.env.example` 에 `CODE_NODE_MEMORY_LIMIT_MB=128` 을 추가하고, `code.handler.ts` W15 주석을 구현 완료 표시로 갱신.

### 에러 코드 식별자 — 동명 이중 레이어 (기존 추적 항목, 참고)

- **[INFO]** `EXECUTION_TIMEOUT` 동명 이중 레이어
  - target 신규 식별자: `EXECUTION_TIMEOUT` (`output.error.details.legacyCode` 값)
  - 기존 사용처: `spec/5-system/3-error-handling.md:64`, `spec/5-system/4-execution-engine.md:1018`, `spec/conventions/error-codes.md:75`, `spec/5-system/14-external-interaction-api.md:547` 등에서 동일 문자열이 **Code 노드 스크립트 타임아웃(핸들러 내부 legacy code)** 과 **엔진 레벨 EIA `execution.failed.error.code`** 두 레이어에서 동시에 사용됨.
  - 상세: target spec 자체가 이 이중성을 인지하고 `conventions/error-codes.md §4 레이어 주의` 박스와 표로 명확히 기술하고 있다. 새로운 충돌이 아니며 기존에 의도적으로 수용된 동명 이중 레이어. 구현 측도 `error-codes.ts` 에서 구분하여 처리 중.
  - 제안: 현상 유지. 이미 `error-codes.md §4` 가 레이어 주의를 명시적으로 경고하고 있으므로 추가 조치 불필요.

### 파일 경로 충돌

충돌 없음. `spec/4-nodes/5-data/0-common.md`, `1-transform.md`, `2-code.md` 는 이미 저장소에 존재하는 파일이다(`ls` 결과). 신규 파일 생성이 없으므로 명명 컨벤션 위반·경로 충돌 모두 해당 없음.

---

## 요약

`spec/4-nodes/5-data/` 의 세 파일(0-common / 1-transform / 2-code)이 도입하는 신규 식별자 중 기존 사용처와 의미가 충돌하는 항목은 발견되지 않았다. 에러 코드(`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT`)는 `conventions/error-codes.md` 와 `5-system/3-error-handling.md` 에 이미 등록·정렬된 상태이며, `EXECUTION_TIMEOUT` 동명 이중 레이어는 conventions 에서 이미 명시적으로 다루고 있다. 신규 env var `CODE_NODE_MEMORY_LIMIT_MB` 는 구현 코드 W15 주석과 이름이 일치하고 기존 env var 와 겹치지 않으나, 구현 착수 시 `.env.example` 등재가 필요하다(INFO). 요구사항 ID, 엔티티명, API 엔드포인트, 이벤트명, 파일 경로 모두 충돌 없음.

---

## 위험도

NONE
