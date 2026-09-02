# 신규 식별자 충돌 검토 — `spec-draft-api-convention-status-and-password-codes.md`

## 검토 범위

target 이 신규로 "도입"하는 대상을 실제로 분류하면 다음 5곳이다 (target 본문 "변경안 — spec 5곳" 표):

1. `2-api-convention.md` §6 표에 `202 Accepted` 행 추가
2. 〃 §6 표에 `410 Gone` 행 추가
3. 〃 §5.3 에 "410 은 기본값 매핑이 없다" 서술 추가
4. `conventions/error-codes.md` §3 에 `INVALID_PASSWORD` 행 추가
5. `3-error-handling.md` §1.2 기존 `INVALID_PASSWORD` 행에 §3 인입 참조 한 구절 추가

특기할 점: 이 5곳 전부가 **완전히 새로운 식별자를 발명하는 것이 아니라, 이미 코드베이스·spec 본문
전역에서 통용 중인 식별자를 그 식별자의 "캐논 표"에 뒤늦게 등재**하는 작업이다. 따라서 이 checker
의 본래 관심사(새 이름이 기존 다른 의미와 부딪히는가)를 "그 식별자가 이미 다른 의미로 §6 표/§3
레지스트리를 점유하고 있는가" + "target 이 새로 적어 넣는 의미 서술이 그 식별자의 기존 전역 용례와
어긋나는가"로 구체화해 검증했다.

## 실측 검증

### 1. `202 Accepted` / `410 Gone` — §6 표에 기존 행 없음 (충돌 없음)

`spec/5-system/2-api-convention.md` §6 현재 표(`:200`~`:214`)를 직접 읽어 확인:
`200·201·204·400·401·403·404·409·413·422·429·500·503` — **202·410 행 자체가 없다**. target 의
"미등재는 202·410 둘뿐" 이라는 실측 주장과 일치하며, 새로 추가하는 두 행이 기존 행과 이름
충돌을 일으킬 자리가 없다.

### 2. 두 코드의 "의미"가 전역 용례와 일치하는지 교차 검증

target 이 §6 에 넣으려는 의미는 `202`="비동기 수락(큐 적재)", `410`="리소스가 있었으나 소멸·비활성"
이다. 이 의미가 spec 전역에서 이미 쓰이는 202/410 용례와 다르면 "표는 새로 맞는데 스펙 코퍼스와
갈라진다"는 실질적 충돌이 된다. 아래 파일들을 grep+열람해 대조했다:

- `202 Accepted`: `12-webhook.md`(WH-RS-01 큐 적재 즉시 응답) · `14-external-interaction-api.md`(EIA-NF-04
  비동기 명령 즉시 응답) · `15-chat-channel.md`(R-CC-12 큐 적재/silent-skip 공용) · `data-flow/15-external-interaction.md`
  · `conventions/swagger.md:341`(`ApiAcceptedWrappedResponse`) — 전부 "요청을 큐/비동기 처리로
  수락" 의미로 **일관**된다. 코드 레벨로도 13개 엔드포인트(`@HttpCode(HttpStatus.ACCEPTED)`,
  interaction·workflows·knowledge-base·schedules·graph·executions·hooks 7 컨트롤러) 를 직접
  grep 해 개수·의미(실행 큐 등록·KB 재추출 큐잉·스케줄 즉시 실행 등 전부 비동기 수락)를 재확인했다
  — target 실측과 일치.
- `410 Gone`: `12-webhook.md` WH-EP-07(비활성 트리거) · `14-external-interaction-api.md` EIA-IN-12
  (종료된 execution) · `data-flow/10-triggers.md`(`TRIGGER_INACTIVE`) · `7-channel-web-chat/*`
  (`EXECUTION_TERMINATED`) — 전부 "존재했던 리소스가 소멸/비활성화됐다" 의미로 **일관**된다.
  코드 레벨 `new GoneException` 6곳(`interaction.service.ts` ×2·`workspace-invitations.service.ts`
  ×3·`hooks.service.ts` ×1, 프로덕션 코드만 — 테스트 파일 2곳 별도)도 이 의미 범주 안에 있다.

