---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# data-flow/12-workspace — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). data-flow 문서라 frontmatter status 강제 대상은 아니나, 본문이 현재형으로 약속한 미구현 surface 를 분리 추적한다.
> 관련 spec: spec/data-flow/12-workspace.md

## 미구현 항목
- [ ] 워크스페이스 전환 플로우(§1.5) — `POST /api/auth/workspaces/:id/switch` 엔드포인트·`switchWorkspace` 서비스·프론트 호출 전부 부재. 전환=토큰 재발급 모델 미구현 (현재는 `X-Workspace-Id` 헤더로만 컨텍스트 지정).
- [ ] JWT payload 워크스페이스 클레임 필드명 정합 — spec 이 가정한 `activeWorkspaceId` 는 코드에 없고 실제는 `workspaceId`. 전환 모델 구현 시 명명 확정 필요.
- [ ] `(owner_id, type) UNIQUE` DB 레벨 강제 — 현재 TypeORM `@Unique` 데코레이터만 존재, 마이그레이션 SQL 에 대응 제약 없음. personal workspace 중복 방지를 DB 제약으로 추가할지 결정 필요.
- [ ] 워크스페이스 액션 audit 적재 범위 — 현재 `workspace.transfer_ownership` 1건만 기록. create/delete/rename/member 변경 등 audit 적재 여부 결정 필요(과거 spec 은 `workspace.*` 전체 적재로 약속).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/data-flow/data-flow__12-workspace.md 참조.
- 본문은 위 항목들을 "미구현 (Planned)" 또는 "현재 미적재/미강제" 로 명시 표기하도록 이미 패치됨.

---

## 결정 옵션 (2026-06-13)

> 아래는 각 미구현 항목의 결정을 돕기 위한 옵션 정리다. 코드/spec 의 현재 상태를 grounding 한 시점(2026-06-13) 기준이며, 체크박스 해소·구현은 별도 단계(project-planner spec 개정 → consistency-check → developer)에서 수행한다.

### 결정 1: 워크스페이스 전환 모델 (switch 엔드포인트 구현 vs 헤더 유지)

**맥락**
- spec §1.5 (`spec/data-flow/12-workspace.md:107-124`) 는 `POST /api/auth/workspaces/:id/switch` → 멤버십 검사 → `generateTokens(workspaceId=:id)` → 토큰 재발급 시퀀스를 **계획(미구현)** 으로 명시.
- 실제로 auth 모듈에 switch 엔드포인트·`switchWorkspace` 서비스가 부재. `auth.controller.ts:600` 의 `switch` 는 무관한 JS `switch` 문.
- 현재 유일한 전환 수단은 `X-Workspace-Id` 헤더다. `WorkspaceId` 데코레이터(`workspace.decorator.ts:13-15`)가 **헤더 > JWT `workspaceId`** 우선순위로 활성 워크스페이스를 결정한다. spec Rationale §`X-Workspace-Id 헤더 우선 정책`(`12-workspace.md:251-260`) 이 이 잠정 모델을 문서화.
- `generateTokens`(`auth.service.ts:759-806`) 는 이미 `resolveTokenWorkspaceContext` 가 해석한 `context.workspaceId` 를 payload 에 실으므로, switch 는 "특정 workspaceId 를 강제 주입한 context 로 generateTokens 재호출" 만 추가하면 되는 작은 표면이다.

**옵션 A — 토큰 재발급 기반 switch 엔드포인트 구현 (spec §1.5 그대로)**
- 설명: `POST /api/auth/workspaces/:id/switch` 추가. 멤버십 RBAC 검사 후 해당 workspaceId 로 access/refresh 재발급. 헤더 경로는 deprecate 하거나 호환 위해 유지.
- 장점: 활성 워크스페이스의 **단일 진실원이 토큰**이 된다 — 핸들러가 헤더를 신뢰하지 않아도 되고, 각 핸들러의 멤버십 재검증 의존(현 헤더 모델의 전제)이 switch 시점 1회 검증으로 수렴. spec 본문과 코드가 일치(미구현 표기 제거 가능).
- 단점: 프론트의 전환 UX·토큰 교체 로직, refresh 토큰 family 처리(switch 시 신규 family 발급 여부) 결정 필요. refresh 회전 트랜잭션(`auth.service.ts:620`)과의 상호작용 검토 비용.

