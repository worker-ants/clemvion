# 변경 범위(Scope) Review — harness-block-backstop (2026-08-01 01:49:32)

## 조사 방법

프롬프트가 지정한 44개 파일 전부가 `review/code/2026/08/01/{00_03_38,00_33_34,01_17_35,01_17_47}/**`
하위의 "과거 AI 코드 리뷰 세션 산출물"(신규 추가 파일뿐, 수정/삭제 없음)이며 애플리케이션·하네스
실행 코드(`.py`)는 한 줄도 포함돼 있지 않다. `git log`/`git show --stat`으로 직접 대조한 결과,
실제 하네스 소스(`_shared/block_integrity.py`, `_shared/retry_state.py`, 세 orchestrator, 두
hook, 테스트)는 이 브랜치의 이전 커밋(`30cc0f738`→`7dd4ad8c7`, 1R~5R 리뷰 반영)에서 이미 커밋됐고,
이번 44개 파일 역시 전부 그 `7dd4ad8c7`(5R 리뷰 반영) 한 커밋에 함께 실려 있다(`01_17_35/SUMMARY.md`
1건만 후속 `8b3be3ce6`에서 별도 복구). 즉 "이번 diff가 새 코드를 리뷰 대상으로 주는가"가 아니라
"이 4개 리뷰 라운드 산출물을 코드 fix 커밋에 실은 것이 스코프상 타당한가"가 실질 질문이다.
`review/**`가 gitignore 대상이 아니라 영구 감사 이력이라는 점(커밋 메시지 자체가 이를 명시)은
확인했고, 이 전제 위에서 각 라운드 디렉터리의 완결성을 개별 확인했다.

## 발견사항

