# 보안(Security) 리뷰

## 조사 방법

프롬프트의 `#### 변경된 코드 (unified diff)` 가 잘려 있어(파일 4/5/6 등), `git diff origin/main...HEAD -- <경로>` 로 실제 diff 를 직접 열어 대조했다. 리뷰 대상 81개 파일 중 실질 코드/문서 변경은 앞 7개
(`.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/README.md`,
`.claude/skills/code-review-agents/SKILL.md`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/tests/README.md`, `.claude/tests/test_review_prepare_single_session.py`,
`plan/in-progress/harness-review-gate-followups.md`) 뿐이고, 나머지 74개(`review/code/2026/08/10/**`,
`review/consistency/2026/08/10/**`)는 그날 실행된 이전 리뷰/일관성 검토 세션들의 산출물(markdown 리포트 +
meta/retry-state JSON)이 그대로 커밋된 것 — 신규 실행 로직이 아니라 정적 기록물이다.

## 발견사항

- **[INFO]** 브랜치 diff 기반 "놓친 소스 파일" 목록을 이스케이프 없이 router 프롬프트 본문에 삽입
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:934-945`
    (`build_router_prompt_body` 내 `unseen = _source_files_missing_from_changeset(all_paths)` 이후 블록)
  - 상세: 이번 diff 가 추가한 `_source_files_missing_from_changeset()`(`:1327-1357`)이 반환한 파일 경로들을
    `f"  - \`{p}\`"` 형태로 그대로 markdown 본문에 붙여 router sub-agent 프롬프트에 넣는다. 파일 경로는
    `git diff --name-only` 로 얻은, **이 저장소에 커밋 권한이 있는 사람만** 만들 수 있는 값이라 외부
    신뢰 경계를 넘는 입력은 아니며, 같은 파일의 기존 `src_paths` 표시 로직(`:920`)도 이미 동일한 패턴을
    쓰고 있어 이번 diff 가 새로 도입한 위험이 아니라 기존 설계를 그대로 확장한 것이다. 다만 파일명에
    백틱(`` ` ``)이나 markdown 제어 문자가 섞이면 라우터에게 전달되는 지시문 구조가 흐트러질 수 있는
    이론적 여지는 남는다(신뢰 경계 내부이므로 실공격 가능성은 낮음).
  - 제안: 조치 불요 — defense-in-depth 성격의 참고 사항. 필요 시 파일 경로 표시 전체를 공통 헬퍼로 묶어
    백틱 이스케이프(``` `→\` ```)를 한 곳에서 적용하면 `src_paths`/`unseen` 두 표시 지점이 함께 커버된다.

- **[INFO]** `_default_branch_ref()` / `get_git_branch_diff_files()` 로의 ref 전달 경로는 안전함을 확인
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1303-1324`(`_default_branch_ref`),
    `:1349-1357`(`_source_files_missing_from_changeset` 호출부)
  - 상세: 신규 함수가 `git diff` 커맨드라인에 넘기는 `base` 값은 `git symbolic-ref` 의 실제 출력이거나
    하드코딩된 `"origin/main"`/`"origin/master"` 둘 중 하나로만 좁혀지며, 외부·사용자 입력이 개입할 경로가
    없다. 이전 리뷰(`review/code/2026/08/10/08_32_48/security.md`)가 `git_probe.py`/`consistency_orchestrator.py`
    에서 지적한 "ref 값에 대한 argument-injection 방어 부재" 우려는 그 두 파일이 CLI `--diff-base` 로
    임의 문자열을 받는 경로였던 반면, 이번 신규 코드의 `base` 는 그 우려가 적용되지 않는 안전한 값으로만
    구성된다. 실제 git 호출은 리스트 인자 + `shell=True` 미사용(`_git`, `:981-982`)이라 셸 인젝션도 없음.
  - 제안: 조치 불요 — 확인 목적의 긍정적 관찰.

## 항목별 점검 요약

1. **인젝션**: `subprocess.run` 전부 리스트 인자, `shell=True` 없음. 신규 함수(`_warn_large_changeset`,
   `_source_files_missing_from_changeset`)는 파일 시스템/stdout·stderr 만 다루며 SQL/커맨드/LDAP/경로 탐색
   해당 없음.
2. **하드코딩된 시크릿**: 전체 diff(81 파일) 전수 grep(API key/password/token/bearer/AKIA/ghp_/sk-/PEM 헤더
   패턴) — 0건. `spec-draft-secret-store-verification-footnote.md` 등은 "시크릿 저장소" 기능을 다루는
   plan 문서 **이름**일 뿐 실제 시크릿 값이 아니다.
3. **인증/인가**: 해당 없음 — 로컬 CLI 오케스트레이터/문서/이전 리뷰 산출물이며 런타임 서비스가 아니다.
4. **입력 검증**: 신규 로직이 받는 입력(`change_infos`, `batch_size`, git 명령 stdout)은 모두 저장소
   내부·로컬 프로세스 출처. 외부 사용자 입력 경로 없음.
5. **OWASP Top 10**: 해당 항목 없음(웹 애플리케이션 런타임 코드가 아님).
6. **암호화**: 해당 코드 없음.
7. **에러 처리**: `_default_branch_ref`/`_source_files_missing_from_changeset` 모두 예외를 삼키고 `debug_log`
   에만 남기며(stdout/사용자 응답에 스택트레이스·경로 노출 없음), 이는 문서화된 fail-safe 설계
   ("advisory 가 review 전체를 깨면 안 된다")와 일치한다.
8. **의존성 보안**: 신규 외부 의존성 추가 없음(표준 라이브러리 `subprocess`/`os`/`sys` 및 저장소 내부
   `_shared`/`lib` 모듈만 사용).

나머지 74개 리뷰 산출물 파일(`review/code/**`, `review/consistency/**`)은 이전 세션들의 markdown 리포트와
`meta.json`/`_retry_state.json` 스냅샷을 그대로 기록한 것으로, 실행 로직·시크릿·외부 입력 처리 코드를
포함하지 않는다(내용 확인 결과 각 세션의 자체 security.md 도 일관되게 NONE~LOW 로 판정했다).

## 요약

이번 changeset 의 실질 변경은 `code_review_orchestrator.py` 의 "세션 분할 제거 + 브랜치-diff 기반
fail-closed 교차검사" 두 기능과 그 회귀 테스트, 그리고 대응 문서/plan 갱신이다. 신규 코드는 전부 로컬
git 프로세스 호출(리스트 인자, `shell=True` 없음)과 파일시스템/stdout 조작에 국한되며, 새로 도입된
`base`/`branch_files` 값은 신뢰할 수 있는 출처(git 자체 출력 또는 하드코딩된 리터럴)로만 구성돼 인젝션
경로가 없다. 하드코딩된 시크릿, 인증/인가 로직, 암호화, 민감정보 노출 에러 처리, 알려진 취약 의존성 —
어느 범주에서도 실질적 결함을 찾지 못했다. 유일한 언급 사항은 router 프롬프트에 파일 경로를 이스케이프
없이 삽입하는 기존 패턴을 신규 코드가 그대로 확장한 것으로, 신뢰 경계 내부(커밋 권한자)에서만 발동
가능한 defense-in-depth 수준의 INFO 다.

## 위험도

NONE
