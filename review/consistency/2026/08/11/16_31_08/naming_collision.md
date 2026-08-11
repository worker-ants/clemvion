# 신규 식별자 충돌 검토

## 검토 범위

target 문서: `spec/7-channel-web-chat` (impl-done, diff-base=`origin/main`). 신규 델타는
커밋 `9416da806` — 지시에 따라 이 커밋의 실제 diff 를 `git show 9416da806` 로 직접 확인했다.

변경 파일 2개:
- `codebase/channel-web-chat/src/widget/use-widget.test.ts` — 주석 1줄 정정
  (`direct-load 외부 입력 방어` → `direct-load 전용 방어가 아니다`). 코드 로직·식별자 변경 없음.
- `plan/complete/webchat-boot-apibase-scheme-validation.md` — "라운드 2~5" 회고 절(표 + 서술) 추가.

## 발견사항

없음. 이번 델타는 신규 식별자를 0개 도입한다 — 요구사항 ID·엔티티/타입명·API endpoint·
이벤트명·ENV/설정키·파일 경로 어느 축으로도 새로 정의된 이름이 없다. 변경 내용은 (1) 테스트
파일의 주석 텍스트 정정, (2) 완료된 plan 문서에 붙는 서술형 회고 절뿐이며 둘 다 기존 식별자를
설명할 뿐 새로 명명하지 않는다.

회고 절이 인용하는 앵커·커밋 해시를 실측했다 — 전부 실재한다:

- **커밋 해시 `a652f8733`** — `git cat-file -t a652f8733` → `commit`. 실제로 PR #384
  ("임베드형 웹채팅 위젯 + SDK + 경로-스코프 CORS")의 병합 커밋이며, 회고 절이 주장하는 대로
  이 커밋의 diff 안에 `resolveIframeTarget` 정의(`+export function resolveIframeTarget(`)와
  그 export/import 가 함께 나타난다 — "주석과 그것을 반증하는 코드가 같은 커밋에서 태어났다"
  는 서술이 코드로 뒷받침된다.
- **커밋 해시 `df1375208`** (커밋 메시지에서만 언급, 파일 본문에는 해시 자체는 안 나옴) —
  `git cat-file -t df1375208` → `commit`. 실재.
- **`§R7` 앵커** (회고 절의 "`§R0` → `§R7` 재번호" 서술이 가리키는 현재 섹션명) —
  `spec/7-channel-web-chat/4-security.md:272` `### R7. apiBase 스킴 검증을 두 경로 모두에
  거는 이유 (2026-08-11)` 로 실재 확인.
- **회고 표의 세션 타임스탬프 인용** (`15_16_20`/`15_32_44`/`15_50_53`/`16_06_02`) — 전부
  `review/code/2026/08/11/<ts>/` 디렉터리로 git 에 실재(코드 리뷰 세션). `16_21_15` 은
  `review/consistency/2026/08/11/16_21_15/` 로 실재. 죽은 참조 없음.

억지로 만든 발견 없음 — 짧게 적는다.

## 요약

이번 델타(커밋 `9416da806`)는 신규 식별자를 도입하지 않는다(테스트 주석 정정 + 완료 plan 의
회고 절 추가뿐). 회고 절이 인용하는 커밋 해시(`a652f8733`, `df1375208`)·spec 앵커(`§R7`)·
리뷰 세션 타임스탬프 5개를 전부 `git cat-file -t` 및 파일시스템 대조로 실측했고 모두 실재한다.
죽은 참조를 남긴 이력이 있다는 경고와 달리, 이번 델타는 그 패턴을 재현하지 않는다.

## 위험도

NONE

STATUS: OK
BLOCK: NO
