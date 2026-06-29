# Plan 정합성 검토 결과

## 검토 대상

- **target 문서**: `spec/conventions/spec-impl-evidence.md`
- **변경 범위 (git diff origin/main...HEAD)**:
  1. `spec/conventions/spec-impl-evidence.md` §1 — `spec/data-flow/**` 의도적 제외 명시 + 제외 범위 한정 문구 추가
  2. `spec/conventions/spec-impl-evidence.md` R-10 신설 — `user_guide:` build-time 가드 미적용 근거
  3. `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` — 주석 2줄 변경 (`§4.2 knowledge-base/plan-integrity family` 분류 명시 + SoT 앵커 `§4.2` 추가)

---

## 발견사항

발견된 CRITICAL·WARNING·INFO 항목 없음.

### 검토 결과 요약

**미해결 결정과의 충돌 (관점 1)**
- `spec/data-flow/**` 의 frontmatter 제외는 이미 `spec-sync-data-flow-12-workspace-gaps.md` 가 "data-flow 문서라 frontmatter status 강제 대상은 아니다"(`plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` 9행)라고 일관되게 취급 중이다. target 이 이 기정 사실을 문서화한 것이므로 새로운 결정 우회가 아니다.
- `user_guide:` build-time 가드 미적용(R-10)은 진행 중 plan 어디에도 "결정 필요"로 등재된 항목이 아니다. 이미 기존 관행(가드 미존재)을 사후 rationale 로 명문화한 것이므로 일방적 결정 우회 해당 없음.
- `spec-area-index.test.ts` 주석 변경은 코드 동작 무변경이다.

**선행 plan 미해소 (관점 2)**
- target 의 전제 조건 중 아직 해결 안 된 선행 plan 없음. `spec/data-flow/` 관련 작업은 모두 data-flow 내용(본문 drift)이고, frontmatter 적용 여부는 이미 기정 방침이다.

**후속 항목 누락 (관점 3)**
- `spec-area-index.test.ts` 주석이 `spec-impl-evidence.md §4.2` SoT 를 가리키도록 갱신됐으므로, 앞으로 §4.2 절을 이동·폐지할 때 해당 주석도 함께 갱신해야 한다는 약한 의존이 생긴다. 그러나 이 변경이 §4.2 자체를 신설한 것이 아니라 기존 §4.2 포인터를 정밀화한 것이므로 별도 후속 plan 이 필요한 규모가 아니다.
- R-10(`user_guide:` 가드 미적용)에 "향후 전용 가드(`spec-user-guide-paths.test.ts`) 추가 시 §2.1·§4 표를 동기화한다"는 조건부 forward-ref 가 있다. 현재 해당 가드를 추가하는 진행 plan 이 없으므로 누락이 아니다.

---

## 요약

이번 변경은 `spec/conventions/spec-impl-evidence.md` 에 두 가지 clarification-only 추가(§1 data-flow 제외 명시, R-10 user_guide 가드 미적용 근거)와 `spec-area-index.test.ts` 주석 정밀화로 구성된다. 진행 중 plan 의 미해결 결정을 우회하는 사항이 없고, 선행 plan 의존도 미해소 상태가 없으며, 후속 plan 을 새로 만들어야 할 정도의 파생 변경도 없다. Plan 정합성 관점에서 문제 없음.

---

## 위험도

NONE
