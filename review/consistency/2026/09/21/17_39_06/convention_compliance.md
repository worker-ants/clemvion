# 정식 규약 준수 검토 — spec/5-system (--impl-prep)

## 검토 범위 메모

- target 은 `spec/5-system` 전체이나, 번들 프롬프트는 컨텍스트 예산 초과로 `1-auth.md` ·
  `2-api-convention.md` · `3-error-handling.md` 세 파일만 전문 포함하고 나머지 15개
  (`4-execution-engine.md` 등)와 `spec/conventions/**` 대부분(포함된 것은 `audit-actions.md` ·
  `cafe24-api-catalog/_overview.md` 뿐)이 절단됐다. 이번 작업(`webauthn-dup-delete`)의 실제
  변경 영역이 인증/2FA/WebAuthn(`1-auth.md`)에 한정되므로, 절단분은 `Read` 로 직접 열어
  `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` 를 전문 대조했다. 나머지
  절단 파일은 이번 변경 영역과 직접 관련이 없어 미열람.
- `plan/in-progress/webauthn-dup-delete.md` 는 `spec_impact: none` 을 선언한다 — 즉 이번 PR 은
  spec 을 고치지 않는다. 아래 발견사항은 spec 의 **현재 상태**(불변) 대비 conventions 준수
  여부이며, 이번 PR 의 착수를 막을 근거로 제시하는 것이 아니다(developer 는 spec 쓰기 권한 밖).

## 발견사항

