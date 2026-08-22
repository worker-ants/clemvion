# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (좌표계 표 값 오류가 문서 자신의 서술·SoT·코드와 정면 모순)

## 전체 위험도
**HIGH** — Critical 1건은 이 문서의 핵심 산출물(좌표계 표)이 스스로 내건 완전성/정확성 기준을 위반하는 자기지시적 결함이나, 수정 자체는 표 두 셀의 값을 정정하는 1줄 규모로 용이함. WARNING 5건은 실행 전 보완 권고 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (cross_spec·naming_collision 도 동일 셀을 WARNING/INFO 로 지적 — 최강 등급 채택) | 좌표계 표 82·83행(`MAX_REDACT_DEPTH`, 프런트 `MAX_MASK_DEPTH` 사용) "값" 열이 `= 1` 로 기재되어 있으나 실제 값은 `10` — 문서 자신의 90행("2·4는 값이 같고... 둘 다 10"), EIA §R17 SoT("마커 집합·깊이 상한의 SoT 는 `@workflow/masked-markers`"), 코드(`sanitize-error-message.ts:128` `MAX_REDACT_DEPTH = MAX_MASK_DEPTH`, `masked-markers/src/index.ts:81` `MAX_MASK_DEPTH = 10`) 와 모두 모순 | `plan/in-progress/spec-draft-egress-masking-convention.md` §"실측한 좌표계" 표 82-83행 | 같은 문서 90행 / EIA §R17 / 코드 SoT / 검증 기준 140행("모든 셀이 실측 출처를 가진다") | 82·83행 "값" 열을 `10`(또는 `= MAX_MASK_DEPTH(10)`)으로 정정하고 90행과 표를 재대조. 표기 자체도 "row 1과 동일(=10)"처럼 숫자+참조 병기로 바꿔 리터럴 `1`로 오독될 소지를 없앤다. 향후 `spec/conventions/egress-masking.md` 신설 시 이 오류가 그대로 정본으로 승격되지 않도록 주의(re-run `/consistency-check --spec` 권고) |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 `plan/in-progress/**` draft 문서 자체의 표 값 오류이며, 이 draft 를 작성/수정 중인 호출자(project-planner 권한 범위, `plan/**`+`spec/**` 쓰기 가능)가 직접 정정 가능. 권한 밖 spec drift 가 아님.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | Rationale 이 스스로 명시한 3개 표면(EIA·WS·node-output) 중 WS 인입 포인터가 `## 작업` 체크리스트에서 누락 | target `## 작업` 3번째 항목 | `spec/5-system/6-websocket-protocol.md §4.1`(값-패턴 마스킹 콜아웃, `MAX_SANITIZE_DEPTH` 소비처) | `## 작업` 인입 포인터 항목에 `6-websocket-protocol.md §4.1` 을 세 번째 진입점으로 추가 |
| 2 | convention_compliance | 정본 트래커가 지시한 `code:` frontmatter 등재(네 파일)가 target 의 작업/검증 기준에 구체화되지 않음 | target `## 작업` 4번째 항목, `## 검증 기준` 2번째 항목 | `spec/conventions/spec-impl-evidence.md §2/§3/§4`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:849-850`(정본 트래커 지시) | `id`, `status`(예: `implemented`), `code:` 대상 파일 목록(masked-markers/src/index.ts·sanitize-error-message.ts·websocket.service.ts·interaction.service.ts)을 명시해 `spec-code-paths.test.ts` 재작업 위험 제거 |
| 3 | plan_coherence | `websocket.service.ts` 를 절대 라인 번호로 인용 — 같은 worktree 계열 형제 plan(`ws-event-types-extract.md`)이 이미 "라인 인용은 리팩터마다 stale 해진다"는 교훈을 실측으로 얻고 3개 문서를 심볼 기준으로 전환 완료(2026-08-15, target 착수보다 이전)한 뒤인데도 target 이 이 교훈을 반영하지 않음 | 좌표계 표 5행 각주(`interaction.service.ts:112`/`websocket.service.ts:422`), "마스킹은 한 번" 2번(`websocket.service.ts:406-417`), 검증 기준 3번째 불릿("파일:라인 또는 심볼") | `plan/in-progress/ws-event-types-extract.md` §18_53_27 plan_coherence W2 교훈 | 인용을 심볼 기준(`stripExternalOnlyFields()` 호출부 / `toFanoutEnvelope` JSDoc 등)으로 전환하거나 최소한 "라인은 실측 시점 스냅샷" caveat 명시. 검증 기준의 "파일:라인 또는 심볼" 문구도 심볼 우선으로 조정 검토 |
| 4 | naming_collision | backend `hasMaskedLeaf`(`reject-masked-resubmission.ts`, `MAX_REDACT_DEPTH` 공유 소비처, EIA §5.4 에 이미 문서화됨)가 좌표계 표에서 누락, frontend `hasMaskedMarkerLeaf` 와 한 글자 차이라 혼동 위험 | 좌표계 표 2행(`MAX_REDACT_DEPTH`) 소비처 열 | `spec/5-system/14-external-interaction-api.md:1581`("판정기는 같은 파일의 `hasMaskedLeaf`") | 2행 소비처 열에 `hasMaskedLeaf`(Manual 실행 재제출 거부 판정)를 추가하거나 3행 옆에 "backend 대응 스캐너는 `hasMaskedLeaf`(별개 파일·이름, 혼동 주의)" 각주 추가 |
| 5 | cross_spec + naming_collision (중복 통합) | 신설 문서명 `egress-masking.md`/표제어 "egress 마스킹"이 이미 "AuthConfig 마스킹 정책의 단일 진실"을 자처하는 `1-data-model.md §2.17.2` 와 상위 용어를 공유해 독자가 두 SoT 를 혼동할 위험 | target Overview 및 신설 예정 파일 `spec/conventions/egress-masking.md` | `spec/1-data-model.md §2.17.2`("본 §2.17.2 가 AuthConfig 마스킹 정책의 단일 진실"), `spec/conventions/secret-store.md`(이미 §2.17.2 에 대한 "비대상" 콜아웃 선례 보유) | 신설 문서 Overview 에 "비대상 — `AuthConfig.config` 필드 마스킹은 `1-data-model.md §2.17.2` 가 SoT" 1줄 캐비엇 추가(secret-store.md 선례와 동형) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 동일 파일(`14-external-interaction-api.md`, `6-websocket-protocol.md`)을 건드리는 병행 세션 2건(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`) 존재 — 내용 충돌 아닌 머지 라인 충돌 가능성 | target frontmatter `spec_impact` | 실제 파일 편집 직전 `git log origin/main -- spec/5-system/14-external-interaction-api.md` 로 두 plan 머지 여부 재확인(프로젝트 관행) |
| 2 | cross_spec | `spec/conventions/swagger.md §3`("egress 마스킹 대상" DTO 설명 예외)가 가리킬 구체 SoT 링크가 현재 없음 — 신설 문서가 채울 수 있는 자리 | `swagger.md §3` | 이번 PR 범위 아님. 후속으로 swagger.md §3 예시에 신규 문서 링크 추가 고려(강제 아님) |
| 3 | plan_coherence | `chatChannel` egress 노출(마스킹 자체는 안전 확인됨)의 spec 미문서화 갭이 형제 plan(`spec-draft-eia-notification-payload-contract.md` §"후속(developer)")에 열려 있는데 target 이 상호 참조하지 않음 | "마스킹은 한 번" 2번(`attachRoutingContext`/`chatChannel`) | "소유하지 않는다" 표·잔여 목록에 해당 열린 항목 포인터 한 줄 추가 검토. 차단 사유 아님 |
| 4 | convention_compliance | `## 작업` "문서 가드" 항목이 `spec-frontmatter.test.ts` 를 명시하지 않음(가드 자체는 전수 스캔이라 실질 위험 낮음) | `## 작업` 5번째 항목 | 원하면 목록에 `spec-frontmatter` 추가. 강제성 낮음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 좌표계 표 값 오독 위험(WARNING), 신설 문서명과 §2.17.2 용어 겹침(WARNING), 병행 세션 라인충돌 가능성(INFO) |
| rationale_continuity | MEDIUM | 좌표계 표 82·83행 값이 문서 자신·R17·코드 SoT 와 정면 모순(**CRITICAL**) — 그 외 "기각된 대안" 인용 등은 전부 실재 확인되어 정합 |
| convention_compliance | LOW | WS 인입 포인터 누락(WARNING), `code:` frontmatter 세부 미확정(WARNING), spec-frontmatter 가드 미명시(INFO) |
| plan_coherence | LOW | `websocket.service.ts` 절대 라인 인용이 형제 plan 의 stale 교훈 미반영(WARNING), chatChannel 문서화 갭 미참조(INFO) |
| naming_collision | LOW | backend `hasMaskedLeaf` 누락·frontend 명과 혼동 위험(WARNING), "값=1" 표기·마스킹 용어 겹침(INFO, cross_spec 과 통합) |

## 권장 조치사항
1. **(BLOCK 해소)** 좌표계 표 82·83행 "값" 열을 `10`으로 정정하고 90행 서술과 재대조 — `plan/in-progress/spec-draft-egress-masking-convention.md`.
2. `## 작업` 인입 포인터에 `6-websocket-protocol.md §4.1` 추가.
3. `## 작업`/`## 검증 기준`에 `code:` frontmatter 대상(id·status·4개 파일) 구체화.
4. `websocket.service.ts` 절대 라인 인용을 심볼 기준으로 전환하거나 stale 가능성 caveat 명시.
5. 좌표계 표 2행 소비처에 backend `hasMaskedLeaf` 추가(프런트 `hasMaskedMarkerLeaf` 와 혼동 방지 각주 포함).
6. 신설 문서 Overview 에 `1-data-model.md §2.17.2`(AuthConfig 마스킹) 비대상 캐비엇 1줄 추가.
7. (선택) chatChannel 문서화 갭·swagger.md §3 링크·spec-frontmatter 가드 명시는 여유 시 반영.

위 1건(BLOCK 해소)을 정정한 뒤 `/consistency-check --spec` 재실행을 권고합니다.
