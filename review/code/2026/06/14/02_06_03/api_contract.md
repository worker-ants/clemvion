# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `getWorkspaceSettings` 응답 형식 변경 — `timezone` 필드 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/workspaces.service.ts` (변경 후 `getWorkspaceSettings` 반환 타입)
- 상세: 반환 타입이 `{ interactionAllowedOrigins: string[] }` 에서 `{ interactionAllowedOrigins: string[]; timezone?: string }` 으로 확장됐다. `timezone` 은 optional 이므로, timezone이 설정되지 않은 워크스페이스에서는 해당 키 자체가 응답 객체에 포함되지 않는다(spread 조건부 포함). 기존 클라이언트가 이 필드를 무시하는 방식으로 동작 중이라면 하위 호환성 문제는 없다. 다만 클라이언트가 응답 타입을 strict 하게 파싱하는 경우(예: 타입 단언 또는 schema validation) 에는 신규 선택적 필드 처리가 필요할 수 있다.
- 제안: 현재 설계(optional 필드 추가)는 REST API 에서 하위 호환 확장의 정석 패턴이다. 별도 조치 불필요. 단, API 문서(Swagger)에 `@ApiPropertyOptional`로 이미 선언된 `timezone` 필드가 `getWorkspaceSettings` 응답 DTO에도 반영되어 있는지 확인 권장 — 현재 코드는 controller 레벨 `@ApiResponse` 타입 선언이 보이지 않는다.

### [INFO] `UpdateWorkspaceSettingsDto.timezone` — 신규 선택적 필드 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: `timezone` 필드가 `@IsOptional()` 로 추가됐다. 기존 요청(클라이언트가 `timezone` 을 전송하지 않는 경우)은 `dto.timezone === undefined` 조건에 걸려 timezone 처리가 건너뛰어지므로 기존 동작을 유지한다. 빈 문자열 `""` 는 "설정 해제"로 처리되어 settings 에서 `timezone` 키가 제거된다 — 이 암묵적 시맨틱은 DTO 주석(`@ApiPropertyOptional` description)에 명시되어 있지 않다.
- 제안: `@ApiPropertyOptional` 의 `description` 에 "빈 문자열 전송 시 타임존 설정이 해제됩니다" 문구를 추가해 클라이언트 개발자에게 명시적으로 안내하는 것을 권장한다. 또한 `@MaxLength(64)` 검증만 있고 IANA 형식 정규식(예: `Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/)`)이 없으므로 유효성 검증이 서비스 계층(`isValidIanaTimezone`)에만 위임된다. 이는 설계상 허용되나, DTO 계층에 1차 형식 검증을 추가하면 방어 깊이가 향상된다.

### [INFO] `SchedulesService.create` — `timezone` 결정 로직 변경 (breaking change 없음)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/schedules/schedules.service.ts`, `resolveTimezone` 메서드 및 `create` 내 호출
- 상세: `dto.timezone ?? 'Asia/Seoul'` 에서 `resolveTimezone(workspaceId, dto.timezone)` 으로 교체됐다. API 요청자 관점에서 명시적 `timezone` 을 지정하면 이전과 동일하게 동작한다. `timezone` 을 생략하면 기존에는 `'Asia/Seoul'` 이 적용됐으나, 이제 워크스페이스 `settings.timezone` 이 우선 적용된다. 이는 API 동작의 변경이지만 워크스페이스에 timezone이 설정되어 있지 않은 경우 최종 폴백이 동일한 `'Asia/Seoul'` 이므로 사실상 대부분의 기존 사용자에게 동작 변화가 없다. 단, 워크스페이스 `settings.timezone` 이 설정된 워크스페이스에서 `timezone` 미지정으로 스케줄을 생성하는 클라이언트는 이제 다른 timezone으로 스케줄이 생성될 수 있다.
- 제안: 이 동작 변경은 spec §2.2 에 명시된 의도적 변경이므로 breaking change가 아닌 기능 추가로 분류한다. 별도 버전 범프 불필요.

### [INFO] `interactionAllowedOrigins` 의 `@ApiProperty` — required 필드 유지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` L17
- 상세: `interactionAllowedOrigins` 는 `@IsOptional()` 없이 필수 필드로 선언되어 있다(`@ApiProperty`, not `@ApiPropertyOptional`). `updateWorkspaceSettings` 서비스에서 `dto.interactionAllowedOrigins ?? []` 로 처리하므로 실제로는 미전송 시 빈 배열로 폴백한다. DTO 선언과 실제 서비스 동작 사이에 불일치가 존재한다 — 이 변경에서 새로 추가된 부분은 아니지만, `timezone` 필드를 같은 DTO 에 추가하면서 함께 검토된다.
- 제안: `interactionAllowedOrigins` 를 실제 동작에 맞게 `@IsOptional()` + `@ApiPropertyOptional` 으로 변경하거나, 서비스에서 `??[]` 폴백을 제거하고 DTO 검증 실패 시 400 응답을 반환하도록 일관화를 고려한다. 이 이슈는 본 변경의 직접 범위는 아니므로 참고 용도로 기재한다.

## 요약

이번 변경은 기존 API 의 하위 호환성을 유지하면서 두 가지 신규 동작을 추가한다: (1) `PATCH /api/workspaces/:id/settings` 에 선택적 `timezone` 필드 추가(IANA 유효성 검증 + settings 병합/해제), (2) `GET /api/workspaces/:id/settings` 응답에 선택적 `timezone` 반환. 에러 응답 형식은 기존 `{ code, message }` 구조를 일관되게 따르며(`INVALID_TIMEZONE` 코드, `BadRequestException` HTTP 400), 인가 체계(Admin+ 기록, 멤버 조회)도 변경 없다. `SchedulesService.create` 에서 `timezone` 결정 로직이 변경되나 이는 spec §2.2 에 명시된 의도적 개선이다. 주요 지적 사항은 `UpdateWorkspaceSettingsDto.timezone` 의 빈 문자열 시맨틱("설정 해제")이 Swagger 문서에 명시되지 않은 점과, DTO 계층에 IANA 형식 정규식 1차 검증이 없는 점이다. 모두 INFO 수준이며 즉시 차단이 필요한 사항은 없다.

## 위험도

LOW
