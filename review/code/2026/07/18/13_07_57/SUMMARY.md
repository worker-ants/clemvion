# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 이번 PR의 핵심 목적(mermaid-lint undici HIGH·dompurify moderate 취약점 해소 + 그 픽스가 이미 부트스트랩된 체크아웃/향후 Dependabot 보안범프에도 전파되도록 마커를 lockfile 해시에 결속)이 정확히 겨냥하는 "보안 픽스 전파" 시나리오의 실패/경계 경로 3건(재설치 실패 시 스테일 마커 방치, 구-포맷 마커 마이그레이션, 동시-재설치 경쟁)이 testing/architecture 리뷰어에 의해 무테스트로 확인되어 MEDIUM으로 판정. 코드 자체의 논리는 여러 리뷰어의 직접 실행·mutation testing으로 정확함이 재확인됐으나(신규 테스트 포함 11/11, 전체 하네스 305/305 통과), 회귀 방지막이 비어 있어 향후 리팩터 시 조용히 재발할 수 있는 리스크로 분류. 부가로 설계노트 문단 내 자기모순(WARNING #4)과, 리뷰 도중 공유 워크트리에서 실제로 관측된 검증-하네스 동시-쓰기 프로세스 리스크(WARNING #5, 코드 결함 아님)가 있음.

