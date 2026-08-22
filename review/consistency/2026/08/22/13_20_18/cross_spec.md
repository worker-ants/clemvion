STATUS=success cross_spec review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `plan/in-progress/mirror-guard-single-copy.md`

## 검토 범위 메모

target 은 `spec_impact: none` 인 순수 CI/test-infra 정리 plan 이다 (backend `masked-marker-mirror-guard.ts`/`masked-marker-mirror.spec.ts` 사본 삭제 + `.github/workflows/repo-guards.yml` 신설로 경로 게이팅을 CI 잡 레벨에서 제거). 새 엔티티·필드·endpoint·요구사항 ID·상태 머신·RBAC 규칙을 정의하지 않는다. `spec/` grep 결과 `masked-marker-mirror-guard.ts` / `masked-marker-mirror.spec.ts` 를 `code:` frontmatter 로 참조하는 spec 문서는 없다 — 삭제해도 spec-impl-evidence 가드(§4, `spec-code-paths.test.ts`)가 참조하는 dangling glob 이 생기지 않는다. `spec_impact: none` 은 [`spec/conventions/spec-impl-evidence.md` Gate C](../../../../spec/conventions/spec-impl-evidence.md) 의 no-op sentinel 로 유효하다. 따라서 관점 1(데이터 모델)·2(API 계약)·3(요구사항 ID)·4(상태 전이)·5(RBAC) 는 전부 해당 없음(N/A) 으로 판정한다.

## 발견사항

- **[INFO]** 같은 CI-경로-게이팅 근본원인에 대한 두 번째 해법인데 spec Rationale 이 서로를 참조하지 않음
  - target 위치: `plan/in-progress/mirror-guard-single-copy.md` "왜 사본이 둘이었나" 문단 (`이유는 순전히 CI 경로 게이팅이었다`) 및 "왜 공유 패키지가 아닌가" 문단 전체
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §"프리필 왕복" 하위 2026-08-21 결정 문단 (`미러를 기계가 대조하게 만들려 했더니 CI 경로 게이팅에 막혀 ... 값 자체를 옮겼다`)
  - 상세: 두 문서는 **동일 시스템(masked-marker)** 의 **동일 근본원인**(`frontend-checks`/`backend-checks` 의 비대칭 path 게이팅이 미러 대조를 무력화함)을 다루지만 서로 다른 결론에 도달한다 — spec 쪽은 "CI 게이팅을 직접 고치는 대신 값을 공유 패키지(`@workflow/masked-markers`)로 옮긴다"였고, target 은 "값이 아니라 CI 게이팅 자체를 전용 잡으로 없앤다"이다. 두 결론은 실제로 모순되지 않는다(전자는 두 런타임이 실제로 같은 값을 필요로 하는 production 코드, 후자는 test-only 가드로 러너 자체가 문제) — target 문서 자체도 이 구분(패키지 안은 "러너를 여전히 둘 유지해야 한다")을 정확히 짚고 있다. 다만 target 이 spec 의 2026-08-21 선례를 전혀 인용하지 않아, 나중에 이 spec 문단을 읽는 사람이 "CI 게이팅을 직접 고치는 안은 시도조차 안 됐다"고 오해하거나, 반대로 이 target PR 이 머지된 뒤 "그럼 masked-markers 패키지 분리도 되돌릴 수 있는 것 아니냐"는 재논의를 유발할 수 있다. `plan/in-progress/masked-marker-shared-package.md` (트래커 원문서) 의 "기각한 대안 — 계약 테스트를 양쪽에 중복 배치" 문단도 같은 맥락이나 plan↔plan 참조라 spec 정본에는 남지 않는다.
  - 제안: 필수는 아님(no functional conflict). 권장: target Rationale 에 `spec/5-system/14-external-interaction-api.md` 의 2026-08-21 결정을 1문장으로 교차 인용하거나(예: "이 PR 은 같은 CI 경로 게이팅 근본원인에 대한 test-only 해법이며, production 값 미러는 이미 §14 에서 공유 패키지로 해소됨"), 또는 §14 Rationale 쪽에 "test-only 가드의 미러는 별도로 CI 잡 통합(`repo-guards.yml`)으로 해소됨" 각주를 추가해 두 결정이 왜 다른 경로를 택했는지 향후 독자가 재추적할 수 있게 한다.

## 요약

target 은 프로덕션 스펙 표면(데이터 모델·API·요구사항 ID·상태 머신·RBAC)을 전혀 건드리지 않는 CI/test-infra 통합 plan 으로, `spec/**` 의 어떤 `code:` frontmatter 도 삭제 대상 파일을 참조하지 않아 spec-impl-evidence 가드와 충돌하지 않고 `spec_impact: none` 선언도 유효하다. 유일하게 주목할 지점은 동일 masked-marker 시스템·동일 CI-경로-게이팅 근본원인에 대해 `spec/5-system/14-external-interaction-api.md` 가 이미 다른(그러나 상충하지 않는) 해법을 문서화해 두었다는 점으로, 두 결정 사이의 상호 참조가 비어 있어 향후 재논의 리스크가 있는 정도의 INFO 사안이다. Cross-Spec 관점에서 target 을 그대로 진행해도 무방하다.

## 위험도
LOW
