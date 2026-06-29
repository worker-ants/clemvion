# Plan 정합성 검토 결과

검토 대상: `spec/conventions/spec-impl-evidence.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-29

## 변경 범위 요약

`git diff` 기준 실제 변경은 두 곳:

1. **§2.1 필드 정의 표** — `user_guide` 행 설명에 "가이드가 KO/EN 양쪽으로 존재하면 로케일 쌍 (`<name>.mdx` + `<name>.en.mdx`) 을 모두 등재 — §5.3 예시" 문구 추가.
2. **§5.3 예시** — `user_guide:` 블록에 `# KO/EN 양쪽 존재 시 로케일 쌍 모두 등재` 주석과 `telegram.en.mdx` 항목 추가.

이 변경은 이미 §5.3 예시에 암묵적으로 내포된 관행(기존 commits #773/#774 에서 telegram KO/EN 쌍 실제 적용)을 convention 문서에 명문화하는 설명 보강이다.

---

## 발견사항

### 발견사항 없음 (NONE)

plan/in-progress 전체에서 `user_guide` 필드 규약(로케일 쌍 등재 여부)을 **"결정 필요"** 로 열어둔 항목이 존재하지 않는다.

- `rag-rerank-followup.md`: `spec-impl-evidence §3` 을 참조하나 `user_guide` 필드와 무관 (pending_plans 메커니즘 언급).
- `spec-sync-structural-followups.md`: `spec-impl-evidence` 가드 면제 규칙(`0-overview.md` basename) 만 참조.
- `execution-engine-residual-gaps.md`: `pending_plans:` 유효성 관련 참조만 존재.
- 기타 plan 들(cafe24-backlog-residual, spec-sync-external-interaction-api-gaps, merge-p2-async-fanin 등): `.en.mdx` 언급이 있으나 `spec-impl-evidence` 의 `user_guide` 규약과 무관한 독립 작업.

선행 조건 미해소 없음: target 변경이 전제하는 "KO/EN 로케일 쌍 등재" 관행은 이미 #773/#774 커밋 (`spec/4-nodes/7-trigger/providers/telegram.md`, `slack.md`) 에서 실 spec 에 적용이 완료된 상태이고, 본 변경은 그 사실을 convention 에 반영하는 후속 문서화다.

후속 plan 무효화 없음: 변경이 기존 plan 들이 추적 중인 `pending_plans` 메커니즘·가드 동작·`status` 라이프사이클을 건드리지 않는다. `user_guide` 필드는 선택(optional) 이고 변경이 선택성 자체를 바꾸지 않는다.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 이번 변경은 `user_guide` 필드의 KO/EN 로케일 쌍 등재 관행을 §2.1 표와 §5.3 예시에 명문화한 소규모 설명 보강이다. plan/in-progress 에서 이 결정을 미해결로 열어둔 항목이 없고, 변경이 다른 plan 들의 선행 조건·후속 항목을 무효화하지 않는다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 중 어느 것도 해당하지 않는다.

## 위험도

NONE
