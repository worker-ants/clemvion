# Plan 정합성 검토 결과

target: `plan/in-progress/spec-update-embedding-testconnection.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [INFO] unified-model-management.md §7 W4 참조가 오래된 상태임

- **target 위치**: target §1 "관련 백로그: `plan/in-progress/unified-model-management.md §7 W4` (forwardRef 순환 의존 해소 예정)" 및 §3 동일 참조
- **관련 plan**: `plan/in-progress/unified-model-management.md §7 W4 / §이미 처리됨`
- **상세**: target 이 `§7 W4 forwardRef 순환 의존 해소` 를 "예정" 백로그로 참조하고 있으나, `unified-model-management.md §이미 처리됨` 에 "forwardRef 순환 의존 해소 (b1c37ac1)" 가 이미 완료 처리되어 있다. 단 §7 W4 항목 자체는 여전히 "PR4 alias 모듈 제거 시 함께 처리"라는 **PR4 대기 상태**가 혼재하므로 완전히 해소됐다고 볼 수는 없다 — `preview-llm-models.dto` 이동으로 근본 원인만 해소, alias 모듈 제거(PR4)는 미완. target 이 "예정"으로 표기한 것 자체는 사실이나, "완료" vs "PR4 대기" 를 명확히 구분하지 않으면 독자가 혼동할 수 있다. 차단 요인은 아님.
- **제안**: target 의 W4 참조 문구를 "근본 원인 해소 완료(b1c37ac1), alias 모듈 정리(PR4)는 별도 진행 중" 으로 구체화하면 정확도 개선됨. 필수가 아닌 정합 개선 권고.

---

### [INFO] spec-update-pr2-embedding.md (동일 worktree) 와의 범위 중복 — 저위험

- **target 위치**: target 전체 (`spec/5-system/7-llm-client.md`, `spec/2-navigation/6-config.md §B.3·§B.5`)
- **관련 plan**: `plan/in-progress/spec-update-pr2-embedding.md` (worktree: `unified-model-mgmt-5af7ee`)
- **상세**: `spec-update-pr2-embedding.md` 는 `spec/5-system/8-embedding-pipeline.md` 와 `spec/1-data-model.md §2.11` 를 대상으로 한다. target 은 `spec/5-system/7-llm-client.md` 와 `spec/2-navigation/6-config.md §B.3·§B.5` 를 대상으로 한다. 파일 단위로는 직접 겹치지 않는다. 단, 두 draft 모두 **embedding testConnection** 관련 동작을 각기 다른 spec 파일에 기술한다는 점에서 서술 일관성 관리가 필요하다. 두 plan 이 동시에 project-planner 에게 반영 요청될 때 `spec-update-pr2-embedding.md` 의 폴백 체인 설명과 target 의 probe 전략 표가 모순 없이 정렬돼야 한다.
- **제안**: target 을 반영할 때 `spec-update-pr2-embedding.md §2` 의 폴백 체인(§5.5) 과 target §1 의 probe 표가 `resolveEmbedding()` 동작을 동일하게 서술하는지 교차 확인 권고.

---

### [INFO] unified-model-mgmt-5af7ee worktree 의 spec 파일 수정과 target 의 spec 영역 경계 확인

- **target 위치**: target §2·§3 (`spec/2-navigation/6-config.md §B.3·§B.5`)
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree: `unified-model-mgmt-5af7ee`, PR #545 OPEN)
- **상세**: `unified-model-mgmt-5af7ee` 브랜치(PR #545 OPEN)가 현재 `spec/2-navigation/6-config.md` 를 수정한 파일로 포함하고 있다. target 도 `spec/2-navigation/6-config.md §B.3·§B.5` 를 변경 대상으로 삼는다. 그러나 target 은 아직 실제 spec 파일에 변경을 가하지 않은 "draft plan 문서" 단계이며, `fix-embedding-test-dimension-a3d42a` worktree 의 현재 변경 파일 목록에 `spec/` 파일이 없다. 따라서 현 시점에서는 동시 편집 경합(race)이 발생하지 않는다. 다만 target 이 실제 spec 반영 단계로 진입하려면 PR #545 의 `spec/2-navigation/6-config.md` 변경이 먼저 머지돼야 한다 — 그 전에 반영하면 merge conflict 발생 가능. 이는 plan 이 이미 "spec 변경 전 `consistency-check --spec` 실행" 을 선행 조건으로 명시하고 있어 process 상 통제됨.
- **제안**: target 의 "우선순위 및 연동" 항에 "PR #545(unified-model-mgmt PR4) 가 `spec/2-navigation/6-config.md` 를 수정 중이므로 해당 PR merge 후 반영 권고" 를 추가하면 충돌 예방 효과가 있다.

---

### [INFO] B.3 연결 테스트 spec 현황 — target 의 before 인용이 간소화된 표현임

- **target 위치**: target §2 "Before (현재 — dimension 자동 감지·read-only 미명시): `연결 테스트 버튼으로 API 키 유효성 확인.`"
- **관련 plan**: 현행 `spec/2-navigation/6-config.md §B.3`
- **상세**: 현재 spec §B.3 의 실제 내용은 "간단한 API 호출(예: 모델 목록 조회)로 연결 확인 / 성공: 'Connected' 표시 / 실패: 에러 메시지 표시" 로 target 의 before 인용보다 구체적이다. Before 인용을 단순화해 제시한 것 자체는 draft plan 관행상 무해하나, 실제 반영 시 기존 §B.3 의 chat 연결 테스트 기술을 지우는 것인지, embedding 분기만 추가하는 것인지 명확히 해야 한다. target 의 after 안은 chat/embedding 분기를 추가하므로 **기존 §B.3 내용을 대체(replace)가 아닌 확장(augment)** 하는 것이 의도에 부합한다.
- **제안**: target "After" 안에 기존 chat 연결 테스트 설명(모델 목록 조회 경량 호출, Connected/에러 표시)을 보존하고 embedding 분기를 추가하는 형태로 명확히 표기 권고.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 `spec/2-navigation/6-config.md` 동시 수정이 발견됐다: `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-pr4`).

stale 판정 cascade 결과:
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-pr4`) —
  Step 1: `git merge-base --is-ancestor` exit 1 (ACTIVE — branch HEAD 가 origin/main 에 없음).
  Step 2: `gh pr list --head claude/unified-model-mgmt-pr4 --state all` → PR #545 state=OPEN → **ACTIVE**.
  결론: active 로 분류. INFO 등급 처리(target 이 현재 spec 파일을 실제 수정하지 않아 즉각 경합 없음).

