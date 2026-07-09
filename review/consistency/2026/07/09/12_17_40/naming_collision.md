# 신규 식별자 충돌 검토 — spec-draft-eh-detail-06-id-split

## 검토 방법
target plan 이 편집 대상으로 지목한 4개 파일(`spec/2-navigation/14-execution-history.md`,
`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/data-hydration-surfaces.md`,
`spec/conventions/conversation-thread.md`)이 orchestrator 가 준비한 `naming_collision.md` 검색
코퍼스(spec/0-overview.md, spec/1-data-model.md, plan/in-progress 의 무관 4건, cafe24/audit
conventions 등)에 포함되지 않아 실제 리뷰 대상과 무관했다. 이에 따라 worktree
`eh-detail-06-id-drift-baa21f` 의 실제 `spec/`·`plan/` 트리를 직접 `grep` 하여 신규 식별자
`EH-DETAIL-12` 및 관련 표를 전수 대조했다.

## 발견사항

target 이 실제로 새로 도입하는 식별자는 **`EH-DETAIL-12`** 하나뿐이다 (신규 엔티티/DTO/인터페이스,
API endpoint, 이벤트/메시지명, ENV/설정키, spec 파일 경로는 도입하지 않음 — 4개 기존 파일의
텍스트 치환/각주/신규 표 행 추가만 수행).

- 요구사항 ID 충돌 검사 결과: **충돌 없음**. `spec/`·`plan/` 전체에서 `EH-DETAIL-12` 문자열은
  target plan 파일 자신과, 그 근거가 된 선행 리뷰
  (`review/consistency/2026/07/09/11_31_49/cross_spec.md:12`, "신규 `EH-DETAIL-12`" 를 옵션 (b)로
  제안) 외에는 등장하지 않는다. `spec/2-navigation/14-execution-history.md` 의 EH-DETAIL 표는
  01~11 까지만 존재하므로 12 는 다음 순번으로 자연스럽게 이어진다. 다른 in-progress plan 중
  `EH-DETAIL` 을 언급하는 것도 target 자신뿐이라 동시 발급 경쟁(race)도 없다.
- `§7` 앵커 참조(`conversation-thread.md §7`) 확인 결과: 해당 문서에 `## 7. v2 로드맵` 섹션이
  실재해 dangling 이 아니다.
- EH-DETAIL 네임스페이스 내 형제 ID(`EH-LIST-*`, `EH-NAV-*`)와도 번호·의미 중복 없음.
- 엔티티/DTO/API endpoint/이벤트·메시지명/ENV·설정키/spec 파일 경로: target 이 신규로 도입하는
  항목 없음(전부 기존 4개 파일의 기존 표·문장 편집) — 해당 관점은 적용 대상 없음(N/A).

특기사항(collision 은 아니나 참고): 신규 행의 상태 마커 `❌ (v2)` 는 `spec/` 전체에서 이 조합의
선례가 없는 신설 표기이나, 이는 "식별자" 가 아닌 상태 마커 관례이므로 본 체크리스트(요구사항
ID/엔티티/endpoint/이벤트/ENV/파일경로) 범위 밖으로 판단해 발견사항에서 제외했다(참고 목적 기록).

## 요약

target 이 새로 발급하는 식별자는 `EH-DETAIL-12` 하나이며, worktree 의 `spec/`·`plan/` 트리 전체를
직접 검색한 결과 이 ID 는 기존에 다른 의미로 사용된 바 없고 EH-DETAIL 표의 자연스러운 다음 순번과
일치한다. 이 ID 는 애초에 선행 `/consistency-check --impl-done` 의 cross_spec 리뷰
(`review/consistency/2026/07/09/11_31_49/cross_spec.md`)가 해소책 옵션으로 직접 제안한 값이라
독자적 신규 발급으로 인한 충돌 가능성도 낮다. 엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec
파일 경로 관점에서는 target 이 신규 식별자를 도입하지 않아 해당 없음. 신규 식별자 충돌 관점에서
문제 없음.

## 위험도
NONE