- **[WARNING]** 커밋에 함께 실린 4개 리뷰 라운드 중 2개는 완주되지 못한 스캐폴딩인데, 완주된
  2개(`00_33_34`, `01_17_35`+`RESOLUTION.md`)와 구분 없이 같은 커밋에 영구 기록됨
  - 위치: `review/code/2026/08/01/01_17_47/meta.json:3-84`(`files` 배열이 `01_17_35/_prompts/*.md`
    12건 + `01_17_35/_retry_state.json`·`meta.json` 뿐 — 실제 리뷰어 산출물은 하나도 없음),
    `:101`(`"route_mode": "auto"`); `review/code/2026/08/01/01_17_47/_retry_state.json:8`
    (`"routing_status": "pending"`), `:105-122`(`agents_pending` 14개 전원, `agents_success: []`,
    `agents_fatal: []`) — 이 파일은 프롬프트에서 diff 가 생략돼 원본을 직접 `Read`로 대조함.
    추가로 `review/code/2026/08/01/00_03_38/_retry_state.json:8-9`(`"routing_status": "skipped"`,
    `"routing_skip_reason": "--route=all"` — 라우팅은 됐음), `:129-146`(`agents_pending` 14개
    전원 그대로, `agents_success: []`, `agents_fatal: []` — 실행 후 한 번도 reconcile 되지 않은
    최초 스냅샷). 이번 diff 안의 `00_03_38/` 관련 파일은 `api_contract.md`/`concurrency.md`/
    `database.md`/`dependency.md`/`maintainability.md`/`user_guide_sync.md` 6건뿐이고, 같은
    라운드가 대상으로 선정했던 나머지 8개(`security`/`performance`/`architecture`/`requirement`/
    `scope`/`side_effect`/`testing`/`documentation`)의 리포트 파일은 diff 에도 디스크에도 없다.
  - 상세: `01_17_47/`은 라우터·14개 리뷰어·요약(summary) 중 무엇 하나 실행되지 않은 채
    `meta.json`+`_retry_state.json` 두 파일만 남기고 버려진 세션이다. 자신의 `files` 목록이
    `01_17_35/_prompts/*`(직전 라운드가 아직 프롬프트를 만들던 시점의 산출물)를 가리키는 것으로
    보아, `01_17_35` 라운드가 한창 진행 중이던 순간에 잘못 기동됐다가 그대로 방치된 것으로 보인다.
    `00_03_38/`은 이보다 한 단계 더 진행됐다 — 라우터는 통과했고(`--route=all`로 14명 전원 대상
    확정) 14개 프롬프트도 만들어졌지만, 그중 8명(강제 포함 `security` 포함)이 "no_status"로 끝나
    한 번도 `--update`로 보고되지 않았다. 이 diff 밖이지만 같은 커밋(`7dd4ad8c7`)에 실린
    `review/code/2026/08/01/00_03_38/SUMMARY.md`가 스스로 "8/14 reviewer 가 결과를 전혀 내지
    못했다... forced whitelist 포함... security 리뷰가 전혀 수행되지 않은 상태에서 이를 '안전'으로
    확정하는 것은 거짓 음성이다"라며 전체 위험도를 MEDIUM으로, 재실행(특히 security)을 최우선
    조치로 명시한다. 그런데 커밋된 `_retry_state.json`은 그 결론이 나온 뒤에도 reconcile 되지 않은
    실행-전 초기 스냅샷(14개 전부 pending) 그대로 남아 있고, 이 diff 의 어떤 파일에도 "`00_03_38`은
    `00_33_34`로 대체된 미완주 라운드", "`01_17_47`은 초기화 중 무산된 세션"이라는 pointer가 없다.
    감사 이력만 열람하는 사람은 `00_03_38/SUMMARY.md`의 "MEDIUM, security 미검토" 판정을 최신
    상태로 오인할 수 있다. 다만 기능적 영향은 낮다 — 다른 리뷰어들이 이미 확인했듯 push/turn-end
    게이트는 "가장 최근에 resolve된(= SUMMARY.md가 존재하는) 세션"을 채택하므로, 더 나중
    타임스탬프의 `00_33_34`/`01_17_35`가 실제로는 우선한다.
  - 제안: 다음 정리 시점에 (1) `01_17_47/`처럼 라우터조차 못 돈 완전 무산 세션은 커밋 전에 삭제,
    (2) `00_03_38/`처럼 부분 실패했지만 SUMMARY까지 남은 세션은 남기더라도 RESOLUTION.md나 커밋
    메시지에 "→ `00_33_34`로 재실행·대체됨" 한 줄을 남겨 대체 관계를 명시할 것. 재발 방지책으로는
    세션 완료 여부(`SUMMARY.md` 존재)를 기준으로 미완주 세션 디렉터리를 커밋 전 자동 정리/경고하는
    스크립트를 고려.

