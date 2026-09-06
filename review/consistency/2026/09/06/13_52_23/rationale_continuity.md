# Rationale 연속성 검토 — `spec/conventions/review-citations.md` · `spec/conventions/spec-impl-evidence.md` (impl-done, 후속 재확인)

## 검토 전제

- `scope(spec/conventions)` 델타는 2개 파일: `review-citations.md`, `spec-impl-evidence.md`. 둘 다 전문을 직접 읽었다(번들 예산 절단 없음 — 두 파일은 프롬프트 앞부분에 완전히 실렸다).
- 구현 diff(`git diff origin/main...HEAD -- codebase`, 15파일/약 1,977줄)는 프롬프트 안에서 예산에 잘렸으나, 워킹트리 절대경로에서 직접 `git diff`·`git show`·`git blame`으로 재확인했다.
- 이 변경은 **이미 6차례 이상의 `rationale_continuity` 재확인**(`10_13_23`·`10_53_50`·`11_27_54`·`11_55_37`·`12_28_03`·`12_53_29`, 그리고 이 draft 자체를 대상으로 한 `13_06_22`·`13_18_59`)을 거친 planner 턴(`plan/in-progress/spec-draft-review-citations-enforcement.md`, owner: planner)의 최종 반영본이다. 본 라운드는 그 종결 조건 마지막 항목("`--impl-done` 재실행으로 Critical 해소 확인")에 해당한다.
- 직전 라운드들에서 발견된 이슈의 처리 상태를 diff 로 직접 재검증했다:
  - `13_06_22` **CRITICAL**("§3 DTO·컨트롤러 카브아웃 전체가 강제된다"는 변경안 (A)/(B)의 과대 주장, 같은 초안의 (C)와 자기모순) → 현재 spec 본문은 표를 "§3 — 응답 DTO JSDoc: 예" / "§3 — 컨트롤러 JSDoc: 아니오"로 명시적으로 분리해 **해소됨**을 확인.
  - `13_18_59` INFO#2(frontmatter `code:` 리스트에 준수 예시/시행 코드 구분 인라인 주석 없음) → 현재 diff 에 `# 준수 예시`/`# 시행 코드 — §3 의 **응답 DTO** 축을...` 인라인 주석이 실제로 추가됨을 확인.
  - `13_18_59` INFO#3("10개"가 `code:` entry 수와 무관하게 나란히 읽힘) → 현재 diff 에 "이 '10개'는 저장소 전체의 준수 예시 파일 수이지 `code:` entry 개수가 아니다" 각주가 실제로 추가됨을 확인.

## 발견사항

