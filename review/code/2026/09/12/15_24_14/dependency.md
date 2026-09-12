# 의존성(Dependency) 리뷰

## 발견사항

- **[WARNING]** 같은 결함 클래스(Docker Hub `minio/*` 익명 pull 거부)를 가진 세 번째 위치가 이번 수정에서 빠졌다 — `k8s/overlays/local/infra-minio.yaml`
  - 위치: `k8s/overlays/local/infra-minio.yaml:38` (`image: minio/minio:latest`), `k8s/overlays/local/infra-minio.yaml:99` (`image: minio/mc:latest`) — 이 파일은 이번 diff 대상에 포함되지 않아 게이트 번호가 없으므로 실제 파일을 직접 열어 확인한 실제 소스 줄 번호를 기재함.
  - 상세: `plan/in-progress/e2e-minio-registry.md` 는 스스로 "레지스트리만 바꾼다... 한쪽만 고치면 다음 사람이 다시 진단한다" 는 이유로 `docker-compose.e2e.yml` 뿐 아니라 `docker-compose.yml`(dev) 까지 범위를 넓혔다. 그런데 `k8s/README.md` 가 문서화하는 세 번째 로컬 실행 경로(`docker-desktop/kind/minikube` 용 `overlays/local`)에도 정확히 같은 `minio/minio`·`minio/mc` 이미지가 Docker Hub 에서 그대로 남아 있고, 심지어 태그도 `latest` 라서 (a) 이 저장소 자신의 주석("`'latest'` 는 silent breaking change 위험")이 경고하는 안티패턴이며 (b) 이번 PR 이 진단한 것과 동일한 익명 pull 401/"pull access denied" 로 여전히 죽는다. "두 compose 파일 네 줄" 로 범위를 확정한 근거(스스로 제시한 완결성 원칙)가 이 세 번째 파일 앞에서 깨진다.
  - 제안: 같은 처분(quay.io 레지스트리 + 구체 RELEASE 태그 고정)을 `k8s/overlays/local/infra-minio.yaml` 에도 적용하거나, 범위에서 의도적으로 제외한다면 plan 문서에 그 사유(예: "k8s local overlay 는 현재 아무도 안 쓴다")를 실측과 함께 남긴다. 그렇지 않으면 다음 사람이 다시 이 진단을 반복한다 — 이 PR 이 막으려던 바로 그 상황.

- **[INFO]** 태그 고정은 유지되지만 다이제스트(`@sha256:...`) 고정은 아니다
  - 위치: `docker-compose.e2e.yml:68,81`, `docker-compose.yml:38,56`
  - 상세: 레지스트리 이전 자체는 태그(`RELEASE.2025-04-22T22-12-26Z`, `RELEASE.2025-04-16T18-13-26Z`)를 그대로 유지해 버전 고정 정책을 지킨다. plan 문서는 image ID(`sha256:6c83c74c8028…`, `sha256:0029bb25aef9…`)로 Hub 캐시본과 byte-동일함을 1회성으로 수동 검증했다고 기록했는데, 이는 재현성의 근거가 CI 에 강제되지 않고 그 순간의 로컬 검증에만 있다는 뜻이다. 레지스트리를 옮기는 시점은 "이 태그가 실제로 어떤 바이트를 가리키는지"에 대한 신뢰를 재설정하는 순간이라 다이제스트 고정의 가치가 특히 크다.
  - 제안: 필수는 아니나(기존에도 태그-only 고정이었으므로 이번 PR 이 만든 회귀는 아님), 여유가 있다면 `image: quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:6c83c74c8028…` 형태로 다이제스트까지 고정해 향후 동일 태그 재게시 리스크를 원천 차단할 수 있다.

- **[INFO]** 새 레지스트리 의존(quay.io)에 대한 장기 안정성은 미검증·미보증
  - 위치: `plan/in-progress/e2e-minio-registry.md` "왜 이 처분인가 (기각 대안)" 표
  - 상세: 이 PR 이 고치는 문제 자체가 "Docker Hub 가 익명 pull 을 막았다" 는 레지스트리측 정책 변경이다. 대체지로 고른 quay.io 도 별도 익명 pull 정책을 가진 제3자 인프라이며, 향후 동일한 형태로 제한될 가능성을 배제할 근거는 제시되지 않았다(다만 GHCR 미러링 같은 완화책은 plan 이 "지금 필요 없다" 로 명시적으로 defer 함 — 합리적 판단으로 보임). 새로운 결함이라기보다 인지된 채로 수용된 리스크.
  - 제안: 별도 조치 불요. 다만 향후 동일 클래스 장애 재발 시 이 판단(“GHCR 미러링 defer”)을 재검토 지점으로 plan 히스토리에 남겨 둔 것은 적절하다.

- **[INFO]** 라이선스·취약점 관점에서 신규 위험 없음
  - 위치: `docker-compose.e2e.yml:68,81`, `docker-compose.yml:38,56`
  - 상세: 소프트웨어 자체(MinIO/mc, AGPLv3 계열)는 이미 이 저장소가 채택해 온 기존 의존성이며, 이번 변경은 동일 태그를 가리키는 이미지의 **배포처(레지스트리)만** Docker Hub → quay.io 로 바꾼 것이다. plan 문서가 image ID 동일성을 확인했다고 기록해 태그 내용물이 바뀌지 않았음을 뒷받침한다. quay.io 는 MinIO Inc. 가 공식적으로 운영하는 배포처로, 신뢰할 수 없는 제3자 미러가 아니다. 새 패키지 추가, 버전 상향, 라이선스 변경, 알려진 CVE 유입 어느 것도 해당하지 않는다.

- **[INFO]** 두 compose 파일 간 일관성은 유지됨
  - 위치: `docker-compose.e2e.yml:65-81`, `docker-compose.yml:30-56`
  - 상세: `minio`/`createbuckets` 두 서비스 모두 e2e·dev 양쪽에서 동일하게 `quay.io/minio/{minio,mc}` + 동일 태그로 수정되어 두 compose 파일 간 이미지 참조가 계속 동기화되어 있다(기존에도 "동일 release 로 고정" 관례를 주석으로 명시해 온 패턴을 그대로 이어감). 내부 의존 관계 관점에서 결함 없음.

## 요약
이번 변경은 새 패키지 도입이 아니라 기존에 이미 채택돼 있던 `minio`/`mc` 컨테이너 이미지의 **배포 레지스트리**를 Docker Hub → quay.io 로 옮기는 인프라 전용 수정이며, 태그(버전) 고정은 그대로 유지되고 image ID 동일성까지 수동 검증되어 라이선스·취약점·버전 충돌 관점의 신규 리스크는 없다. 다만 개발자 스스로 세운 "한쪽만 고치면 다음 사람이 다시 진단한다" 는 완결성 원칙이 `k8s/overlays/local/infra-minio.yaml` 앞에서 깨진다 — 문서화된 로컬 k8s 실행 경로에 동일 계열 이미지가 Docker Hub·`latest` 태그인 채로 남아 있어 동일한 pull-denied 장애를 재현할 것이다. 이 WARNING 외에는 다이제스트 미고정·quay.io 자체의 장기 안정성 미보증 정도의 경미한 INFO 만 남는다.

## 위험도
LOW
