## 발견사항

### [INFO] 컨트롤러 테스트가 새 파라미터(userId, ipAddress) 전파를 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.spec.ts`
- 상세: `auth-configs.controller.spec.ts` 는 `@Roles` 메타데이터만 확인하는 메타 테스트다. 이번 변경으로 `create/update/regenerate/remove` 4개 핸들러에 `@CurrentUser('sub') userId`와 `@Req() req` 파라미터가 추가됐으나, 실제로 이 값이 서비스 메서드로 정확히 전달되는지(예: `req.ip`가 `service.create`의 `ipAddress` 인자로 연결됨) 를 검증하는 컨트롤러 단위/통합 테스트가 없다. 컨트롤러가 잘못된 인자 순서로 서비스를 호출해도 현재 테스트로는 잡히지 않는다.
- 제안: 컨트롤러 spec에 `authConfigsService.create`/`update`/`regenerate`/`remove` 가 올바른 `userId`·`ipAddress`(`req.ip`)로 호출됨을 검증하는 케이스 추가. 또는 e2e 테스트에서 audit mock이 올바른 ip를 받음을 검증한다.

### [INFO] `remove` audit 테스트에서 `workspaceId` 미검증
- 위치: `auth-configs.service.spec.ts` lines 649-665 (`remove → auth_config.delete 기록`)
- 상세: `create`/`update`/`regenerate` audit 테스트는 `expect.objectContaining({ workspaceId: WS, ... })` 로 workspaceId 를 명시 검증하지만, `remove` audit 테스트에는 `workspaceId` 검증이 빠져 있다. `remove` 서비스 구현은 `workspaceId` 를 `record()` 에 전달하고 있으나 테스트가 이를 보장하지 않는다.
- 제안: `remove` audit 테스트의 `expect.objectContaining`에 `workspaceId: WS` 추가.

### [INFO] `reveal` 성공 케이스의 audit mock.record 호출 횟수 미검증
- 위치: `auth-configs.service.spec.ts` lines 417-443 (`올바른 비밀번호 → 평문 config 반환 + audit 기록`)
- 상세: 이번 변경으로 `create()` 도 `audit.record`를 호출한다. 해당 테스트는 `service.create()`로 시드를 만든 뒤 `audit.record.mockClear()` 없이 바로 `reveal()`을 호출하고 `toHaveBeenCalledWith`로 `auth_config.reveal` 호출을 확인한다. 이 방식은 `reveal` 호출이 `audit.record`를 최소 한 번 부른다는 것만 보장한다. `audit.record`가 총 2회(create + reveal) 호출되는 상황이므로, reveal 케이스도 `mockClear()` 후 정확히 1회만 기록됨(`toHaveBeenCalledTimes(1)`)을 추가 검증하는 것이 의도를 더 명확히 표현한다. 현재 동작에서 버그는 아니지만 가독성·의도 표현 면에서 개선 여지가 있다.
- 제안: `reveal` 성공 테스트에도 `create()` 호출 이후 `audit.record.mockClear()`를 추가하고 `toHaveBeenCalledTimes(1)` 추가.

### [INFO] 서비스 실패 경로(findById NotFoundException 발생 시) audit 미기록 테스트 부재
- 위치: `auth-configs.service.ts` — `update`, `regenerate`, `remove` 메서드
- 상세: `update`/`regenerate`/`remove`는 `findById`가 `NotFoundException`을 던지는 경우 `audit.record()`를 호출하지 않아야 한다. 이 "예외 전파 시 audit 미기록" 경로가 테스트되어 있지 않다. 반면 `reveal`은 비밀번호 실패 시 audit 미기록 케이스를 명시적으로 검증하고 있어 일관성 불일치가 있다.
- 제안: `update`/`regenerate`/`remove`에 존재하지 않는 id 전달 시 `NotFoundException` 발생 + `audit.record` 미호출 케이스 추가. 단, 기존 `verifyWebhookRequest` 테스트에 이미 `authConfigId 미존재 → 401` 케이스가 있으므로, 동일 패턴으로 간단히 추가 가능하다.

### [INFO] `basic_auth` 타입 `create` audit 기록 테스트 부재
- 위치: `auth-configs.service.spec.ts` — `CRUD audit 기록` describe 블록
- 상세: CRUD audit 테스트는 모두 `api_key` 타입으로만 시드한다. `basic_auth`·`hmac`·`bearer_token` 타입에서도 audit 기록이 동일하게 동작함을 직접 검증하지 않는다. 서비스 구현상 타입에 무관하게 동작하므로 실제 버그 위험은 낮으나, 타입별 분기가 없음을 명시적으로 보장하는 테스트는 없다.
- 제안: 현재 커버리지 수준에서 필수는 아님. 타입별 차이가 없는 경로이므로 기존 자동 발급 테스트가 간접적으로 커버한다고 볼 수 있다. INFO 수준으로 무시 가능.

---

## 요약

이번 변경은 `auth_config.create/update/delete/regenerate` 4개 감사 액션 추가 + 서비스 메서드 시그니처 확장 + 컨트롤러 파라미터 전파라는 명확한 범위를 가지며, 핵심 서비스 테스트(`CRUD audit 기록` describe 5케이스 + `reveal` 음성 mockClear 3케이스)가 충실하게 추가되어 있다. 기존 테스트도 새 시그니처(`USER` 인자 추가)에 맞게 일괄 수정됐고, `ipAddress` 미지정 케이스(undefined)까지 커버한다. 주요 갭은 컨트롤러 레이어에서 `userId`/`req.ip`가 서비스로 올바르게 전달되는지를 검증하는 테스트가 없는 것(INFO)과, `remove` audit 테스트의 `workspaceId` 누락(INFO)이다. Critical 또는 Warning 수준의 결함은 없다.

## 위험도

LOW
