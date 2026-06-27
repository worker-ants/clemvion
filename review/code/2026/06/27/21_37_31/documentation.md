# 문서화(Documentation) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `WorkspaceInvitationsPrunerService` 공개 메서드에 JSDoc 독스트링 부재
  - 위치: `/codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` — `process()` (L278), `prune()` (L282)
  - 상세: 클래스 수준 JSDoc은 배경·설계 결정을 상세히 기술하여 훌륭하나, 공개 메서드 `process()`와 `prune()`에 독스트링이 없다. 두 메서드의 역할 분리(BullMQ 어댑터 vs 실제 prune 로직)가 IDE hover 문서에서 보이지 않는다.
  - 제안: `process()`에는 "BullMQ 워커 진입점 — prune()로 위임" 등 1줄 요약을, `prune()`에는 `@returns {Promise<void>}` 및 에러 swallow 정책을 JSDoc으로 추가.

### 발견사항 2
- **[INFO]** `WorkspaceInvitationsPrunerService` 추가에 대응하는 spec 문서 없음
  - 위치: `spec/` — 워크스페이스 초대 데이터 위생 관련 spec 섹션
  - 상세: 서비스 클래스 주석에서 "pruneExpired 헬퍼는 존재했으나 프로덕션 호출자가 없었다(데이터 위생 갭)"라고 명시하지만, 이 갭의 해소가 spec 문서(예: 워크스페이스 초대 spec)에는 반영되지 않았다. 스케줄(매일 04:00 Asia/Seoul)과 보존 정책(7일/30일)도 코드에만 존재한다.
  - 제안: 워크스페이스 초대 관련 spec에 "만료 초대 자동 정리" 섹션을 추가하고 스케줄·보존 정책을 단일 진실로 기록하는 것이 이상적이나, 운영 인프라 세부사항이므로 코드 주석만으로도 충분한 경우 INFO 수준 처리 가능.

### 발견사항 3
- **[INFO]** `UpdateTriggerDto.endpointPath` JSDoc과 ApiPropertyOptional description의 정보 비대칭
  - 위치: `/codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` L53 (JSDoc) vs L54-L60 (ApiPropertyOptional)
  - 상세: ApiPropertyOptional description에 "단, 생성 후 endpointPath 변경은 service가 거부한다"는 중요한 비즈니스 제약이 추가되었지만, 위 JSDoc(`/** Webhook 엔드포인트 경로 (v4 UUID) */`)에는 이 정보가 없다. Swagger UI에서는 보이지만 IDE hover에서는 보이지 않는다.
  - 제안: JSDoc을 `/** Webhook 엔드포인트 경로 (v4 UUID). 생성 후 변경은 service가 거부한다. */`로 확장하거나, 기존 ApiPropertyOptional description이 충분한 경우 현 수준도 허용 가능.

### 발견사항 4
- **[INFO]** `webhook-trigger.e2e-spec.ts` 테스트 B의 non-UUID 경로 의도 미설명
  - 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` — 테스트 B (`'no-such-path-xyz'` 사용)
  - 상세: 테스트 A에는 `// endpoint_path는 v4 UUID 형식 강제(W1)` 주석이 추가되었지만, 테스트 B는 non-UUID 경로(`'no-such-path-xyz'`)로 404를 기대한다. UUID 형식 강제 이후에도 DTO 검증을 거치지 않는 경로(hooks 수신 엔드포인트)에서 non-UUID path가 404를 반환하는 것이 의도된 동작임을 주석으로 명확히 하면 독자의 오해를 줄일 수 있다.
  - 제안: 테스트 B에 `// hooks 수신 경로는 DTO 검증 없음 — DB 조회 실패로 404 반환 (UUID 형식 강제는 CREATE/UPDATE DTO에서만)` 수준의 주석 추가.

---

## 긍정적 발견사항

다음 항목들은 문서화 관점에서 우수하다:

- **`endpointPath` DTO 문서**: `create-trigger.dto.ts`와 `update-trigger.dto.ts` 양쪽에서 JSDoc, ApiPropertyOptional description, format, example이 일관되게 갱신되었으며, 보안 배경(WH-SC-01·WH-MG-02 spec 참조)까지 기술됨.
- **`WorkspaceInvitationsPrunerService` 클래스 주석**: 설계 결정의 배경(데이터 위생 갭), 인프라 안전성(멀티 인스턴스), 부하 분산(03:00 vs 04:00) 등을 상세히 설명한 JSDoc이 매우 우수함.
- **`onModuleInit()` 인라인 주석**: `upsertJobScheduler` idempotency, scheduler ID 파생 규칙, `removeOnComplete`/`removeOnFail` 설정 이유가 명확히 설명됨.
- **`spec/5-system/12-webhook.md` WH-MG-02 업데이트**: 클라이언트 발급 + 서버 형식 강제의 역할 분리가 spec에 명문화됨.
- **e2e 파일 변경 주석**: `chat-channel-trigger-create.e2e-spec.ts`의 `uniqueEndpoint` 함수 변경 이유가 함수 바로 위에 명확히 설명됨.
- **테스트 describe 블록 주석**: `trigger-dto-validation.spec.ts`의 새 describe 블록에 보안 요구사항 배경(`W1 보안`, squatting/enumeration 방지)이 주석으로 기술됨.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. `endpointPath` UUID 강제의 보안 배경이 DTO 주석·ApiProperty·spec 문서 세 곳에 일관되게 반영되었고, 새로운 `WorkspaceInvitationsPrunerService`의 클래스 수준 JSDoc은 설계 결정의 배경과 인프라 고려사항을 충실히 담고 있다. 개선이 필요한 부분은 공개 메서드 `process()`/`prune()`에 대한 JSDoc 부재, workspace invitation pruning 정책의 spec 문서 미반영, `UpdateTriggerDto` JSDoc과 Swagger description 간 정보 비대칭 등이나 모두 INFO 수준이다. 현재 상태로 병합하더라도 운영상 혼란을 초래할 가능성은 낮다.

## 위험도

LOW
