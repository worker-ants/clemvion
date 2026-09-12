# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 3)

## 검증 방법

이 라운드(`17_02_19`)에서 새로 검토해야 할 델타는 직전 라운드(`16_39_18`)가 낸 **WARNING 3건**에
대한 조치 커밋 `e07521a27`뿐이다 — `16_17_57`·`16_39_18` 두 라운드는 이미 각자의 scope 리뷰가
`NONE`(발견 없음)으로 수렴했고, 그 리뷰 산출물 자체는 이번 diff 에 process artifact 로 실려
있을 뿐 새로 판단할 코드가 아니다.

- `git log --oneline`: 이 워크트리의 코드 변경 커밋은 `18b0c6aa6`(원 리팩터) →
  `d8ad68b25`(라운드 1 fix) → `e07521a27`(라운드 2 fix, 이번 라운드가 검증하는 대상) 3개.
- `git show --stat e07521a27` + `git show e07521a27 -- codebase/ plan/`: 코드/plan 변경분만
  분리해 전문 대조.
- `git diff c9bc5dca6..HEAD -- .../chat-channel-input-rules.ts`: 프롬프트 예산 초과로 생략된
  파일 2 전체 diff를 직접 열어, 라운드 1·2 리뷰가 이미 검증한 것과 동일한 형태(11곳 헬퍼 치환·
  `hasField`·헤더 주석 확장·falsy-guard 주석)임을 재확인.
- `ls codebase/backend/src/modules/triggers/dto/responses/`: 이동한 신규 파일이 이미 그 디렉터리에
  있던 `trigger-response.dto.ts` 와 같은 관례(`*-response.dto.ts`)를 따름을 확인.
- `git status --short`: 이 리뷰 세션이 만든 변경은 자기 출력 디렉터리(`review/code/.../17_02_19/`)
  하나뿐 — 저장소에 다른 쓰기 없음.

## 발견사항

없음.

## 근거

- **`e07521a27` 은 직전 라운드가 지목한 3건(W1·W2·W3)만 건드린다**:
  - **W1** (규약 위반): `dto/chat-channel-rotate-bot-token.dto.ts` →
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` **rename**(`git show` 가
    `similarity index 65%`로 표시). 헤더 주석을 "왜 평평한 자리를 골랐나" → "왜 그 판단을
    뒤집었나"로 갱신하고, `publicKey` 필드의 서사 주석을 JSDoc → `//` 로 내렸다(`dto-jsdoc-citation`
    래칫 대응, 필드 자체·타입·데코레이터는 무변경). `triggers.controller.ts` 의 import 경로 1줄만
    새 파일 위치에 맞춰 갱신 — 그 외 컨트롤러 로직·데코레이터 변경 없음.
  - **W2** (plan 문서 내부 모순): `chat-channel-rules-cleanup.md` 의 뮤테이션 개수를 "3종" 서술과
    "5종" 표가 혼재하던 것을 "6종"으로 통일 — 체크리스트·증거 문단·실측 표 세 자리 동기화. 코드
    변경 없음, plan 문서 정합화뿐.
  - **W3** (orphan JSDoc): `chat-channel-input-rules.spec.ts` 에서 "대칭 필드도 막는다" 주석이
    직전 라운드의 삽입으로 자기 테스트와 떨어져 있던 것을 원래 위치(그 테스트 바로 위)로 되돌림 —
    텍스트 이동만, 테스트 로직·assertion 변경 없음.
- **plan 트래커 업데이트 1건 추가**: `spec-draft-nullable-notation-followups.md` 의 두 항목
  (`responses/` glob 충돌 항목의 처분 갱신, 「리뷰 in-flight 뮤테이션」 항목에 "reviewer 도
  뮤테이션한다"는 관측 추가)은 이번 라운드가 실제로 겪은 사실(자리 이동 결정, 라운드 2 리뷰가
  보고한 미커밋 뮤테이션 관측)의 기록이며, 트래커의 다른 수백 개 항목은 건드리지 않았다.
- **`codebase/` 안에서 이 3건 외의 변경 없음**: `chat-channel-input-rules.ts` 자체는 이번
  커밋(`e07521a27`)에서 전혀 수정되지 않았다(`git show e07521a27 --stat` 에 파일명 없음) — 라운드 1
  커밋(`d8ad68b25`)까지 끝난 리팩터 본체는 이번 라운드의 검토 대상이 아니고, 이미 `16_39_18`
  scope 리뷰가 검증을 마쳤다.
- **import 위생**: 컨트롤러의 바뀐 import 는 파일 경로만 다르고 심볼명(`ChatChannelRotateBotTokenDto`)
  은 동일 — 불필요 import 추가·정리 없음.
- **포맷팅**: rename 된 파일의 diff는 경로 변경에 따른 상대 import(`../entities` → `../../entities`)
  1줄과 주석 재작성 외에 공백·들여쓰기성 변경이 섞여 있지 않다.

## 요약

이번 라운드가 새로 검토할 유일한 코드 변경은 직전 리뷰가 낸 WARNING 3건(`W1` 파일 위치/이름 규약,
`W2` plan 문서 내부 수치 불일치, `W3` orphan 주석)에 대한 조치이며, 셋 다 그 지적 범위를 정확히
벗어나지 않는다 — 새 로직 추가·응답 형태 변경·무관한 파일 수정은 없다. `chat-channel-input-rules.ts`
본체 리팩터(`18b0c6aa6`)와 라운드 1 fix(`d8ad68b25`)는 이미 앞선 두 scope 리뷰가 각각 `NONE`으로
검증했고 이번 라운드에서 재변경된 바 없다. 전체 PR(원 커밋 3개 합산)도 `plan/in-progress/
chat-channel-rules-cleanup.md` 가 선언한 6개 작업 항목과 1:1 대응하며, `plan/`·`review/` 산출물은
CLAUDE.md 가 규정한 표준 워크플로 위치와 정확히 일치한다. 의도 이상의 변경·불필요한 리팩토링·
요청하지 않은 기능 추가·무관한 파일 수정·의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
