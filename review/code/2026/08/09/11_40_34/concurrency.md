# 동시성(Concurrency) 리뷰 — required-check skip-jobs 전환

## 스코프 판단

이번 변경은 애플리케이션 코드가 아니라 GitHub Actions 워크플로(`deps-security-checks.yml`,
`frontend-checks.yml`) + 이를 지원하는 bash 스크립트(`scripts/ci-paths-changed.sh`) + 회귀
가드 테스트(`.claude/tests/test_required_check_skip_jobs.py`,
`test_workflow_yaml_structure.py`) + 문서(`README.md`)로 구성된다. 스레드/뮤텍스/async-await/
이벤트 루프 같은 고전적 동시성 primitive 는 등장하지 않는다. 다만 GitHub Actions 의
`needs:` + job `outputs` 는 사실상 **barrier/synchronization primitive** 로 기능하므로
(생산자 잡의 결과를 소비자 잡들이 안전하게 읽는 구조), 이 관점에서 "동기화" 카테고리로
검토했다.

## 발견사항

- **[WARNING]** `changes` 잡(barrier)이 실패/타임아웃/취소되면 하위 잡 전체가 `success` 가
  아니라 `skipped` 로 떨어져, 이 PR 이 없애려는 "required check 데드락"과 동일한 모호한
  상태가 재발할 수 있다.
  - 위치: `.github/workflows/deps-security-checks.yml:43`–`46` (`changes` 잡, `timeout-minutes: 3`),
    `:71`·`94`·`118` (각각 `config-guard`/`audit`/`override-floors`의 `needs: changes`).
    동일 패턴이 `.github/workflows/frontend-checks.yml:28`–`31` (`changes` 잡),
    `:52` (`test-and-build`의 `needs: changes`) 에도 있다.
  - 상세: GitHub Actions 의 기본 규칙상 `needs: <job>` 인 잡은 그 잡이 **성공**해야만
    실행되고, 필요 잡이 실패·취소되면(별도로 `if: always()` 등을 주지 않는 한) 하위 잡은
    그 자체가 **skipped** 로 보고된다. 이 PR/스크립트의 헤더 주석과
    `test_required_check_skip_jobs.py` 의 docstring 은 "skip 된 잡의 conclusion 은
    `skipped` 이고 그것이 required check 를 만족하는지는 문서상 모호하다"는 이유로
    **잡을 skip 하지 않고 스텝만 게이팅**하는 설계를 택했다고 명시한다. 그런데 이 설계는
    `changes` 잡 자체가 항상 성공한다는 전제에 의존한다 — `scripts/ci-paths-changed.sh`
    내부의 모든 실패 분기는 fail-safe(`emit true`)로 방어돼 있지만, 이는 **스크립트가
    끝까지 실행됐을 때**만 적용된다. `actions/checkout@v7`(`fetch-depth: 0`, 전체 클론)
    스텝이 네트워크 문제로 실패하거나, `timeout-minutes: 3` 을 초과하거나(모노레포 전체
    히스토리 클론은 종종 3분에 근접), concurrency 그룹의 `cancel-in-progress: true` 에
    의해 취소되는 경우, `changes` 잡 자체가 `failure`/`cancelled` 로 끝나고 하위 잡들은
    한 스텝도 실행되지 않은 채 `skipped` 로 보고된다. 결과적으로 required check 는 정확히
    이 설계가 피하려던 "skipped 가 required check 를 만족하는지 모호한" 상태로 되돌아간다.
    (다만 종전의 `paths:` 필터 방식은 무관한 PR 에서 **항상** 워크플로 자체가 안 도는
    확정적 데드락이었던 반면, 이번 갭은 `changes` 잡의 인프라성 실패라는 드문 조건에서만
    발생하므로 순수 회귀는 아니고 잔존 리스크에 가깝다.)
  - 제안: 하위 잡에 `if: always() && needs.changes.result != 'failure' && needs.changes.result != 'cancelled'` 류의
    가드를 추가해 `changes` 잡이 실패/취소돼도 하위 잡이 (스텝은 건너뛰더라도) `success`
    로 보고되도록 하거나, 최소한 이 실패 모드를 `test_required_check_skip_jobs.py` 의
    docstring/가드 목록에 "알려진 잔존 리스크"로 명시해 재발견 시 놀라지 않도록 기록.
    `timeout-minutes: 3` 이 `fetch-depth: 0` 풀 클론에 여유가 있는지도 함께 재확인 권장.

- **[INFO]** `needs: changes` 를 통한 잡 간 데이터 전달(`needs.changes.outputs.relevant`)
  자체는 GitHub Actions 가 보장하는 동기화이므로 경쟁 조건이 없다 — `changes` 잡이 완료된
  뒤에야 하위 잡이 시작되고 그 시점의 `outputs` 값을 일관되게 읽는다. `emit()` 함수도
  잡당 정확히 한 번만 호출되도록 모든 분기가 `emit` 직후 `exit 0` 하므로
  (`scripts/ci-paths-changed.sh:42-83`, 특히 44-83 라인의 각 분기) `$GITHUB_OUTPUT` 에
  중복/경쟁 기록이 발생하지 않는다.
  - 위치: `scripts/ci-paths-changed.sh:42`–`45` (`emit`), `48`–`82` (각 fail-safe/판정 분기).
  - 상세/제안: 조치 불필요, 참고용 기록.

- **[INFO]** `concurrency: group: ...-${{ github.ref }}, cancel-in-progress: true` 블록은
  이번 diff 로 새로 추가되거나 수정되지 않은 기존 설정이다(두 워크플로 모두 unified diff의
  문맥 줄로만 등장). `changes` 잡이 새로 추가되며 이 그룹 취소 대상 범위에 포함됐지만,
  취소는 런(run) 전체 단위로 이뤄지므로 "changes 는 취소됐는데 하위 잡은 남아 도는" 식의
  찢어진(torn) 상태는 발생하지 않는다.
  - 위치: `.github/workflows/deps-security-checks.yml:35`–`37`,
    `.github/workflows/frontend-checks.yml:22`–`24` (전체 파일 컨텍스트 기준, 변경 없음).
  - 상세/제안: 조치 불필요.

## 요약

핵심 변경은 스레드/프로세스 수준의 동시성이 아니라 GitHub Actions 잡 그래프의 동기화
설계(`needs:` + job `outputs` 를 barrier 로 사용)이며, 그 자체는 올바르게 구성돼 있고
`test_required_check_skip_jobs.py`/`test_workflow_yaml_structure.py` 가 "paths: 부활",
"`if:` 게이팅 누락", "`needs: changes` 누락" 세 가지 회귀를 각각 잘 잡아낸다. 다만 이
설계의 전제 — "barrier 잡(`changes`)은 항상 성공한다" — 가 인프라성 실패(체크아웃 실패,
타임아웃, cancel-in-progress 취소)에 대해서는 보장되지 않아, 그 조건에서는 이 PR 이 없애려던
"skipped 가 required check 를 만족하는지 모호한" 상태가 하위 잡들에서 재발할 수 있다. 이는
드문 조건에서만 발현되는 잔존 리스크이며 종전 방식(확정적 데드락)보다는 명백히 개선이므로
차단 사유는 아니지만, 설계 문서/가드에 알려진 한계로 남겨두는 것을 권한다.

## 위험도

LOW