즉 target 이 §6 에 새로 적는 두 줄은 spec 코퍼스 전역·코드 전역과 **이미 정합**돼 있었고, 표만
뒤늦게 따라잡는 편집이다. 새 의미를 창작해 기존 관행과 부딪히는 사례가 아니다.

### 3. §5.3 "410 은 기본값 없음" 추가 — 코드 실측과 일치

`GlobalExceptionFilter.getCodeFromStatus`(`codebase/backend/src/common/filters/http-exception.filter.ts:140`)
를 직접 읽어 `case 410` 이 없고 `default: 'INTERNAL_ERROR'` 로 떨어짐을 확인했다 — target 의
핵심 근거 주장과 정확히 일치. §5.3 현재 기본값 목록(`:171`)에도 410 이 없어 이 추가가 기존 서술과
충돌하지 않는다.

### 4. `INVALID_PASSWORD` — `error-codes.md §3` 레지스트리에 기존 행 없음, 3-way 근접 명명은 이미 문서화됨

`spec/conventions/error-codes.md` §3 현재 표(`:74`~`:81`)를 전수 확인: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` ·
초대 흐름 lowercase 3그룹 · OAuth callback query param 그룹 · `WORKER_HEARTBEAT_TIMEOUT` · `AbortError`
— **`INVALID_PASSWORD` 행이 없다**. 신규 추가가 §3 기존 행과 부딪히지 않는다.

근접 명명 3종(`INVALID_PASSWORD` wire 코드 / `PASSWORD_INVALID` wire 코드 / `login_history.failure_reason`
감사값)을 grep 전수로 재확인했다 (`spec/5-system/3-error-handling.md:50,70` · `spec/5-system/1-auth.md:339,750` ·
`spec/data-flow/2-auth.md:76` · `codebase/backend/src/modules/auth/auth.service.ts:347` ·
`codebase/backend/src/modules/users/users.service.ts:266,284,292`). 결과: **의미 구분이 이미
spec 본문에 명시적으로 정착**돼 있다 —
`3-error-handling.md:50`(§1.2 카탈로그 행), `:70`(근접 명명 주석), `1-auth.md:339`(본문 SoT) 세 곳이
이미 "`INVALID_PASSWORD`(비밀번호 변경, 401) ≠ `PASSWORD_INVALID`(재인증/재확인, 401) ≠
`login_history.failure_reason` 감사값(레이어 다름)"을 명문화한 상태다. target 이 §3 에 새로
추가하려는 서술(형제 3종 구분)은 이 기존 구분을 §3 레지스트리 관점으로 **다시 진술**하는 것이지,
새로운 구분을 발명하거나 기존 구분과 어긋나는 서술을 넣는 것이 아니다.

target 이 명시적으로 `PASSWORD_INVALID` 는 §3 에 **등재하지 않는다**(이름이 정확하므로)고 결정한
것도, `3-error-handling.md` 의 기존 근접명명 주석과 방향이 일치한다.

### 5. `3-error-handling.md §1.2` 행 — 신규 행 생성이 아니라 기존 행에 인입 참조 추가

target item 5 는 **새 행을 만드는 게 아니라** 이미 존재하는 `:50` 의 `INVALID_PASSWORD` 행에
"§3 레지스트리 등재 사실" 한 구절을 추가하는 것이다. 실측 결과 그 행이 실제로 이미 거기 있으므로
(위 §4 확인), 이 변경은 행 신설이 아니라 기존 행의 각주 확장이다 — 신규 식별자 충돌 검토 대상이
아니다(식별자 자체가 새로 생기지 않음).

### 6. 다른 축 (요구사항 ID·엔티티/DTO·endpoint·이벤트·env var·파일 경로)

- **요구사항 ID**: target 은 새 요구사항 ID 를 발급하지 않는다(상태 코드 표·에러 코드 레지스트리
  행 추가일 뿐). 해당 없음.
- **엔티티/DTO/인터페이스명**: 신규 타입 없음. 해당 없음.
- **API endpoint**: 신규 endpoint 없음 — 기존 endpoint 들이 이미 발행하던 상태 코드를 표에
  반영할 뿐. 해당 없음.
- **이벤트/메시지명**: 해당 없음.
- **환경변수/설정키**: 해당 없음.
- **파일 경로**: target 자신의 plan 파일 `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md`
  는 저장소에 유일하며(`find`/`ls` 확인), 형제 draft `spec-draft-ws-badge-flip-tracker-close.md`
  와 동일 `spec-draft-*` 명명 컨벤션을 따른다. spec 쪽도 기존 3개 파일(`2-api-convention.md`,
  `error-codes.md`, `3-error-handling.md`)을 편집할 뿐 신규 파일을 만들지 않는다. 충돌 없음.

### 부수 관찰 — 동일 파일을 건드리는 형제 draft와의 관계 (충돌 아님, 참고용)

번들에 포함된 형제 draft `spec-draft-ws-badge-flip-tracker-close.md` 도 같은 파일
`2-api-convention.md`(§10.4)를 편집 대상으로 삼는다. 실측해보니 그 draft 의 §10.4 변경분은 이미
라이브 spec 파일에 반영돼 있었다(`## Rationale` 아래 "§10.4 재연결 요약에..." 섹션, `:420`~`:427`).
target 은 §5.3·§6 만 건드리므로 섹션이 겹치지 않고, target 이 새 `## Rationale` 서브섹션을 추가해도
기존 `## Rationale` 최상위 헤딩과 충돌하지 않는다(이미 다중 `###` 서브섹션 구조). 식별자 충돌은
아니지만, 두 draft 가 같은 파일을 편집 대상으로 등재해 두었다는 점은 병합 순서상 참고할 사실이다.

