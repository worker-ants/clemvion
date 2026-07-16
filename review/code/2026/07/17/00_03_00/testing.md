### 발견사항

- **[INFO]** 이번 diff 는 사실상 전부 문서(spec/plan/review 산출물) 변경이며, 실질 애플리케이션 코드 변경은 없음
  - 위치: 전체 29개 파일 중 `codebase/**` 실 소스는 `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 1건뿐
  - 상세: 나머지는 `.claude/docs/`, `CLAUDE.md`, `plan/**`(이동/신설/frontmatter 갱신), `review/consistency/**`(리뷰 산출물), `spec/**`(frontmatter·Rationale·링크 경로 갱신) — 전부 "plan grooming"(완료 plan 이동, dead link 정정, `won't-do` 전환) 성격이다. 테스트 관점에서 신규 프로덕션 로직이 없으므로 "테스트 존재 여부/커버리지 갭/엣지 케이스/Mock" 항목은 해당 사항 없음.
  - 제안: 조치 불요(참고 기록).

- **[INFO]** 유일한 테스트 파일 변경(`spec-link-integrity.test.ts`)은 주석(코멘트)만 수정 — 단언(assertion)·로직 변경 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:23-26`
  - 상세: diff 는 "scope(1) spec 본문 스캔에는 target filter 가 없어 `plan/**` 링크도 검사 대상"이라는 서술을 추가한 헤더 코멘트 변경뿐이다. `fmt()`/`describe`/`it()` 등 실제 테스트 바디는 무변경. 직접 실행해 회귀 확인함:
    ```
    npx vitest run src/lib/docs/__tests__/spec-link-integrity.test.ts
    → Test Files 1 passed (1) / Tests 13 passed (13)
    ```
    코멘트 내용도 실제 구현(`spec-links.ts` `findBrokenLinks()`)과 대조해 정확함(=`convention_compliance.md`/`cross_spec.md` 리뷰 산출물이 지적한 기존 `spec-impl-evidence.md §4.2` 서술 오류를 이 테스트 코멘트가 올바르게 정정).
  - 제안: 없음(정확성 확인됨).

- **[INFO]** 이번 PR의 실질적 "회귀 테스트" 역할은 기존 빌드 가드 테스트 스위트가 수행 — 전수 통과 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/{spec-link-integrity,plan-frontmatter,spec-status-lifecycle,spec-pending-plan-existence,spec-plan-completion,spec-area-index}.test.ts`
  - 상세: 이 PR 은 5개 plan 파일을 `in-progress/` → `complete/`(또는 신규 `research/`)로 이동시키고, 그 경로를 참조하던 spec 문서(§10-parallel, cross-node-warning-rules, execution-context, node-cancellation, mcp-client, rag-search) 링크·frontmatter(`pending_plans`, `status`)를 갱신했다. 이런 변경이 깨지면 정확히 이 가드 테스트들이 build 를 차단하도록 설계돼 있어, 별도 신규 테스트 작성 없이도 "plan 이동 후 dead link 없음"이 자동 검증된다. 직접 실행 결과:
    ```
    spec-link-integrity + plan-frontmatter + spec-status-lifecycle + spec-pending-plan-existence
      → Test Files 3 passed (3) / Tests 258 passed (258) [일부 조합]
    spec-plan-completion + spec-area-index
      → Test Files 2 passed (2) / Tests 657 passed (657)
    ```
    전부 그린 — 이번 PR 이 만든 plan 이동·spec 링크 갱신 세트가 기존 가드망을 실제로 통과함을 확인했다(기존 테스트가 이 종류의 변경에 대해 사실상 "테스트하기 쉬운 구조"를 제공하는 좋은 사례).
  - 제안: 조치 불요.

- **[INFO]** `plan/complete/rag-dynamic-cut.md` 가 자체 명시한 테스트 갭 — 새로 발견된 것 아니고 기존에 추적 중
  - 위치: `plan/complete/rag-dynamic-cut.md` 체크리스트 "eval-retrieval 동적컷 전/후 지표 비교 — 데이터 의존 블록"
  - 상세: dynamic-cut 로직 자체(off ceiling·token-budget·escalate·gradingNoGrounding)는 unit test + e2e 로 커버됐다고 명시하나, 실 골든셋 기반 정량 회귀 비교(NDCG 등)는 workspace/KB 데이터 의존이라 별도 plan(`rag-quality-improvement.md §7.B/C`)으로 이관돼 있다. 코드 정확성 테스트는 있으나 "품질 저하 여부"에 대한 정량 회귀 신호는 아직 없다는 뜻 — 이 PR 의 책임 범위 밖으로 이미 처분됐고 스스로 투명하게 문서화됨.
  - 제안: 조치 불요(이미 별도 로드맵에 추적됨).

- **[INFO]** `plan/complete/parallel-p2-followups.md` 의 "canvas-badge browser e2e won't-do" 결정 — 테스트 커버리지 트레이드오프가 명시적으로 근거화됨
  - 위치: `plan/complete/parallel-p2-followups.md` §2~4 종결 노트
  - 상세: 3중 가드(canvas 배지 / save-400 / 런타임 reject) 중 2개 층(save-400 e2e `graph-warning-save.e2e-spec.ts:113`, 런타임 reject 단언 `execution-engine.service.spec.ts:5575`)만 e2e/unit 로 잠그고, 나머지 UI 배지 층은 "에디터 e2e 인프라 부재 + 비용 대비 실익 부족"을 근거로 명시적으로 테스트 안 하기로 결정했다. 실 안전망(2개 층)이 이미 충분하다는 논리이며, 회귀 위험을 낮게 유지하는 정당한 스코프 축소로 보인다.
  - 제안: 조치 불요, 다만 캔버스 에디터 e2e 인프라가 다른 사유로 생기면 그때 이 시나리오를 우선 후보로 추가한다는 plan 자체 명시가 있어 추적 누락 위험은 낮음.

### 요약

이번 변경 세트는 실질적으로 애플리케이션 코드 변경이 없는 "plan/spec 정리(grooming)" PR이며, 유일한 코드성 파일 변경(`spec-link-integrity.test.ts`)도 테스트 로직이 아닌 주석 정정에 그친다. 테스트 관점에서 가장 중요한 확인은 이 PR이 수행한 plan 이동·spec 링크/frontmatter 갱신이 기존 빌드 가드 테스트(spec-link-integrity, plan-frontmatter, spec-status-lifecycle, spec-pending-plan-existence, spec-plan-completion, spec-area-index)를 실제로 통과하는지였고, 직접 재실행해 전수 그린을 확인했다(13+258+657 테스트 통과). 이 가드 스위트 자체가 이런 종류의 문서 재구성에 대한 자동 회귀 안전망 역할을 하고 있어 구조적으로 바람직하다. 문서 내에 self-report 된 두 가지 테스트 스코프 트레이드오프(rag-dynamic-cut 의 데이터 의존 정량평가 블록, parallel-p2-followups 의 canvas-badge e2e won't-do)는 모두 근거가 명시되어 있고 이번 PR이 새로 만든 문제가 아니므로 정보성으로만 기록한다.

### 위험도
NONE