# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 핵심 결함(병렬 worktree 세션의 `npm install` 경쟁 + 부분 설치의 영구적 오판)은 완료
마커 + `mkdir` 락으로 견고하게 수정되고 9건의 신규 테스트로 비-vacuity 까지 실증됐으나(구코드
6/9 실패 → 신코드 9/9 통과), (1) stale-lock 탈취 판정이 "생존 여부"가 아니라 "경과 시간"만
검사해 이 PR 이 없애려던 바로 그 증상(동일 트리에 두 `npm install` 동시 실행)이 좁은 창(설치가
10분을 초과하는 경우)에서 재발 가능함이 **실제 재현 실험으로 확인**됐고, (2) 그 결함의 실제
소비처 2곳(`pre-commit`, `PostToolUse` 훅)에는 마커 기반 판정이 전파되지 않아 완결성 갭이
남는다. 둘 다 로컬 개발자 하네스에 한정되고 자가치유되어 blast radius 는 제한적이라
CRITICAL 로는 판단하지 않았다.

> **참고 (라우터/상태 관련 투명성 메모)**: `concurrency` 리뷰어는 STATUS 파싱이 `no_status` 로
> 기록됐다(router_safety 강제 화이트리스트 대상은 아님 — forced 7명은 전원 결과 확보됨, 아래
> 라우터 결정 참고). 다만 해당 리뷰어의 완전한 보고서는 세션 디렉터리(`concurrency.md`)에 이미
> 존재해 디스크에서 정상 회수했고, 아래 **경고 #1**(가장 중요한 발견 — stale-lock 탈취의 실제
> 재현)의 근거가 바로 이 보고서다. 즉 "no_status" 표기가 발견사항 누락이나 화이트리스트
> 미이행을 의미하지 않으며, 이 요약에 완전히 반영되어 있다.

## Critical 발견사항

