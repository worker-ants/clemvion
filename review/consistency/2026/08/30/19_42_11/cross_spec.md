### 발견사항

없음.

target(`spec/data-flow/3-execution.md` §2.1 Postgres 표, `execution` 상태 전이 행)의 변경은
"결과 shape 가드가 throw 하면 이 UPDATE 도 함께 롤백된다" 는 1문장 추가뿐이며, 다음을 확인했다:

- **동시 갱신된 SoT 와 정합** — 같은 워킹트리에서 `spec/5-system/4-execution-engine.md` §1.1
  에도 "else 분기(직접 마감)도 트랜잭션 안에서 돈다 (2026-08-30)" 각주가 동시에 추가돼 있고,
  두 문서의 서술(트랜잭션 진입 사유·기존 짝 전이 트랜잭션과의 목적 차이·17일 창)이 완전히
  일치한다. target 이 참조하는 앵커 `../5-system/4-execution-engine.md#11-execution-상태`
  도 `### 1.1 Execution 상태` 헤딩과 정확히 대응한다 (같은 slug 패턴이 그 문서 안 다른
  링크에서도 반복 사용됨).
- **코드 diff 와 정합** — diff 는 `updateExecutionStatus` else 분기의 raw UPDATE 를
  `this.dataSource.transaction(...)` 로 감싸고, 공유 종결부 `finishStatusTransition` 을
  추출했다. `finalizeCancelledExecution`/`finalizeFailedExecution` (execution-engine.service.ts)
  은 모두 `updateExecutionStatus` 를 경유하므로 이 트랜잭션 래핑을 자동으로 상속하며, 두 함수의
  개별 재조회/스킵 로직과 충돌하지 않는다(재조회는 트랜잭션 커밋/롤백 이후 시점이라 안전).
- **인접 convention 문서와 충돌 없음** — `spec/conventions/node-cancellation.md` 는
  `updateExecutionStatus` 를 "공유 드라이버 메서드 한 곳" 으로 이미 서술하고 있고, 이번 트랜잭션
  래핑을 반박하는 서술이 없다. `spec/conventions/raw-query-results.md` 는 shape 불변식만 다루고
  트랜잭션/롤백을 언급하지 않아 stale 대조 대상이 아니다.
- **"트랜잭션 밖" stale 서술 없음** — `spec/**` 전체에서 "트랜잭션 밖" 을 언급하는 나머지 두
  곳(`data-flow/2-auth.md`, `data-flow/12-workspace.md`)은 각각 refresh-token/인덱스 마이그레이션
  이야기로 이번 execution 트랜잭션 래핑과 무관한 별개 도메인이다.
- **상태 머신·엔티티·API 계약·RBAC·큐 카탈로그 무변경** — 이번 변경은 기존에 이미 성립해 있던
  `status IN (non-terminal)` guarded UPDATE 를 트랜잭션 경계 안으로 옮긴 구현 디테일이며,
  `execution.status` 상태 다이어그램(§3.1)·전이 표·엔티티 필드·엔드포인트·이벤트 이름·RBAC 는
  target 문서에서 전혀 변경되지 않았다. 요구사항 ID 신규 부여도 없다(리뷰 티켓 표기
  `17_15_21`/`18_19_33` 등은 요구사항 ID 가 아니라 리뷰 세션 타임스탬프 태그).

### 요약

이번 target 변경(`spec/data-flow/3-execution.md` §2.1 한 줄 추가)은 `spec/5-system/4-execution-engine.md`
§1.1 의 동시 갱신 각주와 완전히 정합하고, 코드 diff(`updateExecutionStatus` else 분기 트랜잭션
래핑 + `finishStatusTransition` 공유화)가 실제로 구현한 내용을 정확히 반영한다. `node-cancellation.md`
· `raw-query-results.md` 등 인접 convention 문서, 그리고 이 UPDATE 를 경유하는 다른 종결 헬퍼
(`finalizeCancelledExecution`/`finalizeFailedExecution`)와도 모순되는 서술이 없다. 엔티티·API·상태
머신·RBAC·계층 책임 등 다른 관점에서도 이번 변경이 건드리는 표면이 없어 cross-spec 충돌 소지가
없다.

### 위험도
NONE