- **[INFO]** 이번 44개 파일 자체는 애플리케이션/하네스 실행 코드가 아니라 리뷰 산출물(Markdown
  리포트 + JSON 상태 스냅샷)뿐 — 프로젝트 컨벤션과 일치하여 그 자체는 스코프 위반 아님
  - 위치: 44개 파일 전체(`review/code/2026/08/01/01_49_32/meta.json`의 `files[]`와 대조 확인).
  - 상세: CLAUDE.md는 "코드 리뷰 산출물"의 정본 저장 위치를 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`로
    명시하고, 이 저장소는 `review/**`를 gitignore 하지 않아 각 리뷰 라운드가 생성하는 파일이 영구
    감사 이력으로 git에 남는다(이번 브랜치의 선행 커밋들도 동일 패턴을 반복해서 확립). 신규
    CLI 플래그·설정 변경·코드 로직 변경은 이 44개 파일 어디에도 없다. 이 결론은 이번 라운드의
    security/maintainability 리뷰어도 각자 독립적으로 도달했다.
  - 제안: 없음(정상).

- **[INFO]** 앞선 스코프 라운드(`00_33_34/scope.md`, `01_17_35/scope.md`)가 지적한 "정규식 기반
  함수 추출이 `merge_coordinator_orchestrator.py`의 'Git / gh helpers' 구분 주석을 삼켰다"는 결함이
  현재 소스에서 복원돼 있음을 재확인 — 동일 사고 클래스의 잔여 누락 없음
  - 위치(현재 소스, 이번 diff 밖 — 대조용): `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:121-122`
    (`_apply_status_update` 정의) 직후 `:125-127`에 `# Git / gh helpers` 구분 주석이 복원돼 있고
    바로 이어 `:130`에 `_git` 정의가 온다.
  - 상세: `00_33_34/scope.md`(이번 diff 파일 21)와 `01_17_35/scope.md`(이번 diff 파일 38)는 "3R
    사고 복구" 커밋이 `code_review_orchestrator.py`/`consistency_orchestrator.py`의 유실 주석은
    복원했지만 같은 정규식 추출을 거친 `merge_coordinator_orchestrator.py`의 "Git / gh helpers"
    구분 주석은 빠뜨렸다고 WARNING으로 기록했다. 저장소 현재 상태를 직접 `Read`/`grep`한 결과 그
    구분 주석은 이미 복원돼 있어, 이 diff가 다루는 4개 라운드에 걸쳐 지적된 그 결함이 이후 실제
    코드에 반영됐음을 확인했다(이번 diff 자체가 그 수정을 담고 있지는 않음 — 순수 확인).
  - 제안: 없음(확인 완료).

## 점검한 다른 항목 (문제 없음)

- **무관한 파일/영역 수정**: 44개 파일 전부 `review/code/2026/08/01/**` 뿐이며 `codebase/`·`spec/`·
  `.claude/`(실행 코드)·`.github/` 변경은 이번 diff에 전혀 없음.
- **기능 확장(over-engineering)**: 없음 — 새 파일들은 전부 이미 실행된 리뷰 라운드의 결과 텍스트일
  뿐, 신규 기능·CLI 옵션·설정을 도입하지 않음.
- **포맷팅/공백 변경**: 해당 없음(전부 신규 추가 파일, 기존 파일 수정 없음).
- **주석 변경**: 해당 없음(코드 파일 자체가 diff에 없음).
- **임포트 변경**: 해당 없음.
- **설정 변경**: 없음.

## 요약

이번 44개 파일 diff는 실제 코드가 아니라 `review/code/2026/08/01/{00_03_38,00_33_34,01_17_35,01_17_47}/**`
아래 4개 과거 AI 코드 리뷰 라운드의 산출물이며, 이들이 소스 fix와 함께 한 커밋(`7dd4ad8c7`)에
실린 것 자체는 "review/** 는 영구 감사 이력"이라는 이 프로젝트의 기존 컨벤션과 일치해 스코프
위반이 아니다. 다만 그 4개 라운드 중 `01_17_47`(라우터도 못 돈 완전 무산 세션)과 `00_03_38`(8/14
리뷰어가 no_status로 끝나 자신의 SUMMARY가 스스로 MEDIUM·재실행 필요를 선언한 미완주 라운드)은
완주된 `00_33_34`/`01_17_35`와 구분 없이 같은 커밋에 실렸고, 어떤 파일에도 "이 라운드는 대체됐다"는
pointer가 없다 — 감사 이력을 나중에 훑는 사람이 이미 대체된 부분 실패 판정을 최신으로 오인할 수
있는 hygiene 문제로 WARNING 처리했다(기능적 영향은 낮음 — 게이트는 가장 최근 resolve된 세션을
채택하므로 실제 판정에는 영향이 없음). 그 외에는 이번 diff 안팎 어디에서도 무관한 파일 수정·설정
변경·불필요한 기능 확장·근거 없는 포맷팅/주석/임포트 변경이 없었고, 이 diff가 담고 있는 앞선 스코프
라운드들의 WARNING(merge_coordinator_orchestrator.py의 구분 주석 유실)도 현재 소스에서 이미 해소돼
있음을 재확인했다.

## 위험도

LOW
