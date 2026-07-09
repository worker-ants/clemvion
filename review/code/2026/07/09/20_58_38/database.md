### 발견사항

이번 변경(diff)은 `spec/7-channel-web-chat/3-auth-session.md`, `spec/conventions/conversation-thread.md` 두 마크다운 스펙 문서에 대한 서술 갱신뿐이며, 실제 DB 스키마·쿼리·마이그레이션·ORM 코드(.ts, .sql 등)는 포함되지 않는다. `git diff --stat`(origin/main...HEAD) 확인 결과 이번 브랜치 전체에서도 `codebase/**` 변경은 없고 `spec/**`·`review/**`만 수정됐다. 즉 `Execution.conversation_thread jsonb` 컬럼(V084)과 이를 읽는 `InteractionService.getStatus()`(`codebase/backend/src/modules/external-interaction/interaction.service.ts`)는 이번 diff 이전에 이미 구현·병합된 기존 코드이고, 이번 변경은 그 기존 동작을 스펙 문서에 소급 반영(§8.4 "소비처 갱신")한 것뿐이다.

- **[INFO]** 문서화 대상 기존 구현의 참고 관찰(이번 diff 범위 밖, 비차단)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:239-241` (`getStatus()`), `codebase/backend/src/modules/executions/entities/execution.entity.ts:164-165`
  - 상세: `getStatus()`가 `executionRepository.findOne({ where: { id } })`로 컬럼 projection 없이 execution row 전체를 조회한다. `conversation_thread`는 최대 `STORAGE_MAX_TURNS=500` turn(각 turn 최대 `MAX_TURN_TEXT_CHARS=4000`자)까지 누적 가능한 jsonb 컬럼이라, 공개 REST 엔드포인트(`GET /api/external/executions/:id`)가 폴링될 때마다 이 대형 blob이 매번 함께 fetch된다(응답 payload에는 `waiting_for_input` 상태일 때만 동봉되지만, DB fetch 자체는 상태 무관하게 select-all이다). 이는 이번 diff가 만든 문제가 아니라 사전 존재하던 구현이며, spec 문서(§8.4·§R17)에도 "getStatus가 durable 스냅샷을 동봉"한다고 이미 정합적으로 기술돼 있다.
  - 제안: 이번 diff 범위에서 조치 불필요. 향후 위젯의 재로드 폴링 빈도가 늘거나 대화가 길어지는 프로덕션 트래픽 패턴이 관측되면, `status`가 `waiting_for_input`이 아닐 때는 `select`로 `conversation_thread` 컬럼을 제외하는 2단계 조회(우선 status만 얇게 조회 → waiting인 경우만 컬럼 포함 재조회, 또는 QueryBuilder `.select([...])`)를 검토할 것을 코드 리뷰 담당(backend/performance 트랙)에 참고로 남긴다.

이번 diff 자체에는 인덱스·N+1·트랜잭션·마이그레이션·스키마 설계·커넥션 관리·SQL 인젝션·페이지네이션 관점에서 지적할 코드 변경이 없다(신규 컬럼·쿼리·트랜잭션 경계 변경 없음).

### 요약
리뷰 대상 diff는 실제 데이터베이스 코드(스키마 마이그레이션, 쿼리, ORM 레이어) 변경을 포함하지 않는 순수 스펙 문서 갱신이며, 기존에 이미 구현·배포된 `Execution.conversation_thread jsonb`(V084) 컬럼과 `getStatus()` REST 소비 동작을 문서에 소급 반영한 것이다. DB 설계상 새로운 위험 요소는 도입되지 않았고, 참고용으로 기존 구현의 select-all fetch 패턴(비차단 INFO)만 기록해 둔다.

### 위험도
NONE

STATUS=success ISSUES=0
