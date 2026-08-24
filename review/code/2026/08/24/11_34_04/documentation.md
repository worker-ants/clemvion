STATUS=success documentation review complete (target: node-output-envelope-458f05, 2회차 — 이전 라운드 `11_05_39` WARNING 3건 + `10_44_28` CRITICAL/WARNING 전부 처리 후 상태 확인)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `node-output-envelope` (2회차, `envelope.output` fail-closed allowlist)

## 리뷰 방법

이번 diff(32개 파일)는 이전 두 라운드의 산출물(코드 리뷰 `11_05_39`, consistency-check
`10_44_28`)과 그 `RESOLUTION.md` 를 반영한 **누적 상태**다. 프롬프트가 대부분 파일을 diff 만
싣고 "전체 파일 컨텍스트 없음"으로 표시했으므로, 실제 파일을 저장소에서 직접 `Read`/`grep` 하여
(1) 이전 두 라운드의 WARNING 이 실제로 해소됐는지, (2) 해소 커밋(`970cac5cf`, `990a61e61`) 자체가
새 문서화 결함을 남기지 않았는지를 대조했다.

## 이전 라운드 WARNING 처리 확인 (재발 없음)

- `11_05_39` documentation WARNING(JSDoc 이 옛 함수 설명 그대로 남음) — **해소 확인**.
  `websocket.service.ts:171-190` 은 `narrowTopLevelNodeOutput` 전용 JSDoc(`key` 유니온 이유 +
  copy-on-change), `:192-209` 는 `allowlistFanoutNodeOutput` 전용 JSDoc(세 자리 표 + 위임 근거)로
  분리돼 있다.
- `11_05_39` documentation WARNING(CHANGELOG breaking-change 고지 비대칭) — **해소 확인**.
  `CHANGELOG.md:40-46` 에 `envelope.output` 전용 "외부 수신자에게는 동작 변경이다" 문단이
  추가됐고, `spec/5-system/14-external-interaction-api.md:1803-1807` §R17 재정정 블록에도 동일
  문장이 미러링돼 있다.
- `11_05_39` requirement W3("emit 5곳"→실측 6곳) — **재발 없음 확인**. `CHANGELOG.md`,
  `websocket.service.ts:492`, `websocket.service.spec.ts:944`,
  `spec/5-system/14-external-interaction-api.md:1759`,
  `plan/complete/sse-nodeoutput-allowlist.md:23`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:164` 전 지점을 grep 대조한 결과
  "emit 5곳" 잔존 0건, "emit 6곳"(또는 취소선 처리된 "~~5곳~~ 6곳")으로 일관.
- `10_44_28` cross_spec CRITICAL(§R17/§4.4 가 여전히 옛 유예 근거를 문서화)과 그 절차적 CRITICAL
  (자기-반증형 소정정 예외 적용 범위) — **해소 확인**. `plan/in-progress/node-output-envelope.md`
  frontmatter `spec_impact` 가 "(planner 턴)"/"자기-반증형 소정정" 두 블록으로 분리돼 있고,
  `spec/5-system/6-websocket-protocol.md:187-188`·`spec/5-system/14-external-interaction-api.md`
  §R17 모두 취소선 보존 + 재정정 블록 패턴으로 갱신돼 있다.

## 발견사항

- **[INFO]** `toFanoutEnvelope` JSDoc 한 줄이 이번 라운드의 "emit 6곳" 정정 커밋(`990a61e61`)
  이후 파일 내 JSDoc 관례보다 눈에 띄게 길어졌다(줄바꿈 미조정)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:493`
  - 상세: 같은 JSDoc 블록의 인접 줄(470~504행)은 대부분 63~119자로 줄바꿈돼 있는데, "emit 6곳"
    정정으로 breakdown(`execution-engine 2 · form-interaction 1 · button-interaction 1 ·
    ai-turn-orchestrator 2`)이 추가된 493행만 135자로 튀어 이 블록의 관례를 벗어난다. 내용
    자체는 정확하다(`RESOLUTION.md` W3 의 grep 실측과 정확히 일치, 6곳 합계도 맞음) — 순수
    포맷팅(줄바꿈 재정렬 누락) 문제다. 같은 정정을 담은 `websocket.service.spec.ts:944`
    (114자)·`spec/5-system/14-external-interaction-api.md:1759`(줄바꿈 포함)는 이 문제가 없다.
  - 제안: 493행을 "emit **6곳**:" 다음에서 줄바꿈해 다른 JSDoc 줄과 비슷한 길이로 재정렬. 급하지
    않음(빌드·린트에 영향 없음, 내용 오류 아님).

