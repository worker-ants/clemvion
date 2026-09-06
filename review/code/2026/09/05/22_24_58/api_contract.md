# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules(/:id)` 응답의 `trigger` 필드가 **버전 신호 없이** 전체 `Trigger` 엔티티(비밀 컬럼 포함)에서 참조 4필드(`id`/`name`/`workflowId`/`workflow.name`)로 축소되는 breaking change다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `SchedulesController.toResponse()` (약 67~84행, `findAll`/`findOne`/`create`/`update` 4곳에서 사용) + `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` `ScheduleTriggerRefDto`/`ScheduleDto.trigger`.
  - 상세: 종전에는 `leftJoinAndSelect('s.trigger','t')`/`relations:['trigger']` 로 트리거 엔티티 전체(`type`·`config`·`authConfigId`·`isActive`·`notificationSecretV2`·`chatChannelTokenV2` 등)가 `trigger` 키 아래 그대로 실렸다. 이번 변경으로 4필드(+선택적 `workflow`)만 남는다. 이 백엔드는 URL 버전 접두(`/v1/` 등)를 쓰지 않으므로, 이 응답 형태 축소는 기존 클라이언트에게 API 버전 변경 없이 관측된다. 회전 secret 평문/ref 유출을 막는 정당한 보안 수정이고, CHANGELOG·FE 소비처(`schedules/page.tsx` 4곳) 실측 감사로 근거가 충분하며 e2e(`schedule-trigger.e2e-spec.ts` C-3 등)가 새 형태를 고정한다 — 판단 자체는 타당하다. 다만 FE 저장소 밖의 소비자(웹훅 리스너·서드파티 SDK·모바일 클라이언트 등)가 이 4필드 밖의 것을 읽고 있었는지는 이번 diff 범위에서 확인할 수 없고, 이 프로젝트에 API 버저닝·breaking-change 고지 채널이 없어 그런 소비자가 있었다면 무통보로 깨진다.
  - 제안: 코드 조치는 불요(보안 근거로 이미 팀 결정·문서화됨, 여러 리뷰 라운드에서 반복 확인됨). 다만 향후 "엔티티 전체 노출 → 참조로 축소" 류의 breaking change 가 또 생기면, CHANGELOG 뿐 아니라 API 계약 SoT(`spec/5-system/2-api-convention.md` 등)에도 이력을 남기는 관례를 검토할 것 — 현재는 CHANGELOG 가 사실상 유일한 breaking-change 고지 채널이다.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 가 FE 소비처 0곳인 내부 health 카운터임에도 공개 응답 계약에 노출이 유지된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` `IntegrationDto.consecutiveNetworkFailures` (`@ApiProperty({ example: 0 })`).
  - 상세: PR 자신의 인접 주석과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 체크박스가 "제거가 나은 후보이나 wire 변경이라 별도 항목" 이라고 이미 인정·추적 중이다 — 은닉된 확장이 아니라 "선언을 실제에 맞춘다" 는 이 PR 원칙에 맞는 최소 개입이다.
  - 제안: 조치 불요. 제거 시점에는 별도 CHANGELOG(breaking) 항목이 필요 — 이미 트래커에 그렇게 적혀 있다.

- **[INFO]** `ExportWorkflowDto.formatVersion` 이 required 로 선언돼 있지만 `POST /api/workflows/:id/export` 실제 응답은 이 필드를 방출하지 않는다 — 신설된 `allowMissing` 옵션으로 e2e 계약 대조에서만 면제된다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (`assertMatchesContract(..., { allowMissing: ['formatVersion'] })`), 옵션 정의는 `codebase/backend/src/shared/testing/response-contract.ts` `ContractCheckOptions.allowMissing`.
  - 상세: 이번 PR 이 새로 만든 갭이 아니라, §5.4 검증자를 이 엔드포인트로 처음 넓히면서 **기존에 있던** 문서-구현 드리프트가 드러난 것이다(주석이 가리키는 `spec/2-navigation/1-workflow-list.md` 의 "포맷 버전 협상은 미구현 (Planned)"). `allowMissing` 은 그 자체로 위험한 일반 메커니즘이다 — "문서가 약속했지만 구현이 안 지킨다" 는 뜻이라 실제 클라이언트가 이 필드를 신뢰하면 깨진다. 다만 이번 용례는 spec 의 기존 Planned 갭을 참조하는 주석과 함께 좁게 쓰였고, JSDoc 이 "더 좁게 써야 한다"고 자체 경고하며 갭을 닫으면 이 줄을 지우는 것이 완료 조건이라고 명시돼 있어 조용히 영구화될 위험은 낮다.
  - 제안: 조치 불요(이미 추적 중). `allowMissing` 사용처가 늘어나면 "spec Planned 갭 참조 필수" 관례가 실제로 지켜지는지 정적 검사 대상으로 승격하는 것을 고려.

## 검증 메모 (양성 확인 — 재작업 불필요)

- `TriggerDto.workflow`(선택적 참조) · `ScheduleDto.trigger.workflow`(선택적 참조) 도입으로, 이전 라운드에서 지적된 "목록/PATCH 경로에서 `workflow` 관계 엔티티 전체가 선언 없이 유출" 문제와 "`Object.assign(trigger, rest)` 가 `useDefineForClassFields` 로 인해 로드된 `name` 을 `undefined` 로 덮어써 응답에서 사라지는" 문제 둘 다 현재 소스에서 해소된 상태임을 직접 확인했다 (`triggers.service.ts` 636~641행의 `overrides.workflow = { id: wf.id, name: wf.name }`, 378~380행의 `Object.entries(rest).filter(([, v]) => v !== undefined)`).
- `SchedulesController.toResponse()` 는 `findAll`/`findOne`/`create`/`update` 4개 엔드포인트에 일관 적용되고, 목록 응답은 `{...page, data: page.data.map(toResponse)}` 형태로 페이지네이션 래퍼(`totalItems`/`page`/`limit`)를 보존한다 — 페이지네이션 계약 회귀 없음. `runNow`/`getPreview`/`previewExpression` 은 애초에 트리거 엔티티를 담지 않아 배선 누락이 아니다.
- `response-contract.ts` 의 `$ref`/`allOf`/`oneOf`/`anyOf` 재귀 하강(`descend`/`visitUnion`)이 최상위 키만 보던 종전 방식의 사각지대(중첩 DTO 안의 과다 노출, 예: 감사 로그의 `user` 26키 유출)를 구조적으로 닫는다. 순환 가드가 스키마 이름이 아니라 payload 객체 동일성 기준이라 자기참조 DTO 의 내부도 검사된다.
- `contractForDto` 의 실패 promise 캐시 축출(`.catch` → `contractCache.delete(Dto)` → rethrow)이 있어, 프로브 컨트롤러 부트스트랩이 일시 실패해도 이후 호출이 영구히 같은 에러를 반환하지 않는다 — 계약 검증 자체의 가용성 방어.
- 신규 선언 23개 필드 중 `required:false + nullable:true`(§5.4 가 응답 바디에서 금지하는 조합) 형태는 없다 — 전부 상시-존재형(`@ApiProperty`) 또는 키-생략형(`@ApiPropertyOptional`, `| null` 없음)이며, 정적 래칫(`EXPECTED_OPTIONAL_NULLABLE_DRIFT`)의 기존 78건에도 포함되지 않는다.
- `notificationSecretV2`/`chatChannelTokenV2`(회전 secret)는 새로 선언된 어떤 응답 DTO 에도 없다 — 스트립 목록과 DTO 선언이 서로 대칭적으로 어긋나지 않음을 확인.
- 이 PR 범위에서 요청 DTO(create/update 바디) 검증 로직 변경은 없다 — 전부 응답 DTO 선언·응답 정화 로직·테스트 배선이다. URL/경로 설계·인증(`@ApiBearerAuth`, `@Roles('editor')`) 도 기존 패턴을 그대로 유지하며 신규 엔드포인트는 없다.

## 요약

이번 diff 는 §5.4 응답-계약 검증자(`assertMatchesContract`/`contractForDto`)의 e2e 배선을 14개 엔드포인트로 넓히는 과정에서 실측으로 드러난 두 갈래 결함 — (1) 트리거 회전 secret 이 `GET/POST/PATCH /api/triggers` 와 `GET/POST/PATCH /api/schedules`(조인 경유) 로 유출되던 것, (2) 5개 DTO 23개 필드가 "실제로는 응답에 있는데 선언에는 없던" drift — 를 정정한다. 여러 리뷰 라운드를 거치며 응답 형식 일관성(엔티티-DTO 1:1 대조, 중첩 DTO 재귀 대조)과 페이지네이션·인증 배선이 모두 검증됐고, `useDefineForClassFields` 로 인한 `name` 필드 소실, `workflow` 관계 미선언 유출 같은 실제 계약 결함도 이번 라운드까지 정정된 상태를 직접 확인했다. API 계약 축에서 유일하게 남는 지점은 `GET/POST/PATCH /api/schedules` 의 `trigger` 필드가 버전 신호 없이 축소되는 breaking change 라는 점인데, 보안 결함 수정의 불가피한 부수효과로 FE 소비처 감사·CHANGELOG 문서화·e2e 고정까지 마쳐 실질 위험은 낮다. 나머지 두 INFO(`consecutiveNetworkFailures` 노출 유지, `formatVersion` allowMissing 우회)는 이 PR 이 새로 만든 문제가 아니라 검증자 확대로 드러난 기존 갭이며 plan 트래커에 이미 등재돼 별도 조치가 필요 없다.

## 위험도

LOW
