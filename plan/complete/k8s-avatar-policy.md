---
title: k8s 로컬 오버레이의 버킷 Job 에 아바타 공개 정책을 건다
status: complete
owner: developer
worktree: k8s-avatar-policy
spec_impact: none
started: 2026-09-25
completed: 2026-09-25
---

# 두 compose 는 정책을 거는데 k8s 오버레이만 안 건다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목 «k8s 로컬 오버레이의 버킷
Job 이 아바타 공개 정책을 걸지 않는다»(낮음)를 닫는다. `#1392` 가 이미지를 바꾸다 발견해 등재했다.

`k8s/overlays/local/infra-minio.yaml` 의 Job `minio-create-bucket` 은 `mc mb` 만 한다. 두 compose 의
`createbuckets` 는 `#1258`(아바타 업로드)이 `mc anonymous set-json /policy/avatars-public-read.json` 을 넣었다.
`scripts/minio/README.md` 가 이 정책을 아바타 업로드의 **배포 선행 조건**이라 적는다 — 없으면 업로드는 성공하고
**이미지만 403** 이다. `spec/0-overview.md` §5 «두 배포 방식 모두 동일한 기능을 제공» 과도 어긋난다.

## A. 착수 전 실측

| 확인 | 실측 |
| --- | --- |
| k8s Job 이 정책을 거나 | **안 건다** — `mc alias set` 대기 루프 뒤 `mc mb --ignore-existing local/"$S3_BUCKET"` 한 줄 |
| 버킷 이름의 출처 | Job 은 `$S3_BUCKET`(base configmap `workflow-storage`, 바꿀 수 있는 값)을 쓴다. 정책 파일은 `arn:aws:s3:::workflow-storage/avatars/*` 로 **하드코딩** |
| kustomize 로 저장소 루트의 정책 파일을 ConfigMap 으로 가져올 수 있나 | **없다** — `configMapGenerator.files` 가 오버레이 밖 파일을 `security; file … is not in or below …` 로 거부(실측, scratch kustomization) |

## B. 처방

**Job 스크립트 안에서 정책을 heredoc 으로 만들고 `$S3_BUCKET` 을 대입해 `set-json` 한다.**

- 정책 파일을 오버레이로 **복사**하는 안은 버렸다: 버킷 이름이 하드코딩된 두 번째 사본이 생겨 `S3_BUCKET` 을
  바꾸면 정책이 엉뚱한 버킷을 가리킨다. heredoc 은 Job 이 쓰는 그 변수를 그대로 쓴다.
- `set download` 프리셋은 쓰지 않는다 — 목록까지 연다(README 의 실측).
- 스크립트에 `set -e` — 정책 적용이 실패하면 Job 이 실패해 재시도(`backoffLimit`)되게. 지금은 마지막 명령의
  종료 코드만 Job 상태가 되므로, 정책 줄을 더하면 그 앞 `mb` 의 실패가 가려질 수 있다. (대기 루프의 `until` 조건은
  `set -e` 에 걸리지 않는다.)

**drift 가드** — 정책이 두 벌(원본 JSON · Job heredoc)이 되므로 하네스 테스트로 묶는다:
`.claude/tests/test_minio_bucket_policy_parity.py` 가 렌더 전 매니페스트에서 Job 스크립트의 heredoc 을 꺼내
`$S3_BUCKET` 을 base configmap 값으로 대입한 뒤 `json.loads` 해 원본 파일과 **의미상 같음**을, 그리고 어느 쪽에도
`s3:ListBucket` 이 **없음**을 단언한다. 원본을 고치면(문장 추가 등) k8s 쪽이 RED 가 된다.

## C. 동작 실측 계획

`kubectl kustomize` 로 렌더한 매니페스트에서 Job 의 `args` 를 **그대로** 꺼내, `minio` 라는 이름의 silo 서버를 띄운
docker 네트워크에서 같은 이미지로 실행한다. 판정은 compose 와 같은 셋: 익명 목록 403 · avatars GET 200 · 그 밖 403.
대조군: 정책 줄을 뺀 옛 스크립트면 avatars GET 이 403.

### C-2. 실측 결과 (2026-09-25)

렌더한 매니페스트에서 Job `args` 를 그대로 꺼내(`command == ["sh","-c"]` 확인) `minio` 별칭의 silo 서버가 있는
docker 네트워크에서 같은 이미지로 실행했다(env 는 overlay secret · base configmap 값).

| 스크립트 | Job | 익명 목록 | avatars GET | 그 밖 GET | 판정 |
| --- | --- | --- | --- | --- | --- |
| 옛 스크립트(대조군, main) | exit 0 | 403 | **403** | 403 | FAIL — 결함 재현 |
| 새 스크립트 | exit 0 · `Access permission … is set from /tmp/avatars-public-read.json` | 403 | **200** | 403 | **PASS** |
| 새 스크립트에서 구분자만 `<<'EOF'` | **exit 1** · `bucket name does not match` | 403 | 403 | 403 | FAIL(시끄럽게) |

