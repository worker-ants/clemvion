# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경 대상 코드(.claude/hooks/_lib/branch_guard.py, review_guard.py, guard_review_before_stop.py, lint_mermaid_posttooluse.py, bootstrap-session.sh, 테스트 파일)는 모두 단일 프로세스 내 순차 실행 Python 훅 및 셸 스크립트입니다. 멀티스레드, async/await, 공유 메모리, 락, 이벤트 루프가 없으며, subprocess를 통한 git/node 호출만 존재합니다.

- **[INFO]** `_code_review_in_flight` 내 `os.walk` TOCTOU 패턴
  - 위치: `.claude/hooks/_lib/review_guard.py` `_code_review_in_flight` 함수 (라인 1163-1168)
  - 상세: `os.walk` 중 외부 프로세스(리뷰 orchestrator)가 `SUMMARY.md`를 동시에 기록하면, 루프 진행 중 `"SUMMARY.md" in files` 판정이 실제 파일시스템 상태와 어긋날 수 있음(false-positive in-flight 또는 false-negative). 단, Stop 훅은 Claude 세션 내에서 순차적으로 호출되고, push guard가 hard gate로 남아있어 보안적 위험은 없음.
  - 제안: 현행 fail-open 설계(TOCTOU가 발생해도 누지가 한 번 더 발동하거나 억제되는 수준에 그침) 수준으로 충분. 별도 조치 불필요.

- **[INFO]** `_mark_nudged` 의 마커 파일 생성 원자성
  - 위치: `.claude/hooks/guard_review_before_stop.py` `_mark_nudged` 함수 (라인 1485-1491)
  - 상세: `os.makedirs` 후 `open(marker, "w")` 두 단계가 비원자적이므로 동일 (session, branch) 에 대해 두 Stop 훅 프로세스가 경쟁하면 nudge가 두 번 발동할 수 있음. Claude 세션의 Stop 훅은 단일 순차 실행이 보장되므로 실제 경쟁 조건 발생 가능성은 없음.
  - 제안: 현행 설계 유지. 혹시 다중 클라이언트 확장 시 `open(marker, "x")` (exclusive create)로 원자 쓰기 가능.

- **[INFO]** `bootstrap-session.sh` GC와 훅의 마커 파일 레이스
  - 위치: `.claude/tools/bootstrap-session.sh` (라인 2215)
  - 상세: 세션 시작 시 `find -mtime +30 -delete`가 실행되는 시점에 다른 훅 프로세스가 동일 마커를 `os.path.exists`로 확인하면, 삭제된 마커를 "없음"으로 판단해 30일 이상 된 브랜치에서 nudge가 재발동할 수 있음. 30일 TTL 기준이므로 실제 레이스는 극히 드물고, 발동 결과도 1회 추가 nudge에 그침.
  - 제안: 현행 설계 유지. 허용 가능한 수준의 best-effort GC.

## 요약

이번 변경은 동시성 구조를 새로 도입하지 않으며, subprocess 타임아웃 강화(branch_guard 4.0s→2.0s, mermaid 훅 20s 추가), 파일시스템 기반 상태 마커 관리 개선, checkout-immune 시간 비교 로직으로 구성됩니다. 모든 코드는 단일 프로세스 순차 실행 모델이며, 멀티스레드·async·이벤트 루프·락·세마포어 관련 패턴이 없습니다. 이론상 파일시스템 TOCTOU와 마커 파일 비원자 쓰기가 식별되지만, Claude 세션의 훅 순차 실행 보장 및 push guard의 hard gate 존재로 실질적 위험은 없습니다. 동시성 관점에서 차단이 필요한 이슈는 발견되지 않았습니다.

## 위험도

NONE