**옵션 B — 헤더 전용 컨텍스트 유지 (switch 미구현 확정)**
- 설명: `X-Workspace-Id` 헤더를 정식 전환 수단으로 승격. spec §1.5 를 "헤더 모델 채택, 토큰 재발급 전환은 비채택" 으로 개정.
- 장점: 추가 구현 0. 무상태(stateless) — 토큰 재발급 없이 요청마다 워크스페이스 지정 가능, 동시 다중 워크스페이스 작업에 유리.
- 단점: 활성 워크스페이스가 토큰에 고정되지 않아 **모든 핸들러/서비스가 헤더 값에 대해 멤버십 RBAC 를 재검증해야** 안전(현 Rationale 전제). 누락 핸들러 1곳이 IDOR 가 된다 — info-leak 표면이 분산. JWT `workspaceId` 는 fallback 으로만 의미가 남는 어정쩡한 상태 지속.

**옵션 C — 하이브리드 (토큰이 진실, 헤더는 명시 override 만 허용)**
- 설명: switch 엔드포인트로 토큰 갱신을 정식 경로로 두되, `X-Workspace-Id` 헤더는 "멤버십 검증을 통과한 워크스페이스에 한해" override 로 유지.
- 장점: 점진 마이그레이션 가능 — 기존 헤더 사용처를 깨지 않으면서 토큰 단일 진실로 이행.
- 단점: 두 경로가 공존해 우선순위·검증 책임 정의가 복잡. 장기적으로 옵션 A 로 수렴해야 부채가 안 쌓임.

**권장안**: **옵션 A**. 헤더 우선 모델은 멤버십 RBAC 재검증이 모든 핸들러에 누락 없이 깔려야 한다는 분산된 전제에 의존하므로 info-leak 위험이 핸들러 수에 비례한다. 토큰 단일 진실(switch=재발급)은 검증을 진입점 1곳으로 수렴시켜 보안적으로 우월하고, `generateTokens` 가 이미 context 주입형이라 구현 표면도 작다.

**트레이드오프**
- spec §1.5 의 "Planned" 표기 제거 + Rationale §헤더 우선 정책 개정 → project-planner + consistency-check 1라운드.
- 프론트 전환 UX·refresh family 정책 결정이 선행. 옵션 A 채택 시 **결정 2(클레임 명명)가 활성화**된다 — switch 가 payload 의 workspace 클레임을 바꾸는 순간 그 필드명을 확정해야 하므로 결정 1 → 결정 2 의존.

### 결정 2: JWT 클레임 명명 (`workspaceId` vs `activeWorkspaceId`)

**맥락**
- spec 과거 가정은 `activeWorkspaceId` 였으나, 실제 코드는 전부 `workspaceId`:
  - `JwtPayload.workspaceId` (`current-user.decorator.ts:6`)
  - access payload `workspaceId: context.workspaceId` (`auth.service.ts:774`)
  - `WorkspaceId` 데코레이터 fallback `request.user?.workspaceId` (`workspace.decorator.ts:15`)
- spec 본문은 이미 `workspaceId` 로 정정됨 (`12-workspace.md:22, 243` — "token payload 의 활성 워크스페이스 필드는 `workspaceId`").
- **결정 1 의존**: 전환 모델이 토큰 재발급(옵션 A)으로 가야만 "활성(active) 워크스페이스" 라는 의미가 클레임에 강하게 결합한다. 헤더 모델(옵션 B)에서는 클레임이 fallback 일 뿐이라 명명 논쟁의 실익이 거의 없다.

**옵션 A — `workspaceId` 확정 (현 코드 유지)**
- 설명: 캐논 명을 `workspaceId` 로 못박고 spec 의 잔존 `activeWorkspaceId` 흔적을 제거.
- 장점: 코드 변경 0. 이미 본문이 `workspaceId` 로 정정돼 spec-code 정합. 마이그레이션 리스크 없음.
- 단점: "활성 워크스페이스" 라는 전환 의미를 필드명이 직접 드러내지 않음(문서로 보완).

**옵션 B — `activeWorkspaceId` 로 마이그레이션**
- 설명: payload 키를 `activeWorkspaceId` 로 변경. 데코레이터·가드·발급 코드 일괄 수정.
- 장점: 전환(switch) 의미가 필드명에 명시적 — 헤더 컨텍스트(요청 단위)와 토큰 활성 워크스페이스(세션 단위)의 구분이 명확.
- 단점: **유통 중인 access 토큰 호환성 깨짐** — 배포 시점에 발급된 구 토큰은 `workspaceId` 키라 디코딩 실패. 15분 access TTL 동안 dual-read(`activeWorkspaceId ?? workspaceId`) 과도기 코드 필요. 변경 표면이 넓다(데코레이터·테스트·프론트 디코딩까지).

