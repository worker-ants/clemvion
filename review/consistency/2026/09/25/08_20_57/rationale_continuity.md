# Rationale 연속성 검토 — k8s-avatar-policy (impl-prep)

## 검토 범위

- target: `plan/in-progress/k8s-avatar-policy.md` (구현 계획, `spec_impact: none`) + `--impl-prep` 스코프 번들
  (`spec/0-overview.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/4-file-storage.md`)
- 대조: `spec/0-overview.md` §2.7 Rationale "S3 객체 키 prefix 설계", `spec/data-flow/4-file-storage.md` §Rationale,
  `scripts/minio/README.md`(비-spec, 실측 근거 문서), `docker-compose.yml`/`docker-compose.e2e.yml` 의
  `createbuckets`, `k8s/overlays/local/infra-minio.yaml` 현재 상태

## 발견사항

이 계획은 spec 을 바꾸지 않는 harness/k8s 전용 수정이며, 기존 spec Rationale 을 위반하거나 기각된 대안을
말없이 되살리는 지점은 찾지 못했다. 오히려 계획 본문이 과거 기각 이력을 스스로 인용하며 회피하고 있다:

- **`mc anonymous set download` 재도입 안 함** — `scripts/minio/README.md` "왜 `mc anonymous set download` 를
  쓰지 않는가 — 실측으로 기각했다" (접두 정책에 `s3:ListBucket` 이 딸려 열린다는 실측)를 계획이 그대로
  인용하며 "`set download` 프리셋은 쓰지 않는다 — 목록까지 연다(README 의 실측)"로 명시 회피한다 (`plan/in-progress/k8s-avatar-policy.md` §B).
- **`ListBucket` 미허용 invariant 준수** — `spec/0-overview.md` §2.7 note 및 Rationale "S3 객체 키 prefix 설계"의
  "`ListBucket` 은 허용하지 않는다 … 둘 중 하나만으로는 통제가 성립하지 않는다"를 drift 가드 테스트 설계에
  그대로 반영한다 ("어느 쪽에도 `s3:ListBucket` 이 없음을 단언").
- **workspaceId prefix 미도입** — 정책 파일(`scripts/minio/avatars-public-read.json`)의 `avatars/*` 구조를
  그대로 재사용하며, `0-overview.md`/`data-flow/4-file-storage.md` 가 못박은 "Avatar 는 워크스페이스 비종속
  리소스"라는 소유 모델 근거를 건드리지 않는다.
- **이중 소스 + drift 가드라는 기존 선례를 반복** — 정책이 원본 JSON과 Job heredoc 두 벌이 되는 것을
  받아들이고 하네스 테스트로 drift 를 막는 설계는, `spec/1-data-model.md` Rationale "DB 마이그레이션 도구로
  Flyway 채택"이 TypeORM 엔티티과 Flyway SQL 의 이중 스키마를 "받아들인 비용"으로 규정하고
  `entity-schema-declarations` e2e 로 막은 것과 같은 패턴이다 — 새로 발명한 예외가 아니라 기존 합의된
  해법 형태를 재사용한 것으로 판단된다.

### [INFO] compose 의 실패-흡수(`exit 0`)와 k8s 계획의 실패-전파(`set -e`) 사이 비대칭

- target 위치: `plan/in-progress/k8s-avatar-policy.md` §B ("스크립트에 `set -e` … 지금은 마지막 명령의 종료
  코드만 Job 상태가 되므로")
- 과거 결정 출처: 해당 없음 — `docker-compose.yml`/`docker-compose.e2e.yml` 의 `createbuckets` entrypoint 는
  마지막 줄이 `exit 0;`으로 끝나 `mc anonymous set-json` 실패를 포함한 모든 실패를 흡수한다(주석 없음, `##
  Rationale` 미기재). `backend` 서비스는 `createbuckets: condition: service_completed_successfully` 로
  의존하므로, compose 환경에서는 정책 적용이 실패해도 `createbuckets` 컨테이너가 성공 종료로 보고돼 backend 가
  기동한다 — 정확히 이 트래커가 막으려는 "업로드는 성공, 이미지만 403" 증상이 compose 에도 잠재한다.
- 상세: k8s 쪽에만 `set -e` 로 fail-loud 를 넣으면 두 배포 경로의 실패 거동이 갈린다. `spec/0-overview.md` §5
  "두 배포 방식 모두 동일한 기능을 제공"은 **기능 동일성**을 말하는 것이지 **실패 거동 동일성**을 못박은
  Rationale 은 아니라서 이것이 명시적 위반은 아니다. 다만 기존 Rationale/README 어디에도 이 비대칭에 대한
  결정이 없어 "결정의 무근거 번복"으로 판정할 근거 자체가 없다 — 애초에 다뤄진 적 없는 갭이다.
- 제안: 이번 plan 은 트래커 스코프(k8s Job) 로 한정되어 있어 compose 를 함께 고치라는 요구는 아니다. 다만
  `.claude/tests/README.md` 또는 plan 본문에 "compose 는 여전히 `exit 0` 로 흡수한다"는 한 줄을 남겨, 다음
  사람이 "k8s 만 고쳐졌고 compose 의 동일 결함은 별도"라는 사실을 재조사 없이 알 수 있게 하는 것을 권장.
  Rationale 신설을 요구하는 수준은 아니다(INFO).

## 요약

k8s-avatar-policy 계획은 `spec/0-overview.md` §2.7 및 `spec/data-flow/4-file-storage.md` 의 아바타 공개 버킷
정책 Rationale(ListBucket 차단, workspaceId prefix 미사용, UUID 키가 유일한 통제 수단)과 `scripts/minio/README.md`
가 이미 실측으로 기각한 `mc anonymous set download` 대안을 모두 인지하고 명시적으로 존중·회피하고 있다. 이중
소스(원본 정책 JSON + Job heredoc)를 받아들이고 하네스 drift 가드로 막는 설계도 이 저장소의 기존 선례(Flyway/TypeORM
이중 스키마 + e2e 가드)와 같은 형태라 새로운 리스크를 만들지 않는다. 유일한 관찰 사항은 compose 의
실패-흡수(`exit 0`)와 k8s 의 계획된 실패-전파(`set -e`) 사이 비대칭인데, 이는 기존에 다뤄진 적 없는 갭이라 "번복"이
아니며 계획의 스코프 밖이므로 INFO 수준 메모로 충분하다.

## 위험도

NONE
