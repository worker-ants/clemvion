# 변경 범위(Scope) 리뷰

리뷰 대상: render-presentation-button-click-fix worktree (24개 파일)
리뷰 일시: 2026-05-23

---

## 발견사항

### [INFO] plan 파일명과 함수명 불일치 — 허용 범위 내
- 위치: `plan/in-progress/render-presentation-button-click-fix.md` §C
- 상세: plan 원문은 helper 함수명을 `normalizeButtonIds` 로 기재했으나, 실제 구현(`render-tool-provider.ts`) 및 spec 갱신(`0-common.md §10.5 step 3`)에서는 `backfillButtonUuids` 로 확정됐다. 이는 consistency-check W5 권고(naming_collision.md — "backfillButtonUuids 류 명명 권장")를 반영한 범위 내 결정이며, plan-to-code 용어 통일이 안 된 것이지 scope 일탈이 아니다.
- 제안: plan 문서의 함수명 참조를 `backfillButtonUuids` 로 정정하면 좋으나 미수정이 현재 PR 범위를 벗어나지는 않는다.

### [INFO] `formConfig` 에도 `normalisedPayload` 적용 — 의도된 범위 확장
- 위치: `render-tool-provider.ts` 변경 +358 (form 분기 `formConfig: normalisedPayload`)
- 상세: plan 의 (C) 항목은 display-only 표현 도구(`carousel`/`table`/`chart`/`template`)의 button.id 보완을 기술한다. 그러나 구현에서 `form` 분기의 `formConfig` 에도 `normalisedPayload` 가 전달된다. `backfillButtonUuids` 함수 내부에서 `if (type === 'form') return payload;` 로 조기 반환하므로 실제 동작 변화는 없다. 코드 일관성을 위해 같은 변수를 사용한 것이며 side-effect 가 없다.
- 제안: 조기 반환으로 무해하나, 리뷰어 혼동 방지를 위해 form 분기에는 `capped.payload` 를 직접 사용하거나 주석으로 명시하면 더 명확하다. 허용 범위 내.

### [INFO] `review/consistency/` 산출물 파일 다수 포함 — 작업 프로세스 아티팩트
- 위치: `review/consistency/2026/05/23/10_28_45/` 및 `review/consistency/2026/05/23/10_42_12/` (파일 9~22번)
- 상세: 이 파일들은 구현 착수 전 필수 일관성 검토(`--impl-prep`, `--spec`) 결과물이다. CLAUDE.md 의 developer 워크플로 의무 단계에 해당하며, 의도하지 않은 추가가 아니라 규약 준수의 일부다. 코드 변경과 별개 경로(`review/consistency/`)에 격리돼 있어 구현 범위를 침범하지 않는다.
- 제안: 없음.

### [INFO] `plan/in-progress/spec-drift-parallel-count.md` 및 `plan/in-progress/spec-drift-ws-button-config.md` — 부수 발견 격리 문서
- 위치: 파일 7, 8
- 상세: 이 두 파일은 일관성 검토 중 발견된 본 작업과 무관한 spec drift 를 격리해 별도 plan 으로 등록한 것이다. 해당 파일들의 frontmatter 에도 `worktree: (TBD)` 로 명시되어 현 worktree 소유가 아님을 표시했다. 이는 발견된 부수 issue 를 현 PR 범위 밖으로 명확히 분리한 올바른 처리이다. 본 PR 에서 해결하지 않는 것이 적절하다.
- 제안: 없음.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.i 1행 수정
- 위치: 파일 23
- 상세: plan 의 (S) Spec 동반 갱신 항목에 명시된 변경이다. consistency-check(10_42_12 cross_spec.md W1)가 "§6.1.d.i 의 파이프라인 서술에 normalize 단계가 반영되지 않아 두 문서 간 기술 불일치"를 경고했고, 이를 해소한 것이다. 1행 수정(backfill 단계 cross-ref 삽입 + 섹션 제목 참조 갱신)이며 스펙 의미 변경은 없다.
- 제안: 없음.

---

## 요약

24개 파일 전체가 plan 의 명시된 작업 범위 (A) frontend `isSelected` 가드 수정, (C) backend `backfillButtonUuids` 추가, (S) spec 동반 갱신 3개 축과 일관성 검토 의무 단계 아티팩트로 완전히 설명된다. 의도 이상의 불필요한 리팩토링·기능 확장·무관 파일 수정·포맷팅 변경·임포트 정리는 발견되지 않았다. `form` 분기에도 `normalisedPayload` 변수가 전달되나 함수 내부 조기 반환으로 side-effect 가 없어 실질 범위 이탈이 아니다. `spec-drift-*` plan 파일 2건은 현 worktree 소유 표시 없이 등록돼 부수 발견이 현 PR 범위 바깥으로 올바르게 격리됐다. 전체적으로 변경 범위 관점에서 이상 없다.

---

## 위험도

NONE
