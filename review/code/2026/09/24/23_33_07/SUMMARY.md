# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 인프라 이미지 교체(MinIO 공식 → `pgsty/silo`)로 코드 로직 변경 없음. Critical/Warning 없음, forced reviewer(`dependency`·`documentation`·`security`) 전원 결과 확보됨(누락 없음). 다만 plan 체크리스트의 "TEST WORKFLOW"·"`/ai-review`" 항목이 diff 시점에 미완료 상태이며, 공급망 신뢰 축이 12일 내 두 번째로 제3자 커뮤니티 포크로 이동한 점은 병합 전 확인 가치가 있다.

## Critical 발견사항

없음 — 4개 reviewer(security, side_effect, documentation, dependency) 모두 Critical 발견사항 없음.

## 경고 (WARNING)

없음 — 4개 reviewer 모두 Warning 발견사항 없음. 전 발견사항은 INFO 수준.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 공급망/의존성 | 벤더 신뢰 축 이동: MinIO 공식 이미지(`minio/minio`+`minio/mc`) → `pgsty/silo`(Docker Hub 커뮤니티 포크, 단일 이미지). 12일 내 2번째 레지스트리 폐쇄(Docker Hub → quay.io)로 인한 전환. local/e2e/dev 범위 한정(prod/staging 오버레이 미참조), 태그+다이제스트 고정. 재발(3번째 폐쇄) 시 GHCR 미러링 재검토가 이미 트래커에 등재됨 | `docker-compose.yml:43,63`; `docker-compose.e2e.yml:69,82`; `k8s/overlays/local/infra-minio.yaml:41,103` | 조치 불요(이미 처분·추적됨). 적용 범위가 staging/prod로 확장되면 그 시점에 서명 이미지 사용 재검토 |
| 2 | 부작용 | 공유 영속 볼륨(`minio_data`) 재사용 시 이미지 교체 방향에 따라 비대칭 잔여 효과 — `pgsty/silo`가 남긴 LDAP 관련 설정 키(`sts_trusted_proxies`)를 옛 MinIO 이미지가 이해하지 못해 경고 로그 발생 가능(기능 자체는 유지) | `docker-compose.yml:31-50`(볼륨 정의); `plan/in-progress/minio-silo-image.md` §C | `docker-compose.yml`의 `minio_data` 볼륨 주석에 롤백 시 경고 가능성 한 줄 추가 권장(현재는 plan 문서에만 기록) |
| 3 | 부작용/유지보수성 | 동일 이미지 참조(태그+다이제스트)가 3개 파일 6개 지점에 수동 중복 — 단일 SoT 부재로 향후 레지스트리/버전 교체 시 부분 반영 재발 위험(과거 `#1325`에서 k8s 지점 누락 전례). 이번 diff 내 6곳은 전부 리터럴 일치 확인됨(drift 없음) | `docker-compose.yml:43,63`; `docker-compose.e2e.yml:69,82`; `k8s/overlays/local/infra-minio.yaml:41,103` | 후속으로 이미지 태그를 `.env`/Makefile 변수 하나로 추출해 세 파일이 참조하도록 구조화 고려(이번 PR 범위 밖) |
| 4 | 테스트/프로세스 | plan 체크리스트의 "TEST WORKFLOW" / "`/ai-review`" 항목이 미완료(`[ ]`) 상태. §C 호환성 실측은 실제 변경 파일이 아닌 scratch/compose-override 환경에서 수행되어, 실제 반영 파일(`docker-compose.yml` 등) 기준 전체 테스트 완료 여부가 diff 시점에 미확인 | `plan/in-progress/minio-silo-image.md` §E 체크리스트 | 병합 전 실제 변경 파일 기준으로 TEST WORKFLOW·`/ai-review` 완료 처리 필요(plan 저자도 이미 계획해 둠) |
| 5 | 공급망 보안 | 이미지 서명 검증(cosign 등)·취약점 스캔(Trivy/Grype 등) 부재 — 다이제스트 고정은 "동일 바이트 재현"만 보장하고 "그 바이트의 신뢰성"은 검증하지 않음. 현재는 수동 1회 확인(image ID 동일성)에 의존, CI 강제 없음 | `plan/in-progress/minio-silo-image.md` §B, §E | 필수는 아니나, 향후 이미지 태그 갱신 시 CVE 스캔 절차를 문서화 권장(이번 PR 차단 사유 아님, dev/e2e 전용 범위) |
| 6 | 문서화 | CHANGELOG의 다이제스트 표기가 축약형(`sha256:635197cb…`)이라 인프라 파일에 고정된 전체 64-hex 값과 다름. 이 저장소의 기존 관례(이전 항목도 동일 축약 스타일)이며 결함은 아님 | `CHANGELOG.md:13` | 필요시 "전체 값은 `docker-compose.yml` 참고" 포인터 추가(선택, 강제 아님) |
| 7 | 문서화(Spec 갭, 기처분) | `spec/0-overview.md` §2.7이 "MinIO"를 벤더 불특정으로 서술하고 실제 이미지가 커뮤니티 포크(`pgsty/silo`)라는 사실은 spec에 드러나지 않음. 이미 이번 작업이 돌린 `--impl-prep` consistency-check(`review/consistency/2026/09/24/23_12_45`)의 `rationale_continuity` INFO #1로 검토되어, "spec은 역할을 서술하고 compose 주석이 SoT" 라는 근거로 의도적으로 유예 결정됨 | `spec/0-overview.md` §2.7(본 diff 범위 밖) | 조치 불요(이미 처분됨). 재지적 대상 아님 |

