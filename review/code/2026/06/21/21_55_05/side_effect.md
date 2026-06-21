# 부작용(Side Effect) 리뷰

> 대상 커밋: 960968b — M-1 2단계 fresh review WARNING 해소 (AiMemoryManager 테스트 커버리지 보강)
> 리뷰어: side_effect

---

## 발견사항

### [INFO] `_retry_state.json` 에 개발 머신 절대 경로 포함 (기존 지적 재확인)
- 위치: `review/code/2026/06/21/21_43_55/_retry_state.json` — `session_dir`, `summary_output_file`, `router_prompt_file`, 각 `prompt_file`/`output_file` 필드
- 상세: 개발 머신의 절대 경로(`/Volumes/project/private/clemvion/...`)가 git 이력에 포함된다. 실행 환경 파일시스템 구조가 노출되는 파일시스템 부작용이나, 이 파일은 review 산출물 상태 추적용이며 production 경로에 영향을 주지 않는다. 이전 세션 SUMMARY.md INFO #4 에서 이미 인지된 사항.
- 제안: `review/**/_retry_state.json` 을 `.gitignore` 에 추가 (이번 변경 범위 밖, 별도 위생 작업).

---

## 요약

이번 변경의 핵심은 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` 에 3개의 단위 테스트 케이스를 추가한 것이다. 모든 신규 테스트는 Jest mock(`jest.fn()`)을 사용한 완전히 격리된 단위 테스트로, 전역 변수 수정 없음, 파일시스템 접근 없음, 네트워크 호출 없음, 공유 상태 변경 없음이다. 테스트 픽스처는 모듈 스코프 팩토리 함수(`llmFake`, `threadFake`, `agentMemFake`, `baseInject`)를 재사용하며 각 테스트 케이스가 독립 인스턴스를 생성한다. production 코드(`ai-memory-manager.ts`) 변경은 0이다. 기존 함수·메서드 시그니처, 공개 API, 이벤트/콜백 체계 모두 무변경이다. review 산출물 파일(RESOLUTION.md, SUMMARY.md, `_retry_state.json`) 추가는 review 디렉터리에만 한정되며 codebase 에 영향이 없다. `_retry_state.json` 의 절대 경로 포함은 기존 리뷰에서 이미 식별된 INFO 수준 사항이며 신규 부작용이 아니다.

---

## 위험도

NONE
