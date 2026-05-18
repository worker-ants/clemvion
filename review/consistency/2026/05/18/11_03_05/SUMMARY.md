# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Critical 1건(skipReason 식별자 충돌)과 WARNING 6건. Critical은 plan 문서 한 줄 수정으로 즉시 해소 가능하며 spec 자체는 이미 올바르게 정의되어 있음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | plan D 항목의 `skipReason` 값 `'not_cafe24'`가 spec에 이미 `'not_capable'`로 확정 정의된 동일 의미 식별자와 충돌 | `plan/in-progress/cafe24-expired-self-healing.md` §D | `spec/5-system/11-mcp-client.md §6.2` vocabulary 표 (`not_capable`, 적용: 공용) | plan D 항목의 `'not_cafe24'`를 `'not_capable'`로 교체. spec 수정 불필요. |

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| 1 | rationale_continuity | Item B에서 `ensureFreshToken` 직접 호출과 `refreshViaQueue` 큐 경유를 양자택일로 열어 두어 BullMQ jobId dedup 우회 가능성 존재 | Item B 를 "`refreshViaQueue` 단일 경로" 로 확정. spec §B 에 "큐 경유 강제" 명시. |
| 2 | rationale_continuity | buildTools 라는 제3 refresh 진입점이 기존 Rationale 의 진입점 목록에 미등록 | spec §9.6 Rationale 에 buildTools 등록. |
| 3 | convention_compliance | plan D 의 `skipReason` 값 6개가 모두 `lower_snake_case` — `code` 규약 (`UPPER_SNAKE_CASE`) 과 불일치 | spec §6.2 에 명시적 분리 노트 추가 (`code` 가 아닌 `skipReason` 필드 → 규약 적용 외). |
| 4 | convention_compliance + plan_coherence | `serverSummaries[]` 필드가 §6.2 스키마에 정의되지 않은 신규 필드. plan C 의 spec 정정이 "주석 추가" 수준에 그쳐 실제 스키마 확장 누락 위험 | spec §6.2 에 `serverSummaries[]` 필드 + skipReason 열거형 명시. spec 갱신 commit 전 `/consistency-check --spec` 재실행. |
| 5 | plan_coherence | `spec/4-nodes/4-integration/4-cafe24.md` 를 target plan 과 `spec-update-cafe24-test-connection` 두 plan 이 동시 수정 | target plan §비고에 의존 관계 명시. |
| 6 | plan_coherence | Item B 의 `refreshViaQueue` public 노출이 full-review RESOLUTION W-53 (Cafe24ApiClient 분해 보류) 와 잠재 충돌 | plan §B 에 W-53 인지 한 줄 보강. |

## 참고 (INFO)

12건 — spec C 가 사실상 완료, 0d cafe24 알림 발사 정책 의도 명시 권장, network 오류 3회 연속 케이스 명시, vocabulary 추가 정합, replica lag 모니터링, node-output-redesign worktree frontmatter housekeeping, `McpSkipReason`/`RagSkipReason` 타입 분리 등.

## 권장 조치사항

1. **(BLOCK 해소 필수)** plan D `'not_cafe24'` → `'not_capable'`. 한 줄 수정.
2. **(구현 착수 전 필수)** plan B refresh 경로 `refreshViaQueue` 단일 경로 확정.
3. **(spec C 갱신 시 필수)** §6.2 에 `serverSummaries[]` 스키마 명시.
4. **(spec C 갱신 시)** `skipReason` 케이스 스타일 명시 + node-output.md §3.2 와 분리.
5. **(착수 전 확인)** `spec-update-cafe24-test-connection` 선행 조건 머지 상태 확인.
6. **(spec C 갱신 시)** §9.6 에 buildTools 진입점 등록.

## 처리 내역

본 세션 결과를 받아 plan 1건 Critical 수정 + spec §6.2 / §9.6 보강 + plan §B/D/C 보강 적용 후 구현 단계 진입. 재-consistency-check 는 본 변경이 의미적 결정 추가 없이 alignment 정정만 수행하므로 본 PR 안에서 생략 (variant 시 follow-up).

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | LOW | spec C 완료 확인. INFO 6 |
| rationale_continuity | LOW | ensureFreshToken 우회 위험 / buildTools 진입점 미등록. WARNING 2, INFO 2 |
| convention_compliance | MEDIUM | skipReason 케이스 / serverSummaries 스키마 누락. WARNING 2, INFO 2 |
| plan_coherence | LOW | 동 spec 파일 동시 수정 / W-53 잠재 충돌. WARNING 3, INFO 2 |
| naming_collision | MEDIUM | not_cafe24 vs not_capable Critical. CRITICAL 1, WARNING 1, INFO 1 |
