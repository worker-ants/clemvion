# Plan 정합성 Review

**Target**: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
**Worktree**: `cafe24-app-url-detail-a7c3f4`
**검토 모드**: spec draft 검토 (`--spec`)
**검토 시각**: 2026-05-16

---

### 발견사항

- **[WARNING]** `spec-update-cafe24-app-url-reuse` plan 과의 중복 영역 — `spec/2-navigation/4-integration.md` Rationale·§6
  - target 위치: 변경 4 (Rationale 신규 항 "Cafe24 App URL 상세 페이지 표시") + 변경 2 §4.2 표 (App URL 카드 추가)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — 영향 받는 spec 섹션 목록에 `spec/2-navigation/4-integration.md` §3.2, §4.4, §6, §9, §10.2, Rationale 가 모두 포함되어 있으며, 미완 체크박스 4개(`spec 갱신`, `backend 구현+테스트`, `frontend MCP UX 개선`, `plan complete 이동`) 가 열려 있음.
  - 상세: `spec-update-cafe24-app-url-reuse` 는 이미 Rationale 에 `install_token persistent 격상` 신규 항을 추가하는 작업을 담고 있고, §6 install_token 보존 정책 및 §9 App URL handler 분기 변경도 포함한다. target 의 변경 4 Rationale 항 "Cafe24 App URL 상세 페이지 표시"는 그 Rationale 섹션에 덧붙이는 항목이며, 변경 2 의 App URL 카드 노출(§4.2)은 `app_url`/`install_token` 노출 여부 정책에 의존한다. 두 plan 이 `spec/2-navigation/4-integration.md` 의 동일 섹션(Rationale + §4~§9 계열)을 병렬 수정 중이므로 merge conflict 가능성이 있고, `spec-update-cafe24-app-url-reuse` 의 spec 갱신이 먼저 반영되지 않으면 target 의 Rationale 항이 상위 맥락 없이 삽입되는 형태가 된다.
  - 제안: target plan 에 "`spec-update-cafe24-app-url-reuse.md` 의 spec 갱신(§6, §9, Rationale) 완료 이후 착수" 를 선행 조건으로 명시하거나, 동일 PR 에 통합을 검토한다. 현재 `spec-update-cafe24-app-url-reuse.md` 는 `cafe24-app-url-reuse-f9a2e3` worktree 에 배정되어 있으므로 target worktree(`cafe24-app-url-detail-a7c3f4`)와 별도 브랜치로 분리되어 있음 — 직렬화 표기 권장.

