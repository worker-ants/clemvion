# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `ExportWorkflowDto.formatVersion` 이 OpenAPI 계약상 **required** 로 선언돼 있지만, 실제 `POST /api/workflows/import` 상대편인 export 응답(`GET .../export` 계열)은 이 필드를 emit 하지 않는다. 이번 diff 는 이 갭을 **고치지 않고** e2e 테스트에서 `allowMissing: ['formatVersion']` 으로 우회 처리한다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:137-138` (`@ApiProperty({ example: 1 }) formatVersion: number;`, `required:false` 없음 → §5.4 기본형=required) · `codebase/backend/test/workflow-crud.e2e-spec.ts:436-440` (`allowMissing: ['formatVersion']` 및 그 사유 주석).
  - 상세: `assertMatchesContract` 호출부 자체가 "DTO 는 required 라고 선언하는데 구현이 아직 안 지킨다" 는 사실을 명시적으로 인정하고 있다(`allowMissing` 옵션의 JSDoc 도 "문서가 약속한 것을 구현이 아직 안 지킨다는 뜻이라 소비자가 실제로 깨진다"고 스스로 적는다, `response-contract.ts:104-111`). 이 필드는 이 PR 이 새로 만든 갭이 아니라 기존 상태를 이번에 처음으로 정식 문서화·테스트로 포착한 것이지만, **퍼블릭 OpenAPI 스펙을 신뢰하는 외부 클라이언트(코드젠 등)** 입장에서는 여전히 실제 계약과 문서가 어긋난 상태다.
  - 제안: 이미 `spec/2-navigation/1-workflow-list.md` 에 Planned 로 추적 중이므로 즉시 조치는 불요하나, 그 스펙 갭을 닫는 PR 에서 DTO 를 `@ApiPropertyOptional` 로 내리거나 구현이 필드를 채우도록 해서 `allowMissing` 을 제거하는 것을 완료 조건으로 유지할 것(코드 주석에 이미 명시돼 있음 — 재확인만).

- **[INFO]** `ScheduleDto.trigger` / `TriggerDto.workflow` 가 이전에는 조인된 엔티티 전체(비밀 컬럼 포함, 선언조차 없던 상태)를 그대로 실어 보내다가 이번 PR 에서 참조 수준(3~4개 필드)으로 **축소**됐다. 이는 응답 wire 형태의 실질적 축소(breaking change)다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67-84` (`toResponse()`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:15-47`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:17-25`.
  - 상세: 이 저장소는 URL 경로에 버전 세그먼트(`/v1/` 등)를 쓰지 않는 unversioned REST 구조라, 이런 축소는 API 버전으로 흡수되지 않고 곧바로 기존 클라이언트에 영향을 줄 수 있다. 다만 (1) 원래 응답이 문서화되지 않은 채 비밀 컬럼까지 새고 있던 보안 결함의 시정이고, (2) CHANGELOG(`Unreleased — 트리거 회전 secret...`)에 영향 범위·소비자 권고까지 상세히 기록돼 있으며, (3) 축소 자체가 이전 리뷰 라운드에서 이미 "breaking change" 로 지적·처분된 항목(`RESOLUTION.md` WARNING#6 "조치 불요 — 이전 라운드에서 처분·문서화됨")이라 이번 라운드에서 새로 제기할 사안은 아니다. 정보로만 남긴다.
  - 제안: 조치 불요. 향후 유사한 필드 축소가 생기면 이번처럼 CHANGELOG 에 영향받는 소비처·행동 지침을 명시하는 패턴을 유지할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` — 프런트엔드 소비처가 0곳인 내부 health 카운터가 공개 응답 DTO 에 그대로 선언된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:153-161`.
  - 상세: PR 자신의 주석과 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고 이미 인정하고 있다. 응답 계약 관점에서 내부 구현 디테일이 공개 API 표면에 노출되는 것은 결합도를 높이지만(향후 이 카운터의 의미·타입을 바꾸면 API 소비자에게 영향), 스코프 판단이 스스로 문서화돼 있어 은닉된 확장은 아니다.
  - 제안: 조치 불요 — 별도 트래커 항목에서 wire 변경으로 다룰 것.

- **[INFO]** 비밀 필드 스트립이 3개의 수기 관리 allow-list 상수(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`, `NOTIFICATION_SIGNING_STRIP_KEYS`, `INTERACTION_RESPONSE_STRIP_KEYS`, `TRIGGER_RESPONSE_STRIP_COLUMNS`)에 의존한다. 이 PR 자신의 JSDoc 이 "세 번 같은 형태로 좁았다"(같은 등급 비밀을 세 곳에 나눠 두다가 매번 한 축씩 빠뜨림)고 기록하고 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse` JSDoc(§"왜 세 목록인가" 단락) 및 4개 상수 선언부.
  - 상세: 응답 계약 관점에서 이런 hand-maintained allow-list 는 신규 secret 필드가 엔티티에 추가될 때 응답 스트립 목록 갱신을 잊으면 다시 같은 클래스의 계약 위반(선언되지 않은 민감 키의 wire 노출)이 재발할 구조적 위험을 안고 있다. PR 은 이를 인지하고 있고("다음에 비밀 축이 하나 더 생기면 목록을 늘리지 말고 선언적 SoT 로 옮길 것") §5.4 정적 래칫 + e2e 뮤테이션 회귀로 완화했으므로 이번 PR 범위에서 차단 사유는 아니다.
  - 제안: 조치 불요(이번 PR 범위). 다음에 유사 패턴이 재발하면 `@Sensitive()` 데코레이터 등 선언적 SoT 로의 승격을 고려할 것 — PR 자신의 코멘트가 이미 이 조건을 적어 두었다.

## 요약

이번 변경은 §5.4 응답-계약 검증자(`assertMatchesContract`/`contractForDto`)의 배선을 14개→18개 이상의 엔드포인트로 넓히면서, 그 과정에서 실측으로 드러난 API 계약 위반(선언되지 않은 채 wire 로 새던 트리거 회전 secret 2종 및 5개 DTO 24개 필드의 선언 누락)을 실제로 정정한다. 컨트롤러(`SchedulesController.toResponse`)와 서비스(`TriggersService.sanitizeForResponse`) 양쪽에서 조인된 엔티티를 참조 수준으로 좁혀 최소 노출 원칙에 맞췄고, `PATCH` 응답에서 필드가 조용히 사라지던 회귀(`Object.assign` 의 `undefined` 덮어쓰기)도 함께 고쳤다. 요청 검증·URL 설계·페이지네이션·인증/인가 로직에는 변경이 없고, 4개 `GET/POST/PATCH` 경로 모두가 새 응답 경계를 빠짐없이 통과하도록 배선돼 있음을 확인했다(`schedules.controller.ts` 전수 검토). 남은 지적은 이번 PR 이 새로 만든 문제가 아니라 기존에 존재하던 갭(`ExportWorkflowDto.formatVersion` required-but-unimplemented)과 이미 문서화·이월 처리된 스코프 판단(트리거/스케줄 응답 축소, 내부 카운터 노출)에 대한 재확인 성격의 관찰이다.

## 위험도

LOW
