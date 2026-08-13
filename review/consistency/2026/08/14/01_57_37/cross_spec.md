# Cross-Spec 일관성 검토 — cross_spec

## 사전 정정 — 검토 대상 재식별 (중요)

전달받은 프롬프트는 "target 문서: `spec/5-system/`, 모드: --impl-done, scope: `spec/5-system/`" 로
프레이밍하고 있고 워크트리 디렉터리명도 `eia-r8-cache-scope-4ae434` 다. 그러나 실제로 확인한
결과:

- `git log --oneline origin/main..HEAD -- spec/5-system` → **0건** (spec 변경 없음)
- `git diff origin/main...HEAD --stat -- spec/ codebase/` → 변경은 전부
  `codebase/backend/src/{modules/auth/auth-oauth.service.ts, modules/execution-engine/execution-engine.service.ts, modules/knowledge-base/knowledge-base.service.ts, common/utils/{assert-row-array,update-returning-rows}.ts, common/__test-utils__/source-scan.ts}` +
  신규 e2e `auth-oauth-callback.e2e-spec.ts` 뿐이다. "EIA §R8 캐시 스코프" 관련 변경(예:
  `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md`)은
  **전혀 없다.**
- 이 워크트리(`eia-r8-cache-scope-4ae434`)의 실제 체크아웃 브랜치는
  `claude/raw-query-audit-followups` 다 (`git branch --show-current`). 워크트리 디렉터리명이
  재사용된 뒤 rename 되지 않은 케이스 — 이 세션 자신의 최신 커밋(`103dee234`,
  `plan/in-progress/update-returning-tuple-shape.md`)이 **바로 이 문제를 이미 실측·기록**했다:
  같은 입력으로 `--impl-done` 4라운드를 돌려 판정이 갈렸고, 원인이 `_head_basis_notice()` 가
  박는 워크트리 경로에서 체커가 "EIA r8 캐시 스코프 작업"을 잘못 추론해 spec 델타 0을
  CRITICAL("검토 전제 자체가 무효")로 오판한 것이었다.

**따라서 본 검토는 "target = `spec/5-system/`(EIA 캐시)" 전제를 기각하고, 실제 diff(=
`update-returning-tuple-shape` 라인의 raw-SQL RETURNING 튜플 shape 버그 수정 PR)를 대상으로
Cross-Spec 분석을 수행했다.** "spec 델타 0" 자체를 CRITICAL 로 재상신하지 않는다 — 이미
동일 세션에서 오탐으로 확인·기록된 사항이다.

## 실제 diff 대상 Cross-Spec 분석

변경은 4개 모듈에서 동일한 근본 원인(TypeORM 0.3.31+pg: `UPDATE`/`DELETE ... RETURNING` 이
`[rows, rowCount]` 튜플을 반환하는데 행 배열로 오인)을 고치는 버그 수정이다. 각 지점을
관련 spec 문서와 대조했다.

1. `auth-oauth.service.ts` (OAuth 콜백 state 소비) — `spec/data-flow/2-auth.md` §1.3 시퀀스가
   "row 없으면 400 OAUTH_STATE_MISMATCH, row.provider ≠ :provider 도 거부"라고 서술한 동작을
   그대로 복원한다(수정 전엔 `consumed.length === 0` 이 항상 거짓이라 정상 콜백까지
   `OAUTH_STATE_MISMATCH` 로 상시 실패). 에러 코드는 `spec/conventions/error-codes.md:35` 에
   기존 카탈로그 항목으로 존재 — 신규 요구사항 ID 충돌 없음.
2. `execution-engine.service.ts` admission UPDATE — `spec/5-system/4-execution-engine.md` §4.1
   ("PENDING→RUNNING 최초 진입에만" 원자적 admission gate)·§7.1(stalled 재배달 RUNNING arm은
   admission 을 재심사하지 않음)이 이미 두 경로를 명확히 분리해 문서화하고 있다. 수정 전
   코드는 튜플 버그로 정상 admission 이 항상 "실패"로 오판돼 매 실행이 §7.1 stalled-재배달
   경로로 잘못 새 진입했다(문서가 금지하는 경로 혼용) — 수정은 이 divergence 를 제거하고
   spec 이 서술한 두 경로 분리를 실제로 복원한다. `EXECUTION_STARTED` 는 spec 어디에도
   WS 프로토콜 계약으로 노출되지 않는 내부 이벤트라(`grep -rn EXECUTION_STARTED spec/` 0건),
   그 emit 타이밍 변화가 `spec/5-system/6-websocket-protocol.md` 와 충돌하지 않는다.
