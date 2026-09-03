# Scope Review — `WorkspaceInvitationDto.invitedBy` nullable 정정

## 발견사항

- **[INFO]** 커밋 하나에 "버그 수정"과 "축 전체 재검증(라이브 스키마 감사)" 두 관심사가 함께 묶였다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:249`(새 섹션 `## 정본(라이브 스키마) 대조 — 축이 실제로 닫혔음을 확인` 시작) ~ `:280`
  - 상세: 이번 코드 변경의 핵심은 `WorkspaceInvitationDto.invitedBy` 1건의 nullable 정정(파일 1·2)이다. 그런데 plan 문서에는 그와 별개로 "배치 1~3 전체가 `@Column` 데코레이터만 보고 DB 정본을 못 봤을 수 있다"는 의심을 e2e 로 띄워 `information_schema` 와 엔티티 컬럼 424개를 전수 대조한 별도 감사 결과(A/B/C 세 축 표, 파서 커버리지 88% 지적, `schedule.trigger_id` 오판 정정 등)가 통째로 추가돼 있다. 이 감사는 `invitedBy` 버그 자체와는 무관하고, 커밋 메시지도 이를 "## 부수" 로 스스로 구분해 적었다.
  - 판단: (1) `plan/**` 는 developer 쓰기 권한 범위이고 CLAUDE.md·plan-lifecycle 관례상 "체크박스=실제 상태" 동기화가 요구되므로 plan 문서 갱신 자체는 정당하다. (2) 감사 절이 애플리케이션 코드나 설정을 건드리지 않고 문서에만 존재해 실질 위험이 낮다. (3) 저자가 "부수" 로 명시해 은폐성 스코프 확장은 아니다. 다만 리뷰 대상 diff 를 "버그 수정 PR" 로 좁게 읽으면, 이 감사 절 전체(~30줄)는 그 목적에 필요하지 않은 추가 조사 산출물이며 별도 plan 절(예: 별도 커밋 또는 배치 3 절 하단)로 분리될 수도 있었다.
  - 제안: 조치 불필요(INFO). 다만 향후 유사 세션에서 "버그 1건 수정" 커밋과 "선행 배치 전체의 정본 재검증" 같은 조사성 결과물은 가능하면 커밋을 분리하거나, 최소한 plan 문서 내에서 명확히 별도 섹션·별도 체크박스로 유지해 두면(현재도 그렇게 돼 있음) 추적이 쉬워진다.

- **[INFO]** DTO 필드의 JSDoc 주석이 마이그레이션 버전·삭제 시맨틱까지 상세히 서술한다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105`~`108`
  - 상세: `invitedBy` 필드에 `ON DELETE SET NULL`(V017) 근거를 설명하는 4줄 JSDoc 이 추가됐다. 이는 "불필요한 주석 추가"로 보일 여지가 있으나, 같은 파일의 다른 nullable 필드(`InvitationMetaDto.invitedByName`, `WorkspaceSettingsDto.timezone` 등)에도 상세한 `description` 필드가 이미 관례적으로 쓰이고 있어(§동일 파일 내 `interactionAllowedOrigins`, `maxConcurrentExecutions`), 이 저장소의 기존 문서화 관례와 부합한다. 스코프 이탈이 아니다.

## 요약

리뷰 대상 diff(파일 3개)는 `WorkspaceInvitationDto.invitedBy` 를 nullable 로 정정한다는 단일 목적에 대체로 잘 수렴한다. DTO 변경(파일 1)과 컨트롤러 spec 테스트 추가(파일 2)는 정확히 그 목적에 필요한 최소 변경으로, 포맷팅 잡음·무관 리팩터링·불필요한 임포트·설정 변경은 발견되지 않았다(`ApiPropertyOptional` 임포트 추가는 실제 사용에 대응). 실제로 `invitedBy` 를 그대로 통과시키는 `workspaces.controller.ts:402` 는 (원래도 코어션이 없었으므로) 이번 diff 에 포함되지 않았고, git 이력(`9c120e6ae`)도 정확히 이 3개 파일만 바꿨음을 확인했다. 유일하게 주목할 점은 plan 문서(파일 3)에 이 버그 수정과 무관한 "정본 스키마 전수 감사(424 컬럼)" 절이 함께 추가된 것인데, 이는 애플리케이션 코드가 아닌 plan 문서 영역이고 저자가 "부수"로 명시했으며 developer 의 `plan/**` 쓰기 권한 안에 있어 실질적 위험은 낮다.

## 위험도
LOW
