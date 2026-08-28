# 신규 식별자 충돌 검토 — spec-draft-error-cause-criterion.md

## 검토 범위 요약

target 은 `spec/5-system/3-error-handling.md` §6.3(민감 정보 마스킹) 아래에 신설 소절
`#### 6.3.1 에러 wrapping 시 cause 부착 기준` 을 추가하자는 spec draft plan 이다. 도입하는
신규 식별자 표면을 항목별로 확인했다.

1. **요구사항 ID** — target 은 새 요구사항 ID(`ND-*`, `EIA-*` 류)를 부여하지 않는다.
   `#1219`/`#1226`/`#814` 는 기존 PR/issue 번호를 근거로 인용할 뿐 새로 발급하는 ID 가 아니다.
   충돌 없음.
2. **엔티티/타입명** — 새 DTO·인터페이스·엔티티명 도입 없음. `{ cause: err }` 는 target 이
   새로 만드는 이름이 아니라 Node.js 표준 `Error` 옵션(`ErrorOptions.cause`)이고, 코드베이스
   3곳(`expression-resolver.service.ts:316`, `code.handler.ts:454`,
   `secret-resolver.service.ts:89-94`)에서 이미 그 의미로 쓰이고 있음을 실측 확인했다
   (`grep -n "preserve-caught-error"` 로 대조). 충돌 없음.
3. **API endpoint** — 신설 endpoint 없음. `3-error-handling.md` §2(에러 응답 형식)의 REST
   에러 envelope(`error.code/message/details/requestId`, §2.1~§2.2)에는 `cause` 필드가
   존재하지 않아 wire-level 충돌도 없다 — target 의 `cause` 는 JS 서버 내부 에러 체이닝
   전용이고 응답 envelope 스키마를 바꾸지 않는다.
4. **이벤트/메시지명** — webhook·queue·sse 이벤트명 신설 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** — target 은 새 spec 파일을 만들지 않고 기존 파일의 소절만 추가한다.
   plan 파일명 `plan/in-progress/spec-draft-error-cause-criterion.md` 는 기존 컨벤션
   (`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)과
   `spec-draft-<주제>.md` 패턴이 일치하고, 동일 경로에 기존 파일이 없음을 확인했다.

## 부가 확인 — 헤딩 번호 충돌

`spec/5-system/3-error-handling.md` 의 실제 헤딩 구조를 `grep -n "^#"` 로 전수 확인한 결과
§6 은 6.1/6.2/6.3 세 소절만 있고 6.3.1 은 존재하지 않는다(§6.3 L467 → §7 L476 사이에 빈
자리). target 이 제안하는 `6.3.1` 번호는 기존 헤딩과 충돌하지 않는다.

## 부가 확인 — "cause" 용어 재사용

`spec/` 전체에서 "cause" 를 대소문자 무관 검색한 결과, 기존 6곳(`4-nodes/1-logic/10-parallel.md`
3곳, `4-nodes/6-presentation/0-common.md` 2곳, `5-system/13-replay-rerun.md`,
`conventions/node-cancellation.md`)은 전부 **"root cause"**(장애 원인 분석이라는 서술적 개념)
용법이며, target 이 도입하는 `Error.cause`(JS 프로퍼티, backtick 코드 서체로 표기)와 문법적으로도
문맥적으로도 구분된다 — 동일 식별자의 재정의가 아니라 우연한 동음이의(analysis term vs 코드
프로퍼티명)이므로 CRITICAL 대상이 아니다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 신규 식별자 충돌을 찾지 못했다.

- **[INFO]** "root cause" 용어와의 근접성
  - target 신규 식별자: `6.3.1 에러 wrapping 시 cause 부착 기준` 및 본문의 `cause` (Error.cause)
  - 기존 사용처: `spec/4-nodes/1-logic/10-parallel.md:24,73,167,246` 등 "root cause"(분기 실패
    원인 재현) 서술
  - 상세: 두 용법은 문법·의미가 다르지만(하나는 영어 관용구, 하나는 JS 프로퍼티명), 같은
    "error-handling" 도메인 문서 군에서 "cause" 라는 단어가 두 가지 다른 개념을 가리키므로
    사람이 빠르게 훑을 때 순간적 혼동 여지가 있다. 실질 충돌은 아니다.
  - 제안: §6.3.1 신설 시 본문에서 `Error.cause`(JS)와 "root cause"(장애 원인) 는 무관한
    개념임을 한 줄로 명시하면 향후 교차 참조 시 혼동을 예방할 수 있다. (필수 아님, 선택적 개선)

## 요약

target 이 새로 도입하는 표면은 spec 소절 번호(`§6.3.1`) 하나뿐이며, 이는 기존
`3-error-handling.md` 헤딩 구조(§6.1/§6.2/§6.3, 다음 §7)와 겹치지 않는다. 새 요구사항 ID·
엔티티/DTO·API endpoint·이벤트명·ENV/config key 는 전혀 도입하지 않고, `{ cause: err }` 는
이미 코드베이스 3곳에서 동일한 의미로 쓰이던 JS 표준 프로퍼티를 spec 문서화하는 것뿐이라
신규 식별자 충돌 표면 자체가 거의 없다. plan 파일 경로도 기존 `spec-draft-*` 명명 컨벤션과
일치한다. "root cause" 라는 기존 서술적 표현과의 동음이의 가능성은 INFO 수준의 사소한
명확화 제안에 그친다.

## 위험도

NONE
