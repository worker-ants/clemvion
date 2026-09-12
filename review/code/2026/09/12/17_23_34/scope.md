# 변경 범위(Scope) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 4)

## 검증 방법

이 라운드(`17_23_34`)에서 직전 라운드(`17_02_19`) 이후 새로 커밋된 델타는 `3c9f4dd12`
(`test(repo-guards): DTO 클래스명 중복을 가드로 고정한다`) 하나뿐이다.

- `git show 3c9f4dd12 --stat` 로 이 커밋이 건드린 파일 전체(20개)를 열거 — 신규 가드 3파일 +
  fixture 3파일 + plan 트래커 체크박스/증거 12줄 + `review/code/2026/09/12/17_02_19/**` 리뷰
  산출물(라운드 3 자신의 출력, 이번 라운드의 판단 대상 아님).
- `git diff origin/main..HEAD -- codebase/` 로 `codebase/` 전체 diff(13개 파일, `+521/-104`)를
  최종 상태 기준으로 재대조 — 프롬프트가 예산 초과로 자른 `chat-channel-input-rules.ts` 전체
  diff(188줄)를 직접 열어, 11곳의 `throw new BadRequestException({...})` 인라인 블록이
  `throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼 호출로 글자 단위 치환됐을 뿐임을
  재확인(`field`/`message`/`details.code`/검사 순서 전부 보존).
- `plan/in-progress/chat-channel-rules-cleanup.md` 를 직접 `Read` — 「작업」표 6개 항목과
  diff 전체(전 라운드 누계)를 1:1 대조.
- `git status --short`: 이 리뷰가 만든 변경은 자기 출력 디렉터리
  (`review/code/2026/09/12/17_23_34/`) 하나뿐 — 저장소에 다른 쓰기 없음. 뮤테이션 없음, 원복
  불필요.

## 발견사항

- **[INFO]** 이번 라운드의 조치(`3c9f4dd12`)가 plan 의 「작업」표 6개 항목 어디에도 속하지 않는
  **신규 repo-wide 가드**를 도입한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`(신규),
    `dto-class-name-collision.spec.ts`(신규), `fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts`
    (신규) — `plan/in-progress/chat-channel-rules-cleanup.md` 「작업」표(1~6행)에는 이 항목이
    없다.
  - 상세: `modules/`·`common/` 하위 **114개** `*.dto.ts` 전체를 AST 로 스캔해 `export class`
    이름 중복을 저장소 전역 기준으로 판정하는 새 상시 테스트다. 대상 범위가 이번 PR 이 건드린
    2개 DTO 파일(`chat-channel-config.dto.ts`, `chat-channel-rotate-bot-token-response.dto.ts`)에
    국한되지 않고 저장소 전체로 확장된다는 점에서 형식상 plan 이 사전에 선언한 스코프를 벗어난다.
    다만 (1) 이 가드가 고치는 CRITICAL 은 **이 PR 자신이 만든 결함**이고(라운드 1), (2) 그
    재발 방지 요구가 **라운드 3 `/ai-review` 의 testing WARNING**(`17_02_19`)으로 명시됐으며,
    (3) CLAUDE.md 가 "구현 완료 후 Critical/Warning fix 는 같은 턴의 강제 의무" 로 규정한 절차를
    그대로 따른 것이고, (4) 클래스명 충돌 가드는 원리적으로 로컬 스캔으로는 성립하지 않아
    repo-wide 스캔이 유일하게 유효한 형태다(형제 가드 `dto-jsdoc-citation` 도 같은 패턴).
    즉 "의도 밖 확장"이라기보다 **리뷰가 요구한 조치의 정직한 구현**에 더 가까우나, plan 문서
    자체의 「작업」표는 여전히 갱신되지 않은 채로 남아 있어 사후에 이 표를 읽는 사람은 이 파일
    3~4개가 어디서 왔는지 표만 봐서는 알 수 없다.
  - 제안: 조치 불요(가드 자체는 정당하고 뮤테이션 검증까지 마쳤다). 다만 `plan/complete/` 이동
    전에 「작업」표에 "7. (리뷰 후속) repo-guards DTO 클래스명 충돌 가드" 한 줄을 추가해 두면
    다음 사람이 diff 출처를 표만으로 재구성할 수 있다.

