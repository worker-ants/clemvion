# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

검토 모드: `--impl-prep`
검토 대상: `spec/4-nodes/6-presentation/` (form validation min/max/pattern 구현 착수 전)
검토 일시: 2026-06-14

---

## 전체 위험도
**LOW** — Critical·BLOCK 사유 없음. WARNING 2건(서로 다른 checker, 중복 없음) + INFO 다수. 구현 착수 전 spec 보강 권장 사항이 주를 이룸.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Convention Compliance | `4-form.md §6.2` "Planned" 검증 범위 vs 구현된 schema 범위의 경계 불명확 — `validationRuleSchema`에 `min`/`max`/`pattern` 이미 선언돼 있으나 §6.2 표에서 구현 레이어 분리가 직접 명시 안 됨 | `spec/4-nodes/6-presentation/4-form.md §6.2`, `§1 ValidationRule 구조 표` | `form.schema.ts:20-29` (`validationRuleSchema`), `spec/conventions/spec-impl-evidence.md §3` | §6.2에 "현재 구현된 검증 범위(schema 선언) vs Planned(validator 로직)" 구분 주석 추가 또는 §1 ValidationRule 표 `min`/`max`/`pattern` 행에 "(서버 검증 Planned)" 인라인 명시 |
| W2 | Naming Collision | `validation.pattern`(정규식)과 `transform.handler.ts`의 `args.pattern`(날짜 포맷) 동명 이의어 — 네임스페이스 분리로 런타임 충돌 없으나 코드 리뷰·문서 맥락에서 혼동 위험 | `codebase/backend/src/nodes/presentation/form/form.schema.ts`, `codebase/backend/src/modules/chat-channel/form-mode.ts` | `codebase/backend/src/nodes/data/transform/transform.handler.ts` (`args.pattern` — dayjs format) | 코드 주석에서 `validation.pattern`을 "regex pattern"으로 명시해 transform `args.pattern`(날짜 포맷)과 구분 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | WS `VALIDATION_ERROR` ack의 `details[]` 미포함 사실이 EIA spec에 교차 언급 없음 | `spec/5-system/14-external-interaction-api.md §EIA-IN-10`, `§5.1` | EIA §5.1 VALIDATION_ERROR 행에 "WS 경로는 평면 error 문자열만 제공(details[] 없음)" 비고 1줄 추가 |
| I2 | Cross-Spec | EIA `details[]` "계약상 다중 배열, 현 구현 항상 길이 1" 사실이 EIA spec에 직접 명시 안 됨 | `spec/5-system/14-external-interaction-api.md §5.1`, `§EIA-IN-10` | EIA §5.1 비고에 "현 구현: details[]는 항상 길이 1 (form.md §Rationale 참조)" 추가 |
| I3 | Cross-Spec | `validateFormSubmission` 재사용 계층 책임이 spec에 명문화 안 됨 | `spec/4-nodes/6-presentation/4-form.md §Rationale` | §Rationale에 "공유 `validateFormSubmission`은 `src/modules/chat-channel/shared/form-mode.ts` 정의, `min`/`max`/`pattern` 구현 시 해당 함수 확장이 3 경로에 자동 적용됨" 명시 |
| I4 | Rationale Continuity | `validation.min`/`max`/`pattern` defer Rationale이 FIRST 오류 원칙의 적용 범위를 명시 안 함 | `spec/4-nodes/6-presentation/4-form.md §Rationale` defer 항목 | defer Rationale 말미에 "추가 규칙은 FIRST 오류 원칙을 따른다 — 규칙 순서(required → type → minLength/maxLength → min/max → pattern) 기준 첫 위반에서 즉시 throw" 추가 |
| I5 | Rationale Continuity | WS `VALIDATION_ERROR` 부연에서 기존 Rationale "§4.2 ack 정정" 항목으로의 cross-ref 없음 | `spec/5-system/6-websocket-protocol.md §7.1 VALIDATION_ERROR 행` | 부연 말미에 "§Rationale §4.2 ack 정정과 정합" cross-ref 추가 |
| I6 | Convention Compliance | `0-common.md` §9 섹션 결락 (§8 → §10 점프) 및 `§4.6` 삽입으로 번호 이중 불일치 | `spec/4-nodes/6-presentation/0-common.md` | `##9` 추가 또는 AI Tool 모드를 `##9`로 번호 조정 |
| I7 | Convention Compliance | `2-table.md`·`3-chart.md` `## Rationale` 섹션 미보유 | `spec/4-nodes/6-presentation/2-table.md`, `spec/4-nodes/6-presentation/3-chart.md` | 두 파일에 `## Rationale` 섹션 추가하여 주요 설계 결정 근거 기술 |
| I8 | Convention Compliance | `4-form.md §4` "Blocking Mode 흐름의 form 변형" 참조 anchor가 공통 §3에 해당 subsection 없음 | `spec/4-nodes/6-presentation/4-form.md §4` | §4 참조를 "§6.2 form 입력 검증 수행 (공통 §3 Blocking Mode 흐름의 form 특화 변형)"으로 재서술 |
| I9 | Convention Compliance | `0-common.md §7` output 칸에서 Table `totalRows` 누락 (`node-output.md §4.3` dynamic table 정의와 불일치) | `spec/4-nodes/6-presentation/0-common.md §7` | "Table `rows` + `totalRows` (dynamic)"으로 수정 또는 "노드별 상세는 §8 참조"로 위임 명시 |
| I10 | Convention Compliance | `2-table.md §4 step 8`의 "D5" 임시 설계 결정 레이블이 `status: implemented` 본문에 잔존 | `spec/4-nodes/6-presentation/2-table.md §4 step 8` | 구현 완료 결정은 `## Rationale`로 이동하거나 임시 레이블 제거 권장 |
| I11 | Plan Coherence | `spec-sync-form-gaps.md` Planned 항목과 구현 범위 정합 확인 완료 — 미해결 선행 결정 없음 | `plan/in-progress/spec-sync-form-gaps.md`, `spec/4-nodes/6-presentation/4-form.md §6.2` | 구현 완료 후 plan 체크박스 갱신 |
| I12 | Plan Coherence | file 검증 cluster와 본 worktree 범위 분리 명확 — 범위 혼용 위험 없음 | `spec/4-nodes/6-presentation/4-form.md §Rationale`, `plan/in-progress/spec-sync-form-gaps.md` | 구현 시 file 관련 코드(allowedMimeTypes/maxFileSize 등) 미변경 유지 |
| I13 | Naming Collision | `validation.min`/`max`/`pattern` — `form.schema.ts` `validationRuleSchema`에 이미 동명 동타입으로 선언, 충돌 없음 | `codebase/backend/src/nodes/presentation/form/form.schema.ts:20-29` | 스키마 변경 없이 validator 로직 확장만 필요 |
| I14 | Naming Collision | `FormModalField`에 `min`/`max`/`pattern` 필드 부재 — 확장 필요하나 기존 `minLength`/`maxLength`와 명명 충돌 없음 | `codebase/backend/src/modules/chat-channel/types.ts` (`FormModalField`), `form-mode.ts` (`extractFormFields`) | `FormModalField`에 `min?`, `max?`, `pattern?` 추가 시 JSDoc으로 "서버측 검증 전용 — chat-channel modal UI hint 미사용" 명시 |
| I15 | Naming Collision | `VALIDATION_ERROR`·`INVALID_FIELD`·`FormValidationError` — 기존 에러 코드 체계와 정합, 신규 도입 불필요 | `codebase/backend/src/nodes/core/error-codes.ts`, `workflow-errors.ts` | 추가 조치 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | WS `details[]` 미포함·EIA 교차 언급 누락·`validateFormSubmission` 재사용 계층 미명문화 — 모두 INFO, 실질적 모순 없음 |
| Rationale Continuity | LOW | FIRST 오류 원칙의 min/max/pattern 적용 범위 미명시, WS ack 부연에 cross-ref 누락 — INFO, 차단 사유 없음 |
| Convention Compliance | LOW | `4-form.md §6.2` Planned vs 구현 범위 경계 불명확(WARNING), 섹션 번호 결락·Rationale 미보유·내부 anchor 오류 등 문서 일관성 개선 권장 |
| Plan Coherence | NONE | plan·spec·worktree 삼각 완전 정합. 선행 미해결 결정 없음 |
| Naming Collision | LOW | `validation.pattern` vs `args.pattern` 동명 이의어(WARNING, 네임스페이스 분리로 런타임 충돌 없음), `FormModalField` 확장 필요(INFO) |

