# Architecture Review — spec-sync-audit (2026-06-03)

## 발견사항

---

### **[INFO]** spec 문서 전용 변경 — 코드 아키텍처 패턴 직접 평가 범위 제한
- 위치: 모든 20개 파일 (spec/conventions/*, spec/data-flow/*)
- 상세: 이번 변경 대상은 전부 spec 문서 갱신이다. 코드 파일 자체는 포함되지 않으므로 SOLID·순환 의존·레이어 구현을 직접 검사할 수 없다. 단, spec 문서가 기술하는 아키텍처 의사결정 및 spec 과 구현 사이의 정합성 갭은 평가 가능하다.

---

### **[WARNING]** `NotificationsService` 의 적재 표면 분산 — 단일 책임 위반 징후
- 위치: spec/data-flow/8-notifications.md — Overview 및 §1
- 상세: spec 갱신을 통해 확인되는 현재 구조에서, 알림 발송 책임이 두 계층에 걸쳐 있다. preference 확인 + channel 계산은 **호출자**(예: `IntegrationActionRequiredNotifierService`)가 담당하고, `NotificationsService`는 `createMany` 배치 INSERT만 수행한다. 이는 단일 책임 원칙(SRP) 관점에서 비즈니스 로직(channel 결정)이 서비스 경계를 넘어 분산된 패턴이다. 현재 spec은 이를 to-be 미구현으로 인식하고 있어 의도적 갭이나, 구현 시점이 늦어질수록 호출자마다 channel 계산 로직이 중복될 위험이 있다.
- 제안: `notify()` 단일 표면 구현 plan(`plan/in-progress/`)이 존재하는지 확인하고, 없다면 미구현 Planned 트래킹을 공식화할 것. 중기적으로는 preference 확인 + channel 결정 + INSERT를 `NotificationsService` 내부로 이동해 응집도를 높인다.

---

### **[WARNING]** `schedule` 생성 시 단일 트랜잭션 미보장 — 원자성 갭
- 위치: spec/data-flow/10-triggers.md §1.4
- 상세: spec 갱신 내용에 따르면 `POST /api/schedules` 시 trigger 저장 **후** schedule 저장을 순차로 수행하며 단일 트랜잭션이 아니다. 중간 실패 시 고아 trigger가 생성될 수 있음을 spec이 명시하고 있다. 이는 데이터 일관성 측면에서 아키텍처 결함이며, 특히 BullMQ job scheduler 등록(`registerJob`)이 schedule 저장 이후 추가로 일어나는 점을 감안하면 실패 경로가 세 단계로 늘어난다 (trigger 생성 성공 / schedule DB 저장 실패 / BullMQ 등록 실패).
- 제안: trigger + schedule INSERT를 단일 트랜잭션으로 묶고, BullMQ 등록은 트랜잭션 commit 후 수행하는 outbox 패턴 또는 commit hook을 적용한다.

---

### **[WARNING]** `workspace.(owner_id, type) UNIQUE` DB 제약 누락 — 인프라 안전망 갭
- 위치: spec/data-flow/12-workspace.md Rationale, §2.1
- 상세: spec 갱신을 통해 `(owner_id, type)` UNIQUE 제약이 TypeORM `@Unique` 데코레이터로만 선언되어 있고 마이그레이션 SQL에 대응 DB 제약이 없음이 명시되었다. 시스템이 엔티티 synchronize를 비활성화하므로 이 제약은 실제 DB 레벨에서 강제되지 않는다. personal workspace 중복 생성을 DB 단에서 막지 못한다.
- 제안: 해당 UNIQUE 제약을 신규 마이그레이션(예: V<N>)으로 추가한다. 기존 데이터에 중복이 없음을 확인한 후 `CREATE UNIQUE INDEX CONCURRENTLY`로 적용한다.

---

### **[WARNING]** `X-Workspace-Id` 헤더가 JWT보다 우선 — 인증/인가 경계 불명확
- 위치: spec/data-flow/12-workspace.md Rationale "X-Workspace-Id 헤더 우선 정책"
- 상세: 현재 `WorkspaceId` 데코레이터가 클라이언트가 보낸 `X-Workspace-Id` 헤더를 JWT payload의 `workspaceId`보다 우선 수용한다. spec은 이를 "토큰 재발급 기반 전환(§1.5)이 미구현인 동안의 임시 수단"으로 명시하면서, "헤더 값으로 워크스페이스 컨텍스트를 지정할 수 있다"고 기술한다. 이는 클라이언트가 임의의 workspace ID를 헤더로 주입할 수 있다는 뜻이며, RBAC 검증이 각 핸들러/서비스에서 완결된다는 전제에만 의존한다. 해당 전제가 모든 엔드포인트에서 일관되게 지켜지는지 검증이 없으면 privilege escalation 경로가 된다.
- 제안: (1) `X-Workspace-Id` 헤더 수용 시 요청자가 해당 workspace의 멤버인지 JWT claims와 교차 검증하는 미들웨어/가드를 추가하거나, (2) §1.5 workspace switch 엔드포인트를 우선 구현해 헤더 의존을 제거한다.

---

### **[INFO]** `alert_<rule.type>` 동적 notification type — DB CHECK 제약 밖
- 위치: spec/data-flow/8-notifications.md §1.1 Type 별 source
- 상세: spec이 명시하듯 `alert_<type>` notification type 값은 동적이라 V052 CHECK 제약 목록 밖이다. DB 수준의 열거 보호가 없으므로 alert rule type이 추가될 때 notification type이 묵시적으로 따라 증가한다. 이는 "코드-스펙 정합성 가드 범위 밖"으로 추적 중임이 spec에 명시되어 있다.
- 제안: `alert_rule.type`과 notification type의 연관을 명시적 매핑 레이어로 캡슐화하거나, notification type CHECK를 wildcard 패턴(`alert_%`)으로 완화하는 마이그레이션을 적용해 의도를 DB에도 기록한다.

---

### **[INFO]** `ShadowWorkflow` in-memory 패턴 — 아키텍처 명확화
- 위치: spec/data-flow/11-workflow.md §1.4
- 상세: spec 갱신을 통해 workflow-assistant 모듈이 `NodesService`/`EdgesService`를 import하지 않고 in-memory replica `ShadowWorkflow`를 사용하는 구조가 명확히 기술되었다. 이는 의존성 역전 원칙(DIP) 관점에서 긍정적 결정이다 — assistant 모듈이 편집 서비스 구현체에 직결되지 않고 프론트엔드 editor-store → `POST /:id/save` 경로로만 persist가 일어난다. 레이어 경계가 명확하고 부작용 범위가 제한된 좋은 패턴이다.

---

### **[INFO]** `AuthConfigsService.verifyWebhookRequest` 분리 — 단일 책임 개선
- 위치: spec/data-flow/10-triggers.md §1.2
- 상세: spec 갱신에서 webhook 인증·ip_whitelist·`last_used_at` 갱신이 `HooksService`에서 `AuthConfigsService.verifyWebhookRequest`로 위임되었음이 명확히 기술되었다. 인증 검증 책임이 별도 서비스로 이동해 응집도가 높아진 아키텍처 개선이다.

---

### **[INFO]** BullMQ repeatable scheduler 이관 — 멀티 인스턴스 중복 실행 해소
- 위치: spec/data-flow/10-triggers.md §1.3, spec/data-flow/9-observability.md §1.3, spec/data-flow/0-overview.md
- 상세: `@Cron` 기반 sweep에서 BullMQ `upsertJobScheduler` 기반으로 이관된 내용이 spec에 반영되었다. 멀티 인스턴스 환경에서 중복 실행을 BullMQ 레이어에서 방지하고, `next_run_at`이 발사 트리거가 아닌 정보성 컬럼임을 명시한 것은 아키텍처 계층 책임 분리가 개선된 패턴이다.

---

### **[INFO]** `spec-pending-plan-existence.test.ts` 가드 완화 — `plan/complete/` 허용
- 위치: spec/conventions/spec-impl-evidence.md §4
- 상세: `pending_plans:` 경로가 `plan/in-progress/` 외에 `plan/complete/`에도 실존을 허용하도록 완화되었다. 이는 plan이 complete로 이동한 후에도 spec의 `status: partial`이 자동 승격 되기 전 기간 동안 가드가 false-fail을 내지 않도록 하는 실용적 완화다. 아키텍처 규약 보호 도구로서 과도한 엄격함을 줄인 합리적 변경이다.

---

## 요약

이번 변경은 20개 spec 문서의 동기화 갱신으로, 구현 현황을 spec에 반영하고 기술 부채(미구현 planned 항목)를 명시화하는 작업이다. 코드 자체의 수정은 없으나 spec이 노출하는 아키텍처 갭 중 주목할 사항은 두 가지다. 첫째, `NotificationsService`의 channel 계산 책임 분산(SRP 위반 징후)과 `schedule` 생성의 비원자성은 현행 구현의 일관성 리스크이며 추적 plan이 있거나 신설되어야 한다. 둘째, `X-Workspace-Id` 헤더 우선 수용은 임시 수단으로 명시되어 있으나 RBAC 우회 벡터가 될 수 있으므로 §1.5 workspace switch 구현 또는 헤더 멤버십 교차 검증 가드가 우선 해소 대상이다. `workspace.(owner_id, type)` UNIQUE 제약의 DB 레벨 부재도 데이터 무결성 보호 측면에서 마이그레이션 추가가 필요하다. 반면 `ShadowWorkflow` 패턴, `AuthConfigsService` 인증 위임, BullMQ repeatable scheduler 이관은 레이어 책임과 모듈 경계를 개선한 긍정적 아키텍처 방향이다.

## 위험도

MEDIUM
