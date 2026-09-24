# Cross-Spec 일관성 검토 — MinIO 이미지 일치 하네스 가드 (impl-prep)

## 검토 대상 확인

`target 문서` 로 지정된 두 파일은 scope-storage 스크래치 사본이다:

- `scope-storage/0-overview.md` ↔ `spec/0-overview.md`
- `scope-storage/4-file-storage.md` ↔ `spec/data-flow/4-file-storage.md`

`diff` 결과 두 쌍 모두 **byte-identical** (차이 0줄). 즉 이번 작업은 이 두 spec 문서에 어떤 내용도
추가·변경하지 않는다 — orchestrator 가 "MinIO/storage" 키워드로 관련 spec 을 스코프에 넣었을 뿐,
실제 draft 변경분은 없다. 이는 plan(`plan/in-progress/minio-image-parity-guard.md`) 의
`spec_impact: none` 과 정합한다.

대상 plan 이 실제로 만들려는 산출물은 `.claude/tests/test_minio_image_parity.py` (harness 테스트) +
`harness-checks.yml` pathspec 3줄이며, 건드리는 실 파일은 `docker-compose.yml` ·
`docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml` 세 곳의 `image:` 값이다. 이들은
`spec/**` 밖의 인프라 매니페스트로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중
어느 것도 새로 정의하지 않는다.

## 보조 확인 — 실 이미지 값과 spec 서술의 정합

`spec/0-overview.md §2.7` 은 "셀프 호스팅은 MinIO 기본 제공" 이라고만 기술하고 특정 벤더/이미지
문자열을 못박지 않는다. 저장소 현재 상태(`#1392` 반영 후)를 확인한 결과:

```
docker-compose.yml:      image: pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197c...
docker-compose.e2e.yml:  image: pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197c...  (x2)
k8s/.../infra-minio.yaml: image: pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197c...  (x2)
```

여섯 자리 모두 이미 동일 문자열이다 — plan 이 추가하려는 것은 이 일치를 **하네스 테스트로 고정**하는
것뿐이며, spec 서술("MinIO 기본 제공")과 충돌하지 않는다. `spec/data-flow/4-file-storage.md` 도
`s3.endpoint` 값 예시(`http://minio:9000`)만 언급하고 이미지 태그와는 무관하다.

## 발견사항

없음. target 이 기존 spec 대비 실질적으로 아무것도 바꾸지 않으므로(byte-identical), 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 충돌 후보가 존재하지 않는다.

### 요약

이번 작업은 `spec/**` 내용을 전혀 변경하지 않는 harness-only 변경(docker-compose/k8s 이미지 문자열
파서 기반 일치 검증 테스트 추가)이며, 스코프에 포함된 두 spec 문서(`0-overview.md`,
`data-flow/4-file-storage.md`)는 저장소 현재본과 완전히 동일했다. Cross-spec 관점에서 검토할 신규
주장·계약·모델이 없어 다른 영역과 모순될 여지도 없다.

### 위험도
NONE
