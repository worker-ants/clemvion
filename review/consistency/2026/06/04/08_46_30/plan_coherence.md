### 발견사항

- **[WARNING]** `spec-drift-gates.md` §C 미결 체크박스와 target Gate C 구현의 설계 변경
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 Gate C + `spec-plan-completion.test.ts` + Rationale R-8
  - 관련 plan: `plan/in-progress/spec-drift-gates.md` §C "[ ] C 구현 + 테스트"
  - 상세: `spec-drift-gates.md §C` 는 "완료 plan 이 건드린 `code:` 코드가 변경됐으면 spec-update 또는 '불필요 명시' 강제"로 기술됐다. target 은 이를 git history 분석 대신 **`spec_impact` frontmatter 선언 방식**으로 대체 구현했다 (Rationale R-8 에 사유 명시). 설계 변경이 R-8 에서 문서화됐지만, `spec-drift-gates.md` 의 §C 체크박스는 `[ ]` 미갱신 상태로 남아 있다. 또한 `spec-drift-gates.md` 는 worktree `spec-drift-gates-b26bce` (PR MERGED, stale) 소속이라 이 plan 의 소유자가 결정을 추인했는지 명확히 드러나지 않는다.
  - 제안: `spec-drift-gates.md §C` 체크박스를 `[x]` 로 갱신하고 "설계 변경: `spec_impact` frontmatter 방식으로 구현 (R-8), `knowledge-base-quality-improvements.md` 에서 완료" 주석을 추가한다. `spec-drift-gates.md` 완료 조건(`C 구현 + D 구현`)이 충족됐으므로 complete 이동 여부도 함께 판단 권장.

- **[WARNING]** `spec-drift-gates.md` §D Gate D advisory 구현 — 동일 plan 에 기록됐으나 target 과 소유 plan 분리
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 Gate D 행 + `knowledge-base-quality-improvements.md §item 7`
  - 관련 plan: `plan/in-progress/spec-drift-gates.md` §D "[ ] D 구현"
  - 상세: Gate D(spec-coverage `--mode reverse`) 구현도 `knowledge-base-quality-improvements.md` 에서 `[x]` 처리됐지만, `spec-drift-gates.md §D` 의 체크박스는 `[ ]` 로 남아 있다. §C 와 동일 구조 문제.
  - 제안: `spec-drift-gates.md §D` 체크박스를 갱신하고, 두 항목 모두 완료됐다면 plan 을 complete 로 이동.

- **[INFO]** `plan/in-progress/fix-spec-frontmatter-catalog.md` — 후속 항목 중 "WARNING#2: §1 제외 기술 표현 명확화" 가 target 의 §4.2 신설 및 §1 제외 기술 변경과 연관
  - target 위치: `spec-impl-evidence.md §1` (제외 목록 기술)
  - 관련 plan: `plan/in-progress/fix-spec-frontmatter-catalog.md` §후속 WARNING#2
  - 상세: `fix-spec-frontmatter-catalog.md` 는 "§1 제외 기술이 basename-level 매칭보다 좁게 단수 경로로 기술 — 표현 명확화" 를 별 doc 수정 후속으로 남겼다. target 이 §1 을 건드리지 않았으므로 직접 충돌은 없지만, 동일 섹션에 대한 미결 작업이 존재한다. `fix-spec-frontmatter-catalog.md` 의 worktree `fix-spec-frontmatter-catalog` 는 PR MERGED (stale). 이 후속 항목은 별도 plan 이나 task 로 승격하지 않으면 추적 소실 위험.
  - 제안: `fix-spec-frontmatter-catalog.md` 의 WARNING#2 후속 항목을 별도 spec-only task 로 분리하거나, `knowledge-base-quality-improvements.md` 에 후속 항목으로 흡수.

- **[INFO]** `knowledge-base-quality-improvements.md §item 1` 의 spec-link-integrity 가드 — 아직 in-body 링크 수정 78건 미완료
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts` 를 build 차단 가드로 등재
  - 관련 plan: `plan/in-progress/knowledge-base-quality-improvements.md §item 1`
  - 상세: target 은 `spec-link-integrity.test.ts` 를 구현하고 spec-impl-evidence 에 build-차단 가드로 등재했다. 그러나 `knowledge-base-quality-improvements.md §item 1` 의 "`.kb-broken-links.tsv` confident 수정 78건 적용 → green 후 게이트 on" 체크박스는 `[ ]` 상태다. 즉 가드를 먼저 ON 했는데 링크 수정이 완료되지 않으면 build 가 red 가 된다. 현재 kb-quality 브랜치에서 링크 수정이 함께 이뤄졌는지, 아니면 별도로 진행 중인지 plan 에서 명확하지 않다.
  - 제안: item 1 의 링크 수정이 완료됐다면 체크박스를 갱신. 미완료라면 `spec-impl-evidence §4.2` 에서 `spec-link-integrity.test.ts` 를 "build 차단" 으로 선언한 것이 조기 등재가 되므로 주의. plan 에서 완료 여부를 명시하거나, 가드 ON 조건을 item 1 완료 후로 명기.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `fix-spec-frontmatter-catalog` (branch `claude/fix-spec-frontmatter-catalog`) — Step 2 PR MERGED
- `spec-drift-gates-b26bce` (branch `claude/spec-drift-gates-b26bce`) — Step 2 PR MERGED
- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 2 PR MERGED
- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 2 PR MERGED
- `spec-inprogress-groom-c7568b` (branch `claude/spec-inprogress-groom-c7568b`) — Step 2 PR MERGED
- `spec-exec-intake-queue` (branch `claude/spec-exec-intake-queue`) — Step 2 PR MERGED
- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 3 fallback ACTIVE (PR 없음, 해당 branch 는 spec-impl-evidence.md 를 건드리지 않음 — diff 확인됨)
- `makeshop-api-catalog-730deb` (branch `claude/makeshop-api-catalog-730deb`) — Step 2 PR MERGED
- `competitive-analysis-e0569b` (branch `claude/competitive-analysis-e0569b`) — Step 2 PR MERGED
- `integration-index-unify-2c7973` (branch `claude/integration-index-unify-2c7973`) — Step 1 ancestor STALE
- `impl-exec-intake-queue` (branch `claude/impl-exec-intake-queue`) — Step 1 ancestor STALE

worktree 가 활성으로 남아있을 이유가 없는 항목(PR MERGED / ancestor) 이 다수이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

### 요약

target(`spec/conventions/spec-impl-evidence.md`) 이 추가하는 §4.2 가드 family(Gate C/D, spec-link-integrity, spec-area-index, plan-frontmatter)와 신규 코드 파일 5건은 `knowledge-base-quality-improvements.md` plan 의 item 3·6·7 에 의해 정당하게 착수됐고, 미해결 결정을 일방적으로 우회하는 내용은 없다. 다만 Gate C/D 의 구현이 `spec-drift-gates.md` 의 미갱신 `[ ]` 체크박스와 사실상 충돌(설계 변경 포함)하므로 해당 plan 갱신이 필요하고(WARNING 2건), `spec-link-integrity.test.ts` build 차단 등재 시점과 링크 수정 완료 상태의 정합 확인이 필요하다(INFO 1건). worktree 충돌 후보 11건 전부 stale(MERGED/ancestor) 로 skip — active worktree 경합 없음.

---

### 위험도

LOW
