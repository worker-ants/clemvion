# 동시성(Concurrency) 리뷰

## 발견사항

- **[WARNING]** 해시-트리거 재설치 추가로 "최초 1회뿐"이던 npm 동시-설치 레이스가 반복 재현 가능해짐 (레이스 자체는 기존에 이미 문서화·의도적으로 수용된 것; 이번 diff 는 그 발동 빈도를 확장)
  - 위치: `.claude/tools/bootstrap-session.sh` — 설계 노트 63-87행(특히 84행 "Judged an acceptable rare first-install-only window"), `need_install` 판정 112-123행(신규 분기는 120행 `elif [ -n "$want_hash" ] && [ "$(cat "$marker")" != "$want_hash" ]`)
  - 상세: diff 이전에는 `need_install`(구 코드에선 인라인 조건)이 오직 `[ ! -f "$marker" ]`(마커 부재 = "최초 콜드 설치") 하나로만 참이 됐다. 이번 diff(§F W1 fix)가 두 번째 트리거인 해시 불일치를 추가하면서, `main_root` 를 공유하는 여러 워크트리 세션이 이제 **매 lockfile 변경(= 매 Dependabot 보안 머지)마다** `npm install` 경쟁 창을 다시 통과한다. 그런데 바로 이 블록의 설계 노트(63-87행)는 이 레이스를 "Residual, accepted: several sessions hitting the *first* cold install... Judged an acceptable rare **first-install-only** window" 라고 명시적으로 서술한다 — 이 서술은 diff 가 방금 만든 두 번째 트리거 때문에 이제 부정확하다. 같은 diff 가 `.github/dependabot.yml` 에 이 트리를 주간(weekly) npm ecosystem 스케줄로 신규 등록했고(파일 3), `.claude/tests/test_bootstrap_mermaid_install.py` 자신의 모듈 docstring 도 "여러 워크트리 세션을 동시에 띄우는 것이 문서화된 워크플로" 라고 명시한다 — 즉 "레이스가 열리는 사건"(lockfile 변경)을 이 diff 스스로가 일회성에서 정기 반복으로 바꿔 놓았다. 실손상 경로는 63-87행 코멘트가 이미 정확히 서술한 그대로 유효하다: 두 세션이 공유 `tool_dir` 에 `npm install --silent` 을 동시 실행하면 tree 가 깨질 수 있고, 마커는 "이 프로세스의 npm exit 0" 만 증명할 뿐 tree 무결성은 보증하지 않으므로 손상된 tree 가 "ready" 로 마킹될 수 있다 — 그 결과 `lint-mermaid.mjs` 의 guardless top-level `await import("mermaid")` 가 매 markdown 커밋마다 가짜 "malformed mermaid block" 로 실패한다(fail-open 계약의 정반대). `plan/in-progress/harness-guard-followups.md` 를 보면 팀은 이미 이 클래스의 위험을 인지하고 진짜 상호배제(fcntl.flock, §G)를 "(필요 시)" 라는 조건부로 §F(본 PR)와 명시적으로 분리·defer 했다 — 즉 이번 PR 범위에 fcntl.flock 을 넣으라는 지적은 아니다(plan 이 스스로 "같이 넣으면 scope 오염" 이라고 경고).
  - 제안: (a) 코드 변경 없이 63-87행 코멘트 문구만 "first-install-only" → 실제 트리거 2종(최초 설치·lockfile 해시 변경) 모두를 반영하도록 정정 — 이 diff 가 바로 그 블록을 편집한 김이라 비용이 거의 없다. (b) `plan/in-progress/harness-guard-followups.md` §G 를 "이 fix 로 레이스 발생 빈도가 1회성→주간 반복으로 바뀌었다"는 근거를 달아 "필요 시" 판단을 재검토(§G 를 지금 구현하라는 요구 아님, 우선순위 재평가 근거 추가만).