## 확인했지만 문제 없음 (참고)

- `plan/in-progress/node-output-envelope.md` `## 작업` 체크리스트는 실제 진행 상태와 정확히
  일치한다 — 배선·캐너리·잔여 캐너리 뒤집기·planner 턴 spec 갱신·뮤테이션 검증까지 `[x]`, 남은
  `TEST WORKFLOW`·`/ai-review` 두 항목만 `[ ]`(이 리뷰가 그 `/ai-review` 항목 자체다).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 CRITICAL 트래커 항목은
  `[x]` + 취소선 + `<details>` 이력 보존 + 파생 신규 항목(flat 폴백 영속 계약) 등재까지 기존
  관례를 정확히 따른다 — "다시 찾지 말 것" 표기의 emit 카운트도 `~~5곳~~ 6곳` 으로 정정돼 있다.
  archived `<details>` 블록 내부에만 남은 "잔여"/"아직 allowlist 를 지나지 않는다" 등의 옛 문구는
  이력 보존 목적이라 문제 없음(살아있는 서술과 혼동되지 않도록 `[x]`+취소선 제목 아래 접혀 있음).
  이 archived 블록 안의 "emit ~~5곳~~ 6곳" 문구도 정정 완료 상태다.
  - 별건으로 등재된 `background:run:{id}` 채널 누락(WS §3.2)·`finalAdapted ?? nodeOutputCache`
    폴백 영속 계약 항목도 등재 근거·재개 신호가 명확히 기록돼 있다.
- `spec/5-system/6-websocket-protocol.md` §4.1 표의 `execution.node.completed`/`.failed` 행
  정정(`output` = 래퍼 vs `output.output` = 도메인 값 구분, `.failed` 행에 `output` 열 추가)이
  실제 emit 코드(`execution-engine.service.ts` 의 `output: nodeExecution.outputData`)와 정확히
  일치함을 직접 대조 확인.
- README·swagger/OpenAPI 문서·환경변수 문서는 이번 변경 범위 밖(신규 엔드포인트·설정·REST DTO
  없음, 순수 WS/SSE fanout 내부 필터링)이라 갱신 불요 — 재확인.
- CHANGELOG 의 중첩 인용(`>` → `> >`) 구조는 "waiting `nodeOutput` 범위 고지"(외곽)와
  "`envelope.output` 범위 고지"(중첩, 2026-08-24 신규)를 각각 정확한 스코프에 담고 있어 서로
  다른 두 breaking-change 문장이 혼동 없이 공존한다.

## 요약

이전 라운드(코드 리뷰 `11_05_39`, consistency-check `10_44_28`)가 지적한 문서화 CRITICAL/WARNING
전부(JSDoc 분리, CHANGELOG breaking-change 고지, emit 카운트 5→6 전수 정정, spec_impact 예외
범위 기록)가 후속 커밋(`970cac5cf`, `990a61e61`)에서 실제로 해소됐음을 직접 대조로 확인했다.
plan 체크리스트·트래커 이력 보존·spec 정정 블록 모두 이 저장소의 취소선-보존 관례를 일관되게
따른다. 이번 라운드에서 새로 찾은 것은 `websocket.service.ts:493` 한 줄의 JSDoc 줄바꿈 누락뿐이고
(내용은 정확), 이는 머지를 막을 사안이 아니다. Critical/Warning 급 신규 결함은 없다.

## 위험도

NONE
