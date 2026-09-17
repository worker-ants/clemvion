# Cross-Spec 일관성 검토 — spec-draft-deletion-releases-trigger-resources (3차)

## 발견사항

- **[WARNING]** 새 정리 계약(`secret_store` 4경로 적용)이 `data-flow/10-triggers.md §1.4` 의 **기존**
  「Schedule 삭제」행에는 반영되지 않아, 같은 이벤트에 대해 문서 간 결론이 갈린다
  - target 위치: S5 (`spec/data-flow/10-triggers.md §1.4` — schedule 동기화 표에 **행 추가**만
    지시하고, 기존 행은 그대로 둔다)
  - 충돌 대상:
    - `spec/data-flow/10-triggers.md §1.4` 기존 행 — `| Schedule 삭제 | removeJob 으로 BullMQ
      job 해제 + CASCADE delete trigger | — |` (Trigger 열이 `—`, 즉 "그 외 조치 없음"으로 읽힘)
    - S9/S10 이 넓히는 `secret-store.md §R4` · `§2.1` — 새 문면은 "트리거 행이 없어질 때(**트리거·
      스케줄**·워크플로·워크스페이스 삭제)" 로 스케줄 삭제를 명시적으로 포함한다
    - `2-trigger-list.md §4.3`(S2 신설 문단) — "경로는 트리거 화면 삭제 · **스케줄 화면 삭제** ·
      워크플로·워크스페이스 삭제" 로 스케줄 삭제도 같은 계약 대상이라고 못박는다
  - 상세: draft 자신의 실측 표(「트리거 행을 지우는 경로는 넷…」)가 `DELETE /api/schedules/:id`
    를 네 경로 중 하나로 이미 식별했고, DRT-2 구현 항목도 "네 삭제 경로" 전부를 구현 대상으로
    잡는다. 그런데 `10-triggers.md §1.4` 는 Workflow·Workspace 삭제용 **새 행**만 추가될 뿐(S5),
    이미 있던 「Schedule 삭제」행은 편집 대상에서 빠져 있다. DRT-2 구현이 끝나는 순간
    `secret-store.md §2.1`(넷 다 커버) 과 `2-trigger-list.md §4.3`(스케줄 포함이라고 명문화) 은
    맞는 말을 하는데, 정확히 같은 사건("Schedule 삭제")을 이벤트 단위로 서술하는
    `10-triggers.md §1.4` 표만 "—"(추가 조치 없음)로 남아 세 문서가 스케줄 경로에 대해 서로
    다른 이야기를 하게 된다. 이 draft 의 "spec 이 이미 서로 어긋나 있다" 절이 정확히 이 패턴
    (경로 하나만 주어로 잡은 규칙 vs 실제로 넓은 규칙)을 §R4·`1-data-model.md` 에서 찾아 고치는데,
    같은 편집 세트가 `10-triggers.md` 안에 새 버전의 같은 병을 만든다.
  - 제안: S5 를 확장해 기존 「Schedule 삭제」행의 Trigger 열도 함께 고친다(예: `—` →
    `트리거의 secret_store 정리는 [트리거 목록 §4.3] — 미구현 (Planned)`), 또는 최소한 표 아래에
    "위 «Schedule 삭제»·«Trigger(type=schedule) 직접 삭제» 두 행의 자원 정리 계약은 [§4.3] 로
    일원화" 라는 한 줄을 덧붙인다. `2-trigger-list.md §4.3`(S2)가 이미 이 문구 패턴(포인터 + 미구현
    표기)을 갖고 있으므로 그대로 재사용 가능하다.

- **[INFO]** `spec/2-navigation/3-schedule.md §3` 도 같은 이유로 조용히 낡지만, 이쪽은 침묵이지 오기가
  아니다
  - target 위치: draft 의 `spec_impact` 목록 (스케줄 화면 nav 문서가 빠져 있음)
  - 충돌 대상: `spec/2-navigation/3-schedule.md §3` 의 「Schedule 삭제 | 연결된 Trigger cascade
    삭제(확인 다이얼로그…)」행, 그리고 "Schedule 화면에서 삭제 시 Trigger 도 함께 삭제됨" 불릿
  - 상세: 이 문서는 "트리거도 지워진다"는 사실만 말할 뿐 "그 외엔 아무 일도 없다"고 단언하지는
    않으므로 워크플로 목록의 옛 «비활성화» 문구처럼 **틀린 문장**은 아니다. 다만 이 화면이
    `DELETE /api/schedules/:id` 의 유일한 사용자 진입점이라, 새 계약(비밀은 커밋 뒤 삭제·외부
    등록은 트랜잭션 전 해제)을 사용자에게 설명할 자리가 필요하다면 이 문서가 그 자리다. `1-workflow-list.md`
    (S1)·`12-workspace.md`(S7) 는 각자의 nav/data-flow 문서에 포인터를 심었는데 스케줄 쪽만 대칭이 깨진다.
  - 제안: 이번 PR 범위를 넓히기보다, 위 WARNING 처리(§1.4 행 갱신)와 함께 `3-schedule.md` 에도
    같은 포인터 한 줄을 추가하거나, 최소한 "비대상" 표에 "3-schedule.md — 왜 안 건드리는가"를
    한 줄 적어 두면 다음 리뷰에서 같은 지적이 반복되지 않는다.

## 다른 영역과 대조해 문제 없음을 확인한 지점 (참고)

아래는 이번 라운드에서 실제로 대조했고 충돌이 없음을 확인한 항목이다 — 재확인 비용을 줄이기 위해 기록한다.

