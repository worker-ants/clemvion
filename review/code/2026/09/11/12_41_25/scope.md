# 변경 범위(Scope) 리뷰

## 검증 방법

`git log --oneline -5`로 `origin/main...HEAD` 가 5개 커밋(`0710021f0`→`0fb691248`→`2d0270fbd`→
`8a6e66285`→`9fcce3f47`)으로 구성됨을 확인했고, `git diff --stat origin/main...HEAD -- codebase/
CHANGELOG.md plan/` 로 실제 코드/문서 변경분(13개 파일, +790/-42)만 추려 프롬프트의 파일 1~13과
대조했다. 이 세션이 리뷰하는 라운드(4라운드, `12_41_25`)는 직전 3라운드(`11_05_27`→`11_33_35`→
`12_00_40`)가 이미 각각 scope.md 로 NONE 판정을 낸 위에 쌓인 것이라, 신규분인 마지막 커밋
`9fcce3f47`(리뷰 인용 규약 위반 2건 정정 + `authConfigId` 앵커 주석)을 `git show 9fcce3f47`
전문으로 직접 열어 확인했고, `triggers.service.ts` 전체 diff(`git diff origin/main...HEAD --
codebase/backend/src/modules/triggers/triggers.service.ts`)를 처음부터 끝까지 대조해 13자리
`code` 배선 외에 다른 변경이 섞이지 않았음을 확인했다. `plan/in-progress/impl-details-code-
wiring.md` 전문을 읽어 A(`details[].code` 15자리)·B(swagger.md 인용 정정)·C(`@MinLength(1)`)·
D(메시지 상수화) 4건의 선언된 스코프와 1~3라운드 리뷰 처분표를 기준선으로 삼았다. `git status
--short` 로 저장소 상태를 확인했다 — 이 리뷰가 만든 뮤테이션은 없다(자신의 세션 산출물 디렉터리
`review/code/2026/09/11/12_41_25/` 만 untracked로 존재).

## 발견사항

- **[INFO]** 이번 라운드(`9fcce3f47`)가 developer 자신이 선언한 "최대 3라운드" 정지 규칙을
  넘겨 4라운드째 `codebase/**` 를 편집했다.
  - 위치: `plan/in-progress/impl-details-code-wiring.md` "정지 규칙" 절 vs 커밋 `9fcce3f47`
    본문의 `> **선언한 3라운드 상한을 넘긴다.**` 단락
  - 상세: 이 자체는 코드 변경 범위(diff 내용)의 문제가 아니라 워크플로 규율의 문제라 이 관점의
    본질적 대상은 아니지만, 스코프 규율의 일부로 기록한다. 커밋 본문이 상한 초과를 **숨기지
    않고 명시**했고, 사유(이번 턴에 developer 자신이 넣은 review-citation 규약 위반을 그대로
    머지하는 것이 상한 준수보다 나쁘다)를 적었다. 실제 diff 를 보면 이 4라운드가 건드린 범위는
    ① bare 시각 인용 2곳을 전체 경로로 교정(`trigger-dto-validation.spec.ts`,
    `triggers.service.spec.ts`, 각 1줄) ② `authConfigId` 자리에 미해결 판정을 설명하는 주석
    추가(동작 변경 없음) ③ `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커
    등재뿐이다 — A/B/C/D 4건 밖으로 새로운 동작 변경을 추가하지 않았다.
  - 제안: 코드 스코프 관점에서는 조치 불필요. 다만 "3라운드 상한"이 반복적으로 초과되는 패턴이
    누적되면(이 저장소 메모리에 `#1287` 8라운드 사례가 이미 기록돼 있다) 정지 규칙 자체의
    실효성을 재검토할 근거가 된다 — 이번 건 자체는 예외 사유가 합당하다.

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물(직전 3라운드 리뷰 세션 + 2회
  consistency-check 세션, 도합 다수 파일)이 코드 커밋들과 함께 diff 에 포함돼 있다.
  - 위치: `review/code/2026/09/11/{11_05_27,11_33_35,12_00_40}/**`,
    `review/consistency/2026/09/11/{10_28_52,12_18_21}/**`
  - 상세: `CLAUDE.md`가 이 위치들을 SoT 로 명시하고 developer 는 구현 착수 직전
    `--impl-prep`·완료 후 `/ai-review`+`--impl-done` 을 의무 실행하게 돼 있다. 앞선 3라운드
    scope.md 도 동일하게 관측·판정했다(선례와 일관).
  - 제안: 없음 — 정상 절차.

## 스코프 안에 있음을 재확인한 항목 (4라운드 신규분)

- `9fcce3f47` 이 건드린 코드 파일은 정확히 3개(`trigger-dto-validation.spec.ts`
  `triggers.service.spec.ts` `triggers.service.ts`)이고, 전자 둘은 주석 문자열 1줄씩만
  바뀌었다(`` `/ai-review` `11_05_27` `` → `` `/ai-review` `review/code/2026/09/11/11_05_27` ``).
  기능 코드·단언 로직 변경 없음.
- `triggers.service.ts` 의 유일한 변경은 `authConfigId` 판정문 앞에 13줄 주석을 추가한 것뿐이고,
  `throw new BadRequestException({...})` 페이로드 자체는 이전 라운드(`0710021f0`)에서 이미 확정된
  `{ field: 'authConfigId', code: ErrorCode.INVALID_FIELD }` 그대로다 — 이번 라운드가 동작을
  바꾸지 않았다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 66줄은 전부 "지금 안
  고치는 이유 + planner 판정 필요"를 기록하는 트래커 항목(체크되지 않은 `- [ ]`)이며, 코드나
  spec 파일을 직접 수정하지 않았다 — `spec_impact: none` 선언과 일치한다.
- E(모듈 경계 추출)는 이번 라운드에도 등장하지 않는다. `TriggersService` 의 구조적 이동은
  전체 diff(5커밋 누적) 어디에도 없다.

## 요약

`origin/main...HEAD` 5커밋 누적 diff는 plan이 착수 전 선언한 A(`details[].code` 15자리)·
B(swagger.md 인용 정정)·C(`botToken` `@MinLength(1)`)·D(거부 메시지 상수화) 4건과, 그에 대한
1~3라운드 리뷰 WARNING/INFO 반영, 그리고 이번 4라운드의 인용 규약 위반 정정 2줄 + 미해결 판정
앵커 주석으로 정확히 구성된다. `git diff`/`git show` 로 파일 단위까지 대조한 결과 프롬프트에 없는
숨은 변경이나 A/B/C/D 밖의 신규 동작 변경은 없었고, 계획이 명시적으로 후속 PR 로 분리한 5번째
항목(모듈 경계 추출)도 여전히 섞여 들지 않았다. 유일하게 기록할 점은 이번 4라운드가 developer
스스로 선언한 "최대 3라운드" 정지 규칙을 넘겼다는 것인데, 이는 코드 diff 의 범위 문제가 아니라
워크플로 규율의 문제이고 커밋 본문이 그 사실과 사유를 투명하게 기록했으며 실제 코드 변경분은
오히려 극히 작다(주석/인용 정정 수준). 의도 이상의 변경, 무관한 리팩토링, 요청하지 않은 기능
확장, 포맷팅/주석/임포트/설정의 임의 변경은 발견되지 않았다.

## 위험도

NONE
