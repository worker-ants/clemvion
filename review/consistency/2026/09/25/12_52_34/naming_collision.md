# 신규 식별자 충돌 검토 — `plan/in-progress/changelog-criteria.md`

## 발견사항

- **[WARNING]** `documentation` 리뷰어 "관점 6" 정의가 두 파일에 동일 텍스트로 존재 — target 은 한쪽만 갱신
  - target 신규 식별자: target 처방(B절 4행)이 `.claude/agents/documentation-reviewer.md` 의 "6. **변경 이력**: 중요한 변경에 대한 CHANGELOG 업데이트 필요성" 을 "기준을 가리키게" 바꾼다고 명시
  - 기존 사용처: 동일 문구가 byte 단위로 `.claude/skills/code-review-agents/lib/role_instructions.py:141` (`REVIEWER_INSTRUCTIONS["documentation"]["checklist"]` 항목 6) 에도 존재한다. 이 파일 자신의 docstring(`role_instructions.py:3-13`)이 "sub-agent 의 system prompt(`.claude/agents/<name>.md`) 는 이미 역할을 설명하지만, orchestrator 가 만드는 prompt body 도 **별도로** role-specific 이어야 한다 — reinforcement 목적으로 checklist 를 사용자 메시지 안에도 반복한다" 고 스스로 밝힌다. 즉 documentation 리뷰 세션 1회에 이 항목 6 문구가 **system prompt + orchestrator 생성 프롬프트 본문** 두 자리에 겹쳐 들어간다.
  - 상세: target 이 "지금 이 문장이 저장소 안의 **유일한** 기준 언급이다" 라고 전제하고 `.claude/agents/documentation-reviewer.md` 만 고치면, `role_instructions.py` 쪽 사본은 원문("중요한 변경에 대한 CHANGELOG 업데이트 필요성") 그대로 남는다. 다음 documentation 리뷰 세션에서 같은 관점 6 이 한쪽은 "새 기준 참고", 다른 쪽은 옛 일반 문구로 **동일 항목 번호·동일 역할에 대해 두 개의 어긋난 정의**로 sub-agent 에게 동시에 주입된다 — "유일한 기준 언급" 이라는 전제 자체가 실측(grep)과 어긋난다.
  - 제안: `role_instructions.py:136-143` 의 `documentation.checklist` 항목 6 도 같은 턴에 동반 갱신 대상으로 target 의 B절 표에 추가하거나, 최소한 "유일한 기준 언급이다" 문구를 정정한다(사실은 "system-prompt 와 orchestrator checklist 두 곳에 동일 사본이 있다"). `role_instructions.py` 는 `.claude/skills/**` 경로이므로 harness 코드/도구 축 — developer 소유 범위 안이라 같은 PR 에서 처리 가능하다.

## 요약

target 문서는 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수·spec 파일 경로 등 통상적 의미의 "신규 식별자" 를 도입하지 않는다 — `CHANGELOG.md` 상단 기준 블록 신설, 기존 `## 부수 —` 헤딩의 접두 보정(해당 태그는 이미 CHANGELOG 에 1건 존재하던 것이라 신규 도입이 아님), V110~V130 마이그레이션 백필 항목(실재 파일 확인됨), `.claude/agents/documentation-reviewer.md` 관점 6 문구 수정뿐이다. 6개 점검 관점 중 1~5 는 해당 사항이 없고, 6(파일 경로 충돌)도 기존 파일을 편집하는 것이라 경로 자체의 충돌은 없다. 다만 target 이 근거로 삼은 "documentation-reviewer.md 의 이 문장이 저장소 안의 유일한 기준 언급" 이라는 전제가 grep 실측과 어긋난다 — 동일 checklist 항목이 `role_instructions.py` 에도 사본으로 존재하고 이는 실제 리뷰 프롬프트에 병행 주입되는 구조이므로, 한쪽만 고치면 다음 documentation 리뷰가 상충하는 두 문구를 동시에 받는다. 이는 엄밀한 "다른 의미의 식별자 재사용" 보다는 "동일 정의의 미동기화 사본" 에 가깝지만, target 의 처방 완결성에 직접 영향을 주므로 WARNING 으로 기록한다.

## 위험도

LOW