- **[INFO]** 동시 세션 × 해시-트리거 재설치 조합을 직접 pin 하는 테스트 부재
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` — 기존(미변경) `test_concurrent_cold_start_converges_and_then_stops_reinstalling`(188행) vs 신규 `test_lockfile_change_retriggers_install`(159행)/`test_unchanged_lockfile_does_not_reinstall`(179행)
  - 상세: 기존 동시성 테스트는 "마커가 전혀 없는" 콜드 스타트만 5-프로세스로 경쟁시킨다(`subprocess.Popen` ×5, `stdout/stderr=DEVNULL` 로 파이프 버퍼 데드락을 피하는 점은 이미 올바르게 처리됨). 신규로 추가된 해시-불일치 재설치 테스트 2건은 순차 실행(`self._run()` 연속 호출)만 검증하며, "마커가 이미 존재 + lockfile 변경 + N 개 세션이 동시에 기동" 조합은 어느 테스트도 재현하지 않는다. `need_install=1` 이 되는 두 분기(118행 부재·120행 해시불일치)가 이후 동일한 125-134행 `npm install` 블록으로 수렴하므로 기능적 위험은 낮게 추정되나, 이번 diff 의 핵심 주제(§F, W1)가 바로 이 새 트리거이므로 수렴성(convergence) 성질을 콜드-스타트 테스트에서 유추하는 대신 직접 pin 하면 회귀 방지 정확도가 높아진다.
  - 제안: `test_concurrent_cold_start_...` 를 변형해 "먼저 1회 설치(마커=구 해시 기록) → lockfile 갱신 → N 개 프로세스 동시 기동" 케이스를 추가해 finding 1 이 서술한 반복-레이스 시나리오를 실제로 경쟁시켜 본다.

- **[INFO]** 마커 파일 쓰기(`printf '%s\n' "$want_hash" > "$marker"`, 128행)는 truncate+write 이며 temp+rename 이 아니라 원자적이지 않음
  - 위치: `.claude/tools/bootstrap-session.sh` 128행
  - 상세: 오늘은 무해하다 — 경쟁하는 모든 writer 가 같은 불변 `package-lock.json` 으로부터 계산한 동일한 해시 문자열을 쓰므로, 두 프로세스의 쓰기가 겹쳐도 최종 바이트는 항상 같다(내용이 프로세스마다 다르지 않기 때문). 다만 이 라인은 이번 diff 로 "빈 파일 터치"(구 코드 `: > "$marker"`)에서 "내용 있는 파일 쓰기"로 막 바뀐 지점이라, 향후 마커에 프로세스별로 달라지는 메타데이터(타임스탬프·PID 등)를 추가하면 이 "내용이 항상 같다" 전제가 조용히 깨지고 torn write 가 실제 손상으로 이어질 수 있다.
  - 제안: 당장 수정 불요. 향후 마커 내용을 확장할 계획이 있다면 `tmp=$(mktemp) && printf ... > "$tmp" && mv "$tmp" "$marker"` 형태의 원자적 치환으로 바꾸라는 주석 한 줄만 남겨두는 정도가 저비용 예방책.

파일 스코프 내 나머지 항목은 동시성 관점에서 특기사항 없음: `.github/dependabot.yml`(스케줄 설정 메타데이터, 런타임 동시성 없음), `.claude/tools/mermaid-lint/package-lock.json`(undici 7.27.0→7.28.0·dompurify 3.4.7→3.4.12 버전 핀 변경뿐, 실행 코드 없음 — undici 는 커넥션 풀링을 갖지만 이 트리에서 애플리케이션이 그 API 를 직접 호출하지 않는 devDependency 그래프일 뿐), `PROJECT.md`(문서 1줄 추가, 코드 아님). `bootstrap-session.sh` 의 나머지 섹션(1. `git config core.hooksPath` — git 자체 lockfile 로 직렬화됨, 3. GC, 4. reaper 호출)은 이번 diff 로 변경되지 않아(`git diff` 로 확인) 별도 검토하지 않았다.

## 요약

이번 diff 의 핵심(§F, W1) — 마커를 lockfile 해시에 결속해 Dependabot 보안 머지가 기존 설치를 무한정 마스킹하지 못하게 한 것 — 은 그 자체로 건전하고 잘 테스트돼 있다(변경/불변 양쪽 pin, 해시 도구 부재 시 구 동작으로 폴백하는 열화 경로까지 커버). 동시성 관점에서 새로운 버그 클래스는 도입되지 않았다. 다만 이 fix 는 파일 스스로 "Residual, accepted... rare first-install-only window" 라고 명시해 둔, 이미 알려지고 의도적으로 수용된(락 제거 결정, review 02_06_42 C1 교훈) npm 동시-설치 레이스의 **발동 조건을 확장**한다 — 종전에는 fresh checkout 최초 1회만 열리던 창이, 이 diff 이후로는 (같은 diff 가 추가한 주간 Dependabot 스케줄과 맞물려) 매 lockfile 변경마다, 그리고 문서화된 멀티-워크트리 동시 세션 워크플로 위에서 반복적으로 열린다. 실제 손상 경로(공유 `tool_dir` 에 대한 동시 `npm install`, tree 무결성 미검증 마커, `lint-mermaid.mjs` 의 guardless import 로 인한 가짜 커밋 차단)는 파일 주석이 이미 정확히 예견해 두었고, 팀은 진짜 상호배제(fcntl.flock, `plan/in-progress/harness-guard-followups.md` §G)를 "필요 시" 조건부로 이미 §F 와 분리해 defer 하기로 결정했다. 이번 리뷰가 더하는 것은 그 조건("필요 시")을 재판단할 새 근거(빈도 1회성→주간 반복)가 이 diff 로 생겼다는 점, 그리고 설계 코멘트의 "first-install-only" 서술이 이제 부정확해졌다는 점뿐이다. 둘 다 이번 PR 을 막을 사유는 아니며(plan 문서가 §A/§G 범위를 §F 와 섞으면 "scope 오염" 이라고 스스로 경고), 코멘트 정정은 저비용으로 지금 반영 가능하고 §G 재우선순위화는 후속 판단으로 남겨도 무방하다.

## 위험도

LOW
