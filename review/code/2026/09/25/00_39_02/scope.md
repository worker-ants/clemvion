# 변경 범위(Scope) 리뷰 — MinIO 이미지 일치 가드 (2라운드)

## 검토 범위

`main` 대비 누적 diff 26개 파일. 핵심 변경(`.claude/tests/test_minio_image_parity.py` 신규 +
`.claude/tests/README.md` 카탈로그 1행 + `.github/workflows/harness-checks.yml` pathspec 3줄 + 주석 +
`CHANGELOG.md` 항목 + `plan/in-progress/minio-image-parity-guard.md` 신규)와, 그로부터 파생된 두 plan 갱신
(`self-hosting-deployment.md`, `spec-draft-nullable-notation-followups.md`), 그리고 이번 작업 자체가 낳은
절차 산출물(`review/code/2026/09/25/00_25_55/**` 1라운드 리뷰, `review/consistency/2026/09/25/00_08_35/**`
impl-prep 결과)까지 포함한다. `codebase/**` 변경은 없다.

## 발견사항

- **[INFO]** 핵심 변경은 요청 범위(`plan/in-progress/minio-image-parity-guard.md` — MinIO 이미지 6곳 일치
  가드)에 정확히 부합
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체(신규, 206줄), `.claude/tests/README.md:48`(카탈로그
    1행), `.github/workflows/harness-checks.yml:92-98`(pathspec 3파일 등재 + 주석)
  - 상세: 대상 매니페스트 3개(`docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`)
    자체는 이번 diff에서 건드리지 않고 **읽기만** 한다(이미지 값 자체를 바꾸는 것은 선행 `#1392`에서 끝났다).
    `harness-checks.yml`의 diff는 3개 pathspec 파일 등재 + 주석 7줄 추가뿐, 기존 항목 재포맷이 섞여 있지
    않다. `CHANGELOG.md`·`README.md`도 신규 섹션/신규 행 순수 추가로 기존 문구를 건드리지 않았다. 임포트는
    `re`/`unittest`/`yaml`/`_harness.REPO_ROOT`만 사용하고 전부 실사용된다(미사용 임포트 없음).
  - 제안: 해당 없음(정상 범위).

- **[INFO]** `plan/in-progress/self-hosting-deployment.md`의 "아바타 공개 정책" 병기 항목 — 1라운드
  WARNING 3 이 이미 조치되어 지금은 한 줄 체크박스로 축소돼 있음
  - 위치: `plan/in-progress/self-hosting-deployment.md:57-58`
  - 상세: 1라운드 scope 리뷰(`review/code/2026/09/25/00_25_55/scope.md`)는 이 항목이 이미지 patiry 가드와
    무관한 주제(버킷 ACL)를 구체적 파일명·명령어(`avatars-public-read.json`, `mc anonymous set-json`)까지
    채워 넣었다고 WARNING 처리했다. `RESOLUTION.md`(Warning 3 row)에 따라 그 세부는 삭제되고 기존 문서
    `scripts/minio/README.md`(신규 아님 — `git log` 확인 결과 `#1258`에서 이미 존재)를 가리키는 한 줄 +
    "같은 누락이 k8s 로컬 오버레이에 있다"는 백로그 포인터로 축소됐다. 여전히 image-parity 가드와는 다른
    주제(버킷 ACL vs 이미지 문자열)를 같은 체크리스트 항목 옆에 병기하지만, 이번 작업 중 우연히 같은 줄에서
    발견한 인접 갭을 트리거-only 로 기록한 형태라 CLAUDE.md의 "실질 내용을 채우지 말고 체크박스만" 관행에
    부합한다. 코드 변경이 아니고 이미 최소화됐으므로 조치 불요.
  - 제안: 해당 없음(1라운드 WARNING 은 해소됨).

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 작업과 무관한
  `spec/0-overview.md §8` 넘버링 불일치 백로그 항목 추가
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5860-5866`
  - 상세: `--impl-prep` consistency-check(W2)가 지적한 실측 결과(`ls spec/data-flow | sort -n`: 13~15가
    알파벳순이 아님)를 developer 가 직접 고치지 않고 planner 소관 트래커에 백로그로만 등재했다. CLAUDE.md의
    "developer 는 spec 변경 필요 시 멈추고 project-planner 위임" 규약을 그대로 따른 절차적으로 정상인
    부수 기록이며, 코드·설정 변경이 전혀 없다.
  - 제안: 조치 불요(정상 프로세스).

- **[INFO]** `review/code/2026/09/25/00_25_55/**`(8파일) + `review/consistency/2026/09/25/00_08_35/**`
  (8파일)는 이번 작업 워크플로 자체가 요구하는 필수 산출물
  - 위치: 위 두 디렉터리 전체
  - 상세: CLAUDE.md가 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무" + "구현 완료 후
    `/ai-review` 는 상시 승인된 강제 의무"라 규정하고, `review/**`는 개발자 쓰기 권한 안에 있다. 요청 범위를
    벗어난 추가 수정이 아니라 표준 절차의 자연스러운 산출물이다. `_retry_state.json`의 절대경로가 워크트리
    고유 경로를 담고 있는 점은 기존 관례와 동일한 패턴(이전 라운드 INFO 13과 동일 관찰)이라 별도 지적하지
    않는다.
  - 제안: 해당 없음.

- **[INFO]** `git status --short` — 이번 라운드 세션이 새로 쓴 `review/code/2026/09/25/00_39_02/`(본
  리뷰 산출물) 외 잔여물 없음. 뮤테이션 테스트 관련 백업/임시 파일이 저장소 트리에 남아 있지 않음을 확인.

## 요약

핵심 변경(`test_minio_image_parity.py` 신규 + `harness-checks.yml` pathspec 3줄 + `README.md`/`CHANGELOG.md`
갱신)은 plan에서 예고한 범위와 정확히 일치하고, 대상 매니페스트 3개 자체는 건드리지 않았으며, 불필요한
리팩토링·포맷팅 혼입·미사용 임포트·기능 확장은 없다. 1라운드에서 지적된 유일한 WARNING(`self-hosting-
deployment.md`에 무관한 기술 세부가 섞인 점)은 커밋 `c8a1a59b6`에서 한 줄 체크박스 + 기존 문서 포인터로
축소되어 실측상 해소됐다. `spec-draft-nullable-notation-followups.md`의 무관한 백로그 항목과 두 라운드의
리뷰 산출물 커밋은 모두 CLAUDE.md가 규정하는 정상 절차의 부산물이며 코드 리스크가 없다. `codebase/**`
변경이 전혀 없어 프로덕션 동작에 미치는 스코프 위험도 없다.

## 위험도
LOW
