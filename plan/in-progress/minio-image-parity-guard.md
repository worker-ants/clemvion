---
title: MinIO 계열 이미지 참조 6곳의 일치를 하네스 테스트로 고정한다
status: in-progress
owner: developer
worktree: minio-image-parity-guard
spec_impact: none
started: 2026-09-25
---

# 같은 이미지 문자열이 여섯 번 손으로 적혀 있다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«MinIO 계열 이미지 참조 6곳이 서로 같은지 아무것도 보지 않는다»(낮음)를 닫는다. 등재 근거는
`/ai-review` `review/code/2026/09/24/23_33_07` INFO 3 이다.

`#1392` 가 MinIO 이미지를 `pgsty/silo` 로 바꾸면서 **같은 `이름:태그@다이제스트` 문자열**이
세 파일 여섯 자리에 들어갔다:

| 파일 | 자리 |
| --- | --- |
| `docker-compose.yml` (dev) | `services.minio.image` · `services.createbuckets.image` |
| `docker-compose.e2e.yml` | 같은 두 자리 |
| `k8s/overlays/local/infra-minio.yaml` | StatefulSet `minio` 의 컨테이너 `minio` · Job `minio-create-bucket` 의 컨테이너 `mc` |

**부분 반영은 실제로 일어났다.** `#1325`(quay.io 이전)는 두 compose 만 고치고 k8s 두 자리를
놓쳤다가 리뷰에서 잡혔다. compose 와 kustomize 는 변수를 공유할 방법이 없어 SoT 를 하나로 모을 수
없다 — 그래서 **일치를 검사**한다.

## A. 설계

`.claude/tests/test_minio_image_parity.py` — 세 파일을 **YAML 파서**(`yaml.safe_load` /
`safe_load_all`)로 읽는다. YAML 은 정본 파서가 있는 문법이라 정규식으로 `image:` 줄을 긁지 않는다
(메모리 «정적 가드: blind 정규식 vs 정밀 파서» — 대상에 진짜 문법 + 정본 파서가 있으면 파서가 이긴다).
PyYAML 은 harness CI 의 유일한 허용 의존성이다(`harness-checks.yml` 머리 주석).

단언(각각 이름 있는 회귀 형태):

1. **선언된 자리 목록이 여섯에서 줄지 않는다** — ~~서비스 · 컨테이너가 사라지거나 이름이 바뀌면 «어느 자리를
   못 찾았는지» 를 말하며 실패한다.~~ (§B M3 가 반증: 파일에서 자리가 빠지는 경우는 추출기가 `PlaceNotFound` 로
   먼저 잡는다 — 이 단언이 따로 막는 것은 목록을 줄이는 편집이다.) 공허하게 «0개가 서로 같다» 로 통과하지 않는다.
2. **여섯 값이 같다** — 다르면 자리별 값을 모두 보여 준다.
3. **태그 + 다이제스트로 고정** — `@sha256:<64 hex>` 가 있고 태그가 `latest` 가 아니다(W-59 ·
   `#1392` 주석의 결정).
4. **`-distroless` 가 아니다** — compose 헬스체크가 이미지 안 `curl` 을 쓴다. `#1392` 가 실측으로
   적은 함정이다.

**트리거**: 이 테스트가 모듈 수준 경로 상수로 세 파일을 선언하면
`test_harness_checks_paths_coverage.py` 가 그 파일들을 `harness-checks.yml` pathspec 에 등재하라고
요구한다(k8s 는 `PRODUCT_PREFIXES` 밖). **등재가 없으면 compose 만 바꾼 PR 에서 이 가드가 안 돈다**
— `#1390` 이 닫은 «가드가 검사하는 데이터가 가드를 트리거하지 않는다» 와 같은 실패 클래스다.
세 파일을 개별 pathspec 으로 넣는다(`k8s/**` 로 넓히면 무관한 매니페스트 변경마다 하네스가 돈다).

## B. 뮤턴트 — 예측을 먼저 적는다

커밋 후 대상 파일을 `cp` 로 백업하고 치환 스크립트(앵커 정확히 1회 매칭 assert)로 대입한다.

