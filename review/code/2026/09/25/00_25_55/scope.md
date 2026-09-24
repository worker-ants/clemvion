# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 핵심 변경은 요청 범위(`plan/in-progress/minio-image-parity-guard.md` — MinIO 이미지 6곳 일치 가드)에 정확히 부합
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체(178줄, 신규), `.claude/tests/README.md:48`(카탈로그 1행), `.github/workflows/harness-checks.yml:92-98`(pathspec 3파일 등재+주석)
  - 상세: 신규 가드가 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml` 3개 매니페스트 자체는 건드리지 않고 **읽기만** 한다(이미지 값 변경은 선행 커밋 `#1392`에서 이미 끝남). `test_minio_image_parity.py` 안의 클래스는 `ExtractorBoundaryTest`(추출기 경계 3건)와 `MinioImageParityTest`(일치·고정·distroless 4건)만 있고, plan §A에서 예고한 4개 단언 이상으로 확장된 기능은 없다. `harness-checks.yml`의 diff도 3개 pathspec 파일 + 주석 7줄 추가뿐, 기존 항목 포맷팅 변경이 섞여 있지 않다. `CHANGELOG.md`·`.claude/tests/README.md`도 각각 신규 섹션/신규 행 순수 추가로, 기존 문구를 건드리지 않았다.
  - 제안: 해당 없음(정상 범위).

- **[WARNING]** `plan/in-progress/self-hosting-deployment.md`에 이미지 패리티 가드와 무관한 "아바타 버킷 공개 정책" 기술 노트가 함께 삽입됨
  - 위치: `plan/in-progress/self-hosting-deployment.md:57-61` (신규 blockquote — `> **2026-09-25 보탬 — 버킷 생성만으로는 부족하다.** 아바타 공개 정책...`)
  - 상세: 같은 diff에 두 종류의 삽입이 섞여 있다. (a) 줄 62-65: "이 파일이 오브젝트 스토리지 이미지를 쓰면 가드 자리 목록·pathspec에 추가"라는 체크박스 — 이번 가드가 미래 매니페스트를 놓치지 않도록 하는, 과제와 직접 연관된 항목. (b) 줄 57-61: `scripts/minio/avatars-public-read.json`을 `mc anonymous set-json`으로 적용해야 하는 "아바타 공개 정책"이 배포 선행 조건이라는 구체적 기술 노트 — 이는 이미지 문자열 일치(image parity)와 무관한 별개 주제(버킷 ACL 정책)다. plan `minio-image-parity-guard.md` §D의 W3 처분란에 "같은 §3의 «버킷 자동 생성» 줄이 아바타 공개 정책을 빠뜨린 것도 함께 적었다"고 투명하게 밝히고는 있으나, 이는 이번 작업(이미지 문자열 patiry 가드)의 스코프를 벗어난 별도 발견 사항을 같은 커밋에 실질 내용(구체적 파일명·명령어)까지 채워 넣은 것이라 "의도 이상의 변경"에 해당한다. 코드가 아닌 미착수 plan 문서 주석이라 실질 리스크는 낮지만, 리뷰 대상 diff의 경계를 흐린다.
  - 제안: 코드 리스크는 없으므로 차단할 사안은 아니나, 향후에는 "발견했지만 이번 스코프 밖"인 항목은 체크박스 한 줄(트리거만)로 등록하고 구체적 기술 내용은 해당 항목이 실제 착수될 때 채우는 편이 이번 PR의 스코프(이미지 patiry)와 self-hosting-deployment의 스코프를 더 깔끔히 분리한다.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이번 작업과 무관한 `spec/0-overview.md §8` 넘버링 불일치 백로그 항목 추가
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5860-5865`
  - 상세: `--impl-prep` consistency-check(W2)가 지적한 `spec/0-overview.md §8` "알파벳 순 숫자 prefix" 서술이 실측(`data-flow/13~15`)과 다르다는 발견을 직접 고치지 않고 별도 트래커에 백로그로 등재했다. 이는 CLAUDE.md의 "developer는 spec 변경 시 멈추고 project-planner에게 위임" 규약을 그대로 따른 것이고, plan `minio-image-parity-guard.md` §D에도 처분 근거가 명시돼 있어 절차상 정상이다. 다만 diff 자체만 보면 "MinIO 이미지 patiry 가드" PR에 완전히 무관한 주제(spec 문서 번호 체계)의 백로그 항목이 섞여 들어가 있다는 점은 스코프 리뷰 관점에서 기록해 둘 만하다.
  - 제안: 조치 불요(정상 프로세스). 다만 이런 부수 발견이 계속 쌓이면 별도의 "impl-prep 부수 발견 로그" 파일로 분리하는 것도 고려할 만하다(강제 아님).

- **[INFO]** `review/consistency/2026/09/25/00_08_35/**` 8개 신규 파일은 `--impl-prep` 의무 실행의 표준 산출물
  - 위치: `review/consistency/2026/09/25/00_08_35/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`
  - 상세: CLAUDE.md가 "developer는 구현 착수 직전 `consistency-check --impl-prep` 의무"라 규정하므로, 이 8개 파일은 요청 범위를 벗어난 추가 수정이 아니라 필수 절차의 자연스러운 부산물이다.
  - 제안: 해당 없음.

## 요약
핵심 변경(신규 harness 가드 `test_minio_image_parity.py` + `harness-checks.yml` pathspec 3줄 + `README.md`/`CHANGELOG.md` 카탈로그·항목)은 plan에서 예고한 범위와 정확히 일치하고, 대상 매니페스트 3개(`docker-compose*.yml`, `infra-minio.yaml`) 자체는 건드리지 않았으며, 불필요한 리팩토링·포맷팅 혼입·미사용 임포트·기능 확장은 발견되지 않았다. 다만 `self-hosting-deployment.md`에 이미지 patiry와 무관한 "아바타 버킷 공개 정책" 구체 기술 노트가 같은 커밋에 섞여 들어간 점(WARNING)과, 별도 트래커에 무관한 spec 넘버링 백로그가 추가된 점(INFO, 절차상 정상)은 diff 경계를 다소 흐리지만 코드 리스크는 없다.

## 위험도
LOW
