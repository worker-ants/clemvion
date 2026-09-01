# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건·Warning 0건. INFO 만 존재.

## 전체 위험도
**LOW** — target(`spec/conventions/error-codes.md` §Overview 두 surface 병기)은 6라운드 `--spec` 검토를 거친 문안의 재확인이며, 새 모순·규약 위반·식별자 충돌은 없다. 인접 문서 2건의 선재 drift 는 이미 별도 planner 후속 항목으로 추적 중이다.

## 검토 범위 메모
- 실제 `spec/` 델타는 `spec/conventions/error-codes.md` 1개 파일(11줄 추가/1줄 삭제)뿐이다. 5개 checker 전원이 `git diff origin/main...HEAD -- spec/` 등으로 이를 독립 실측·일치 확인했다.
- 프롬프트에 번들된 "구현 변경 사항"(`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 27줄, `stray-tool-tags.test.ts` 198줄)은 별개 plan(`harness-review-gate-followups.md` 계열, 문서 링크·도구 태그 잔재 검사 하니스)의 산출물로 `error-codes.md`/`ErrorCode`/`EngineErrorCode` 도메인과 무관 — 전 checker 가 동일하게 판단 대상에서 제외했다(단, `stray-tool-tags.test.ts` 는 `spec-impl-evidence.md §4.2` SoT 등재 여부와 관련해 plan_coherence 가 별도로 짚었다 — 아래 INFO 참고).
- 5개 checker 산출물(`cross_spec.md`/`rationale_continuity.md`/`convention_compliance.md`/`plan_coherence.md`/`naming_collision.md`)은 모두 대상 경로에 이미 존재해(Read 로 확인) 별도 영속화가 불필요했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 인접 spec 문서 2건이 `ErrorCode`/`EngineErrorCode`/raw-literal 삼분법을 구분하지 않고 에러 코드를 나열 — target 의 "카탈로그 분류와 1:1 아님" 원칙 적용 시 재분류가 불가능 | `spec/1-data-model.md` §2.13 (~474행), `spec/5-system/3-error-handling.md` §1.4 (108~120행) | 이미 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트 "후속(별도 planner 턴)" 항목으로 등재·추적 중 — 재등재 불요, 다음 planner 턴에서 처리 |
| 2 | cross_spec | 소스 코드 JSDoc 의 "엔진 레이어" 이분법이 target 이 정정한 "1:1 아님" 프레이밍을 아직 반영 못함 | `codebase/backend/src/nodes/core/error-codes.ts:114-115`(`EngineErrorCode` JSDoc, 이미 plan 등재), 1-6행(`ErrorCode` 최상단 JSDoc "node handlers' output.error.code", 미등재) | developer 트랙(소스 주석 수정) — 위 plan 항목 처리 시 `ErrorCode` 최상단 docstring 도 함께 훑을 것을 권장(신규 항목 추가는 planner 재량) |
| 3 | rationale_continuity | 새 §Overview 병기 문단에 대응하는 `## Rationale` 항목이 없음 — 의도적 축소로 확인됨(근거는 spec 본문이 아니라 커밋 메시지·`spec-conventions-engine-error-code-surface.md` plan 에만 존재) | `spec/conventions/error-codes.md` §Overview 신설 두 문단 | (선택) `## Rationale` 에 "두 surface 의 존재만 기술, 판단 기준은 의도적 유보 — 근거 `exec-intake-followups.md` ARCH#5 ⑤" 한 줄 포인터 추가하면 향후 grep/자동 스캔에 더 견고 |
| 4 | convention_compliance | "적용 범위" 문단과 바로 다음 문단이 같은 사실("대표 surface 는 둘")을 서로 다른 어법으로 중복 서술 | `spec/conventions/error-codes.md` Overview, "적용 범위" 문단 끝 ~ 다음 문단 서두 | (선택) 전방 참조 괄호 삭제하고 한 문장으로 통합 — 기능적 문제 아니므로 필수 아님 |
| 5 | plan_coherence | 신규 `stray-tool-tags.test.ts`(build 차단 가드)가 `spec/conventions/spec-impl-evidence.md §4.2` SoT 표(4건 등재)에 미등재 — 실제 5건째 존재 | `spec/conventions/spec-impl-evidence.md §4.2` | 이미 `plan/in-progress/harness-review-gate-followups.md` 에 사유·재개 신호와 함께 정확히 추적됨(이번 PR 은 의도적 유예) — 조치 불요하나, 다음 harness 가드 추가 시에도 또 미루면 누적 drift 로 격상될 수 있어 관찰 권고 |
| 6 | cross_spec | 번들된 "구현 diff" 253줄(`spec-links.test.ts`+`stray-tool-tags.test.ts`)은 이 target 도메인과 무관한 별개 plan 산출물 | 해당 없음 | 조치 불필요 — 그 harness plan 자체의 impl-done 라운드에서 별도로 다룰 사안 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target 자체는 모순 없음(자매 const·키 disjoint·비대칭 발행·2026-06-14 결정 비경쟁 모두 소스 실측 일치). 인접 문서 2건 선재 drift(이미 추적)와 소스 주석 미반영 1곳만 INFO |
| rationale_continuity | LOW | 2026-06-14 Rationale 재도입 아님, `RETRY_*` 선례 이탈은 ARCH#5 ⑤ 유보를 그대로 존중. `## Rationale` 포인터 부재는 의도적 축소(결함 아님)로 확인, INFO 1건 |
| convention_compliance | NONE | 문서 구조·frontmatter·명명 규약(`UPPER_SNAKE_CASE`)·SoT 분리 원칙 전부 위반 없음. 경미한 문단 중복(스타일) INFO 1건 |
| plan_coherence | NONE | `error-codes.md` 편집이 담당 plan 체크리스트와 문자 그대로 일치. 병렬 plan(`spec-update-node-cancellation-shutdown-classification.md`) clobber 경고는 실현 안 됨. 동반 코드 변경의 SoT 미등재는 별도 plan 에 정확히 추적됨 |
| naming_collision | NONE | 새로 도입되는 요구사항 ID·엔티티·endpoint·이벤트·ENV·파일 경로 없음. 유일 신규 등장 토큰 `EngineErrorCode` 는 코드베이스 기존 const 의 사후 명문화이며 spec 전체에서 다른 의미로 선점된 동명 식별자 없음 |

## 권장 조치사항
1. (선택, INFO#3) `error-codes.md` `## Rationale` 에 "두 surface 존재만 서술, 판단 기준은 의도적 유보 — 근거 `exec-intake-followups.md` ARCH#5 ⑤" 한 줄 포인터 추가.
2. (선택, INFO#4) Overview 인접 두 문단의 전방 참조 중복 정리.
3. (다음 planner 턴, INFO#1) `1-data-model.md` §2.13 / `3-error-handling.md` §1.4 의 에러 코드 삼분법(ErrorCode/EngineErrorCode/raw literal) 미반영 — `spec-conventions-engine-error-code-surface.md` 후속 항목으로 이미 등재, 재등재 불요.
4. (developer 트랙, INFO#2) `error-codes.ts` 상단 `ErrorCode` JSDoc 의 "node handlers' output.error.code" 범위 서술도 §Overview 정정에 맞춰 함께 훑기.
5. (관찰, INFO#5) `stray-tool-tags.test.ts` 의 `spec-impl-evidence.md §4.2` 미등재 유예가 다음 harness 가드 추가 때도 반복되면 누적 drift 로 격상 가능 — 추적 유지.