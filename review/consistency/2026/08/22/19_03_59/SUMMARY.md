# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL 0건. `convention_compliance` 가 WARNING 1건(traceability gap), 나머지는 INFO 이하.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `1-manual-trigger.md` §6 가 Manual re-run 400 응답 처리 위치로 명시(표 행 + 각주 2곳)한 `executions.service.ts` 가 `1-manual-trigger.md`/`0-common.md` 어느 frontmatter `code:` 목록에도 없음. `status: implemented` 라 build 가드(`spec-code-paths.test.ts`)는 glob ≥1 매치만 요구해 이미 통과 상태 — 가드 미검출 지대의 실사례 | `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표 + 각주 | `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = 약속한 surface 의 구현 경로) | `1-manual-trigger.md`(또는 `0-common.md`) frontmatter `code:` 에 `codebase/backend/src/modules/executions/executions.service.ts` 추가. 이번 PR 이 형제 표면(`re-run.dto.ts`)을 이미 만지므로 지금 등재하면 drift 예방 비용이 낮음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `1-manual-trigger.md` §6 각주가 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 직접 나열하고 EIA §R17 을 SoT 로 위임 — 모순은 아니나, `plan/complete/masked-marker-shared-package.md` 로 SoT 가 공유 패키지 `@workflow/masked-markers` 로 이관된 사실을 각주가 한 단계 더 명확히 링크하면 좋음 | `1-manual-trigger.md` §6 표 각주 + Rationale | 향후 이 문서를 다시 만질 기회에 `@workflow/masked-markers` 패키지 링크 추가 (blocking 아님) |
| 2 | convention_compliance | Rationale 서브섹션 ID 네이밍이 provider 3파일 간 불일치 — discord/slack 은 `R-D-N`/`R-S-N` 접두, telegram 은 접두 없는 `R-N` | `providers/discord.md`, `providers/slack.md`, `providers/telegram.md` `## Rationale` | 다음 telegram.md 편집 기회에 `R1`→`R-T-1` 식으로 통일 (이번 스코프 불요) |
| 3 | plan_coherence | 이번 diff 가 `REASON_TO_DETAIL` JSDoc ×3 · base JSDoc wrapper 역참조 · Swagger description 등 "산문 규약(egress-masking)" 지점을 3곳 더 추가 — `spec-sync-external-interaction-api-gaps.md:858-867` 가 이미 지적한 "정식 conventions 문서 없이 코드 JSDoc 산문에만 있음" 패턴과 같은 방향 (planner 턴 필요, 결정 우회 없음) | `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 (spec 자체는 미변경) | 트래커 `spec-sync-external-interaction-api-gaps.md:858-867` 에 "코스메틱 PR 이 산문 지점 3곳 추가" 한 줄 보태기 (액션 불요, 기록용) |
| 4 | naming_collision | 이번 diff 는 신규 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로) 0건 — 전량 기존 코드/spec 식별자 재참조이며 전부 실재 확인됨 | 4개 코드 파일 + plan 트래커 갱신 | 후속 조치 불필요 |
| 5 | cross_spec | `1-manual-trigger.md` frontmatter `code:` 목록이 본문이 인용하는 `workflows.controller.ts`/`executions.service.ts`/`trigger-parameter.types.ts` 를 포함하지 않음(6개 cross-spec 관점 밖의 frontmatter-vs-code 완결성 이슈로, 위 WARNING #1 과 같은 근본 사실을 다른 각도에서 관측) | `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter | spec-coverage 류 감사에서 다룰 사안 — WARNING #1 조치 시 함께 해소됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 에러 코드/데이터 모델/요구사항 ID/API 계약이 관련 spec 5개 영역과 전부 정합. frontmatter 완결성 관찰은 스코프 밖으로 INFO 처리 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 위반 없음. target 이 회귀 방지 경고까지 Rationale 에 명시 보존. SoT 링크 보완 여지만 INFO |
| convention_compliance | LOW | `node-output.md`/`error-codes.md` 정밀 준수. WARNING 1건(`code:` traceability gap, 가드 미검출) + INFO 1건(provider Rationale 네이밍) |
| plan_coherence | LOW | 코스메틱 4건이 정본 트래커의 "planner 턴 불요" 항목과 diff 상 1:1 일치. egress-masking 통합 대상 산문이 소폭 늘어난 점만 INFO |
| naming_collision | NONE | 신규 식별자 표면 0 — 검토 대상 자체가 없는 안전한 변경 |

## 권장 조치사항
1. (권장, blocking 아님) `1-manual-trigger.md`(또는 `0-common.md`) frontmatter `code:` 에 `codebase/backend/src/modules/executions/executions.service.ts` 추가 — WARNING #1 / INFO #5 동시 해소. 이번 PR 스코프에 넣어도 비용이 낮으나, spec_impact: none 원칙상 강제하지 않음.
2. (선택) `spec-sync-external-interaction-api-gaps.md:858-867` 에 이번 diff 가 늘린 산문 지점 3곳을 한 줄 보태 두면 추후 planner 의 egress-masking convention 통합 턴에서 재-grep 불요.
3. (선택, 저우선순위) `providers/telegram.md` Rationale ID 를 `R-T-N` 접두로 맞추는 것은 다음 편집 기회로 미룸.

BLOCK 없음 — 구현/머지 착수를 막을 사유 없음.