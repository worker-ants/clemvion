# 변경 범위(Scope) 리뷰

## 발견사항

없음.

검증한 근거 (`git diff origin/main...HEAD` 를 직접 실측, 프롬프트 요약에 의존하지 않음):

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`: 변경 hunk 가
  `finalizeStalledExhausted` 함수 하나(JSDoc 12줄 추가 + 본문을 `dataSource.transaction(...)` 로
  래핑)에 한정된다. import 추가/삭제 없음(`grep -n "^\+.*import "` 결과 0건). 다른 메서드·다른
  자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)는 diff 에 등장하지 않는다(JSDoc 안
  `{@link}` 참조만).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`: 모든 hunk 가
  `describe('finalizeStalledExhausted (PR4)', ...)` 블록(원본 4874행~) 내부에 위치. 신규 헬퍼
  `installStalledTx` 는 같은 파일 기존 자매 헬퍼 `installCancelTx`(:3281) 를 그대로 본뜬 것 —
  새 패턴 발명이 아니라 기존 컨벤션 재사용. 신규 테스트 3건(트랜잭션 manager 공유 확인·대상
  식별 WHERE 하드닝·트랜잭션 중간 실패 시 throw+emit 안 함)은 전부 이번에 원자화한 로직의 직접
  회귀 고정 테스트이며 무관한 케이스 확장이 없다.
- `spec/5-system/4-execution-engine.md`: §7.1 각주 한 문장 + §Rationale 불릿 하나만 추가(단일
  주제 — dead-letter 마감 원자성). `node-cancellation.md` 등 스코프 밖 문서는 건드리지 않았다
  (`16_19_26` RESOLUTION 이 명시한 impl-prep WARNING — 잘못된 SoT 에 등재하지 않기 — 를 반영한
  흔적).
- `CHANGELOG.md`: 기존 "Unreleased — 종결 이벤트가 DB 와 다른 값을 말하던 곳들" 항목 앞에 신규
  섹션을 삽입만 했고, 기존 항목의 순서·내용은 변경하지 않았다.
- `plan/in-progress/eia-stalled-atomicity.md`(신규) + `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md`(체크박스 1건 flip + 새 결함 항목 1건 등재) +
  `plan/in-progress/update-returning-tuple-shape.md`(경로 문자열 1줄 정정, `eia-db-wire-invariant`
  가 `plan/complete/` 로 이관된 데 따른 링크 갱신) + `plan/complete/eia-db-wire-invariant.md`
  (rename, 이전 PR #1172 머지를 반영해 체크리스트 3건 flip) 는 전부 프로젝트가 강제하는
  `plan/` 라이프사이클·정본 트래커 동시 갱신 규약의 산출물이며, 이번 코드 변경과 1:1 대응한다.
  무관한 plan 항목을 건드리지 않았다.
- `review/code/2026/08/15/{16_04_38,16_19_26,16_31_53}/**` 와
  `review/consistency/2026/08/15/{15_54_20,16_19_57}/**` 는 CLAUDE.md 가 의무화한
  `/ai-review`(3라운드) + `--impl-prep`/`--impl-done` consistency-check 산출물이며, 커밋
  로그(`3e64f2a0a` → `5ba4b125c` → `749488801` → `0d9c6166f` → `a184edc00`)가 각 RESOLUTION.md
  가 서술하는 조치와 정확히 대응한다 — 별도 작업의 유입이 아니라 이번 구현의 리뷰 라운드
  기록.
- 포맷팅/주석/임포트/설정 변경 중 실질 변경과 무관한 항목은 발견되지 않았다. 추가된 주석은
  모두 이번 트랜잭션화의 이유·전제(부분 커밋 위험, mock 의 한계, try/catch 의도적 비대칭)를
  설명하는 데 국한된다.
- 워크트리에 남은 미커밋 변경(`plan/in-progress/eia-stalled-atomicity.md` 체크리스트 갱신,
  `spec/5-system/4-execution-engine.md` 한 단어 정정 "정정"→"원자화")도 같은 계열의 문서
  hygiene 이며 코드 스코프를 벗어나지 않는다.

이전 세 라운드(`16_04_38`, `16_19_26`, `16_31_53`)의 scope 리뷰도 매 라운드 NONE 으로 수렴했고,
이번 라운드에서 실측한 diff 도 그 판정을 뒤집을 새 스코프 이탈을 보이지 않는다.

## 요약

이번 diff 는 `finalizeStalledExhausted` 가 자매 함수(`cancelParkedExecution`,
`markWebChatIdleTimeout`)와 달리 트랜잭션 밖에 있었다는 단일 결함을 3라운드에 걸쳐 정밀하게
고치는 데 국한되어 있다. 서비스 로직 변경은 파일 전체에서 단일 메서드, 테스트 변경은 단일
describe 블록에 한정되며, 신규 테스트 헬퍼는 기존 자매 헬퍼를 그대로 재사용해 패턴을
재발명하지 않았다. plan 신규 작성·정본 트래커 체크박스 갱신·spec 문서 문장 추가·CHANGELOG
항목·`/ai-review`·consistency-check 산출물은 모두 프로젝트가 강제하는 워크플로 산출물이며
이번 작업과 1:1 대응한다. `git diff origin/main...HEAD` 로 직접 실측한 두 핵심 코드 파일의
hunk 위치도 프롬프트 서술과 일치해, 프롬프트 밖 추가 변경이나 무관한 리팩토링·포맷팅·임포트·
설정 변경은 발견되지 않았다.

## 위험도

NONE