- **[WARNING]** `cafe24-spec-sync-e2a8b9` 브랜치가 `spec/2-navigation/4-integration.md` Rationale 을 이미 수정 중
  - target 위치: 변경 4 — `## Rationale` 섹션 신규 항 추가
  - 관련 plan: active worktree `cafe24-spec-sync-e2a8b9` 브랜치가 main 대비 `spec/2-navigation/4-integration.md` Rationale 섹션(`error(auth_failed)` 채택 결정 문구) 을 수정한 diff 가 확인됨. 이 브랜치에 대응하는 in-progress plan 은 main 에서 식별되지 않았으나(branches only, no plan file in main's in-progress), worktree 자체는 live 상태임.
  - 상세: `cafe24-spec-sync-e2a8b9` 의 diff 에서 Rationale 내 `expired status` 결정 항이 텍스트 수정됨. target 의 변경 4 는 동일 `## Rationale` 섹션 끝에 신규 항을 추가하는 것으로, 직접 덮어쓰는 것은 아니지만 두 브랜치가 같은 파일의 동일 구역에 변경을 가져 merge 시 conflict 가능성이 있다.
  - 제안: target plan 의 frontmatter 또는 선행 조건 섹션에 `cafe24-spec-sync-e2a8b9` merge 완료 후 착수 조건을 추가한다.

- **[WARNING]** `cafe24-w2-spec-d9f2a3` 브랜치가 `spec/2-navigation/4-integration.md` §11.2 알림 정책 섹션을 광범위하게 수정 중
  - target 위치: 변경 2 (§4.2 표) + 변경 4 (Rationale)
  - 관련 plan: active worktree `cafe24-w2-spec-d9f2a3` 가 main 대비 `spec/2-navigation/4-integration.md` §11.2, Rationale 에 다수 행 추가 (알림 발사 정책 정정·install_timeout 미발사 결정). 이 브랜치는 main 대비 Rationale 끝에 새 섹션 `### install_timeout 알림 미발사 (2026-05-16)` 을 추가하고 있음.
  - 상세: target 의 변경 4 Rationale 신규 항과 `cafe24-w2-spec-d9f2a3` 가 추가하는 Rationale 항이 동일 위치(섹션 끝)에 삽입되는 형태로 경합. 두 브랜치 모두 main 에 없는 새 Rationale 항을 끝에 붙이므로 merge 시 conflict 가 발생할 가능성이 있다.
  - 제안: `cafe24-w2-spec-d9f2a3` merge 완료 이후 target spec 작업을 진행하도록 plan 에 선행 조건 명시.

- **[WARNING]** `spec-update-cafe24-app-url-reuse.md` 의 미완 `spec 갱신` 항목이 선행 조건으로 미반영
  - target 위치: 변경 3 (`spec/2-navigation/4-integration.md` §9.1 GET 응답 shape 보강 — `appUrl: string | null` 추가)
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` — §9 API endpoint 분기 변경(status 별 redirect 정책), `appUrl` 필드 개념 자체가 이 plan 에서 결정됨. 미완 `[ ] spec 갱신` 체크박스.
  - 상세: target 변경 3 이 `appUrl` 필드를 GET 응답에 추가하는데, `spec-update-cafe24-app-url-reuse.md` 가 `appUrl`/`callbackUrl` 필드 개념(request_scopes 응답 shape의 `appUrl`) 을 먼저 정의한다. `spec-update-cafe24-app-url-reuse` 의 spec 갱신이 완료되지 않은 상태에서 target 의 변경 3을 적용하면, `appUrl` 필드의 원래 도입 맥락(request_scopes 응답)과 통합 상세 GET 응답의 `appUrl` 두 정의가 분리된 채로 spec 에 등장할 수 있다.
  - 제안: `spec-update-cafe24-app-url-reuse` spec 갱신을 먼저 완료한 후 target 의 변경 3을 해당 맥락과 통합해 작성하도록 선행 조건 명시.

- **[WARNING]** `cafe24-pending-polish-followup.md` 그룹 C/D 미완 항목이 `spec/data-flow/integration.md §1.4` 를 미래 수정 대상으로 표시 중
  - target 위치: 변경 1 — `spec/data-flow/integration.md` §1.2.1 line 90 정정
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` — 그룹 C(이슈 54): "`process()` 에러 격리 정책 spec 명시 — spec/data-flow/integration.md §1.4 에 명문화" (미완 `[ ]`).
  - 상세: target 의 변경 1 은 `spec/data-flow/integration.md` §1.2.1 단일 라인을 정정하는 것으로 §1.4 와 직접 충돌하지는 않는다. 그러나 두 작업이 같은 파일을 건드리므로, target 과 `cafe24-pending-polish-followup` 의 그룹 C 가 독립적인 다른 worktree 에서 병렬로 진행될 경우 merge 간섭 가능성이 낮지만 잠재적으로 존재한다.
  - 제안: 독립적인 섹션이므로 CRITICAL 수준은 아니나, target plan 에 "변경 1 은 §1.2.1 만 수정, §1.4 는 cafe24-pending-polish-followup 별도 처리" 를 주석으로 명시해 혼동 방지.

- **[INFO]** `spec-overview-ui-patterns-followup-2026-05-16.md` 의 `spec/2-navigation/4-integration.md §4.2` 수정 계획이 target 변경 2 와 동일 섹션 참조
  - target 위치: 변경 2 — `spec/2-navigation/4-integration.md` §4.2 표에 App URL 카드 행 추가
  - 관련 plan: `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` — `spec/2-navigation/4-integration.md §4.2` 의 "누락 scope 배지 (현행, red 톤)" 를 후속 작업으로 언급. worktree: TBD (미할당). 미완 `[ ]` 체크박스들.
  - 상세: 해당 plan 의 §4.2 수정은 scope 배지 추가이고 target 변경 2 는 App URL 카드 행 추가로 다른 행이지만, 동일 표를 건드리는 두 plan 이 병렬 진행될 경우 merge 시 context conflict 가 발생할 수 있다. `spec-overview-ui-patterns-followup` 은 worktree 가 TBD 로 아직 미착수이므로 현시점 직접 경합은 없다.
  - 제안: 추적 메모로 유지. target plan 의 변경 2 를 먼저 병합한 뒤 `spec-overview-ui-patterns-followup` 이 착수하면 경합이 해소된다.

- **[INFO]** `cafe24-pending-polish-followup.md` 그룹 E 이슈 67 — `spec/2-navigation/4-integration.md §6 mermaid install_token 보존 정책 명시` 미완
  - target 위치: 변경 4 Rationale — `install_token` 보존 정책이 Rationale 에 기재됨
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` 이슈 67 (미완): "§6 mermaid `install_token` 보존 정책 명시. callback 실패 시 install_token 유지 → 재시도 가능 (data-flow §1.2.1 에는 이미 명시)"
  - 상세: target 의 변경 1 과 변경 4 가 install_token 보존 정책을 data-flow와 Rationale에 명문화하므로, 이슈 67 의 §6 mermaid 명시 필요성이 대폭 줄어들 수 있다. target 이 반영된 후 이슈 67 의 처리 방향(§6 mermaid 수정 요부) 을 재검토해야 한다.
  - 제안: target merge 후 `cafe24-pending-polish-followup.md` 이슈 67 을 revisit 해 target 으로 커버됐는지 체크 처리하거나 §6 mermaid 추가 수정 여부를 결정할 것을 plan 에 after-note 로 기록.

---

### 요약

Target(`spec-draft-cafe24-app-url-detail.md`)은 `spec/data-flow/integration.md §1.2.1` 의 doc-drift 정정(변경 1)과 `spec/2-navigation/4-integration.md` 의 App URL 카드 추가·GET 응답 보강·Rationale 신설(변경 2~4)로 구성된다. 전반적으로 설계 논리는 기존 spec(install_token 보존 정책)과 일관되며 미해결 결정을 우회하는 항목은 없다. 다만 `spec/2-navigation/4-integration.md` 와 `spec/data-flow/integration.md` 두 파일 모두 현재 복수의 활성 worktree(`cafe24-spec-sync-e2a8b9`, `cafe24-w2-spec-d9f2a3`)와 미완 plan(`spec-update-cafe24-app-url-reuse`, `cafe24-pending-polish-followup`)이 동시에 참조·수정 중이다. 특히 `spec-update-cafe24-app-url-reuse.md` 의 spec 갱신 체크박스가 열려 있고 그 내용(§9 `appUrl` 필드, Rationale 신규 항)이 target 의 변경 3·4 와 밀접하게 연관되므로, 해당 plan 의 spec 갱신 완료를 선행 조건으로 명시하는 것이 필요하다. `cafe24-spec-sync-e2a8b9`·`cafe24-w2-spec-d9f2a3` 두 브랜치 모두 Rationale 섹션을 수정 중이므로 이들이 merge 된 후 target 을 착수해야 merge conflict 위험이 최소화된다. 위 조건들을 plan 에 선행 조건으로 명시한다면 CRITICAL 이슈 없이 진행 가능하다.

---

### 위험도

MEDIUM
