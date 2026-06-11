# Documentation Review

## 발견사항

### [INFO] AuditLogsService.findAll — JSDoc 미비
- 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`, `findAll` 메서드 (라인 ~153)
- 상세: `record` 메서드에는 역할·실패 처리 정책까지 기술된 JSDoc이 있는 반면, `findAll` 메서드에는 JSDoc이 전혀 없다. `userId` 필터 추가로 파라미터 의미가 넓어졌으므로 한 줄 요약이라도 보완하는 것이 바람직하다.
- 제안: `findAll` 위에 `/** 워크스페이스 단위 감사 로그 페이지네이션 조회. action·resourceType·userId·날짜 범위 필터 지원. Admin+ 전용 (컨트롤러 @Roles 로 강제). */` 수준의 JSDoc 추가.

### [INFO] triggers.service.ts — `assertNotificationUrlSafe` JSDoc 중복 헤더 문제
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`, 라인 ~1242–1248
- 상세: `assertNotificationUrlSafe` 앞에 `/**` 블록이 두 개 연속으로 존재한다. 첫 번째 블록은 "notification.url 이 있으면 SSRF safety 를 register-time 에 검증한다..." 내용이고, 두 번째 블록은 `assertAuthConfigInWorkspace` 의 JSDoc으로 메서드 선언이 그 뒤에 붙어 있다. 코드 자체가 잘못된 것은 아니지만 주석의 위치 혼선이 있어 첫 블록이 어느 메서드를 가리키는지 불분명하다 (이 변경 이전부터 존재했으나 본 PR 에서 변경된 `assertNotificationUrlSafe` 영역에 포함된다).
- 제안: `assertNotificationUrlSafe` JSDoc을 해당 메서드 선언 바로 위로 이동시켜 현재 잘못된 위치 관계를 정리.

### [INFO] spec/data-flow/1-audit.md — 변경 일자 인라인 기록 방식
- 위치: `spec/data-flow/1-audit.md`, §2.1 권한 설명 마지막 줄
- 상세: `(비멤버의 X-Workspace-Id 위조 열람도 차단. 2026-06-10 V-03 갭 해소)` 처럼 변경 날짜와 티켓 번호를 spec 본문 괄호 안에 inline 기재하는 방식은 이 프로젝트의 다른 spec 문서와 스타일이 다르다. spec 문서는 현재 상태를 기술하는 단일 진실이므로, 변경 이력 추적은 git commit 이나 plan 문서가 담당하는 것이 자연스럽다. 필요하다면 Rationale 섹션에 별도 서술하는 형태가 일관성이 높다.
- 제안: `2026-06-10 V-03 갭 해소` 인라인 텍스트를 제거하거나 Rationale 섹션 진입 참조(`→ Rationale §V-03`)로 대체. plan 파일(`security-fixes-audit-guard-secret-rotation.md`)이 이미 이력을 관리하고 있으므로 spec 본문에 중복 기재할 필요가 없다.

### [INFO] plan/in-progress 문서 — spec_impact 참조 정확성
- 위치: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md`, frontmatter `spec_impact`
- 상세: frontmatter에 `spec/data-flow/1-audit.md`와 `spec/data-flow/15-external-interaction.md`가 나열되어 있다. 실제 변경된 파일은 `spec/1-data-model.md`와 `spec/5-system/1-auth.md`도 포함되어 있는데(User 필드 보완, Rate Limit 확정값, 초대 토큰 Rationale 추가), 이들이 `spec_impact`에 누락되어 있다. frontmatter가 불완전하면 나중에 spec-coverage 도구가 영향 범위를 잘못 추적할 수 있다.
- 제안: `spec_impact`에 `spec/1-data-model.md`와 `spec/5-system/1-auth.md`를 추가.

### [INFO] QueryAuditLogDto — `action` 필드 JSDoc 주석과 API 설명 불일치 가능성
- 위치: `codebase/backend/src/modules/audit-logs/dto/query-audit-log.dto.ts`, `action` 필드
- 상세: 기존 `action` 필드는 `@ApiPropertyOptional` description에 `예: create, update, delete, execute` 로 예시값이 나열되어 있으나, `spec/data-flow/1-audit.md §1.1` 에 따르면 실제 action 값은 `integration.created`, `workspace.transfer_ownership`, `re_run_initiated` 등 dot 구분 자유 문자열이다. 이번 PR에서 `userId` 필드가 추가되어 description 품질이 전체적으로 노출되는 시점이므로 안내하는 것이 적절하다. 직접적인 변경사항은 아니므로 INFO 등급.
- 제안: `action` 필드 `@ApiPropertyOptional` 예시를 `예: integration.created, workspace.transfer_ownership`처럼 실제 값 패턴으로 교체.

### [INFO] e2e 테스트 파일 — 상단 JSDoc과 헬퍼 함수 인라인 주석 품질 양호
- 위치: `codebase/backend/test/audit-logs.e2e-spec.ts`
- 상세: 파일 상단 JSDoc에 검증 대상 4가지가 명확히 나열되어 있고, `beforeAll` 내 직접 INSERT 사용 이유가 인라인 주석으로 설명되어 있다. 문서화 측면에서 별도 개선이 필요 없다. 양호한 예시.

## 요약

이번 변경은 보안 픽스 2건(audit-logs Admin+ 가드 V-03, notification secret rotation 무효 C3)으로 구성된다. spec 문서(data-flow/1-audit.md, 1-data-model.md, 5-system/1-auth.md)와 plan 파일이 함께 갱신되어 코드-스펙 정합성이 유지된 점은 긍정적이다. 공개 메서드 대부분에 spec 섹션 참조 인라인 주석이 달려 있어 의도를 추적하기 쉽다. 다만 `AuditLogsService.findAll` 에 JSDoc이 없는 점, `spec/data-flow/1-audit.md` 본문에 변경 날짜가 직접 기재된 점, plan frontmatter `spec_impact` 누락 2건 등 소규모 개선 여지가 있다. 전반적인 문서화 상태는 양호하며 즉각적인 기능 이해나 API 사용에 장애가 되는 항목은 없다.

## 위험도

LOW
