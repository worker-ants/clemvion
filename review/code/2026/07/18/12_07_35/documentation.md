# 문서화(Documentation) 리뷰

대상: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`,
`codebase/frontend/src/lib/conversation/interaction-type-registry.ts`

## 발견사항

- **[INFO]** "Adding a new value" 체크리스트에 값-목록 SoT(`interaction-type-registry.ts`) 갱신 단계가 명시적으로 없음
  - 위치: `interaction-type-exhaustiveness.test.ts` L48-53 (파일 최상단 JSDoc)
  - 상세: `WaitingInteractionType` 신규 값 추가 절차가 1) execution-store.ts 2) execution-engine.service.ts 3) spec 매트릭스 4) `REGISTRY_SITES` 파일들 로 나열되는데, `ENUM_VALUES`(=`INTERACTION_TYPE_VALUES`)가 실제로는 `interaction-type-registry.ts`에서 오고 이 파일을 갱신하지 않으면 새 값이 순회 대상(`ENUM_VALUES`)에 아예 들어가지 않아 이 exhaustiveness 테스트 자체가 그 값을 검사하지 않는다. 다만 이는 완전한 미검증은 아니다 — `interaction-type-registry.ts`의 `_noMissingInteractionType`(`Exclude` 양방향 잠금)이 `WaitingInteractionType`에 값이 추가되고 `INTERACTION_TYPE_VALUES`가 안 따라가면 별도로 `tsc` 컴파일을 깨뜨리므로(같은 파일 L72-76 주석이 이 관계를 설명), 최종적으로는 발견된다. 다만 "1→2→3→4" 순서로 따라가는 개발자에게 이 단계가 checklist에 없어 컴파일 에러로 우회 발견하게 되는 간접 경로다.
  - 제안: 체크리스트에 "0/1.5. `interaction-type-registry.ts`의 `INTERACTION_TYPE_VALUES`(및 `IS_MULTI_TURN_INTERACTION` Record)에 새 값 추가" 단계를 명시하면 컴파일 에러를 거치지 않고 바로 올바른 순서를 안내할 수 있다. Critical/Warning 아님 — fail-safe(컴파일 에러)가 이미 존재하므로 정보성.

- **[INFO]** spec(`spec/conventions/interaction-type-registry.md`)에 "grep 가드"/"grep 검증 대상"/"grep 대상 파일" 잔존 표현 — 본 두 파일과 용어 불일치
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1 두 행, §5 (리뷰 대상 파일 밖)
  - 상세: 리뷰 대상인 두 파일은 이번 변경(및 직전 커밋 cbb2a2fca)에서 "grep 가드" → "AST 가드" 표현을 정확히 정정했고(`git diff`로 확인, 두 파일 내 `grep` 잔존 0건), 코드 실제 동작(TS AST 파싱)과도 일치한다. 그러나 두 파일이 SoT로 참조하는 spec 문서는 여전히 "AST 가드"와 "grep 가드/grep 검증/grep 대상"을 혼용한다 — 예: §1.2 rule 3 "AST 가드(...)가 매트릭스의 모든 enum 값이 **등록된 grep 대상 파일**에 string literal 로 등장하는지 검증", §2.1 "AST 가드 대상 코드 파일(test `SOURCE_REGISTRY_SITES` — **grep 검증 대상**은 ...)". 코드와 spec 간 용어 drift.
  - 제안: 이미 `plan/in-progress/interaction-type-guard-comment-false-negative.md`의 "후속(본 PR 범위 밖)" 섹션에 `[project-planner]` 담당으로 정확히 추적되어 있음(3개 게이트 — impl-prep INFO#1·`/ai-review` SPEC-DRIFT#1·impl-done INFO#3 — 가 독립 지적, 비차단 판정, developer 는 `spec/` read-only 라 이월). 신규 발견 아님 — 별도 조치 불요, 추적 상태 확인차 기록.

- **[INFO]** 매우 상세한 "왜"(rationale) 중심 문서화 — 긍정 평가
  - 위치: 두 파일 전반 (`parseGuardSource`, `collectCodeStringLiterals`, `treeContainsJsx`, self-test 블록 등)
  - 상세: 각 헬퍼 함수·self-test 케이스가 "무엇을"이 아니라 "왜"(과거 회귀 PR 번호, mutation 실측 결과, 대안 기각 근거)를 설명하는 JSDoc/인라인 주석을 갖추고 있다. 특히 `parseGuardSource`가 파싱 단일 chokepoint임을 명시하고, self-test가 그 경로를 실제로 관통하도록 배선했다는 설명(L98-107)은 git history(commit 2765ed767, ef1227b76 시점 코드와 대조)로 검증했을 때 정확했다 — 과거 버전이 `scriptKindForFile`을 직접 호출하고 vacuous `.has("ai_form_render")`만 확인했다는 서술이 실제 커밋 diff와 일치.
  - 제안: 없음 (모범 사례로 기록).

## 요약

두 파일은 이번 변경(§ ai-review W1/W2 후속)에서 문서화 품질이 이미 매우 높은 수준으로 정리되어 있다. 함수별 JSDoc이 메커니즘뿐 아니라 과거 회귀·mutation 실측·대안 기각 근거까지 담고 있어 "왜 이렇게 만들었는가"가 코드만 읽어도 재구성 가능하며, git history 대조로 서술 정확성도 확인했다(오래된 주석·거짓 서술 없음). 유일한 실질적 갭은 파일 최상단 "Adding a new value" 체크리스트가 값-목록 SoT인 `interaction-type-registry.ts` 갱신을 명시적 단계로 나열하지 않는 것인데, 컴파일 타임 양방향 `Exclude` 잠금이 이를 fail-safe로 보완하므로 심각하지 않다. spec 문서의 "grep" 잔존 표현은 이미 plan에 project-planner 담당 후속 항목으로 정확히 추적 중이라 이번 리뷰에서 새로 지적할 사항이 아니다. README/CHANGELOG/API 문서 갱신은 이 변경(테스트 하네스 강화, 사용자 가시 동작 무변경)에 해당 사항 없음.

## 위험도

NONE
