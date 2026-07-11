### 발견사항

- **[WARNING]** CHANGELOG.md 미갱신 — 동일 영역 선행 PR 관례와 어긋남
  - 위치: `CHANGELOG.md` (이번 변경 세트 미포함), 대비 커밋 `4e1f665fc`(spec) / `f72a08963`(구현)
  - 상세: 이 저장소는 거의 모든 PR 에 대해 `## Unreleased — <제목> (<spec 경로> §<절>)` 형식의 `CHANGELOG.md` 항목을
    남기는 확립된 관례를 갖고 있다(최근 항목만도 EIA-RL-07 reaper, 위젯 coalesce/cancel §R9, `__` 예약 네임스페이스
    강제, KB WebSocket drift 등 전부 등재). 특히 `CHANGELOG.md` L28-34 는 **바로 이 파일**(`presentation.ts`/
    `presentations.tsx`)의 직전 truncation 버그 수정(PR #901)을 다룬 항목으로, 이번 변경과 스코프·파일이 정확히
    겹친다. 그런데 이번 변경 — 사용자 대면 배너 카피 변경(`총 N개 중 일부만 표시돼요.`) + `TableData.totalCount`
    신규 필드 + 기존 `~됩니다` 문구를 위젯 관례(해요체)로 정정 — 은 두 커밋(`4e1f665fc`, `f72a08963`) 어느 쪽에서도
    `CHANGELOG.md` 를 건드리지 않았다. `code-review-agents` 라우터도 CHANGELOG 갱신 필요성을 documentation
    리뷰어 스코프로 명시하고 있다(`.claude/skills/code-review-agents/lib/router_safety.py`).
  - 제안: `## Unreleased — 웹채팅 위젯 table 잘림 배너 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)` 항목을
    추가하고, `TableData.totalCount` 신규 필드·배너 문구 변경(해요체 정규화 포함)·wire/백엔드 무변경(기존
    `truncationMeta` dead field 소비 확장)이라는 사실을 기존 항목 스타일대로 서술할 것.

- **[WARNING]** `webchat-widget-presentation-followups.md` 트래커가 구현 완료 후에도 stale 상태로 방치
  - 위치: `plan/in-progress/webchat-widget-presentation-followups.md` 항목 1 (L15-19)
  - 상세: 이번 spec draft(`plan/in-progress/spec-draft-webchat-truncation-total-count.md` "## 후속 구현")는
    스스로 "구현 완료 후 `webchat-widget-presentation-followups.md` §미구현 항목 1 을 'table 부분 해소(본
    PR#), carousel 잔여(item 2 병합/의존)'로 재기술한다"고 약속했고, 동봉된 consistency-check
    (`review/consistency/2026/07/11/22_58_26/plan_coherence.md`)도 동일한 내용을 WARNING 으로 지적했다.
    그러나 구현 커밋(`f72a08963`, `presentation.ts`/`presentations.tsx`/테스트 전부 포함)까지 완료된 지금도
    `webchat-widget-presentation-followups.md` 항목 1 은 여전히 예전 문구("`TableData`/`CarouselData` 에
    `totalCount?: number` 추가 여부는 표면 확장이라 planner 결정 선행")를 그대로 유지한 채 미체크 상태다. 두
    커밋 모두 이 파일을 건드리지 않았다(`git show <sha> -- plan/in-progress/webchat-widget-presentation-followups.md`
    출력 없음). 후속 작업자가 항목 1 을 전부 미해결로 오독(중복 작업 위험)하거나, 반대로 여전히 미구현인
    carousel 잔여분까지 끝났다고 오판할 위험이 실재한다.
  - 제안: 항목 1 텍스트를 "table 부분 해소(PR `f72a08963`/`4e1f665fc`), carousel 잔여(항목 2 와 병합/의존)"로
    재기술(전체 체크 표시는 project-planner 규약상 여전히 금지이므로 텍스트만 갱신).

- **[INFO]** `presentations.tsx` `TableView` 배너 분기에 인라인 주석 없음 (경미)
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `TableView` 함수, `totalCount`
    유무에 따른 배너 문구 삼항식
  - 상세: 새로 추가된 `typeof totalCount === "number" ? ... : ...` 분기 자체에는 주석이 없다. 다만 동일 필드의
    fallback 규칙은 `presentation.ts` `TableData.totalCount` JSDoc 및 `toTable()` 내부 주석에 이미 명확히
    문서화돼 있어 실질적 이해에 지장은 없다. 코드도 3줄 이내로 짧고 자명하다.
  - 제안: 선택 사항 — 필요하면 `// totalCount 는 presentation.ts TableData JSDoc 참고` 정도의 1줄만 추가해도
    충분하며, 반드시 조치할 필요는 없음.

### 요약
핵심 구현 코드(`presentation.ts`)와 테스트(`presentation.test.ts`, `presentations.test.tsx`)의 문서화 수준은
높다 — 신규 `TableData.totalCount` 필드에 근거·소스(§10.4)·폴백 규칙을 명시한 JSDoc 이 붙어 있고, 흡수/투영 로직에도
정확한 인라인 주석이 달려 있으며, spec(`1-widget-app.md` §2/§R8) 갱신도 기존 4-타입 서술과의 스코프 불일치를
"table 한정" caveat 로 명시적으로 경계 지어 정직하게 반영했다. 다만 이 변경 세트는 프로세스 추적 문서 2곳에서
관례를 어겼다: (1) 저장소가 거의 모든 PR 에 대해 유지해 온 `CHANGELOG.md` 항목이 동일 파일·기능을 다룬 직전
항목(L28-34)과의 대칭성에도 불구하고 이번엔 누락됐고, (2) plan 문서 스스로 "구현 완료 후 갱신"을 약속하고
consistency-check 도 동일하게 지적한 `webchat-widget-presentation-followups.md` 트래커가 구현이 실제로 끝난
지금도 여전히 stale 상태로 남아 후속 작업자를 오도할 수 있다. 둘 다 코드 정합성엔 영향이 없는 WARNING 수준이다.

### 위험도
LOW
