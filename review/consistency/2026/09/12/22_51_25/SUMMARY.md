# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, plan 체크리스트가 트래커 종결 대상 파일을 명시하지 않아 모순된 열린 항목이 잔존할 실질적 위험이 있음(plan_coherence WARNING). 나머지는 문서 완결성 갭(카탈로그 미등재·컨벤션 예외 미기재) 수준의 LOW 항목.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 본 라운드에 Critical 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | Background Runs REST 가 발행하는 에러 코드 4종(`INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND`)이 중앙 에러코드 카탈로그 SoT 에 미등재. §1.5~§1.12 가 예외 없이 지켜 온 "도메인 SoT + 카탈로그 가시성 등재" 관행에서 이 도메인만 빠짐. 마침 이번 작업이 `INVALID_CURSOR` 발행 지점(`decodeCursor`)을 건드림 | `spec/5-system/3-error-handling.md` §1 (§1.3) | `spec/4-nodes/1-logic/12-background.md` §8.7 · `spec/conventions/error-codes.md` Overview · `spec/5-system/2-api-convention.md` §5.3 | §1.13(가칭 "Background Run 조회 에러 코드") 신설해 `12-background.md §8.7` 을 SoT 로 역링크. 이번 PR 스코프 밖이면 `spec-draft-nullable-notation-followups.md` 에 등재만이라도 |
| 2 | cross_spec | `2-api-convention.md §8.2` 가 cursor 페이지네이션을 단일 표준(opaque base64, 실패시 400 `INVALID_CURSOR`)으로만 서술 — `login_history` 의 다른 패턴(평문 `<iso>\|<id>`, 실패시 무시하고 1페이지)의 존재·근거가 어디에도 명시 안 됨. 이번 작업이 두 계약을 통일 없이 각각 강화해 비대칭을 사실상 고정시킴 | `spec/5-system/2-api-convention.md` §8.2 | `spec/data-flow/1-audit.md` §2.2 | §8.2 에 "`login_history` 는 예외" 각주 추가하거나 `data-flow §2.2` 에 차이·의도 명시. 스코프 밖이면 followups 트래커 등재 |
| 3 | convention_compliance | `EXECUTION_NOT_FOUND` 를 "§1.2~§1.3 표준 코드 재사용"으로 서술한 각주가, 같은 문서 §1.9 자신이 세운 "제네릭 문자열 그대로 wire 에 낸다=재사용 / 도메인 특화 wire 리터럴=직접-등재" 구분 기준과 어긋남(실측: `EXECUTION_NOT_FOUND` 는 별개 wire 리터럴, `MODEL_CONFIG_NOT_FOUND` 계열에 해당) | `spec/5-system/3-error-handling.md` §1.6 하단 각주 | 동일 문서 §1.9 각주 | 위 #1 해소 시 `EXECUTION_NOT_FOUND` 를 "`RESOURCE_NOT_FOUND` 의 도메인 특화 코드"로 정정 등재 |
| 4 | plan_coherence | `keyset-cursor-uuid-validation.md` 체크리스트 A(필터 won't-do 기록)·C(트래커 2건 신규 등재)가 "트래커에 기록"이라고만 적혀 있고 **대상 파일을 명시하지 않음**. A 가 종결해야 할 항목은 `spec-draft-nullable-notation-followups.md:3190-3201` 의 "필터에 22P02→400 분기 추가" 처방인데, 이는 본 plan 의 결론(필터는 건드리지 않는다)과 **정면으로 반대**됨 — 대상 미명시 상태로 실행하면 두 plan 문서가 같은 사안에 모순되는 상태로 공존할 위험. 인접 plan(`trigger-uuid-and-guide-error-codes.md`)은 같은 형태의 항목에서 대상 파일을 명시해 관례를 지킨 선례가 있음 | `plan/in-progress/keyset-cursor-uuid-validation.md` 체크리스트 A/C | `plan/in-progress/spec-draft-nullable-notation-followups.md:3190-3201` | 체크리스트 A/C 에 대상 경로를 `spec-draft-nullable-notation-followups.md` 로 명시하고, 실행 시 해당 항목을 취소선 처리 + "해소(won't-do, 근거: keyset-cursor-uuid-validation.md §A)" 각주 추가. C 의 신규 등재 항목도 실행 후 실제 반영 여부 재확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 필터 won't-do 근거("JWT 클레임 미검증 원칙")가 기존 정식 Rationale(`data-flow/12-workspace.md` "UUID 검증 강도 비대칭")과 같은 원칙을 상호참조 없이 재도출 | `plan/in-progress/keyset-cursor-uuid-validation.md` §A | won't-do 기록 문장에 `data-flow/12-workspace.md` Rationale 링크 병기 (spec 본문 수정 불요) |
| 2 | rationale_continuity | `isUuidShaped` 재사용 문맥(커서 id 검증)이 spec Rationale 원문(인가-컨텍스트 특정 서술)보다 넓음 — 코드 docstring 은 이미 이 확장 근거를 담고 있어 원칙 위반은 아님 | `plan/in-progress/keyset-cursor-uuid-validation.md` §B, `common/utils/uuid.ts` | plan 후속 노트에 "적용 범위가 워크스페이스 헤더 밖까지 넓어짐" 한 줄 남겨 향후 오독 방지 |
| 3 | plan_coherence | `keyset-cursor-uuid-validation.md` frontmatter 에 `spec_impact` 필드 부재 (spec 미수정 plan 이라 `none` 이 타당해 보이나 명시 안 됨) | plan frontmatter | 착수 전 `spec_impact: none` 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INVALID_CURSOR/LIMIT 카탈로그 미등재, §8.2 cursor 이중 패턴 미문서화 (둘 다 WARNING) |
| rationale_continuity | LOW | `isUuidShaped` 재사용 문맥이 spec Rationale 서술보다 넓음 (INFO), 필터 won't-do·커서 400 확장은 기존 원칙과 정합 확인 |
| convention_compliance | LOW | Background Runs 에러코드 카탈로그 미등재 (WARNING), `EXECUTION_NOT_FOUND` 서술 오차 (INFO). 컨텍스트 예산 절단으로 13개 파일 미대조 |
| plan_coherence | MEDIUM | 트래커 종결 체크리스트에 대상 파일 미명시 → 모순 열린 항목 잔존 위험 (WARNING), spec_impact 필드 부재 (INFO) |
| naming_collision | NONE | 6개 관점 전수 확인, 신규 식별자 없음(기존 코드·엔티티·endpoint 전부 재사용) |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 참고용 우선순위) `keyset-cursor-uuid-validation.md` 체크리스트 A/C 에 대상 트래커 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md`)을 명시하고, 실행 시 3190-3201행 항목을 취소선 처리 + 해소 각주 추가.
2. `keyset-cursor-uuid-validation.md` frontmatter 에 `spec_impact: none` 추가.
3. `spec-draft-nullable-notation-followups.md` (또는 별도 후속)에 다음 두 항목 등재 검토: (a) Background Runs 에러코드 4종 중앙 카탈로그 §1 미등재, (b) `2-api-convention.md §8.2` 가 `login_history` 커서의 다른 실패계약을 언급하지 않음.
4. `3-error-handling.md §1.6` 각주의 `EXECUTION_NOT_FOUND` "표준 코드 재사용" 서술을 §1.9 기준에 맞춰 정정(도메인 특화 코드로 재분류) — 위 #3(a) 와 함께 처리하면 비용 낮음.
5. `keyset-cursor-uuid-validation.md` §A 의 won't-do 근거 문장에 `data-flow/12-workspace.md` Rationale 링크를 병기(선택, 비차단).