- **[INFO]** 위 신규 가드의 fixture 3파일(`alpha.dto.ts`/`beta.dto.ts`/`decoy.dto.ts`)이
  프로덕션 DTO 규약(`*.dto.ts` 명명)을 그대로 따르는 **대조군 전용 파일**이라, 가드 자신의 스캔
  대상(`SCAN_ROOTS = ['modules', 'common']`)에는 들지 않지만 저장소 전체 `find . -name
  '*.dto.ts'` 류의 다른 스크립트가 있다면 그 결과 집합에는 걸릴 수 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/*.dto.ts`
  - 상세: 이번 PR 의 가드 자신은 스캔 루트를 `modules/`·`common/` 로 명시적으로 좁혀 이 fixture
    를 스캔하지 않는다(코드로 확인). 다른 전역 도구(문서 생성기·swagger 스캐너 등)가 `src/**/*.dto.ts`
    를 통째로 보는 경우가 있는지는 이번 리뷰 범위에서 개별 확인하지 않았다 — 실제 회귀가
    아니라 잠재적 관측 지점으로만 기록한다.
  - 제안: 조치 불요. 재발 시(다른 스캐너가 이 fixture 를 실데이터로 오인) 경로를
    `__tests__/fixtures/` 아래 유지한 채 해당 스캐너의 제외 목록에 추가.

- 그 외 스코프 이탈 없음: `git diff --stat origin/main..HEAD -- codebase/` 결과는 13개 파일
  (`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
  `dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
  (신규) · `dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.ts` ·
  신규 가드 4파일)뿐이며, frontend/`.claude/**`/설정 파일 diff 는 0줄이다. 프로덕션 로직 변경은
  헬퍼 추출(동작 보존, 11곳 `throw` 블록 글자 단위 대조 완료)과 `rotateBotToken` swagger 문서화
  (신규 응답 DTO 는 서비스 실반환 타입과 필드 단위로 일치)뿐이며, 각각 plan 「작업」표 1~6행과
  대응한다. `plan/`·`review/` 신규 파일은 전부 CLAUDE.md 가 규정한 표준 워크플로 산출물 위치와
  일치한다. 포맷팅·주석·임포트·설정의 drive-by 변경은 발견되지 않았다(신규 import 는
  `ChatChannelBlockedField` 타입 1개뿐이고 실사용됨).

## 요약

이번 라운드가 새로 검토할 유일한 코드 변경은 라운드 3 이 낸 testing WARNING(재발 방지
자동화 부재)에 대한 조치 커밋(`3c9f4dd12`) 하나이며, 그 조치는 신규 repo-wide DTO 클래스명
충돌 가드(테스트 2 + fixture 3)와 plan 트래커 체크박스/증거 갱신으로 구성된다. 이 가드는
plan 의 「작업」표에 사전 선언된 6개 항목에는 없지만, 이 PR 자신이 만든 CRITICAL 의 재발
방지를 요구한 리뷰 WARNING 에 대한 직접적이고 비례적인 조치라 "의도 밖 확장"으로 보기는
어렵다 — 다만 「작업」표 자체가 이 항목을 반영하지 않아 사후 추적성이 약간 떨어진다는 점만
INFO 로 남긴다. `codebase/` 전체 diff(누적 13개 파일)는 plan 문서·직전 세 라운드의 scope
리뷰(모두 `NONE`)와 재대조한 결과 새로운 스코프 이탈이 없다 — 프로덕션 로직은 동작 보존
리팩터와 기존 응답의 swagger 미러링뿐이고, 무관한 파일·포맷팅·주석·임포트·설정 변경은
발견되지 않았다. 저장소 파일은 조회만 했고(`git show`/`git diff`/`Read`), 뮤테이션이나
원복이 필요한 쓰기는 없었다.

## 위험도

NONE
