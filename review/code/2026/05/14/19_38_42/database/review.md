## 발견사항

변경된 47개 파일 중 실제 데이터베이스와 직접 관련된 변경은 `spec/1-data-model.md`와 `spec/5-system/4-execution-engine.md` 두 파일에 한정됩니다. 나머지(테스트 픽스처, 일관성 검토 산출물, 기타 spec/plan 문서)는 DB와 무관합니다.

---

### **[WARNING]** `interaction_data.interactionType` enum 값 변경 — 기존 데이터 마이그레이션 여부 미명시

- **위치**: `spec/1-data-model.md` — `interaction_data` JSONB 컬럼 정의
- **상세**: `"form_submit"` → `"form_submitted"` 로 enum 문자열 값이 변경되었습니다. `interaction_data`는 JSONB 컬럼이므로 DB 스키마 레벨의 enum constraint가 없어 DDL 마이그레이션은 불필요하지만, **이미 저장된 `NodeExecution` 레코드**의 `interaction_data.interactionType` 값이 `"form_submit"`으로 남아 있다면 이력 조회 API 응답 및 실행 이력 UI에서 enum 불일치가 발생합니다. 이 변경이 "spec 문서 표기 동기화만"인지 (코드가 이미 `form_submitted`를 생성 중), 아니면 기존 row에 대한 one-off data migration도 수반하는지 spec에 명시되어 있지 않습니다. `plan/in-progress/conversation-thread.md`의 plan_coherence 리뷰(파일 38)도 동일 문제를 INFO-2로 지적하고 있습니다.
- **제안**: 구현 착수 전 `SELECT DISTINCT interaction_data->>'interactionType' FROM node_execution WHERE interaction_data IS NOT NULL` 쿼리로 실제 저장된 값을 확인해야 합니다. 기존 데이터에 `"form_submit"`이 존재하면 `UPDATE node_execution SET interaction_data = jsonb_set(interaction_data, '{interactionType}', '"form_submitted"') WHERE interaction_data->>'interactionType' = 'form_submit'` 형태의 배치 마이그레이션 스크립트가 필요합니다. spec에 "코드가 이미 `form_submitted` 생성 중이므로 spec-only 정정" 또는 "기존 row 마이그레이션 필요"를 명시해야 합니다.

---

### **[INFO]** `conversationThread` — 별도 DB 컬럼 미신설 (설계 검토)

- **위치**: `spec/5-system/4-execution-engine.md` §6.2 저장 전략
- **상세**: ConversationThread 를 `NodeExecution.output_data` 의 분산 SoT(`output.interaction`, `output.messages`, `output.result.response`)로 재구성하는 설계 선택은 신규 DB 마이그레이션이 불필요해 zero-downtime 관점에서 안전합니다. Redis에는 실행 중 `ExecutionContext.conversationThread`로 보관되고, 실행 완료 시 기존 PostgreSQL NodeExecution 레코드에 흡수됩니다. 다만 실행 이력에서 ConversationThread를 재구성하려면 **여러 NodeExecution row의 JSONB를 순서대로 읽어 조립**해야 하므로, 워크플로우 규모에 따라 재구성 쿼리가 N+1 패턴으로 변질될 수 있습니다. v2 이후 실행 이력 뷰에서 크로스노드 thread 조회가 필요해질 경우 `execution_id` + `started_at` 복합 인덱스 또는 별도 `conversation_thread_snapshot` 테이블이 필요할 수 있습니다.
- **제안**: v1 범위에서는 현 설계(인덱스 추가 없음)가 수용 가능합니다. v2 UI spec 설계 시 thread 재구성 쿼리 패턴을 미리 분석해 인덱스 전략 또는 별도 테이블 신설 여부를 결정하는 것이 권장됩니다.

---

## 요약

DB와 직접 관련된 변경은 `spec/1-data-model.md`의 JSONB 필드 내 enum 문자열 값 수정(`form_submit` → `form_submitted`) 하나입니다. DDL 스키마 변경이 없어 무중단 배포 리스크는 없지만, 기존 저장 데이터에 `"form_submit"` 값이 존재할 경우 이력 조회 시 불일치가 발생할 수 있으며 이에 대한 데이터 마이그레이션 필요 여부가 spec에 명시되지 않은 것이 유일한 주의 사항입니다. ConversationThread 설계 자체(신규 DB 컬럼 없음, Redis + 기존 JSONB 재사용)는 DB 관점에서 안전한 선택입니다. 테스트 파일 및 나머지 문서 변경은 데이터베이스와 무관합니다.

## 위험도

**LOW**