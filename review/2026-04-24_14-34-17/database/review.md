## 발견사항

- **[INFO]** `auto_resumed` / `autoResumeReason` / `autoResumeAttempt` 동시성 제약 없음
  - 위치: `V020__assistant_message_auto_resume.sql`
  - 상세: `autoResumed=true`이면 `autoResumeReason`과 `autoResumeAttempt`가 반드시 non-null이어야 한다는 불변식이 DB 레벨에는 없고 애플리케이션에만 의존함
  - 제안: 선택적으로 CHECK 제약 추가 가능
    ```sql
    ADD CONSTRAINT chk_auto_resume CHECK (
      (auto_resumed = FALSE AND auto_resume_reason IS NULL AND auto_resume_attempt IS NULL)
      OR
      (auto_resumed = TRUE AND auto_resume_reason IS NOT NULL AND auto_resume_attempt IS NOT NULL)
    );
    ```

- **[WARNING]** 중간 row(`auto_resume_pending`) persist 후 스트림 실패 시 dangling row 발생 가능
  - 위치: `workflow-assistant-stream.service.ts` stall 복구 블록 (A)→(B)→(C) 순서
  - 상세: 중간 row persist → SSE 발행 → 다음 라운드 진행 → 최종 row persist 흐름이 트랜잭션으로 묶여있지 않음. 중간 persist 성공 후 LLM 연결 오류·서버 재시작 등이 발생하면 `finishReason='auto_resume_pending'`이고 대응하는 최종 row가 없는 고아 row가 남음. rehydrate 시 해당 row가 단독 버블로 렌더되며, 스트리밍 중 끊김으로 오인될 수 있음
  - 제안: 스트리밍 아키텍처 특성상 트랜잭션을 열어 둘 수 없으므로, rehydrate 시 `finishReason='auto_resume_pending'`인 row가 마지막 row이면 "중단된 세션" 표시를 추가하는 클라이언트 측 guard 보완을 검토

- **[INFO]** `planPersisted` 플래그는 애플리케이션 레벨 가드로만 존재
  - 위치: `workflow-assistant-stream.service.ts` `planPersisted` 변수
  - 상세: 동일 턴의 여러 row 중 plan 데이터가 첫 번째 row에만 기록된다는 보장이 DB에 없음. 서비스 버그 시 plan이 복수 row에 중복 저장될 수 있으며 이를 탐지할 DB 제약이 없음
  - 제안: 현재 규모에서 위험은 낮으나, `plan IS NOT NULL AND auto_resume_reason IS NOT NULL` 조합이 실제로 발생하지 않는지 모니터링 쿼리 추가 고려

- **[INFO]** `finish_reason` 컬럼에 `'auto_resume_pending'` 값 추가 (20자, 제한 30자 이내 ✅)
  - 위치: `workflow-assistant-message.entity.ts`
  - 상세: 기존 컬럼 길이 `VARCHAR(30)` 내에 들어오며, 열거형 제약이 없으므로 마이그레이션 없이 적용 가능

- **[INFO]** 마이그레이션 안전성 양호
  - 위치: `V020__assistant_message_auto_resume.sql`
  - 상세: PostgreSQL 11+ 기준 `ADD COLUMN ... NOT NULL DEFAULT FALSE`는 상수 기본값이므로 테이블 리라이트 없이 메타데이터만 변경됨(즉시 완료, 락 없음). nullable 두 컬럼 추가도 동일하게 안전. 기존 row는 `false / NULL / NULL` 기본값으로 자동 호환

---

### 요약

이번 변경은 `workflow_assistant_message` 테이블에 3개의 nullable/boolean 컬럼을 추가하는 순수 가산(additive) 스키마 확장이며, PostgreSQL 11+ 환경에서 무중단 배포에 안전하다. 마이그레이션 SQL은 기존 row 호환성을 보장하고, 엔티티–SQL 간 nullable/default 정합성도 일치한다. 주요 유의사항은 스트리밍 특성상 중간 persist 이후 연결 실패 시 고아 row(`finishReason='auto_resume_pending'`)가 남을 수 있다는 점이며, 이는 트랜잭션으로 해결하기 어려운 구조적 제약이므로 rehydrate 측 방어 로직을 보완하는 것이 현실적인 대안이다. DB 제약 관점에서는 `auto_resumed` 3개 필드의 co-presence 불변식을 CHECK 제약으로 선택적으로 보완할 수 있다.

### 위험도

**LOW**