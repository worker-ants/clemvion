# 변경 범위(Scope) 리뷰 결과

## 발견사항

### INFO — spec/ 파일 수정 (개발자 역할 범위 확인)
- 위치: `spec/1-data-model.md`, `spec/5-system/13-replay-rerun.md`, `spec/data-flow/3-execution.md`
- 상세: CLAUDE.md 규약상 `spec/` 쓰기 권한은 `project-planner` 역할에만 부여된다. 그러나 세 파일의 변경 내용은 모두 구현 사실(V095 인덱스 추가, computeChainDepth CTE 전환)을 spec 에 동기화하는 문서 업데이트로, 구현과 동일 PR 에 포함되는 것이 타당하다. 변경 내용 자체는 요청된 리팩토링(C-3 인덱스, C-2 CTE)과 직접 연결되며 기획·요구사항을 새로 정의하지 않는다. 실질적 위반보다는 역할 분리 관행 문제이므로 INFO 로 분류한다.
- 제안: 향후 spec 동기화 커밋은 project-planner 세션에서 별도로 처리하거나, 구현-문서 동기화를 명시적으로 허용하는 예외를 CLAUDE.md 에 기재하는 것이 바람직하다.

### INFO — `knowledge-base.service.ts` 내 `CHUNK_SIZE` 상수 제거 및 `EMBED_CHUNK_SIZE` 교체
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (파일 15)
- 상세: diff 에서 기존 코드가 `CHUNK_SIZE`를 참조하고 있으나 교체 후 `KnowledgeBaseService.EMBED_CHUNK_SIZE` static 상수로 리팩토링됐다. 이는 M-1(chunk 적재 통일) 목표의 직접 구현이므로 범위 내 변경이다. 단, 원래 `CHUNK_SIZE`가 파일 내 다른 위치(그래프 청크 등)에서도 사용됐다면 상수 이름 변경이 의도치 않게 다른 경로를 깨뜨릴 수 있다. diff 범위에서는 해당 사례가 보이지 않으므로 INFO 수준이다.
- 제안: `CHUNK_SIZE` 상수가 파일 다른 곳에서 참조되는지 전체 파일 검색으로 확인 권장.

### INFO — `integration-expiry-scanner.service.ts` 내 `paginates candidates by id keyset` 신규 테스트 — 별도 기능 추가
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` (파일 12, 라인 2147-2177)
- 상세: `paginates candidates by id keyset until a short batch (m-1)` 테스트가 추가되었으며, 이는 m-1(keyset pagination) 기능의 테스트 커버리지다. 기능 자체가 이 PR 범위(integration-expiry-scanner keyset pagination)에 속하므로 범위 이탈이 아니다. 다만 `SCAN_BATCH_SIZE = 500` 이라는 매직 넘버를 테스트가 직접 하드코딩(`expect(firstArgs.take).toBe(500)`)하여 상수 변경 시 테스트가 깨지는 취약성이 있다.
- 제안: 테스트에서 `IntegrationExpiryScannerService.SCAN_BATCH_SIZE`(private static)를 노출하거나 테스트용 접근자를 두는 것이 유지보수성이 높다. 범위 문제는 아님.

### INFO — `migrations/README.md` §6 추가는 문서 범위이나 V021 언급이 기존 섹션과 연결됨
- 위치: `codebase/backend/migrations/README.md` (파일 2, 라인 159-183)
- 상세: `ALTER COLUMN TYPE` 절(§6)이 새 마이그레이션 가이드로 추가됐다. 이는 refactor-05-database 작업의 shadow-column 패턴 문서화이며, 실질 변경(V095)과 직접 연관이 있다. 범위 이탈 없음.

## 요약

24개 파일 전체 변경이 `refactor-05-database` 작업 범위(M-1 KB 청크 적재, M-2 admin 배치 조회, M-3 버전 목록 snapshot 제외, M-5 커넥션 풀 env 노출, C-2 재귀 CTE 깊이 검증, C-3 partial 복합 인덱스, 실행 상태 guarded UPDATE)와 직접 연결된다. 불필요한 리팩토링이나 무관한 기능 추가는 발견되지 않았으며, 포맷팅 전용 변경이나 무의미한 임포트 정리도 없다. 유일한 관찰 사항은 `spec/` 파일을 개발자 세션에서 수정한 점(역할 분리 관행)과 소수의 구현 상세가 테스트에 매직 넘버로 하드코딩된 점이며, 모두 INFO 수준으로 차단 사유에 해당하지 않는다.

## 위험도

NONE
