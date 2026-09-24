# 신규 식별자 충돌 검토 — `plan/in-progress/minio-silo-image.md`

## 대상 요약

target 은 `spec/` 문서가 아니라 `plan/in-progress/minio-silo-image.md` (인프라 작업 plan, `spec_impact: none`)이며,
실제 변경 범위는 `docker-compose.yml` · `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml` 세 파일의
MinIO 컨테이너 **이미지 참조**(`quay.io/minio/minio:*` → `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:...`)를
바꾸는 것뿐이다. 서비스명(`minio`, `createbuckets`, `minio-create-bucket`), 볼륨명(`minio_data`), 환경변수
(`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`/`S3_*`), 헬스체크 경로(`/minio/health/live`), 콘솔 포트(`:9001`) 는
모두 기존 값 그대로 유지된다고 plan §C·§D 가 명시한다. 즉 이 target 이 **새로 도입하는 프로젝트 내부 식별자는
사실상 없다** — "이미지 공급원 교체" 라는 인프라 운영 변경이다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — target 은 신규 요구사항 ID 를 부여하지 않는다 (`_product-overview.md` 류 문서가 아님). 해당 없음.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음. 해당 없음.
5. **환경변수·설정키 충돌** — `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`/`S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` 등 기존
   키를 그대로 재사용한다(신규 키 추가 없음, `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`
   실제 확인). 해당 없음.
6. **파일 경로 충돌** — 신규 spec 파일 생성 없음. plan 파일명 `plan/in-progress/minio-silo-image.md` 는
   `find plan -iname "*minio*"` / `*silo*"` 로 확인한 결과 `plan/complete/e2e-minio-registry.md` 와만 연관되고(선행
   plan 을 잇는 후속 작업이라는 관계이지 이름 충돌 아님) 그 외 겹치는 파일이 없다. kebab-case 명명 컨벤션도 기존
   plan 파일들과 일치한다.

## 부가 확인 — 외부 식별자(도입 대상)

- `silo`, `pgsty` 두 문자열을 `spec/`·`plan/` 전체에서 grep 했을 때 이 target 문서 자신을 제외하면 **0건** —
  기존에 다른 의미로 쓰이고 있지 않다 (예: "데이터 격리(data silo)" 같은 기존 용어와의 의미 충돌 없음).
- `quay.io`/`pgsty` 레지스트리 참조도 기존 세 파일 안에서 `quay.io/minio/*` 로만 존재해, 신규 레지스트리 전환이
  기존 다른 레지스트리 참조와 겹치지 않는다.

## 발견사항

없음 — target 이 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로가
전무하여, 위 6개 관점 중 어느 것도 충돌 후보를 만들지 않는다.

## 요약

target 은 spec 변경이 아니라 MinIO 서버/클라이언트 이미지 공급원을 `quay.io/minio/*` 에서 `pgsty/silo` 로
교체하는 인프라 plan 이며, 세 인프라 설정 파일에서 이미지 참조 문자열만 바뀌고 서비스명·볼륨명·환경변수·
헬스체크 경로 등 기존 식별자는 모두 보존된다. 새로 도입되는 프로젝트 내부 식별자가 없으므로 신규 식별자
충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
