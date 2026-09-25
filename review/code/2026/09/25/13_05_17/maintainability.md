# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** CHANGELOG 기준 배너 상단의 「이 기준 이전의 이력은 완전하지 않다」 월별 비율(0% · 5% · 37% · 30% · 49%)이 세 문서에 동일 값으로 중복 기재돼 있다
  - 위치: `CHANGELOG.md:20`(배너), `plan/in-progress/changelog-criteria.md:29-33`(A-2 표, 원본 실측), `plan/in-progress/spec-draft-nullable-notation-followups.md:5185`(트래커 종결 메모)
  - 상세: 세 곳 모두 값이 정확히 일치함을 확인했다(0/5/37/30/49). 다만 통계는 `plan/in-progress/changelog-criteria.md` 의 `cl_monthly.py` 실측이 원본(SoT)이고, 나머지 둘은 그 값을 손으로 옮겨 적은 사본이다. 나중에 재집계(예: 범위를 넓히거나 계산 오류를 정정)해 값이 바뀌면 세 곳을 전부 손으로 맞춰야 하며, 자동 검증(테스트·가드)은 없다. 다만 이는 이 프로젝트에서 "plan 종결 메모가 핵심 수치를 인용" 하는 기존 관행(예: `CHANGELOG.md` 의 다른 항목들도 plan 수치를 인용)과 같은 패턴이라 이번 PR 이 새로 만든 리스크는 아니다.
  - 제안: 조치 불필요(현 상태로 값이 일치). 다음에 이 수치를 정정할 일이 생기면 세 곳을 동시에 검색(`grep`)해 갱신하도록 plan 후속 메모에 남겨두면 좋다.

- **[INFO]** `CHANGELOG.md` 상단 배너가 `plan/complete/changelog-criteria.md` 를 가리키지만, 이 diff 시점에는 해당 plan 이 아직 `plan/in-progress/changelog-criteria.md` 에 있다(체크리스트에 `[ ] /ai-review`, `[ ] 트래커 항목 닫기 + 재판정 후보 등재` 두 항목 미완료)
  - 위치: `CHANGELOG.md:3` (참조) / `plan/in-progress/changelog-criteria.md` (실제 위치, 전체 파일이 diff 대상)
  - 상세: `.claude/docs/plan-lifecycle.md` §3 "이동은 마지막 작업 PR 안에서" 규칙에 따르면 이 PR 의 마무리 커밋에서 두 체크박스를 완료하고 `complete/` 로 옮기면 참조가 맞아떨어진다. 실제로 `CHANGELOG.md:671` 에 `plan/complete/spec-draft-rotate-conflict.md` 를 가리키는 기존 항목이 있어(grep 실측), 완료 예정 경로를 미리 적어두는 것이 이 저장소의 기존 관행임을 확인했다. 새 결함이 아니라 **이 PR 이 아직 진행 중이라는 사실을 반영하는 정상 상태**다.
  - 제안: 조치 불필요. 다만 이 PR 이 두 체크박스를 완료하지 않고 병합되면 참조가 끊어지므로, 마무리 커밋에서 `git mv` 를 잊지 않도록 체크리스트 자체가 이미 상기시키고 있다(추가 조치 불필요).

- **[INFO]** `documentation` 리뷰어 체크리스트 항목 6 문구가 `.claude/agents/documentation-reviewer.md:21` 과 `.claude/skills/code-review-agents/lib/role_instructions.py:141` 두 파일에 손으로 병행 편집된 사본으로 존재
  - 위치: `.claude/agents/documentation-reviewer.md:21`, `.claude/skills/code-review-agents/lib/role_instructions.py:141`
  - 상세: 두 문자열을 직접 대조해 byte 단위로 일치함을 확인했다 — 이번 편집은 정확히 동기화됐다. 다만 `.claude/tests/test_agent_consistency.py` 는 설계 의도상 "레지스트리 수준" 만 검사하고 두 파일의 checklist 본문 일치 여부는 **의도적으로 가드하지 않는다**(그 파일 docstring 이 명시). 즉 이 이중 편집이 다음에도 계속 정확히 반영될지는 리뷰어의 수작업 대조에 의존한다. 이번 PR 의 사전 `--spec`/consistency-check(`review/consistency/2026/09/25/12_52_34`, WARNING #2)가 이미 이 이중 사본 문제를 지적했고, 이번 diff 가 실제로 두 곳 모두 갱신해 그 지적을 해소했음을 확인했다.
  - 제안: 조치 불필요(이미 해소됨). 두 파일 동기화가 반복적으로 문제되면(현재는 설계상 의도적 비가드) `test_agent_consistency.py` 의 범위를 넓히는 편이 근본 해법이나, 이는 이 PR 범위 밖(harness 테스트 정책 변경)이다.

## 요약

이번 변경은 실제 애플리케이션 로직 코드를 건드리지 않고 CHANGELOG 판정 기준 문서 신설, 관련 plan 문서 2건, 리뷰어 체크리스트 문구 동기화(2개 파일 병행 편집), 그리고 사전 실행된 consistency-check 산출물(`review/consistency/**`) 커밋으로 구성된다. 새 코드가 없으므로 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 전통적 코드 품질 지표는 해당 사항이 없다. 문서 레벨에서는 가독성이 양호하고(번호 목록·굵은 글씨로 "낸다/안 낸다" 기준을 명확히 구분), 기존 CHANGELOG 의 표 형식·plan 파일 규약(prefix 형식·frontmatter)과 일관된다. 두 리뷰어 체크리스트 파일의 병행 편집은 byte 단위로 정확히 동기화됐고, 이는 이전 consistency-check 가 지적한 WARNING 을 해소한 결과다. 확인한 잠재적 유지보수 리스크(핵심 통계의 3중 중복 기재, plan 경로의 예정 참조)는 모두 이 저장소의 기존 관행과 일치하고 현재 값도 서로 어긋나지 않아 INFO 수준에 그친다.

## 위험도
NONE
