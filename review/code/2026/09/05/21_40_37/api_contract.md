# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules(/:id)` 응답의 `trigger` 필드가 **버전 없이(non-versioned)** 전체 `Trigger` 엔티티에서 4개 참조 필드(`id`/`name`/`workflowId`/`workflow.name`)로 축소되는 breaking change다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()` (약 67~83행, `findAll`/`findOne`/`create`/`update` 4곳에서 사용) 및 `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` `ScheduleTriggerRefDto`/`ScheduleDto.trigger`.
  - 상세: 종전에는 `leftJoinAndSelect('s.trigger', 't')` 로 트리거 엔티티 전체(`type`·`config`·`authConfigId`·`isActive`·`createdAt`·`updatedAt`·비밀 컬럼 등)가 `trigger` 키 아래 그대로 실렸다. 이번 변경으로 4필드만 남고 나머지는 조용히 사라진다. 이 프로젝트의 API 는 URL 버전 접두(`/v1/` 등) 를 쓰지 않으므로, 이 응답 형태 축소는 기존 클라이언트(그 4필드 밖의 것을 읽던 소비자가 있었다면)에게 **버전 신호 없이** 관측되는 breaking change 다. `notificationSecretV2`/`chatChannelTokenV2` 평문·secret-ref 유출이라는 실제 보안 결함을 막기 위한 불가피한 조치이고, CHANGELOG·`review/code/2026/09/05/18_23_02/RESOLUTION.md`(W9)·프런트엔드 소비처 4곳 실측 감사로 근거가 충분히 남아 있어 판단 자체는 타당하다. 다만 "API 계약" 축에서는 별도로 기록해 둘 필요가 있어 WARNING 으로 남긴다 — 이후 웹훅 소비자·외부 SDK·모바일 클라이언트 등 FE 저장소 밖의 소비자가 있었는지는 이번 diff 범위에서 확인할 수 없다.
  - 제안: 조치 불요(이미 보안 근거로 팀 결정 완료, 문서화됨). 다만 향후 유사한 "엔티티 전체 노출 → 참조로 축소" 패턴이 또 생기면, CHANGELOG 뿐 아니라 `spec/5-system/2-api-convention.md` 같은 API 계약 SoT 에도 breaking-change 이력을 남기는 것을 고려.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 가 프런트엔드 소비처 0곳인 내부 health 카운터임에도 선언·노출이 유지된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:160-161` (`@ApiProperty({ example: 0 }) consecutiveNetworkFailures: number;`).
  - 상세: PR 자신의 주석과 `plan/in-progress/spec-draft-nullable-notation-followups.md:446` 의 체크박스(`IntegrationDto.consecutiveNetworkFailures 노출 중단 검토`)가 이 필드를 "제거가 나은 후보지만 wire 변경이라 별도 항목" 이라고 명시적으로 인정하고 추적 중이다. 은닉된 확장이 아니라 "선언을 실제에 맞춘다" 는 이번 PR 원칙에 맞는 최소 개입이며, 실측(`consecutiveNetworkFailures: number` 컬럼, `nullable` 아님)도 정확하다.
  - 제안: 조치 불요. 제거 시점에는 별도 CHANGELOG(breaking) 필요 — 이미 트래커에 그렇게 적혀 있음.

- **[INFO]** `ExportWorkflowDto.formatVersion` 이 required 로 선언돼 있지만 실제 `POST /api/workflows/:id/export` 응답은 이 필드를 방출하지 않는다 — `allowMissing: ['formatVersion']` 으로 e2e 계약 대조에서만 면제된다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:429-442` (`assertMatchesContract(..., { allowMissing: ['formatVersion'] })`).
  - 상세: 이번 PR 이 새로 만든 갭이 아니라 §5.4 응답-계약 검증자를 이 엔드포인트로 처음 넓히면서 **기존에 있던** 문서-구현 드리프트가 드러난 것이다(주석이 가리키는 `spec/2-navigation/1-workflow-list.md` 의 "포맷 버전 협상은 미구현 (Planned)"). `allowMissing` 옵션 자체는 정당한 용례(spec 에 이미 Planned 로 적힌 갭)로 제한적으로 쓰였고, 갭을 닫으면 이 줄을 지우는 것이 완료 조건이라고 주석에 명시돼 있어 조용히 영구화될 위험은 낮다. 다만 이 필드를 신뢰하고 파싱하는 외부 클라이언트가 있다면 여전히 깨진다는 사실 자체는 남아 있다.
  - 제안: 조치 불요(이미 추적 중). `allowMissing` 오남용 방지를 위해, 향후 이 옵션을 쓰는 자리가 늘면 "spec Planned 갭 참조 필수" 관례가 실제로 지켜지는지 정적 검사 대상으로 승격하는 것을 고려.

