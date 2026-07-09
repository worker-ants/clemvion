# 신규 식별자 충돌 검토 결과

## 대상
`plan/in-progress/spec-draft-nav-spec-cleanup.md` — `spec/2-navigation/11-error-empty-states.md`,
`spec/2-navigation/14-execution-history.md`, `spec/2-navigation/_product-overview.md`,
`spec/0-overview.md` 4개 파일의 순수 spec-doc 재정리(코드·데이터모델·API 무변경).

## 검토 방법
실제 워크트리(`nav-spec-cleanup-f2dc5e`)의 `git diff`(unstaged) 를 직접 대조해 각 파일이
실제로 추가/이동하는 식별자를 확인하고, `spec/` 전체를 grep 하여 기존 사용처와 충돌 여부를 검증했다.

## 발견사항

검토 관점 1~6 전부에서 **target 이 진짜로 "새로" 발급하는 식별자가 없다** — 본 변경은 (a) 기존
`EH-LIST-*`/`EH-DETAIL-*`/`EH-NAV-*` 요구사항 ID 를 `14-execution-history.md` 에서
`_product-overview.md §3.15` 로 **verbatim 이동**, (b) 이미 구현되어 있던 `WorkspaceSlugGate`/
`resolveFallbackWorkspace` 코드 식별자를 spec 본문·frontmatter `code:` 에 **추적성 정정**으로
반영하는 것뿐이다. 신규 엔티티·API endpoint·이벤트·ENV var·신규 spec 파일 경로는 전혀 도입되지 않는다.
관점별 확인 결과는 다음과 같다.

- **요구사항 ID 충돌 (관점1)** — `_product-overview.md` 에 신설되는 `§3.15 Execution History` 섹션은
  기존 `§3.1`~`§3.14` (Workflow List ~ Web Chat) 시퀀스를 그대로 잇는 다음 번호이며, 문서 내 다른 곳에
  `§3.15` 또는 앵커 `#315-execution-history-실행-내역` 를 다른 의미로 선점한 곳은 없음(grep 확인, 유일
  참조는 이동 자체가 만든 `0-overview.md`·`14-execution-history.md` 의 상호 링크). `EH-LIST-*`/
  `EH-DETAIL-*`/`EH-NAV-*` ID 들도 `spec/` 전체에서 오직 이 실행 이력 의미로만 쓰이고(`1-ai-agent.md`,
  `conversation-thread.md`, `data-hydration-surfaces.md` 의 bare `EH-DETAIL-12` 언급 포함) 다른 의미로
  재사용된 곳이 없다. 충돌 없음.
- **엔티티/타입명 충돌 (관점2)** — `WorkspaceSlugGate`·`resolveFallbackWorkspace` 는 이미
  `codebase/frontend/src/lib/workspace/workspace-slug-gate.tsx`·`resolve-fallback.ts` 로 실존하는
  코드(phase 2, `plan/complete/editor-slug-phase2.md` 에 동일 명칭으로 이미 기록됨)이고, target 은 이를
  `spec/2-navigation/11-error-empty-states.md` 본문·frontmatter 에 **처음으로 문서화**할 뿐 새 이름을
  만들지 않는다. `spec/` 전체에서 이 두 식별자를 다른 의미로 쓰는 곳은 없음. 충돌 없음.
- **API endpoint 충돌 (관점3)** — 이번 변경에 신규/변경 endpoint 없음(코드·API 무변경 명시). 해당 없음.
- **이벤트/메시지명 충돌 (관점4)** — 신규 webhook/queue/SSE 이벤트 없음. 해당 없음.
- **환경변수·설정키 충돌 (관점5)** — 신규 ENV var/config key 없음. 해당 없음.
- **파일 경로 충돌 (관점6)** — target 은 새 spec 파일을 만들지 않는다(기존 4개 파일만 수정). frontmatter
  `code:` 에 추가된 두 코드 경로는 다른 spec 파일의 `code:` 목록과 중복되지 않음(grep 확인 — 오직
  `11-error-empty-states.md` 에서만 참조). 충돌 없음.

INFO 수준 참고(식별자 충돌은 아니지만 인접 관찰): target 의 Rationale 은 "1-ai-agent·
conversation-thread·data-hydration-surfaces 의 EH-DETAIL-12 언급은 링크가 아닌 bare ID 라 불변"
이라 적었으나, `spec/conventions/conversation-thread.md:417` 은 실제로는
`[Spec Execution History §EH-DETAIL-12](../2-navigation/14-execution-history.md)` 형태의 **파일
링크**(앵커 없이 파일 전체를 가리킴)다. 파일 자체는 그대로 존재하므로 링크가 깨지지는 않지만, 정의가
이제 `_product-overview.md §3.15` 로 옮겨졌으므로 "위임 정책이 정의된 위치"라는 서술 의도상으로는
약간 부정확해졌다. 이는 신규 식별자 충돌이 아니라 cross-reference 정밀도 이슈이므로 본 checker 의
등급 산정에는 반영하지 않으며, 별도 cross-ref/일관성 관점 검토 시 참고용으로만 남긴다.

## 요약
target 문서는 신규 식별자를 전혀 도입하지 않는 순수 재배치(relocation) 성격의 spec 정리다.
이동되는 요구사항 ID(`EH-LIST/DETAIL/NAV-*`)는 verbatim 이며 목적지 섹션 번호(`§3.15`)·앵커
모두 기존 시퀀스와 충돌 없이 이어지고, 새로 문서화되는 코드 식별자(`WorkspaceSlugGate`,
`resolveFallbackWorkspace`)는 이미 실존하며 타 spec 에서 다른 의미로 쓰이지 않는다. API·이벤트·
ENV·신규 spec 파일 경로 관점도 전부 해당 없음(무변경)으로 확인되어, 신규 식별자 충돌 관점에서는
차단 사유가 없다.

## 위험도
NONE
