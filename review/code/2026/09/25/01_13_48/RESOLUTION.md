# RESOLUTION — `review/code/2026/09/25/01_13_48` (4라운드, 파일 범위 지정)

**Critical 0 · Warning 3 · INFO 7.** forced 7/7. 범위는 테스트 파일 · plan 둘(3라운드와 같은 이유 — `--branch` 는
리뷰 산출물이 예산을 먹는다).

## 판단 — 네 번째 같은 형태, 그래서 구조로

1 · 2 · 3 · 4라운드가 **같은 형태를 자리 하나씩 안쪽에서** 찾았다(리소스 중복 → 컨테이너 중복 → 포트 뒤 `latest` →
`.get()` 체인 호출 지점마다). 원인은 검사를 자리마다 복제한 것이다 — 복제 하나가 무검증 분기 하나다. W3 에 경계 테스트를
하나 더 붙이면 다섯 번째 자리가 남는다. 그래서 W2 의 제안(헬퍼 통합)을 구조적 해법으로 채택했다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | 판별 확인 | commit |
| --- | --- | --- | --- | --- |
| Warning 1 (documentation 등) | plan 의 «20 subtests» 가 낡았다 — 두 번째 | 숫자를 **커밋에 묶은 스냅샷**으로만 적는다(`62eed299f` 7 · `647b60ad8` 15 · `5f8c1c472` 20 / 45 subtests). 살아 있는 숫자가 아니라 시점의 사실이라 다시 낡지 않는다 | — | (이 RESOLUTION 커밋) |
| Warning 2 (maintainability) | «정확히 하나» · 이미지 값 검사가 층마다 복제 | `_expect_one` · `_image_value` (+ `_dig` · `_seq`)로 각 검사가 **한 곳에만** 있다. 추출기는 배선만 | 헬퍼 뮤턴트 H1~H7 전부 KILLED | `5f8c1c472` |
| Warning 3 (testing) | k8s `_mapping` 호출 지점 3곳이 개별 미고정 | 호출 지점이 `_dig` 경로 한 번씩으로 줄었고, 배선은 추출기 수준 «비정상 모양» 테스트(metadata 리스트 · spec 리스트 · containers 매핑 · **containers 스칼라**)가 고정 | 배선 뮤턴트 W1~W6 전부 KILLED. 스칼라 서브테스트는 W4(`_seq` 우회)를 가르는 **유일한** 입력이라 따로 넣었다 | `5f8c1c472` |

## INFO 처분

- **INFO 1**(64 매직 넘버) — `SHA256_HEX_LEN` 상수로.
- **INFO 2**(대문자 hex 무검증) — 거부 경계 케이스 추가(OCI 명세상 소문자).
- **INFO 4**(`$` 가 뒤따르는 개행을 통과) — `fullmatch` 로 바꾸고 개행 경계 추가. 뮤턴트 P3(`match` 로 되돌림)이 RED.
- **INFO 3**(중복 리소스 테스트가 픽스처를 손으로) · **INFO 5 · 6 · 7** — 조치 불요(각 reviewer 판정).

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: `codebase/**` 무변경. 검증은 하네스 pytest(CLAUDE.md).
- `test_minio_image_parity.py` — `5f8c1c472` 에서 20 passed · 45 subtests.
- 전수 뮤턴트 16개 — 전부 KILLED(plan §B-3). 하네스 전체 · docs 가드는 이 커밋 직전 실행.
