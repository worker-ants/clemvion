# Plan 정합성 검토 — k8s-avatar-policy (--impl-prep)

## 검토 범위

- Target: `spec/0-overview.md` §2.7/§2.8 · `spec/2-navigation/9-user-profile.md` (아바타 공개 정책·서빙 전략 관련 절)
- 검토 대상 plan: `plan/in-progress/k8s-avatar-policy.md` (이번 작업의 plan) + 이와 교차 참조되는
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커) · `plan/in-progress/spec-sync-user-profile-gaps.md`
  (target 문서의 `pending_plans`) · `plan/in-progress/self-hosting-deployment.md` · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

## 발견사항

검토 결과 CRITICAL/WARNING 등급 항목 없음. 아래는 확인 근거(비차단)만 기록한다.

- **[INFO]** 트래커 항목과 target 의 정합 확인
  - target 위치: `spec/0-overview.md` §2.7 (버킷 정책 표·note), Rationale "S3 객체 키 prefix 설계"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L5840-5853 (미해소 `[ ]` 항목 "k8s 로컬 오버레이의 버킷 Job 이 아바타 공개 정책을 걸지 않는다")
  - 상세: `k8s-avatar-policy.md` 가 닫으려는 트래커 항목은 실제로 해당 파일에 아직 `[ ]`(미해소) 상태로 남아 있고, 서술(문제 현상·처방 후보·검증 판정 셋)도 plan 본문과 정확히 일치한다. 실측(`k8s/overlays/local/infra-minio.yaml:109-115`)도 Job 이 `mc mb` 만 하고 정책을 걸지 않는 현재 상태를 확인했다 — plan 의 "착수 전 실측" 표와 저장소 실물이 일치한다.
  - 제안: 조치 불요. plan 완료 시 트래커의 해당 체크박스를 `[x]` 로 닫고 해소 서술을 남기는 것(plan 자체 §D 체크리스트 "트래커 항목 닫기")으로 충분.

- **[INFO]** 인접 미해소 항목(self-hosting-deployment)과의 의도적 분리 확인
  - target 위치: 해당 없음 (target 문서 자체는 이 항목을 언급하지 않음)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` L5850-5853 "2026-09-25 보탬" 주석 ↔ `plan/in-progress/self-hosting-deployment.md` §3 (L51-62, "MinIO 부팅 후 버킷 자동 생성" 체크박스, 아직 미착수)
  - 상세: 트래커는 "같은 누락이 예고된 자리(self-hosting-deployment §3)에도 있다"고 적고 "그 번들을 만들 때 이 항목과 함께 닫을 것"이라 명시한다. `self-hosting-deployment.md` §3 은 실제로 버킷 정책 서술이 없다. 다만 이 지시는 `/ai-review` 가 두 라운드 연속 "범위 밖"으로 짚어 self-hosting-deployment.md 본문이 아니라 중앙 트래커로 옮겨 적은 것으로, self-hosting-deployment 가 **실제 착수될 때** 해소하라는 후속 지시다. 이번 `k8s-avatar-policy` plan 은 로컬 kustomize 오버레이만을 스코프로 하므로(체크리스트에 self-hosting-deployment 언급 없음) 이 항목을 지금 반영하지 않는 것은 스코프 이탈이 아니라 트래커가 이미 정한 분리 방침과 일치한다.
  - 제안: 조치 불요 — self-hosting-deployment 착수 시점에 이 크로스레퍼런스가 다시 유효하다는 점만 유의(현재 plan 이 책임질 항목 아님).

- **[INFO]** target 문서의 `pending_plans` 확인 — 충돌 없음
  - target 위치: `spec/2-navigation/9-user-profile.md` frontmatter `pending_plans: [spec-sync-user-profile-gaps.md]`
  - 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md`
  - 상세: 해당 plan 의 아바타 관련 잔여 항목(동시 업로드 TOCTOU, 컨트롤러 예외 전파 테스트, `UserAvatarService` 분리 재개 신호 등)은 모두 **애플리케이션 계층**(백엔드 서비스 로직) 축이며, `k8s-avatar-policy` 가 다루는 **배포/인프라 계층**(k8s Job 의 버킷 정책 적용) 축과 겹치지 않는다. 두 축이 동일한 최종 사용자 증상("아바타 이미지가 안 보인다")을 공유할 수는 있으나 원인·수정 지점이 분리되어 있어 상호 무효화·중복이 없다. 버킷 정책 자체("공개 URL + UUID 키 + ListBucket 차단")는 이미 2026-08-31 사용자 결정으로 확정되어 있고 이번 plan 은 그 결정을 k8s 오버레이에 **적용만** 한다 — 새 결정을 내리지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 완료된 이미지 교체 plan(`minio-image-parity-guard`)과의 정합
  - target 위치: 해당 없음
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md` L1105-1114 (이미지를 `pgsty/silo` 로 교체, 세 곳 모두 반영 — 이미 종결)
  - 상세: `k8s-avatar-policy.md` 의 처방(heredoc 기반 정책 적용)은 이미 `pgsty/silo` 이미지로 교체된 현재 `infra-minio.yaml` 을 전제로 하며, 실측으로 확인한 현재 파일 상태(L41, L103 `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:...`)와 일치한다. 선행 이미지 교체 plan 이 완료되지 않았다면 본 plan 의 전제(같은 이미지 사용, `mc`/`mcli` 심볼릭 링크 존재)가 깨졌을 것이나, 실측상 문제 없음.
  - 제안: 조치 불요.

## 요약

`k8s-avatar-policy.md` 는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 아직 미해소 상태로 남아 있는 특정 트래커 항목을 정확히 겨냥하고 있고, 그 항목이 서술하는 현상·처방 후보·검증 방법이 plan 본문과 저장소 실물(둘 다 실측 확인) 모두와 일치한다. target 문서(`0-overview.md`/`9-user-profile.md`)가 이미 확정한 아바타 공개 버킷 정책 결정("공개 URL + UUID 키 + ListBucket 차단", 2026-08-31 사용자 결정)을 새로 뒤집거나 우회하지 않고, k8s 오버레이에 동일 정책을 적용하는 것으로 스코프가 명확히 제한되어 있다. `9-user-profile.md` 의 `pending_plans`(`spec-sync-user-profile-gaps.md`)는 애플리케이션 계층 잔여 항목이라 이번 인프라 계층 plan 과 축이 겹치지 않으며, 인접 미해소 항목(`self-hosting-deployment.md` §3)은 트래커가 이미 "그 plan 착수 시점에 함께 닫을 것"으로 분리해 둔 상태라 이번 plan 이 놓친 후속 항목도 아니다. 미해결 결정과의 충돌, 선행 조건 미해소, 후속 항목 누락 어느 관점에서도 차단 사유를 찾지 못했다.

## 위험도

NONE