## 검증 메모 (양성 확인 — 재작업 불필요)

아래는 결함이 아니라, 리뷰 과정에서 실측으로 확인해 별도 지적이 필요 없다고 판단한 항목이다.

- 이번 PR 이 5개 DTO(`TriggerDto`/`IntegrationDto`/`KnowledgeBaseDto`/`AlertRuleDto`/`ScheduleDto`)에 새로 선언한 23개 필드를 **해당 엔티티 컬럼 정의와 1:1로 대조**했다(`grep` 으로 각 엔티티의 `@Column` 타입·`nullable` 옵션 실측). `chatChannelHealth`/`notificationHealth` 는 DB `default: 'unknown'` + `nullable` 미지정(NOT NULL)이라 TS 논-널 타입과 일치, 나머지는 전부 `nullable: true` 컬럼 + `T | null` + `@ApiProperty({ nullable: true })` 로 일관되게 선언돼 있다. 불일치 없음.
- 새로 선언된 23개 필드 중 어느 것도 `required:false + nullable:true`(§5.4 응답 바디 금지 조합) 형태를 쓰지 않는다 — 전부 `@ApiProperty` 상시-존재형이거나(`ScheduleDto.trigger`, `workflow`) `@ApiPropertyOptional` + `| null` 없는 키-생략형이다. 새로 추가된 정적 래칫(`swagger-dto-contract-guard.ts` `findOptionalNullableResponseFields`)의 베이스라인 78건에도 이 23개 필드는 없다(직접 카운트: `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78개 항목 실측 일치, CHANGELOG 의 "78건" 서술과 부합).
- 트리거 응답 정화(`sanitizeForResponse`)가 `findAll`/`findOneDetail`/`create`/`update` 4개 서비스 경로 전부에 배선돼 있고, 이전 라운드에서 지적된 이중 순회 죽은 코드(`overrides[column] = undefined`)는 현재 코드에서 제거된 상태(단일 `delete` 루프만 남음)임을 실제 소스에서 확인했다.
- `SchedulesController.toResponse()` 는 목록(`findAll`)·단건(`findOne`)·생성(`create`)·수정(`update`) 4개 엔드포인트 전부에 적용되고, `runNow`/`getPreview`/`previewExpression` 은 애초에 `ScheduleRunNowResultDto`/`CronPreviewDto` 를 반환해 트리거 엔티티를 담지 않으므로 배선 누락이 아니다. 목록 응답은 `{...page, data: page.data.map(toResponse)}` 형태로 페이지네이션 래퍼(`totalItems`/`page`/`limit`)를 그대로 보존한다 — 페이지네이션 회귀 없음.
- `notificationSecretV2`/`chatChannelTokenV2`(회전 secret 두 컬럼)는 이번에 새로 선언된 어떤 DTO 에도 포함되지 않는다 — 스트립 목록과 DTO 선언이 서로 어긋나지 않음을 대조 확인.

## 요약

이번 diff 는 §5.4 응답-계약 검증자(`assertMatchesContract`/`contractForDto`)의 e2e 배선을 14개 엔드포인트로 넓히는 과정에서 실측으로 드러난 두 갈래 문제 — (1) 트리거 회전 secret 이 `GET/POST/PATCH /api/triggers` 와 `GET /api/schedules`(조인 경유) 로 유출되던 것, (2) 5개 DTO 23개 필드가 "실제로는 응답에 있는데 선언에는 없던" 드리프트 — 를 정정하는 작업이다. API 계약 관점에서는 응답 형식 일관성·요청/응답 스키마 정합성이 이번 라운드에서 뚜렷이 개선됐고(엔티티-DTO 1:1 대조로 새 선언 23건 전부 정확함을 확인, §5.4 forbidden-combo 래칫으로 78건의 기존 드리프트를 동결), 유일하게 계약 축에서 눈여겨볼 지점은 `GET/POST/PATCH /api/schedules` 의 `trigger` 필드가 버전 신호 없이 축소된 breaking change 라는 점인데 이는 보안 결함 수정의 불가피한 부수효과로 이미 FE 소비처 감사·CHANGELOG 문서화까지 마쳐 실질 위험은 낮다. 나머지 두 INFO(`consecutiveNetworkFailures` 노출 유지, `formatVersion` 미방출)는 모두 이번 PR 이 새로 만든 문제가 아니라 검증자 확대로 드러난 기존 갭이며 plan 트래커에 이미 등재돼 있어 별도 조치가 필요 없다.

## 위험도

LOW