| 뮤턴트 | 편집 | 예측 | 실측 |
| --- | --- | --- | --- |
| M1 | k8s Job 이미지만 `quay.io/minio/mc:latest` 로 (#1325 형태) | 단언 2(일치) RED, 3(고정)도 RED | **일치** — 단언 2 RED · 단언 3 은 **Job 자리 서브테스트 하나만** RED |
| M2 | 여섯 자리 모두 다이제스트 제거(서로는 같음) | 단언 2 GREEN · 단언 3 RED | **일치** — 단언 2 GREEN · 단언 3 서브테스트 **여섯 자리 모두** RED |
| M3 | e2e compose `createbuckets` 의 `image` 키 삭제 | 단언 1 RED(자리를 명시) | **예측과 다르다** — `MinioImageParityTest` 네 단언이 **모두** RED. 추출이 `setUp` 에 있어 `PlaceNotFound: docker-compose.e2e.yml: services.createbuckets.image not found` 가 모든 테스트를 실패시킨다. 자리를 이름으로 대는 것은 예측대로다 |
| M4 | harness-checks.yml 에서 k8s pathspec 한 줄 삭제 | `test_harness_checks_paths_coverage` RED | **일치** |
| M5 | 테스트의 `K8S_PLACES` 에서 Job 항목 삭제(선언 목록 축소) | (M3 뒤 추가) 단언 1 RED | **일치** — 단언 1 RED + 추출기 경계 테스트 `test_k8s_missing_container_is_named` RED, 두 곳이 독립적으로 잡는다 |

**M3 가 바꾼 이해 — 단언 1 이 실제로 막는 것.** 파일에서 자리가 빠지는 경우는 추출기가 먼저 잡으므로, «여섯 개를
찾았다» 단언이 따로 막는 것은 **선언된 자리 목록 자체를 줄이는 편집**이다(목록이 줄면 «모두 같다» 가 쉬워진다).
그래서 M5 를 추가해 그 역할을 실측했고, docstring · README · CHANGELOG 의 단언 1 서술을 그에 맞게 고쳤다.

**측정 방법**: 커밋 `62eed299f` 뒤, 다섯 파일(세 매니페스트 · 워크플로 · 테스트 자신)을 `cp` 로 백업하고 앵커가
정확히 1회(M2 는 6회) 매칭됨을 assert 하는 치환으로 대입했다. 러너는 `test_minio_image_parity.py` +
`test_harness_checks_paths_coverage.py`, 서브테스트 실패까지 보이게 `-rA`. 매 뮤턴트 뒤 `cp` 원복, 마지막에
`git status` 빈 것을 확인했다.

### B-2. 리뷰 뒤 분기 전수 (2026-09-25)

리뷰가 **두 라운드 연속 같은 형태를 한 칸씩 안쪽에서** 찾았다 — 1라운드 «리소스 수준 중복», 2라운드
«컨테이너 수준 중복». 자리를 하나씩 고치는 대신 추출기 · 판정의 분기를 전부 세고, 분기마다 그것을 뒤집는
뮤턴트가 **그 분기의 경계 테스트**를 RED 로 만드는지 쟀다(커밋 `69a5e22b9` 뒤, 치환 앵커 1회 매칭 assert,
`cp` 원복, `PYTHONDONTWRITEBYTECODE=1` + 매번 `.pyc` 삭제):

| # | 분기 | 뮤턴트 | RED 가 된 테스트 |
| --- | --- | --- | --- |
| B1 | 리소스 중복 | `len(matches) != 1` → `< 1` | `test_k8s_duplicate_resource_is_named` |
| B2 | 리소스 0 | → `> 1` | `test_k8s_missing_resource_is_named` |
| B3 | 컨테이너 중복 | `len(named) != 1` → `< 1` | `test_k8s_duplicate_container_is_named` |
| B4 | 컨테이너 0 | → `> 1` | `test_k8s_missing_container_is_named` |
| B5 · B7 | 빈 문자열 image (k8s · compose) | `or not image` 삭제 | `test_bad_image_value_is_named` |
| B6 · B8 | 비문자열 image (k8s · compose) | `isinstance(str)` 삭제 | `test_bad_image_value_is_named` |
| B9 | mapping 아닌 값 | `_mapping` → 항등 | `…malformed_service…` · `…missing_service…` |
| B10 | `latest` 태그 | 판정 삭제 | `test_pin_violation_edges` |
| B11 | distroless | 항상 `False` | `test_distroless_is_detected` |

> **첫 전수 실행은 무효였다.** B2 · B3 · B4 가 모두 B1 의 테스트로 죽었다고 나왔다. 수동으로 B3 만 돌리니
> 올바른 테스트가 죽었다 — 원인은 **오래된 `.pyc`**: 같은 길이 치환(`!= 1` → `< 1` → `> 1`)을 같은 초 안에
> 연달아 쓰면 소스 mtime · 크기가 같아 B1 의 바이트코드가 재사용된다. 위 표는 바이트코드를 끈 재실행이다.
> 앞 측정(§B 의 M1~M5 · 1라운드 뮤턴트 둘)은 YAML 만 바꿨거나 크기가 달라 이 함정 밖이다.

`None` 은 `not image` 와 `isinstance` 두 절에 **모두** 걸려 어느 쪽도 증명하지 못한다 — 그래서 빈 문자열과
숫자를 따로 넣는다(B5~B8). `latest` · distroless 판정은 실제 파일에만 적용되면 지워도 초록이므로
`pin_violation()` · `is_distroless()` 로 빼 주입 입력으로 고정했다(B10 · B11).

## C. 체크리스트

- [x] `/consistency-check --impl-prep` — **구현 전에** → `review/consistency/2026/09/25/00_08_35`
      **BLOCK: NO · Critical 0 · Warning 3 · INFO 5**. scope 는 `#1392` 와 같은 스토리지 spec 두 파일의 scratch
      사본(두 본문 5/5 적재 · `meta.json` 저장소 경로 + `scope_note`). 처분은 §D
- [x] 테스트 작성 + `harness-checks.yml` pathspec 3줄 + `.claude/tests/README.md` 카탈로그.
      **TDD 순서로 확인**: pathspec 을 넣기 전 `test_harness_checks_paths_coverage.py` 가 정확히 세 파일을 지목하며
      RED → 넣은 뒤 GREEN. 새 테스트 ~~7개~~ 는 이름으로 실행 확인 — 첫 커밋 시점 `-v` 7 passed, 리뷰
      1 · 2라운드 조치로 **15개**(2026-09-25, `pytest -q` 15 passed · 20 subtests — 2라운드 `/ai-review`
      documentation W2 가 7 이 낡았다고 짚었다)
- [x] 뮤턴트 M1~M5 실측 (표 §B) — M3 가 예측과 달랐고, 그것이 단언 1 의 서술을 고치게 했다(M5 추가)
- [x] CHANGELOG 항목 (가드 신설 = 항목, 커밋 전 staged 확인)
- [ ] `python3 -m pytest .claude/tests -q` 전체
- [ ] `/ai-review`
- [ ] 트래커 항목 닫기

## D. `--impl-prep` 처분

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | 규약 번들이 예산 초과로 핵심 conventions 를 떨군다 | **기존 항목에 해당** — 백로그 트래커 «`--impl-prep`/`--spec` 번들이 `spec/` 코퍼스를 통째로 절단한다»(2026-09-14)와 같은 결함. 새로 등재하지 않는다. 이번 변경은 API · 출력 포맷 규약을 다루지 않는다 |
| W2 | `spec/0-overview.md` §8 «알파벳 순 숫자 prefix» 가 13~15 와 맞지 않다 | **실측 후 등재**(planner) — `ls spec/data-flow | sort -n`: 1~12 는 알파벳순, 13~15 는 덧붙인 것. 이번 작업과 무관한 기존 drift |
| W3 | `self-hosting-deployment.md` 가 만들 새 매니페스트가 가드 목록에 반영될 길이 없다 | **반영** — 그 plan §3 · §4 에 «가드 자리 목록 · pathspec 에 추가» 체크박스, 가드 docstring · README 에 «새 매니페스트는 손으로 추가» 를 적었다. 같은 §3 의 «버킷 자동 생성» 줄이 아바타 공개 정책을 빠뜨린 것도 함께 적었다(k8s 누락과 같은 형태) |
| INFO 4 | 같은 k8s Job 을 다루는 별 항목(아바타 정책)과 상호 참조 | 위 W3 보탬에서 그 항목을 가리켰다. 그 항목이 Job 의 컨테이너 구조를 바꾸면 이 가드가 자리를 못 찾아 **이름을 대며** 실패한다 — 조용히 통과하지 않는다 |
| INFO 1 · 2 · 3 · 5 | frontmatter 부재 · 스코프 비중첩 · 긍정 관찰 · 명명 충돌 없음 | 조치 불요 |
