# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** CHANGELOG 가 다이제스트를 축약 표기(`sha256:635197cb…`)해 실제로 고정된 전체 64-hex 값과 다르다
  - 위치: `CHANGELOG.md:13`
  - 상세: 세 인프라 파일(`docker-compose.yml:43`, `docker-compose.e2e.yml:69,82`, `k8s/overlays/local/infra-minio.yaml:41,103`)은 전부
    `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46` 로 동일하게 못박혀 있는데,
    CHANGELOG 는 앞 8자만 남기고 생략했다. `plan/complete/e2e-minio-registry.md` 의 이전 항목(`sha256:6c83c74c8028…`)도 같은 축약 스타일이라
    이 저장소의 기존 관례이므로 결함은 아니다 — 다만 독자가 CHANGELOG 만 보고 정확한 다이제스트를 검증하려면 해당 값을 다시 찾아야 한다.
  - 제안: 필요하면 "전체 값은 `docker-compose.yml` 참고" 정도의 포인터를 덧붙이는 선택지가 있다(강제 아님).

- **[INFO]** spec (`spec/0-overview.md`) 이 "MinIO" 를 벤더 이름으로만 서술하고 실제 이미지가 커뮤니티 포크(`pgsty/silo`)라는 사실은 드러나지 않는다
  - 위치: `spec/0-overview.md` §2.7 (본 diff 에는 포함되지 않음)
  - 상세: 이 갭은 이번 작업 자체가 돌린 `--impl-prep` consistency-check(`review/consistency/2026/09/24/23_12_45`)의 `rationale_continuity` INFO #1 로 이미 잡혔고,
    `plan/in-progress/minio-silo-image.md` §F #1 에서 "spec 은 역할(S3 호환 셀프호스팅 스토리지)을 서술하고 포크라는 사실은 compose 주석이 SoT" 라는 근거로
    **의도적으로 유예**하기로 결정·기록돼 있다. 새 결함이 아니라 이미 처분된 항목이라 참고용으로만 남긴다.
  - 제안: 조치 불요(이미 dispositioned). 재지적 대상 아님.

- **[INFO]** `docker-compose.e2e.yml` / `k8s/overlays/local/infra-minio.yaml` 의 이미지 주석이 근거 전문을 담지 않고 `docker-compose.yml` 의 `minio` 주석을 SoT 로 지목하는 체인 구조다
  - 위치: `docker-compose.e2e.yml:66-68`, `k8s/overlays/local/infra-minio.yaml:38-40`
  - 상세: 세 파일이 같은 이미지·같은 다이제스트를 쓰므로 중복 대신 "근거는 dev compose 주석 참조" 로 단일 진실 지점화한 것은 이 PR 이전부터 있던 패턴(예: 옛
    "레지스트리 사유는 위 minio 컨테이너 주석 참조")을 그대로 계승한 좋은 관례다. 세 파일의 다이제스트 문자열을 직접 대조한 결과 완전히 동일해 drift 는 없다.
  - 제안: 없음 — 결함이 아니라 좋은 사례로 기록.

- **[INFO]** CHANGELOG 제목과 plan 제목의 표현이 다르다("quay.io 도 닫혔다" vs "비공개가 됐다")
  - 위치: `CHANGELOG.md:3`, `plan/in-progress/minio-silo-image.md:2`
  - 상세: 의미상 모순은 없고 자연스러운 패러프레이즈 수준이다.
  - 제안: 조치 불요.

## 요약

이번 변경은 인프라 이미지 교체(MinIO → `pgsty/silo`)라는 작지 않은 리스크의 변경임에도 문서화가 모범적이다. CHANGELOG 항목은 증상·근본 원인(quay.io 도 닫힘)·조치 범위(3곳)·호환성 실측·기각된 대안까지 기존 CHANGELOG 스타일(`## Unreleased — <제목>` 플랫 스택)에 맞춰 충실히 기록했다. `plan/in-progress/minio-silo-image.md` 는 실측 표·대안 비교·범위 산정·체크리스트·`--impl-prep` INFO 처분까지 갖춘 완결된 작업 기록이며, 세 인프라 파일(`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml`)의 인라인 주석은 다이제스트까지 포함해 세 곳 모두 정확히 일치하고, e2e/k8s 쪽은 dev compose 주석을 단일 진실 지점으로 지목해 중복 없이 체인 참조하는 기존 관례를 그대로 계승했다. `plan/complete/e2e-minio-registry.md`(완료 문서 체크박스 갱신)와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(반증된 "재검토 불요" 문구를 취소선 처리)도 이번 diff 안에서 이미 갱신돼, `--impl-prep` 컨시스턴시 체커가 낸 INFO #6·#7(추적 누락 위험) 권고를 스스로 선반영한 상태다. README·`k8s/README.md`·`scripts/minio/README.md` 는 이미지 벤더·레지스트리를 서술하지 않는 역할-수준 문서라 이번 이미지 교체로 갱신이 필요한 대목이 없음을 확인했다. CRITICAL/WARNING 급 문서화 결함은 발견되지 않았고, 위에 남긴 INFO 는 전부 기존 관례 확인이거나 이미 처분된 항목의 참고 기록이다.

## 위험도

NONE
