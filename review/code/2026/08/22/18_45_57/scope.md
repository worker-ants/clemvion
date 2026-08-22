# 변경 범위(Scope) 리뷰 — egress 마스킹 좌표계 conventions 승격

## 검토 방법

프롬프트의 unified diff(파일 1~2 및 이후 review/consistency 아티팩트)를 확인하고, 전체 변경 파일 목록을
`git diff --stat origin/main...HEAD` 로 재확인한 뒤 실제 spec 3파일(`14-external-interaction-api.md`,
`6-websocket-protocol.md`, `node-output.md`)과 신설 `spec/conventions/egress-masking.md` 를
`git show`/`git diff` 로 직접 열어 대조했다. 커밋은 `a331d9abe` 1건, 총 24개 파일·1407줄 추가·1줄 삭제.

## 발견사항

- **[INFO]** `review/consistency/2026/08/22/18_14_17/` 세션 디렉토리가 `meta.json`·`_retry_state.json` 두
  메타파일만 커밋되고 실제 checker 출력(`SUMMARY.md`, 5개 checker `.md`)이 없다
  - 위치: `review/consistency/2026/08/22/18_14_17/meta.json`, `review/consistency/2026/08/22/18_14_17/_retry_state.json`
  - 상세: `/consistency-check --spec` 1차 라운드가 완주하지 못하고(재시도 상태기계가 새 세션
    `18_14_45` 로 이어짐) 그 잔해만 커밋됐다. 스코프 위반(의도 밖 작업)은 아니다 — 필수
    워크플로 단계(`consistency-check --spec`)의 정상적 부산물이며, 이 저장소는 `review/**` 를
    증거로 보존하는 관행이 있다. 다만 SUMMARY 없이 메타데이터만 남은 디렉토리는 향후 이 세션을
    보는 사람에게 "왜 비어 있는가"라는 불필요한 의문을 준다.
  - 제안: 조치 불요(스코프 문제 아님). 원한다면 향후 실패 라운드의 stub 디렉토리를 커밋에서
    제외하는 관행을 별도로 논의할 수 있으나 이번 PR 의 스코프 밖이다.

## 스코프 정합성 확인 (문제 없음)

- **spec 변경 3건**은 전부 plan 이 스스로 예고한 *"인입 포인터"* 삽입이다 — `14-external-interaction-api.md`
  §R17 상단, `6-websocket-protocol.md` §4.1 콜아웃 블록, `node-output.md` 마스킹 단락. 각 3~4줄의
  콜아웃 삽입뿐이며 기존 문장의 재작성·재배치·포맷팅 변경이 섞여 있지 않다(순수 추가 diff).
- **신설 파일 `spec/conventions/egress-masking.md`**(107줄)는 plan draft 가 "판정: 신설한다 — 단, 좁게"로
  명시한 산출물과 정확히 일치한다. frontmatter `code:` 6파일은 좌표계 표가 인용하는 심볼의 정의처
  전부를 exhaustive-consumer 스타일로 등재한 것으로, `18_27_11` consistency WARNING #1 반영 결과다
  (스코프 확장이 아니라 같은 PR 내 리뷰 피드백 반영).
- **plan 트래커 갱신**(`spec-sync-external-interaction-api-gaps.md`)은 처분 대상 항목 1개의 체크박스
  플립 + 상호 참조 캐비엇 3줄 추가뿐이며, 다른 항목·섹션은 건드리지 않았다.
- **review/consistency/\*\* 3라운드**(`18_14_17`→`18_14_45`(BLOCK:YES)→`18_27_11`(BLOCK:NO))는
  CLAUDE.md 가 강제하는 *"project-planner 는 spec/ 쓰기 직전 consistency-check --spec 의무"* 절차의
  표준 산출물이며, 그 결과(Critical 1건 정정 → 반영)가 실제로 최종 spec/plan 본문에 흡수된 흔적과
  일치한다(예: 좌표계 표 "값" 열 "= 1"→"10" 정정, WS §4.1 인입 포인터 추가, `code:` 2파일 추가).
- `git diff --stat` 로 확인한 24개 변경 파일 전부가 `spec/**`, `plan/**`, `review/consistency/**` 안에만
  있다 — `codebase/**` 코드 변경, 설정 파일, 무관한 파일은 전혀 없다. 이는 project-planner 스킬의
  쓰기 권한 범위(`spec/**`, `plan/**`)와도 정확히 일치한다.
- 포맷팅 전용 변경, 불필요한 리팩토링, 기능 확장(over-engineering), 무관한 주석/임포트/설정 변경은
  발견되지 않았다. 오히려 plan 본문 Rationale 에 "좌표계를 기계가 검사하게 한다(신규 repo-guard)"
  대안을 **명시적으로 기각**해 두어(범위 밖으로 스스로 선을 그음) over-engineering 방지 근거가
  문서화되어 있다.

## 요약

변경은 순수 문서 작업(spec 신설 1건 + 소규모 pointer 추가 3건 + plan 트래커 갱신 + 필수 consistency-check
증적)으로, plan draft 가 스스로 예고한 "판정: 신설한다 — 단, 좁게" 범위를 벗어나지 않는다. 코드 변경이
전혀 없고, spec/plan/review 세 디렉토리 밖으로 나가는 파일도 없으며, 실질 변경(콜아웃 삽입)과 무관한
포맷팅·리팩토링·기능 확장이 섞여 있지 않다. 유일한 관찰 사항은 실패한 1차 consistency-check 라운드의
빈 메타데이터 디렉토리가 함께 커밋된 것인데, 이는 필수 워크플로의 정상 부산물이며 스코프 위반이 아니다.

## 위험도

NONE
