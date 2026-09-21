# Rationale 연속성 검토 — spec/2-navigation (--impl-done)

## 검토 범위와 한계

- 검토 모드: `--impl-done`, scope=`spec/2-navigation`, diff-base=`origin/main`. 이 브랜치의 `spec/2-navigation` 델타는 0개 파일 — spec 문안 변경 없음. 실제 구현 diff 는 `codebase/backend/src/modules/model-config/model-config.service.ts` + 그 spec 테스트 + 신규 e2e(`model-config-delete-concurrency.e2e-spec.ts`) 3개 파일/316줄이며, prompt bundle 에서 예산 절단되어 있어 `git -C "<worktree>" diff origin/main...HEAD -- codebase/ spec/` 로 절대경로 직접 확인했다.
- target spec 영역 중 실 변경 코드와 관련된 문서는 `spec/2-navigation/6-config.md`(Part B: Models, `## Rationale` R-1~R-7) 다. bundle 에서 본문이 절단돼 있었으므로 절대경로로 직접 Read 했다. 함께 `spec/1-data-model.md §2.16 ModelConfig`(+ Rationale), `spec/2-navigation/2-trigger-list.md §4.4`(동시 삭제 패턴), `spec/5-system/3-error-handling.md`(`MODEL_CONFIG_NOT_FOUND` 등재부)를 대조했다.
- 동일 PR 에 대해 착수 전 `--impl-prep` 단계의 rationale-continuity 검토가 이미 수행돼 있다(`review/consistency/2026/09/21/16_16_35/rationale_continuity.md`, 위험도 NONE). 본 검토는 그 판단이 실제 구현·2 라운드 코드 리뷰(`review/code/2026/09/21/16_39_52`, `17_08_12`, 둘 다 CRITICAL/WARNING 0) 이후에도 유효한지 재확인하는 성격이다.

## 발견사항

이번 스코프에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

- **[정보 확인 — 위반 아님] 구현이 --impl-prep 시점에 검토된 계획을 그대로 따름**
  - target 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `remove()` (실측: `repo.remove(config)` → `repo.delete({id, workspaceId})` + `affected===0` 명시 비교로 `MODEL_CONFIG_NOT_FOUND` 던짐)
  - 과거 결정 출처: `plan/in-progress/modelconfig-dup-delete.md` §C(착수 전 실측 표) — 형제 계열(#1372~#1374)의 `RESOURCE_NOT_FOUND` 관용구를 베끼지 않고 기존 도메인 코드 `MODEL_CONFIG_NOT_FOUND`(`spec/5-system/3-error-handling.md:85`, "`RESOURCE_NOT_FOUND` 의 ModelConfig 특화 코드")를 보존하기로 명시. `spec/2-navigation/2-trigger-list.md §4.4` "동시 삭제: 두 번째는 404" 패턴과도 형태가 같다(진 쪽 404, 승자 204).
  - 상세: 코드 diff 는 위 plan 표와 1:1 대응하며 새로 도입된 설계 판단이 없다 — 이미 `--impl-prep` rationale-continuity 검토(16_16_35)가 "기각된 대안 재도입 없음 · 원칙 위반 없음"으로 판정한 그대로 구현됐다.
  - 제안: 조치 불필요.

- **[정보 확인 — 위반 아님] FK `ON DELETE SET NULL` 전제가 spec 과 일치**
  - target 위치: `model-config.service.ts` `remove()` 주석 — "`knowledge_base.rerank_config_id`(V090)·KB embedding(V091)은 `ON DELETE SET NULL` 이라 `remove(entity)`→`delete(criteria)` 전환이 동작을 바꾸지 않는다"
  - 과거 결정 출처: `spec/1-data-model.md:392`(`embedding_model_config_id … FK → ModelConfig (SET NULL · kind=embedding)`), `spec/1-data-model.md:407`(`rerank_config_id … FK → ModelConfig (SET NULL · kind=rerank)`)
  - 상세: 두 FK 모두 spec 이 이미 SET NULL 로 못박고 있어, 코드 주석의 "cascade 없음" 전제가 data-model Rationale/스키마와 어긋나지 않는다. cascade 훅·`@OneToMany` 부재 주장도 실제로는 코드 레벨 사실(별도 리뷰 라운드의 `database`/`concurrency` 에이전트가 이미 확인)이라 Rationale 층위의 문제는 아니다.
  - 제안: 조치 불필요.

- **[정보 확인 — 위반 아님] `spec/2-navigation/6-config.md` Rationale(R-1~R-7)에 이번 변경과 충돌하는 항목 없음**
  - target 위치: 해당 문서 없음(spec 델타 0) — 검토 대상은 "코드가 기존 R-1~R-7 중 어느 것도 재기각/번복하지 않는가"
  - 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale`(R-1 select-only, R-2 AuthConfig wiring, R-3 ModelConfig 단일화 번복, R-4 cohere Base URL, R-5 max_tokens 4096, R-6 §A.3 스키마, R-7 action-POST Editor 게이트)
  - 상세: 7개 항목 모두 select UX·권한·API shape·기본값에 관한 결정이며, 삭제 동시성·감사 중복은 이 문서에 아직 등재된 적이 없는 새 영역이다. 따라서 "기각된 대안 재도입"이나 "번복 없는 뒤집기"에 해당할 과거 결정 자체가 없다 — 새 Rationale 항목을 요구할 근거도 없다(코드 주석·plan·CHANGELOG 가 결정 근거를 이미 충분히 기록).
  - 제안: 조치 불필요. (참고: 이 결함 클래스의 형제 8건이 반복되는 동안 spec 쪽에 "동시 삭제 판별자 정책"을 일반화한 convention 문서는 아직 없다 — 9번째(WebAuthn) 착수 시점에 코드 review 가 이미 "architecture" 관점에서 공용 유틸 추출을 권고했으므로, 그 결정이 실제로 내려지면 그때 `spec/conventions/` 에 원칙을 문서화할지 여부를 판단하면 된다. 이번 PR 을 막을 사유는 아니다.)

## 요약

이번 PR 은 `spec/2-navigation` 을 변경하지 않는 codebase-only 수정(`ModelConfigService.remove()` 의 동시 DELETE 이중 감사 결함, 형제 8번째 자리)이며, 실제 구현은 착수 전 `--impl-prep` 단계에서 이미 위험도 NONE 으로 판정된 계획(`plan/in-progress/modelconfig-dup-delete.md`)을 정확히 그대로 따랐다. `spec/2-navigation/6-config.md`(Part B Models, R-1~R-7), `spec/1-data-model.md §2.16`, `spec/2-navigation/2-trigger-list.md §4.4`, `spec/5-system/3-error-handling.md` 를 대조한 결과 기각된 대안의 재도입, 합의된 설계 원칙 위반, 근거 없는 결정 번복, 또는 암묵적 invariant 우회는 발견되지 않았다. 두 차례 코드 리뷰(16_39_52, 17_08_12) 도 CRITICAL/WARNING 0 으로 수렴했고, 유일한 구조적 관찰(판별자 관용구가 8개 서비스에 공용 추상화 없이 복제)은 architecture 리뷰 자신이 "이번 PR 을 막을 사유가 아니다"로 명시한 차기 착수 시점 권고다.

## 위험도

NONE
