# 신규 식별자 충돌 검토 — naming_collision (3차, impl-done)

## 검토 범위 및 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/` 자체의 델타는 0개 파일 — 이 브랜치는 그 spec 영역을 바꾸지 않았다(정상,
  코드+가이드 전용 PR). 대상 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/
  guide-error-code-truth`)를 절대경로로 직접 열어 `git diff origin/main...HEAD`(20파일/1164줄)
  전수와 현재 소스를 실측했다.
- 이 세션은 같은 plan(`guide-error-code-truth`)에 대한 **세 번째** naming_collision 검토다.
  1차(`--impl-prep`, `01_15_40`, LOW)와 2차(`--impl-done`, `10_12_54`, NONE)가 이미 핵심 diff
  (LLM 연결-테스트 `error`→`message` 정정·`latencyMs` 제거·가이드 4파일 정정·신규 가드
  `guide-error-code-{scan,existence}`)를 전수 대조했으므로, 이번 라운드는 **그 이후 코드
  리뷰(`review/code/2026/09/13/10_12_19`) 라운드 1 처분으로 새로 추가된 부분**을 집중
  검증했다: `TestConnectionResultDto.code` 필드 신설, `guide-sanitized-message-parity.test.ts`
  신설, `meta`/`LLM_RATE_LIMIT` 중복 제거, `nodeName`→`nodeLabel` 정정.

## 발견사항

전체 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·ENV/설정키·파일 경로)에
대해 이번 라운드에서 새로 추가된 코드를 대조한 결과, **기존 사용처와 다른 의미로 충돌하는
식별자는 발견되지 않았다.**

세부 대조:

1. **엔티티/타입명 — `TestConnectionResultDto.code` 신설**
   (`integration-response.dto.ts`). 값은 `MCP_*`·`EMAIL_CONNECT_FAILED`·`INTEGRATION_INCOMPLETE`
   등이며, 전부 `integrations.service.ts`(`IntegrationTestResult.code`, 생산자 26곳)가 이미
   내던 값이고 `spec/2-navigation/4-integration.md §9.1`·`§9.3`·`1091`·`1095`행이 이미 문서화한
   이름이다 — **신규 도입이 아니라 미선언 필드의 뒤늦은 선언**. 같은 spec §9.1 이 "노드 런타임
   `output.error.code` 와는 별개 namespace(`MCP_CONNECT_FAILED` 와 동일 계열)"라고 스스로
   구분해 둔 상태라, `INTEGRATION_INCOMPLETE` 가 여러 노드 spec(`4-nodes/4-integration/*.md`)의
   **다른 namespace**에도 같은 문자열로 존재하는 것은 이번 PR 이 만든 것이 아니라 기존
   spec 이 이미 승인한 dual-use다.
2. **파일 경로 — `guide-sanitized-message-parity.test.ts` 신설**
   (`codebase/frontend/src/lib/docs/__tests__/`). 같은 디렉터리 기존 파일(`guide-error-code-
   {scan.ts,existence.test.ts}`, `impl-anchor-{parse.ts,existence.test.ts}`,
   `spec-frontmatter-{parse.ts,test.ts}` 등)과 이름이 겹치지 않고, `<topic>-parity.test.ts`
   패턴도 그 폴더의 기존 `<topic>-existence.test.ts` / `<topic>-scan.ts` 명명 관례와 자연스럽게
   병존한다(`find … -iname "*sanitized-message-parity*"` → 신규 1파일뿐).
3. **API endpoint** — 이번 라운드 diff 는 신규 endpoint 를 추가하지 않았다. 기존
   `POST /api/model-configs/:id/test` · `POST /api/integrations/:id/test` 의 응답 **필드
   구성**만 정정했다(엔드포인트 자체는 origin/main 시점부터 존재).
4. **`LLM_RATE_LIMIT` 중복 제거** (`run-results.mdx` 엔진 표에서 삭제, 노드 표에만 유지) —
   이름 자체는 기존 코드(`nodes/core/error-codes.ts`)와 여전히 일치하며, 표 두 곳에 같은 이름이
   실렸던 **이 PR 자신의 라운드 1 자기모순**을 정정한 것이라 신규 충돌이 아니다.
5. **`nodeName` → `nodeLabel`** (`run-results.mdx` 예시) — `spec/5-system` §2.2 가 이미
   2026-08-17 에 `nodeName`→`nodeLabel` 로 정정해 둔 이름이고, backend 실측(emit `nodeLabel`
   57건 · `nodeName` 0건)과도 일치한다. 새 이름 도입이 아니라 낡은 예시를 SoT 에 맞춘 것.
6. **이벤트/메시지명 · ENV/설정키 · 요구사항 ID** — 이번 라운드 diff 에 해당 없음(신규
   webhook·queue·SSE 이벤트, 신규 ENV var/config key, 신규 요구사항 ID 없음). Rate limit
   식별자 `INVITATION_THROTTLE` 류나 `#1330` 같은 트래커 참조 번호도 `plan/in-progress/
   guide-error-code-truth.md`·`spec-draft-nullable-notation-followups.md` 외 다른 문서에서
   재사용되지 않는다(grep 0건) — 트래커 번호 충돌 없음.

## 참고 — 이미 추적 중인 인접 이슈 (신규 발견 아님)

`spec/conventions/user-guide-evidence.md §2.1` 관계표가 신규 가드를 아직 반영하지 않는 문제는
1차 검토(`01_15_40` naming_collision WARNING#4·#5)에서 이미 지적됐고
`plan/in-progress/spec-draft-nullable-notation-followups.md`(3234행)에 planner 등재분으로
추적 중이다. 다만 그 등재 문구는 `guide-error-code-existence.test.ts` 한 건만 언급하고, 이번
라운드에서 추가된 `guide-sanitized-message-parity.test.ts` 는 아직 그 등재 문구에도 실려 있지
않다. 이는 **식별자 충돌이 아니라 등재 문구 자체의 최신성 문제**이며(가드 이름·표면이 서로
다른 새 이름과 충돌하는 것이 아니라 단순히 "몇 건인지" 카운트가 낡는 형태), 소유 권한이
developer 밖(spec 쓰기는 planner 소관)이라 이번 naming_collision 검토가 새로 raise 할 사유는
아니다. planner 가 §2.1 표를 갱신할 때 이 파일도 함께 반영하면 된다.

## 요약

이번 3차 라운드가 다루는 신규분(`TestConnectionResultDto.code` 필드·
`guide-sanitized-message-parity.test.ts`·`LLM_RATE_LIMIT` 중복 제거·`nodeLabel` 정정)은 전부
"신규 식별자 도입"이 아니라 (a) 이미 다른 곳에 생산자가 있던 값의 뒤늦은 DTO 선언, (b) 기존
가드 가족의 명명 관례를 따르는 새 테스트 파일, (c) 이 PR 자신의 라운드 1 자기모순 정정,
(d) 이미 정정된 spec 이름으로의 정렬이다. 1·2차 검토가 이미 핵심 표면(에러 코드 재귀속·필드명
정정·가드 신설)을 전수 대조해 NONE~LOW 로 판정했고, 이번 라운드의 증분도 같은 결론을 뒤집을
새 충돌을 만들지 않았다. 유일한 인접 이슈(가드 관계표 staleness)는 이미 planner 트래커에
등재돼 있어 별도 차단 사유가 아니다.

## 위험도

NONE