---

## 권장 조치사항

1. **(구현 착수 전 권장)** `spec/4-nodes/6-presentation/4-form.md §6.2` 또는 §1 ValidationRule 표에 "schema 선언(현재 구현) vs 서버 validator 로직(Planned)" 경계를 명확히 주석으로 분리 (W1 해소).
2. **(구현 중)** `codebase/backend/src/modules/chat-channel/types.ts` `FormModalField`에 `min?`, `max?`, `pattern?` 추가 시 JSDoc으로 "서버측 검증 전용" 명시 (I14).
3. **(구현 중)** `form.schema.ts` / `form-mode.ts` 코드 주석에서 `validation.pattern`을 "regex pattern"으로 명시해 `transform.handler.ts`의 날짜 포맷 `args.pattern`과 구분 (W2 해소).
4. **(구현 중)** `validateFormSubmission` 검증 순서를 "required → type → minLength/maxLength → min/max → pattern" 순으로 확인하여 FIRST 오류 원칙 준수 (I4 연관).
5. **(구현 완료 후)** `plan/in-progress/spec-sync-form-gaps.md` 체크박스 갱신 (I11).
6. **(향후 spec 보강)** `spec/5-system/14-external-interaction-api.md §EIA-IN-10`·`§5.1`에 WS 경로 `details[]` 미포함 및 `details[]` 길이 1 사실 비고 추가 (I1, I2).
7. **(향후 spec 보강)** `form.md §Rationale`에 `validateFormSubmission` 계층 책임 명문화 (I3).
8. **(향후 정리)** `0-common.md` 섹션 번호 연속성 정리 및 `2-table.md`·`3-chart.md` `## Rationale` 섹션 추가 (I6, I7).
