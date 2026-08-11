# 보안(Security) 리뷰

## 조사 방법

프롬프트에는 84개 "파일"이 나열되어 있으나, 실제로 이번 라운드(직전 `14_09_31` 대비)가 도입한
코드 변경은 오케스트레이터가 명시한 delta 5건뿐이다. 나머지 대다수(파일 9~84)는 `review/code/**`,
`review/consistency/**` 하위의 **이전 리뷰·일관성 검사 라운드의 산출물 마크다운/JSON**으로, 이
worktree 가 다른 세션과 공유되며 `review/` 가 gitignore 대상이 아니라서(→ 미커밋 산출물이 changeset
에 새 파일로 잡힘) 함께 실린 것이다. 이 파일들은 정적 리포트 텍스트일 뿐 실행되는 코드가 아니며,
각자 자기 라운드에서 이미 보안 평가(NONE/LOW)를 받은 상태이므로 이번 라운드에서 재평가할 실질
대상이 아니다.

실제 diff는 `git show ffb2cfbe5`(및 그 전후 문서 정정 커밋)로 직접 대조했다:

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — 라우터 프롬프트의
  "파일 목록 20개 자르기" 포맷팅 두 곳을 `_bulleted_path_sample()` 헬퍼로 추출(순수 리팩터, 로직
  변경 없음)
- `.claude/tests/test_review_prepare_single_session.py` — `main()` 실행 시 stderr 캡처 + call-site
  단언 2건 추가, `ALL_AGENTS` 손 나열을 `orch.ALL_AGENTS` 참조로 교체(테스트 전용)
- `.claude/tests/test_line_anchors.py` — `pick_commit_fixture` 가 삭제-전용 커밋을 고르지 않도록
  `git show {sha}:{f}` 로 "sha 시점에 내용이 남아있는 파일이 하나라도 있는지" 사전 확인(테스트
  픽스처 선택 로직, 테스트 전용)
- `.claude/tests/README.md`, `.claude/skills/code-review-agents/README.md`,
  `.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/SKILL.md`,
  `plan/in-progress/harness-review-gate-followups.md` — 문서 정정(모순 문구 수정, 처분 기록)

## 발견사항

없음.

- `_bulleted_path_sample()` 은 기존에 두 곳에 중복돼 있던 `f"  - \`{p}\`"` 포맷 로직을 그대로
  옮긴 순수 추출이며, 입력(`src_paths`/`unseen`)의 출처·검증 방식·이스케이프 여부 어느 것도
  바뀌지 않았다. 파일 경로는 이미 `git diff --name-only` 로 얻은 저장소 자신의 커밋된 경로이고,
  이 값이 라우터(LLM) 프롬프트에 마크다운 bullet 로 삽입되는 방식도 리팩터 전후 동일하다 —
  이론적 prompt-injection 표면(예: 백틱이 포함된 파일명)이 있다면 그것은 이 diff 이전부터
  존재한 것이고 이번 변경으로 새로 생기거나 넓어지지 않았다.
- 테스트 쪽 `_git("show", f"{sha}:{f}", cwd=cwd)` 호출은 `subprocess.run(["git", *args], ...)`
  형태로 리스트 인자를 쓰며(`shell=True` 없음), `sha`/`f` 모두 같은 함수 안에서 `git log`/
  `git diff --numstat` 출력을 파싱해 얻은 로컬 저장소 자신의 커밋 SHA·경로다. 외부 입력이
  섞일 경로가 없어 커맨드 인젝션·인자 인젝션 우려가 없다(테스트 전용 코드이기도 하다).
- `ALL_AGENTS` 손-나열 제거는 테스트가 프로덕션 목록을 재선언하던 것을 단일 SoT(`orch.ALL_AGENTS`)
  참조로 바꾼 것으로, 보안과 무관한 유지보수성 개선이다.
- 문서 정정 5건은 모두 서술 텍스트 교정(모순 문구 삭제, 처분 사실 기록)이며 코드·설정 변경이
  없다.
- 하드코딩된 시크릿, 인증/인가 로직, 암호화/해시 로직, 사용자 입력 처리 경로는 이번 diff 어디에도
  없다 — 대상 전체가 로컬 개발 하네스(리뷰 오케스트레이터)의 프롬프트 포맷팅과 그 유닛 테스트에
  국한된다.

## 요약

이번 라운드의 실질 diff는 (1) 라우터 프롬프트 안 파일-목록 포맷팅 중복 제거(순수 리팩터, 동작
불변), (2) 테스트 전용 stderr 캡처·call-site 단언 추가, (3) 테스트 픽스처 선택 로직이 삭제-전용
커밋을 거르도록 한 보강, (4) 문서 정정 5건으로 구성된다. 전부 개발 하네스 내부 코드·테스트·문서이고
외부 입력·네트워크·DB·인증 경계를 다루지 않으며, 인젝션·시크릿·인가·암호화·에러 노출·의존성 어느
카테고리에서도 신규 취약점을 도입하지 않았다. 프롬프트에 함께 실린 나머지 파일 대다수(9~84번)는
이전 라운드의 리뷰/일관성 검사 산출물(정적 마크다운/JSON)로 이번 라운드가 만든 코드가 아니며 보안
관점에서 채점 대상이 아니다.

## 위험도

NONE
