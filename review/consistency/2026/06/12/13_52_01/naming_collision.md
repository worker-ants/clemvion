# 신규 식별자 충돌 분석

검토 범위: `spec/4-nodes/5-data/` (0-common.md, 1-transform.md, 2-code.md) + 구현 diff (origin/main...HEAD)

---

## 발견사항

### 요구사항 ID 충돌

- **[INFO]** `id: common` — 기존 패턴과 동일한 패턴이지만 충돌 없음
  - target 신규 식별자: `spec/4-nodes/5-data/0-common.md` 의 frontmatter `id: common`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/0-common.md`, `/spec/4-nodes/2-flow/0-common.md`, `/spec/4-nodes/3-ai/0-common.md`, `/spec/4-nodes/4-integration/0-common.md`, `/spec/4-nodes/7-trigger/0-common.md` — 모두 `id: common`
  - 상세: `id: common` 은 각 노드 카테고리의 `0-common.md` 파일이 공유하는 관행적 ID다. 식별자가 동명이지만 모든 사례가 동일한 역할(카테고리 공통 규약 문서)이므로 의미 충돌이 아니라 명명 패턴의 반복이다.
  - 제안: 현 패턴 유지 (기존 모든 `0-common.md` 와 일관성). 변경 불필요.

- **[INFO]** `id: transform`, `id: code` — 충돌 없음
  - target 신규 식별자: `spec/4-nodes/5-data/1-transform.md` `id: transform`, `spec/4-nodes/5-data/2-code.md` `id: code`
  - 기존 사용처: 전체 spec 폴더 검색 결과 `id: transform` / `id: code` 를 사용하는 다른 spec 파일 없음
  - 상세: 이미 `spec/4-nodes/0-overview.md`(`id: nodes-overview`) 및 다른 노드 spec 에서 `transform`, `code` 는 **node type 문자열** 로만 참조되며 별도 spec 파일 ID 로 등록된 사례 없음.
  - 제안: 없음.

### 엔티티/타입명 충돌

- **[INFO]** `resolveMemoryLimitMb` — 충돌 없음
  - target 신규 식별자: `codebase/backend/src/nodes/data/code/code.handler.ts` `export function resolveMemoryLimitMb()`
  - 기존 사용처: 메인 브랜치 전체 `codebase/backend/src/` 검색에서 동명 함수 없음.
  - 상세: 신규 내보내기 함수. 동일 파일의 기존 상수 `ISOLATE_MEMORY_LIMIT_MB = 128` 은 target 에서 `resolveMemoryLimitMb()` 의 호출 결과로 재정의되며, 상수명은 유지되어 호출처 변경 없음.
  - 제안: 없음.

- **[INFO]** `hostB64Encode`, `hostB64Decode` — 충돌 없음
  - target 신규 식별자: 동일 파일 내 module-level 함수 `hostB64Encode`, `hostB64Decode`
  - 기존 사용처: 메인 브랜치 `codebase/backend/src/` 전체에서 동명 함수 없음. 기존에는 `ivm.Callback` 람다 인라인으로 `Buffer.from(String(data), 'utf-8').toString('base64')` 를 직접 사용.
  - 상세: 추출된 헬퍼 함수. 기존 인라인 람다와 이름 충돌 없음.
  - 제안: 없음.

- **[INFO]** `DEFAULT_MEMORY_LIMIT_MB`, `MAX_MEMORY_LIMIT_MB` — 충돌 없음
  - target 신규 식별자: `code.handler.ts` 내 모듈-스코프 상수
  - 기존 사용처: 메인 브랜치 `src/` 전체에서 동명 상수 없음.
  - 제안: 없음.

- **[INFO]** `_buildIsolateContext`, `_runWithTimeout` — 충돌 없음
  - target 신규 식별자: `CodeHandler` 클래스의 private 메서드
  - 기존 사용처: 메인 브랜치 `src/` 전체에서 동명 메서드 없음.
  - 제안: 없음.

### API endpoint 충돌

- **[INFO]** 해당 없음. target diff 에 신규 HTTP endpoint 정의 없음.

### 이벤트/메시지명 충돌

- **[INFO]** 해당 없음. target diff 에 webhook·queue·SSE 이벤트명 신규 등록 없음.

### 환경변수·설정키 충돌

- **[INFO]** `CODE_NODE_MEMORY_LIMIT_MB` — 충돌 없음
  - target 신규 식별자: `codebase/backend/.env.example` 에 신규 추가된 환경변수 키
  - 기존 사용처: 메인 브랜치 `codebase/backend/.env.example`(317줄) 에 해당 키 없음. `codebase/backend/src/nodes/data/code/code.handler.ts` 에 주석(`// W15: Currently hardcoded. Can be extracted to CODE_NODE_MEMORY_LIMIT_MB`)으로만 언급됐으나 실제 `process.env` 참조 없었음.
  - 상세: 신규 키. 기존에 동명 키로 다른 의미를 갖는 사용처 없음. spec(`4-nodes/5-data/2-code.md §7.2`, `4-nodes/0-overview.md`, `conventions/error-codes.md`, `5-system/3-error-handling.md`)에서 이미 이 키를 공식 정의로 참조하고 있어 spec-impl 일치.
  - 제안: 없음.

### 파일 경로 충돌

- **[INFO]** 해당 없음. target spec 파일 경로(`spec/4-nodes/5-data/`) 는 기존 디렉터리 구조와 일치하며 동명 파일 없음.

---

## 요약

`spec/4-nodes/5-data/` target 과 그에 대응하는 구현 diff(code.handler.ts, .env.example, frontend docs)가 도입하는 모든 신규 식별자(`CODE_NODE_MEMORY_LIMIT_MB` 환경변수, `resolveMemoryLimitMb` 함수, `hostB64Encode`/`hostB64Decode` 헬퍼, `_buildIsolateContext`/`_runWithTimeout` private 메서드, `DEFAULT_MEMORY_LIMIT_MB`/`MAX_MEMORY_LIMIT_MB` 상수, spec frontmatter `id: transform`/`id: code`)는 기존 사용처와 의미 충돌이 없다. `id: common` 중복은 모든 노드 카테고리 `0-common.md` 가 공유하는 기존 패턴이므로 새로운 충돌이 아니다. CRITICAL 또는 WARNING 등급의 식별자 충돌은 발견되지 않았다.

---

## 위험도

NONE
