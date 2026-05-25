# RESOLUTION — 15_42_38

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | 24358787 | button_click warn 을 `logger.warn(msg, { executionId, buttonId })` 구조화 |
| W2 | 코드 | 24358787 | getPendings 헬퍼를 최상위 describe 스코프로 승격해 waitForAiConversation 테스트 재사용 |
| W3 | 코드 | 24358787 + d0f8bfeb | ContinuationPayload discriminated union 추가 (queues/continuation-execution.queue.ts). button_click / ai_message 분기 인라인 단언 제거. ContinuationJob.payload 는 ContinuationMessage 호환성 위해 unknown 유지 |
| W4 | 코드 | 24358787 | button_click × N → ai_message → ended 인터리빙 통합 테스트 추가 |
| W5 | 코드 | 24358787 | buttonId 경계값 테스트 3건 추가 (64자 초과 슬라이싱, null, 숫자) |
| W6 | spec | (draft 위임) | `plan/in-progress/spec-fix-presentation-common-frontmatter.md` |
| W7 | spec | (draft 위임) | `plan/in-progress/spec-fix-presentation-common-frontmatter.md` |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4898 passed, +4 신규)
- e2e   : 통과 (123/123)

## 보류·후속 항목

- spec draft 위임 (W6 + W7): `plan/in-progress/spec-fix-presentation-common-frontmatter.md`
  - W6: spec/4-nodes/6-presentation/0-common.md frontmatter status/code 필드 갱신
  - W7: spec/4-nodes/6-presentation/0-common.md §9 CHANGELOG 에 회귀 수정 기재
  - 처리: project-planner 역할. `/consistency-check --spec` 후 반영 필요.

- INFO #1 (보안): button_click 무한 전송 이론적 DoS — 상위 rate limiting 의존. 별도 대응 불필요 (현재 설계 범위 내).
- INFO #2 (보안): `_retry_state.json` 로컬 절대경로 커밋 — review 산출물 특성상 허용.
- INFO #3 (유지보수성): 매직 숫자 64/25 상수화 — 별도 리팩토링 PR 후보.
- INFO #4 (유지보수성): 파일 끝 개행 없음 — lint 미탐지, 필요 시 별도 처리.
- INFO #5 (테스팅): `warnSpy.mockRestore` finally 누락 — 신규 W5 테스트에서 finally 패턴 미적용. 개선 후보.
- INFO #6 (테스팅): cancel race 미검증 — 별도 테스트 후보.
- INFO #7 (요구사항): spec line 번호 참조 stale 가능 — 다음 spec 갱신 시 함께 검토.
- INFO #8 (요구사항): `pendingEntry?.resolve` non-null 명시성 — 현재 옵셔널 체이닝으로 처리중. 변경 불필요.
