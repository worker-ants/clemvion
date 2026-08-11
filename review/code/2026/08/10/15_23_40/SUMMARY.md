# Code Review 통합 보고서 — peer 게이트 5곳 확대 (§1, 2라운드)

- 대상: `claude/deps-peer-gating` · diff-base `origin/main` · `--route=all`
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

Critical 0 · WARNING 5 — **전부 반영** (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | requirement · maintainability | **5곳 중 4곳에 가드가 없다** — 이번 CRITICAL 이 정확히 그 갭에서 났다(가드 있던 1곳은 즉시 RED, 없던 4곳은 무신호) | **반영** — `test_install_gate_flags.py` 신설, 뮤테이션 3/3 RED |
| 2 | documentation ×3 | **"저장소에서 유일한 소재지" 가 세 파일에서 살아남았다** — `action.yml`(같은 블록 안 자기모순) · 새 docstring(caveat 없이 반복) · `tests/README.md`(직전 RESOLUTION 이 "동반 갱신" 이라 적었으나 그 문장은 안 고침) | **반영** — 범위를 "CI 워크플로가 공유하는 한 줄" 로 좁히고, **그 프레이밍이 사고를 낳았다**는 사실을 명시 |
| 3 | scope (INFO) | `pnpm-workspace.yaml` 이 소재지를 한 곳으로만 서술 | **반영** — 5곳 열거 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE |
| scope | NONE — Dockerfile 확대가 §1 범위 안(plan 원문이 "CI/**로컬** 게이트")임을 원문 확인으로 판정 |
| side_effect | NONE — **Docker COPY 패턴을 repo 밖 scratch 에 재현해 실행**, exit 0 / unmet peer 0건. 3개 Dockerfile 모두 install 전에 워크스페이스 10개 멤버 `package.json` 을 전부 복사함도 확인 |
| testing | 0/0 (INFO 2, 둘 다 반영 완료) |
| requirement | 저장소 전수 재검색으로 **호출부가 정확히 5곳**임을 독립 확인(6번째 없음) |

## 이 라운드의 성격 — 결함의 뿌리는 문구였다

WARNING 5건 중 4건이 **"유일한 소재지" 라는 한 문구**로 수렴한다. 그걸 믿었기 때문에 action
한 곳만 고치고 "전부 덮었다" 고 적었고, CI 에서 도는 3곳이 조용히 통과했다.

그래서 정정을 "문구 위생" 으로 처리하지 않고, **그렇게 읽는 것이 이번 사고를 낳았다**를
세 곳 모두에 남겼다. 좁힌 주장("CI 워크플로가 공유하는 한 줄")은 참이고 여전히 유용하다.

## 검증

- harness **1036 tests / OK**
- 뮤테이션 3/3 RED — Dockerfile 플래그 제거(**이전엔 무가드**) · 등재 목록 삭제(2건 탐지) ·
  주석 필터 vacuity 전제 고정
- side_effect 가 격리 사본에서 Docker install 재현 / requirement 가 호출부 전수 재검색
