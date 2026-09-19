# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-integration-db-test-waits.md`

## 검토 방법

target draft 가 가리키는 `spec/2-navigation/4-integration.md` §5.4(Database 테스트) · §6(상태 전이) · §9.1~§9.3(API) 원문을 전부 열어 확인했고,
같은 문구·섹션 번호를 참조할 수 있는 인접 영역을 grep 으로 전수 확인했다(파일 목록 budget 제한과 무관하게 실제 파일을 직접 읽음):

- `spec/1-data-model.md` §2.10 Integration / §2.10.1 IntegrationUsageLog
- `spec/data-flow/5-integration.md` (상태 다이어그램 · pending_install 시퀀스 · 만료 스캐너)
- `spec/4-nodes/4-integration/2-database-query.md` (노드 실행의 `DB_CONNECTION_ERROR`)
- `spec/4-nodes/4-integration/_product-overview.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md` (다른 `§9.3` 참조 전부)
- `INTEGRATION_INCOMPLETE` 문자열 전수 grep (spec/ 전체)
- 참고용으로 `codebase/frontend/src/content/docs/.../integration-management.mdx` (사용자 가이드, spec 밖)

## 발견사항

없음.

target 은 두 자리 모두 **같은 문서(`4-integration.md`) 안의 사실 정정**이며 다른 spec 영역의 엔티티·API 계약·상태 머신·RBAC·계층 책임을 새로 정의하지 않는다.

- **A (§5.4 대기 문장)**: 현재 spec 원문(§5.4, L499)은 "연결 대기는 10초"만 적고 `SELECT 1` 실행 자체의 대기는 언급하지 않는다 — target 이 주장하는 원문 상태와 일치. `spec/1-data-model.md` §2.10, `spec/data-flow/5-integration.md`, `spec/4-nodes/4-integration/2-database-query.md` 어디에도 이 대기 시간을 다르게 규정하거나 재인용하는 곳이 없어 A 를 반영해도 다른 문서와 새로 어긋나는 지점이 생기지 않는다. 오히려 codebase 의 사용자 가이드(`integration-management.mdx` L78: "연결과 `SELECT 1`을 각각 최대 10초")가 이미 target 의 문구와 동일해, 반영 후에는 spec ↔ 가이드가 더 정합해진다.
- **B (§6 괄호의 절 번호)**: `POST /api/integrations/:id/test` 의 `pending_install` → `INTEGRATION_INCOMPLETE` 가드는 실제로 §9.1 표(L814)에 있고, §9.3(L834~840, "사용처·활동")에는 `usages`/`activity`/`services/:type/catalog` 세 endpoint만 있어 해당 가드가 없다 — target 의 정정(§9.3→§9.1)이 맞다. `spec/4-nodes/4-integration/4-cafe24.md`(L114)와 `spec/conventions/cafe24-api-metadata.md`(L421)에도 `§9.3` 참조가 있지만, 이들은 `services/cafe24/catalog` endpoint(실제로 §9.3에 있음)를 가리키는 것이라 target 이 건드리는 문장과는 다른 참조이며 함께 고칠 필요가 없다. `data-flow/5-integration.md` 는 이 가드 자체를 언급하지 않아 (grep 0건) 동반 갱신 대상이 아니다.

낮은 신뢰도 참고사항 — CRITICAL/WARNING 아님, 정보용:
- target 의 "비대상" 절이 스스로 명시했듯 §5.4 변경은 `IntegrationTestResult.code` 결과 목록(성공/`DB_HOST_BLOCKED`/`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`)에 "쿼리 타임아웃"을 별도 분기로 넣지 않는다 — 현재도 쿼리 타임아웃은 "그 밖(네트워크·타임아웃·TLS·없는 database 등)" 버킷인 `DB_CONNECT_FAILED` 에 자연스럽게 포함되므로 새 API 계약 불일치는 생기지 않는다. 이 판단은 target 문서 자체가 이미 명시적으로 범위를 좁힌 결과와 일치한다.

## 요약

target 은 새 엔티티·API·상태·권한을 도입하지 않는 순수 사실 정정 2건이며, 두 정정 모두 같은 문서 내부의 다른 절(§5.4·§6·§9.1)에 대한 서술 오류를 원문과 대조해 확인했다. 데이터 모델(`1-data-model.md`), 데이터 흐름(`data-flow/5-integration.md`), 노드 스펙(`4-nodes/4-integration/2-database-query.md`, `4-cafe24.md`), 관련 컨벤션(`cafe24-api-metadata.md`) 전수 grep 결과 이 변경과 충돌하거나 동반 갱신이 필요한 문구는 발견되지 않았다. §9.3 을 가리키는 다른 두 참조(cafe24 노드 spec · cafe24-api-metadata 컨벤션)는 서로 다른 endpoint(카탈로그 조회)를 정확히 가리키고 있어 target 변경과 무관하다.

## 위험도

NONE
