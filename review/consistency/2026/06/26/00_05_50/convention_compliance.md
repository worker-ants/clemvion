# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/web-chat-snippet-queue-stub.md`
검토 모드: `--impl-done` (구현 완료 후 검토)
diff-base: `origin/main`

---

## 발견사항

### [INFO] plan frontmatter 필수 필드 완비 — 이상 없음

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md` frontmatter (lines 1-8)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` + `.claude/docs/plan-lifecycle.md §4`
- 상세: `worktree: web-chat-snippet-queue-stub-629472`, `started: 2026-06-25`, `owner: developer` 세 필수 필드가 정상 선언돼 있으며 `plan-frontmatter.test.ts` 가드 요건을 충족한다. worktree 값이 실제 디렉토리 이름(`(unstarted)` sentinel 아님)이므로 착수 후 정상 교체된 상태다.
- 제안: 없음. 현재 상태 정상.

---

### [WARNING] `spec_impact` 필드 미선언 — Gate C 대상 (완료 이동 시 의무)

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md` frontmatter (lines 1-8)
- 위반 규약: `.claude/docs/plan-lifecycle.md §Gate C` + `spec/conventions/spec-impl-evidence.md §4.2 Gate C`
- 상세: 본 plan 의 `started: 2026-06-25` 는 Gate C cutoff(`2026-06-04`) 이후이므로, plan 을 `plan/complete/` 로 이동할 때 frontmatter 에 `spec_impact` 선언이 의무다. 현재 `in-progress/` 단계에서는 아직 강제 아님이지만, 구현 완료 후 PR 머지·완료 이동이 임박한 시점에서 미리 준비 필요. 본 작업은 plan 본문에서 `spec/7-channel-web-chat/2-sdk.md §1` 변경을 명시했으므로 `spec_impact: none` 이 아닌 해당 경로를 나열해야 한다.
- 제안: 완료 이동 커밋(`chore(plan): mark web-chat-snippet-queue-stub complete`)에 아래를 frontmatter 에 추가:
  ```yaml
  spec_impact:
    - spec/7-channel-web-chat/2-sdk.md
  ```

---

### [WARNING] `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시가 큐 스텁 없이 drift — diff 에 spec 변경 미포함

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md §수정 — 6곳에 동일 큐 스텁 추가` item 2
- 위반 규약: CLAUDE.md "정보 저장 위치 단일 진실 원칙"; `spec/conventions/spec-impl-evidence.md §1` spec↔구현 정합 원칙
- 상세: plan 본문 §수정 #2 에서 `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시에 큐 스텁 추가를 명시했으나, 제공된 git diff(`origin/main...HEAD`)에 `spec/` 경로 변경이 전혀 없다. diff 는 `codebase/frontend/src/` 하위 4개 MDX 문서와 `snippet.ts`·`snippet.test.ts` 만 포함한다. spec §1 스니펫 예시는 수정된 `buildWebChatSnippet` 출력과 drift 상태로 남아 있으며, plan 이 스스로 정의한 완료 기준을 충족하지 못하는 상태다.
- 제안: 구현 PR 전에 `spec/7-channel-web-chat/2-sdk.md §1` 의 `<script>` 첫 블록에 큐 스텁 라인을 추가한다. spec 변경은 `developer` 가 직접 할 수 없으므로 (`spec/` read-only) `project-planner` 로 위임하거나, CLAUDE.md 규약 상 "구현 중 spec 변경 필요 시 멈추고 project-planner 위임" 절차를 따른다.

---

### [INFO] 유저 가이드 MDX 4파일 변경 — user-guide-evidence 규약 관점 이상 없음

- target 위치: diff의 `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` 등 4파일
- 위반 규약: 해당 없음
- 상세: 4개 MDX 파일(한/영 각 2파일)에 큐 스텁 주석과 코드 라인이 추가됐다. 변경된 내용은 HTML code fence 안의 설치 스니펫 예시이며, frontmatter 구조·`spec:`/`code:` 키 등은 변경되지 않았다. user-guide-evidence 규약 관점에서 추가로 위반된 사항 없음.
- 제안: 없음.

---

### [INFO] `QUEUE_STUB_JS` 상수명 — 명명 규약 관점 이상 없음

- target 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/web-chat/snippet.ts` (diff +139)
- 위반 규약: 해당 없음 (`spec/conventions/` 에 TypeScript 식별자 명명 규약 별도 없음)
- 상세: `QUEUE_STUB_JS` 는 TypeScript `export const` SCREAMING_SNAKE_CASE 관용 패턴. `audit-actions.md` 의 언더스코어 구분자 규약은 감사 액션 문자열에 한정되므로 적용 대상 아님.
- 제안: 없음.

---

### [INFO] 테스트 파일 추가 — TDD/SDD 규약 준수 확인

- target 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts` (diff +109~+121)
- 위반 규약: 해당 없음
- 상세: 추가된 두 `it` 블록은 (a) `QUEUE_STUB_JS` 상수가 생성 스니펫에 포함됨, (b) 스텁 블록이 boot 블록보다 앞에 위치함을 검증한다. plan §테스트 항목과 대응하며 TDD 원칙과 일치한다.
- 제안: 없음.

---

## 요약

정식 규약 준수 관점에서 plan frontmatter 필수 3필드(`worktree`/`started`/`owner`)는 완비돼 있고, 코드·MDX 문서 변경은 명명·포맷 규약을 위반하지 않는다. 두 가지 WARNING 이 존재한다. 첫째, plan 완료 이동 시 Gate C 의무인 `spec_impact` 필드가 미선언 상태이며 본 작업이 `spec/7-channel-web-chat/2-sdk.md` 를 변경해야 하므로 `none` sentinel 이 아닌 해당 경로를 나열해야 한다. 둘째, plan 본문이 명시한 수정 항목 #2(`spec §1` 스니펫 예시 큐 스텁 추가)가 실제 diff 에 미포함돼 spec 과 구현이 drift 상태로 남아 있다 — 이 갭이 해소되지 않으면 plan 자체가 선언한 완료 기준을 충족하지 못한 채 PR 이 올라가는 위험이 있다.

---

## 위험도

MEDIUM
