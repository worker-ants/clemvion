# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: `fix(workflow-assistant): system-prompt Self-review skip 안내를 코드에 정합 (finishBlockCount drift)`
변경 파일: `system-prompt.spec.ts`, `system-prompt.ts`, `review/consistency/**` (메타 산출물)

---

## 발견사항

### [INFO] system-prompt.ts — 단일 문장에 과도한 정보 밀도
- 위치: `system-prompt.ts` 변경 라인 (diff +1, `Review/verify is skipped automatically ...` 문장)
- 상세: 기존 문장에 "Note: a prior `PLAN_NOT_COMPLETE` this turn does NOT skip review — plan completeness and workflow-quality review are independent layers, so review can still fire after the plan guard passes." 문구를 inline 으로 append 했다. 결과 문장이 하나의 `Review/verify is skipped automatically...` 절 + 조건 열거 + Note 설명을 모두 포함해 단일 문장 길이가 상당히 길다. LLM 에 전달되는 프롬프트이므로 런타임 영향은 없지만, 향후 이 파일을 편집하는 개발자가 문장 경계를 찾기 어렵다.
- 제안: Note 를 별도 문단 또는 bullet 항목으로 분리해 두면 텍스트 diff 와 향후 수정 시 검색·편집이 용이하다. 현 구조가 틀린 건 아니므로 강제 사항은 아니다.

### [INFO] system-prompt.spec.ts — 인라인 주석 길이가 테스트 의도를 충분히 설명하지만, 영문/한글 혼용 패턴
- 위치: `system-prompt.spec.ts` 추가 블록 (lines 63–70)
- 상세: 기존 코드베이스의 같은 `describe` 블록 안에서는 한국어 인라인 주석이 지배적이다. 추가된 주석도 동일하게 한국어 주석으로 의도를 설명하고 있어 기존 패턴과 일관된다. `expect(prompt).toMatch(/does NOT skip review/i)` 의 정규식은 영문 리터럴이 프롬프트에 들어 있는 실제 문구를 검증하는 것으로 목적이 명확하다. 일관성 관점에서 별도 조치 불필요.
- 제안: 없음.

### [INFO] system-prompt.spec.ts — 회귀 단언 2건의 위치 선택
- 위치: `system-prompt.spec.ts` `teaches the 2-stage finish self-review routine with WORKFLOW_REVIEW_REQUIRED` it 블록 내 추가 단언
- 상세: 추가된 두 단언(`expect(prompt).toMatch(/does NOT skip review/i)`, `expect(prompt).not.toMatch(...)`)은 기존 `WORKFLOW_REVIEW_REQUIRED.{0,100}once more` 단언 직후에 붙어 있다. 같은 `it` 블록 안에 서로 다른 수준의 관심사(review 횟수 제한 vs. skip 조건 정합)가 공존한다. 이 점은 함수/블록 단일 책임 관점에서 약간의 결합이 있으나, 추가 단언 수가 2건으로 적고 맥락상 동일 `Self-review` 섹션 내용이어서 별도 `it` 블록 분리 강제는 과도하다. 현재 수준에서 수용 가능.
- 제안: 장기적으로 self-review skip 조건 관련 단언이 추가될 경우 별도 `it('skips review only under defined conditions, not when PLAN_NOT_COMPLETE fires')` 블록으로 분리하면 가독성이 올라간다.

### [INFO] review/consistency/** 메타 산출물 — meta.json `mode`/`target_path` 필드가 매우 긴 단일 문자열
- 위치: `review/consistency/2026/06/24/14_03_16/meta.json`
- 상세: `mode` 와 `target_path` 필드가 255자 이상의 자유 형식 텍스트다. 도구(orchestrator, sub-agent)가 자동 생성하는 파일이므로 개발자가 직접 편집하지 않지만, 수동으로 내용을 검색하거나 diff 를 읽을 때 가독성이 낮다. 유지보수성보다는 생성 프로세스 설계 문제이며, 코드 수정 범위 밖이다.
- 제안: 도구 수준에서 `scope` 를 구조화 필드(`target_files`, `summary` 등)로 분리하면 향후 검색·파싱이 쉬워진다. 이번 변경 범위 밖 이슈.

---

## 요약

이번 변경은 `system-prompt.ts` 의 LLM 안내 문구 한 문장 교정과 해당 교정의 회귀 단언 2건 추가로 구성된 소규모 behavior-neutral 픽스다. 코드 가독성·네이밍·중복 측면에서 새로 도입된 문제는 없으며, 기존 `system-prompt.spec.ts` 의 주석 스타일·테스트 구조 패턴과 일관성이 유지된다. 유일한 주목 지점은 `system-prompt.ts` 에서 기존 단일 문장에 Note 를 inline append 한 방식으로, 향후 편집 편의를 위해 별도 문단으로 분리하면 좋으나 현 형태가 즉각적인 유지보수 위험을 만들지는 않는다. 총체적으로 유지보수성 측면에서 안전한 변경이다.

## 위험도

NONE

STATUS: OK
