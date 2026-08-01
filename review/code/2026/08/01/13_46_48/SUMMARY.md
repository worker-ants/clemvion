# 코드 리뷰 SUMMARY — 7차 (audit-logging)

- **세션**: `review/code/2026/08/01/13_46_48`
- **대상**: `git diff origin/main...HEAD -- codebase/` 23파일 (명시 경로 전달)
- **실행**: reviewer 11명 성공 / 0 미완. skip 3명 (`dependency`·`api_contract`·`user_guide_sync` — router 판정)
- **forced 6명 전원 산출물 확보** (`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`)

> **작성 경위**: workflow 의 `code-review-summary` sub-agent 가 세션 사용량 한도로 실패해
> (`agents_error=1`) SUMMARY 가 디스크에 쓰이지 않았다. reviewer 11명의 리포트는 전부 정상
> 생성됐으므로 main 이 그 리포트들을 직접 읽어 본 문서를 작성했다.

## 종합 판정

| 항목 | 값 |
|---|---|
| **Critical** | **1** — 전부 **이번 diff 밖의 기존 결함** (아래 §1) |
| **Warning** | **8** — SPEC-DRIFT 5 (planner 영역) · 코드 3 (조치 완료) |
| 관점별 위험도 | security=CRITICAL(기존 결함 사유) · 나머지 10명 전원 **LOW / NONE** |

**이번 PR 이 만든 코드 결함은 0건이다.** Critical 1건은 리뷰 대상 파일에 우연히 포함된
기존 인가 결함이고, Warning 8건 중 5건은 `developer` 권한 밖(spec), 3건은 이 턴에 조치했다.

---

## 1. [CRITICAL] `@Roles()` 미부착 라우트의 워크스페이스 멤버십 검증 누락 — **기존 결함, 별도 트랙**

`security` 리포트. **main 이 직접 재현·검증했다** (리뷰어 주장을 액면으로 받지 않았다).

**확인된 사실**:

- `common/guards/roles.guard.ts` 의 `canActivate()` 가 `if (!requiredRoles || requiredRoles.length === 0) return true;` 로 조기 반환한다. 멤버십 조회(`getMemberRole`)는 그 아래라 **`@Roles()` 없는 라우트에서는 실행되지 않는다**.
- `RolesGuard` 는 `app.module.ts:204` 에서 `APP_GUARD` 전역 등록이고, 멤버십을 검증하는 **다른 가드는 없다** (`getMemberRole` 사용처 전수 확인).
- `@WorkspaceId()` 데코레이터는 `X-Workspace-Id` 헤더를 그대로 신뢰하며, **자체 주석에 "헤더 스푸핑(비멤버)은 RolesGuard 가 403 으로 차단한다" 고 적어 두었다** — `@Roles()` 없는 라우트에서 그 전제가 성립하지 않는다.
- `triggers.controller.ts` 의 `rotateBotToken`(chat-channel 봇 토큰 회전 **mutation**)에 `@Roles()` 가 없다. 같은 컨트롤러의 자매 mutation 5개는 전부 `@Roles('editor')` 다. `triggers.service.ts` 는 자체 멤버십 검증을 하지 않는다.

**이번 PR 소산이 아님도 실측 확인**:

| 확인 | 결과 |
|---|---|
| 이 PR 이 `common/guards/` 를 변경했나 | 변경 0 |
| `rotateBotToken` 이 이 PR diff 에 있나 | 0건 — diff 밖 |
| 미보호 GET 핸들러가 diff 에 있나 | 0건 — diff 밖 |
| `origin/main` 의 `rotateBotToken` 에 `@Roles` 가 있나 | 없음 → **기존 결함 확정** |

**처분**: 이 PR 을 되돌릴 사유가 아니다. 감사 로깅과 결합해 고치면 범위가 뒤섞이고, 올바른
조치(전수 조사 + `RolesGuard` 재구성)가 이 PR 보다 크다. **별도 세션으로 분리**했다
(spawn_task: "Fix cross-tenant authz gap on @Roles()-less routes"). 전수 조사가 선행돼야
한다 — 위 목록은 7차 배치에 포함된 4개 컨트롤러만 훑은 결과다.

---

## 2. [WARNING ×3] 코드 — **조치 완료** (커밋 `c4eddd918`)

### 2.1 `architecture` + `maintainability` (같은 결함, 다른 각도)

`recordAudit` 의 `action` 파라미터를 4개 서비스가 각자 인라인으로
`(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]` 재정의하고 있었다. `AuditAction` 이 이미
export 돼 있고 `auth-configs` 는 그걸 쓴다(선례 불일치). 나아가 전체 34개 합집합을 받으면
`resourceType` 은 서비스마다 고정인데 `WorkflowsService` 에 `'trigger.deleted'` 를 넘겨도
컴파일이 통과해 **모순된 감사 행**이 만들어진다.

