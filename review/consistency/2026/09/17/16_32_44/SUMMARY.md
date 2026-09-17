# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건(통합 후) 발견. 호출자는 이 draft 를 `spec/` 에 반영하기 전에 아래 조치를 완료해야 한다.

## 전체 위험도
**CRITICAL** — draft 가 스스로 고치려는 "spec 이 이미 서로 어긋나 있다"는 결함 패턴이, draft 자신의 변경안(S7) 적용 후에도 같은 문서(`secret-store.md`) 안에 새로 재발한다. 또한 신설 규칙(D1/D3)이 확장하는 정확히 그 경로에서, 기존에 명시적으로 defer 되어 있던 secret store 쓰기 원자성 결함이 인용·해소 없이 더 넓은 범위로 재생산될 위험이 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance(CRITICAL) · plan_coherence(WARNING→상향) · cross_spec(WARNING→상향) | `S7` 이 `secret-store.md §R4` 한 문장만 "트리거 행을 없애는 **모든** 경로" 로 정정하고, 같은 문서의 §2.1 호출 규약 표(147행, "시점: Trigger 삭제" 단수)와 §6 cascade 절(388~392행, "`workspace_id` 컬럼은 workspace 삭제 시 cascade 정리용" — draft 자신의 실측이 반증한 거짓 서술)은 그대로 남아, 개정 후 한 문서 안에서 §R4(모든 경로 책임)와 §2.1·§6(트리거 삭제만/이미 정리됨)이 서로 모순한다. | draft `## 변경안 S7` | `spec/conventions/secret-store.md` §2.1(147행), §6(388~392행) | S7 범위를 §2.1 표 + §6 절까지 확장(S8 신설). §2.1 "시점" 칸을 "Trigger 삭제 / Workflow·Workspace 삭제(FK CASCADE)" 로 넓히거나 각주로 §R4 참조 추가. §6 둘째 문단의 "이미 정리된다" 서술은 "workspace 삭제 경로가 명시 DELETE 로 정리한다(2026-09-17 결정 — 그 이전엔 미구현, D4 참고)" 로 시제·사실 교정. |
| 2 | rationale_continuity(CRITICAL) | D1·D3 이 신설하는 워크플로/워크스페이스 cascade cleanup(`deleteByPrefix`·`teardownChatChannel` 등, 트리거 단위 advisory lock 미적용·DB 트랜잭션 밖·행 삭제 전 수행)이, 오늘 같은 PR 체인에서 막 정식 등재된 락 계약(`2-trigger-list.md §3`: "외부 provider 호출은 락 밖" · "락으로 막을 수 없는 삭제 경로 — FK CASCADE") 및 그 이전에 명시적으로 남겨진 미해결 defer 항목("secret store 쓰기·provider 등록이 락 밖이라 삭제 경합 시 고아 자원 — 별도 설계 검토 필요")을 인용·해소하지 않은 채, 그 결함을 워크플로/워크스페이스(N개 트리거 열거)로 넓은 범위 재생산할 수 있다. 동시 `rotate-bot-token`/`rotate-secret`/`PATCH{chatChannel}` 이 cleanup 직전·직후에 성공하면 새로 쓴 secret 이 곧이은 FK CASCADE 로 트리거 없이 orphan 될 수 있다. | draft `D1`·`D3`·`D5`, 변경안 `S2` | `plan/complete/trigger-config-lost-update.md` 후속(developer 범위) 표 미해결 defer 항목; `spec/2-navigation/2-trigger-list.md §3` 동시 쓰기 직렬화 계약 | D5 에 그 defer 항목을 명시 인용하고 이 draft 가 해소하는지 계속 defer 하는지 결정. defer 유지 시 "동시 rotate/PATCH 로 생성된 secret 은 cleanup 이후에도 orphan 될 수 있다(창 2)" 를 D5 에 명시. 해소하려면 cleanup 이 트리거별 `trigger-config` lock 을 짧게 잡고 재존재 확인 후 `deleteByPrefix` 하는 설계를 D3/D4 에 포함. |

## planner 인계 (권한 밖 Critical)

