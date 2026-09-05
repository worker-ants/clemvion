# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 설명 주석 블록이 4개 응답 DTO 파일에 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-61`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-124`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-99`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:98-104`.
  - 상세: 코드 중복이 아니라 설명 주석(§5.4 스윕 경위 서사)의 중복이라 당장 기능 위험은 없다. 다만 이 서사를 나중에 정정할 필요가 생기면(예: 스윕 회차·근거가 바뀌는 경우) 4곳을 grep 으로 찾아 손으로 동기화해야 한다 — 실제로 이 PR 자체가 여러 라운드에 걸쳐 "한 곳만 고치고 자매를 놓치는" 패턴을 반복했던 이력이 있다(트리거 회전-secret 3연속 누락, `sanitizeForResponse` JSDoc 이중화 등, 전부 후속 라운드에서 해소됨). 각 DTO 파일이 FE 소비 근거처럼 파일별로 다른 정보도 함께 담고 있어 완전한 추출은 어렵고, "스펙/근거는 해당 문서에 자기완결적으로" 라는 프로젝트 관례와도 부합하므로 즉시 조치를 요구할 사안은 아니다.
  - 제안: 조치 불필요. 다음에 이 서사(§5.4 스윕 경위)를 정정할 일이 생기면 4곳 전체를 `grep -rl "이미 응답에 실려 나가고 있었다"` 로 찾아 동기화할 것.

## 검증한 항목 (문제 없음 확인)

이 PR 은 7라운드의 코드 리뷰 + 4라운드의 consistency 리뷰를 거치며 문서화 결함(JSDoc-대상 분리 재발 4~5회, `sanitizeForResponse` 신구 JSDoc 이중 잔존, `contractForDto` 캐시 격리 단위 오기술, `ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` 의 "update() 도 workflow 를 로드하지 않는다" 는 틀린 서술, `SchedulesController.toResponse()` 인라인 주석이 DTO 정정을 못 따라간 stale 서술, plan 트래커의 "23필드가 금지 조합" 합산 오류 등)을 반복적으로 지적받고 그때마다 실제로 바로잡은 이력이 있다. 이번 최종 상태를 직접 열어 다음을 재확인했다 — 전부 이미 정정되어 있다:

- `codebase/backend/src/modules/schedules/schedules.controller.ts:74` (`toResponse` 인라인 주석): "생성 응답에만 없다" 로 정정된 상태 — `review/code/2026/09/05/23_30_00` documentation WARNING 이 지적한 stale 서술이 마지막 커밋(`30b0f60b6`)에서 해소됨.
- `codebase/backend/src/modules/triggers/triggers.service.ts`: `TRIGGER_RESPONSE_STRIP_COLUMNS`·`NOTIFICATION_SIGNING_STRIP_KEYS`·`INTERACTION_RESPONSE_STRIP_KEYS`·`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 4개 상수 모두 JSDoc 이 각자 대상 선언 바로 위에 붙어 있음. `sanitizeForResponse` 도 단일 JSDoc 블록만 남아 있고(신구 이중화 해소), `overrides[column] = undefined` 죽은 루프도 제거되어 `delete` 루프 하나만 남음.
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:findOptionalNullableResponseFields`: `@param`/`@returns` 를 포함한 완전한 JSDoc 이 붙어 있음(직전 라운드가 "무주석" 으로 지적했던 상태에서 갱신됨).
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`: 모든 JSDoc 블록이 대상 `describe` 바로 위에 위치.
- `codebase/backend/src/shared/testing/response-contract.ts`: `contractForDto` 의 캐시 격리 단위 서술이 "파일" 로 정정되어 있고 실제 구현(`Map<Type, Promise<DtoContract>>`, 실패 시 캐시 제거)과 일치.
- CHANGELOG.md 의 정량 서술(`78건`, `23필드`, `14개 엔드포인트`)을 각각 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 길이(실측 78), DTO 별 필드 표 합계(7+6+7+2+1=23), `test/**` 의 `contractForDto` 신규 호출 DTO 종류 수(실측 14)와 대조해 전부 일치 확인. `allowMissing: ['formatVersion']` 이 인용하는 `spec/2-navigation/1-workflow-list.md:153` 문구도 실제로 존재.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`: 미착수/완료 서술 오기(§5.4 drift 2단계 메모이제이션)·정량 합산 오류(23 vs 17+6)·인계 완료 표기가 모두 실측 근거와 함께 정정되어 있고, planner 트랙으로 넘겨야 하는 항목(nav-spec 포인터, 정적 가드 `code:` 등재)은 정확히 planner 항목으로만 등재되고 developer 가 spec 을 직접 건드리지 않았음(권한 경계 준수).

## 요약

`sweep-response-contract` 워크트리는 응답-계약 검증자(§5.4)의 배선을 4→18개 DTO 로 넓히는 과정에서 드러난 트리거 회전-secret 유출 2건과 23개 필드의 선언 지연을 함께 고쳤다. 문서화 관점에서 이 최종 diff 는 이례적으로 자기 서사가 정확하다 — CHANGELOG·DTO JSDoc·plan 트래커의 모든 정량 주장을 코드·테스트 실물과 대조했고 전부 일치했으며, 여러 라운드에 걸쳐 반복 재발했던 "JSDoc-대상 분리"·"stale 인라인 주석"·"신구 JSDoc 병존" 패턴은 이번 최종 커밋에서 전부 해소된 상태로 확인된다. 유일하게 남은 항목은 4개 DTO 파일에 걸친 설명 주석 블록의 문자 그대로의 반복인데, 이는 기능·정확성 문제가 아니라 향후 유지보수 비용(4곳 동기화 필요) 관찰에 그치며 프로젝트의 "문서는 해당 파일에 자기완결적으로" 관례와 상충하지 않는다. README·API 문서·환경변수 문서 관점에서는 이 PR 이 wire 를 바꾸지 않았고(선언만 실제에 맞춤) 신설된 테스트 헬퍼(`assertMatchesContract`/`contractForDto`)도 기존 프로젝트 관례대로 정의 지점에 충분히 문서화되어 있어 별도 README 갱신이 필요하지 않다.

## 위험도

NONE