## 점검했으나 이상 없음 (참고)

- 버전 고정: 6개 이미지 참조 문자열(태그+다이제스트)이 세 파일에서 전부 `sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46`로 정확히 일치(직접 grep 확인). `quay.io/minio`·`minio/minio`·`minio/mc` 잔존 참조 0건.
- 라이선스: `pgsty/silo`도 원본 MinIO와 동일하게 AGPL-3.0 — 라이선스 조건 변경 없음. 이미지를 수정 없이 별도 네트워크 서비스로 구동하는 방식이라 AGPL 네트워크 카피레프트 조항을 촉발하는 수정도 관측되지 않음.
- 배포 범위: `k8s/overlays/staging`·`prod`에는 minio/silo 참조가 전혀 없음(grep 0건) — 이번 교체는 local/dev/e2e 전용.
- 문서 체인 구조: `docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`의 이미지 주석이 dev compose 주석을 근거 SoT로 지목하는 기존 관례를 계승 — 중복 없이 좋은 사례로 확인.
- 하드코딩 자격증명(`docker-compose.e2e.yml`의 `MINIO_ROOT_USER`/`PASSWORD` 등)은 이번 diff의 변경 대상이 아니며(unified diff 컨텍스트 줄), e2e 전용이고 "운영 절대 사용 금지" 주석이 이미 붙어 있음.
- 인젝션/경로탐색/인증인가/암호화/에러처리 관점: 신규 셸 조립·볼륨 마운트·인가 로직·에러 메시지 코드 없음(순수 이미지 참조 교체).
- CHANGELOG/plan 제목 표현 차이("quay.io도 닫혔다" vs "비공개가 됐다")는 의미상 모순 없는 자연스러운 패러프레이즈.
- 신규 npm/pip 등 코드 레벨 의존성 변경 없음(`package.json`/lockfile 변경 없음).
- `review/consistency/2026/09/24/23_12_45/**` 산출물은 프로젝트 컨벤션에 맞는 정상적인 `--impl-prep` 감사 artifact.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 커뮤니티 포크로 신뢰 축 이동(local/e2e 한정, 다이제스트 고정, 이미 처분됨) |
| side_effect | LOW | 공유 볼륨 비대칭 부작용(LDAP 경고), 6곳 수동 동기화 구조, plan TEST WORKFLOW/`/ai-review` 체크리스트 미완료 |
| documentation | NONE | CHANGELOG·plan 문서화 모범적. 사소한 다이제스트 축약 표기·기처분 spec 갭만 INFO |
| dependency | LOW | 벤더 신뢰 축 재이동(12일 내 2차), 버전 고정은 우수 사례, 공급망 서명/스캔 검증 부재 |

## 발견 없는 에이전트

없음 — 실행된 4개 reviewer 모두 최소 1건 이상의 INFO 발견을 보고함(단, documentation은 종합 위험도 NONE으로 판정).

## 권장 조치사항

1. 병합 전 `plan/in-progress/minio-silo-image.md` §E 체크리스트의 "TEST WORKFLOW"·"`/ai-review`" 항목을 **실제 변경된 인프라 파일**(`docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`) 기준으로 완료 처리할 것 — §C 호환성 실측이 scratch/override 환경 대리 실행이었다는 점을 명시적으로 닫는다.
2. `docker-compose.yml`의 `minio_data` 볼륨 정의 주변 주석에 "이미지를 옛 MinIO로 되돌리면 LDAP 관련 경고가 남을 수 있다"는 한 줄을 추가해 다음 담당자의 오인을 방지.
3. (후속, 이번 PR 범위 밖) 이미지 태그+다이제스트를 3개 파일에 수동 중복하는 대신 `.env`/Makefile 변수로 단일화해 향후 갱신 시 부분 반영 재발을 구조적으로 차단.
4. (후속) 이미지 태그 갱신 시 Trivy/Grype 등 CVE 스캔 절차를 문서화해 공급망 신뢰 검증을 수동 1회 확인 이상으로 강화.
5. 이미 트래커에 등재된 "3번째 레지스트리 폐쇄 시 GHCR 미러링 재검토" 항목이 실제로 추적되고 있는지 확인(신규 조치 아님, 확인만).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `side_effect`, `documentation`, `dependency` (4명)
  - **제외**: 아래 표 (10명)
  - **강제 포함(router_safety)**: `dependency`, `documentation`, `security` — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 인프라 이미지 참조 교체로 성능 특성 변경 없음(router 판단, 세부 사유는 매니페스트에 개별 기재되지 않음) |
  | architecture | 코드 아키텍처 변경 없음(설정 파일 교체) |
  | requirement | 신규 요구사항/기능 변경 없음 |
  | scope | 스코프 관련 로직 변경 없음 |
  | maintainability | 코드 유지보수성 영역과 무관(순수 인프라 설정) — side_effect가 유사 관점(참조 중복 구조)을 일부 커버함 |
  | testing | 테스트 코드 변경 없음(단, side_effect가 plan 체크리스트의 TEST WORKFLOW 미완료를 별도로 지적함) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 동기화 대상 아님(내부 인프라 설정) |

- `routing_status=skipped`: 해당 없음(routing_status=done).