(없음) — 본 검토는 `project-planner` 가 `spec/` 반영 전에 수행하는 `--spec` 단계 자체이며, 위 두 Critical 은 모두 이 draft(및 그 대상 spec 파일)를 직접 편집할 권한이 있는 호출자 자신의 스코프 안에 있다. developer 턴에서 발견된 권한 밖 spec drift 사례가 아니므로 인계 표는 해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | D1~D5 가 전제하는 developer 구현 작업(워크플로/워크스페이스 삭제 코드 변경)이 어떤 `plan/in-progress/**` 에도 등재돼 있지 않다. `secret-store.md`·`1-data-model.md` 는 `status: implemented`(`pending_plans:` 없음)라 문서-코드 괴리를 추적할 자리가 없다. | draft "이 draft 가 안 하는 것" 절 | `spec/conventions/secret-store.md`, `spec/1-data-model.md` (status/pending_plans) | draft 승인·반영 시 `plan/in-progress/<name>.md` 신설(또는 기존 트래커에 항목 추가)하고, 관련 spec 파일에 `pending_plans:` 갱신 또는 명시 포인터 추가. |
| 2 | plan_coherence | 착수 계기였던 트래커 항목(`spec-draft-nullable-notation-followups.md` 항목 8, `rewriteTriggerConfigLocked` 반환값 무시)이 미체크 상태로 남아 있고 이 새 draft 와의 교차 참조가 전혀 없다. | draft "배경" 절 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 8 | 항목 8 옆에 "→ 본 결함(넓은 버전)으로 전환, `spec-draft-deletion-releases-trigger-resources.md` 참조" 추가하고, 항목 8 이 이 draft 완료로 흡수·종결되는지 별도로 남는지 명시. |
| 3 | convention_compliance | `S5` 가 고치는 `12-workspace.md §1.10` 액션 표와 짝을 이루는 `§2.1` Postgres 매핑 표에는 `secret_store` 행이 없어, S5 적용 후에도 두 표가 다시 어긋난다. | draft `## 변경안 S5` | `spec/data-flow/12-workspace.md §2.1`(195~208행) | `secret_store | 삭제(§1.10) | DELETE workspace_id=$1 (선행: 트랜잭션 전 트리거별 prefix 해제) | —` 류의 행 추가. |
| 4 | convention_compliance | `S2` 의 절 제목("«상류» 행의 동작 칸 끝에 덧붙임")과 실제 삽입 콘텐츠(멀티라인 blockquote)가 형식적으로 불일치 — GFM 표 셀에 그대로 넣으면 표가 깨진다. | draft `## 변경안 S2` | `spec/2-navigation/2-trigger-list.md §4.3` 표 | S2 절 제목을 "표 다음에 문단 추가" 로 정정해 반영 담당자가 표 셀에 blockquote 를 붙여넣지 않도록 한다. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Rationale 번호 접두 표기가 파일마다 다름(`secret-store.md` = `R4`, `trigger-list.md` = `R-4`) — 항상 파일 경로와 함께 인용돼 실질 충돌은 없음 | `secret-store.md §R4` vs `2-trigger-list.md §R-4` | 이번 draft 범위 밖. 향후 spec 정비 시 표기 통일 검토. |
| 2 | convention_compliance | `secret-store.md §R4` 제목이 "Trigger FK 미설정" 으로 단수 주어를 유지해 S7 반영 후 본문(모든 경로)과 제목이 괴리될 수 있음 | `spec/conventions/secret-store.md` §Rationale R4 제목 | 필수는 아니나 제목 아래 첫 문장에 범위 확장 캡션 추가 권장. |
| 3 | naming_collision | 기존 요구사항 ID `CCH-AD-03`("Trigger disable/삭제 시 teardownChannel 자동 호출")의 서술 범위가 이 draft 의 새 계약(워크플로/워크스페이스 CASCADE 경로 포함)과 조용히 벌어짐. 식별자 충돌은 아님 | `spec/5-system/15-chat-channel.md:66` | 이번 스코프 필수 아님. 문구를 "트리거 행이 없어지는 모든 경로"로 확장하거나 이 draft 로의 cross-ref 추가 권장. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 핵심 주장(S1~S6)은 실측(spec 원문·코드)과 정확히 일치. `secret-store.md §6` 넷째 자리 누락을 WARNING 으로 지적했고, 이는 통합 단계에서 CRITICAL #1 로 흡수됨. |
| rationale_continuity | CRITICAL | 새 cascade cleanup 경로(D1/D3)가 미해소 상태로 명시 defer 되어 있던 secret store 쓰기 원자성 결함을 인용 없이 더 넓은 범위로 확장 재생산할 위험. |
| convention_compliance | HIGH | S7 이 `secret-store.md` 를 자기모순 상태(§R4 vs §2.1/§6)로 남김(CRITICAL). 매핑표 짝 누락·S2 형식 불일치는 WARNING. |
| plan_coherence | MEDIUM | 동일 `secret-store.md §6` 모순(WARNING→CRITICAL 흡수), developer 구현 트래커 미등재, 착수 계기 항목8 미연결. |
| naming_collision | NONE | 신규 식별자 충돌 없음. 기존 요구사항 `CCH-AD-03` 범위 벌어짐만 INFO. |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** draft 변경안에 `S8` 추가 — `secret-store.md §2.1` 호출 규약 표와 `§6` cascade 절을 `§R4` 와 정합하게 정정한다("모든 경로 책임" 으로 통일, "workspace 삭제 시 이미 정리된다" 거짓 서술 제거/시제 교정).
2. draft `D5` 에 `plan/complete/trigger-config-lost-update.md` 의 미해소 secret store 원자성 defer 항목을 명시 인용하고, 이번 draft 범위에서 해소할지 계속 defer 할지 결정한다 — defer 유지 시 "창 2"(동시 rotate/PATCH 로 생성된 secret 의 orphan 가능성)를 D5 에 명시한다.
3. draft 승인·반영 시 developer 구현 트래커(`plan/in-progress/<name>.md`)를 신설하고, `secret-store.md`·`1-data-model.md` 의 `pending_plans:`/포인터를 갱신한다.
4. `spec-draft-nullable-notation-followups.md` 항목 8 옆에 이 draft 로의 전환 참조를 추가한다.
5. `S5` 관련 `12-workspace.md §2.1` 매핑표에 `secret_store` 행을 추가하고, `S2` 절 제목을 "표 다음 문단 추가" 로 정정한다.
6. (선택) `CCH-AD-03` 문구 확장 또는 cross-ref, Rationale 번호 접두 통일은 별도 후속 검토로 남긴다.
