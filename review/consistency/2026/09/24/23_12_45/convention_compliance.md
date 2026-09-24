# 정식 규약 준수 검토 — MinIO → pgsty/silo 이미지 교체 (impl-prep)

## 검토 개요

이번 plan(`plan/in-progress/minio-silo-image.md`, `spec_impact: none`)의 실제 변경 범위는
`docker-compose.e2e.yml`·`docker-compose.yml`(dev)·`k8s/overlays/local/infra-minio.yaml`
세 인프라 파일에서 MinIO 컨테이너 이미지 참조를 `quay.io/minio/*` 에서
`pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:...` 로 교체(+ 주석)하는 것뿐이다.
`spec/` 아래 어떤 문서도 이 작업으로 신설·수정되지 않는다 (`git status` 확인 결과 worktree
에는 `plan/in-progress/minio-silo-image.md` 와 `review/consistency/**` 산출물 외 diff 없음).

그런데 이번 `--impl-prep` 정식 규약 준수 검토의 target 문서로는 `spec/0-overview.md`
(§2.7 Object Storage — S3/MinIO 버킷 구조)와 `spec/data-flow/4-file-storage.md` 전문 +
`spec/conventions/**` 전체가 번들됐다 — "MinIO"/스토리지 키워드로 스코프가 잡힌 것으로 보인다.

## 발견사항

- **[INFO]** 검토 대상(target 문서)과 실제 작업 diff 범위 불일치
  - target 위치: 번들 전체 (`0-overview.md` §2.7, `4-file-storage.md` 전문, `spec/conventions/**`)
  - 위반 규약: 해당 없음 — 규약 위반이 아니라 검토 스코프 산정 이슈
  - 상세: 본 작업은 컨테이너 이미지 태그 교체이며 `spec/` 문서 생성·수정을 전혀 수반하지
    않는다(plan frontmatter `spec_impact: none`과 일치). 명명 규약·출력 포맷·문서 구조·API
    문서 규약·금지 항목 중 어느 것도 이 diff 로 인해 새로 위반될 여지가 없다 — 애초에
    diff 가 spec 파일을 건드리지 않기 때문이다. 번들된 스토리지 관련 spec 문서들은
    "MinIO" 키워드가 겹친다는 이유로 스코프에 끌려온 것으로 보이며, 정식 규약 준수
    관점에서 실제로 검토할 대상(수정될 spec 문서)이 존재하지 않는다.
  - 제안: 이번 건은 통과(비차단)로 처리한다. 다만 orchestrator 의 impl-prep 스코프 산정
    로직이 인프라 전용(코드/spec 무관) 변경에도 무관한 spec 문서 다발을 번들하는지는
    비용 관점에서 별도로 점검할 가치가 있다(본 리뷰의 차단 사유는 아님).

- **[INFO]** `spec/conventions/**` 대부분이 컨텍스트 예산 초과로 절단되어 근거 확인 불가
  - target 위치: 프롬프트 번들 라인 969 이후 다수 — `cafe24-api-catalog/store.md`,
    `cafe24-api-metadata.md`, `error-codes.md`, `node-output.md`, `swagger.md`,
    `spec-impl-evidence.md`, `frontend-layering.md`, `redis-keys.md` 등 30여 개 파일
  - 위반 규약: 해당 없음 — 기지(旣知) 프로세스 이슈 (`feedback_consistency_spec_mode_budget.md`)
  - 상세: 알파벳순 앞쪽인 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·`category.md`
    만 전문이 실렸고 나머지는 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단됐다. 이번 점검
    관점 중 **②출력 포맷 규약**(에러 코드·노드 output 계약)과 **④API 문서 규약**
    (Swagger 데코레이터·DTO 명명)에 직접 SoT 인 `error-codes.md`·`node-output.md`·
    `swagger.md` 가 전부 절단 대상이라, 두 관점은 이번 검토에서 원문 대조 없이 판단할
    수 없었다.
  - 제안: 실질 영향은 낮다 — 이번 target 문서(`0-overview.md` §2.7, `4-file-storage.md`)는
    API 응답 payload·에러 코드·Swagger 데코레이터를 다루지 않는 인프라/스토리지 서술
    문서이므로, 절단된 컨벤션들과 직접 충돌할 지점이 없다. 다만 향후 API 계약을 다루는
    target 문서를 이 모드로 검토할 때는 절단된 conventions 를 별도 조회해 재검증이
    필요하다.

## 검증한 부분 (참고 — 위반 없음)

diff 는 없지만 번들된 target 문서 자체의 규약 준수 여부도 확인했다:

- `0-overview.md` — `spec/` 루트 `0-` prefix 규칙, `## Overview (제품 정의)` → 본문 →
  `## Rationale` 3섹션 구성을 그대로 따른다. §2.7 표·Rationale(§S3 객체 키 prefix 설계)의
  키 패턴(`kb/...`, `avatars/...`)도 문서 전체에서 일관 표기된다.
- `spec/data-flow/4-file-storage.md` — `## Overview` → 번호 매김 본문(1~4) →
  `## Rationale` 구성으로 data-flow 문서 컨벤션(`N-name.md`, 끝에 Rationale)에 부합한다.
  §2.3 의 "근접 명명 주의" 박스(`s3.publicBaseUrl` vs `app.publicBaseUrl`)는 실제 회귀
  테스트(`triggers.service.spec.ts`)까지 연결한 좋은 선례이며 규약 위반이 아니다.
- 두 문서 모두 `spec/0-overview.md §2.7` 와 `spec/data-flow/4-file-storage.md` 간 키
  패턴·상태(구현됨/계획)가 상호 참조로 정합돼 있어 명명 규약 상 불일치는 발견되지 않았다.

## 요약

이번 작업은 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`
세 인프라 파일의 MinIO 컨테이너 이미지 태그 교체에 한정되며 `spec/` 문서를 전혀 건드리지
않는다(`spec_impact: none`과 일치, git diff 로 확인). 정식 규약(`spec/conventions/**`) 관점의
검토 대상이 되는 신규/수정 spec 문서가 존재하지 않으므로 명명·출력 포맷·문서 구조·API 문서·
금지 항목 다섯 관점 모두에서 이번 diff 로 인한 위반은 없다. 번들된 참고 문서(`0-overview.md`
§2.7, `4-file-storage.md`) 자체도 기존 문서 구조 컨벤션을 그대로 따르고 있어 별도 조치가
필요하지 않다. 다만 스코프 산정이 무관한 spec 다발을 끌어왔고 conventions 대부분이 컨텍스트
예산으로 절단된 점은 프로세스 관점의 참고 사항으로 남긴다.

## 위험도

NONE
