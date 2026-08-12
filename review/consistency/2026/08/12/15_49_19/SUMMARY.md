# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 이 CRITICAL/WARNING 없이 완료. plan_coherence 가 target 자체의 diff 헤더 라벨 오기(INFO) 하나로 LOW 를 부여했고, 나머지 4개는 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "닫힌 목록" 명시가 `5-system/14` §R8 Rationale 에만 추가되고 `data-flow/15` 표 셀에는 반영 안 됨 — 오독 여지가 여전히 조금 남음 | 변경 2 (`spec/data-flow/15-external-interaction.md` §2.2, 현 L258) vs 변경 4 (`spec/5-system/14-external-interaction-api.md` §R8 Rationale) | data-flow 표 셀 끝에 "(닫힌 목록 — §R8 Rationale 참조)" 각주 추가 (필수 아님) |
| 2 | convention_compliance | 변경 4 블록의 `>` 표기가 "삽입할 문장 인용"인지 "실제 blockquote 마크업 삽입"인지 모호 — R8 의 다른 Rationale 항목(R1~R15)은 전부 평문 단락이며 `>` 를 서술에 섞지 않음 | `## 변경 4` — "§R8 채택 문단 끝에 한 문장 추가:" / "Rationale 보강" 다음의 `>` 인용 블록 | 변경1~3 처럼 `` ```diff `` 블록으로 표기하거나, "다음 문장을 그대로 이어붙인다" 식 지시어로 blockquote 마크업이 아님을 명확화 |
| 3 | plan_coherence | 변경 2 diff 헤더의 섹션 라벨 오기 — "§외부 의존 표"라고 썼으나 L258(`interaction:idempotency:<key>` 행)의 실제 소속은 `### 2.2 Redis / BullMQ`. `## 4. 외부 의존` 절(실측 L302)은 별개 표로 idempotency 행이 없음. diff 본문(라인 번호·내용)은 정확, 헤더 라벨만 오기 | `plan/in-progress/spec-draft-eia-r8-alignment.md` "변경 2 — `data-flow/15` §외부 의존 표 (현 L258)" | 제목을 "§외부 의존 표" → "§2.2 Redis / BullMQ" 로 정정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target diff 앵커가 실제 파일과 문자 단위 일치. §5.1 에러 표·§R13/§R14·실행 엔진 §7.5.1/§7.5.2·`3-error-handling.md` 등과 대조해 모순 없음. INFO 1건(닫힌 목록 표기 비대칭) |
| rationale_continuity | NONE | §R8 결정 자체는 불변, data-flow 서술만 SoT 로 정합화. Fail-open 확장(변경3)과 5xx 명확화(변경4) 모두 근거 있는 신규/파생 결정이며 무근거 번복 없음. 구현 갭 각주는 `idempotency.interceptor.ts:168` 실측 확인 |
| convention_compliance | NONE | `error-codes.md`(명명), `spec-impl-evidence.md`(frontmatter/Gate C), SoT 분리 패턴 모두 준수. 신규 식별자·포맷 도입 없음. INFO 1건(`>` 표기 모호성) |
| plan_coherence | LOW | `backend-lint-gate-broken-on-main.md` §후속의 planner 인계 2건 + developer 항목 1건의 선행조건에 정확히 응답, 결정 우회·후속 누락 없음. INFO 1건(diff 헤더 섹션 라벨 오기) |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API·이벤트·환경변수·파일 도입 전무 — 기존 식별자(§R8, `EIA-RL-02`, `VALIDATION_ERROR`, `interaction:idempotency:<key>`) 재서술만 |

## 권장 조치사항

1. (선택, 비차단) `plan/in-progress/spec-draft-eia-r8-alignment.md` "변경 2" 제목의 섹션 라벨을 "§외부 의존 표" → "§2.2 Redis / BullMQ" 로 정정 — diff 본문 자체는 정확하므로 커밋 전 사소한 정리.
2. (선택, 비차단) 변경 4 의 `>` 인용 표기를 변경1~3 과 동일하게 `` ```diff `` 블록으로 통일하거나 "그대로 이어붙인다" 식 지시어를 덧붙여 실행자 모호성 제거.
3. (선택, 비차단) `data-flow/15` §2.2 표 셀 끝에 "(닫힌 목록 — §R8 Rationale 참조)" 각주를 추가해 두 문서의 모호성 해소 수준을 맞출 수 있음.

BLOCK 사유가 없으므로 위 3건은 모두 선택적 다듬기이며, target 을 그대로 커밋해도 무방하다.
