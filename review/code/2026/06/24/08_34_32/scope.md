# 변경 범위(Scope) 리뷰

**리뷰 대상 커밋**: `1c17795c` — refactor(workflow-assistant): M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리

---

## 발견사항

### 코드 변경 파일 (파일 1–7)

**[INFO]** `z` 임포트 제거 — 의도에 부합하는 정리
- 위치: `workflow-assistant-stream.service.ts` 상단 (라인 3 `-import { z } from 'zod';`)
- 상세: `collectPendingUserConfig` 의 분리(파일 4)로 `z.toJSONSchema` 호출이 스트림 서비스에서 사라졌다. 임포트 제거는 분리 리팩토링의 직접 결과이므로 불필요한 임포트 정리가 아니라 리팩토링에 종속된 필수 변경이다.
- 제안: 해당 없음.

**[INFO]** `toWorkflowView`, `WorkflowView`, `detectPendingUserConfig`, `ActivePlanContext`, `buildReviewChecklist`, `checklistBlocks`, `ReviewChecklistItem` 임포트 제거
- 위치: `workflow-assistant-stream.service.ts` 임포트 블록
- 상세: 위 심볼들은 `AssistantFinishGuard` 와 `collectPendingUserConfig` 로 이전된 로직에서 사용하던 것들이다. 분리가 완료됐으므로 스트림 서비스에서 제거가 맞다. 잔류 임포트 없음 확인.
- 제안: 해당 없음.

**[INFO]** `isPlanPendingApproval` 가 `workflow-assistant-stream.service.ts` 의 private function 에서 `active-plan-context.ts` 의 exported function 으로 이전
- 위치: `active-plan-context.ts` 끝부분 (라인 64–72 신규 추가) / `workflow-assistant-stream.service.ts` 끝부분 (라인 1591–1598 삭제)
- 상세: 커밋 메시지에 "isPlanPendingApproval → active-plan-context.ts(서비스 3곳+가드 공유)"라고 명시. 가드 분리를 위해 공유 헬퍼를 추출한 것이며 리팩토링 목적에 직결된 변경이다. detached JSDoc ("2개 이상의 문서 블록이 연속 출현" 패턴) 1건 제거도 함께 이뤄졌다 — 스트림 서비스 라인 1278–1306 영역에서 이중 JSDoc 블록이 제거됐다. 이것도 분리 과정의 부수 정리로 볼 수 있다.
- 제안: 해당 없음.

**[INFO]** `REVIEW_ORIGINAL_REQUEST_MAX_LEN`, `MIN_NONTRIGGER_NODES_FOR_VERIFY`, `MAX_REVIEW_ROUNDS`, `truncateReviewOriginalRequest` 상수·함수 이동
- 위치: `workflow-assistant-stream.service.ts`에서 삭제 → `assistant-finish-guard.service.ts`로 이동 (verbatim)
- 상세: 커밋 메시지에 "가드 상수(MAX_REVIEW_ROUNDS 등) verbatim 이동"으로 명시. 동작 변경 없는 코드 이동이며 리팩토링 목적에 부합. 이동 대상 코드 외 상수·함수의 추가·수정은 없다.
- 제안: 해당 없음.

### 산출물 파일 (파일 8–15): review/consistency/2026/06/24/07_58_47/

**[INFO]** consistency 검토 산출물 전체가 코드 변경 커밋에 포함
- 위치: `review/consistency/2026/06/24/07_58_47/` 하위 7개 파일 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: 커밋 메시지에 "impl-prep review/consistency/2026/06/24/07_58_47 BLOCK:NO" 가 명시되어 있다. 이 산출물들은 구현 착수 전 `--impl-prep` 검토 결과로, 프로젝트 CLAUDE.md 규약상 developer 가 `consistency-check --impl-prep` 을 의무로 실행하고 그 결과가 `review/consistency/**` 에 저장된다. 즉, 이 파일들은 구현 커밋의 선행 절차 산출물이며 동일 커밋에 포함하는 것이 본 프로젝트의 관행이다.
- 제안: 해당 없음 (관행 준수).

---

## 요약

본 변경(M-3 2단계)의 의도는 `WorkflowAssistantStreamService.streamMessage` 에 내재화되어 있던 finish/review 가드 로직을 `AssistantFinishGuard` 라는 무상태 협력 객체로 분리하는 것이다. 7개 코드 파일의 변경은 모두 이 분리에 직접 종속된 이동(verbatim move), 공유 헬퍼 추출, 의존성 주입 추가, 단위 테스트 신설, NestJS 모듈 등록, 그리고 분리로 인한 임포트 정리로 이뤄져 있으며, 범위를 벗어난 리팩토링·기능 추가·무관한 파일 수정은 발견되지 않는다. `review/consistency/` 산출물 8개는 프로젝트 의무 절차의 결과물로, 코드 변경 커밋에 포함되는 것이 이 저장소의 확립된 패턴이다. 포맷팅·주석·설정 파일 관점에서 의도와 무관한 변경은 없다.

---

## 위험도

NONE
