# Plan 정합성 검토 — minio-silo-image (impl-prep)

대상 target 은 `spec/0-overview.md §2.7/§2.8`·`spec/data-flow/4-file-storage.md` 로 구성된
storage 스코프 번들이며, 실제 구현 축은 `plan/in-progress/minio-silo-image.md` 가 서술하는
MinIO 이미지(→ `pgsty/silo`) 교체(3 파일: `docker-compose.e2e.yml`·`docker-compose.yml`·
`k8s/overlays/local/infra-minio.yaml`)다. `plan/in-progress/**` 전수를 대상으로 grep 한 뒤
(`minio`·`docker-compose`·`quay.io`·`k8s/overlays`·`registry`) 실제 관련이 있는 항목만 원문을
직접 열어 대조했다 (프롬프트 번들은 컨텍스트 예산으로 대다수 파일이 절단돼 있어 grep 매칭
파일은 전부 직접 `Read` 로 재확인함).

## 발견사항

- **[INFO]** `spec-sync-external-interaction-api-gaps.md` 의 「Docker Hub 익명 pull rate limit」
  항목이 "재검토 불요 — 다시 열지 말 것" 이라는 문구를 남긴 채 있다
  - target 위치: (target 자체는 아니고) 구현 축인 `plan/in-progress/minio-silo-image.md` §E
    체크리스트 "트래커 갱신 — 레지스트리 항목에 2026-09-24 경과 · `e2e-minio-registry` 후속
    항목 종결 · k8s 정책 누락 등재"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (해당 라인 근방
    "✅ 2026-09-12 — (a) 실행됨 … (b)·(c) 는 **재검토 불요 — 다시 열지 말 것**")
  - 상세: 이 문구는 quay.io 로의 1차 이전(`#1325`)이 최종 해법이라는 전제로 쓰였다. 이번
    plan(`minio-silo-image.md`)이 그 전제를 실측으로 반증했다(quay.io 도 401). 미완결이면
    다음 사람이 "다시 열지 말 것" 문구를 그대로 믿고 3번째 사고를 오진할 위험이 있다.
    다만 `minio-silo-image.md` §E 체크리스트가 이미 "레지스트리 항목에 2026-09-24 경과" 갱신을
    todo 로 명시하고 있어 **완전한 누락은 아니다** — 다만 그 todo 가 파일명을 특정하지 않고
    "레지스트리 항목" 이라고만 적어 실제 커밋 시 이 문장 자체(“다시 열지 말 것”)를 건드리지
    않고 새 불릿만 append 할 위험이 있다.
  - 제안: 구현 커밋에서 `spec-sync-external-interaction-api-gaps.md` 의 해당 문장을 취소선
    처리하거나 "이 전제는 2026-09-24 재차 반증됨 → `minio-silo-image.md` 참고" 로 명시 정정할
    것. plan 자체를 지금 고칠 필요는 없음(체크리스트가 이미 이를 약속하고 있으므로) — 구현
    완료 시 반드시 이 문장을 정확히 짚어 정정하라는 추적 메모.

