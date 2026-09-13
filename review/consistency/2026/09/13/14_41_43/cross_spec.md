# Cross-Spec 일관성 검토 — guide-identifier-existence (impl-done, scope=spec/conventions/)

## 조사 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/user-guide-evidence.md` 본문과
`<git diff origin/main...HEAD -- code_areas>` 본문이 절단되어 있었다. 지시에 따라 HEAD
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)를
절대경로로 직접 열어 두 내용을 재확보했다:

- `git diff origin/main...HEAD --stat` → 15개 파일 변경. 그중 **코드 영역(`codebase/`)은
  4개 파일**(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제,
  `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설) — 프롬프트가 명시한
  "구현 diff 4개 파일" 과 일치.
- `spec/conventions/**` 자체는 이 브랜치에서 **변경 0건** (프롬프트의 델타 실측과 일치).
- `spec/conventions/user-guide-evidence.md`, `spec/conventions/error-codes.md`,
  `spec/conventions/secret-store.md` 를 절대경로 `Read`/`grep` 으로 직접 확인.

## 발견사항

- **[WARNING]** `user-guide-evidence.md §2` 가드 카탈로그 "3건" 표가 실제 가드 개수·이름과
  더 벌어진다
  - target 위치: (target 자체는 무변경이므로) `spec/conventions/user-guide-evidence.md §2`
    "Build-time 가드 (3건)" 표 — 현재 워킹트리에서 직접 확인, `impl-anchor-existence`·
    `integrations-coverage`·`triggers-coverage` 3건만 등재.
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (이번 PR 산출물, 舊 `guide-error-code-existence.test.ts`) + 자매
    `guide-sanitized-message-parity.test.ts`(이미 존재, `#1330` 무렵 추가) — 둘 다 §2 카탈로그와
    `code:` frontmatter 목록(7개 경로, 신규 3파일 미포함)에 없음.
  - 상세: 이 gap 자체는 이번 PR 이 새로 낸 것이 아니라 `#1330` 부터 있던 pre-existing
    drift 다. 다만 이번 PR 이 두 번째 가드의 **이름을 다시 바꾸고**(`guide-error-code-*` →
    `guide-identifier-*`) **스코프를 넓혔다**(에러 코드 전용 → 에러 코드 + 환경변수)는 점에서,
    §2 를 나중에 갱신할 때 옛 이름/좁은 스코프로 등재되면 두 번째 drift 가 생긴다. 코드가
    SoT 문서보다 앞서 있는 상태이며, `spec/` 은 `developer` 쓰기 범위 밖이라 이 PR 스스로
    고칠 수 없다.
  - 제안: 이미 `plan/in-progress/guide-identifier-existence.md` §D(#1·#2)와 자매 트래커
    (`spec-draft-nullable-notation-followups.md`)에 planner 항목으로 **명시 등재 및 취소선
    번복** 처리돼 있음을 확인했다 — 별도 조치 불요, 다음 `project-planner` 턴에서 §2 표를
    5건(+ `code:` frontmatter 3파일 추가)으로, 정확한 신규 파일명(`guide-identifier-*`)으로
    갱신하면 닫힌다. **BLOCK 사유 아님** — 절차가 이미 올바르게 설계돼 있다.

- **[INFO]** 새 가드의 "환경변수 실재성" 판정 기준집합(`​.env.example`·compose YAML)을
  소유하는 spec 문서가 없다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
    `collectEnvDeclarations()` (신규) — SoT 로 `user-guide-evidence.md §2` 만 인용.
  - 충돌 대상: `spec/conventions/secret-store.md` — grep 결과 저장소에서 "환경변수" 를
    다루는 유일한 convention 문서지만 범위는 `SecretResolver`/DB 자격증명 URI scheme 뿐이고
    process env var 명명·존재 규약은 다루지 않는다. 직접 충돌은 없음(겹치는 서술이 없다).
  - 상세: 지금은 두 문서의 관할이 겹치지 않아 모순이 없다. 다만 향후 "환경변수 명명 규약"
    문서가 생기면 이 가드의 기준집합 결정(§B 의 "오늘 지탱 안 함, 내일 오탐 방지" 근거)과
    조율이 필요해진다는 점만 기록해 둔다.
  - 제안: 지금 조치 불요. 참고로만 남긴다.

- 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 관점에서는 이번 diff 가 test-tooling
  전용(가이드 문서 정적 검증 스캐너 + 그 테스트)이라 해당 축의 충돌 후보가 없었다 —
  엔티티·엔드포인트·상태 머신·권한 구조 어느 것도 건드리지 않는다. `MCP_ALLOW_INSECURE_URL`
  이 새 가드의 "정정된 이름 통과" 케이스로 쓰이는데, 실제 코드(`mcp.config.ts`,
  `production-guards.ts`, `.env.example:331`)와 `secret-store.md` Rationale R5 인용까지
  일치함을 확인했다 — 가드가 근거로 삼은 사실 자체는 spec 과 모순되지 않는다.

## 요약

이번 PR 은 `spec/conventions/**` 을 전혀 수정하지 않는 코드 전용(test 인프라) 변경으로,
`guide-error-code-existence`/`guide-error-code-scan` 을 삭제하고 스코프를 넓힌
`guide-identifier-existence`/`guide-identifier-scan` 으로 대체한다. Cross-Spec 관점의
유일한 실질 이슈는 `user-guide-evidence.md §2` 가드 카탈로그가 이 변경으로 한 단계 더
낡는다는 점인데, 이는 `#1330` 시점부터 있던 pre-existing gap 이고 이번 PR 의 plan 문서가
이미 정확한 후속 조치(다음 planner 턴에서 표·frontmatter·Rationale 동시 갱신)를 등재해
두었다. 그 외 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 축에서는 다른
spec 영역과의 직접 모순을 찾지 못했다.

## 위험도
LOW
