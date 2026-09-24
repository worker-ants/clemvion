# 의존성(Dependency) 리뷰 — MinIO 이미지를 `pgsty/silo` 로

## 발견사항

- **[INFO]** 외부 이미지 벤더 교체: `minio/minio` + `minio/mc`(공식) → `pgsty/silo`(커뮤니티 포크) 단일 이미지
  - 위치: `docker-compose.yml:43`(minio 서버), `docker-compose.yml:63`(createbuckets) / `docker-compose.e2e.yml:69`, `docker-compose.e2e.yml:82` / `k8s/overlays/local/infra-minio.yaml:41`, `k8s/overlays/local/infra-minio.yaml:103`
  - 상세: 세 파일 모두 서버·클라이언트가 이제 **같은 이미지** `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46` 를 쓴다(리포에 남은 `sha256:635197...` 문자열을 grep 해 6곳 전부 리터럴 일치 확인, `quay.io/minio`·`minio/minio`·`minio/mc` 잔존 참조는 0건). 두 개였던 외부 이미지가 하나로 줄어 pull 대상이 감소한다. 교체 필요성은 명확하다 — Docker Hub `minio/*`(2026-09-12) 에 이어 quay.io `minio/*` 도 2026-09-24 401 로 닫혀 e2e/dev 가 상시 실패하는 상태였고, `plan/in-progress/minio-silo-image.md` 가 대안(`pgsty/minio` 마지막 릴리스, rclone 대체)을 실측 기반으로 기각한 근거를 남겼다.
  - 제안: 조치 불요 — 근거가 plan/CHANGELOG 양쪽에 기록되어 있고 필요성이 실측(401/404)으로 뒷받침된다.

- **[INFO]** 벤더 신뢰 축 자체가 반복 이동 중 — 12일 내 2차 폐쇄, 이번이 3번째 외부 벤더 노출
  - 위치: `plan/in-progress/minio-silo-image.md` §B, §F 항목 8 / `review/consistency/2026/09/24/23_12_45/SUMMARY.md` INFO #8
  - 상세: Docker Hub 공식 이미지(폐쇄) → quay.io 공식 이미지(폐쇄) → `pgsty/silo`(Docker Hub, 커뮤니티 포크)로 두 번째 벤더 전환이다. `pgsty/silo` 는 MinIO Inc. 가 아닌 Pigsty 커뮤니티가 유지하는 포크이고 여전히 단일 제3자 공개 레지스트리(Docker Hub)에 의존한다 — 다음 폐쇄가 오면 네 번째 대안을 또 찾아야 하는 구조는 그대로다. 이미 팀 자신이 이 사실을 인지하고 "세 번째 폐쇄 시 GHCR 미러링 재검토" 를 트래커에 등재해 뒀다(`minio-silo-image.md` §E 체크리스트 항목).
  - 제안: 추가 조치 불요(이미 등재됨). 다만 이 축이 이번 리뷰가 아니라 그 트래커에서 계속 추적되고 있는지만 확인.

- **[INFO]** 버전 고정 — 태그+다이제스트로 정확히 고정, 전 6개 지점 리터럴 일치
  - 위치: `docker-compose.yml:43,63`, `docker-compose.e2e.yml:69,82`, `k8s/overlays/local/infra-minio.yaml:41,103`
  - 상세: `RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46` 문자열이 세 파일 여섯 곳에서 문자 그대로 동일함을 `grep -rn` 으로 확인했다. Docker Hub 태그는 가변이라는 점을 인지하고 다이제스트까지 고정한 것은 모범적이며, `plan/complete/e2e-minio-registry.md` 가 남긴 후속 항목("k8s `:latest` → RELEASE 고정")도 이번에 함께 닫혔다(같은 파일에서 `[x]` 로 갱신 확인).
  - 제안: 없음 — pinning 관점에서 우수 사례.

