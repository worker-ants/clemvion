STATUS=success naming_collision review complete — no collisions found

### 발견사항

(해당 없음 — 아래 요약 참조)

### 요약

이번 target 변경(`raw-update-guard-scope` — `codebase/backend/src/common/__test-utils__/source-scan.ts`
에 `countRawUpdateReturning`/`hasRawUpdateReturning` 신설, `update-returning-rows.spec.ts` 에 로컬
`findUnguarded`/`discover`/`listSources`/`ALLOWED`/`MIN_REASON_LENGTH`/`SRC` 신설, `kb-stats.helper.ts`/
`.spec.ts` 는 타입 인자·mock 형태만 수정)은 **spec/data-flow/ 도메인 문서가 다루는 어떤 식별자 범주도
새로 도입하지 않는다** — 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, webhook/queue/SSE 이벤트명,
ENV var·config key, spec 파일 경로 중 어느 것도 이 diff 로 신설되지 않았다. 신설된 함수·상수명
(`countRawUpdateReturning`, `hasRawUpdateReturning`, `findUnguarded`, `discover`, `listSources`, `ALLOWED`,
`MIN_REASON_LENGTH`, `SRC`)은 전부 백엔드 테스트 유틸리티/스펙 파일 내부 식별자이며, `git grep` 로
저장소 전체를 검색한 결과 이 diff 가 도입한 정의·자기 참조 외에는 어떤 기존 사용처도 없다(즉 사전에
다른 의미로 쓰인 적이 없다). 파일 경로도 전부 기존 파일의 수정(diff 헤더에 `new file mode` 없음)이라
경로 충돌 여지도 없다. 번들에 포함된 `spec/data-flow/2-auth.md`, `0-overview.md`, `1-audit.md`,
`3-execution.md`, `9-observability.md`, `11-workflow.md` 등의 큐 이름(`execution-run` 등)·엔티티명
(`user`, `refresh_token`, `login_history` 등)·endpoint(`/api/auth/*` 등)와도 이름이 전혀 겹치지 않는다.
따라서 신규 식별자 충돌 관점에서 이 target 은 위험이 없다.

### 위험도
NONE
