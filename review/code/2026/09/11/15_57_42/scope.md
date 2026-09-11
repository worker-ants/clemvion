# 변경 범위(Scope) 리뷰

## 검토 범위와 방법

이번 diff 는 두 커밋의 누적분이다 — `2ae81077c`(`refactor(triggers): chat-channel 입력 규칙을
TriggersService 에서 떼어낸다`)과 `6dc2b7d60`(`fix(triggers): 거짓 등재 주장을 바로잡고 옮긴
규칙에 전용 단위 테스트를 붙인다`). 프롬프트 번들(18개 파일)과 `git show`/`git diff` 실측을
대조했다. 저장소 트리에는 아무것도 쓰지 않았다(`Read`/`Bash` 읽기 전용 명령만 사용) — 작업
종료 시점 `git status --short` 결과 `review/code/2026/09/11/15_57_42/`(이번 세션 산출물) 외
잔여물 없음.

핵심 검증:

- `git show 2ae81077c^:.../triggers.service.ts` 와 `git show 2ae81077c:.../chat-channel-input-rules.ts`
  를 스크래치 디렉터리에 받아 이동된 6개 함수(`assertChatChannelInputSafe`(+overload 2) ·
  `assertPatchCarriesNoSecrets` · `assertChatChannelAlreadySetUp` · `stripChatChannelPlaintext` ·
  `assertInboundSigningPlaintextByProvider` · `translateSetupChannelError`) 본문을 줄 단위로 직접
  대조 — `private` → `export function` 전환과 `this.` 제거를 제외하면 로직·주석·에러 메시지·타입
  서명이 **한 글자도 다르지 않다**.
- `git show 2ae81077c -- triggers.service.ts` 전문을 읽어 `-` 311줄 / `+` 15줄이 정확히 "6개 메서드
  삭제 + import 블록 교체 + 호출부 6곳 치환"으로만 구성됨을 확인 — 포맷팅만 바뀐 hunk, 무관한 조건문
  변경, 미사용 import 잔존 없음.
- `git show 6dc2b7d60 --stat` 으로 두 번째 커밋(fix)이 건드린 파일을 전수 확인 —
  `chat-channel-input-rules.ts`/`triggers.service.ts` 는 **건드리지 않았다.** 변경은 신규 테스트
  파일(`chat-channel-input-rules.spec.ts`, 185줄) + plan 문서 정정(44줄) + 트래커 항목 추가(39줄)
  + 이전 라운드 리뷰/consistency 산출물 커밋(25개 파일)뿐이다.
- `git show 6dc2b7d60 -- plan/in-progress/impl-chat-channel-binder.md` 전문을 대조 — 이전 라운드
  scope reviewer(`review/code/2026/09/11/15_31_54/scope.md`)가 지적한 WARNING("plan 이 서술하는
  설계와 실제 코드가 모순되는데 plan 이 정정되지 않았다")이 이번 커밋에서 **취소선 처리 + 실제
  결정 기재**로 정확히 해소됐음을 확인했다 — 인접 서술은 건드리지 않고 해당 절(§93-98)에만
  국한된 수정이다(자기-반증형 소정정 관례의 형식과 일치).

## 발견사항

없음 — 스코프 관점의 CRITICAL/WARNING 은 발견되지 않았다.

- **[INFO]** 직전 라운드 스코프 WARNING 이 이번 라운드에서 정확히 해소됨 (참고, 조치 불필요)
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:93-113` (`### ~~처방...~~ **← 철회됨**` 절)
  - 상세: `review/code/2026/09/11/15_31_54/scope.md` 가 지적한 "plan 문서가 같은 커밋의 실제
    코드와 모순되는 설계를 서술한다"는 WARNING 이, 이번 diff(`6dc2b7d60`)에서 원문을 취소선으로
    남기고 실제 결정(delegator 미보존 · drift 2곳)과 철회 사유를 그 절에만 추가하는 방식으로
    정정됐다. 인접 절("대안을 기각한 이유" 등)은 건드리지 않았고, 체크리스트도 실제 완료 상태에
    맞춰 갱신됐다(`- [x] T1 이동...`, `- [x] 뮤테이션 5/5 RED` 등) — 수행 후에만 체크하는 저장소
    관례와 일치한다.
  - 제안: 없음.
- **[INFO]** 신규 테스트 파일(`chat-channel-input-rules.spec.ts`)은 추출된 6개 함수 + 그 진입점만
  다룬다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (전체)
  - 상세: 4개 `describe` 블록이 각각 이동된 함수 그룹(내부 필드 차단 R-CC-21 · provider 분기 ·
    정화/존재성 · `translateSetupChannelError`)에 정확히 대응하고, 이 모듈 밖의 기능이나 무관한
    유틸리티를 테스트하지 않는다. plan 문서가 명시한 "이동의 두 번째 동기(mock 없는 직접 호출)"를
    그대로 실현한 것으로, 기능 확장이 아니라 테스트 커버리지 확보다.
  - 제안: 없음.
- **[INFO]** 트래커 항목 추가(`spec-draft-nullable-notation-followups.md`)는 순수 삽입이고 이번
  PR 이 발견한 사안에 한정된다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2523-2561` (신규 3항목)
  - 상세: 추가된 3개 체크박스는 각각 (1) `slack.md:275`/`discord.md:297` 귀속 표기 drift, (2)
    `translateSetupChannelError` discord verify_key 캐너리, (3) `chat-channel-input-rules.ts`
    구조 정리 6건(비차단) — 전부 이번 두 커밋과 직전 리뷰 라운드가 실제로 발견한 항목이다. 기존
    줄(앞뒤 `SecretResolver.rotate` 항목 등)은 건드리지 않았다 — 순수 삽입.
  - 제안: 없음.
- **[INFO]** `review/code/2026/09/11/15_31_54/**` · `review/consistency/2026/09/11/14_59_33/**`
  (총 25개 파일) 커밋은 무관한 수정이 아니라 이 프로젝트의 표준 절차
  - 위치: 해당 디렉터리 전체
  - 상세: 이 저장소는 `/ai-review`·`/consistency-check` 산출물을 코드 변경과 함께 커밋해 freshness
    게이트가 참조하도록 하는 관례를 갖고 있다(리뷰 fix → fresh review 커밋 패턴). 코드 변경(2
    파일)·신규 테스트(1 파일)·plan/tracker(2 파일) 대비 이 25개 파일이 diff 크기의 대부분을
    차지하지만, 이는 스코프 이탈이 아니라 절차 증빙이다.
  - 제안: 없음.

## 요약

두 커밋 누적 diff 를 소스 대조로 직접 검증한 결과, 핵심 코드 변경(`chat-channel-input-rules.ts`
신규 + `triggers.service.ts` 삭제)은 6개 함수를 문자 그대로 옮기고 호출부만 치환한 순수 이동이며,
로직·주석·타입 서명 어디에도 부가적인 변경이 없다. 두 번째 커밋은 소스 파일을 전혀 건드리지 않고
신규 전용 테스트·plan 정정·트래커 등재·리뷰 산출물 커밋에만 국한됐다. 직전 라운드 scope
reviewer 가 지적한 유일한 WARNING(plan 서술과 실제 코드의 모순)은 이번 라운드에서 국소적으로
정확히 해소됐다. 요청된 범위(T1 순수 이동 + 직전 CRITICAL 정정)를 벗어난 리팩터링·기능 확장·
무관한 파일 수정·불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