- **[INFO]** `plan/complete/e2e-minio-registry.md` §후속 등재의 두 미체크 항목이 이번 diff 로
  종결됨 — 완료 plan 파일의 체크박스 갱신 대상
  - target 위치: 구현 축 `plan/in-progress/minio-silo-image.md` §D "k8s 는 `:latest` 였다 …
    이번엔 이미지를 바꾸는 것 자체가 고정이라 축이 분리되지 않는다. 같은 diff 에서 닫는다."
  - 관련 plan: `plan/complete/e2e-minio-registry.md` §후속 등재 — "① `k8s/overlays/local/
    infra-minio.yaml` 의 `:latest` 를 RELEASE 태그로 고정 (developer)", "② 다른 트래커 항목과의
    관계 종결 확인"
  - 상세: `minio-silo-image.md` 는 이 두 후속 항목을 인지하고 있고(§D 에서 직접 인용) 같은
    diff 에서 해소하겠다고 명시한다. 다만 `e2e-minio-registry.md` 는 `plan/complete/` 로 이미
    이동된 문서라 이번 plan_coherence 스코프(`plan/in-progress/**`) 밖이다 — 구현이 끝난 뒤
    그 파일의 미체크 두 항목을 `[x]` 로 갱신하는 작업이 `minio-silo-image.md` 의 체크리스트
    문항("트래커 갱신")에 자연히 포함돼야 하는데, 체크리스트 문구가 `e2e-minio-registry.md`
    파일 경로를 명시하지 않는다.
  - 제안: 종결 커밋에서 `plan/complete/e2e-minio-registry.md` §후속 등재의 두 체크박스도 함께
    `[x]` 로 갱신할 것 (완료 문서라 재오픈 없이 체크박스만 마무리).

- **[INFO]** `pgsty/silo` 채택으로 self-hosting 기본 이미지의 출처가 다시 Docker Hub 로
  돌아간다 — 두 번째 레지스트리 폐쇄 이후 리스크 재노출
  - target 위치: (참고) 구현 축 `plan/in-progress/minio-silo-image.md` §B "선택한 이미지:
    `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:…`"
  - 관련 plan: `plan/complete/e2e-minio-registry.md` "왜 이 처분인가 (기각 대안)" 표 — "이미지를
    GHCR 로 미러링 | 미러 갱신 파이프라인이 새 유지보수 표면. 지금 필요 없다"
  - 상세: 12일 사이 Docker Hub(`minio/minio`) → quay.io(같은 이름) 순으로 두 레지스트리가
    막혔다. 이번 결정은 세 번째 벤더(`pgsty/silo`, Docker Hub)로 다시 익명 pull 에 의존한다.
    이는 **사용자와 함께 내린 결정**(2026-09-24)이고 다이제스트 고정으로 "어떤 바이트인가"의
    신뢰는 이미 보강했으므로 재론을 요구하는 것은 아니다. 다만 `e2e-minio-registry.md` 가
    "GHCR 미러링은 지금 필요 없다" 고 적은 근거(비용 대비 편익)가 반복된 레지스트리 폐쇄로
    약해졌다는 사실 자체는 어느 plan 에도 추적되지 않는다.
  - 제안: 차단 사유는 아니며 즉시 조치를 요구하지 않는다. 세 번째 유사 사고가 나면 GHCR
    미러링을 재검토 후보로 다시 올릴 수 있도록, `minio-silo-image.md` 또는 후속 트래커에
    한 줄 메모(“동일 사고 3회째 재발 시 GHCR 미러링 재검토”)를 남기는 것을 권장.

## 검증된 정합 지점 (참고, 문제 아님)

- `spec-sync-user-profile-gaps.md` 의 완료 항목("`POST /api/users/me/avatar` e2e")은 실
  MinIO 버킷 정책(익명 GET 200 / 목록 403)에 의존하는데, `minio-silo-image.md` §C 가 새 이미지
  에서도 동일한 403/200 분기를 대조군까지 두고 재확인했고 e2e 전체(380 backend + 51 playwright,
  `users-avatar-upload` 포함) 통과를 실측했다 — 선행 plan 의 전제가 이번 교체로 깨지지 않는다.
- `self-hosting-deployment.md` (미착수, `prd/` 참조 등 stale 한 구 초안)는 MinIO 를 포함한
  풀 번들·Helm chart 를 다루지만 아직 "디자인 결정" 단계에 있고, 이번 이미지 교체가 그 설계
  결정과 충돌하지 않는다(이미지 벤더 선택은 self-hosting-deployment 의 미해결 결정 목록에
  없음).
- `spec/0-overview.md §2.7` 의 "AWS S3 API 호환 (AWS S3, MinIO 등)" 서술과 §2.7 "셀프 호스팅 |
  MinIO 기본 제공" 은 `pgsty/silo` 가 MinIO 호환 API 를 유지하는 커뮤니티 포크이므로 여전히
  참이며, plan 의 `spec_impact: none` 판단과 선례(`plan/complete/e2e-minio-registry.md` 도
  동일하게 `spec_impact: none`)가 일관된다 — spec 갱신 누락이 아니다.

## 요약

`minio-silo-image.md` 는 미해결 결정을 우회하지도, 다른 in-progress plan 의 선행 조건을
깨지도 않는다. `plan/in-progress/**` 전수 스캔에서 이 교체와 실질적으로 얽힌 문서는
`spec-sync-external-interaction-api-gaps.md`(레지스트리 이력 트래커)와
`spec-sync-user-profile-gaps.md`(아바타 버킷 정책 e2e 전제)뿐이었고, 둘 다 plan 자신이 이미
인지·검증했다. 남은 것은 구현 커밋 시점에 "다시 열지 말 것" 문구의 정확한 정정과
`plan/complete/e2e-minio-registry.md` 체크박스 종결이 빠지지 않도록 하는 추적 메모 수준이다.

## 위험도

LOW
