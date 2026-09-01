# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `spec/conventions/error-codes.md` §Overview 에 `ErrorCode`/`EngineErrorCode` 두 자매 const 병기를 명문화한 순수 문서 정정. 5개 checker 전원이 NONE/LOW, CRITICAL·WARNING 0건, INFO만 다수(대부분 이월/추적 중).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `tree-walk.ts` 의 신규 3번째 소비자(`stray-tool-tags.test.ts`) — "공유 헬퍼" 서술이 소비자 목록을 완전히 나열하지 않게 됨 | `spec/conventions/spec-impl-evidence.md`/`user-guide-evidence.md` `code:` frontmatter | 액션 불요, 정보용 |
| 2 | rationale_continuity | 신설 두 문단에 대응하는 `## Rationale` 항목 부재(전 라운드 이월) | `spec/conventions/error-codes.md` §Overview 신설 문단 | `## Rationale` 에 "판단 기준은 의도적 유보 — 근거 `exec-intake-followups.md` ARCH#5 ⑤" 한 줄 포인터 추가 권장(필수 아님) |
| 3 | rationale_continuity | `stray-tool-tags.test.ts`(build 차단 가드)가 `spec-impl-evidence.md §4.2` SoT 표("build 차단 4건")에 미등재 — target 밖, 이미 별도 plan 추적 중 | `spec/conventions/spec-impl-evidence.md §4.2` | 조치 불요(참고), `harness-review-gate-followups.md` 에 이미 사유·재개 신호 기록됨 |
| 4 | convention_compliance | Overview 헤딩 표기 스타일 불일치(`## Overview` vs `## Overview (제품 정의)`) — 규약 위반 아님 | `spec/conventions/error-codes.md` L62 | 조치 불요, 통일하려면 별도 소정정 plan 필요(이번 스코프 밖) |
| 5 | plan_coherence | 1R·3R wording 편집도 §Overview 범위 내(재확인), §3 clobber 경고 여전히 미실현 | `spec/conventions/error-codes.md` §Overview / §3 | 조치 불요 |
| 6 | plan_coherence | `spec-impl-evidence.md §4.2` 미등재 drift — 유예 누적 2회째 | `spec/conventions/spec-impl-evidence.md §4.2` | 조치 불요. 세 번째 유예 시 WARNING 격상 근거로 표시해 둘 것 |
| 7 | plan_coherence | 최초 도입 커밋(`b5d2e6972`)이 harness 백로그 커밋에 뒤섞임 + developer 트랙 fix 라운드가 planner 승인 spec 문구를 wording-only 로 재편집한 제3의 패턴(CLAUDE.md 5조건 어디에도 정확히 대응 안 함, 단 `--impl-done` 사후 그물은 통과) | `spec/conventions/error-codes.md` §Overview (도입 커밋 `b5d2e6972`, 후속 `00fc56488` 등) | 조치 불요(target 자체는 문제 없음). project-planner 가 "planner 승인 spec 문구의 wording-only fix" 패턴을 CLAUDE.md 에 규칙화할지 검토 가치 있음 |
| 8 | naming_collision | `EngineErrorCode` 는 신규 식별자가 아니라 기존 코드의 문서 SoT 최초 등재 | `spec/conventions/error-codes.md` §Overview | 조치 불필요 |
| 9 | naming_collision | 파일-로컬 상수 `SCAN_ROOTS` 이름이 `stray-tool-tags.test.ts` 와 `hardcoded-korean-ratchet.test.ts` 에서 다른 의미로 재사용(스코프 분리로 실질 충돌 없음) | `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:52` | 강제 조치 불필요. 가독성 원하면 `STRAY_TAG_SCAN_ROOTS` 로 세분화 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 두 surface 병기 서술이 코드(자매 const·비중첩 테스트)·타 spec 6건 grep·§1 카탈로그 혼재 양상과 전부 정합. INFO 1건(공유 헬퍼 소비자 목록 갱신 참고) |
| rationale_continuity | LOW | target 텍스트는 전 라운드와 동일. 2026-06-14 결정 재도입 아님, `RETRY_*` 선례 이탈은 의식적 유보로 보존됨. INFO 2건(Rationale 포인터 부재 이월, §4.2 미등재 target 밖) |
| convention_compliance | NONE | anchor 15개 전수 실존·내용 일치, frontmatter 스키마 충족, §3 예외 레지스트리 절차 준수. INFO 1건(헤딩 표기 스타일, 위반 아님) |
| plan_coherence | NONE | §Overview 델타가 `spec-conventions-engine-error-code-surface.md` 체크리스트와 문자 그대로 일치, §3 clobber 경고 미실현. INFO 4건(1R/3R 재확인, §4.2 유예 누적, 커밋 혼재 절차 특이점 등) |
| naming_collision | NONE | `EngineErrorCode` 는 기존 식별자의 문서 최초 등재, 신규 ID·엔티티·endpoint·이벤트·ENV 충돌 없음. INFO 1건(`SCAN_ROOTS` 파일-로컬 이름 유사) |

## 권장 조치사항

1. (선택) `spec/conventions/error-codes.md` `## Rationale` 에 신설 두 문단의 판단-기준 유보 근거를 한 줄 포인터로 추가 — `exec-intake-followups.md` ARCH#5 ⑤ 인용.
2. (추적 유지) `spec-impl-evidence.md §4.2` SoT 표에 `stray-tool-tags.test.ts` 를 등재하는 후속 작업 — 유예 누적 2회, 다음 harness 가드 추가 시 반드시 함께 처리하거나 WARNING 격상.
3. (선택, planner 검토용) "planner 승인 spec 문구에 대한 developer 트랙 wording-only fix" 패턴을 CLAUDE.md 자기-반증형 소정정 조항과 별도로 명문화할지 검토.
4. BLOCK 사유 없음 — 추가 조치 없이 채택 가능.