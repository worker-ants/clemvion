# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

---

## 발견사항

### 요약 (충돌 없음)

본 브랜치가 도입하는 신규 식별자는 다음 네 가지다:

1. **DB 컬럼** `execution.conversation_thread` (JSONB NULL, V084 마이그레이션)
2. **TypeScript 엔티티 프로퍼티** `Execution.conversationThread: ConversationThread | null`
3. **Rationale 섹션** `spec/conventions/conversation-thread.md §8.4`
4. **spec frontmatter 레퍼런스** `plan/in-progress/exec-park-durable-resume.md` (기존 plan 파일, 신규 참조 추가)

각 항목에 대한 분석:

---

### [INFO] `execution.conversation_thread` 컬럼명 — 기존 `conversationThread` in-memory 식별자와 표기 일치

- **target 신규 식별자**: `execution` 테이블의 `conversation_thread` JSONB 컬럼 (V084)
- **기존 사용처**: `ExecutionContext.conversationThread` (in-memory TypeScript 프로퍼티), `ConversationThreadService` 클래스명, `spec/conventions/conversation-thread.md` 파일명
- **상세**: DB 컬럼명(`conversation_thread`)은 기존 in-memory 타입 경로(`ExecutionContext.conversationThread`)와 snake_case vs camelCase 형태만 다를 뿐 동일 개념을 지칭한다. 이는 의도적 설계(TypeORM `@Column({ name: 'conversation_thread' })` → `.conversationThread` 매핑)이며 충돌이 아니다. 기존 `node_execution` 테이블에는 `conversation_thread` 컬럼이 없으며 (`output_data`, `interaction_data` 만 존재 — V004), `execution` 테이블에도 이 컬럼은 신규다. 이름 충돌 없음.
- **제안**: 현행 유지. 컬럼·프로퍼티명이 spec 전체에서 일관성 있게 사용됨.

---

### [INFO] `§8.4` Rationale 섹션 번호 — main 에는 §8.1~§8.3 만 존재

- **target 신규 식별자**: `spec/conventions/conversation-thread.md §8.4`
- **기존 사용처**: main 브랜치의 동일 파일에는 `§8.1` / `§8.2` / `§8.3` 이 존재하고 `§8.4` 는 없음
- **상세**: 연속 번호이므로 충돌 없음. 신규 추가가 올바르게 순서를 이어받는다.
- **제안**: 현행 유지.

---

### [INFO] V084 마이그레이션 버전 번호 — main 최고 버전 V083 과 연속

- **target 신규 식별자**: `V084__execution_conversation_thread.sql`
- **기존 사용처**: main 최고 버전은 `V083__execution_active_running_ms.sql`. `V084` 는 main 에 없음
- **상세**: 버전 번호 충돌 없음. 연속 버전이다.
- **제안**: 현행 유지.

---

### [INFO] `EH-DETAIL-06` 요구사항 ID 재사용 — 기존 정의와 의미 일치 확인

- **target 신규 식별자**: 본 브랜치 spec 변경이 `EH-DETAIL-06`을 "실행 이력 화면의 cross-node thread view 재구성(v2 잔존 과제)"으로 참조
- **기존 사용처**: `spec/2-navigation/14-execution-history.md` line 73에 `EH-DETAIL-06 | Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약 | 필수 | ✅` 로 이미 정의됨
- **상세**: 기존 `EH-DETAIL-06`은 "Preview 탭 UI" 요구사항으로 이미 ✅ 완료 상태다. 본 브랜치의 `conversation-thread.md`와 `ai-agent.md`는 이 ID를 "실행 이력 화면 cross-node thread view 재구성" 과제의 참조 용도로 사용한다. 이미 완료된 UI 요구사항 ID를 "v2 미래 과제"의 레이블처럼 혼용하면 다음 독자가 헷갈릴 수 있다. 단, 의미 확장이지 다른 의미로 재정의한 것은 아니며 — Preview 탭의 대화 내역 표시(기존 EH-DETAIL-06)와 그 내역을 구성하는 cross-node thread view 재구성 정책(v2 과제)은 동일 기능을 다른 레이어에서 설명하는 것이다. 실제 spec 변경도 `EH-DETAIL-06`의 정의 자체를 바꾸지 않으므로 충돌은 아니다.
- **제안**: `conversation-thread.md §7` / `ai-agent.md §12.10` 에서 `EH-DETAIL-06` 참조 시 "기존 EH-DETAIL-06(Preview 탭 UI)의 상세 thread view 재구성 정책" 임을 한 줄로 명시하면 혼동 여지를 줄일 수 있다. 강제 수정은 불필요.

---

## 요약

이번 브랜치(`exec-park-durable-resume`)가 도입하는 신규 식별자(`execution.conversation_thread` JSONB 컬럼, V084 마이그레이션, `conversation-thread.md §8.4`)는 기존 spec·코드베이스의 어떤 식별자와도 의미 충돌 없이 연속 번호로 추가된다. `execution` 테이블에는 해당 컬럼이 신규이며, 유사 이름인 in-memory `ExecutionContext.conversationThread`와는 ORM 매핑 관계로 의도된 연결이다. `EH-DETAIL-06`을 미래 과제 참조 용도로 재사용하는 패턴은 엄밀도가 약간 낮으나 의미 충돌은 아니다. 전체 위험도는 NONE이다.

## 위험도

NONE