## 발견사항

없음 — 위 6개 축을 전수 실측했으나 target 이 도입하는 어떤 식별자도 기존 사용처와 의미 충돌을
일으키지 않는다. 오히려 target 은 이미 코드·spec 전역에 정착된 식별자(202/410 상태 코드,
`INVALID_PASSWORD` 에러 코드)를 그 캐논 표(§6, §3)에 뒤늦게 등재하는 "정합화" 작업이며, target
본문 스스로가 근접 명명 3종·4종(`INVALID_PASSWORD`/`PASSWORD_INVALID`/`PASSWORD_REQUIRED`/
`REAUTH_REQUIRED`)의 구분을 실측 근거로 명시하고 있어 이 checker 가 우려하는 "새 이름이 다른
의미를 가진 기존 이름과 헷갈린다" 유형의 위험을 target 자신이 이미 예방적으로 처리했다.

## 요약

target 이 표에 새로 적어 넣는 다섯 곳(202/410 상태 코드 행 2개, §5.3 보강, `INVALID_PASSWORD`
레지스트리 행, `3-error-handling.md` 인입 참조)은 전부 **신규 발명이 아니라 기존 전역 용례를 캐논
문서에 등재하는 편집**이며, `2-api-convention.md §6` 현재 표·`error-codes.md §3` 현재 표를 직접
읽어 각각 202/410/`INVALID_PASSWORD` 행이 부재함을 확인했고, `GlobalExceptionFilter.getCodeFromStatus`
소스·`GoneException`/`@HttpCode(ACCEPTED)` 발행처 전수·근접 명명 3~4종 문서화 상태를 모두
교차검증해 target 의 실측 주장과 실제 코드·spec 상태가 일치함을 확인했다. 신규 식별자 충돌 관점의
위험은 발견되지 않았다.

## 위험도

NONE