3. `knowledge-base.service.ts` CAS 락(`reextract_status`/`reembed_status`) — `spec/5-system/
   8-embedding-pipeline.md:264` ("결과가 0행이면 409 KB_REEMBED_IN_PROGRESS")·
   `spec/5-system/3-error-handling.md:196-197` 의 `KB_REEXTRACT_IN_PROGRESS`/
   `KB_REEMBED_IN_PROGRESS` 카탈로그와 정확히 일치하는 방향으로 복원한다(수정 전엔 동시
   재추출/재임베딩 거절이 상시 무효화돼 있었다 — spec 위반이 실제로 존재했었고 이 diff 가
   그것을 닫는다).

세 지점 모두 **spec 문서가 이미 명시한 계약을 코드가 어기고 있던 것을 바로잡는 방향**이라
새로운 cross-spec 모순을 만들지 않는다.

## 발견사항

- **[WARNING]** 검토 페이로드의 target 프레이밍이 실제 diff 와 불일치
  - target 위치: 프롬프트 상단 "Target 문서 경로: `spec/5-system/`" + 워크트리 경로
    `eia-r8-cache-scope-4ae434`
  - 충돌 대상: 실제 `git diff origin/main...HEAD` (raw-query 튜플 shape 수정, EIA/캐시와 무관)
  - 상세: 워크트리 디렉터리명이 이전 작업("EIA r8 캐시 스코프")에서 재사용되며 rename 되지
    않아, 실제 체크아웃 브랜치(`claude/raw-query-audit-followups`)와 이름이 어긋난다.
    orchestrator 가 워크트리 절대경로로 작업 성격을 추론하면 이번처럼 오판을 유발한다.
  - 제안: 이미 `plan/in-progress/update-returning-tuple-shape.md`(harness 체크리스트, 커밋
    `103dee234`)에 처방 후보(경로 대신 브랜치명·plan 파일을 프롬프트에 병기 / 워크트리 재사용
    시 rename 강제)가 등재돼 있다. 새 항목 등재 불필요 — 그대로 참조.

- **[INFO]** raw-SQL `RETURNING` 튜플 shape 처방이 4곳(신규)·3곳(기존, 미이관)으로 분산
  - target 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` 문서 주석 내
    "저장소에 같은 문제를 각자 푼 관용구가 셋 더 있다" 표
    (`agent-memory-admin`·`stuck-document-recovery`·`integration-oauth`)
  - 충돌 대상: `spec/conventions/**` — raw SQL `UPDATE/DELETE ... RETURNING` 반환 shape 을
    다루는 정식 convention 문서가 없음(`grep -rln "RETURNING" spec/conventions/` 0건)
  - 상세: cross-spec 계약 위반은 아니지만, 동일 드라이버 특이 동작을 4개 이상의 모듈이
    각자 다른 관용구로 처방해온 이력(그중 하나가 상시 실패 버그로 실현됨)이 있다. 신규
    헬퍼가 도입됐지만 기존 3곳은 "과거 호환으로 유지"라 의도적으로 미이관 상태다.
  - 제안: 필수는 아니나, `spec/conventions/` 에 "raw query 결과 shape" 절 하나를 신설해
    신규 지점이 이 헬퍼를 쓰도록 명시하면 다섯 번째 재발을 구조적으로 막을 수 있다
    (developer 권한 밖 — project-planner 턴 필요).

## 요약

프롬프트가 프레이밍한 "target = `spec/5-system/`(EIA r8 캐시 스코프)" 전제는 워크트리 재사용에
따른 이름 불일치로 무효였으며, 이는 같은 세션이 이미 실측·기록한 known issue다(재상신하지
않음). 실제 diff(4개 백엔드 모듈의 raw-SQL `RETURNING` 튜플 shape 버그 수정)를 대상으로
Cross-Spec 분석을 수행한 결과, 세 핵심 지점(OAuth state 소비·execution admission gate·KB CAS
락) 모두 이미 문서화된 spec 계약(`data-flow/2-auth.md` §1.3, `5-system/4-execution-engine.md`
§4.1/§7.1, `5-system/8-embedding-pipeline.md` §7.3 + `5-system/3-error-handling.md` 카탈로그)을
코드가 위반하고 있던 것을 바로잡는 방향이라 새로운 데이터 모델·API 계약·상태 전이·RBAC 충돌을
만들지 않는다. 유일한 개선 여지는 raw-SQL 결과 shape 처방을 정식 convention 문서로 승격하는
것(INFO, 비차단).

## 위험도
LOW