- **[WARNING]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 에러 코드 카탈로그에 미등재 — 게다가
  "`_NOT_FOUND` 는 전부 404, 유일한 예외는 `AUTH_CONFIG_NOT_FOUND`" 라는 문서 상 불변식을
  실제로는 어기는 **두 번째** 사례다
  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 — `PATCH
    /api/auth/2fa/webauthn/credentials/:id` 행("본인 소유 아니면 404 (enumeration 방지)", 코드명
    미기재)과 `DELETE .../credentials/:id` 행(204만 서술, 실패 케이스 없음). `POST
    .../authenticate/verify` 행("실패: 401 WEBAUTHN_INVALID, counter 역행 시 401 …")도 이
    코드가 아니라 `WEBAUTHN_INVALID` 만 언급한다.
  - 위반 규약: `spec/conventions/error-codes.md` §1("의미 기반 명명 + 도메인 spec 이 정의한
    코드는 §1 카탈로그가 공용 가시성으로 등재") 및 `spec/5-system/3-error-handling.md`
    §1.2.1·§1.3 의 카탈로그 완결성 관례 — 같은 §1.3 이 `MODEL_CONFIG_NOT_FOUND` ·
    `AUTH_CONFIG_NOT_FOUND` · `ALERT_RULE_NOT_FOUND` 처럼 리소스별 404 특화 코드를 빠짐없이
    등재하는 반면 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 만 빠져 있다. §1.3 은 별도로 "이름은
    `_NOT_FOUND` 지만 404 가 아니다 — **이 저장소에서 유일한 예외다**" 라고 `AUTH_CONFIG_NOT_FOUND`
    (400)를 지목해 명시적 불변식을 선언한다.
  - 상세: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 의 4개 지점(404·
    498·504·528줄)이 이 코드를 발행하는데, **성격이 둘로 갈린다** — (a) `updateDeviceName`(498·
    504줄)과 `deleteCredential`(528줄, 이번 PR 이 판정 경로를 바꾸는 자리)은 `404
    NotFoundException` 이지만, (b) `verifyAuthentication`(404줄, `POST
    /api/auth/2fa/webauthn/authenticate/verify` — 로그인 2FA 검증)은 **`401
    UnauthorizedException`** 으로 같은 `code` 값을 던진다. 즉 `WEBAUTHN_CREDENTIAL_NOT_FOUND`
    는 이미 프로덕션에서 404 와 401 두 status 를 다 쓰는 코드인데, 카탈로그에 아예 없어
    §1.3 의 "유일한 예외는 AUTH_CONFIG_NOT_FOUND 하나뿐이다" 라는 문장이 실제로는 거짓이 된다
    — 그 문장을 그대로 믿고 "`_NOT_FOUND` 코드는 항상 404" 로 가정한 채 클라이언트 분기나
    문서를 작성하면 `authenticate/verify` 경로에서 어긋난다. 같은 §1.2.1 은 스스로 "이 표는
    도메인 spec(`1-auth.md`) 본문에 문서화된 코드만 등재한다" 고 선언하는데, `1-auth.md` 자신이
    이 코드명을 어디에도 적지 않아 카탈로그 등재의 전제 자체가 막혀 있다 — `#882`/`#887`/`#893`
    이 반복해 닫아 온 "카탈로그 완결성" 갭과 동종이며, 그 완결성 pass 가 "잔여 0" 이라 적은
    뒤에도 이 자리가 새어 있었다는 뜻이다.
  - 참고: 같은 세션의 `naming_collision.md`(비차단 참고)·`cross_spec.md`(WARNING, LOW)·
    `rationale_continuity.md`(INFO)도 이 미등재를 독립적으로 짚었으나, 세 보고서 모두 4개
    발행 지점을 "PATCH 소유권 실패 + DELETE not-found/소유권 실패" 로만 뭉뚱그려 `404줄`이
    실제로는 **다른 흐름(로그인 2FA 검증)의 401** 이라는 점은 짚지 않았다 — 그래서 "유일한
    예외" 불변식이 이미 깨져 있다는 사실이 어느 보고서에도 명시되지 않았다.
  - 제안: 이번 PR 은 spec 쓰기 권한 밖(developer)이므로 직접 고칠 필요는 없다. 다음 spec-sync
    턴(예: `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커, 이미 이 계열
    "동시 삭제→두 번째 404" 서술 부재를 추적 중)에 아래 두 가지를 함께 등재할 것을 권한다:
    (1) `1-auth.md` §5 의 GET(간접)/PATCH/DELETE `credentials/:id` 행과 `authenticate/verify`
    행에 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드명을 명시, (2) `3-error-handling.md` §1.2.1 에 이
    코드를 등재하되 **404(관리 API)와 401(로그인 verify) 두 status 를 모두 적어**, §1.3 의
    "유일한 예외" 문장이 실제와 다시 맞도록 그 문장도 함께 정정(또는 "예외가 최소 2건" 으로
    일반화)한다.

- **[INFO]** 동시 삭제 관례("두 번째 요청은 404") 가 `1-auth.md` §5 DELETE 행에 명문화되어
  있지 않음 — 단, 이는 이미 알려져 있고 의도적으로 유예된 사항
  - target 위치: `spec/5-system/1-auth.md` §5 `DELETE .../credentials/:id` 행.
  - 위반 규약(참고 대비): `spec/2-navigation/2-trigger-list.md` 의 "동시 삭제: … 두 번째는
    `404 RESOURCE_NOT_FOUND`" 명시 선례.
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` (아래 체크리스트,
    2026-09-21 갱신분)가 이 계열 9자리 전수를 이미 추적하며 "집행 시 그 시점의 해소된 코드
    경로를 기준으로 재열거할 것"이라고 명시적으로 유예해 뒀다 — 즉 이번 PR 이 끝난 뒤 이
    트래커 항목을 갱신하는 것이 정해진 절차이지, 이번 spec 상태의 새로운 결함이 아니다.
    형제 8건(`auth_config`·`model_config`·`workspace`·`integration`·`schedule`·`workflow`
    delete-concurrency)도 전부 같은 이유로 `spec_impact: none` 처리됐다.
  - 제안: 조치 불요 — 트래커의 기존 재열거 절차를 그대로 따르면 된다.

## 그 외 확인한 항목 (위반 없음)

- 명명 규약: `1-auth.md` 의 audit action(`user.2fa_enabled`/`user.2fa_disabled`)은
  `conventions/audit-actions.md` §2.1(과거분사)·§1(언더스코어 토큰 구분)과 일치. WebAuthn 관련
  에러 코드(`WEBAUTHN_DISABLED` 등, `WEBAUTHN_CREDENTIAL_NOT_FOUND` 제외)는 전부
  `UPPER_SNAKE_CASE`.
- 문서 구조 규약: `1-auth.md` 는 `Overview → 본문(§1~§5) → Rationale` 3섹션 구성을 그대로
  따른다.
- API 문서 규약(`spec/conventions/swagger.md`): 대상 엔드포인트(webauthn credentials 목록/수정/
  삭제)의 spec 상 응답 형태(`{ data: { items } }` 비-페이징 고정 컬렉션, 204 no-content)는
  swagger.md §2-5·§6 레거시-패턴 절의 pass-through 예외와 일치하며 어긋남 없음.
- 출력 포맷 규약: `WEBAUTHN_CREDENTIAL_NOT_FOUND` 건을 제외하면 §1.2.1 WebAuthn 카탈로그
  나머지 6개 코드(`WEBAUTHN_DISABLED`·`WEBAUTHN_VERIFY_FAILED`·`INVALID_OPTIONS_TOKEN`·
  `CHALLENGE_INVALID`·`WEBAUTHN_INVALID`·`RECOVERY_CODE_INVALID`)는 도메인 spec 참조 패턴대로
  정상 등재.

## 요약

`webauthn-dup-delete` PR 이 겨냥하는 spec/5-system 영역(주로 `1-auth.md` §1.4·§4·§5)은
conventions 준수 상태가 대체로 양호하다 — 명명·문서 구조·swagger 패턴 위반은 없다. 유일한
실질 발견은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드가 이미 프로덕션 4개 지점(404 두 곳,
이번 PR 대상 delete 포함 + 401 한 곳)에서 쓰이는데도 `error-codes.md`/`3-error-handling.md`
카탈로그 어디에도 등재돼 있지 않다는 것이며, 이로 인해 §1.3 이 선언한 "`_NOT_FOUND` 는 404,
유일한 예외는 `AUTH_CONFIG_NOT_FOUND`" 라는 불변식이 이미 조용히 깨져 있다. 이는 이번 PR 이
만든 결함이 아니라 사전 존재하는 spec 문서화 공백이고, 이번 PR 은 spec 쓰기 권한이 없는
developer 턴이라 직접 고칠 대상도 아니다 — 착수를 막을 이유는 없으며 다음 spec-sync 턴에서
카탈로그 등재 + §1.3 문장 정정을 함께 처리할 것을 권한다.

## 위험도

LOW
