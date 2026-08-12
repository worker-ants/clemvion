# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — spec 변경 없는 순수 코드 버그 수정(EIA §R8 idempotency 캐시 닫힌 목록 정합화). Critical/차단 사유 없음, WARNING 1건은 plan 문서 동기화 누락(비차단).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | developer 커밋(`779a6e240`)이 `spec/data-flow/15-external-interaction.md` §2.2 표의 "선재 갭" caveat 문구를 코드 수정과 원자적으로 삭제했으나, 이 편집이 담당 planner plan(`spec-draft-eia-r8-alignment.md`) 체크리스트에 기록되지 않음 | `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표 (`interaction:idempotency:<key>` 행) | `plan/in-progress/spec-draft-eia-r8-alignment.md` (owner: project-planner), `developer/SKILL.md` L28 (spec 쓰기는 planner 위임 원칙) | `spec-draft-eia-r8-alignment.md` 체크리스트에 "developer 턴이 §2.2 캐시 gap caveat 을 코드 수정과 원자적으로 제거함 — planner 사후 확인" 항목 1줄 추가 (내용 자체는 §R8 SoT 와 정합하므로 이번 PR 을 막을 필요는 없음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 관련 spec 일부(auth/error-handling/execution-engine/websocket/web-chat)가 컨텍스트 예산 초과로 절단되어 원문 대조 미완 | 검토 payload 조립 단계 | 이번 diff 범위(코드 3파일, spec 문면 무변경)에서는 실질 위험 낮음. 반복되면 `--spec` 번들 예산 정책 조정 검토 |
| 2 | rationale_continuity | §R8 캐시 범위 구현 갭 해소 이력을 `## Rationale` 에 병기하면 §1.5(C3 fix)와 스타일 대칭 | `spec/data-flow/15-external-interaction.md` `## Rationale` | 선택 사항 — 짧은 소절 추가 권장하나 필수 아님 |
| 3 | convention_compliance | §R8 gap 해소가 §2.2 표 각주 삭제로만 반영되고, §1.5 C3 fix 처럼 `## Rationale` 전용 절이 없어 문서 내 "갭 해소 기록 방식"이 두 갈래 | `spec/data-flow/15-external-interaction.md` §2.2 / `## Rationale` | 필수 아님. 일관성 원하면 Rationale 소절 추가 (rationale_continuity INFO #1과 동일 제안) |
| 4 | plan_coherence | `spec-draft-eia-r8-alignment.md` 체크리스트 전항목 `[x]` 인데 `status: in-progress` 로 남아 lifecycle 완료 조건 충족 상태 | `plan/in-progress/spec-draft-eia-r8-alignment.md` frontmatter | 위 WARNING #1 반영 후 `complete/` 이관 검토 (이번 PR 스코프 아님) |
| 5 | naming_collision | e2e 테스트 `IDEM-1/2/3` prefix 가 기존 `A..J` 단일 알파벳 순차 관행과 형식이 다름(과거 `I-2` 충돌은 이미 해소됨, 재발 아님) | `codebase/backend/test/external-interaction.e2e-spec.ts:371,446,512` | 선택 — 향후 테스트 ID 명명 방향(도메인 접두어 vs 순차 알파벳) 정리 시 참고 |
| 6 | naming_collision | `IDEM-` 문자열과 기존 에러 코드 `IDEMPOTENCY_KEY_CONFLICT` 부분 문자열 겹침 — 네임스페이스·소비자 다름, 실질 충돌 아님 | 테스트 ID vs `interaction.controller.ts:83` 등 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터모델/API계약/요구사항ID/상태전이/RBAC/계층책임 전 관점에서 충돌 없음. 코드가 기존 spec §R8 닫힌 목록에 뒤늦게 정합화된 순수 버그 수정 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. R8 Rationale 이 경고한 두 축약 오류(`>=400`, `===400`)를 코드가 정확히 회피 |
| convention_compliance | LOW | `spec/conventions/**`(에러코드/secret-store/swagger/migrations) 전 항목 위반 없음. Rationale 형식 일관성 INFO 1건 |
| plan_coherence | LOW | 두 관련 plan 이 §R8 정합화 서사를 일관 기록. developer 의 spec 후속 편집(내용은 정합)이 plan 체크리스트에 미기록 — WARNING 1건(비차단) |
| naming_collision | NONE | spec 변경 없어 신규 식별자 표면 좁음. 유일 과거 충돌(`I-1`/`I-2`)은 이전 라운드에 이미 해소 확인. 신규 함수/헬퍼 전역 유일성 확인 완료 |

## 권장 조치사항
1. (비차단, 권장) `plan/in-progress/spec-draft-eia-r8-alignment.md` 체크리스트에 developer 턴의 §2.2 caveat 삭제 편집을 사후 기록하는 항목 1줄 추가.
2. (선택) `spec/data-flow/15-external-interaction.md` `## Rationale` 에 §R8 캐시 범위 구현 갭 해소 이력을 §1.5 C3 fix 와 같은 패턴으로 병기.
3. (선택, 이번 PR 스코프 아님) WARNING #1 반영 후 `spec-draft-eia-r8-alignment.md` 를 `plan/complete/` 로 이관 검토.
