# Consistency Check 통합 보고서

**BLOCK: YES** — naming_collision checker 가 CRITICAL 1건을 확인함 (아래 표)

## 전체 위험도
**MEDIUM** — Critical 1건이 있으나 대상 문서(`plan/in-progress/**`) 내 라벨 명명 충돌로, project-planner 권한 내에서 라벨 변경만으로 즉시 해소 가능. 나머지는 WARNING 3건(모두 문서 정합·서술 보강 수준)·INFO 7건.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 트래커 라벨 `T1`/`T2`(특히 `T2`)가 이 draft 의 편집 대상 문서인 `spec-draft-nullable-notation-followups.md` 안에 이미 다른 의미로 확립된 동명 라벨(chat-channel-binder 리팩터 PR 분할, `#676`)과 충돌 — 같은 문서에서 `T2` grep 시 서로 무관한 두 의미가 뒤섞임 | `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` `## 트래커 반영 (같은 PR)` 표 T1/T2/T3 | `spec-draft-nullable-notation-followups.md` 라인 2251~2530 부근의 기존 `T1`/`T2`(30곳 이상 인용) | 라벨을 겹치지 않는 이름으로 변경(예: `DEL-T1`/`DEL-T2`/`DEL-T3`), 또는 삽입 문장에서 "구현은 **이 draft(spec-draft-deletion-releases-trigger-resources)의 T2**"처럼 매번 스코프 명시. 저장소 내 동일 클래스 선례: `D-*`→`CV-*` 라벨 충돌 2회 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 위 Critical 은 `plan/in-progress/**` 문서 안의 라벨 명명 충돌이며, project-planner(이 draft 작성 권한자) 가 직접 라벨을 바꾸는 것으로 해소 가능하다. 권한 밖 spec drift 유형이 아니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `secret-store.md §5.3` 헤딩이 draft Rationale 의 "§2.1 표·§5.3 예시·§6·§R4 전수 정정" 주장에도 불구하고 여전히 "Trigger 삭제 시" 로 트리거 단일 경로만 지칭 | draft `S10` — "§5.3 예시 — 순서를 뒤집는다" | `spec/conventions/secret-store.md` §5.3 헤딩(라인 331) | 헤딩을 "트리거 행이 없어질 때 — prefix 일괄 삭제(트리거 화면 삭제 예시)" 등으로 넓히거나, Rationale 의 "전수" 표현을 "§5.3 헤딩 제외 전수"로 정정 |
| 2 | cross_spec | 워크플로 삭제의 신규 트랜잭션·행 잠금 메커니즘(D6)이 `data-flow/11-workflow.md` 에는 워크스페이스(S7)와 비대칭적으로 얕게(한 줄 pointer 만) 기록됨 | draft `D6`/`S6` | `spec/data-flow/12-workspace.md` §1.10+§2.1 (`S7`, 액션 표+매핑 표 양쪽에 명시) vs `11-workflow.md` §2.1 Schema 매핑에는 삭제 sink 자체가 없음 | `S6`에 `data-flow/11-workflow.md §2.1` 신규 "workflow \| 삭제 \| 트랜잭션+`pessimistic_write` 행 잠금+트리거 enumerate — 미구현 (Planned)" 행 추가, 또는 비대칭 사유를 Rationale 에 기록 |
| 3 | plan_coherence | T2(모듈 순환 발생 예고)가 같은 트래커(`spec-draft-nullable-notation-followups.md`)에 이미 있는 "역방향 의존 제거로 순환을 줄인다"는 결정(`#676`)을 인용하지 않음 — 코드 실측상 `WorkflowsModule↔ExecutionEngineModule↔WebsocketModule` 3중 `forwardRef` 순환이 이미 있고 D6 구현이 `WorkflowsModule→TriggersModule` 간선을 새로 추가하면 5-모듈 순환으로 확대될 위험 | `## 트래커 반영 (같은 PR)` T2 행, `## 이 draft 가 안 하는 것` "모듈 순환은 구현 설계 문제라 spec 에 적지 않는다" | `spec-draft-nullable-notation-followups.md` 의 기존 T1/T2(`#676`, `impl-chat-channel-binder*.md`) — "역방향 의존을 되살리면 그 작업이 무효화된다"는 명시 경고 | T2 구현 노트(또는 이번 트래커 반영 서술)에 `#676` 선례를 한 줄 인용하거나, T2 착수 시 "협력자를 어느 모듈에 둘지" 우선 검토 항목으로 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 지연된 `secret_store` 정리(커밋 뒤) 단계에 향후 audit 로깅을 추가하면 이미 삭제된 `workspace_id` 를 참조하는 audit INSERT 가 FK(`ON DELETE CASCADE`) 위반으로 실패할 수 있는 구조적 함정 | D4/D6/D7 창3 | T2 구현 노트에 "이 단계는 `workspace_id` 참조 audit 를 남기지 않는다" 한 줄 추가 권고 (조치 불요) |
| 2 | rationale_continuity | 1차 `--spec` CRITICAL("고아 secret 재생산")이 D4(정리시점 통일)·D5(인터리빙 표)·D6(부모 락+같은 트랜잭션 열거)로 실질 해소됨을 확인 | D4~D7 | 조치 불요 — `--impl-done` 단계에서 T2 e2e 항목이 이 인터리빙을 실증하는지만 재확인 |
| 3 | rationale_continuity | "«비활성화»는 제품 의도가 아니라 오기" 판정 근거를 `1-workflow-list.md` 기존 Rationale 4항목 전수 확인으로 검증 — drift 맞음 | Rationale | 조치 불요 |
| 4 | rationale_continuity | D3(외부 호출은 락 밖)·D4(SecretResolver 백엔드 비의존) 인용이 `secret-store.md §3.4`/`4-integration.md` 원문과 정확히 일치 | D3/D4 | 조치 불요 |
| 5 | convention_compliance | S10 frontmatter 지시문("`pending_plans:` 에 … 추가")이 신규 필드 추가와 기존 배열 append 를 구분하지 않아, S1(이미 배열 보유)과 같은 문구를 재사용한 것이 약간 모호 | S10 | "(신규 필드)" 명시 또는 변경 전/후 YAML 스니펫 첨부 |
| 6 | plan_coherence | `deleteByPrefix()` 호출부 "프로덕션 한 곳" 이라는 기존 실측(`backend-lint-gate-broken-on-main.md`)이 T2 구현 이후 낡음(호출부 증가) — 처분 근거(포맷 고정) 자체는 유지됨 | D4~D6/S9/S10 | T2 구현 PR 체크리스트에 "새 호출부도 UUID 기반 prefix 확인" 추가 권고 |
| 7 | plan_coherence | `secret-store.md`/`12-workspace.md` 는 `spec-link-integrity` 의 멀티라인 링크 앵커 검증 사각지대로 이미 지목된 파일 — draft 의 신규 링크는 현재 한 줄 형태라 문제 없으나 편집 중 개행되면 깨진 앵커가 가드를 통과할 수 있음 | S7/S9/S10 | 반영 시 새 마크다운 링크가 한 줄 `[...]( ... )` 형태로 남는지 육안 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 1차 BLOCK 의 두 CRITICAL 은 해소됨. `secret-store.md §5.3` 헤딩 잔여 좁은 표기(WARNING), 워크플로/워크스페이스 문서화 비대칭(WARNING), 향후 audit FK 함정(INFO) |
| rationale_continuity | LOW | 1차 CRITICAL("고아 secret 재생산") 실질 해소를 인터리빙 논증으로 재검증(INFO 3건, 전부 조치 불요) |
| convention_compliance | NONE | 규약 위반 없음. frontmatter 스키마·앵커·데이터플로 인라인 표기·감사 액션 명명·Redis/BullMQ·마이그레이션 append-only 모두 통과. S10 문구 모호성만 INFO |
| plan_coherence | LOW | 트래커 흡수·frontmatter 전이는 정합. T2 모듈 순환이 같은 트래커의 최근 "역방향 의존 제거" 결정(#676)을 인용 안 함(WARNING), 나머지 2건은 INFO |
| naming_collision | MEDIUM | `T1`/`T2` 라벨이 대상 문서에 이미 확립된 동명 라벨과 충돌(CRITICAL). 요구사항 ID·엔티티·API·이벤트·ENV·파일경로·앵커는 전수 확인 결과 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) `## 트래커 반영 (같은 PR)` 표의 `T1`/`T2`/`T3` 라벨을 `spec-draft-nullable-notation-followups.md` 기존 `T1`/`T2`(chat-channel-binder 계열)와 겹치지 않게 변경(예: `DEL-T1`/`DEL-T2`/`DEL-T3`), 또는 삽입 문장마다 "이 draft 의 T2" 로 스코프를 명시해 재분류.
2. `secret-store.md §5.3` 헤딩을 넓히거나 "전수" 표현을 "§5.3 헤딩 제외 전수"로 정정.
3. `data-flow/11-workflow.md §2.1` 에 워크스페이스(S7)와 대칭되는 신규 삭제 트랜잭션/락 행을 추가하거나 비대칭 사유를 기록.
4. T2(모듈 순환) 서술에 `#676` 선례(역방향 의존 제거로 순환 축소) 인용 또는 구현 시 우선 검토 항목 명시.
5. INFO 7건은 선택 반영 — 특히 S10 frontmatter 문구 모호성(#5)과 멀티라인 링크 사각지대 유의(#7)는 반영 비용이 낮으므로 함께 처리 권장.
