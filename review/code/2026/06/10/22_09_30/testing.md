# Testing Review — security-fixes-audit-guard-secret-rotation

리뷰 대상: audit-logs Admin+ 가드(V-03) + notification secret rotation 무효(C3) 보안 fix 2건

---

## 발견사항

### [INFO] 테스트 존재 여부 — 변경 범위 대비 커버리지 충분
- 위치: `audit-logs.spec.ts` (신설), `triggers.service.spec.ts` (기존 + 신설 describe 블록)
- 상세: 신설된 `audit-logs.spec.ts` 가 @Roles 메타데이터 반사 검사(1케이스), userId 필터 분기(2케이스)를 커버하고, `triggers.service.spec.ts` 의 기존 promote 케이스가 신규 계약(secret store 경유)으로 갱신됐으며 독립 describe 3케이스가 추가됐다. `audit-logs.e2e-spec.ts` 가 HTTP 레이어 권한 경계 5케이스를 실제 DB 행 삽입까지 포함해 커버한다.

---

### [WARNING] @Roles 메타데이터 테스트만으로는 RolesGuard 실제 거부 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — 첫 번째 describe
- 상세: `Reflect.getMetadata(ROLES_KEY, ...)` 로 데코레이터 부착 여부만 확인한다. `RolesGuard` 가 해당 메타데이터를 읽어 역할 부족 시 403 을 던지는 로직이 제대로 동작하는지는 단위 레벨에서는 테스트되지 않는다. Guard 는 DI 의존(WorkspaceMemberRepository 등)이 있어 NestJS TestingModule 에 통합 테스트 형태로 Guard 를 포함하거나, e2e 에서 커버하는 두 경로 중 하나가 필요하다. e2e(`audit-logs.e2e-spec.ts`)가 실 HTTP 경로로 viewer/editor/비멤버 403 을 커버하므로 보완은 되어 있으나, 단위 레이어에서는 "Guard 자체가 올바르게 동작한다"는 회귀 가드가 없다.
- 제안: Guard 를 TestingModule 에 포함하고 `HTTP_INTERCEPTORS` / `useGuards` 설정 후 실제 401/403 응답을 검증하는 컨트롤러 통합 단위 테스트 1~2케이스를 추가하면 e2e 없이도 Guard 연결이 깨지는 회귀를 잡을 수 있다.

---

### [WARNING] `promoteRotatedNotificationSecrets` 신설 describe 에서 `secrets.rotate` 호출 순서·에러 전파가 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 신설 describe `TriggersService.promoteRotatedNotificationSecrets — secret store 경유 승격 (리뷰 C3)` (대략 line 563~695)
- 상세: 세 케이스 모두 `secrets.rotate` 성공 경로만 검증한다. `secrets.rotate` 가 throw 할 때 promote 루프가 계속 진행하는지(partial fail), 아니면 전체 롤백하는지, v2/rotated_at NULL 클리어가 실행됐는지 여부가 검증되지 않는다. `triggerRepo.save` 가 throw 했을 때의 동작도 미커버다.
- 제안: `secrets.rotate` 를 `jest.fn().mockRejectedValueOnce(new Error('store error'))` 로 설정한 케이스를 추가해 에러 전파 계약(무시·swallow·rethrow 중 어느 것인지)을 검증한다.

---

### [WARNING] `notification config 부재 trigger → skip` 케이스의 promote 반환값 검증 불충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `notification config 부재 trigger → skip` it 블록
- 상세: `result.promoted === 0` 과 `triggerRepo.save` 미호출만 확인한다. skip 경로에서 `notificationSecretV2` 와 `notificationRotatedAt` 가 원래 값으로 유지되는지(즉, DB 에 쓰지 않아야 한다는 계약) 를 직접 assertion 하지 않는다.
- 제안: skip 케이스에서 `triggerRepo.save` 가 `toHaveBeenCalledTimes(0)` 임을 이미 검증하므로 크리티컬한 갭은 아니지만, `trigger.notificationSecretV2` 가 원래 값(`'wsk_newsecret'`)으로 남아있음을 assertion 하면 의도를 명시적으로 문서화할 수 있다.

---

### [INFO] `QueryAuditLogDto.userId` 에 대한 DTO 유효성 검사 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/audit-logs/dto/query-audit-log.dto.ts`
- 상세: `@IsUUID()` 데코레이터가 추가됐으나 잘못된 UUID 형식(예: 단순 문자열, 빈 값, UUID v4 외 형식)을 쿼리로 전달했을 때 400 VALIDATION_ERROR 가 반환되는지 검증하는 테스트가 없다. e2e 에서는 유효한 UUID 만 사용한다.
- 제안: DTO 단위 테스트 또는 컨트롤러 통합 테스트에서 비UUID 문자열을 `userId` 로 전달했을 때 ValidationPipe 가 400 을 반환함을 확인하는 케이스를 추가한다. 보안 측면에서 SQL injection 방어가 `@IsUUID()` 를 통해 이루어지므로 회귀 테스트 가치가 있다.