- `spec/1-data-model.md` §2.21.1 `SecretStore.workspace_id` 현재 문면이 draft S8 의 인용과 정확히
  일치(`TriggersService.delete()` 언급 포함, 존재하지 않는 메서드).
- `spec/conventions/secret-store.md` §R4·§2.1·§5.3·§6 현재 문면이 draft 의 "before" 인용과 일치.
  `TriggersService.delete()` 오기는 `spec/1-data-model.md`·`secret-store.md §R4`·
  `V063__secret_store.sql` 주석 세 곳뿐(draft 의 처분과 일치, migrations 파일은 Flyway 체크섬 사유로
  비대상 처리가 맞다).
- `spec/2-navigation/2-trigger-list.md` §3(동시 쓰기 직렬화)·§4.3(cascade 표)·§4.4(락 대기 상한)
  현재 문면이 S2~S4 의 "다음에 추가"/"교체" 대상과 앵커·문구 모두 일치.
- `spec/2-navigation/1-workflow-list.md` §2.6 "삭제" 행이 S1 의 "before" 문구와 정확히 일치하고,
  `trigger.workflow_id` 가 `NOT NULL … ON DELETE CASCADE`(V001)라는 draft 의 근거도 확인됨 — "비활성화"
  문구는 데이터 모델과 실제로 모순되던 것이 맞다.
- `spec/data-flow/11-workflow.md` §2.1(편집 흐름 표에 "삭제" 행 없음)·§3.1(FK 파급 표에 trigger 행 존재)
  이 draft 의 실측과 일치. `WorkflowsService.remove()` 코드도 트랜잭션·행 잠금이 없음을 확인(D6 의
  "새로 둔다"는 전제가 맞다).
- `spec/data-flow/12-workspace.md` §1.10·§2.1 이 draft 의 인용과 일치하며, 같은 문서의
  "workspace.deleted 감사 제외(구조적 제약)" Rationale·`spec/5-system/1-auth.md §4.1` 의 감사 액션
  목록(`trigger.deleted`/`schedule.deleted`는 존재, `workspace.deleted`는 의도적 부재)과 draft 의
  D2("트리거마다 `trigger.deleted` 감사를 새로 만들지 않는다")가 서로 모순 없이 공존함을 확인.
- `spec/5-system/15-chat-channel.md` CCH-AD-03("Trigger disable/삭제 시 teardownChannel() 자동
  호출", 필수)과 draft 의 D3(best-effort teardown, 실패해도 삭제 진행)는 상충하지 않음 — "필수"는
  호출 자체의 의무이고 best-effort 는 실패 허용 범위라 별개 축이다. `spec/2-navigation/4-integration.md`
  §의 Cafe24 advisory lock 기각 사유(라인 1444 부근) 인용도 정확함.
- `spec/5-system/14-external-interaction-api.md` EIA-AU-07(per-trigger 토큰 삭제 시 자동 invalidate)과
  draft 의 정리 대상 4종(schedule job·chat channel·listener registry·secret_store) 사이에 충돌 없음
  — interaction 토큰은 `Trigger.config` 안 평문이라 행 삭제로 자동 소멸하며, 이는 `secret_store` 정리
  대상이 아니다(§1.1 비대상 근거와 별개 축).
- 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 의 developer 항목 8·9,
  `plan/complete/trigger-config-lost-update.md` 의 "5라운드 W1"·"후속(developer 범위)" 표 인용 모두
  실제 파일 내용과 일치.
  `DRT-` 접두어는 `spec/`·`plan/`·`.claude/docs`·`.claude/skills`·`CLAUDE.md`·`codebase/` 전체 grep
  0건으로 재확인(기존 `T1`/`T2` 는 같은 트래커의 chat-channel-binder 분할 라벨로 별개 네임스페이스).
- `spec/5-system/4-execution-engine.md` 의 락은 `Execution` 행 대상(`SELECT … FOR UPDATE`)이라
  D6 이 새로 두는 `workflow`/`workspace` 행 `pessimistic_write` 와 락 대상이 겹치지 않음 — 데드락
  경로 신설 없음.

## 요약

Cross-Spec 관점에서 이 draft 는 이미 2차례의 `--spec` 검토를 거치며 데이터 모델(`1-data-model.md`
`SecretStore.workspace_id`)·RBAC(트리거 삭제 권한 매트릭스)·상태 전이(`workflow.is_active` FK
CASCADE 파급)·계층 책임(외부 호출은 락 밖 — Cafe24 advisory lock 선례)에 걸쳐 인접 spec 영역과의
근거를 폭넓게 대조해 두었고, 이번 3차 검토에서 그 인용들을 코드·spec 원문과 재대조한 결과 전부
일치했다 — CRITICAL 급 직접 모순은 발견되지 않았다. 다만 draft 자신이 "넷" 이라고 못박은 삭제 경로
중 스케줄 경로만, `secret-store.md`(S9/S10) 와 `2-trigger-list.md §4.3`(S2) 가 넓히는 새 계약이
같은 사건을 서술하는 `data-flow/10-triggers.md §1.4` 의 기존 「Schedule 삭제」행에는 반영되지 않아,
구현(DRT-2)이 착지하는 순간 그 표만 스케줄 경로에 대해 "추가 조치 없음"이라는 낡은 이야기를 하게
된다 — 이 draft 가 §R4·`1-data-model.md` 에서 정확히 고치고 있는 것과 같은 클래스의 결함을 같은
PR 이 `10-triggers.md` 안에 새로 남기는 셈이라 WARNING 으로 표기한다.

## 위험도

LOW
