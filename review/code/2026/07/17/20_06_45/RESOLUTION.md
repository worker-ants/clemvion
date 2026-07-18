# RESOLUTION — review/code/2026/07/17/20_06_45

리뷰 결과: **MEDIUM** (Critical 0, Warning 7, INFO 다수). 사용자 결정으로 핵심 3건(#1·#2·#3)을
모두 이 PR 에서 처리했다. 나머지 Warning/INFO 는 근거와 함께 분류.

## 처리한 Warning

| # | 카테고리 | 조치 | 근거 |
|---|---|---|---|
| **#1** | 동시성/신뢰성 | **stale-lock 탈취를 "경과 시간"→"소유 PID 생존(`kill -0`)"으로 교체.** 락에 owner PID 기록, grace age 경과 **AND** 소유자 사망일 때만 탈취. 해제도 소유권 일치 시에만. | 리뷰어가 실측 재현: 초판은 10분 넘는 *살아있는* 설치의 락을 탈취해 두 npm install 동시 실행 — 이 PR 이 없애려던 증상 재도입. |
| **#2** | 기능 완전성 | **`_lib/mermaid_lint_ready.py` 공유 SoT 신설.** `pre-commit`(bash CLI 호출)·`PostToolUse`(python import)가 마커 기반 판정으로 통일. bootstrap(writer)은 마커명 하드코딩 + `test_mermaid_lint_ready.py` 의 drift 테스트로 결속. | 두 소비처가 여전히 bare `[ -d node_modules ]` 라, 부분 트리를 "설치됨"으로 오판해 없는 mermaid 오류로 커밋 오차단 가능. |
| **#3** | 가용성 | **실패 throttle 추가.** 실패 시 `mermaid_install_last_fail` stamp, `MERMAID_INSTALL_RETRY_SEC`(기본 30분) 내 재시도 skip. reaper 의 `REAP_MIN_INTERVAL` 패턴과 동일. | 지속 실패(네트워크 down) 시 매 SessionStart backoff 없이 무한 재시도. |
| #4 | 문서 | `.claude/tests/README.md` 에 신규 2파일 행 추가. | #970 이 지킨 절차 누락 정정. |
| #5 | 테스트 견고성 | 동시성 테스트 `Popen` 을 `PIPE`→`DEVNULL` 로. | 미배수 PIPE 버퍼 포화 시 자식 deadlock 가능. |
| #6 | 테스트 중복 | env 구성을 `_env()` 헬퍼로 추출. | 동시성 테스트만 갱신 누락 위험 제거. |
| #7 | 이론적 TOCTOU | **미조치(문서화).** 마커 재확인을 락 획득 후 추가하는 1줄 제안이나, 리뷰어가 600회 스트레스로도 재현 못 했고 최악 영향이 "중복 재설치 1회"뿐이라 이 PR 의 표적(무신호 영구 무력화)과 무관. liveness 락으로 실질 창은 이미 축소됨. | 확률적 관측, 안전 방향. |

## 처리한 INFO (저비용)

- **#2** 신규 테스트에 `timeout=` 지정 (무한 대기 방지).
- **#4** `.gitignore` 락 주석을 liveness/grace 서술로 정밀화.
- **#8** bootstrap 헤더 "Three responsibilities"→"Four"(#970 reap 섹션 반영, pre-existing drift).
- **#9** plan 의 테스트 "9건" 하드코딩을 개수 비의존 표현으로 교체.

## 미조치 (근거)

- **INFO #1/#5/#7/#10/#11/#13** — 리뷰어 자신이 "조치 불요"/"Rule of Three 미충족"/"우선순위 낮음"
  표기. self-healing 휴리스틱의 분 단위 정밀도·과설계 회피 판단에 동의.
- **INFO #12** (`mermaid-lint/package.json` 미고정 버전) — diff 밖, `package-lock.json`(v3) 존재로
  즉시 위험 없음. 별건으로 남김.
- **비-vacuity 특이사항**: `test_live_but_slow_lock` 은 초판(bbf72268e) 대조만으로는 **vacuous 하게
  통과**한다(초판 `rmdir` 이 owner-파일 든 락을 못 지워 우연히 skip). 그래서 **liveness 검사만
  제거한 타깃 뮤턴트**로 재검증 — 그때 실패함을 확인해 진짜 non-vacuous 임을 실증했다.

## 검증

- harness 스위트 304건 통과 (초판 291 + 신규/보강).
- `plan-frontmatter.test.ts` 93건 통과 (plan 파일 변경).
- e2e 면제 — 변경 set 전체가 `.claude/**`·`.githooks/**`·`plan/**` (PROJECT.md e2e 면제 범위).
