# Cross-Spec 일관성 검토 — `spec-update-catch-all-terminal-contract`

## 검증 방법

target 문서가 인용하는 각 원문(`_layout.md:85`, `9-user-profile.md:155`, `10-auth-flow.md §7.2`,
`11-error-empty-states.md §1.3`)과 실제 구현(`codebase/frontend/src/app/(main)/[...rest]/page.tsx`)을
직접 대조했다. 제안 1·2·3 의 인용문·라인 번호·앵커는 전부 실제 파일과 일치했고, 코드의 주석(§`WorkspaceRedirect`
JSDoc)도 제안이 서술하는 이원화 계약과 정확히 일치한다. 제안 4 의 `code:` 글로브 갭도 세 문서 frontmatter 를
직접 열어 재확인했다 — 세 문서 모두 catch-all page(`(main)/[...rest]/page.tsx`)·`href.ts` 를 `code:` 에
포함하지 않는다는 주장이 사실과 일치한다.

target 은 새 엔티티·필드·API·요구사항 ID·상태 머신·RBAC 를 도입하지 않는다 — 기존에 구현·머지된 FE 라우팅
동작을 spec 문언에 사후 반영하는 순수 문서 보강이다. 따라서 아래 관점 1~5(데이터 모델/API 계약/요구사항
ID/상태 전이/RBAC)는 본 target 에 해당 사항이 원천적으로 없다.

## 발견사항

- **[INFO]** `data-flow/12-workspace.md` 도 catch-all 을 언급하지만 보강 대상에서 빠짐
  - target 위치: 배경 절 전체 (반증 대상 문서 3건: `_layout.md`·`9-user-profile.md`·`10-auth-flow.md`)
  - 충돌 대상: `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절, 311행
    ("slug 없는 라우트(docs·catch-all)에서는 종전대로 localStorage 힌트 기준")
  - 상세: 이 문서도 `(main)/[...rest]` catch-all 을 다루는 네 번째 위치다. 다만 여기서는 "흡수만 한다"는
    주장을 하지 않고 reconcile 우선순위(URL 우선 vs localStorage 힌트)만 서술하므로, target 이 닫으려는
    오독 경로("catch-all = 무조건 흡수")와 직접 모순되지는 않는다 — 반증되지 않으므로 충돌은 아니다.
  - 제안: 차단 사유 아님. 다만 project-planner 가 제안 1(`_layout.md` 각주)을 반영할 때, 완전성을 원하면
    이 문서에도 "`/w/` 접두는 terminal" 각주 참조를 한 줄 추가하는 것을 선택적으로 고려할 수 있다(제안 3 과
    동일하게 "선택" 표기로).

## 요약

target 이 인용하는 모든 원문 라인·앵커·코드 경로는 실측 검증 결과 정확했고, 실제 구현(`(main)/[...rest]/page.tsx`)의
동작·주석도 제안 문언과 정확히 일치한다. 제안은 기존 3개 문서(그리고 선택적으로 4번째 `11-error-empty-states.md`
표 1행)에 "이미 참인" 사실을 명문화하는 것이며 신규 엔티티·API·요구사항 ID·상태 전이·RBAC 를 도입하지 않으므로
Cross-Spec 충돌 표면 자체가 거의 없다. 유일한 관찰 사항은 `data-flow/12-workspace.md` 가 같은 catch-all 컴포넌트를
다루는 네 번째 문서라는 점인데, 그 문서의 기존 서술이 "흡수만 한다"는 주장을 하지 않아 반증되지 않으므로 INFO 로만
기록한다.

## 위험도
NONE