**권장안**: **옵션 A (`workspaceId` 유지)**. 기존 패턴·코드·정정된 spec 본문이 모두 `workspaceId` 이고, 명명 변경의 이득(의미 명시)은 문서/주석으로 충분히 보완 가능한 반면 비용(토큰 호환성·dual-read 과도기)은 실질적이다. 결정 1 이 옵션 A 로 가더라도 클레임명은 그대로 두고 "전환 시 이 필드를 재발급" 으로 기술하면 된다.

**트레이드오프**
- 옵션 A 는 spec 잔존 표기 정리만 → 경량 project-planner 패치. 옵션 B 는 access TTL 만큼의 dual-read 과도기 + 프론트 동반 변경.
- **결정 1 종속**: 결정 1 이 옵션 B(헤더 전용)로 확정되면 본 결정은 사실상 무의미(클레임은 fallback). 결정 1 이 옵션 A/C 일 때만 명명이 load-bearing — 그 경우에도 권장은 `workspaceId` 유지.

### 결정 3: `(owner_id) WHERE type='personal'` 부분 유니크 인덱스 DB 강제

**맥락**
- ⚠️ **플랜 전제 정정**: 플랜 본문(`:15`)은 "TypeORM `@Unique` 데코레이터만 존재" 라고 적었으나, 실제로는 **이미 제거됨**. `workspace.entity.ts:14-20` 은 broad `@Unique(['ownerId','type'])` 를 제거하고 `@Index(['ownerId','type'])`(비유니크)만 남긴 상태이며, 그 사유를 주석으로 명시. 따라서 현재 personal 유일성은 **앱 레이어 전용**(`WorkspacesService.findOrCreatePersonalWorkspace` — find-or-create + catch-refind 폴백)으로만 강제된다. DB 레벨 강제는 0.
- spec Rationale §`personal 워크스페이스 유일성`(`12-workspace.md:268-281`)이 이미 방향을 제시: broad UNIQUE 가 아니라 **부분 유니크 인덱스** `CREATE UNIQUE INDEX ... ON workspace (owner_id) WHERE type = 'personal'`. team 다중 소유는 유지. 단 "기존 데이터 dedup 선행 + TOCTOU race 방어는 별도 hardening 마이그레이션" 으로 분리 권고.
- 마이그레이션 규약(`spec/conventions/migrations.md`): append-only, 단조 증가 V번호(현 max **V094**), `NOT VALID` 패턴 가용. 신규는 `V095__<descriptor>.sql`.

**옵션 A — 앱 레이어 전용 유지 (DB 제약 미도입)**
- 설명: 현 상태 유지. spec 의 부분 인덱스 권고는 "필요 시" 로 남겨둠.
- 장점: 구현 0, 마이그레이션 리스크 0. find-or-create + catch-refind 가 정상 경로에서 중복을 막음.
- 단점: 동시 콜드스타트 요청 TOCTOU 시 중복 personal 가능(catch-refind 가 대부분 흡수하나 DB invariant 부재). defense-in-depth 없음.

**옵션 B — 부분 유니크 인덱스 마이그레이션 추가 (dedup 선행)**
- 설명: `V095` 로 (1) 기존 owner 당 중복 personal dedup → (2) `CREATE UNIQUE INDEX ... ON workspace (owner_id) WHERE type='personal'`. 큰 테이블이면 `CONCURRENTLY`(`.conf` `executeInTransaction=false`) 고려.
- 장점: DB 레벨 invariant 로 TOCTOU race 까지 차단(defense-in-depth). spec Rationale 권고와 정확히 일치. team 다중 소유 영향 없음.
- 단점: dedup 단계가 데이터에 따라 위험(어느 personal 을 남길지·FK 재지정 정책 필요). 운영 데이터에서 중복이 실재하면 마이그레이션 복잡도 상승.

**권장안**: **옵션 B**. spec Rationale 이 이미 부분 유니크 인덱스를 정답으로 지목했고, personal 유일성은 보안·데이터 무결성 invariant 라 앱 레이어 단일 방어보다 DB defense-in-depth 가 적절하다. 단 Rationale 권고대로 **dedup 선행 + (선택) TOCTOU hardening 분리** 를 지켜 마이그레이션 안전성(`migrations.md` append-only·NOT VALID)을 준수한다.