---

### [INFO] e2e 의 비멤버 위조 케이스에서 실제 다른 workspaceId 위조 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/test/audit-logs.e2e-spec.ts` — `비멤버가 X-Workspace-Id 위조 → 403` it 블록
- 상세: 비멤버(`outsider`)의 `headers()` 호출이 `wsId` 인자를 생략하므로 테스트 내 `workspaceId` 변수(owner 의 ws) 를 그대로 사용한다. 이는 "비멤버가 본인과 무관한 워크스페이스 ID 를 헤더에 실어 요청"하는 정확한 위조 시나리오에 해당해 의도에 맞다. 다만, `headers(outsider.accessToken, outsider_own_wsId)` 같이 outsider 가 "자신의 workspace" 로도 이 endpoint 에 접근할 수 없음(본인 소유지만 Admin+ 가 아닌 경우는 별도)은 미검증이다. 현 설정에서 outsider 는 아무 워크스페이스도 없으므로 사실상 동일하나 케이스 명세가 명시적이지 않다.
- 제안: 현 케이스 의도가 충분히 명확하므로 즉각적 수정 필요는 없으나, 주석에 "outsider 는 멤버십 없음 — 위조 헤더로 접근" 을 명시하면 가독성이 향상된다.

---

### [INFO] `audit-logs.e2e-spec.ts` 의 직접 INSERT 시드 방식과 audit log record 경로 간 괴리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/test/audit-logs.e2e-spec.ts` — `beforeAll` 내 `db.query INSERT`
- 상세: 시드를 `AuditLogsService.record` 경로 대신 raw SQL 직접 INSERT 로 생성한다. 이는 의도적인 선택(본 테스트의 관심사는 조회 권한 경계)으로 주석에도 명시되어 있으나, `user` 컬럼 join(`leftJoinAndSelect('al.user', 'user')`) 이 응답에 포함되는지 여부는 검증하지 않는다. 향후 user join 필드가 응답 스키마에 포함될 때 확인이 필요한 갭이다.
- 제안: 현재 범위에서는 허용 가능하다. 다만 응답 shape(예: `data[0].user` 필드 존재 여부) 검증을 owner 200 케이스에 추가하면 join 경로 회귀도 커버할 수 있다.

---

### [INFO] 기존 promote 단위 테스트 갱신의 충분성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 기존 `TriggersService — Secret rotation / itk revoke` describe 내 갱신된 it 블록 (line 687~555 구간)
- 상세: 구 계약(`signing.secret: 'wsk_new'` 기대)이 신 계약(`secretRef` 기대 + `signing.secret` undefined 기대)으로 올바르게 갱신됐다. `savedSigning.notification.signing.secret` 이 `toBeUndefined()` 임을 명시적으로 추가 검증한 점이 좋다. 이 케이스가 C3 버그의 회귀 방지 핵심 케이스이며, 신설 describe 와 합쳐 3각형 커버리지(legacy 평문 보유 / secretRef 보유 / notification 부재)를 형성한다.

---

### [INFO] 테스트 격리 — `beforeEach` vs `beforeAll` 혼용 적절성
- 위치: `audit-logs.spec.ts` — `AuditLogsService.findAll` describe 에서 `beforeEach` 사용
- 상세: 각 테스트마다 NestJS TestingModule 과 mock `qb` 를 재생성한다. mock 이 단순(`.mockReturnThis()` chain)하고 테스트 수가 2개이므로 격리성은 충분하나, `beforeEach` 에서 full module compile 을 반복하는 비용이 발생한다. e2e 는 `beforeAll` 을 사용해 적절히 최적화되어 있다.
- 제안: 현 규모에서는 문제없다. 케이스가 늘어나면 `beforeAll` + `jest.clearAllMocks()` 패턴으로 전환을 고려한다.

---

## 요약

변경 범위에 상응하는 테스트가 단위(3케이스 신설 + 1케이스 갱신)·e2e(5케이스 신설) 두 계층으로 추가됐다. 핵심 보안 계약(admin 가드 메타데이터 존재, secret store 경유 승격, 비멤버 403)에 대한 회귀 방지는 충분히 갖춰져 있다. 다만 `RolesGuard` 가 실제 403 을 던지는 경로는 단위 레벨에서 직접 검증되지 않고 e2e 에만 의존하고 있어, e2e 환경이 불가용한 상황에서 Guard 연결 회귀를 조기에 탐지하기 어렵다. `secrets.rotate` 실패 경로가 미커버이고, `userId` 의 잘못된 UUID 형식에 대한 유효성 검사 회귀 테스트가 없는 점도 소규모 갭으로 남아있다. 전반적으로 보안 수정의 핵심 경로는 커버되어 있으며 테스트 가독성과 의도 표현도 양호하다.

## 위험도

LOW