해당 없음 — 데이터 손실·보안 침해·프로덕션 영향으로 이어지는 CRITICAL 등급 발견사항은 없음.
(아래 경고 #1 은 이 PR 이 고치려는 핵심 결함의 재발 가능성을 실제로 재현했지만, 로컬 개발자
하네스 전용 경로에 국한되고 다음 세션에서 자가치유되므로 WARNING 으로 분류했다.)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/신뢰성 | stale-lock 탈취 판정이 락 디렉터리의 **mtime(경과 시간)만** 검사하고 하트비트/생존 확인이 없음 + 락 해제(`rmdir`)도 소유권 검증 없이 무조건 수행됨. **실제 재현으로 실증**: 5초 sleep 하는 "느리지만 살아있는" npm stub 으로 프로세스 A 가 락을 획득한 직후 락 mtime 을 11분 전으로 조작 → 프로세스 B 시작 → A(PID 21988)·B(PID 22004) 의 `npm install` 이 5초간 완전히 겹쳐 **동시 실행**됨을 확인(둘 다 같은 `node_modules` 에 기록). 스크립트 주석("두 세션은 결코 동시에 설치하지 않는다")은 실제 보장 범위(홀더가 죽었을 때만)보다 강하게 서술됨. 락 해제가 소유권 무관이라 탈취 후 연쇄(cascade) 가능성도 이론상 존재 | `bootstrap-session.sh:58-72`(60-63 탈취판정+`mkdir`, 70 무조건 `rmdir`) | 락 디렉터리에 소유자 PID 기록(`echo $$ > "$lock/owner"`) → 탈취 전 `kill -0`으로 생존 확인, 해제 시 소유자 일치할 때만 삭제. 최소한 스크립트 주석·plan 문서에 "느리지만 생존 중인 설치" 케이스를 알려진 잔여 한계로 명시 |
| 2 | 기능 완전성 | 이 PR 이 고치는 "부분 node_modules 를 디렉토리 존재 체크가 영구히 '설치됨'으로 오판" 결함의 **실제 소비처 2곳**이 그대로 남아 있음 — `pre-commit` 훅과 `PostToolUse` 훅 모두 완료 마커가 아닌 옛 bare 디렉토리 체크를 그대로 사용. 결과: 마커 도입 후 문서화된 "1회성 재설치" 창(또는 크래시 후 자가치유 전까지) 동안 다른 worktree 세션이 커밋/편집을 시도하면 두 훅 모두 "설치됨"으로 오판해 불완전한 `node_modules` 로 린트를 구동 → `pre-commit` 은 실제로 없는 "malformed mermaid block" 으로 커밋을 오차단하고, `PostToolUse` 훅은 Claude 에게 존재하지 않는 구문 오류를 고치라고 요구할 수 있음. plan 체크리스트는 이 항목을 "완료"로 표시하나 실제 완결 범위는 "영구 무력화 → 좁은 창의 오판"으로 축소됐을 뿐 | `.githooks/pre-commit:50`, `.claude/hooks/lint_mermaid_posttooluse.py:101` (이번 diff 밖, 기존 상태 그대로) | 두 소비처도 `node_modules/.bootstrap-install-complete` 마커 확인으로 통일하거나 3곳이 공유하는 판정 헬퍼로 통합. 최소한 이 잔여 갭을 plan 문서에 알려진 한계로 명시(현재는 "완료"로만 기록돼 있음) |
| 3 | 가용성 | `npm install` 이 지속적으로 실패하는 환경(네트워크 차단·인증 만료 등)에서 완료 마커가 절대 쓰이지 않으므로 **매 SessionStart 마다 backoff/throttle 없이 무제한 블로킹 재시도**됨. 같은 파일의 reaper 섹션은 동일 클래스 문제를 이미 `REAP_MIN_INTERVAL`(기본 6h) 스로틀로 해결했는데 install 재시도 경로엔 그 패턴이 적용되지 않음 | `bootstrap-session.sh:56-72` | 실패 시각을 별도 파일에 기록하고 reaper 와 동일한 쿨다운 패턴(예: 10~30분) 적용, 또는 연속 실패 횟수 기반 지수 backoff |
| 4 | 프로세스/문서 | `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일 `test_bootstrap_mermaid_install.py` 행이 없음 — 직전 자매 PR(#970)이 명시적으로 지킨 "신규 harness 테스트 파일마다 README 행 추가" 절차가 이번엔 누락 (다만 이 표 자체가 CI 로 강제되지 않고 기존에도 6개 파일이 이미 누락 상태라는 완화 요인 있음) | `.claude/tests/README.md` | `test_reap_merged_worktrees.py` 행과 같은 형식으로 1행 추가(가드 대상: 완료 마커·`mkdir` 락·경쟁/부분설치/실패/stale-lock 시나리오) |
| 5 | 테스트 견고성 | `test_concurrent_sessions_install_at_most_once` 가 5개 `Popen` 의 stdout/stderr `PIPE` 를 읽지도 닫지도 않음 — 실행 시 실제 `ResourceWarning: unclosed file` 다수 확인(단독 실행·하네스 전체 291건 실행 모두 재현). 자식 프로세스 합산 출력이 OS 파이프 버퍼를 넘으면 자식이 쓰기 블로킹되고 부모는 읽지 않아 **영구 hang** 가능한 전형적 anti-pattern(현재는 출력이 작아 미발현) | `test_bootstrap_mermaid_install.py:164-168` | `stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL` 로 변경하거나 `p.communicate()` 사용 |
| 6 | 테스트 코드 중복 | `_run()`(81-90행)과 `test_concurrent_sessions_install_at_most_once`(156-172행) 사이에 env 구성 로직(`PATH`/`NPM_CALL_LOG`/`NPM_STUB_FAIL`/`REAP_MIN_INTERVAL`/`REAP_GH_BIN` 5개) 이 그대로 복제됨 — `_run()` 옆의 rationale 주석("No gh stub → reaper cannot prove a merge")도 복제본엔 없어, 향후 새 env 게이트 추가 시 동시성 테스트 쪽만 갱신 누락될 위험 | `test_bootstrap_mermaid_install.py:81-90` vs `156-172` | `_env(fail=False)` 헬퍼로 env dict 구성만 분리해 양쪽이 재사용 |
| 7 | 이론적 TOCTOU (미재현) | 마커 체크가 락 획득 **이전**에 한 번만 일어나고 락 획득 후 재확인이 없음 — 이론상 "패자가 승자의 완료를 못 본 채 락을 얻어 재설치"하는 잔여 창. 30라운드×20동시프로세스(600회) 스트레스로 재현 시도했으나 **한 번도 재현 안 됨**(패자 구간이 승자의 임계구역보다 훨씬 짧아서로 추정). 재현되더라도 최악 영향은 "중복 재설치 1회"뿐, 이 PR 이 표적으로 삼은 결함(무신호 영구 무력화)과는 무관 | `bootstrap-session.sh:58-71` | `mkdir "$lock"` 성공 직후 `[ ! -f "$marker" ]` 재확인 추가(한 줄) — 확률적 관측을 구조적 불변식으로 전환 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 견고성 | `mkdir` 락 경로에 비-디렉토리 이름 충돌이 있으면 stale 회수·재획득 모두 조용히 실패 → 마커 생길 때까지 매 세션 설치 영구 skip(가용성 저하만, 코드실행/권한상승 없음. 사전 조건 자체가 이미 저장소 쓰기 권한을 요구) | `bootstrap-session.sh:58-72` | 조치 불요(fail-open 설계 의도와 부합). 필요 시 실패 원인 구분 로그 |
| 2 | 테스트 견고성 | 신규 테스트의 `subprocess.run`/`Popen` 호출에 `timeout=` 미지정 — 향후 회귀로 실제 블로킹이 생기면 CI 전체가 무한 대기할 위험 | `test_bootstrap_mermaid_install.py` `_run()`, 동시성 테스트 | `timeout=30` 류 상한 지정 |
| 3 | 의도된 비용 | 마커 도입 이전 기존 정상 설치가 배포 후 첫 SessionStart 에서 1회성으로 재설치됨(네트워크 I/O 1회) — 코드 주석에 명시된 의도된 트레이드오프, main checkout 당 1회로 self-limiting | `bootstrap-session.sh:45-46` | 현행 유지 가능. 필요시 `--prefer-offline` 고려 |
| 4 | 문서 정확성 | `.gitignore`/스크립트 주석의 "크래시로 남으면 10분 뒤 다음 세션이 회수" 서술이 "마커 기록 후~락 해제 전 크래시"라는 좁은 케이스엔 성립하지 않음(**재현으로 확인**: 이 상태를 인위 구성하면 락이 영구 잔존) — 다만 `.gitignore` 로 무시되는 빈 디렉터리만 남고 lint 자체는 정상 동작해 harmless라는 결론 자체는 맞음 | `.gitignore` 주석, `bootstrap-session.sh:58` | 문구를 "설치 완료 전 크래시 시" 로 한정하는 정도로 정밀화(낮은 우선순위) |
| 5 | 설계 판단 | 락/마커("install-once with lease") 로직이 재사용 불가능한 인라인 구현 — 다만 `.claude/tools/` 자체에 공유 bash lib 관례가 없고 소비처도 하나뿐이라(Rule of Three 미충족) 지금 추출은 과설계 | `bootstrap-session.sh:33-72` | 조치 불요. 두 번째 소비자가 생기는 시점에 별도 스크립트로 추출 검토 |
| 6 | 테스트 위생 | 신규 테스트의 `REAP_MIN_INTERVAL=0`/`REAP_GH_BIN=<더미>` 는 이 fixture 에 `reap-merged-worktrees.sh` 자체가 복사되지 않아 실질적으로 죽은 설정(no-op) — 옆 주석("No gh stub → reaper cannot prove a merge")이 서술하는 인과("gh 스텁 부재")도 실제 인과("reaper 파일 자체 부재로 섹션 전체 스킵")와 다름. 기능적으로 무해 | `test_bootstrap_mermaid_install.py:113-122`(`_run`), `188-195`(동시성 테스트) | 불필요하면 두 env var·주석 제거, 유지 시 주석을 실제 인과로 정정 |
| 7 | SoT 분산 | stale-lock 10분 임계값이 코드 리터럴(`-mmin -10`)·스크립트 주석·테스트의 파생 리터럴(`3600`) 3곳에 독립 서술됨 — 테스트 여유폭이 임계값의 6배라 실질 위험은 낮음 | `bootstrap-session.sh:60`, 주석 51-52행, `test_bootstrap_mermaid_install.py:141` | (선택) 스크립트에 `stale_after_min=10` 변수 선언 후 참조 |
| 8 | 문서 drift (diff 밖) | `bootstrap-session.sh` 헤더 주석이 "Three responsibilities"라 서술하나 실제로는 4개 섹션(githooks·mermaid-lint·상태마커GC·reap) 존재 — 이전 PR(#970, reap 섹션 추가)에서 이미 발생한 pre-existing drift, 이번 diff 스코프 밖 | `bootstrap-session.sh` 헤더(2-13행) | 저비용이니 "Four responsibilities"로 정정 검토(차단 사유 아님) |
| 9 | 문서 rot 패턴 | plan 문서의 "9건" 테스트 개수 하드코딩 서술 — 실측 결과 현재는 정확하나, 이 저장소가 최근 겪은 "개수 하드코딩이 후속 커밋마다 stale 해지는" 패턴과 동일 계열(해당 항목은 이미 체크리스트 완료로 낮은 위험) | `plan/in-progress/harness-guard-followups.md` "## A." | 향후 재작업 시 개수 비의존 표현 고려 |
| 10 | 테스트 커버리지 | npm 스텁이 호출 인자(`$@`)를 검증하지 않아 `npm install --no-fund --no-audit --silent` 의 플래그 누락/변경을 감지 못함 — 설치 성공/실패를 좌우하지 않는 부가 옵션이라 실질 위험 낮음 | `test_bootstrap_mermaid_install.py:31-36`(`_NPM_STUB`) | 필요시 `_NPM_CALL_LOG` 에 `"$*"` 기록 후 인자 존재 assert |
| 11 | 테스트 커버리지 | 10분 락 탈취 임계값의 경계값(9분59초 vs 10분01초) 테스트 없음 — 매우 신선/매우 오래됨 두 극단만 커버 | `test_bootstrap_mermaid_install.py:130-145` | 우선순위 낮음(self-healing 휴리스틱이라 분 단위 정밀도 중요치 않음) |
| 12 | 범위 밖 참고 | `mermaid-lint/package.json` 의 미고정 버전(`jsdom`/`mermaid` `"*"`) + 기존 `--no-audit` 조합 — `package-lock.json`(lockfileVersion 3) 존재로 즉시 임의 버전이 당겨지진 않으나, 이번 PR 로 install 경로가 더 자주 실행되게 된 만큼 버전 고정 검토 가치 있음 | `mermaid-lint/package.json`(diff 밖), `bootstrap-session.sh:65` | 버전 고정 또는 주기적 `npm audit` 검토(이번 PR 차단 사유 아님) |
| 13 | 견고성 | 마커 쓰기 자체가 실패(fs 권한 등)하면 매 세션 무통지 재설치가 재시도될 수 있음 — stderr 경고 없음, 극단적 환경에서만 발현 | `bootstrap-session.sh:66` | 마커 쓰기 실패 시 짧은 stderr 경고 추가(우선순위 낮음) |
| 14 | 범위 밖, 추적 중 | `reap-merged-worktrees.sh` 의 `gh pr view` 순차 N+1 — 이번 diff 미변경 파일이며 plan 항목 B 로 이미 명시적으로 추적됨 | `reap-merged-worktrees.sh` (diff 밖) | 이번 PR 조치 불요, 중복 결함으로 재카운트 말 것 |
| 15 | 프로세스 | 신규 plan 문서가 이번 PR 이 구현하지 않는 후속 항목 B~E(4건) + won't-do 1건을 함께 등록 — 실구현은 A 하나뿐이고 나머지는 체크박스 미착수 상태로 명확히 구분됨, "리뷰 산출물 증발 방지" 관례에 부합 | `plan/in-progress/harness-guard-followups.md` | 조치 불요 |
| 16 | 검증 완료 (문제 없음) | 콜드스타트 동시성(주 실패 모드)은 `mkdir` 원자성만으로 올바르게 직렬화됨 — 신·구 코드 대조 실행으로 검증(구코드 5-세션 테스트 `5 not less than or equal to 1` 로 실패 → 신코드 9/9 통과) | `bootstrap-session.sh:63`, `test_bootstrap_mermaid_install.py` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | mkdir 락 이름충돌 시 영구 skip 가능성(가용성), 하드코딩 시크릿·인젝션·인가우회 등은 해당 없음 |
| performance | MEDIUM | npm install 지속 실패 시 매 세션 무제한 블로킹 재시도(스로틀 부재), stale-lock 임계값 mtime-only |
| architecture | LOW | 락/마커 로직 인라인(과설계 방지 목적 조치불요), 테스트 dead config + 잘못된 인과 주석 |
| requirement | MEDIUM | 결함의 실제 소비처 2곳(pre-commit, PostToolUse)이 여전히 bare dir 체크 — 완결성 갭. README 커버리지 표 미등재 |
| scope | NONE | 4개 변경 파일 모두 plan 항목 A 의도에 정확히 대응, 범위 이탈·무관한 리팩토링 없음 |
| side_effect | MEDIUM | 마커 도입이 소비처 2곳(pre-commit/PostToolUse)에 전파 안 됨(requirement 와 동일 발견, 상세 재확인) |
| maintainability | LOW | 동시성 테스트 env 구성 코드 중복(rationale 주석 유실 포함), 10분 임계값 3곳 분산 |
| testing | LOW | Popen pipe 미해제(ResourceWarning 실측), README 미등재, 이론적 TOCTOU(재현 안 됨) |
| documentation | LOW | 헤더 "Three responsibilities" drift, README 미등재, 근거 인용 정확성 전수 검증(날조 없음 확인) |
| concurrency (no_status, 전문 회수됨) | MEDIUM | stale-lock 탈취가 생존여부 아닌 경과시간만 검사 — **실제 재현**으로 동시 npm install 실증(경고 #1 근거) |

## 발견 없는 에이전트

없음 — 실행된 10개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고했다(scope 포함, "범위
적합" 확인성 INFO 3건).

## 권장 조치사항

1. stale-lock 탈취 판정을 PID 생존 확인(`kill -0`) 또는 하트비트 방식으로 강화하고, 락 해제 시
   소유권 토큰을 검증하도록 보강 — **실제 재현으로 확인된** 유일한 잔여 결함이자 이 PR 이
   해결하려는 핵심 증상의 재발 경로이므로 최우선(경고 #1).
2. `.githooks/pre-commit`, `.claude/hooks/lint_mermaid_posttooluse.py` 두 소비처도 완료 마커
   기준으로 통일 — 이 PR 의 "결함 수정 완료" 주장을 실제 소비자 관점에서 완결시킴(경고 #2).
3. `.claude/tests/README.md` "What's covered" 표에 `test_bootstrap_mermaid_install.py` 행 추가
   (경고 #4).
4. `test_concurrent_sessions_install_at_most_once` 의 `Popen` 을 `DEVNULL` 또는 `communicate()`
   로 교체해 파이프 미해제 잠재 데드락 제거(경고 #5).
5. `npm install` 지속 실패 시 재시도 스로틀(reaper 의 `REAP_MIN_INTERVAL` 패턴 재사용) 도입 검토
   (경고 #3).
6. `_run()`과 동시성 테스트의 env 구성 코드를 헬퍼로 추출해 중복 제거(경고 #6).
7. (낮은 우선순위) 락 획득 직후 마커 재확인을 추가해 이론적 TOCTOU 를 구조적으로 폐쇄(경고 #7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (10명 — `concurrency` 는 STATUS 파싱이 `no_status` 였으나 전문이 디스크에 존재해 정상 회수·반영함)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 사례 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 diff 에 패키지 버전 변경이 없음(코드 4개 파일 = 셸 스크립트·Python 테스트·`.gitignore`·plan 문서). 명시적 router 사유 텍스트는 manifest 에 포함되지 않아 diff 성격으로부터의 추정 |
  | database | DB 스키마/쿼리 관련 코드 변경 없음(추정, 상동) |
  | api_contract | API/DTO/계약 변경 없음, 순수 로컬 harness 도구 변경(추정, 상동) |
  | user_guide_sync | 제품 사용자 문서(스펙·유저 가이드) 변경 없음, `.claude/` 내부 하네스 전용 변경(추정, 상동) |

> 위 4건의 "이유" 는 router 가 반환한 구체적 사유 문자열이 이번 manifest 에 포함되지 않아, diff
> 대상 파일의 성격(순수 `.claude/` 하네스 인프라, `codebase/`·`spec/` 무변경)으로부터 합리적으로
> 추정한 것이다. 실제 router 산출 사유 원문은 `_routing_decision.json`(workflow 모드에서는 본
> 에이전트에 전달되지 않음)에 있을 수 있다.