**트레이드오프**
- 마이그레이션 작성·e2e dry-run(`make e2e-test`) + V번호 가드(`check-migration-versions.py`) 비용. dedup 로직은 운영 데이터 점검 선행.
- spec 변경 최소 — Rationale 이 이미 방향을 담고 있어 "필요 시" → "도입함(V095)" 표기 갱신 수준. 결정 1·2 와 **독립**(전환 모델·클레임명과 무관).

### 결정 4: 워크스페이스 액션 audit 적재 범위 확대

**맥락**
- 현재 `audit_log` 에 적재되는 워크스페이스 액션은 `workspace.transfer_ownership` **1건뿐** (`workspaces.service.ts:533-536`, `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP`).
- `AUDIT_ACTIONS` const(`audit-action.const.ts`)가 구현된 action 의 단일 SoT. 명명 규약 **`<resource>.<verb>`** — audit 은 "일어난 일" 의 기록이라 발생 사건 도메인은 과거분사 시제(integration `created`, user `password_changed`).
- spec §4.1 (`spec/5-system/1-auth.md:366-371`)이 **Planned 액션을 이미 캐논 명으로 확정**:
  - 워크스페이스: `workspace.created`, `workspace.updated`, `workspace.deleted`
  - 멤버: `member.invited`, `member.role_changed`, `member.removed`
- `data-flow/1-audit.md §1.1` 이 목표 커버리지를 추적. 즉 명명·시제 결정은 이미 끝났고 **구현 여부만 남았다**.
- 적재 위치 패턴: `user.*` 는 세션 컨텍스트가 있는 controller 경계에서 기록(주석 §). 워크스페이스 액션은 service(`transfer_ownership` 선례)에서 `auditLogsService.record` 호출.

**옵션 A — 현행 유지 (`transfer_ownership` 만)**
- 설명: 추가 적재 없이 현 상태 유지. spec §4.1 Planned 표를 그대로 둠.
- 장점: 구현 0.
- 단점: spec 이 선언한 목표 커버리지와 코드 간 갭 지속. 워크스페이스 생성/삭제/이름변경·멤버 변동의 감사 추적 부재 — 보안·규제 관점 약점.

**옵션 B — spec §4.1 Planned 전체 구현 (`workspace.*` + `member.*`)**
- 설명: `AUDIT_ACTIONS` 에 `workspace.created/updated/deleted`, `member.invited/role_changed/removed` 추가 후 각 service 경로(createTeam·deleteWorkspace·settings PATCH·addMember/accept·role 변경·remove)에서 `record` 호출.
- 장점: spec §4.1 + `1-audit.md §1.1` 목표 커버리지 충족. 명명·시제가 이미 확정돼 결정 비용 낮음. 기존 `<resource>.<verb>` 과거분사 패턴과 일관.
- 단점: 적재 지점이 여러 service 메서드에 흩어져 구현·테스트 표면이 넓다. 각 record 의 워크스페이스 귀속·actor 메타 일관성 검토 필요.

**옵션 C — 단계적 (고위험 액션 우선: `workspace.deleted` + `member.removed`)**
- 설명: 가장 파괴적/보안 민감한 액션(삭제·멤버 제거)부터 적재, 나머지(created/updated/rename·invited/role_changed)는 후속.
- 장점: 최소 표면으로 핵심 감사 공백(되돌릴 수 없는 액션)을 우선 메움.
- 단점: spec §4.1 의 일괄 목표와 부분 불일치 — "일부 Planned 만 구현" 상태가 추가 추적 대상이 됨.

**권장안**: **옵션 B**. 명명·시제가 spec §4.1 에서 이미 `<resource>.<verb>` 과거분사로 확정돼 결정 비용이 거의 없고, 감사 로그는 "전부 또는 일관 부재" 일 때 가치가 높다(부분 적재는 감사 신뢰도를 떨어뜨림). 기존 `transfer_ownership`·integration·user 액션과 동일 패턴이라 컨벤션 일관성도 유지된다.

**트레이드오프**
- 구현 표면이 service 다수 메서드에 분산 → developer 단계 비용 + 각 경로 테스트. 단 spec 변경은 거의 없음(§4.1 이 이미 캐논 — Planned → 구현됨 표기 갱신 + `AUDIT_ACTIONS` const 추가).
- 결정 1·2·3 과 **독립**. 단 옵션 1(switch) 채택 시 "워크스페이스 전환" 자체를 audit 대상으로 볼지는 별도 판단(현 Planned 표에는 없음 — 필요 시 결정 1 후속으로 분리).
