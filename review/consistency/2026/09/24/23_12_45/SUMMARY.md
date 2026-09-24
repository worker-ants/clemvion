# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical/Warning 0건. 전문 확보 실패 checker 없음(전원 인라인 전문 확보 + 디스크 파일 기확인).

## 전체 위험도
**LOW** — 실질 변경(3개 인프라 파일의 컨테이너 이미지 태그 교체)은 spec 무변경·신규 식별자 없음으로 4개 checker가 NONE 판정했고, plan_coherence만 추적 누락 위험(문구 정정·체크박스 종결)을 이유로 LOW를 매겼다. 전부 INFO 수준이며 즉시 조치 불요.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | spec가 "MinIO"를 벤더 불특정으로 서술 — `pgsty/silo`는 사실상 커뮤니티 포크지만 문서에 드러나지 않음 | `spec/0-overview.md` §2.7 | 여유가 있을 때 §2.7 표 "MinIO" 옆에 "(pgsty/silo, MinIO 호환 포크)" 각주 추가 검토. 이번 PR에 강제하지 않음 |
| 2 | rationale_continuity | 선행 기각 대안(`e2e-minio-registry.md`)과의 관계는 재도입이 아닌 후속 결정으로 정합 | `plan/in-progress/minio-silo-image.md` §B | 없음 (정합 확인 기록) |
| 3 | rationale_continuity | 아바타 공개 정책·KB 격리 invariant가 새 이미지에서도 실측으로 유지됨 확인 | `plan/in-progress/minio-silo-image.md` §C | 없음 (정합 확인 기록) |
| 4 | convention_compliance | target 문서(spec 번들)와 실제 작업 diff 범위(인프라 3파일) 불일치 — 스코프 산정이 무관한 spec 다발을 끌어옴 | 프롬프트 번들 전체 | 이번 건은 비차단 통과. orchestrator의 impl-prep 스코프 산정 로직이 인프라 전용 변경에도 무관 spec을 번들하는지 별도 점검 권장 |
| 5 | convention_compliance | `spec/conventions/**` 대부분이 컨텍스트 예산 초과로 절단되어 근거 확인 불가(`error-codes.md`/`node-output.md`/`swagger.md` 포함) | 프롬프트 번들 969행 이후 | 이번 target은 API 계약을 다루지 않아 영향 낮음. 향후 API 계약 target 검토 시 절단된 conventions 별도 조회 필요 |
| 6 | plan_coherence | `spec-sync-external-interaction-api-gaps.md`의 "재검토 불요 — 다시 열지 말 것" 문구가 quay.io 401로 반증된 전제 위에 남아 있음 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (해당 라인) | 구현 커밋에서 해당 문장을 취소선 처리하거나 "2026-09-24 재차 반증됨 → minio-silo-image.md 참고"로 명시 정정할 것 |
| 7 | plan_coherence | `plan/complete/e2e-minio-registry.md` §후속 등재의 미체크 2항목(`:latest`→RELEASE 고정, 트래커 관계 종결)이 이번 diff로 종결되는데 체크리스트 문구가 파일 경로를 특정하지 않음 | `plan/complete/e2e-minio-registry.md` §후속 등재 | 종결 커밋에서 해당 완료 문서의 두 체크박스도 함께 `[x]`로 갱신 |
| 8 | plan_coherence | `pgsty/silo` 채택으로 self-hosting 기본 이미지가 다시 Docker Hub 익명 pull에 의존 — 12일 내 두 번째 레지스트리 폐쇄 이후 세 번째 벤더로 재노출 | `plan/in-progress/minio-silo-image.md` §B | 차단 사유 아님. 동일 사고 3회째 재발 시 GHCR 미러링 재검토 후보로 올리도록 한 줄 메모를 minio-silo-image.md 또는 후속 트래커에 남기는 것을 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target이 실제로는 무수정 기존 spec, 이번 변경도 spec 미서술 영역(이미지 태그)만 건드려 6개 관점 전부 충돌 표면 없음. k8s 아바타 정책 누락은 기존 gap으로 이미 트래킹됨 |
| rationale_continuity | NONE | 선행 결정(`#1325`)의 기각 대안 재도입 없음, invariant(버킷 정책) 실측 유지, 유보 사항(다이제스트) 이행. "MinIO" 고유명사 vs 실제 포크 표기 틈만 INFO |
| convention_compliance | NONE | diff가 spec 파일을 전혀 건드리지 않아 5개 규약 관점 위반 대상 자체가 없음. 스코프 산정·컨텍스트 절단은 프로세스 참고사항 |
| plan_coherence | LOW | 미해결 결정 우회·선행 조건 위반 없음. 다만 추적 누락 위험(반증된 전제 문구 미정정, 완료 plan 체크박스 미종결) 3건 |
| naming_collision | NONE | 서비스명·볼륨명·환경변수·헬스체크 경로 등 기존 식별자 전부 보존, 신규 식별자 도입 없음. `silo`/`pgsty` grep 0건으로 기존 의미와 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 참고용) 구현 커밋 시 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 "재검토 불요" 문구를 취소선/정정 처리한다 (INFO #6).
2. 종결 커밋에서 `plan/complete/e2e-minio-registry.md` §후속 등재의 미체크 2항목을 `[x]`로 갱신한다 (INFO #7).
3. 여유가 되면 `spec/0-overview.md` §2.7에 "MinIO(pgsty/silo, 호환 포크)" 각주를 남긴다 (INFO #1, 선택 사항).
4. 향후 유사 레지스트리 사고 재발 시 GHCR 미러링을 재검토 후보로 올릴 수 있도록 한 줄 메모를 남긴다 (INFO #8, 선택 사항).