- **[INFO]** 라이선스 — AGPL-3.0, 기존과 동일 (라이선스 변경 아님)
  - 위치: `CHANGELOG.md`(Unreleased 섹션), `plan/in-progress/minio-silo-image.md` §B
  - 상세: `pgsty/silo` 는 원본 MinIO 서버와 동일하게 AGPL-3.0 이라고 CHANGELOG·plan 문서에 명시돼 있다. 원래 `minio/minio` 역시 AGPL-3.0 이었으므로 이번 교체로 라이선스 조건이 바뀌지 않는다. 이 저장소가 소비하는 방식은 이미지를 수정 없이 풀·구동하는 별도 네트워크 서비스이며(코드베이스에 정적/동적 링크되지 않음), AGPL 의 네트워크 카피레프트 조항이 요구하는 "수정 시 소스 공개" 의무를 촉발하는 수정도 관측되지 않는다. `docker-compose.yml`/`k8s/overlays/prod`·`staging` 을 grep 한 결과 이 이미지는 **local/e2e/dev 전용**이고 prod·staging 오버레이에는 등장하지 않아(별도 관리형 스토리지 추정) 배포 범위도 제한적이다.
  - 제안: 없음. 단, `rationale_continuity` checker 가 이미 INFO 로 낸 대로 spec 이 "MinIO" 를 벤더 불특정으로 서술하는 반면 실제는 포크라는 사실이 문서에 드러나지 않는 점은 spec 쪽 각주감이나 이번 PR 강제 대상은 아니다.

- **[INFO]** 공급망 검증(provenance/vulnerability scan) 부재 — 다이제스트 고정은 재현성만 보장, 신뢰성 검증은 수동 1회
  - 위치: `plan/in-progress/minio-silo-image.md` §B, §E (체크리스트에 이미지 서명 검증·취약점 스캔 항목 없음)
  - 상세: sha256 다이제스트 고정은 "그 바이트가 다음에도 그대로 pull 된다" 는 무결성만 보장하고, "그 바이트를 만든 주체가 신뢰할 만한가" 라는 공급망 신뢰(코사인 서명·SBOM·취약점 스캔)는 검증하지 않는다. plan 문서 자체가 앞선 quay 이동 건에서 "image ID 동일성을 1회 수동 확인했을 뿐 CI 가 강제하지 않는다" 고 인정했고, 이번 `pgsty/silo` 교체도 같은 패턴(수동 1회 확인, CI 강제 없음)이다. `pgsty/silo` 는 MinIO Inc. 의 공식/서명 이미지가 아닌 제3자 커뮤니티 빌드이므로, 다음 버전 업그레이드 시 이 수동 검증 단계가 누락되면 악의적이거나 손상된 이미지가 조용히 채택될 여지가 있다.
  - 제안: 필수는 아니지만, 향후 이미지 태그를 올릴 때 Trivy/Grype 등으로 알려진 CVE 를 1회 스캔하는 절차를 `docker-compose*.yml` 주석 또는 후속 트래커에 명문화하는 것을 권장. 이번 PR 을 차단할 사유는 아님(dev/e2e 전용 범위 + 기존에도 동일 수준의 신뢰 모델이었음).

- **[INFO]** 불필요한 의존성/내부 의존성 — 해당 없음
  - 상세: 이번 diff 는 `package.json`/lockfile 변경이 없고, 코드 레벨 라이브러리 추가도 없다. 순수 컨테이너 이미지 참조 교체(인프라 설정)이며 표준 라이브러리로 대체할 성격의 변경이 아니다. 내부 모듈 간 의존 관계에도 영향 없음(코드 미변경).

## 요약

이번 변경은 새 npm/pip 등 코드 레벨 의존성이 아니라 e2e/dev 인프라의 컨테이너 이미지 교체다. 필요성(Docker Hub·quay.io 양쪽에서 공식 `minio/*` 이미지가 401/404 로 막혀 CI 전체 e2e 가 죽은 상태)은 실측으로 충분히 뒷받침되고, 태그+다이제스트 고정을 세 파일 여섯 곳에 리터럴 일치하도록 적용해 버전 고정 관점에서는 모범적이다. 라이선스도 원본과 동일한 AGPL-3.0 이라 변경이 없고, 배포 범위도 local/e2e/dev 로 한정되어(prod/staging 오버레이에는 이 이미지가 없음) production 의존성 표면에 영향을 주지 않는다. 다만 (1) 공식 벤더에서 제3자 커뮤니티 포크로의 신뢰 축 이동이 12일 내 두 번째로 발생했고 — 이는 이미 팀이 자체적으로 트래커에 재발 시 GHCR 미러링 재검토를 등재해 인지하고 있으며, (2) 새 이미지에 대한 자동화된 취약점 스캔/서명 검증 없이 수동 1회 확인에 의존한다는 점은 향후 업그레이드 시 누락 위험이 있어 참고용으로 남긴다. 두 사항 모두 이번 PR 을 차단할 정도는 아니다.

## 위험도

LOW
