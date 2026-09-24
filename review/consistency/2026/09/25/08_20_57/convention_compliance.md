# 정식 규약 준수 검토 — k8s-avatar-policy (--impl-prep)

## 검토 범위

- target 문서: `spec/0-overview.md`(scope-avatar 사본, §2.7 Object Storage + Rationale "S3 객체 키 prefix 설계") · `spec/2-navigation/9-user-profile.md`(scope-avatar 사본, §6.1 아바타 서빙 전략 + API 표)
- 대조 규약: `spec/conventions/**` 전체 번들 중 이번 작업(아바타/MinIO/S3 관련)과 접점이 있는 `error-codes.md` · `swagger.md` · `secret-store.md` · `migrations.md` · `data-hydration-surfaces.md` · `frontend-layering.md` · `review-citations.md` 를 실제 저장소 원본(`spec/conventions/*.md`)에서 직접 재확인했다 — `_prompts` 번들이 이 파일들 다수를 "컨텍스트 예산 초과로 절단됨" 처리했기 때문이다(예: `error-codes.md`(17,742자) · `swagger.md`(30,184자) · `secret-store.md`(23,654자) · `migrations.md`(9,776자) 전부 절단). 절단된 채로 판단하면 정확히 이 두 파일이 인용하는 규약 본문을 못 보고 넘어가므로, 저장소의 실 파일을 직접 읽어 대조했다.
- 참고: 본 plan(`plan/in-progress/k8s-avatar-policy.md`)은 `spec_impact: none` — k8s manifest(`k8s/overlays/local/infra-minio.yaml`)만 건드리며 spec 문서 자체는 이번 작업으로 변경되지 않는다. 즉 본 검토는 "이 작업이 새로 쓴 문장"이 아니라 "이 작업이 근거로 참조하는 기존 spec 문장들"이 규약을 따르는지 확인하는 사전 점검이다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** swagger.md §2-4 상태 코드 표에 413 미등재
  - target 위치: `9-user-profile.md` §6.1 API 표, `POST /api/users/me/avatar` 행의 `413 PAYLOAD_TOO_LARGE`
  - 관련 규약: `spec/conventions/swagger.md` §2-4 (상태 코드 응답 규칙 표 — 200/201/204/400/401/403/404/409/502만 나열, 413 없음)
  - 상세: target 문서 자체는 위반이 아니다 — `PAYLOAD_TOO_LARGE` 는 `error-codes.md`·`5-system/2-api-convention.md §6`가 정한 전역 표준 413 코드를 올바르게 재사용했고(도메인 특화 코드를 새로 만들지 않음), 실제 구현도 `@ApiPayloadTooLargeResponse`(`users.controller.ts`·`knowledge-base.controller.ts`·`hooks.controller.ts`에 이미 3곳 선례)를 쓰고 있어 구현·문서·규약 셋이 정합한다. 다만 `swagger.md` §2-4 표 자체가 413 데코레이터 매핑을 빠뜨리고 있어, 규약 문서만 보고 신규 엔드포인트를 작성하는 사람은 이 표에서 413 짝을 못 찾는다.
  - 제안: target 수정 불필요. 규약 문서(`swagger.md` §2-4)에 `413 → @ApiPayloadTooLargeResponse` 행 추가를 project-planner 후속으로 남길 만하다(본 plan 의 scope 밖).

- **[INFO]** Object Storage 키 네이밍 전용 컨벤션 부재
  - target 위치: `0-overview.md` §2.7 버킷 구조 표(`kb/…` · `{workspaceId}/forms/…` · `avatars/{userId}/{uuid}.{ext}`)
  - 관련 규약: 해당 없음 — `spec/conventions/` 에 S3/오브젝트 스토리지 키 네이밍을 다루는 문서가 없다(가장 근접한 `redis-keys.md` 는 Redis 키 전용, `secret-store.md` §1 URI scheme 은 외부 provider 자격증명 전용이라 스코프가 명시적으로 다르다).
  - 상세: 위반은 아니다 — 없는 규약을 어길 수는 없다. 다만 `kb/…`·`avatars/…`·(계획)`{workspaceId}/forms/…` 세 계열이 서로 다른 prefix 정책(workspaceId 유무)을 갖는 이유를 `0-overview.md` Rationale 이 이미 잘 설명하고 있어, 세 번째 키 계열이 추가되는 시점에 별도 `spec/conventions/object-storage-keys.md` 로 승격할 가치가 있어 보인다(현재는 조기 승격 불필요).
  - 제안: 지금 조치 불필요. 향후 오브젝트 스토리지 키 계열이 하나 더 늘 때 conventions 승격을 고려.

## 요약

target 두 문서(`0-overview.md` §2.7/Rationale, `9-user-profile.md` §6.1)를 `error-codes.md`(에러 코드 명명: `FILE_REQUIRED`/`INVALID_FILE_TYPE`/`PAYLOAD_TOO_LARGE` 모두 UPPER_SNAKE_CASE·의미 기반이며 전역 표준 코드 재사용 원칙도 준수) · `swagger.md`(DTO/응답 패턴 — target 은 spec 서술이라 데코레이터 자체를 담지 않지만 서술된 계약이 기존 구현·규약과 어긋나지 않음) · `secret-store.md`(스코프가 "외부 provider 자격증명"으로 명시돼 있어 MinIO/S3 인프라 자격증명은 애초에 그 규약의 대상이 아니며 target 도 이를 SecretResolver 대상으로 잘못 끌어들이지 않음) · `migrations.md`(§2.8 서술은 이번 작업과 무관, 기존 그대로) 대조한 결과 CRITICAL·WARNING 위반은 발견되지 않았다. 이번 plan 은 `spec_impact: none` 으로 spec 문서를 직접 건드리지 않으므로, 본 검토는 k8s manifest 구현이 근거로 삼는 기존 spec 서술이 규약과 어긋나지 않음을 확인하는 사전 점검 성격이며, 확인 결과 구현 착수를 막을 사유가 없다. INFO 두 건은 각각 규약 문서(swagger.md) 쪽의 사소한 표 누락과, 아직 규약화할 필요는 없는 네이밍 패턴 관찰이다.

## 위험도
NONE