→ `AuditActionFor<P>` (template-literal `Extract`) 를 추가해 리소스별로 좁혔다. 정합성이
주석에서 타입으로 옮겨졌다. **검증**: 교차-도메인 대입 3종 전부 `tsc` RED.

### 2.2 `testing`

`duplicate` 는 순서 테스트만 있고 롤백 테스트가 없었고, `importWorkflow` 는 둘 다 없었다
(4차에서 감사를 추가할 때 "기록됨" 만 단언). → `create` 와 같은 형태로 3건 추가.

**검증**: 각 테스트가 **개별적으로** 뮤턴트(기록을 트랜잭션 안으로 이동)를 잡는 것까지 확인
(`failed=1 skipped=89`).

> 리뷰어 서술은 실제보다 넓었다 — `duplicate` 의 순서 테스트는 이미 있었다. 실측으로 갭을
> 좁혀 필요한 3건만 추가했다.

---

## 3. [WARNING ×5] SPEC-DRIFT — `developer` 권한 밖, planner 인계

`requirement` 4건 + `documentation` 1건이 같은 사안을 가리킨다. 전부 **이미 추적 중**
(`plan/in-progress/spec-sync-auth-gaps.md`, PR 본문에 인계 명시).

| spec 파일 | 필요한 수정 |
|---|---|
| `5-system/1-auth.md §4.1` | 13개 액션 Planned→구현. **`workflow.executed` 만 Planned 잔류** |
| `5-system/1-auth.md` L438 | "`model_config` 감사 현재 미구현" 노트가 stale |
| `data-flow/1-audit.md §1.1` | writer 표 · 커버리지 갭 문단 · §5 외부 의존 표 |
| `conventions/audit-actions.md §3` | 상태 컬럼 4개 행 |
| `2-navigation/2-trigger-list.md` L182 · L252 | **audit 액션명 오기.** L182 은 한 줄에 permission 과 audit action 이 같이 나오는데 **permission `trigger.delete` 는 정당**하고 audit 표기만 `trigger.deleted` 로 고쳐야 한다. L252 는 `trigger.update`→`trigger.updated` |

---

## 4. 조치하지 않은 INFO — 근거

| 항목 | 관점 | 근거 |
|---|---|---|
| `ModelConfigService.update`/`remove` 가 `notifyInvalidated()` 를 `recordAudit()` 보다 먼저 호출 | side_effect | **기능 결함 아님** — `notifyInvalidated` 는 리스너별 `try/catch` 로 감싸여 throw 하지 않아(`model-config.service.ts:76-88`) 감사 유실 경로가 없다. 다른 3개 서비스의 "감사 → 실패 가능한 외부 호출" 순서와 형식적으로만 다르다. 리뷰어도 "필수 조치 아님" 으로 판정 |
| 감사 기록과 리소스 변경의 비원자성 | side_effect | 이번 diff 가 만든 게 아니라 `AuditLogsService.record()` 의 기존 fail-soft 설계. 무결성 보장이 필요해지면 outbox 패턴 별도 검토 |
| `recordAudit` 헬퍼 5중복 | maintainability(6차 W2) | 5개 helper 의 `details` 계약이 전부 달라(passthrough/`{type}`/없음/`{kind}`/`ipAddress`) 공통분모가 `resourceType` 바인딩 + 필드 전달뿐이다. 추출해도 타입 있는 per-service 래퍼가 남는다 |

---

## 5. 수렴 판정

**수렴.** 근거:

1. **이번 PR 이 만든 Critical 0.** 유일한 Critical 은 diff 밖 기존 결함으로 실측 확인됐고 별도 트랙으로 분리했다.
2. 코드 Warning 3건은 전부 이 턴에 조치했고, 각각 뮤턴트로 검증했다.
3. 나머지 Warning 5건은 `developer` 가 고칠 수 없는 spec 영역이며 이미 인계 문서화돼 있다.
4. 발견의 성격이 라운드를 거치며 *동작 결함 → 구조 → 테스트 커버리지 → 타입 정밀도 → 문서 동기화* 로 이동했다. 7차의 코드 지적은 전부 "더 좁힐 수 있다" 류이지 오동작이 아니다.

## 6. 실행 메타

- routing: `done`. router 가 11명 선정, forced 6명 전원 포함 (계약 위반 없음).
- skip 3명: `dependency`(package.json 무변경) · `api_contract`(HTTP 계약 무변경) · `user_guide_sync`(doc-sync-matrix 미해당).
- `summary` sub-agent 만 세션 한도로 실패 → 본 문서를 main 이 대체 작성.
