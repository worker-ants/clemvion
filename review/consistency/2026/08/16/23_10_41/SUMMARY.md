# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 결과 확보(전문 인라인+디스크 파일 모두 존재), 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-eia-fanout-masking.md`)은 이미 머지 대기 중인 구현(`1b8fd5cc7`·`fe6a54c80`)을 spec 에 정확히 등재하는 문서이며, 직전 `--impl-prep` 라운드(`22_22_36`)의 WARNING 4건을 실측 검증까지 마친 채 정확히 반영한다. 남은 문제는 전부 WARNING/INFO 수준의 문서 완결성·자기정합성 이슈다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | draft 산출물에 `## Rationale` 마감 섹션이 없음 | target 문서 전체 (변경1→변경2→변경3→검토 요청 관점 순으로 종료) | `.claude/skills/project-planner/SKILL.md` 워크플로 3번("본문 끝에 `## Rationale`") + 동일 패턴 완료 draft 4건(전부 보유) | `## Rationale` 섹션 신설: (a) ①·②flip 근거, (b) egress-only 원칙과 ingestion 마스킹 공존 논리, (c) §4.1 채택 이유를 한 곳에 모으거나, "22_22_36 후속조치 모음이라 inline 근거로 대체한다"는 의도를 서두에 명시 |
| 2 | plan_coherence | 같은 worktree 의 developer plan 최상단 "택일" 표가 이후 뒤집힌 최종 결정(wire+fanout 둘 다 마스킹)을 반영하지 않아 같은 문서 안에서 자기모순 | (target 자체는 무관 — target 은 최종 결정을 정확히 반영) | `plan/in-progress/eia-fanout-and-internal-data-masking.md` :18-24(특히 :22 "fanout 브랜치에만") vs 같은 문서 :163-164 checklist·정본 트래커 `spec-sync-external-interaction-api-gaps.md` :252-259 | `eia-fanout-and-internal-data-masking.md` 최상단 표 A행(및 B행)에 target 이 쓰는 취소선+정정 패턴으로 "~~fanout 브랜치에만~~ → wire+fanout 둘 다(2026-08-16 재택일)" 주석 추가 |
| 3 | naming_collision | target 이 신설하는 §4.1 캐비엇("emit 시점에 값-패턴 마스킹")과 같은 파일 §4.1 표 안 기존 각주(":184 이 관문을 지나지 않아 아직 원문이다")가 `execution.node.*` emit 마스킹 여부를 정반대로 서술 — target 자신이 편집하는 파일 안 self-contradiction | `spec/5-system/6-websocket-protocol.md` §4.1 (target "변경 2-b" 신설 캐비엇) vs 같은 파일 :184 기존 각주 | target 자기 자신(변경 2 체크리스트 누락) | target "변경 2" 체크리스트에 `:184` 각주 정정 항목 추가 — 예: "nested `execution.error`/`execution.node.*` emit 모두 값-패턴 마스킹을 받는다(2026-08-16, EIA §R17)" 로 교체하거나 새 §4.1 캐비엇을 가리키는 참조로 대체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | webhook Rationale 의 "DB 잔존=유출 표면" 논거를 1-d 가 명시적으로 인정·상쇄하지 않는 미세한 설명 공백(§R17 기존 텍스트에 근거는 이미 있어 모순은 아님) | `spec/5-system/12-webhook.md` Rationale :439 vs target 변경1 1-d | 1-d 문단 끝에 "DB 잔존 자체가 유출 표면이라는 우려는 §R17 egress-only 원칙 아래서도 동일 적용되며, 자유 텍스트는 대상 패턴을 사전 특정할 수 없어 ingestion 단계에서 걷어낼 수 없다" 한 문장 추가 권고 |
| 2 | cross_spec | WS §2-b 예시 필드(error/message)와 EIA 1-a 예시 필드(error/input/output)가 서로 달라 "완전 열거"로 오독될 여지(실제 구현은 필드명 불문 payload 전체) | `6-websocket-protocol.md` §2-b vs `14-external-interaction-api.md` 1-a | 두 문구 모두 "예시"임을 명시해 통일 표기 |
| 3 | cross_spec / rationale_continuity | `execution.paused`(계획·미구현) 행에 `nodeName` 잔존 — 정합적 처리(미구현 이벤트라 실측 emit 대상 아님)지만 향후 구현 시 같은 drift 재발 소지 | `6-websocket-protocol.md` §4.1 :185 | 조치 불필요, 구현 착수 시 유의사항으로 기록 권고 |
| 4 | rationale_continuity | `error-handling.md` §2.2 예시 JSON(:249)에 `nodeName` 잔존 — 별개 REST 에러 포맷이라 target 정정과 무관, 깨지지 않음 | `spec/5-system/3-error-handling.md` §2.2 | 조치 불필요(정보 제공용). stale 이면 별도 cross-spec 정합화 항목 |
| 5 | rationale_continuity | `inputData` 라는 동일 필드명이 webhook 헤더-ingestion 마스킹과 EIA egress 값-마스킹 두 문맥에 겹쳐 쓰여 향후 혼동 여지(현재는 1-d+변경3 이 이미 구분해 실질 위험 낮음) | 변경 3 (webhook §5.3 캐비엇) | (선택) "이 스코프 한정은 `Execution.inputData` 의 헤더 서브필드에 한정되고, body/자유 텍스트 부분은 EIA §R17 잔여② 해소가 별도 커버한다" 한 문장 추가 |
| 6 | convention_compliance | 신규 교차 참조(`[12-webhook §5.3](./12-webhook.md)`)가 앵커 미포함 — 같은 절을 가리키는 `5-expression-language.md` 기존 3곳은 앵커 포함(`#53-민감-헤더-마스킹-ingestion`) | 변경1 1-d 첫 문장 | 앵커를 붙여 기존 인용 스타일과 통일 |
| 7 | plan_coherence | developer plan 의 트래커 라인 인용(`:235`/`:240`/`:223`)이 세션 중 트래커에 새 항목 추가로 이미 drift(현재 D=:235, A=:252, B=:261) | `eia-fanout-and-internal-data-masking.md` :15 | 낮은 우선순위 — 다음 편집 시 심볼/제목 인용으로 대체 또는 줄번호 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 직전 라운드 WARNING 5건 중 spec 관련 4건 전부 실측 검증 정합. 잔차는 webhook Rationale 설명 공백·필드 예시 표기 통일 권고(INFO) |
| rationale_continuity | LOW | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌 전부 미발견. `inputData` 용어 중의 소지만 INFO |
| convention_compliance | LOW | `## Rationale` 섹션 부재(WARNING) + 앵커 인용 스타일 불일치(INFO). 명명·출력 포맷·API 문서·금지 항목 규약은 전부 준수 |
| plan_coherence | LOW | target 자체는 정본 트래커·최종 결정과 완전 일치. sibling developer plan 의 최상단 요약 표가 뒤집힌 결정 미반영(WARNING, target 수정 불요) |
| naming_collision | LOW | 신규 식별자 충돌 0건(전부 기존 구현 참조). target 이 편집하는 파일 안 기존 각주(:184)와의 self-contradiction 1건(WARNING) |

## 권장 조치사항
1. (target 자체 수정) `spec/5-system/6-websocket-protocol.md` §4.1 표 안 :184 기존 각주("이 관문을 지나지 않아 아직 원문이다")를 target 의 신규 §4.1 캐비엇과 정합하도록 정정하는 항목을 target "변경 2" 체크리스트에 추가 — 같은 PR 이 만드는 파일 내 자기모순을 방지.
2. (target 자체 수정) target 문서 끝에 `## Rationale` 섹션을 신설하거나, inline 근거로 대체하는 의도를 서두에 명시.
3. (target 자체 수정, 선택) `[12-webhook §5.3]` 인용에 앵커(`#53-민감-헤더-마스킹-ingestion`)를 붙여 기존 인용 스타일과 통일.
4. (별도 문서 정정, target 범위 밖) `plan/in-progress/eia-fanout-and-internal-data-masking.md` 최상단 택일 표 A행(및 B행)을 최종 결정("wire+fanout 둘 다")에 맞춰 취소선+정정 표기.
5. (선택, INFO 다수) webhook Rationale 인용 보강·WS/EIA 필드 예시 표기 통일·`inputData` 용어 중의 명시화 — 문서 완성도 개선, 채택 차단 사유 아님.
