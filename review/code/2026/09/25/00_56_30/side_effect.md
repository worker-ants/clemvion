# 부작용(Side Effect) 리뷰

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 실제 변경 파일을 재확인함: 신규 하네스 테스트
(`.claude/tests/test_minio_image_parity.py`), CI pathspec 7줄 추가(`.github/workflows/harness-checks.yml`),
문서/카탈로그/CHANGELOG/plan 파일들. `codebase/**` (제품 코드) 변경은 없다 — 런타임 부작용의 표면 자체가
하네스·CI·문서로 국한된다.

## 발견사항

- **[INFO]** CI 트리거 표면이 파일 3개만큼 넓어짐 — MinIO 이미지와 무관한 수정도 하네스 스위트를 돈다
  - 위치: `.github/workflows/harness-checks.yml:92` (주석 시작) ~ `:98` (신규 pathspec 3줄:
    `docker-compose.yml` · `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml`)
  - 상세: 이 세 pathspec 이 `changes` 잡의 `relevant` 판정에 새로 걸리므로, 이미지 문자열과 무관하게
    (예: 포트 매핑·환경변수·볼륨 마운트만 바꾸는 PR 도) 이제 `unittest` 잡 전체(주석에 실측된 job 총
    566초, `timeout-minutes: 15`)가 트리거된다. 부작용이라기보다 **의도된 트레이드오프**이고, plan
    (`plan/in-progress/minio-image-parity-guard.md:94-95`, "A. 설계" 절)이 `k8s/**` 로 넓히지 않고 파일
    단위로 좁힌 이유를 명시적으로 적어 두었다 — 3파일이 6번 실측된 부분 반영 사고(`#1325`)의 발생 지점과
    정확히 일치하므로 범위 선택 자체는 타당하다.
  - 제안: 조치 불요. 다만 이 세 파일에 잦은 무관 수정이 몰리는 경우(예: dev-only 볼륨 마운트 튜닝) CI
    시간 비용이 누적될 수 있다는 점은 인지하고 있으면 된다 — 별도 조치 요청 아님.

- **[INFO]** 신규 테스트 모듈이 프로덕션 인프라 파일 3개를 읽음 — 읽기 전용, 하지만 새로운 파일시스템
  의존성
  - 위치: `.claude/tests/test_minio_image_parity.py` 의 `all_images()` (139-144번 줄) —
    `DEV_COMPOSE.read_text()` · `E2E_COMPOSE.read_text()` · `K8S_MINIO.read_text()`
  - 상세: 세 경로 모두 `read_text(encoding="utf-8")` 호출만 있고 쓰기·삭제·생성 경로는 없음. 순수 읽기이므로
    "예상치 못한 파일시스템 부작용"에는 해당하지 않는다. 다만 이 세 파일이 향후 이동/삭제되면 (예:
    `docker-compose.yml` 리네임) `PlaceNotFound` 가 아니라 처리되지 않은 `FileNotFoundError` 로 실패한다 —
    사이드이펙트가 아니라 견고성 이슈이므로 정보성으로만 남김.
  - 제안: 조치 불요(범위 밖).

- **[INFO]** 새 전역 상수는 모두 불변 리터럴이며 테스트 간 공유 가변 상태 없음
  - 위치: `.claude/tests/test_minio_image_parity.py:56-69` (`DEV_COMPOSE` · `E2E_COMPOSE` · `K8S_MINIO` ·
    `K8S_PLACES` · `COMPOSE_SERVICES` · `_PINNED`)
  - 상세: 전부 `Path`/`tuple`/컴파일된 정규식으로 모듈 로드시 1회 생성되고 이후 어디서도 재할당되지 않는다.
    `MinioImageParityTest.setUp` 은 매 테스트마다 `all_images()` 로 새 `dict` 를 만들어 `self.images` 에
    담을 뿐 클래스/모듈 레벨 가변 상태를 건드리지 않는다. `_mapping()` 도 매 호출마다 새 빈 `dict` 를
    반환하며 공유 mutable default 를 쓰지 않는다.
  - 제안: 조치 불요 — 부작용 관점에서 문제 없음, 긍정 확인 차 기록.

## 뮤테이션 테스트 프로세스 잔여물 확인

plan(`plan/in-progress/minio-image-parity-guard.md` §B, §B-2)이 서술한 절차는 `cp` 백업 → 치환 → `cp`
원복이며 "커밋 뒤" 매 라운드 실행을 주장한다. 저장소 트리 오염 여부를 직접 확인했다:
`git status --short` 결과 이번 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/25/00_56_30/`)만
untracked 로 잡히고, `.bak`/`.orig` 잔여 파일이나 다른 세션의 미커밋 변경은 없었다. 다른 reviewer 를
오염시킬 수 있는 뮤테이션 잔여물은 관측되지 않았다.

## 시그니처·인터페이스·환경변수·네트워크·이벤트

- 시그니처 변경: 없음 — 전부 신규 함수(`pin_violation` · `is_distroless` · `_mapping` · `compose_images` ·
  `k8s_images` · `all_images` · `_render`)이며 기존 함수/메서드의 시그니처를 바꾸지 않았다. 호출자 영향 없음.
- 공개 API 변경: 없음 — 신규 테스트 모듈은 공개 인터페이스가 아니다.
- 환경 변수: 읽기/쓰기 없음. `harness-checks.yml` 의 `pip install "pyyaml>=6,<7"` 스텝은 기존에 이미
  존재하던 스텝이며 이번 diff 로 새로 추가된 것이 아니다(위 pathspec 7줄 추가만이 diff).
- 네트워크 호출: 없음(로컬 YAML 파싱만).
- 이벤트/콜백: 해당 없음.

## 요약

이번 변경분은 `codebase/**` 를 건드리지 않는 하네스 테스트 + CI pathspec + 문서/plan 추가로, 런타임
부작용 표면 자체가 매우 좁다. 신규 코드는 세 인프라 파일을 읽기 전용으로 파싱할 뿐이고 전역 가변 상태·
시그니처·공개 API·환경변수·네트워크·이벤트 어느 축에서도 의도치 않은 변경이 없다. 유일하게 실질적인
"부작용"은 CI pathspec 확장이 세 파일에 대한 무관 수정까지 하네스 스위트를 트리거하게 만드는 것인데, 이는
plan 문서가 사전에 인지하고 파일 단위로 범위를 최소화한 의도된 트레이드오프다. 뮤테이션 테스트 절차가
저장소에 잔여물을 남기지 않았음도 `git status` 로 직접 확인했다.

## 위험도

LOW
