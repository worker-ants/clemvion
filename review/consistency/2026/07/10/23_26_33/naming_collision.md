# 신규 식별자 충돌 검토 — widget-presentation-restore (--impl-done)

대상: `spec/7-channel-web-chat/1-widget-app.md` §2·§3.1, `spec/7-channel-web-chat/_product-overview.md` §2,
`spec/conventions/conversation-thread.md` §2.1(신규 단락), `codebase/channel-web-chat/src/lib/presentation.ts`
(diff-base: `origin/main`, 실제 diff는 `git merge-base origin/main HEAD` = `cc3dafa8c` 기준 4개 커밋).

## 발견사항

검토한 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전부에서
**신규 도입 식별자 자체가 사실상 없다** — 본 변경은 새 이름을 만드는 대신 기존에 이미 spec 으로 정의된 필드명·타입명을
위젯 코드가 뒤늦게 소비하도록 맞추는 정정/버그픽스이기 때문:

- **`PresentationPayload.truncation`** (top-level 필드) — 신규 아님. `spec/4-nodes/3-ai/1-ai-agent.md:966-970`
  (type block) · `spec/4-nodes/3-ai/1-ai-agent.md:1249`(`formDataTruncation` 과의 키 이름 분리를 스펙이 이미 명시)
  · `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:96` · 프런트
  `codebase/frontend/src/lib/conversation/conversation-utils.ts:96-101` 에 이미 정의·소비 중이던 필드를
  위젯(`channel-web-chat`)이 처음 흡수했을 뿐 — 의미·shape 동일, 충돌 없음.
- **`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`** — `spec/4-nodes/6-presentation/0-common.md:100,244,312`
  가 SoT. 신규 코드의 `TRUNCATION_KEYS` 배열(`codebase/channel-web-chat/src/lib/presentation.ts:110-115`)은 이 4개를
  그대로 재사용하는 화이트리스트일 뿐 새 이름 없음.
- **`turn.presentations[]`** — `spec/conventions/conversation-thread.md:62`(§1.2, `PresentationPayload[]`, `source='ai_assistant'`
  한정) 에 이미 존재하는 필드. `1-widget-app.md` §2 정정 문구가 이를 재인용할 뿐 신규 도입 아님.
- 코드 신규 로컬 식별자 `TRUNCATION_KEYS` 상수·`truncationMeta()` 함수(`presentation.ts:110,118`) — `git grep` 결과
  저장소 전체에서 이 두 이름이 이 파일에만 존재. 충돌 없음(등급: 해당 없음).
- 신규 요구사항 ID·API endpoint·webhook/SSE 이벤트명·ENV 키·신규 spec 파일 경로 — diff 내 전무.
  `plan/in-progress/widget-presentation-restore.md` 는 신규 plan 파일이나 동명 기존 문서 없음(경로 충돌 없음).

- **[INFO]** diff 관찰 시 stale merge-base 로 인한 표면적(false) "식별자 제거" 신호 — 실제 충돌 아님, 검토 방법론 참고용
  - 관찰: `git diff origin/main..HEAD`(2-ref 직접 비교)로 보면 `1-widget-app.md`의 `### R7. 헤더 세션 컨트롤`
    섹션 전체와 `conversation-thread.md`의 `**적용 surface 범위**`·`> **스코프 예외 — 임베드형 채널 위젯**` 블록,
    "소비처 갱신" 문단 확장분이 "삭제"되는 것처럼 보인다.
  - 원인: 본 브랜치의 fork point(`git merge-base origin/main HEAD` = `cc3dafa8c`) 이후 `origin/main` 에
    별도 PR **`52f46f95f`("PR #874 defer 문서 보강 — R7 신설·§9 위젯 스코프 예외·conversation_thread 소비처 미러", #899)**
    가 머지되어 위 내용을 추가했다. 본 브랜치(4커밋)는 그 PR과 무관하게 fork point 위에서 작업했을 뿐 실제로
    아무것도 지우지 않았다 — 2-ref diff 가 "브랜치가 아직 반영하지 못한 main 쪽 신규 내용"을 "브랜치가 삭제한 것"처럼
    보여주는 표준적 아티팩트.
  - 검증: `git merge-tree $(git merge-base origin/main HEAD) HEAD origin/main` 결과 두 파일 모두 `changed in both` 이나
    실제 충돌 마커(`<<<<<<<`) 없이 자동 병합 가능 — 본 브랜치가 건드린 hunk(표 행 텍스트·§2.1 신규 단락)와 `#899`
    가 건드린 hunk(R7 섹션·§9 blockquote·소비처 문단)가 서로 겹치지 않아 병합 시 양쪽 내용이 모두 보존된다.
    즉 신규 식별자 충돌도, 병합 시 콘텐츠 유실도 없다.
  - 제안: 조치 불필요(자동 병합 안전 확인됨). 다만 merge-coordinator 단계에서 본 브랜치를 `origin/main` 위로
    rebase/merge 하기 전에 동일한 `git merge-tree` 검증을 반복해 `#899` 이후 추가된 다른 main 커밋과도 안전한지
    재확인 권고.

## 요약

target 이 실제로 새로 도입하는 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV 키·파일 경로)는 없다 —
`PresentationPayload.truncation`·`rowsTruncated`류 필드는 모두 기존 spec(AI Agent §7.10, Presentation 공통 §10.4)에
이미 정의돼 있던 것을 위젯 코드가 처음 흡수했을 뿐이며, 코드 레벨 신규 로컬 심벌(`TRUNCATION_KEYS`/`truncationMeta`)도
저장소 전역에서 유일하다. 유일한 특이사항은 identifier 충돌이 아니라 diff 관찰 아티팩트(브랜치 fork 이후 origin/main
에 병합된 무관 PR #899 의 R7/§9 콘텐츠가 2-ref diff 상 "삭제"처럼 보이는 것)이며, `git merge-tree` 로 무충돌 자동
병합을 확인했으므로 실질 위험이 아니다.

## 위험도

NONE
