# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 또는 INFO 수준.

## 전체 위험도
**LOW** — 기능·계약 영향 없는 문서 명확성 문제만 존재. 동일 식별자(`EXECUTION_TIMEOUT`)에 대한 레이어 구분 미명시가 3개 checker 에서 중복 지적되었으며 간단한 주석 보강으로 해소 가능.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale Continuity / Naming Collision (통합) | `EXECUTION_TIMEOUT` 이중 지위 — `error-codes.md §3.1` 이 "내부 전용 미발행 코드"로 선언하지만 `3-error-handling.md §1.4` 엔진 수준 표, `14-external-interaction-api.md §6.4`, `chat-channel-adapter.md §3.1` 이 동명 코드를 관측 가능한 공개 코드로 열거. Code 노드 handler 내부 레이어와 엔진 레벨 EIA payload 레이어 구분이 `§3.1` 에 미명시. | `spec/conventions/error-codes.md §3.1` (신설) | `spec/5-system/3-error-handling.md §1.4`, `spec/5-system/14-external-interaction-api.md §6.4`, `spec/conventions/chat-channel-adapter.md §3.1` | `error-codes.md §3.1` 의 `EXECUTION_TIMEOUT` 행에 "Code 노드 handler 내부 전용 분류 코드. EIA `execution.failed.error.code` 로 발행되는 엔진 레벨 동명 코드(`14-external-interaction-api.md §6.4` · `chat-channel-adapter.md §3.1`)와 별개 레이어"임을 명시하는 주석 추가. 또한 `3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행에 "(내부 분류 전용 — `CODE_TIMEOUT` 으로 정규화, 공개 발행 없음. SoT: `conventions/error-codes.md §3.1`)" 주석 추가. |
| W-2 | Convention Compliance | `error-codes.md §3.1` 이 `§3` "Historical-artifact 예외 레지스트리" h2 아래에 위치. §3 도입문은 "§1 위반 외부 노출 코드" 를 범위로 선언하나, §3.1 내부 코드는 §1 적용 범위 외 코드. 독자가 §3.1 코드들을 §1 위반 artifact 로 오해할 수 있음. | `spec/conventions/error-codes.md §3` 도입문 및 §3.1 배치 | `spec/conventions/error-codes.md §3` 범위 선언 | (A) §3.1 을 독립 `## 4. 내부 전용 분류 코드 (정규화 후 발행)` 절로 분리. 또는 (B) §3 도입문을 "§1 을 따르지 않는 기존 코드, 및 §1 적용 범위 외 내부 분류 코드"로 확장. 규약 자체 정비라면 (A) 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `2-code.md §5.3` 인라인 매핑 표와 `error-codes.md §3.1` 간 SoT 관계 미명시. 동일 내용이 두 위치에 존재하나 `2-code.md` 에서 SoT 참조가 없어 drift 위험. | `spec/4-nodes/5-data/2-code.md §5.3` | `spec/4-nodes/5-data/2-code.md §5.3` 인라인 표에 "(SoT: `spec/conventions/error-codes.md §3.1`)" 참조 추가 또는 인라인 표를 `error-codes.md §3.1` 참조로 교체. |
| I-2 | Convention Compliance | `error-codes.md` frontmatter `code:` 목록에 `codebase/backend/src/nodes/data/code/code.handler.ts` 미포함. §3.1 이 해당 파일의 `classifyCodeNodeError`·`LEGACY_TO_NORMALIZED` 동작을 규정하는 SoT. 빌드 차단은 없음. | `spec/conventions/error-codes.md` frontmatter | `code:` 에 `codebase/backend/src/nodes/data/code/code.handler.ts` 추가 고려. error-codes.ts 한정 책임이 의도적 설계라면 현행 유지 가능. |
| I-3 | Convention Compliance | `node-output.md` D4 anchor `#58-d4-handlervalidate-실패만-throw-나머지-모두-53-으로-라우팅` 정확성. `spec-link-integrity.test.ts` 빌드 가드가 런타임 검증. | `spec/conventions/node-output.md` D4 anchor | `spec-link-integrity.test.ts` CI 통과 확인으로 충분. |
| I-4 | Convention Compliance | `2-code.md §5.3.3` 의 `durationMs` 키와 `node-output.md Principle 2` 의 `duration` 표기 불일치 가능성. | `spec/4-nodes/5-data/2-code.md §5.3.3`, `spec/conventions/node-output.md Principle 2` | `node-output.md Principle 2` 에 `durationMs` 키 명칭을 명시적으로 등재하거나 기존 `duration` 표기를 `durationMs` 로 통일. |
| I-5 | Naming Collision | `error-codes.md §3.1` anchor 신설로 기존 cross-reference 없음. 기존 `§3` 레벨 링크들은 영향 없음. | `spec/conventions/error-codes.md §3.1` | 조치 불필요. |
| I-6 | Naming Collision | `legacyCode` 필드명 — spec 신규 등재(§3.1)와 `code.handler.ts` 구현이 동일 명칭·의미 사용. 충돌 없음. | `spec/conventions/error-codes.md §3.1`, `codebase/backend/src/nodes/data/code/code.handler.ts` | 조치 불필요. |
| I-7 | Naming Collision | `HTTP_TIMEOUT` 미발행 주석 — `3-error-handling.md §1.4` 신규 주석이 `chat-channel-adapter.md` 기존 기술과 일치. 충돌 없음. | `spec/5-system/3-error-handling.md §1.4` | 조치 불필요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `EXECUTION_TIMEOUT` 이중 기술(WARNING 1) + SoT 미명시(INFO 1) + anchor 정합(INFO 1) |
| Rationale Continuity | LOW | `EXECUTION_TIMEOUT` 카탈로그 SoT vs naming convention 불일치(WARNING — W-1 로 통합) |
| Convention Compliance | LOW | §3.1 섹션 배치 혼선(WARNING 1) + frontmatter code 경로 누락(INFO 1) + 키 명칭 불일치 가능(INFO 2) |
| Plan Coherence | 재시도 필요 | output_file 미존재 — 결과 미수신 |
| Naming Collision | LOW | `EXECUTION_TIMEOUT` 레이어 혼선(WARNING — W-1 로 통합) + 기타 신규 식별자 충돌 없음(INFO 3) |

## 권장 조치사항

1. **(W-1 해소 우선)** `spec/conventions/error-codes.md §3.1` 의 `EXECUTION_TIMEOUT` 행에 "Code 노드 handler 내부 전용 — EIA 엔진 레벨 동명 코드와 별개 레이어" 주석 추가. 동시에 `spec/5-system/3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행에 "(내부 분류 전용 — `CODE_TIMEOUT` 으로 정규화. SoT: `conventions/error-codes.md §3.1`)" 주석 추가.
2. **(W-2 해소)** `spec/conventions/error-codes.md §3.1` 배치를 §3 외부 독립 섹션(`## 4.`)으로 분리하거나, §3 도입문 범위를 "내부 분류 코드 포함"으로 확장.
3. **(I-1 권장)** `spec/4-nodes/5-data/2-code.md §5.3` 인라인 매핑 표에 `(SoT: conventions/error-codes.md §3.1)` 참조 추가해 drift 방지.
4. **(I-4 권장)** `spec/conventions/node-output.md Principle 2` 에서 `durationMs` 키 명칭 명시적 확인·통일.
5. **(Plan Coherence 재시도)** `plan_coherence` checker 결과 파일이 존재하지 않아 해당 항목을 검토하지 못함. 재실행 후 추가 위배 여부 확인 필요.