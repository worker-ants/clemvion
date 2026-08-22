# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 전원이 전문을 확보했고, target(masked-marker-cosmetic-followups: spec frontmatter 1줄 + 백엔드 4개 파일 JSDoc/Swagger/주석 전용 변경)은 실행 로직·API 계약·spec 본문을 바꾸지 않는 순수 문서화 followup. WARNING 1건(Swagger description 길이/예외 범위)만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `ReRunRequestDto.inputOverride` 의 `@ApiPropertyOptional description`(약 190자)이 swagger 규약 길이 가이드(10~40자)를 크게 초과하고, 문서화된 예외 조항("응답 값이 저장된 값과 다를 수 있는 필드")은 요청 필드인 `inputOverride`(요청측 마스킹 마커 거부 caveat)를 문면상 포괄하지 않음 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` description) | `spec/conventions/swagger.md` §3 "주석/설명 톤" 및 예외 조항 | (a) description 을 "SoT 링크(EIA §R17) + 1문장 요약" 수준으로 축약, 또는 (b) `swagger.md` §3 예외 조항을 "요청 필드의 보안/거부 규칙 caveat"까지 명시 확장(같은 파일 `dryRun` 필드도 이미 가이드 초과 상태로 실무 관행이 앞서 있음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `1-manual-trigger.md` §4 의 "CONVENTIONS Principle 2 — 실행 컨텍스트" 라벨이 `node-output.md` Principle 2 의 실제 제목("실행 메트릭")과 불일치하고, 동명에 가까운 별개 문서 `execution-context.md` 와 혼동 소지 | `spec/4-nodes/7-trigger/1-manual-trigger.md` §4 실행 로직 6번째 스텝 (pre-existing, 이번 diff 대상 아님) | 괄호 부연을 "실행 메트릭"으로 정정하거나 링크만 남기고 부연 생략 |
| 2 | rationale_continuity, plan_coherence (중복 관측 통합) | 이번 diff 가 신설한 산문 서술 3곳(`re-run.dto.ts` Swagger description, `resolve-trigger-parameters.ts`/`trigger-parameter.types.ts` JSDoc)이 마스킹 마커 거부 규칙의 **의미**를 SoT 패키지(`@workflow/masked-markers`) 링크 없이 재기술 — SoT 분산 재기술 위험 소폭 증가 | 코드 주석 3곳 (파일 상동) | 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L825-834 에 등재됨. PR #1194(`spec/conventions/egress-masking.md` 신설, 현재 OPEN)가 머지되면 흡수, 지연/철회 시 이 항목이 유일한 기록이라는 조건부 처분 경로가 이미 명시돼 있어 추가 조치 불요 — #1194 진행 상황만 추후 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 코드 diff 4개 파일은 전부 주석/JSDoc/Swagger description, spec 은 frontmatter 1줄 — EIA §R17·데이터 모델·API 규약·error-handling·webhook 어느 교차 spec 과도 모순 없음 |
| rationale_continuity | NONE | 신규 산문 서술은 EIA §R17 기존 결정의 재진술뿐, 기각 대안 재도입·원칙 위반·무근거 번복·invariant 충돌 없음. SoT 분산 재기술 INFO 1건만 |
| convention_compliance | LOW | swagger.md §3 길이 가이드/예외 범위 WARNING 1건, Principle 라벨 오기 INFO 1건. node-output.md·error-codes.md 등 핵심 규약은 정확히 준수 |
| plan_coherence | NONE | `spec-sync-external-interaction-api-gaps.md` 이월 항목 4건과 target 이 1:1 대응, 같은 changeset 에서 plan 도 `[x]` 동시 갱신. 우회된 미해결 결정 없음 |
| naming_collision | NONE | 신규 식별자(요구사항 ID/DTO/엔드포인트/이벤트/ENV/spec 경로) 전무 — 기존 식별자 재인용뿐 |

## 권장 조치사항
1. (선택) `re-run.dto.ts` `inputOverride` description 을 SoT 링크 + 요약 수준으로 축약하거나, `swagger.md` §3 예외 조항을 요청 필드의 보안/거부 규칙 caveat 까지 포괄하도록 갱신.
2. (선택) `1-manual-trigger.md` §4 의 "CONVENTIONS Principle 2 — 실행 컨텍스트" 라벨을 `node-output.md` Principle 2 제목("실행 메트릭")과 일치시키거나 부연 생략.
3. 마커 리터럴 산문 재기술 INFO 는 조치 불요 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 이미 PR #1194 조건부 처분 경로를 명시했으므로 그 진행 상황만 추후 확인.