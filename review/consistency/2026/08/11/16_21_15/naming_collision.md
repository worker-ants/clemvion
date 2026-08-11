# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위

target 문서: `spec/7-channel-web-chat` (bundle 전체가 프롬프트에 포함되어 있으나, orchestrator
지시에 따라 이번 라운드의 실질 델타인 커밋 `df1375208` 에 집중해 확인했다.

```
df1375208 fix(webchat): spec 은 "샘플 전용으로 읽지 마라" 고 쓰고, 코드 주석은 "샘플" 이라 했다
 codebase/channel-web-chat/src/widget/use-widget.ts | 12 ++++++++++--
 1 file changed, 10 insertions(+), 2 deletions(-)
```

diff 전문 확인 결과 — `configFromQuery` 의 JSDoc 주석과 직접 로드 폴백 호출부의 인라인 주석,
2곳을 교체. 실행 코드(로직) 변경 0줄, 함수/변수/타입 시그니처 변경 0건.

## 발견사항

없음.

- **신규 식별자 0개 확인**: diff 의 `+` 라인이 언급하는 식별자(`resolveIframeTarget`,
  `configFromQuery`, `apiBase`, `wc:boot`)는 모두 기존 코드/spec 에 이미 존재하는 식별자다.
  - `resolveIframeTarget` — `codebase/packages/web-chat-sdk/src/bridge.ts:192` 에 기존 정의,
    `spec/7-channel-web-chat/4-security.md:39,279` 에 기존 참조.
  - `configFromQuery` — `use-widget.ts` 기존 함수(이번 커밋은 그 함수의 JSDoc 만 교체).
  - 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일 경로 — 이번 커밋에서
    전혀 도입되지 않음(주석 텍스트 변경뿐이므로 해당 카테고리 자체가 무관).

- **인용 앵커 `4-security.md §1` 실재 확인**: `spec/7-channel-web-chat/4-security.md:27`
  `## 1. 보안 정책 요약` 섹션이 실재하며, 그 표(line 39, `apiBase` 입력 검증 행)에 정확히
  이번 주석이 요약하는 내용("두 경로 모두 발동, 쿼리 경로를 host-없는 직접 로드/샘플 전용으로
  읽으면 안 된다")이 서술돼 있다. 앵커-내용 일치.

- **죽은 `§R0` 참조 이력 재확인**: `git log --oneline -S "§R0" -- spec/7-channel-web-chat
  codebase/channel-web-chat` 로 과거 재번호 사고 이력(`4479e771b`, `99d3e9000`)을 확인했다.
  현재 워킹트리 `spec/`·`codebase/channel-web-chat` 전체에서 `§R0` 리터럴 grep 결과 0건 —
  살아있는 `§R0` 참조 없음(이번 커밋도 그런 참조를 추가하지 않았다).

## 요약

커밋 `df1375208` 은 `use-widget.ts` 의 주석 2곳만 교체하는 순수 문서화(코드 주석) 정정으로,
새로 도입된 식별자가 없어 신규 식별자 충돌 관점에서 검토할 대상 자체가 없다. 주석이 인용하는
`4-security.md §1` 앵커는 실재하며 내용도 일치하고, 과거 사고 패턴이었던 죽은 `§R0` 참조는
현재 0건으로 재확인됐다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