> **셋째 줄이 내 초안을 반증했다.** 가드 docstring 초안은 따옴표 구분자면 «오류 없이 적용되고 아무것도 보호하지
> 않는다» 고 적었다. 실제로는 silo 가 `${S3_BUCKET}` 이라는 이름의 버킷을 가리키는 정책을 **거부**하고 Job 이
> 실패한다 — 조용한 실패가 아니라 배포 시점의 시끄러운 실패다. 가드는 그것을 리뷰 시점으로 당긴다. 테스트를 쓰기
> 전에 쟀기에 docstring 에 거짓 근거가 들어가지 않았다.

## D. 체크리스트

- [x] `/consistency-check --impl-prep` — **구현 전에** → `review/consistency/2026/09/25/08_20_57` **BLOCK: NO ·
      Warning 1 · INFO 5**. scope 는 `spec/0-overview.md` · `spec/2-navigation/9-user-profile.md` scratch 사본(두 본문
      5/5, `meta.json` 저장소 경로 + `scope_note`). 처분은 §E
- [x] Job 스크립트 — heredoc 정책 + `set-json` + `set -e`
- [x] drift 가드 테스트 + `harness-checks.yml` pathspec(원본 정책 파일) + `.claude/tests/README.md`. pathspec 을 넣기
      전 커버리지 테스트가 정책 파일 **하나만** 지목하며 RED(k8s 파일은 이미 등재) → 넣은 뒤 GREEN. 새 테스트 12개
      이름으로 실행 확인
- [x] 뮤턴트 — 가드가 원본 변경 · heredoc 변경 · ListBucket 추가를 각각 잡는가. 커밋 `80bfa4862` 뒤 11개(바이트코드
      끔, 앵커 1회 매칭 assert, `cp` 원복) — **전부 KILLED, 각자 의도한 테스트로**:
      데이터 D1 정책 파일에 ListBucket(→ 동일성 · ListBucket) · D2 heredoc 에 ListBucket(→ 동일성 · ListBucket) ·
      D3 heredoc 버킷 하드코딩(→ 변수 사용) · D4 `<<'EOF'`(→ unquoted) · D5 `set -e` 삭제(→ fail fast) ·
      D6 set-json 을 리터럴 버킷에(→ 같은 버킷 적용) · D7 `set download` 추가(→ 프리셋 금지) /
      추출기 E1 따옴표 미포착 · E2 인자 여럿 허용 · E3 비문자열 인자 허용 · E4 문자열 Action 을 글자로 쪼갬 — 각
      경계 테스트.
      **리뷰 1라운드 뒤 다시(`1367e14ee`)**: 추출기가 형제 가드 헬퍼로 바뀌어 배선이 새로 생겼으므로 15개로 재측정 —
      데이터 D1~D7 그대로 + 배선 W1 Job · W2 컨테이너 · W3 인자 · W6 heredoc 의 `_expect_one` 우회(첫 매치를 집게) ·
      W4 · W5 인자 값 검사의 두 절 + 판정 P1 · P2 — **전부 KILLED, 각자 의도한 테스트로**.
      **리뷰 2라운드 뒤(`fd3810242`)**: 경로 쌍 단언을 더해 17개 — D8(set-json 경로) · D9(cat 대상 경로) 추가, 전부 KILLED
- [x] 동작 실측 (§C) + 대조군 — 결과는 §C-2
- [x] `kubectl kustomize k8s/overlays/local` 렌더 확인
- [x] CHANGELOG 항목 (커밋 전 staged 확인)
- [x] `python3 -m pytest .claude/tests -q` 전체 · docs 가드 — 마지막 코드 커밋 `edaad558e` 뒤 **1173 passed**
- [x] `/ai-review` — **3라운드**. 1 `08_33_19`(W3: 중복 매치 · 헬퍼 미재사용 · README 적용 지점) · 2 `08_48_37`(W2:
      경로 쌍 · README 문구) · 3 `09_03_48`(W3, **전부 문서 · DRY** — 조치 후 종결). 4라운드를 안 돈 근거는 그 세션
      `RESOLUTION.md`(글자와 목적이 갈린 자리로 명시). 전수 뮤턴트는 라운드마다 다시 쟀고 마지막 20개 전부 KILLED
- [x] 트래커 항목 닫기 — 종결 메모 + 항목 안의 self-hosting 보탬은 그 plan §3 체크박스로 옮겼다(묻히지 않게)

## E. `--impl-prep` 처분

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | 새 가드 이름이 `test_minio_image_parity.py` 와 인접 — 두 가드가 같은 Job 을 다른 축으로 본다는 사실이 안 드러나면 «이미 하나가 다 본다» 는 오인 · pathspec 누락으로 이어진다 | **반영** — 새 가드 docstring 첫 단락에 «이미지 가드와 다른 축(정책)» 명시, `harness-checks.yml` 주석을 두 가드 · 두 축으로 다시 쓰고, README 카탈로그에 이미지 가드 행 **바로 아래** 대비 문장으로 배치 |
| INFO 2 | compose 는 `exit 0` 으로 정책 실패를 삼키고 k8s 는 `set -e` 로 실패시킨다 — 비대칭 | **기록** — Job 주석에 «두 compose 는 `exit 0` 으로 실패를 삼킨다 — 별 갭» 한 줄. compose 를 바꾸는 것은 이 PR 의 축이 아니다 |
| INFO 1 · 3 · 4 · 5 | `0-overview.md` §6.3 로드맵 온도차 · swagger 413 · 키 네이밍 convention · 새 pathspec | 이 plan 범위 밖(planner 후보) 또는 조치 불요 |
