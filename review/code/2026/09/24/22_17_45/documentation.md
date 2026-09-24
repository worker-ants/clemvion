# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 새 두 테스트가 `describe('removeMember — 동시 제거', ...)` 블록 안에 추가되어, 블록 이름이 더 이상 내용 전체를 정확히 설명하지 못한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('removeMember — 동시 제거', ...)` 블록(실제 소스 1467번째 줄, `Read` 로 직접 확인. 프롬프트의 "전체 파일 컨텍스트" 는 634번째 줄까지만 노출되어 게이트 숫자가 없다), 새 두 `it` 블록은 diff 게이트 `1798`·`1818` 줄
  - 상세: 이 `describe` 는 원래 동시 제거(TOCTOU/락 없는 원자적 DELETE) 시나리오만 다루는 블록이었다(`wireFindOne` 헬퍼의 JSDoc 도 "TOCTOU 를 단위에서 재현한다"를 언급). 이번에 추가된 두 테스트(`비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다`, `요청자 role 을 한 번만 조회한다`)는 동시성과 무관한 **판정 순서·쿼리 횟수** 테스트다. 공유 fixture(`wireFindOne`, `beforeEach`)를 재사용하는 실용적 선택이지만, 블록 제목 "동시 제거" 만 보고 테스트 구조를 탐색하는 다음 사람은 이 두 테스트를 놓치거나 성격을 오인할 수 있다.
  - 제안: 블록을 쪼개거나(`describe('removeMember — 판정 순서', ...)` 신설) 최소한 블록 제목에 "판정 순서" 를 추가해 범위를 넓힌 사실을 반영한다. 급하지 않으면 다음에 이 블록을 만지는 사람이 정정해도 충분하다.

- **[INFO]** CHANGELOG 상단 두 곳의 "맨 위 항목이 그것이다" 크로스 레퍼런스가 이번 PR 로 더 이상 문자 그대로 정확하지 않다(단, 이번 diff 가 원인이 아니라 이미 깨져 있던 상태를 이어받았을 뿐)
  - 위치: `CHANGELOG.md` — "제거 중 대상이 owner 로 승격되면 owner 가 지워지던 것" 항목의 `**2026-09-24 해소 — 맨 위 항목이 그것이다.**`(원본 파일 251번째 줄, 프롬프트 게이트 없음 — diff 밖 컨텍스트), "동시 DELETE 두 건이 `member.removed` 감사 행을 두 번 남기던 것" 항목의 `> **owner 승격 TOCTOU 는 2026-09-24 해소됐다** — 맨 위 항목이 그것이다.`(원본 파일 360번째 줄, 동일하게 프롬프트 게이트 없음)
  - 상세: 두 문구는 커밋 `33caa750c`(멤버 제거 인가 순서 수정) 시점에는 실제로 "맨 위 항목"을 정확히 가리켰다. 그러나 그 뒤 `d0cc77f08`·`1a8ddca8b`(docs-guard 관련, 이번 PR 과 무관)이 이미 그 위에 항목을 추가해 문자 그대로의 "맨 위"는 깨져 있었고, 이번 PR(`6727c3777`)이 또 하나를 최상단에 추가하며 그 상태를 그대로 이어받았다. `git log -S`로 확인한 결과 이번 diff 가 최초 원인은 아니다 — 다만 이번 PR 도 삽입 지점을 확인하지 않고 최상단에 새 섹션을 넣어 문제를 검토 없이 방치했다.
  - 제안: 조치 불요(사후 근거로 남긴다). 이 CHANGELOG 에 항목을 최상단 삽입하는 관례가 계속되는 한, 위치 기반("맨 위 항목") 크로스 레퍼런스는 다음 삽입에 또 깨진다 — 앞으로는 제목을 인용하는 방식(예: "«멤버 제거가 인가 전에…» 항목이 그것이다")으로 쓰면 삽입에 안전하다.

## 검증한 항목 (문제 없음)

- 새 두 JSDoc(`workspaces.service.spec.ts` 1783~1797, 1808~1817번째 줄)이 서술하는 판정 순서·기본값·헬퍼 동작을 실제 소스와 대조했다 — `removeMember` 머리 주석의 판정 순서(`workspaces.service.ts` 802~813번째 줄), `listMembers` 의 `assertMembership` 첫 줄(214번째 줄), `updateMemberRole` 의 `assertAdmin` 첫 줄(306번째 줄), `wireFindOne` 기본값(`{ id: 'mem-req', role: 'owner' }`, 1486~1489번째 줄), `getMemberRole` 의 `where: { workspaceId, userId }`(109~117번째 줄) 모두 문서 서술과 정확히 일치한다.
- CHANGELOG 신규 항목의 판별력 실측 수치(139건 중 새 테스트 1건만 RED, 나머지 138건 통과)가 `plan/in-progress/remove-member-order-coverage.md` §B 뮤턴트 표와 정확히 일치한다.
- `workspaces.service.ts` 자체는 이번 diff 에 포함되지 않음을 `git diff --stat HEAD~2 HEAD` 로 확인 — 순수 테스트/CHANGELOG/plan 추가이므로 README·API 문서·설정 문서·예제 코드 갱신 대상이 아니다.
- `plan/in-progress/remove-member-order-coverage.md` frontmatter 는 필수 필드(title/status/owner/worktree/spec_impact/started)를 모두 갖췄고, 체크리스트는 실제 완료 상태(TEST WORKFLOW·`/ai-review`·`--impl-done`·트래커 항목 닫기 미완료)를 정확히 반영한다.
- `review/consistency/2026/09/24/22_01_45/**` 는 이전 세션의 consistency-check 산출물이며 이번 PR 이 새로 작성한 문서가 아니라 정책대로 커밋에 포함된 것 — 문서화 관점의 별도 조치 불요.

## 요약

이번 변경은 코드(`workspaces.service.ts`) 수정 없이 테스트 2건과 그 판별력을 뒷받침하는 CHANGELOG 항목·plan 문서만 추가하는 순수 커버리지 보강 PR 이다. 새로 작성된 JSDoc·CHANGELOG·plan 문서는 이례적으로 꼼꼼하며, 서술한 판정 순서·기본값·헬퍼 동작·뮤턴트 실측 수치를 모두 실제 소스와 대조했으나 불일치를 찾지 못했다. 발견된 두 건은 모두 INFO 수준이다 — 하나는 새 테스트가 들어간 `describe` 블록 이름이 더 이상 내용을 정확히 설명하지 못하는 사소한 표류이고, 다른 하나는 CHANGELOG 의 위치 기반 크로스 레퍼런스("맨 위 항목")가 이미 이전 PR 에서 깨져 있던 상태를 이번 PR 이 그대로 이어받은 것으로, 이번 diff 가 원인이 아니라 조치 불요다.

## 위험도

LOW
