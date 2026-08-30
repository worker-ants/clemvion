### 발견사항

이번 target(`plan/in-progress/spec-draft-raw-query-results.md`)이 실제로 새로 도입하는 식별자는 많지 않다 — 신규 spec 파일 1개(`spec/conventions/raw-query-results.md`), frontmatter `pending_plans:` 항목 추가 1건, 기존 5개 spec 문서에 대한 Rationale 각주 추가다. 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var 는 도입하지 않는다. 확인 결과:

- **신규 파일 경로**: `spec/conventions/raw-query-results.md` — `spec/conventions/` 디렉터리에 동일 경로/이름의 기존 파일 없음(`ls spec/conventions/` 확인). frontmatter `id: raw-query-results` 도 기존 22개 convention 문서의 `id:` 값과 겹치지 않음(`spec-impl-evidence.md` 내부 예시 id `chat-channel`/`voice-trigger` 포함 전수 확인). 명명 컨벤션(`<도메인>-<대상>.md`, kebab-case)도 `node-cancellation.md`/`node-output.md`/`migrations.md` 와 일관.
- **`updateReturningRows` 식별자**: target 이 이 이름을 신규 도입하는 게 아니라 이미 `codebase/backend/src/common/utils/update-returning-rows.ts` 에 구현·사용 중인 헬퍼를 문서화하는 것이다(`execution-engine.service.ts`, `auth-oauth.service.ts`, `knowledge-base.service.ts` 등 다수 호출처 확인). 의미 충돌 없음.
- **각주 삽입 위치 5건 전부 실존 확인**:
  - `spec/data-flow/2-auth.md` — `### OAuth state 의 one-shot DELETE` (Rationale, 실제 존재, L386)
  - `spec/5-system/4-execution-engine.md` — `### 1.1 Execution 상태` (L37, 실제 존재)
  - `spec/5-system/8-embedding-pipeline.md` — `### 7.3 재임베딩` (L247, 실제 존재)
  - `spec/5-system/10-graph-rag.md` — 동시 호출 표의 `re-extract` 행 (L565 부근, 실제 존재)
  - `spec/conventions/node-cancellation.md` — `### 2.4 DB 관측 취소 가드` 네 번째 불릿(재조회 후 0행 skip 분기, L66 이하, 실제 존재)
  각 대상 문서에 `#1168`/`#1172`/RETURNING 튜플 관련 기존 각주가 이미 있는지도 확인했으나 중복 없음(신규 삽입은 실제로 새 내용).
- **`pending_plans:` 키**: `node-cancellation.md` 를 포함해 이미 spec 전역에서 쓰이는 표준 frontmatter 키(18개 문서에서 사용 확인). target 이 추가하려는 `plan/in-progress/update-returning-tuple-shape.md` 항목은 현재 `node-cancellation.md` 의 `pending_plans` 에 없음(현재 1건 `node-cancellation-residual-signal-propagation.md` 만 등재) — 신규 추가 자체는 충돌 아님.

- **[INFO]** `pending_plans` 항목에 대한 중복 지시 출처(참고, 엄밀한 identifier 충돌은 아님)
  - target 신규 식별자: `node-cancellation.md` frontmatter `pending_plans:` 에 `plan/in-progress/update-returning-tuple-shape.md` 추가 (target §C)
  - 기존 사용처: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:664` — "부수: frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 등재." 라고 **동일한 추가**를 이미 다른 in-progress spec-draft 가 위임해 두고 있다.
  - 상세: 두 문서가 요구하는 값 자체는 동일(같은 경로)이라 "다른 의미로 충돌"하는 CRITICAL 케이스는 아니다. 다만 같은 frontmatter 키에 대한 쓰기 지시가 서로 다른 두 spec-draft 에 중복 존재해, 어느 쪽이 먼저 반영되느냐에 따라 나머지 한쪽의 지시가 "이미 반영됨"으로 소리 없이 무효화될 수 있다.
  - 제안: planner 가 이 target 을 반영할 때 `spec-update-node-cancellation-shutdown-classification.md:664` 의 동일 지시를 함께 소거(또는 상호 참조 각주)해 두 소스가 같은 항목을 다시 손대지 않도록 정리 권장. identifier 자체의 충돌은 아니므로 차단 사유는 아님.

### 요약
target 이 새로 도입하는 식별자(신규 spec 파일 경로/`id`, `updateReturningRows` 참조, 각주 삽입 위치 5곳, `pending_plans` 추가 1건)를 기존 `spec/`·`codebase/backend/src` 전수와 대조한 결과, 동일 이름이 다른 의미로 이미 쓰이고 있는 CRITICAL 급 충돌은 발견되지 않았다. 유일하게 주목할 점은 `pending_plans` 갱신 지시가 이 target 과 별도의 다른 in-progress spec-draft(`spec-update-node-cancellation-shutdown-classification.md`)에도 동일하게 존재한다는 것인데, 이는 "다른 의미의 충돌"이 아니라 "같은 값에 대한 중복 출처"이므로 정보성 수준으로만 남긴다.

### 위험도
LOW
