### 발견사항

- **[INFO]** `loginHistory.record()`가 메인 트랜잭션 외부에서 독립 커밋됨
  - 위치: `auth.service.ts` — `registerWithInvitation`, `verifyEmail` 등 `dataSource.transaction()` 블록 이후 호출부
  - 상세: refresh_token INSERT(트랜잭션 내)와 login_history INSERT(auto-commit)가 별도 connection에서 각각 커밋된다. 서버가 두 커밋 사이에 중단되면 refresh_token은 존재하지만 audit row는 없는 상태가 발생한다. 설계상 의도된 best-effort 감사 로그이므로 허용 범위.
  - 제안: 현재 구조(record() 내 예외 swallow)를 유지하되, `login-history.service.ts` JSDoc에 "best-effort, not transactional" 문구를 명시해 후속 개발자에게 의도를 전달하는 것을 권장.

- **[INFO]** 실패 경로(login_failed)에서 `await record()` 후 예외 throw — 응답 latency 소폭 증가
  - 위치: `auth.service.ts:login()` — `USER_NOT_FOUND`, `ACCOUNT_LOCKED`, `EMAIL_NOT_VERIFIED` 등 다수 경로
  - 상세: 변경 전에도 DB write는 발생했으나 awaiting하지 않아 응답 latency에 포함되지 않았다. 이제 각 실패 경로마다 ~1–5 ms의 추가 지연이 생긴다. 동시에 대량의 잘못된 로그인 시도가 들어오면 login_history 테이블에 write I/O 부하가 집중될 수 있다.
  - 제안: 현재 규모에서는 수용 가능. 트래픽이 증가할 경우 login_history INSERT를 큐(예: Bull/BullMQ)로 분리하는 비동기 아키텍처를 고려.

- **[INFO]** cursor 기반 페이지네이션 — row value 비교 인덱스 확인 필요 (기존 코드, diff 외)
  - 위치: `login-history.service.ts:findForUser()` — `(lh.created_at, lh.id) < (:cursorTs, :cursorId)`
  - 상세: PostgreSQL의 row value 비교는 `(user_id, created_at DESC, id DESC)` 복합 인덱스가 없으면 seq scan으로 fallback된다. 이번 diff의 변경 사항은 아니지만 login_history 테이블이 커질수록 문제가 됨.
  - 제안: 마이그레이션에 `CREATE INDEX ... ON login_history (user_id, created_at DESC, id DESC)` 존재 여부를 확인하고, 없다면 추가.

---

### 요약

이번 변경의 핵심(`void` → `await`)은 DB 정합성 관점에서 올바른 수정이다. TypeORM connection pool 환경에서 INSERT가 커밋되기 전에 다른 connection의 SELECT가 실행될 수 있는 read-after-write race를 HTTP 응답 경계 안으로 INSERT를 당겨옴으로써 해소했다. `record()` 내부의 예외 swallow 구조 덕분에 `await`로 바꿔도 인증 흐름의 실패 경로가 새로 생기지 않는다. 트랜잭션 범위는 변경이 없으며, login_history는 여전히 best-effort 감사 로그로 동작한다. 실질적인 DB 위험은 없고, cursor 페이지네이션용 복합 인덱스 존재 여부 확인만 선제적으로 점검할 가치가 있다.

### 위험도
**LOW**