# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 LOW 판정. Redis 키 세그먼트 명명(`<endpoint>`)의 혼동 가능성과 draft 문서 구조(`## Rationale` 부재)가 반복 지적되나 모두 WARNING/INFO 수준이며 target 의 스펙 변경 결정 자체를 무효화하지 않는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision / convention_compliance (중복 지적, 통합) | 신규 Redis 키 세그먼트 `<endpoint>` 가 기존 확립 용어 `endpointPath`(webhook 트리거 URL 경로, `spec/1-data-model.md:234,881`, `spec/5-system/12-webhook.md` 다수)와 표면적으로 겹쳐 오독 소지 — target 은 세그먼트의 리터럴 값 규칙(`interact`\|`cancel` 고정 문자열 여부)도 명시하지 않음 | `## 제안 변경` §1 표 — `interaction:idempotency:<executionId>:<endpoint>:<key>` | `spec/1-data-model.md:234,881`, `spec/5-system/12-webhook.md`(`endpointPath` mutable 개념) | `<endpoint>` 를 `<command>`/`<action>`(§1.2 dispatch 표 어휘와 정렬) 등으로 개명하거나, 표에 값 도메인(`interact`\|`cancel`)을 한 줄 명시 |
| 2 | convention_compliance | draft 문서에 `## Rationale` 전용 섹션 부재 — project-planner SKILL.md §작업워크플로 3·4번("본문 끝에 `## Rationale`", "BLOCK:NO+Warning → `## Rationale`에 노트") 위반. 근거는 주제별 섹션에 분산 서술됨 | 문서 전체 (헤더 목록 전부) | `.claude/skills/project-planner/SKILL.md` §작업워크플로 3·4번 | 문서 끝에 `## Rationale` 섹션 신설 — "왜 execution 단위인가"·"왜 endpoint 축 추가"·"토큰 대신 executionId" 요약 + 본 consistency-check 노트 자리 마련. 형제 draft `spec-draft-eia-r8-alignment.md` 도 동일 이탈 반복 중이므로 SKILL.md 조항 자체의 관행 정합 여부도 함께 재확인 권장 |
| 3 | cross_spec | in-process trusted 경로(chat-channel)가 `CCH-SE-02`(`spec/5-system/15-chat-channel.md` L88)에서 참조하는 "EIA Idempotency-Key" dedup 메커니즘이 이 draft 의 스코프 모델(HTTP `req.interaction.executionId` 전제)과 아예 다른 층이며, target 이 이를 명시적으로 배제하지 않음. 실 코드 확인 결과 `ParsedUpdate.idempotencyKey` 는 애초에 dead field 로 draft 이전부터 미배선 | `## 무엇이 깨지는가 — 두 축` 및 `## 스코프 식별자를 무엇으로 할 것인가` | `spec/5-system/15-chat-channel.md` L88 `CCH-SE-02` | target 에 "본 draft 는 HTTP 인바운드(`interact`/`cancel`) 경로만 스코프하며 in-process trusted caller(chat-channel)의 `CCH-SE-02` 는 범위 밖(별도 미배선 상태)" caveat 한 줄 추가. `CCH-SE-02` dead-field 갭 자체는 별도 항목으로 분리 등록 |
| 4 | plan_coherence | 선행 backlog(`backend-lint-gate-broken-on-main.md` L571-572, L557)의 "조치 방향" 문구가 2-세그먼트(`<executionId>:<key>`)로 남아있는데, target 은 axis 2 를 추가해 3-세그먼트(`<executionId>:<endpoint>:<key>`)로 확장 — 이 확장을 backlog 문구에 반영할 계획이 체크리스트에 구체화되지 않음 | `## 동반 갱신 (구현 턴)` 및 `## 체크리스트` 마지막 줄 | `plan/in-progress/backend-lint-gate-broken-on-main.md` L557, L571-572 | 체크리스트 항목을 구체화 — `backend-lint-gate-broken-on-main.md` L571-572·L557 을 3-세그먼트 키로 갱신하고 axis 2 근거를 한 줄 남기도록 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | R16("cancel = interact 의 편의 alias")과의 오독 가능성 — alias 는 응답 DTO 형태 공유일 뿐 idempotency 캐시 네임스페이스 공유를 의미하지 않음 | §R8 신규 Rationale 문단 예정 자리 | "R16 의 alias 는 응답 DTO 공유일 뿐 캐시 네임스페이스 공유가 아니다" 한 줄 명시 |
| 2 | rationale_continuity | 유사 선례 인용 가능 — `bg:<executionId>:<backgroundRunId>` 키 분리 사례와 구조적으로 동형 | §R8 신규 Rationale 문단 | 선례 한 줄 인용으로 "임기응변 아님" 근거 보강 |
| 3 | cross_spec | endpoint discriminator 리터럴이 문서 내부에서 `submit`(트리거 응답 payload)과 `interact`(경로/섹션명)로 이미 갈라져 있음 | `## 제안 변경 1` | `<endpoint>` 값은 `context.getHandler().name`(`interact`/`cancel`) 기준이며 `endpoints.submit` 표시용 별칭과 무관함을 한 줄 명시 |
| 4 | convention_compliance | 제안 Redis 키가 `spec/5-system/4-execution-engine.md §9.1` 정식 키 패턴(`{service}:{workspaceId}:{resource}:{id}:{sub}`)을 따르지 않음(기존부터의 이탈 연장, 신규 위반 아님) | `## 제안 변경` §1 표 | §9.1 "패턴 예외 전역 키" 목록에 `interaction:idempotency:<executionId>:<endpoint>:<key>` 등재 검토(단, `spec_impact` 에 `4-execution-engine.md` 추가 필요) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `CCH-SE-02` in-process 경로 미배선 caveat 누락(WARNING), endpoint 리터럴 명명 불일치(INFO) — 두 spec 대상 전량 대조, 라인·rationale·코드 전제 모두 실측 일치 |
| rationale_continuity | LOW | 과거 결정 재도입/번복 없음 — R8 키 네임스페이스 공백을 최초로 메우는 정당한 결정. R16 오독 방지·선례 인용 INFO 2건만 |
| convention_compliance | LOW | `## Rationale` 섹션 부재(WARNING, SKILL.md §작업워크플로 3·4번), §9.1 키 패턴/endpoint 용어 중복(INFO 2건) |
| plan_coherence | LOW | backlog 항목 정당 계승·종결이나, axis 2 확장분을 backlog 문구에 반영할 계획 누락(WARNING). 인용 라인·코드 전제 전량 실측 일치 |
| naming_collision | LOW | `<endpoint>` vs 기존 `endpointPath`(webhook 트리거 URL) 혼동 가능(WARNING). 그 외 신규 명명 없음, 병행 draft 와도 실질 편집 충돌 없음 |

