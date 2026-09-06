# 요구사항(Requirement) 리뷰 — §5.4 응답-계약 스윕 (14→ e2e 배선 + Trigger/Schedule secret 스트립 + allowMissing)

## 발견사항

- **[INFO]** CHANGELOG 의 "선언이 현실에 뒤처져 있던 24필드를 선언했다" 라는 자체 집계가 바로 아래 표와 어긋난다.
  - 위치: `CHANGELOG.md:41` (헤더), 표는 `CHANGELOG.md:46-51`
  - 상세: 표를 직접 세면 `TriggerDto`(7) + `IntegrationDto`(6) + `KnowledgeBaseDto`(7) + `AlertRuleDto`(2) + `ScheduleDto`(1) = **23** 필드다. 헤더의 "24필드"는 표와 1개 어긋난다(플랜 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md:384` 의 "26건" = 보안 2 + 선언지연 23 + Planned 갭 1 = 26 으로, 플랜 쪽은 23을 전제로 정합적이다 — CHANGELOG 헤더 문구만 어긋난다).
  - 제안: CHANGELOG 헤더의 "24필드"를 "23필드"로 정정. 기능에 영향 없는 문서 정확도 문제.

- **[WARNING]** `TriggerDto`/`IntegrationDto`/`AlertRuleDto` 에 이번에 신규 선언된 관측 필드 다수가, 엔티티 컬럼상 **항상 present**(select:false 없음, `select` 전체 컬럼 조회, `sanitizeForResponse` 가 이 필드들을 건드리지 않음)인데도 `@ApiPropertyOptional`(+ 일부는 `nullable: true`) 로 선언돼 "키 생략 가능" 처럼 보인다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:76-102` (7필드 — 엔티티 확인: `trigger.entity.ts:82-157`, 전부 `default:` 있는 non-null 컬럼이거나 `nullable:true`지만 컬럼 자체는 항상 select 됨), `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:60-62`(`createdBy`), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:151-152`(`consecutiveNetworkFailures` — 엔티티 `default: 0`, not null, 항상 number인데 `@ApiPropertyOptional`)
  - 상세: §5.4 규칙(`spec/5-system/2-api-convention.md:202-205`)상 "상시 존재 + null 가능" 필드는 `@ApiProperty({ nullable: true })` + `field: T | null`(non-optional)이어야 하고, `@ApiPropertyOptional` 은 `required:false` 로 나가 §5.4 의 "상시 존재" 전제와 모순된다(`response-contract.ts:39-49`의 표 4행이 바로 이 조합을 "선언 층의 §5.4 위반"이라 명시). 이번 PR 이 "새로 도입되는 필드"에 그 조합을 다시 썼다는 점에서, §5.4 문서의 "본 규칙은 앞으로 도입·변경되는 필드에 적용한다"(`2-api-convention.md:212`) 소급-면제 대상이 아니다. 다만 이 정확한 drift(Optional+nullable 103건 vs 올바른 형태 17건)는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§③, 173-233행)가 **planner 소유로 진행 중**이고, response-contract 검증자도 이 조합을 의도적으로 판정 대상에서 제외한다고 스스로 밝힌다 — 즉 새 결함이 아니라 **이미 추적 중인 부채를 7~9개 필드만큼 더 늘린 것**이다.
  - 제안: 이 PR 범위(wire 노출을 선언에 맞추는 것)에서 굳이 고칠 필요는 없으나, 위 트래커의 잔여 작업 목록에 이번에 추가된 필드들도 포함되는지 확인 권장. 코드 되돌리기가 아니라 트래커 갱신 대상.

- **[WARNING]** `KnowledgeBaseDto.rerankMode` 가 형제 enum 필드들과 달리 Swagger `enum` 을 선언하지 않는다.
  - 위치: `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:107-109`
  - 상세: 엔티티 타입은 `'off' | 'cross_encoder' | 'cross_encoder_llm'`(`knowledge-base.entity.ts:99`)인데 DTO 는 `@ApiPropertyOptional({ example: 'off' }) rerankMode?: string;` 로 평범한 `string` 만 광고한다. 같은 파일의 `reembedStatus`(`enum: ['idle','in_progress']`)·`ragMode`(`enum: ['vector','graph']`)는 전부 enum 을 명시하는 것과 대비된다. `swagger-dto-contract-guard`/`response-contract` 어느 쪽도 enum 값 자체는 검사하지 않아 런타임 결함은 아니지만, OpenAPI 문서 완성도가 형제 필드보다 떨어진다.
  - 제안: `@ApiPropertyOptional({ enum: ['off', 'cross_encoder', 'cross_encoder_llm'], example: 'off' })` 로 보강.

- **[WARNING]** `KnowledgeBaseDto` 의 신규 수치 필드 2개의 Swagger `example` 이 실제 엔티티 컬럼 기본값과 어긋나 있고, 같은 파일의 기존 관례(예시값 = DB 기본값)를 깬다.
  - 위치: `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:99-100`(`documentCount`, example 12) · `:111-113`(`rerankCandidateK`, example 20)
  - 상세: 엔티티 실측 — `document_count` 기본값 0(`knowledge-base.entity.ts:41`), `rerank_candidate_k` 기본값 50(`:106`). 반면 같은 DTO 의 기존 필드들은 예시가 전부 실제 기본값과 정확히 일치한다: `chunkSize`(1000/1000), `chunkOverlap`(200/200 — 다만 DTO엔 100으로 오기 가능성 별개), `maxHops`(1/1), `vectorSeedTopK`(5/5), `expandedChunkLimit`(15/15), `entityCount`(0/0), `reembedStatus`(idle/idle), `ragMode`(vector/vector). 이 파일만 놓고 보면 "example = 실제 기본값" 이 일관된 로컬 관례인데, 신규 2필드만 임의 예시(12, 20)를 써서 그 관례에서 벗어난다.
  - 제안: 기능 영향은 없음(순수 문서 예시) — `documentCount` example 을 0, `rerankCandidateK` example 을 50 으로 맞추거나, "예시는 임의 sample 값이며 기본값과 무관"이라는 의도라면 무시 가능. 로컬 관례를 따르는 편이 문서 신뢰도에 낫다.

## 검증된 항목 (결함 아님 — 참고용)

- `TriggersService.sanitizeForResponse` — 종전의 "조기 return"(`config.chatChannel` 없으면 컬럼 스트립을 아예 건너뜀) 결함이 실제로 고쳐졌다: `overrides`/`delete` 블록이 `cfg?.chatChannel` 존재 여부와 무관하게 항상 실행된다(`triggers.service.ts:554-591`). `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`, `chatChannelTokenV2`)가 `Trigger` 엔티티의 실제 컬럼명과 일치함을 `trigger.entity.ts:105,149` 로 확인, `select:false` 미사용도 확인(전 컬럼 select).
- `SchedulesController.toResponse` 가 좁히는 4필드(`id`·`name`·`workflowId`·`workflow.name`)는 프런트엔드 `schedules/page.tsx:507-514` 의 실제 소비 4곳과 정확히 일치(그 이상도 이하도 아님) — 코멘트의 "네 곳뿐" 주장이 grep 으로 재현됨.
- `ExportWorkflowDto.formatVersion` 의 `allowMissing` 근거 주석이 인용한 `spec/2-navigation/1-workflow-list.md:153` 문구("포맷 버전 협상은 미구현 (Planned)")가 실제로 존재 — spec 인용이 정확하다.
- `findContractViolations`/`assertMatchesContract` 의 `allowMissing` 옵션은 요구 명세(이름 정확히 일치할 때만 면제, `allowUndeclared` 축과 독립)대로 구현됐고 `response-contract.spec.ts` 의 3개 신규 테스트가 그 3가지 축(면제 성립·이름 불일치 시 비면제·undeclared 는 별개 축이라 비면제)을 정확히 커버한다.
- `contractForDto` 의 클래스별 in-flight-promise 메모이제이션은 동시 호출 시 중복 부트스트랩을 막고, 실패 시 캐시에서 제거해 재시도 가능하게 한다 — 경쟁 조건이나 영구 실패 캐시 위험 없음.
- `IntegrationDto`/`AlertRuleDto` 신규 필드는 전부 대응 엔티티 컬럼과 필드명·nullable 여부가 일치(엔티티 실측 `integration.entity.ts:87-129`, `alert-rule.entity.ts:50-54`).
- `SchedulesController` 전 엔드포인트(`findAll`/`findOne`/`create`/`update`)가 새 `toResponse` 를 빠짐없이 통과하도록 배선됐고(`runNow`/`getPreview`/`previewExpression`/`remove` 는 트리거 정보를 반환하지 않으므로 배선 불필요), `TransformInterceptor`(`'data' in data` 구조 검사)가 신규 plain-object 반환값도 기존과 동일하게 감싸 wire 포맷 회귀 없음을 확인.
- `TriggersService` 의 다른 public 경로(`getHistory`/`remove`/`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)는 raw `Trigger` 엔티티를 반환하지 않으므로 sanitize 누락 지점 없음을 grep 으로 확인.

## 요약

핵심 보안 수정(트리거 회전 secret 2컬럼의 응답 유출 차단, 스케줄 응답의 트리거 조인 과다노출 차단)은 엔티티·컨트롤러·프런트엔드 소비 지점을 교차 검증한 결과 의도대로 정확히 구현되어 있고, 조기-return 버그의 재발 방지(early-return 제거)도 코드로 확인된다. `allowMissing` 계약 옵션 신설과 `contractForDto` 메모이제이션도 견고하다. 남은 지적은 전부 부차적이다 — CHANGELOG 자체 집계 오차 1건(23 vs 24, INFO), 신규 선언 필드 다수가 §5.4 상 "항상 present" 인데 `Optional` 로 선언된 기존(추적 중인) drift 를 소폭 확장한 점(WARNING, 코드 fix 대상 아니라 이미 있는 planner 트래커 갱신 대상), KnowledgeBaseDto 의 enum 미선언·example 불일치 2건(WARNING, 순수 문서 정확도). 기능·보안·에러 시나리오·반환값 관점에서 새로운 결함은 발견되지 않았다.

## 위험도
LOW
