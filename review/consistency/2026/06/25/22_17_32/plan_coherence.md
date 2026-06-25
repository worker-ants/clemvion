# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상: refactor 03 m-3 — `integrations/new/page.tsx` behavior-preserving 분할
날짜: 2026-06-25

---

## 발견사항

### [INFO] 훅 이름 불일치: plan m-3 `useDraftRestore` vs 구현 대상 `useUnsavedChangesWarning`

- **target 위치**: 검토 모드 scope 설명 — `useUnsavedChangesWarning(beforeunload 이탈 가드 §3.6)` hook 으로 추출 예정
- **관련 plan**: `plan/in-progress/refactor/03-maintainability.md` §m-3, "개선 방안" 항목 2번 — `useOauthPopupReturn`/`useDraftRestore` hook 으로 추출 명시
- **상세**: plan 본문(03-maintainability.md m-3 §개선 방안 2번)은 이탈 복원 hook 을 `useDraftRestore` 라 명명한다. 그러나 구현 착수 scope 서술은 동일 hook 을 `useUnsavedChangesWarning` 으로 명명한다. spec §3.6("beforeunload 에서 입력 중인 자격 증명이 있으면 경고")은 hook 이름을 규정하지 않으므로 어느 이름이든 spec 위반은 아니나, plan 이 "결정 전 논의 필요" 없이 이름을 이미 명기한 상태에서 구현이 다른 이름으로 확정했다. plan m-3 의 hook 이름 기록을 실제 구현 이름으로 갱신하면 이력 추적이 일관해진다.
- **제안**: 구현 완료 후 plan 갱신 시 `useDraftRestore` → `useUnsavedChangesWarning` 으로 정정. 구현 착수를 차단하는 사안은 아님.

---

### [INFO] C-2 W7 백로그(multi-turn condition toolCallCount spec-drift) — m-3 와 직교, 추적 확인

- **target 위치**: 검토 모드 scope 설명 — spec 변경 없음 명시
- **관련 plan**: `plan/in-progress/refactor/03-maintainability.md` §C-2, "⚠️ W7 백로그(planner 위임)" — `meta.toolCalls` 와 multi-turn condition 합산 불일치, project-planner 위임 상태
- **상세**: C-2 W7 은 "multi-turn condition deferral 의 toolCallCount++ 가 spec §7.1 meta.toolCalls '조건 도구 제외'와 불일치" 로 project-planner 에 위임됐으나 아직 미해결이다. m-3 작업(integrations/new 분할)은 AI Agent handler 와 완전히 직교한 영역이므로 W7 의 미해결이 m-3 착수를 방해하거나, m-3 가 W7 해결 방식에 영향을 주지 않는다.
- **제안**: 추적 메모 수준. m-3 는 정상 착수 가능하며 W7 은 별도 planner 트랙에서 닫힌다.

---

## 미해결 결정 우회 여부 (관점 1)

plan/in-progress 전체에서 `integrations/new/page.tsx` 분할과 관련된 "결정 필요" 미해결 항목은 없다.

- **C-3 / M-4 deferral 결정 대기**: Cafe24/MakeShop API 클라이언트 공통화(C-3) 및 `integration-configs.tsx` 제네릭 추출(M-4) 은 사용자 결정 대기 중이나, 두 항목 모두 **backend API 클라이언트 / 설정 뷰 컴포넌트** 대상이며 `integrations/new/page.tsx` 분할(m-3)과 대상 파일이 겹치지 않는다. m-3 plan 각주("M-4 deferral 과 별건임을 유지해야 범위 혼선 없음")도 명시적으로 분리를 선언하고 있다.
- target 의 spec §3 상태 기계 경계 보존(§3.1/§3.5/§3.6/§5/§9.2) 은 spec 에 이미 확정된 내용이므로 미해결 결정을 일방적으로 내리는 행위에 해당하지 않는다.

**결론: 미해결 결정 우회 없음.**

---

## 선행 plan 미해소 여부 (관점 2)

m-3 가 가정하는 사전 조건:

1. `spec/2-navigation/4-integration.md §3` 상태 기계 경계(§3.1/§3.5/§3.6/§5/§9.2) — spec 에 이미 존재, 해소 불요.
2. `cafe24-precheck.test` 통합 단위 테스트 — 기존 코드베이스에 존재하는 것으로 scope 서술이 명시. 별도 선행 plan 의존 없음.
3. `lib/integrations/` 디렉토리 신설 — 기존 spec frontmatter `code:` 에 `codebase/frontend/src/lib/integrations/*.ts` 가 이미 등재되어 있으므로 spec 갱신 없이 구현 가능.
4. e2e 는 Docker 레지스트리 아웃티지로 다른 머신 위임 — scope 서술이 사전에 명기하여 착수 차단 사유가 아님을 확인.

**결론: 선행 plan 미해소 항목 없음.**

---

## 후속 항목 누락 여부 (관점 3)

m-3 완료 시 영향을 받을 수 있는 plan:

- **spec/2-navigation/4-integration.md frontmatter `code:`**: 현재 `codebase/frontend/src/lib/integrations/*.ts` 와 `codebase/frontend/src/app/(main)/integrations/new/page.tsx` 가 이미 등재되어 있다. 분할 후 신규 `components/integrations/steps/*.tsx` 경로가 frontmatter `code:` 에 추가되어야 한다. 그러나 scope 서술이 "spec 변경 없음" 을 명시하고 있고, frontmatter `code:` 갱신은 spec 본문(행위 명세) 변경이 아닌 구현 파일 등록 업데이트이므로 별도 project-planner 위임 없이 developer 가 처리할 수 있는 범위다. `--impl-done` consistency check 에서 식별될 사안이며 착수 차단은 아니다.

- **C-3/M-4 deferral 결정**: m-3 완료 후 C-3/M-4 에서 `integration-configs.tsx` 추상화를 진행할 경우, m-3 가 분할한 steps/ 컴포넌트와의 경계가 명확해야 한다. 현재 plan m-3 §개선 방안 3번이 "M-4 의 제네릭 폼과 별건(이쪽은 Integration 생성 폼)" 임을 명기하고 있어 경계가 선언돼 있다.
  - **판정**: 후속 항목 영향 없음.

**결론: 착수 차단 수준의 후속 항목 누락 없음. frontmatter `code:` 신규 경로 등록은 --impl-done 단계에서 처리 가능.**

---

## 요약

`integrations/new/page.tsx` behavior-preserving 분할(m-3)은 `plan/in-progress/refactor/03-maintainability.md` 의 확정 착수 항목이며, 현재 미해결 결정 항목(C-3·M-4 deferral 대기, C-2 W7 planner 위임)은 모두 다른 파일·도메인에 속해 m-3 와 직교한다. plan 이 제공한 분리 경계(spec §3.1/§3.5/§3.6/§5/§9.2)는 spec 에 이미 확정돼 있고, 선행 plan 미해소 항목도 없다. 유일한 소견은 plan 본문의 `useDraftRestore` 이름과 구현 scope 서술의 `useUnsavedChangesWarning` 사이의 명칭 불일치(INFO — 구현 완료 후 plan 갱신 시 정정)와, spec frontmatter `code:` 신규 경로 등록이 --impl-done 단계에서 처리될 것임을 확인하는 수준이다. **착수를 차단하는 충돌·미해소 선행 조건은 없다.**

## 위험도

NONE
