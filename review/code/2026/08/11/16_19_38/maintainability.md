# 유지보수성(Maintainability) Review — 커밋 `df1375208` (주석 2줄 교체, 실행 코드 0줄)

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`. 오케스트레이터가 지정한 2개 확인
항목에 집중한다.

## 1. 새 주석이 또 다른 복제본을 만들었는가

**아니다 — 새 복제가 아니라 기존 2곳의 오기재를 정정한 것이다.** 사실이 지금 세 군데에 있다:

- `spec/7-channel-web-chat/4-security.md` §1 (39행) — 전체 서술(양쪽 경로·순차 발동·"샘플 전용
  아님") 을 담은 SoT.
- `configFromQuery` JSDoc (`use-widget.ts:219-225`) — 3줄 요약 + `SoT: 4-security.md §1` 명시
  포인터.
- `runApplyConfig(fallback)` 호출부 인라인 주석 (`use-widget.ts:1382-1384`) — 3줄, "지우면
  깨진다" 경고.

직전 라운드(`review/code/2026/08/11/15_50_53/maintainability.md`)가 지적한 "4곳 복제"는 **리뷰
이력 서술**(자기정정 내러티브)이 spec Rationale·JSDoc blockquote·plan 완료노트·plan 리뷰라운드
절 네 곳에 SoT 포인터 없이 그대로 반복된 경우였다. 이번 건은 성격이 다르다.

- 두 코드 주석 자리는 **이 커밋이 새로 만든 게 아니라 원래 있던 자리**다(`git log -S` 로 커밋이
  스스로 밝힌 출처는 최초 위젯 PR #384). 개수(2곳)는 그대로이고 **내용만 오류→정정**됐다 — 복제
  카디널리티가 늘지 않았다.
- JSDoc 은 전체 논증을 반복하지 않고 3줄 요약 뒤 `SoT: 4-security.md §1` 로 명시적으로 위임한다
  — 이 PR 의 다른 자리(`safeApiBase` JSDoc, `plan/complete/webchat-boot-apibase-scheme-validation.md`
  §완료)에서 이미 쓴 "포인터로 넘기고 본문은 짧게" 패턴과 일치한다(`review/code/2026/08/11/16_06_02/maintainability.md` §1 이 그 패턴을 이미 검증함).
- 호출부 주석은 JSDoc 과 내용이 상당 부분 겹친다(둘 다 "SDK 가 iframe 쿼리에도 같은 apiBase 를
  싣는다" · "wc:boot 이 나중에 대체한다" 를 말한다). 다만 이건 **다른 진입점을 지키는 경고**다 —
  `configFromQuery` 정의로 점프해서 읽는 사람과, `useWidget()` 본문을 스캔하며 "이 폴백 지워도
  되나" 를 판단하는 사람은 서로 다른 착지점이다. 실제로 이 폴백은 과거에 "host 없는 직접
  로드/샘플 전용" 으로 오해되어 spec 오서술의 근원이 된 바로 그 자리이므로, 삭제 유혹이 생기는
  지점에 직접 경고를 두는 것은 정당한 트레이드오프다(순수 정보 전달이 아니라 "여기서 지우려는
  충동을 막는다"는 별도 목적).

종합하면 이번 변경은 SoT 없는 반복(직전 라운드가 잡은 클래스)이 아니라, SoT 를 새로 명시하며
기존 2개 위성 코멘트를 SoT 와 일치시킨 정정이다. 다만 JSDoc·호출부 주석 두 문장이 거의 같은
사실을 다른 표현으로 담고 있다는 관찰 자체는 남는다 — 정보 손실은 없고 blocking 사유는 아니다.

## 2. 주석 길이

과하지 않다. JSDoc 6줄(빈 줄 포함), 호출부 3줄, 합쳐 10줄 추가/2줄 삭제(커밋 diffstat 과 일치).
같은 파일의 기존 JSDoc 밀도(`safeApiBase` 약 30여 줄, `SeedOutcome`/`shouldAbortAfterSeed` 등)에
비하면 오히려 짧은 축에 속한다.

## 요약

새 복제가 아니라 기존 2개 코드 주석의 오기재를 spec §1 과 일치시킨 정정이며, 복제 자리 수는
늘지 않았고 JSDoc 은 SoT 포인터를 명시해 오히려 추적성이 개선됐다. JSDoc·호출부 주석 간 내용
중첩은 남지만 서로 다른 진입점을 지키는 의도된 트레이드오프로 INFO 수준의 관찰일 뿐 문제로
보지 않는다. 주석 길이도 과하지 않다.

### 위험도

NONE

STATUS: OK