- **[정합 확인 — 위반 아님] `## Rationale` 원문 취소선 보존 + 날짜 있는 정정 블록 — 자기-반증형 소정정의 절차 요건과 일치**
  - target 위치: `review-citations.md` "`code:` 가 '구현 경로'가 아니라 '준수 예시'를 가리키는 이유" 절, `spec-impl-evidence.md` §2.1 `code` 행
  - 과거 결정 출처: 반증 대상 문장("이 규약에는 시행하는 코드가 없다")은 `git blame` 확인 결과 `90c1751e8`(2026-09-05, PR #1287, worker-ants)이 등재한 것으로, **이 세션(`user-entity-column-defense`)의 developer 가 쓴 문장이 아니다.**
  - 상세: CLAUDE.md 자기-반증형 소정정 예외의 조건 1("developer 자신이 그 문서에 써 넣은 예고 문장")이 성립하지 않으므로 developer 가 직접 고칠 수 없고, 실제로 `plan/in-progress/spec-draft-review-citations-enforcement.md`(`owner: planner`)이 별도 planner 턴을 열어 처리했다 — 우회 없이 올바른 경로를 탔다. 원문은 삭제하지 않고 취소선으로 남겼고, 정정 사유(신규 가드 존재 + 그 근거 리뷰 인용)를 날짜와 함께 명시했다. **결정의 무근거 번복(점검 관점 3)에 해당하지 않는다.**
  - 제안: 없음(정합).

- **[정합 확인 — 위반 아님] 신규 강제 범위(§3 응답 DTO 축만)를 "§3 전체"로 부풀리지 않음 — 이 문서 자신의 과거 Rationale이 세운 "실측 없는 범위 확장 금지" 원칙을 이번엔 지킴**
  - target 위치: `review-citations.md` 정정 블록 내 표(§2/§3-DTO/§3-컨트롤러 3행), `spec-impl-evidence.md` §2.1 `code` 행의 "§2 축은 여전히 미강제, §3 DTO 축만 강제, 컨트롤러 축은 미강제" 서술
  - 과거 결정 출처: `review-citations.md` `## Rationale` 기존 항목 2건 — *"`spec/**`을 '위반 0건'이라 적었다가 반증됐다"*(*"범위를 넓히는 편집은 그 범위를 재는 일까지 포함한다"*), *"이 수치를 처음 셀 때 거짓 0을 냈다"*(*"0은 언제나 '없다'와 '못 찾았다' 두 가지다"*).
  - 상세: `dto-jsdoc-citation-guard.ts`를 직접 확인한 결과 `isResponseDtoFile()`로 `dto/responses/**`만 스캔하며 컨트롤러 파일은 대상이 아니다(`13_06_22` CRITICAL이 지적했던 과대 주장이 이번 최종본에서는 DTO/컨트롤러를 표로 명시 분리해 정확히 반영됨). 같은 문서가 과거에 두 번 실측 없이 범위를 넓게 적어 반증당한 실패 양식을, 이번 정정에서는 반복하지 않았다.
  - 제안: 없음(정합).

- **[정합 확인 — 위반 아님] 신규 `code:` 등재(`dto-jsdoc-citation*.ts`)는 §Rationale "기각한 대안 — 넓은 트리 glob"과 충돌하지 않음**
  - target 위치: `review-citations.md` frontmatter `code:` 3번째 항목
  - 과거 결정 출처: `review-citations.md` `## Rationale` — *"기각한 대안 — `codebase/backend/src/**` 처럼 넓은 트리를 적기: 가드는 통과하지만 … 아무것도 가리키지 않는 것과 같다."*
  - 상세: 신규 glob `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts`는 실제로 `dto-jsdoc-citation-guard.ts`·`dto-jsdoc-citation.spec.ts` 정확히 2개 파일만 가리키는 좁은 패턴이며(디렉토리 전체가 아님), 기각된 "넓은 트리" 패턴을 재도입한 것이 아니다. glob 폭이 `-guard*.ts`로 더 좁아지면 fixture 대조군이 사는 `.spec.ts`가 빠진다는 것도 plan(`13_06_22` W2)에서 이미 실측 검증됨.
  - 제안: 없음(정합).

- **[INFO] `spec/5-system/2-api-convention.md`·`swagger.md §5-1`의 "두 검증자" 서술이 이번에도 3축(구조/이름/JSDoc)을 반영하지 못한 채 남아 있음 — 이 target 의 결함이 아니라 기추적된 별도 gap**
  - target 위치: (target 자체는 무변경) `spec/5-system/2-api-convention.md#검증-층`, `spec/conventions/swagger.md §5-1`
  - 과거 결정 출처: 커밋 `21182db02`("§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")가 세운 관례 — 신규 검증자는 관련 문서 양쪽에 개수·경계를 정확히 반영.
  - 상세: 이번 라운드의 target(2개 파일)은 이 서술을 건드리지 않으며, `plan/in-progress/spec-draft-review-citations-enforcement.md` "함께 처리할 것 ①"에 이미 planner 후속 항목으로 명시돼 있어 방치된 채 새로 발견된 gap이 아니다. `review/consistency/2026/09/06/12_53_29` WARNING과 동일 사안의 재확인일 뿐이다.
  - 제안: 없음(이 target 의 종결 조건이 아님). 후속 planner 턴에서 `spec-draft-nullable-notation-followups.md` 항목으로 처리 예정인 것을 그대로 유지.

## 요약

`review-citations.md`·`spec-impl-evidence.md`의 이번 변경은 `## Rationale`에 이미 기록된 "시행 코드가 없다"는 전제가 `dto-jsdoc-citation-guard.ts` 신설로 반증된 것을 다루는 자기-반증형 정정이다. 원문은 취소선으로 보존하고 날짜 있는 정정 블록·실제 존재하는 리뷰 인용(`review/code/2026/09/06/12_28_02` W2 등, 직접 대조로 실재 확인)으로 근거를 남겼으며, 자신이 과거 두 차례 저지른 "실측 없는 범위 확장" 실패를 이번 §3 DTO/컨트롤러 축 구분에서는 반복하지 않았다(§3 전체가 아니라 DTO 서브셋만 강제됨을 명시). 신규 `code:` glob 도 과거 기각된 "넓은 트리" 대안을 재도입하지 않는다. 이 변경은 이미 6차례 이상의 rationale-continuity 재확인을 거치며 발견된 유일한 CRITICAL(§3 범위 과대 주장, `13_06_22`)이 최종본에서 해소된 상태이고, 후속 INFO 제안 2건(`13_18_59`)도 이번 diff 에 반영됐다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, 시스템 invariant 우회 — 4개 점검 관점 모두에서 새로운 위반을 발견하지 못했다.

## 위험도

NONE
