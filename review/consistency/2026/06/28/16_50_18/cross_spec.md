# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: `spec/5-system/` (1-auth.md, 10-graph-rag.md)

---

## 발견사항

- **[WARNING]** `document:graph_error` 이벤트 — 5-knowledge-base.md 와 10-graph-rag.md 간 기술 불일치
  - target 위치: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 표 및 노트
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md` 182번째 줄
  - 상세: `5-knowledge-base.md` 는 실시간 갱신 이벤트 목록에 `document:graph_error` 를 포함시키고 있다 (`document:graph_started / _progress / _completed / _error / _retry / _failed`). 반면 `10-graph-rag.md` §6 는 "`document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 실제로 emit 하지 않는다 (dead-declared). in-flight 일시 오류는 `document:graph_retry`, 최종 실패는 `document:graph_failed` 로만 신호한다"고 명시한다. 클라이언트가 `document:graph_error` 를 구독해도 수신되지 않으므로, `5-knowledge-base.md` 의 기술이 구현 인터페이스를 잘못 안내하고 있다.
  - 제안: `spec/2-navigation/5-knowledge-base.md` 182번째 줄의 이벤트 목록에서 `_error` 를 제거하거나, `(_error — dead-declared, emit 없음)` 주석으로 dead path 임을 명시한다. `10-graph-rag.md` §6 의 현재 기술이 정확하므로 그쪽을 SoT 로 유지.

- **[INFO]** RBAC 매트릭스 표현 상이 — `spec/5-system/1-auth.md` §3.2 vs `spec/2-navigation/9-user-profile.md` §4.2 vs `spec/2-navigation/4-integration.md` §8
  - target 위치: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스 (`Integration (Org)` 행)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §4.2 (`Integration 생성 (Org)` 행), `spec/2-navigation/4-integration.md` §8 (`생성 | 모든 멤버 | Admin 이상`)
  - 상세: auth spec §3.2 는 `Integration (Org)` 를 `Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R` 로 표기한다. user-profile §4.2 는 생성(Org) 에만 `Owner=✅, Admin=✅, Editor=❌, Viewer=❌` 를 표기한다. integration §8 은 Organization scope 의 생성/수정/전환을 "Admin 이상"으로 기술한다. `spec/0-overview.md` 는 "Organization-scope 의 생성·수정·전환은 Admin+" 가 `spec/integration §8` + `spec/user-profile §4.2` 가 SoT 이며 이들은 상보 관계(모순 아님)라고 명시한다. 실질적 충돌은 없지만, auth spec §3.2 의 `CRUD` 표기가 "Owner 도 직접 Org Integration 을 생성·수정한다"는 의미인지 "Owner 는 Admin 의 상위 역할이므로 Admin+ 임의 권한을 포함한다"는 의미인지 명시되지 않아 독해 시 혼동 여지가 있다.
  - 제안: auth spec §3.2 의 `Integration (Org)` 행에 footnote 를 추가해 "세부 Personal/Org 분리 RBAC 의 SoT 는 `spec/2-navigation/4-integration.md §8` 임을 명시"하거나, `0-overview.md` 의 기존 SoT 주석을 auth spec §3.2 에도 인라인 포인터로 추가한다. 코드 구현 상 변경 불요.

- **[INFO]** `spec/5-system/16-system-status-api.md` §1 구현 갭 — `agent-memory-extraction` 큐 미등재
  - target 위치: `spec/5-system/16-system-status-api.md` §1 큐 레지스트리 표 (별도 `⚠ 구현 갭` 노트 존재)
  - 충돌 대상: `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그
  - 상세: 16-system-status-api.md §1 표에는 `agent-memory-extraction` 이 등재돼 있으나, 동 문서의 노트(`⚠ 구현 갭`)는 코드의 `MONITORED_QUEUES` 상수에 아직 미등재 상태임을 명시하고 있다 (2026-06-10 감사 보고 V-15 추적). spec 상 선언과 코드 구현 간 gap 이지만 spec 문서끼리는 data-flow 카탈로그와 spec 선언 양쪽에 등재돼 있어 spec 내부 충돌은 아니다. 구현 착수 전 확인 사항으로 분류한다.
  - 제안: 구현 착수 시 `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `agent-memory-extraction` 을 추가한다. spec 자체는 정확한 현황을 기술하고 있으므로 변경 불요.

- **[INFO]** `spec/5-system/1-auth.md` §4.1 감사 액션 — Audit Log 표의 `user.*` 명명 일관성
  - target 위치: `spec/5-system/1-auth.md` §4.1 구현 완료 액션 표 (`auth_config.*` 행)
  - 충돌 대상: `spec/conventions/audit-actions.md` (규약 SoT)
  - 상세: auth spec §4.1 구현 완료 액션 중 `auth_config.*` 계열(`auth_config.create`, `auth_config.update` 등)은 과거분사 대신 현재형 동사를 쓴다. 규약(`conventions/audit-actions.md`)은 "CRUD 현재형 예외" 를 인정하므로 이 패턴은 기존 규약과 일치한다. auth spec §4.1.A Rationale 도 이를 명시("auth_config 처럼 resource 단위 현재형으로 통일")하므로 실질 충돌이 없다. 다만 `user.*` (과거분사) vs `auth_config.*` (현재형) 의 비대칭을 처음 보는 구현자가 혼동할 수 있다.
  - 제안: auth spec §4.1 구현 액션 표 주석에 "auth_config.* 은 CRUD 현재형 예외 적용 (conventions/audit-actions.md §2 참조)" 한 줄을 추가하면 혼동이 줄어든다. 필수 변경 아님.

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 측면에서 `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/16-system-status-api.md` 와 대체로 정합적이다. 직접 채택 불가 수준의 모순은 발견되지 않았다. 단 `spec/2-navigation/5-knowledge-base.md` 에서 `document:graph_error` 이벤트를 실제 emit 되는 것처럼 기술해 클라이언트 구현 가이드를 오해할 수 있으므로 WARNING 으로 분류한다. 나머지 두 INFO 항목은 표현 명확성 개선 수준이며 구현을 차단하지 않는다.

---

## 위험도

LOW
