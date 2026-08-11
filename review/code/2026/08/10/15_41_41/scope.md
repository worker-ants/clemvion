# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 이 diff 는 기능 변경 12개 파일 + 이전 두 리뷰 라운드(`15_11_16`, `15_23_40`)의 산출물 22개 파일(`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/reviewer 리포트 10종 ×2 라운드)을 함께 담고 있어, 전체 파일 수(34개)가 실질 코드 변경(12개)의 거의 3배다.
  - 위치: `review/code/2026/08/10/15_11_16/*` (파일 13~23), `review/code/2026/08/10/15_23_40/*` (파일 24~34)
  - 상세: `git log --oneline -- review/code/`로 확인한 결과 이 저장소는 `chore(review): <세션> 라운드 산출물` 형태의 별도 커밋으로 리뷰 산출물 전체를 커밋해 온 확립된 관례다(`db2ef0300`, `1ee42ab33` 등 기존 커밋 다수). `CLAUDE.md`도 "코드 리뷰 산출물 | review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/" 를 SoT 위치로 명시한다. 다만 skill 쓰기 권한 표는 developer 역할의 `review/**` 쓰기를 `RESOLUTION.md` 로만 한정하고, `SUMMARY.md`/개별 reviewer `.md`/`meta.json`/`_retry_state.json` 은 code-review-agents(`/ai-review`) 소관으로 적혀 있다 — 실제 파일 생성은 리뷰 sub-agent 자신이 했을 것이므로 이 diff 는 "누가 편집했나"의 위반이 아니라 "그 결과를 이 코드 변경과 같은 changeset 에 커밋하는가"의 문제다. 기존 관례와 일치하므로 이 자체를 결함으로 보지는 않으나, 스코프 감사 관점에서 명시해 둔다.
  - 제안: 없음 — 확립된 관례를 따른 것으로 판단. 다만 향후 "코드 fix"와 "리뷰 산출물 기록"을 별도 커밋으로 유지하는 현재 관행(이 diff 의 커밋 이력도 `fix(ci)`/`test`/`docs`/`chore(review)` 로 분리돼 있음, `db2cca7a1`·`c0913381e`·`1ee42ab33` 등)을 계속 지키면 스코프 추적성이 유지된다.

- **[INFO]** `.claude/tests/test_install_gate_flags.py` 는 최소 수정(누락된 4곳에 플래그 추가)을 넘어 신규 회귀 가드(146줄, 정적 대조 2-테스트 구성)를 도입한다
  - 위치: `.claude/tests/test_install_gate_flags.py:1-146` (전체 신규 파일)
  - 상세: 요청된 최소 변경은 "5곳 모두에 `--strict-peer-dependencies` 를 단다" 이지만, 이 파일은 그 사실을 지키는 정적 가드까지 신설한다. 그러나 이는 speculative feature 가 아니라 직전 라운드(`15_11_16`) `requirement.md`(CRITICAL: "게이트가 install 호출부 한 곳에만")·`testing.md`("재발 방지를 원하면 … 가드를 별도 후속으로 고려")가 명시적으로 요구한 조치이고, `RESOLUTION.md` §1 이 그 채택 근거("직전 CRITICAL 이 난 자리")를 남기고 있어 스코프 확장이라기보다 리뷰가 요청한 조치의 이행으로 판단된다.
  - 제안: 없음 — 근거가 문서화돼 있고 리뷰 요청에 대한 정당한 응답.

CRITICAL/WARNING 급 스코프 이탈은 발견되지 않았다. §2(eslint 10 상향, 10개 워크스페이스)에 속하는 파일(`eslint.config.mjs`, 각 워크스페이스 `package.json`, `dependabot.yml` 등)은 이 diff 어디에도 등장하지 않으며, plan 체크리스트도 §1 두 항목만 `[x]`로 갱신하고 §2 세 항목은 `[ ]`로 남아 있다 — 이전 두 라운드의 scope reviewer 판정(`NONE`)과 일치한다. 포맷팅 전용 변경, 무관한 리팩토링, 미사용 임포트, 의도치 않은 설정(예: `pnpm-workspace.yaml`의 `peerDependencyRules` 는 실측 근거로 의도적으로 비워 둠) 변경도 확인되지 않았다.

## 요약

이 diff 는 티켓 §1(`pnpm install --strict-peer-dependencies` 게이트 도입 및 5개 호출부 전체 확대)에 정확히 결속돼 있다. 핵심 기능 변경 12개 파일(테스트 가드 3종, composite action, Dockerfile 3종, `test-stages.sh`, plan 문서, `pnpm-workspace.yaml`, 코멘트 정정 1건)은 모두 같은 게이트 도입이라는 단일 목적으로 수렴하며, §2(eslint 10 상향)에 속한 파일은 일절 건드리지 않았다. 신규 회귀 가드(`test_install_gate_flags.py`)는 언뜻 범위 확장으로 보이지만 직전 리뷰 라운드가 명시적으로 요청한 조치이고 그 근거가 `RESOLUTION.md`에 남아 있어 정당하다. diff 에 포함된 나머지 22개 파일은 이전 두 리뷰 라운드(`15_11_16`, `15_23_40`)의 산출물 전체를 커밋한 것으로, 이 저장소가 반복해 온 `chore(review)` 커밋 관례와 일치해 스코프 위반으로 보지 않는다. 전반적으로 "요청된 변경 외 추가 수정", "무관한 리팩토링", "요청하지 않은 기능 확장", "무관한 파일 수정", "포맷팅/주석/임포트/설정의 의도치 않은 변경" 어느 항목에서도 문제되는 사례를 찾지 못했다.

## 위험도
NONE