skip 된 stale worktree: **없음**.

---

## 요약

target `plan/in-progress/spec-update-embedding-testconnection.md` 는 PR #541 구현(embedding testConnection dimension 반환, kind-agnostic 설계, 프론트엔드 차원 자동감지 UX)을 spec 에 반영하는 정당한 SPEC-DRIFT draft 이다. Plan 간 미해결 결정과의 충돌은 없고, 다른 plan 이 "결정 필요"로 남긴 항목을 일방적으로 선점하는 사례도 발견되지 않는다. `unified-model-management.md §7 W4` 참조가 "예정" 표현으로 완료/미완을 혼재 서술하는 정확도 문제(INFO), `spec-update-pr2-embedding.md` 와의 서술 정합 점검 필요(INFO), PR #545 가 동일 spec 파일을 수정 중인 활성 worktree와의 반영 순서 조율 권고(INFO) 3건이 추적 가치가 있다. 선행 plan 미해소로 인한 차단 요인은 없으며, 후속 plan 을 무효화하는 변경도 없다. worktree 충돌 후보 1건(unified-model-mgmt-5af7ee) — stale 0건, active 1건 분석. 단 target 이 현재 spec 파일을 직접 수정하지 않은 draft 단계이므로 즉각 경합은 없다.

---

## 위험도

LOW
