# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** review/** 산출물 파일 다수 커밋에 포함
  - 위치: `review/consistency/2026/06/24/14_03_16/` 하위 파일 5개 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, naming_collision.md, meta.json)
  - 상세: 이 파일들은 impl-prep consistency check 의 필수 산출물로, developer SKILL 의 "구현 착수 전 consistency-check --impl-prep 의무" 에 의해 커밋이 요구된다. 무관한 파일이 아니라 이 PR 의 선행 게이트 증거다.
  - 제안: 없음. 정상 범위.

- **[INFO]** `system-prompt.spec.ts` 에 단언 2건 추가 (lines 63-70)
  - 위치: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts`, 기존 테스트 케이스 `'teaches the 2-stage finish self-review routine...'` 내부
  - 상세: 추가된 단언은 `expect(prompt).toMatch(/does NOT skip review/i)` 와 `expect(prompt).not.toMatch(...)` 2건이다. 이는 `system-prompt.ts` 의 동일 문구 변경에 대응하는 회귀 가드로, 커밋 메시지에 명시된 목적("drift 재발 방지") 과 정확히 일치한다. 테스트 파일 외 다른 코드 영역에 영향 없음.
  - 제안: 없음. 정상 범위.

- **[INFO]** `system-prompt.ts` 변경은 단 1줄 (line 382)
  - 위치: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts`, `STATIC_BLOCK_3_EDIT_PLAYBOOK` 상수 내 Self-review 문단
  - 상세: diff 는 단 1줄 교체다. 옛 skip clause 제거 + "does NOT skip review" 정정 문구 추가가 하나의 문자열 치환으로 처리됐다. 파일 내 다른 어떤 블록(STATIC_BLOCK_1, STATIC_BLOCK_2, 함수 시그니처, 캐시 로직)도 건드리지 않았다.
  - 제안: 없음. 정상 범위.

## 요약

이번 변경은 `system-prompt.ts` 의 LLM 안내 문자열 1줄을 코드(`AssistantFinishGuard.shouldSkipReview`) 동작에 정합시키고, 그에 대응하는 회귀 단언 2건을 동일 파일의 기존 테스트 케이스에 추가한 behavior-neutral fix다. 변경된 파일은 `system-prompt.ts` 1개, `system-prompt.spec.ts` 1개, 그리고 impl-prep 의무 산출물인 `review/consistency/` 하위 파일들로 구성된다. 의도와 무관한 리팩토링, 기능 추가, 불필요한 임포트·포맷팅 변경, 설정 파일 수정은 없다. 범위 일탈 없음.

## 위험도

NONE

STATUS: OK