## 권장 조치사항
1. (경고 #1, naming_collision+convention_compliance 중복) `## 제안 변경` §1 표의 `<endpoint>` 세그먼트를 `<command>`/`<action>` 등으로 개명하거나 값 도메인(`interact`\|`cancel`)을 한 줄 명시해 `endpointPath`(webhook 트리거 URL, 별개 개념)와의 혼동을 차단.
2. (경고 #2) 문서 끝에 `## Rationale` 섹션을 신설해 project-planner SKILL.md §작업워크플로 3·4번을 충족시키고, 본 consistency-check 노트를 남길 자리 확보. 형제 draft `spec-draft-eia-r8-alignment.md` 도 동일 패턴이므로 함께 정리하거나 SKILL.md 조항의 실제 관행 정합 여부를 재확인.
3. (경고 #3) target 에 "본 draft 는 HTTP 인바운드(`interact`/`cancel`)만 스코프, in-process trusted caller(chat-channel `CCH-SE-02`)는 범위 밖" caveat 한 줄 추가. `CCH-SE-02` dead-field 갭은 별도 후속 항목으로 분리 등록(project-planner 판단).
4. (경고 #4) `## 체크리스트` 마지막 항목을 구체화 — `backend-lint-gate-broken-on-main.md` L571-572·L557 을 3-세그먼트 키(`<executionId>:<endpoint>:<key>`)로 갱신하고 axis 2 근거를 명시하도록 지시.
5. (INFO, 선택) R16 오독 방지 한 줄 + 유사 선례(`bg:<executionId>:<backgroundRunId>`) 인용을 §R8 신규 Rationale 문단에 반영. §9.1 Redis 키 패턴 예외 목록 등재는 `spec_impact` 확장이 필요하므로 별도 판단.
