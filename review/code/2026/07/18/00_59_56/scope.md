# 변경 범위(Scope) 코드 리뷰

## 컨텍스트 확인 방법

Payload 에는 "요청된 작업" 텍스트가 별도로 주어지지 않아, 대상 저장소의 커밋 이력으로
의도된 범위를 재구성했다. 리뷰 대상 6개 파일은 커밋 `d31f99a11`(직전 라운드
`review/code/2026/07/17/20_06_45` 자기 리뷰의 WARNING #1·#2·#3 및 부수 항목을 반영한
follow-up)과 정확히 일치한다. 그 커밋 메시지가 명시한 의도:

- WARNING #1: stale-lock 탈취 판정을 "경과 시간"→"소유 PID 생존(`kill -0`)"으로 교체
- WARNING #2: `pre-commit`/`PostToolUse` 두 소비처를 마커 기반 공유 판정(`_lib/mermaid_lint_ready.py`)으로 통일
- WARNING #3: 설치 실패 시 재시도 throttle(cooldown) 추가
- 부수(디스클로즈됨): 동시성 테스트 PIPE→DEVNULL(#5), 테스트 env 구성 `_env()` 추출(#6),
  테스트 `timeout=` 추가(INFO#2), bootstrap 헤더 "Three"→"Four"(INFO#8), `.gitignore` 락 주석
  정밀화(INFO#4, 리뷰 대상 파일 목록 밖)

이 재구성된 의도를 기준으로 `git show d31f99a11 -- <각 파일>` 실제 diff(전체 파일 컨텍스트가
아닌 변경분)를 직접 대조했고, `--ignore-all-space` 로 공백만 다른 diff 가 섞여 있는지도
확인했다.

## 발견사항

- **[INFO]** 경고 수정과 무관한 pre-existing 문서 drift 정정이 같은 커밋에 번들됨
  - 위치: `.claude/tools/bootstrap-session.sh:9,17` (헤더 주석 "Four responsibilities" +
    4번 항목 명시)
  - 상세: 이 줄은 이번 커밋이 고치는 WARNING #1/#2/#3(락 liveness·공유 SoT·throttle) 중
    어느 것과도 직접 관련이 없다. "Three responsibilities" 라는 잘못된 서술은 이전
    PR(#970, reaper 섹션 4번 추가)에서 생긴 drift이며, 직전 리뷰(20_06_45)가 이를
    "INFO #8, 이번 diff 스코프 밖" 이라고 명시적으로 분류했었다. 이번 커밋이 그 항목을
    가져와 함께 고쳤다. 순수 텍스트 정정이라 기능적 위험은 0이고, 커밋 메시지의 "부수"
    목록에 "bootstrap 헤더 'Three'→'Four'(#8)" 로 명시적으로 공개돼 있어 은폐된 범위
    확장은 아니다. 다만 스코프 리뷰 관점에서는 "이번 fix 의 대상이 아닌 무관한 위치의
    수정"이라는 사실 자체는 기록해 둘 가치가 있다.
  - 제안: 조치 불요(이미 디스클로즈됨, 위험 없음). 향후 유사 커밋에서 "이 diff 가 원래
    고치려던 항목"과 "부수로 정리한 pre-existing drift" 를 커밋 메시지에서 계속
    분리 서술하는 현재 관행을 유지할 것.

그 외에는 범위를 벗어나는 변경을 찾지 못했다. 구체적으로 확인한 항목:

- **의도 이상의 변경 없음**: 6개 파일의 실제 diff(`git show d31f99a11`)를 라인 단위로
  대조한 결과, 모든 변경 hunk 가 WARNING #1(`bootstrap-session.sh` 의 `_lock_is_dead`/owner
  PID 로직), WARNING #2(`mermaid_lint_ready.py` 신설 + `pre-commit`/`lint_mermaid_posttooluse.py`
  의 `is_ready()` 호출로 교체), WARNING #3(`_install_throttled`/`fail_marker` 로직) 중 하나로
  귀속된다. 커밋 메시지가 스스로 "부수" 로 명시한 항목(#4~#9) 외에 설명되지 않는 변경은
  없었다.
- **불필요한 리팩토링 없음**: `test_bootstrap_mermaid_install.py` 의 `_env()` 헬퍼 추출은
  직전 리뷰 WARNING #6("env 구성 로직이 `_run()`과 동시성 테스트에 복제됨")을 그대로
  반영한 것이고, 기존 로직을 변경하지 않은 순수 추출이다. `bootstrap-session.sh` 의 락
  탈취/해제 로직 전체 재작성도 새 liveness 요구사항(WARNING #1)의 직접적 결과이며, 옛
  `rmdir` 단일 경로를 완전히 대체해 죽은 코드가 남지 않았다.
  - `.claude/hooks/_lib/mermaid_lint_ready.py` 의 `marker_path()` 함수는 모듈 내부에서만
    호출되고 외부 호출자가 없으나(`grep` 확인), 이는 `is_ready()` 로직을 위해 자연스럽게
    분리된 헬퍼일 뿐 별도 API 확장으로 보기 어려워 findings 에서 제외했다.
- **기능 확장(over-engineering) 없음**: 새 환경변수 `MERMAID_INSTALL_LOCK_GRACE_SEC`,
  `MERMAID_INSTALL_RETRY_SEC` 는 WARNING #1/#3 이 요구하는 grace age·cooldown 윈도를
  테스트에서 주입 가능하게 하는 최소 표면이며(기존 `REAP_MIN_INTERVAL` 관례와 동일 패턴),
  일반화된 플러그인·설정 시스템 등 요청 범위를 넘는 추상화는 없다.
- **무관한 파일 수정 없음(리뷰 대상 6개 파일 기준)**: 같은 커밋이 건드린 `.gitignore`,
  `.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md` 는 이번
  scope 리뷰 대상 파일 목록에 포함되어 있지 않다(다른 라우팅으로 처리된 것으로 보임).
  참고로 대조해 본 결과 세 파일 모두 커밋 메시지가 명시한 항목(락 디렉터리 `.gitignore`
  주석, README 커버리지 표 2행 추가, plan 문서의 5개 후속 항목 등록)과 정확히 일치했고
  추가로 의심스러운 변경은 없었다.
- **포맷팅/실질 변경 혼입 없음**: `git diff --ignore-all-space` 결과가 일반 diff 와
  동일한 line 통계를 보여, 공백만 다른 노이즈 hunk 가 실질 로직 변경에 섞여 있지 않음을
  확인했다(6개 파일 전수 확인).
- **주석 변경**: 대부분의 주석 추가는 새 로직(owner-aware 락, liveness, throttle, 공유
  SoT)을 1:1로 설명하며 이 저장소의 기존 관례(변경 이유를 길게 서술하는 인라인 rationale)
  와 일치한다. 위 INFO 항목(헤더 "Four" 정정) 하나를 제외하면 불필요한 주석 변경은
  없었다.
- **임포트 변경**: `lint_mermaid_posttooluse.py` 에 추가된
  `sys.path.insert(...)` + `from mermaid_lint_ready import is_ready` 는 실제로 같은 함수
  호출부에서 사용되며 미사용 임포트가 아니다. 새 테스트 파일(`test_mermaid_lint_ready.py`)의
  임포트도 전부 실사용을 확인했다.
- **설정 변경**: `.claude/settings.json` 등 하네스 설정 파일에는 변경이 없다(6개 리뷰
  대상 파일 안에 설정 파일 없음).

## 요약

리뷰 대상 6개 파일은 직전 자기 리뷰 라운드(20_06_45)가 지적한 WARNING #1(락 liveness)·
#2(공유 readiness SoT)·#3(설치 실패 throttle)와, 커밋 메시지가 명시적으로 공개한 부수
정리 항목에만 정확히 대응한다. 라인 단위 diff 대조와 공백-무시 diff 대조 모두 범위를
벗어나는 숨은 변경을 찾지 못했으며, 유일하게 짚을 만한 지점은 이번 세 경고와 직접
관련 없는 `bootstrap-session.sh` 헤더의 "Three→Four responsibilities" 정정(직전 리뷰가
스코프 밖으로 분류했던 INFO 항목)을 이 커밋에서 함께 처리한 것인데, 이는 커밋 메시지에
스스로 디스클로즈돼 있고 순수 텍스트 정정이라 실질 위험이 없다. 전반적으로 이 변경은
"자기 리뷰 발견사항에 정확히 대응하는 follow-up 커밋"의 모범 사례에 가깝다.

## 위험도

NONE
