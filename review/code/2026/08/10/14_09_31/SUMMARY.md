# Code Review 통합 보고서 — 리뷰 배치 거짓 PASS 제거 + router fail-closed

- 대상: `claude/harness-review-batch-false-pass` · diff-base `origin/main` · `--route=all`
- changeset **81파일** (비-review 7) — **세션 하나**에 담겼다. 옛 코드였다면 50/31 로 갈려
  꼬리 31개만 리뷰됐을 규모다. 이 라운드 자체가 수정의 실전 검증이다.
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

Critical 1 · WARNING 4 — **전부 반영 완료** (`RESOLUTION.md` 참조).

## 전체 위험도

**LOW** (반영 후).

## Critical

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | scope | **회수한 리뷰 산출물 중 1건이 미머지 PR 것** — 커밋 메시지가 "전부 이미 머지된 PR(#1125~#1129)" 이라 단정했으나 `12_48_08` 은 **열려 있는 [#1130](https://github.com/worker-ants/clemvion/pull/1130)** 의 라운드. 미머지 작업의 리뷰 기록을 무관한 브랜치에 심으면 감사 기록이 오염된다 | **반영** (`e4ce8adf8`) — 여기서 제거하고 #1130 브랜치로 이동·push 완료 |

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 2 | testing | **`_warn_large_changeset` 의 호출부가 어떤 테스트로도 관측되지 않는다** — 헬퍼 테스트는 `main()` 을 안 거치고, `main()` 구동 테스트는 stderr 를 버린다 | **반영** — stderr 포획 + call-site 단언 2건. 뮤테이션 RED |
| 3 | maintainability | 테스트가 orchestrator 소유 `ALL_AGENTS` 를 14개 손 나열로 복제 | **반영** — `orch.ALL_AGENTS` 로 교체 |
| 4 | maintainability | "20개까지 나열 + 나머지 개수" 블록이 매직넘버째로 한 번 더 복제 | **반영** — `_bulleted_path_sample` 로 공유 |
| 5 | documentation | 이번 변경이 닫은 결함을 **두 문서가 아직 "열려 있다" 고 서술** (`tests/README.md` 는 인접 두 행이 서로 모순, skill `README.md` 는 사라진 로그 이벤트를 나열) | **반영** — 둘 다 정정 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE |
| requirement | 0/0 — **신규 테스트 17건을 직접 실행해** 통과 확인 |
| side_effect | 0/0 — 세션 경로 소비처 5곳(`--resume`·`--sync-from-disk`·`--verify-coverage`·`--update`·`--apply-routing`) + Workflow 를 전수 확인해 계약 변경의 영향권 밖임을 코드로 확정 |

## 리뷰어 지적이 절반 틀린 것 (실측으로 갈랐다)

scope 는 `review/consistency/.../{10_35_05,10_36_44}` 도 같은 오귀속으로 지목했다.
`meta.json.target_path` 를 읽으니 `spec/conventions/spec-impl-evidence.md` = **#1123
(`144d0de0a`, 머지됨)** 이고, `12_06_35` 은 `spec/7-channel-web-chat/2-sdk.md` = **#1128
(`527865c08`, 머지됨)** 이다. 둘 다 정상 회수다.

**내 주장의 오류는 "머지됐다" 가 아니라 PR 번호 범위였다** — #1125~#1129 가 아니라
#1123·#1125·#1126·#1128. reviewer 가 그 좁은 범위를 근거로 판정했기 때문에 정상 회수분
2건까지 오탐으로 끌어들였다. 진짜 오귀속은 하나뿐이었다.

## 내가 노출시킨 기존 결함 하나

`test_line_anchors` 가 RED 였는데 **orchestrator 변경 탓이 아니다.**
`pick_commit_fixture` 가 내 **삭제-전용 커밋**(`e4ce8adf8`, 9파일 627 삭제)을 골랐고,
소비자는 `git show <sha>:<path>` 로 원본을 얻으므로 삭제된 경로는 전부 빈 문자열 →
대조 0건 → `assertGreater(checked, 20)` 실패.

그 함수 docstring 이 이미 같은 클래스 실패 **2종**(문서-전용 커밋·merge 커밋)을 기록하고
있어 세 번째 변종을 같은 자리에 닫았다 — `sha` 시점에 내용이 존재하는 파일이 하나라도
있어야 선택한다. 수정 후 픽커가 `e4ce8adf8` 을 건너뛰고 `b35bd23ca` 를 고르는 것을 실측했다.

## 이 라운드의 성격

발견 5건 중 **4건이 "바꾼 것의 자매를 안 셌다"** 이다 — 문서 2곳, 테스트 호출부, 그리고
회수 대상 목록. 마지막 것이 가장 비쌌다: "전부 머지됐다" 는 **검증 가능한 주장인데 세지
않고 썼고**, 그 PR 을 30분 전에 내가 직접 올렸는데도 놓쳤다.

## 검증

- harness **1051 tests / OK**
- 뮤테이션 6종 RED — 분할 복원 · 경계 `>`→`>=` · `compute_forced_agents` 무력화 ·
  교차검사 호출부 절단 · 소스 필터 제거 · **안내 호출부 절단**