**forced(router_safety) 화이트리스트 이행 확인**: 이번 라운드는 router 자체가 스킵되어(`routing=skipped`) 14개 reviewer 전원이 실행됐으며, router_safety 상시 강제 대상 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 모두 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/아키텍처 (testing, architecture) | 구-포맷(빈 파일) 완료 마커 → lockfile-해시 바인딩 마이그레이션 경로가 회귀 테스트로 고정되지 않음. 이 PR이 머지되는 순간 이미 설치를 마친 **모든** 기존 체크아웃의 마커가 정확히 이 상태(빈 파일)이므로, 실사용자 100%가 거치는 1차 실전 경로다. 직접 재현하여 현재 동작(1회 재설치 후 정상 수렴)이 올바름은 확인했으나, 향후 리팩터가 "빈 콘텐츠는 특별 취급" 류 변경을 넣어도 잡아낼 테스트가 없음 | `.claude/tools/bootstrap-session.sh:127-130,147-158`, `.claude/tests/test_bootstrap_mermaid_install.py` (해당 시나리오 부재) | 구-포맷 빈 마커를 직접 시딩(`open(marker,"w").close()`)한 뒤 유효 lockfile로 1회 실행 → npm 호출 1회 + 마커가 실제 해시로 갱신됨을 단언하는 테스트 추가(예: `test_legacy_empty_marker_migrates_once`) |
| 2 | 테스트 (testing) | 해시-트리거 재설치가 실패하면 else 분기가 `fail_marker`만 찍고 기존 마커(구 해시)는 그대로 방치 — "여전히 취약한" node_modules가 계속 `is_ready()=True`(ready)로 read되어, 실패 throttle 창(기본 1800s) 동안 스테일 취약 트리가 조용히 유지됨. 이 PR의 핵심 동기(보안 픽스 전파)의 **실패 측면**이 무테스트 | `.claude/tools/bootstrap-session.sh:144-146`, `test_bootstrap_mermaid_install.py:158-170`(기존 테스트는 "마커 자체가 없던" 최초-설치 실패만 커버, 성격이 다름) | H1(성공 설치)→H2(lockfile 변경)→재설치 실패 시나리오에서 마커가 H1 그대로인지, `fail_marker`가 찍혔는지, throttle 해제 후 H2로 수렴하는지 pin하는 테스트 추가 |
| 3 | 테스트 (testing) | 기존 5-way 동시성 스트레스 테스트(`test_concurrent_cold_start_converges_and_then_stops_reinstalling`)의 `setUp`에 `package-lock.json`이 없어 신규 해시-비교 분기(129행)가 한 번도 평가되지 않음 — "마커 존재 여부"만 보는 구 로직에 대한 회귀 테스트로 남아 있고, 이번 diff가 넓힌 재발 리스크 축(설치-완료 후 lockfile 변경 시점의 동시 재설치 경쟁, 마커가 이제 의미있는 콘텐츠를 담아 torn-write 시 영구 루프 이론상 가능)은 병렬 하에서 전혀 검증되지 않음 | `.claude/tests/test_bootstrap_mermaid_install.py:234-262` | "기존 마커 有 + lockfile 변경 직후 동시 기동" 케이스에 동일한 5-way `Popen` 패턴 추가, 수렴 후 마커 콘텐츠가 `_lock_hash()` 현재값과 실제로 일치하는지(존재뿐 아니라 내용까지) assert |
| 4 | 문서화/의존성 (documentation, dependency — 동일 발견 독립 교차확인) | 이번 커밋(`ead99225c`)이 "once/first-install-only 표현 4곳 전부 정정"이라 주장하지만, 같은 "NO LOCK, deliberately" 설계노트 문단 안에서 정정된 문장(`:78-83`, "no longer first-install-only ... recurring, not one-off")과 몇 줄 뒤 결론 문장(`:93`, "an acceptable rare **first-install-only** window")이 서로 정면 모순. 이 문단은 plan §G(fcntl.flock) 재검토 여부의 판단 근거로 파일 스스로 명시하므로, 결론 문장만 훑는 독자는 재발 빈도(정기 Dependabot lockfile 변경마다 재개방)를 과소평가할 수 있음. "확신 주석이 리뷰마다 반증되는" 이 파일 특유의 반복 패턴이, 그 패턴을 고치겠다고 명시한 바로 이 커밋 안에서 재발 | `.claude/tools/bootstrap-session.sh:93` vs `:78-83` | `:93`의 "first-install-only"를 정정된 프레이밍과 일치시켜 "rare, recurring window" 등으로 교체(순수 주석, 코드 변경 불요, 즉시 1줄 수정 가능) |
| 5 | 요구사항/동시성 (requirement, concurrency — 동일 현상 독립 관측, 코드 결함 아님) | 리뷰 진행 중 공유 워크트리의 `bootstrap-session.sh`(추적 대상 원본, 커밋 아닌 작업 트리 상태)가 실시간으로 in-place 뮤테이션되는 것을 **두 리뷰어가 독립적으로 직접 목격**(① 142행 post-install 재계산이 install-전 값 재사용으로 되돌아간 상태, ② 129행 해시-불일치 검사가 `elif false; then # MUTATED`로 무력화된 상태). 곧 자가복구되어 최종 상태는 clean(HEAD와 일치, 11/11 테스트 pass)이지만, 형제 sub-agent의 비-vacuity 뮤테이션 검증이 공유 워크트리 원본을 락 없이 직접 변형하는 방식으로 추정되며, 복원 단계가 crash/timeout으로 실패했다면 이 PR의 목적을 정확히 무효화하는 코드가 미커밋 상태로 잔존할 뻔한 실증된 레이스. 이 저장소에 이미 기록된 사고(가드 mutation 검증 원복은 cp+절대경로 필요, cwd-상대 `git checkout` 복원은 과거 미커밋 작업을 유실시킨 전례)와 동일 계열 | `.claude/tools/bootstrap-session.sh:129,142` (작업 트리 시점 상태) | 뮤테이션 기반 비-vacuity 검증은 (a) 원본을 절대경로 `cp` 백업 후 `trap ... EXIT`로 실패해도 무조건 복원하거나, (b) 전용 스크래치 복사본에서 수행해 다른 concurrent reader(형제 리뷰어 포함)가 변형 창을 관측하지 못하도록 구조적으로 격리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 다수(security, dependency, requirement, testing) | W2(post-install lockfile 해시 재계산)·W3(해싱 도구 완전 부재 시 presence-only 폴백) fix가 정확히 구현되고, 독립적인 되돌림-뮤턴트/mutation testing으로 non-vacuity 재확인됨(여러 reviewer가 각자 되돌림 뮤턴트를 만들어 신규 테스트가 실제로 FAIL함을 재현) | `bootstrap-session.sh:136-142`, `test_bootstrap_mermaid_install.py::test_npm_rewriting_lockfile_still_converges`/`test_missing_hasher_degrades_to_presence_only` | 없음(확인됨) |
| 2 | 문서화/요구사항(documentation, requirement) | README/모듈 docstring 갱신(W4)의 핵심 동작 요약은 정확하나, 인용하는 테스트명 글롭 패턴(`test_lockfile_*`/`test_*hasher*`)이 신규 테스트 4개 중 2개(`test_unchanged_lockfile_does_not_reinstall`, `test_npm_rewriting_lockfile_still_converges`)와 문자 그대로 매칭되지 않음. 정보 손실은 없음(앞 문장이 산문으로 정확히 서술) | `.claude/tests/README.md:34`, `test_bootstrap_mermaid_install.py:20-26` | 패턴 목록에 `test_npm_rewriting_lockfile_still_converges` 명시적 추가 |
| 3 | 성능/아키텍처/유지보수성(performance, architecture, maintainability) | `want_hash=$(_lock_hash)` 계산이 `package.json` 존재 가드보다 먼저, 그리고 그 값을 실제로 쓸지 결정되기도 전에 무조건 실행됨 — 스크립트 자신의 "저비용 체크 우선" 단락 관례에서 벗어남. 절대 비용은 무시할 만함(lockfile 소규모, 수 ms) | `bootstrap-session.sh:150`(구 리뷰 라인 기준 `:124`) | `want_hash` 계산을 `if [ -f "$tool_dir/package.json" ]` 블록 안으로 이동 |
| 4 | 부작용/동시성/보안(side_effect, concurrency, security) | 락-없음 동시성 잔여 위험의 성격이 "최초 설치 1회성"에서 "lockfile 변경마다(정기 Dependabot 머지 포함) 재발"로 확장됨 — 스크립트 설계노트·`plan/in-progress/harness-guard-followups.md` §G·I1에 이미 정직하게 공시·추적 중, 신규 은폐 리스크 아님 | `bootstrap-session.sh:74-93`(설계노트, 단 `:93` 표현 자체는 WARNING #4 참고) | 없음(이미 추적 중, 재현 빈도 실측 시 §G fcntl.flock 재검토) |
| 5 | 동시성(concurrency) | 완료 마커 쓰기가 `>` 리다이렉션(truncate+write)이라 rename 원자성이 없음 — 극히 희박한 torn-read 가능(트렁케이트 직후·쓰기 전 찰나에 다른 세션이 판독 시 빈 문자열→해시불일치 오판, 결과는 무해한 중복 재설치) | `bootstrap-session.sh:142`(쓰기) vs `:129`(판독) | 저우선. 필요 시 `printf ... > "$marker.tmp" && mv "$marker.tmp" "$marker"`로 원자성 확보(§G 전환 시 자연히 함께 정리 가능) |
| 6 | 아키텍처(architecture) | 섹션 2(설치 가드)가 섹션 4(reap, 이미 별도 스크립트+전용 테스트로 추출됨)와 달리 계속 인라인으로 성장 중 — 헬퍼 3개·다단계 무효화 조건·실패 스로틀·해시 바인딩을 갖춘 사실상 독립 서브시스템 규모 | `bootstrap-session.sh` 섹션 2 전체(L61-174) | 지금 당장 불요. 향후 두 번째 "가드된 npm 설치" 필요 시 `.claude/tools/lib/ensure-npm-deps.sh` 류로 분리 고려 |
| 7 | 유지보수성(maintainability) | §2 설계노트 인라인 주석이 이번 diff로 ~20줄 더 늘어 총 ~62줄(같은 섹션 실행 코드는 ~50줄) — 과거 사고 이력을 코드 옆에 방어적으로 남기는 프로젝트 관행 자체는 의도적이나, 이 속도로 계속 자라면 가독성 저하 지점에 근접 | `bootstrap-session.sh:35-96` | 다음 라운드부터는 사건별 전체 서술을 인라인에 쌓기보다 plan/spec 문서로 옮기고 "왜" 1~2문장 + 링크만 남기는 것을 고려 |
| 8 | 유지보수성(maintainability) | 신규 변수(`want_hash`, `need_install`)가 이미 10개 안팎인 flat 전역 스코프에 계속 합류 — 183줄 규모에선 아직 추적 가능하나 확장될수록 부담 증가 | `bootstrap-session.sh:124-132` | 다음 확장 시점에 섹션별 함수화(`ensure_mermaid_deps()`) 고려 |
| 9 | 유지보수성(maintainability) | 신규 실패 stub(`shasum`/`sha256sum` exit 127 재현)이 기존 `_NPM_STUB`(모듈 레벨 상수 + 설명 주석) 패턴과 달리 테스트 메서드 안에 인라인 리터럴로 정의됨. 현재 1회만 쓰여 DRY 위반은 아니나 컨벤션 이질감 | `test_bootstrap_mermaid_install.py:213-222` | 재사용 필요 시 `_FAILING_STUB` 모듈 상수화 + "127=명령을 찾을 수 없음" 주석 |
| 10 | 유지보수성(maintainability) | `_env`/`_run` 헬퍼가 파라미터 목록을 그대로 미러링 — 이번 diff로 `rewrites_lock`이 4곳(두 시그니처 + 본문 + 위임 호출)에 동시 추가됨. knob이 늘수록 shotgun-surgery 성격 강화 | `test_bootstrap_mermaid_install.py:104,124` | 급하지 않음. knob 추가 시 `**kwargs` 위임 패턴 고려(IDE 자동완성과 트레이드오프) |
| 11 | 보안/의존성(security, dependency — carry-forward) | `package.json`의 `jsdom`/`mermaid` `"*"` range + `npm install`(vs `npm ci`) 조합이, 이번 W2 fix(post-install 재해시)와 결합하면 이론상 npm의 재해석성 lockfile 재작성 결과를 검증 없이 확정 수용 — 실사용 노출도 낮음(HTTPS 레지스트리, 신뢰 경계 내), 이미 별도 항목(W6/I9)으로 접수·defer됨. 이번 diff 스코프 아님 | `mermaid-lint/package.json`(이번 3파일 목록 밖) | 조치 불요(이번 PR 스코프 아님). 후속(비긴급)으로 range를 caret으로 좁히거나 `npm ci` 전환 시 이 연결점 자체가 구조적으로 닫힘 |
| 12 | 보안(security) | 해싱 도구(`shasum`/`sha256sum`) 완전 부재 호스트에서는 해시 불일치 감지가 조용히 비활성화되는 기존 동작(W3)이 이번 diff로 회귀 테스트가 신규 추가됨(동작 자체는 불변, 위험도 재평가 불요) | `bootstrap-session.sh` `_lock_hash()` 폴백 분기 | 없음(비차단, 이미 접수됨) |
| 13 | 성능(performance) | `npm install`(재작성 가능) 대신 `npm ci`(lockfile 신뢰, 재작성 없음) 채택 시 post-install 재해시 단계 자체가 불필요해질 수 있음 — 단, "부분 설치 복구" 관용 동작 유지가 설계 의도였다면 `npm install`이 맞는 선택일 수 있어 순수 참고용 제안 | `bootstrap-session.sh:162-167` | 기존 설계 의도 확인 후 판단 권장, 강한 요구 아님 |
| 14 | 성능(performance) | 상태 마커 GC(`find -mtime +30 -delete`)가 매 SessionStart마다 무조건·비throttle 실행(§4 reaper는 self-throttle인 것과 대비) — 이 diff와 무관한 기존 코드, 현재 규모에선 무시할 만함 | `bootstrap-session.sh:179-185` | 현시점 조치 불요. 파일 수가 크게 늘면 reaper와 동일한 throttle 패턴 고려 |
| 15 | 요구사항(requirement) | `spec/` 전수 grep 매치 0건은 정상 — 하네스 개발도구는 product spec 스코프 밖이며 대체 SoT(`plan/in-progress/harness-guard-followups.md` §F)와 라인 단위 일치 재확인(§F 체크리스트 3항목 전부 실측 확인: npm audit 0 vulnerabilities, dependabot.yml 등록, 마커-해시 결속) | `plan/in-progress/harness-guard-followups.md:189-231` | 없음(정상 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | W1/W2 fix 정확·비-vacuity 재확인. 신규 인젝션/시크릿/인증/암호화/에러노출 없음. 잔여 사항(`"*"` range, 해셔 완전부재 폴백)은 이미 별도 접수·defer된 항목 |
| performance | LOW | `want_hash` 조건부 실행 여지(INFO), `npm ci` 검토 여지(INFO) — 절대 비용은 무시할 수준, 핫 경로 아님 |
| architecture | LOW | 마커 마이그레이션 경로 회귀테스트 부재(→WARNING #1), 섹션2 미추출(INFO). 리더 계약(`is_ready()` 존재-only) 보존 확인 |
| requirement | LOW | 4개 선행 WARNING(W1~W4) 코드 라인 단위 재검증 완료, §F 대체 SoT 일치 확인. 리뷰 도중 인플레이스 뮤턴트 관측(→WARNING #5) |
| scope | NONE | 확장된 범위(마커-해시 결속)는 원 취약점 패치의 인과적 전제조건이자 두 차례 리뷰 WARNING 대응 — 무관 변경·불필요 리팩토링·기능 확장 없음 |
| side_effect | LOW | 마커 시맨틱 변경(빈 파일→해시) 하위호환 3개 소비처 코드 직접 확인, 네트워크 트리거 확장은 의도된 변경. 실패 throttle 중 스테일 tree가 ready로 유지되는 상호작용(INFO, testing WARNING #2와 연결) |
| maintainability | LOW | 스타일/스코프 수준 관찰 5건(주석 성장, 변수 스코프, stub 컨벤션, 파라미터 미러링) — Critical/Warning 없음 |
| testing | MEDIUM | 보안 픽스 전파라는 이 PR의 존재 이유 자체의 실패/경계 경로 3건(재설치 실패 시 마커 방치, 구-포맷 마이그레이션, 동시성) 무테스트. 핵심 로직(W1/W2)은 정밀 mutation testing으로 실제 회귀 포착력 확인 |
| documentation | LOW | 설계노트 문단 내 자기모순 잔존(→WARNING #4, "정정하겠다는 커밋 안에서 재발"). 테스트명 글롭 패턴 불일치(INFO) |
| dependency | LOW | 동일 자기모순 독립 교차확인(WARNING #4). W2/W3/W4 코드 레벨 정확 확인, 신규 외부 의존성/라이선스 영향 없음 |
| database | NONE | 해당 없음 — DB 관련 코드 없음 |
| concurrency | LOW | 리뷰 도중 실시간 동시-뮤테이션 관측(→WARNING #5, 검증 하네스 위생 문제). 마커 쓰기 비원자성(INFO), 재발 창 확장은 이미 추적 중(INFO) |
| api_contract | NONE | 해당 없음 — API 표면 없음 |
| user_guide_sync | NONE | 해당 없음 — doc-sync-matrix 21행 매칭 0건 |

## 발견 없는 에이전트

database, api_contract, user_guide_sync — 세 파일 모두 harness 개발도구 변경으로 각 도메인(DB, API 계약, 유저가이드 동기화) 자체가 해당 없음(N/A).

## 권장 조치사항

1. **(최우선, 이 PR의 존재 이유 직결)** 해시-트리거 재설치 실패 시 스테일(취약) 마커가 방치되어 `is_ready()`가 계속 `True`를 반환하는 경로에 회귀 테스트 추가 — WARNING #2. 보안 픽스 전파가 실패했을 때 그 실패조차 감지되지 않는 경로이므로 가장 먼저 닫아야 함.
2. **(즉시 가능, 1줄)** `bootstrap-session.sh:93`의 "first-install-only" 표현을 `:78-83`의 정정된 프레이밍과 일치시켜 설계노트 문단 내 자기모순 제거 — WARNING #4. 순수 주석 변경, 테스트 재실행 불요.
3. 구-포맷(빈 파일) 마커 → 해시 마이그레이션 경로(모든 기존 체크아웃이 머지 직후 반드시 거치는 경로)를 pin하는 회귀 테스트 추가 — WARNING #1.
4. 기존 5-way 동시성 스트레스 테스트를 "기존 마커 有 + lockfile 변경 직후 동시 기동" 케이스로 확장해 신규 해시-바인딩 경로의 병렬 수렴을 실증 — WARNING #3.
5. **(프로세스 개선, 코드 아님)** 뮤테이션 기반 비-vacuity 검증 하네스가 공유 워크트리 원본을 락 없이 in-place 변형하는 관행을 스크래치 복사본 격리 또는 `trap ... EXIT` 무조건 복원으로 전환 — WARNING #5. 이번엔 자가복구됐으나 실증된 레이스이며, 이 저장소에 이미 같은 계열 사고 이력이 있음.
6. (저우선, 선택) `want_hash` 계산을 `package.json` 존재 가드 안으로 이동해 순서 일관성 회복 — INFO #3.

## 라우터 결정

- `routing=skipped`: 라우터 미사용(이번 라운드 사유 미명시 — prompt에 `routing_skip_reason` 없음) — 전체 reviewer 14명 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 `success` + 인라인 전문 확보)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 라우터가 스킵되어 전체 실행이므로 강제 목록은 결과에 영향 없이 전원 정상 포함됨. **forced 전원 결과 확보 확인 — 누락 없음.**

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | 전원 실행됨 |