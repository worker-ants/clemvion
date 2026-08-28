# 문서화(Documentation) 리뷰

## 배경

이 diff 는 이미 2 라운드(`01_26_11`, `01_44_22`)의 `/ai-review` 를 거쳤고, 두 라운드 모두
documentation 관점 WARNING(헬퍼 삽입으로 JSDoc-함수 분리·낡은 JSDoc 서술, 자매 호출부
(`handleNodeCompleted`) 주석의 1단계 서술 잔존, 테스트 제목의 shape 불일치, CHANGELOG 누락)을
지적했고 각 RESOLUTION.md 가 전부 반영을 기록했다. 이번(`02_02_18`) 리뷰는 **그 반영이 실제
소스에 그대로 있는지**를 직접 `Read`/`Grep` 으로 재확인하고, 두 라운드가 놓쳤을 수 있는 새
발견사항을 찾는 데 집중했다.

## 재확인 결과 (직접 소스 대조)

- `codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 `extractNodeErrorPayload`
  JSDoc(51~83행)은 `§4.1-a` 를 인용하고 `output.output.error`(래퍼 통과) shape 을 정확히
  서술하며, `asRecord` 헬퍼(51~56행)는 JSDoc **위**로 옮겨져 있어 JSDoc-함수 인접성이
  복원돼 있다. 종전 라운드가 지적한 "정정 전 §4.1 서술을 그대로 둔 JSDoc" 문제는 **더 이상
  존재하지 않는다**.
- `handleNodeCompleted` 위 주석(805~813행)도 "구조화 에러는 `output.output.error` 다 — `output`
  이 `NodeHandlerOutput` 래퍼이기 때문" 으로 갱신돼 있어, `handleNodeFailed` 주석(842~851행)과
  더 이상 어긋나지 않는다.
- 테스트 제목 `"node.completed with output.output.error APPENDs system_error..."`(`2153`행)
  로 갱신돼 있고, 상위 `describe` 블록 주석(1964~1966행)도 `output.output.error` 로 일치한다.
- `CHANGELOG.md` 상단(1~20행)에 이번 변경 전용 `## Unreleased` 항목이 있다. 원인·영향·"회귀
  아님" 경고까지 포함해 이 저장소의 기존 CHANGELOG 항목들(예: 22행 이하 항목)과 같은 문체·
  깊이를 따른다. `spec/5-system/6-websocket-protocol.md:239` 에 실제로 `§4.1-a`
  (2026-08-24 정정) 섹션이 존재함을 직접 확인해 인용이 정확함을 검증했다.
- `plan/in-progress/system-error-banner-live-ws.md` 는 결함 실측(emit 4곳 좌표),
  fixture 가 결함을 가린 경위, 뮤테이션 예측/실측, 스코프 밖 항목까지 기록한 양호한 변경
  이력 문서다.
- `grep` 으로 `extractNodeErrorPayload` 의 구 2-인자 시그니처(`rawError, rawOutput`) 호출이나
  낡은 `§4.1`(비-`-a`) 인용이 이 파일·이 diff 범위 안에 더 남아 있지 않음을 확인했다 —
  코드베이스 다른 곳의 `§4.1` 인용은 전부 무관한 spec 문서(Chat Channel, AI Agent
  presentations 등)를 가리키는 것이라 오탐이 아니다.
- `spec/conventions/conversation-thread.md` 의 CT-S9 서술("`parseHistoryMessages` 가
  `output.error` 로부터 system_error 합성")은 이번 diff 대상이 아닌 별도 코드 경로
  (`conversation-utils.ts` `parseHistoryMessages`, history/snapshot 재생 전용)를 가리키며,
  그 함수 자신의 JSDoc 이 이미 "output" 을 `raw.output`(도메인) 기준으로 명명하는 자기
  일관적 용어라 이번 PR 의 "`output.output.error`" 표기와 실제로 모순되지 않는다 — 다른
  파일의 다른 명명 기준일 뿐이므로 새 발견사항으로 등록하지 않는다.

## 발견사항

- **[INFO]** diff 범위 밖의 untracked 잔여 파일 — 저장소 위생
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts.bak` (git 미추적,
    `git diff`/`meta.json` 대상 3파일에 없음)
  - 상세: 워크트리에 52KB 짜리 `.bak` 백업 파일이 남아 있다(아마 이전 라운드 편집 중 생성된
    사본). git 추적 대상이 아니고 이번 PR diff 에도 포함되지 않아 리뷰·머지에는 영향이
    없지만, 실수로 `git add -A` 등에 딸려 들어가거나 다음 세션에서 혼동을 일으킬 수 있다.
  - 제안: push 전에 삭제(`rm codebase/frontend/src/lib/websocket/use-execution-events.ts.bak`).
    조치 없어도 이번 리뷰의 위험도에는 영향 없음(diff 밖).

- **[INFO]** README·API 문서·설정 문서 — 해당 없음 (변경 불요 확인)
  - 상세: 이번 변경은 프런트 WS 이벤트 핸들러 내부의 파싱 버그 수정이며 새 환경변수·설정·
    공개 API·엔드포인트 추가가 없다. 백엔드 payload·WS 프로토콜 계약 자체는 바뀌지 않았고
    (CHANGELOG 에도 명시), spec(`§4.1-a`)은 이미 2026-08-24 에 정정되어 있어 이번 코드
    변경은 그 spec 을 뒤늦게 따라잡는 것뿐이다. `plan/in-progress/system-error-banner-live-ws.md`
    의 `spec_impact: none` 과 일치.

- **[INFO]** 이전 라운드(01_26_11 · 01_44_22)의 documentation WARNING 전건이 실제 소스에
  반영되어 있음을 직접 재확인 — 위 "재확인 결과" 참고. 추가 조치 불요.

## 요약

이번 최종 diff 는 두 차례 리뷰 라운드를 거치며 지적된 문서화 결함(방금 고친 함수의 JSDoc이
정정 전 spec 문구를 그대로 남긴 것, 자매 호출부 주석의 1단계 서술 잔존, 테스트 제목·describe
주석의 shape 불일치, CHANGELOG 누락)을 전부 실제로 반영했음을 소스 레벨로 직접 확인했다.
JSDoc·인라인 주석·테스트 이름·CHANGELOG·plan 문서가 서로 모순 없이 같은 `§4.1-a` /
`output.output.error` 서술로 수렴해 있고, "종전 서술이 이 결함을 낳았다"는 이력을 취소선으로
남겨 재발 방지 가치도 있다. 새로 찾은 항목은 diff 범위 밖의 untracked `.bak` 잔여 파일 하나
(제거 권장, 위험 없음)와 이미 해당 없음이 확인된 README/API 문서 항목뿐이다.

## 위험도
NONE
