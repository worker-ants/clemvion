# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] spec/data-flow/12-workspace.md §3.1 — "미구현" 기술이 구현 완료 후에도 잔존
- 위치: `/Volumes/project/private/clemvion/spec/data-flow/12-workspace.md` 라인 222–224
- 상세: 해당 단락은 현재 "만료 row 정리용 `WorkspaceInvitationsService.pruneExpired` 가 존재하나(periodic job 용도) **현재 프로덕션 호출자가 없어** 만료 row 는 영구 잔존한다. 정리 job 연결은 미구현."이라고 명시한다. 그러나 본 변경셋이 `WorkspaceInvitationsPrunerService`(파일 5)를 신규 추가하고 `WorkspacesModule`(파일 6)에 등록함으로써 이 갭을 정확히 해소했다. 코드가 옳고 spec 본문만 낡았다.
- 제안: 코드 유지 + spec 반영. `spec/data-flow/12-workspace.md` §3.1 라인 222–224을 "일일 04:00 Asia/Seoul BullMQ 반복 스케줄러(`WorkspaceInvitationsPrunerService`, 큐 `workspace-invitations-pruner`)가 `pruneExpired`를 호출하여 만료 row 를 정리한다. 로그인 히스토리 pruner(03:00)와 1시간 시차로 부하를 분산한다."로 갱신.

---

### [INFO] WorkspaceInvitationsPrunerService — 스케줄 시각(04:00) 및 타임존이 spec 에 명시되지 않음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` 라인 1257
- 상세: `{ pattern: '0 4 * * *', tz: 'Asia/Seoul' }` 가 하드코딩되어 있으나 `spec/data-flow/12-workspace.md` §3.1 본문에 스케줄 시각 요구사항이 없다. `spec/5-system/1-auth.md` 는 로그인 히스토리 pruner 를 "0 3 * * * Asia/Seoul"로 명시하고 있어 그 패턴과 일관성이 있다. spec 이 침묵하는 영역으로 코드 결정은 합리적이다.
- 제안: 가시성을 위해 spec/data-flow/12-workspace.md §3.1 에 스케줄 시각을 명기하는 것을 고려. 비차단.

---

### [INFO] UpdateTriggerDto — endpointPath 에 @IsUUID('4') 적용, 하지만 service 가 수정 자체를 거부
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` 라인 952
- 상세: DTO 주석에 "단, 생성 후 endpointPath 변경은 service 가 거부한다"라고 명시했다. `triggers.service.ts` 라인 226도 `disallowed.push('endpointPath')`로 확인된다. DTO 에서 형식 검증을 수행하면 service 에서 거부하기 전 400(포맷 오류)과 4xx(변경 불가) 두 가지 에러 경로가 존재한다. 이는 의도적 방어 레이어이며 기능상 문제없다.
- 제안: 특별한 조치 불필요. 현재 구현이 올바르다.

---

### [INFO] e2e 테스트 B번 케이스 — 미존재 endpointPath에 비-UUID 문자열 사용
- 위치: `/Volumes/project/private/clemvion/codebase/backend/test/webhook-trigger.e2e-spec.ts` 라인 2095–2101
- 상세: `POST /api/hooks/no-such-path-xyz` 는 UUID 형식이 아닌 경로를 사용한다. 이는 수신 엔드포인트(`/api/hooks/:endpointPath`)의 경로 파라미터에 대해 UUID 검증이 없음을 전제한다(형식 검증은 CREATE/UPDATE DTO 에서만 수행). 라우팅 조회 결과 없을 때 404 를 반환하는 동작은 올바르다. 기능적으로 정상이나, 향후 수신 엔드포인트에서도 경로 파라미터 형식을 검증하는 방향으로 개선 가능하다(404 이전에 400 혹은 404 동일하게).
- 제안: 비차단. 현재 동작은 spec WH-RS-02(잘못된 경로 → 404)와 일치한다.

---

### [INFO] WorkspaceInvitationsPrunerService — removeJobScheduler mock 선언되었으나 미테스트
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.spec.ts` 라인 1021
- 상세: 테스트의 `queue` mock에 `removeJobScheduler` 가 선언되어 있으나 서비스 구현에서 실제로 호출하지 않으므로 이 mock 은 사용되지 않는다. 불필요한 mock 선언이지만 해롭지는 않다.
- 제안: 비차단. 필요 없으면 제거해도 되지만 필수는 아님.

---

## 요약

변경된 코드는 의도한 두 기능을 정확히 구현한다. (1) `endpointPath` v4 UUID 형식 강제(W1 보안): `CreateTriggerDto` / `UpdateTriggerDto` 모두 `@IsUUID('4')` 로 교체되었고, 단위 테스트는 유효 UUID 통과, 비-UUID·경로형·v1 UUID 거부를 전부 검증한다. 관련 e2e 테스트도 `crypto.randomUUID()` 로 정합하게 갱신되었다. spec `WH-MG-02` 는 이번 변경셋에서 함께 갱신되어 코드와 일치한다. (2) `WorkspaceInvitationsPrunerService` 신규 추가: 기존에 "미구현" 상태였던 만료 초대 정리 job 을 login-history-pruner 와 동일 패턴(BullMQ repeatable scheduler, Asia/Seoul 명시)으로 연결했다. 구현이 완전하고 에러 swallow·멀티 인스턴스 안전·idempotent upsert 설계가 올바르다. 단 `spec/data-flow/12-workspace.md` §3.1 라인 222–224의 "정리 job 연결은 미구현" 기술이 아직 갱신되지 않았다 — SPEC-DRIFT(코드가 옳고 spec 이 낡음)이며 코드 수정 대상이 아니라 spec 갱신 대상이다. Critical/Warning 발견사항은 없다.

## 위험도

LOW
