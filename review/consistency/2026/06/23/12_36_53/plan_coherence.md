### 발견사항

- **[INFO]** `spec/2-navigation` frontmatter `code:` 에 신규 API wrapper 파일 미등재
  - target 위치: `spec/2-navigation/0-dashboard.md` frontmatter `code:`, `spec/2-navigation/3-schedule.md` frontmatter `code:`, `spec/2-navigation/7-statistics.md` frontmatter `code:`
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` § m-2 ("잔여(비대상, cross-domain)": "ESLint `app/**/page.tsx` apiClient 금지 규칙(plan §4)은 전 페이지 이전 완료 후 후속")
  - 상세: 본 worktree 가 신설한 `codebase/frontend/src/lib/api/statistics.ts` / `schedules.ts` / `dashboard.ts` 세 파일이 대응 spec 의 frontmatter `code:` 목록에 등재되어 있지 않다. 구현 레이어(API wrapper)가 spec 의 추적 포인터와 연결되지 않은 traceability 갭이다. 동작·행위·API 계약을 변경하지 않는 behavior-preserving 리팩토링이므로 spec 본문 내용과의 충돌은 없다.
  - 제안: plan 완료 후 planner 가 각 spec frontmatter `code:` 에 신규 wrapper 파일 경로를 추가하는 후속 작업으로 처리. 구현 차단 사유 없음.

- **[INFO]** `spec-sync-schedule-gaps.md` 의 미해결 frontend 항목과 이번 `schedules/page.tsx` 수정의 범위 구분
  - target 위치: 해당 없음 (spec 변경 없음)
  - 관련 plan: `plan/in-progress/spec-sync-schedule-gaps.md` — "스케줄 목록 항목의 더보기(⋮) 오버플로 메뉴", "트리거에서 보기", "연결된 워크플로우 이름 클릭 시 에디터 링크" 3건이 `[ ]` 미완료
  - 상세: 해당 plan 은 `schedules/page.tsx` 를 수정 대상으로 언급하고 있다. 본 worktree 도 `schedules/page.tsx` 를 수정하지만, 내용은 apiClient 직접 호출을 `lib/api/schedules.ts` wrapper 로 교체하는 behavior-preserving 이전만이다. 미해결 UI 항목(오버플로 메뉴 등)은 본 PR 에서 구현하지 않으며 해당 plan 의 체크박스도 건드리지 않으므로 충돌 없다. 단, 후속 작업자가 `schedules/page.tsx` 를 다시 수정할 때 두 worktree 의 변경이 동일 파일을 대상으로 한다는 점을 인지해야 한다 (직렬화는 merge/integrate 단계 책임).
  - 제안: plan 주석에 "apiClient 이전(m-2)은 별도 PR 에서 완료됨 — 잔여 UI 항목만 남음" 을 기록하면 후속 작업자의 혼동을 줄일 수 있다. 구현 차단 사유 없음.

### 요약

`refactor-m2-page-api` worktree 는 `statistics/schedules/dashboard` 3 페이지의 apiClient 직접 호출을 `lib/api/*.ts` wrapper 로 이전하는 순수 behavior-preserving 리팩토링이다. `spec/2-navigation` 내의 어떤 문서도 변경하지 않으므로 미해결 결정 우회·선행 plan 미해소·후속 항목 무효화에 해당하는 Critical/Warning 발견사항은 없다. frontmatter `code:` 의 traceability 갭과 `spec-sync-schedule-gaps` 와의 동일 파일 수정 안내는 INFO 수준으로, 구현을 차단하지 않는다.

### 위험도
NONE

STATUS: OK
