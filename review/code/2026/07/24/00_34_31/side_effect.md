# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `guard_default_branch_bash.py` 의 상호 참조 주석이 이번 수정으로 stale 해짐
  - 위치: `.claude/hooks/guard_default_branch_bash.py` — `_MUTATING` 정의 바로 위 주석 블록 (함수/상수명: `_MUTATING`, 리뷰 대상 3파일에는 포함되지 않은 파일)
  - 상세: 해당 주석은 "`guard_review_before_push.py` 가 `_GIT_PUSH`/`_SEGMENT_IS_GIT` 양쪽에 근사한 env-prefix 그룹을 갖고 있고 **둘 다** 아직 `\S+` 형태다"라고 서술한다. 이번 PR 로 `_GIT_PUSH` 는 3-대안 인용부호 인식 패턴으로 교체되어 더는 `\S+` 가 아니고, `_SEGMENT_IS_GIT` 만 (의도적으로, 해제 경로라 안전 방향이므로) `\S+` 로 남는다. 이 파일은 이번 diff 범위 밖이라 주석이 갱신되지 않았고, 이제 사실과 다른 서술을 남긴다. 기능적 부작용은 없지만 향후 이 주석만 보고 "두 정규식 모두 아직 결함 있음"으로 오판할 수 있는 문서 drift다.
  - 제안: `guard_default_branch_bash.py` 의 해당 주석을 "`_GIT_PUSH` 는 §J 로 수정 완료, `_SEGMENT_IS_GIT` 만 `\S+` 로 남음(해제 경로라 안전 방향)"으로 갱신 — 이번 PR 또는 별도의 사소한 후속 커밋에서.

- **[INFO]** `_GIT_PUSH` 정규식 확장은 훅의 탐지 범위를 의도적으로 넓힘 (참고용 기록)
  - 위치: `.claude/hooks/guard_review_before_push.py:107` (`_GIT_PUSH = re.compile(...)`)
  - 상세: 이 정규식은 매 `Bash` PreToolUse 호출마다 실행되는 훅의 핵심 판정 로직이다. 이번 변경으로 이전에는 감지되지 않던 (`GIT_SSH_COMMAND="ssh -i ~/.key" git push` 류) 명령이 이제 `push`로 감지되어 REVIEW/PLAN 게이트를 통과하게 된다 — 즉 이 훅을 거치는 모든 세션에 걸쳐 차단 대상이 넓어지는 **행동 변화**다. 이는 §J 로 추적된 의도된 수정이고, `test_push_guard_allowlist.py` 의 `QuotedEnvPrefixTest`/`DifferentialTest`/`ReleasePathNarrownessTest` 로 회귀 방지가 마련되어 있으며, 새 정규식이 파국적 백트래킹을 일으키지 않는지도 별도로 실측했다(수십만 자 입력에서도 수 ms). 부작용이 아니라 의도된 동작 변경이므로 정보성으로만 기록한다.
  - 제안: 없음 (참고 기록).

## 점검한 항목 (문제 없음)

- **전역 변수**: 신규 모듈 레벨 상수(`_GIT_PUSH` 패턴 텍스트, 테스트 파일의 `_LEGACY_PATTERN`/`_BLIND_PATTERN`/`_LEGACY`/`_BLIND`)는 모두 불변(컴파일된 정규식/문자열)이며 기존 명명 규약을 따른다. 함수 실행 중 전역 상태를 변경하는 코드는 없다.
- **함수/메서드 시그니처**: `_is_git_push`, `_redact_inert_text`, `main()`, `_run_gates`, `_owns_heredoc_as_message` 등 기존 공개 함수의 시그니처는 변경되지 않았다. 호출자 영향 없음.
- **공개 인터페이스**: 훅의 PreToolUse 계약(`exit 0`/`exit 2`/기타)은 그대로다. 다만 위 INFO 항목대로 `_is_git_push` 의 판정 결과 자체는 의도적으로 넓어졌다.
- **파일시스템 부작용**: `push_guard_failopen.json` 기록 로직(`failopen_state.report`)은 이번 diff 에서 손대지 않았다. 새로 생성/삭제되는 파일 없음. `plan/in-progress/harness-guard-followups.md` 변경은 체크리스트 텍스트 편집뿐(빌드/런타임에 영향 없는 문서).
- **환경 변수**: `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 읽기는 기존 그대로. 새 환경 변수 도입이나 쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음. `outcome` 객체(`_Outcome`)에 대한 append 로직도 변경되지 않았다.
- **테스트 파일의 부작용**: `BacktrackingTest` 가 `subprocess.run` 으로 별도 프로세스를 띄우는 기존 패턴은 유지되며 이번 diff 로 신규 도입되지 않았다. 새로 추가된 `QuotedEnvPrefixTest`/`ReleasePathNarrownessTest` 는 순수 함수 호출 기반 단언이라 부작용 없음.

## 요약

이번 변경은 `git push` 탐지 정규식(`_GIT_PUSH`)의 env-prefix 그룹을 `guard_default_branch_bash.py` 의 기존 3-대안 패턴과 byte-identical 하게 맞춰 인용부호 안에 공백이 있는 env 값(`GIT_SSH_COMMAND="ssh -i ~/.key" git push`)을 더 이상 놓치지 않도록 하는 보안 수정이며, 그에 맞춰 테스트 스위트가 `_LEGACY_PATTERN`(불변 회귀 바닥)과 `_BLIND_PATTERN`(현재 blind 패턴)을 분리해 pin 구조 자체를 더 견고하게 만들었다. 함수 시그니처·공개 인터페이스·전역 상태·파일시스템·환경 변수·네트워크·콜백 어느 축에서도 의도치 않은 부작용은 발견되지 않았다. 유일하게 짚을 점은 `guard_default_branch_bash.py` 에 남아 있는 상호 참조 주석이 이번 수정 이후 사실과 어긋나게 된 문서 drift(INFO)이며, 이는 기능적 위험이 아니라 향후 유지보수 시 오판 가능성에 대한 참고 사항이다.

## 위험도

LOW
