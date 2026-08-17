# 신규 식별자 충돌 검토 — `eia-secret-pattern-token-family` (--impl-prep)

## 검토 대상 요약

`plan/in-progress/eia-secret-pattern-token-family.md` 이 착수하려는 작업은 두 갈래다.

1. 기존 마스킹 정규식 3곳(`sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS` · 동일 파일
   `CREDENTIAL_KEY_PATTERN` · `websocket.service.ts` `CREDENTIAL_KEY_PATTERN`)에 `token` **접두
   계열** 매칭을 추가 — 기존 3개 대안(`access[_-]token|refresh[_-]token|id[_-]token`)을 하나로
   흡수.
2. `spec/5-system/14-external-interaction-api.md` · `spec/5-system/2-api-convention.md` 에 대한
   저비용 문서 정정 3건 (`hmacAlgorithm` 출처 정정, §11 `execution.stop` 표 동기화, §2.2 에
   `/api/external/*` 인증 family 언급 추가).

**새로 도입되는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로는 없다.**
전부 기존에 이미 존재하는 식별자를 (a) 코드 상수는 값만 확장, (b) spec 문서는 이미 다른 절에
쓰인 용어를 동일 의미로 재인용하는 형태다. 이하 각 관점별 확인 근거.

## 관점별 확인

### 1. 요구사항 ID 충돌
신규 ID 없음. `EIA-NX-*`/`EIA-RL-*` 등 기존 ID 를 신설하지 않고, `EIA-NX-03`(hmacAlgorithm 관련)의
서술만 정정한다. 대상 없음.

### 2. 엔티티/타입명 충돌
신규 타입 없음. 문서 정정 1건이 인용하는 `AuthConfig.config.algorithm` 은 이미
`spec/1-data-model.md §2.17`·`spec/5-system/12-webhook.md:167` 에 확립된 소유자이며, 12-webhook.md
가 이미 "`AuthConfig.config` 의 `header`/`algorithm` 은 과거 `config.hmacHeader`/`hmacAlgorithm`
과 위치·소유자가 다르다" 라고 명시하고 있어 정정 방향과 완전히 정합한다. 충돌 없음.

### 3. API endpoint 충돌
신규 endpoint 없음. §2.2 정정이 언급하는 `/api/external/*` 는 이미
`spec/5-system/14-external-interaction-api.md:1155`·`:1307`(R11) 에 "기존 `/api/executions/*`
와 routing prefix·**인증 family** 모두 분리" 로 확립돼 있고, `2-api-convention.md` §6 rate-limit
표(:228~229)·§5.4(:440)에도 이미 등장한다. 이번 변경은 §2.2 URL 구조 규칙 표에 **누락돼 있던
cross-reference를 보강**하는 것으로, "인증 family" 라는 용어 자체도 신조어가 아니라 기존
14-external-interaction-api.md 가 이미 두 번 쓴 표현을 재사용한다. 충돌 없음.

### 4. 이벤트/메시지명 충돌
신규 이벤트명 없음. §11 표 동기화 대상인 `execution.stop` 은 `14-external-interaction-api.md:80,
300, 1124` 와 `6-websocket-protocol.md:237, 242, 820, 1015, 1035` 전역에서 이미 "WS 명령 §4.2
won't-do — REST cancel 대체" 로 일관되게 정의돼 있다(:300 만 괄호 설명이 있고 :1124 는 누락 —
plan 이 지적한 그대로). 이번 작업은 두 표의 **표기를 맞추는 것**이지 새 이벤트명을 만들지
않는다. 충돌 없음.

### 5. 환경변수·설정키 충돌
없음. 정규식 값 확장은 코드 상수(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`)의 내용만
바꾸고 새 ENV var·config key 를 만들지 않는다. `grep` 결과 이 세 상수명은
`sanitize-error-message.ts`(shared, execution-engine 미러)·`websocket.service.ts`·
`mask-sensitive-fields.util.ts`·`mcp-error-codes.ts`·`integration-oauth.service.ts` 등 기존
소비처 전역에서 이미 동일 이름·동일 의미로 재사용되고 있어(SoT 단일) 이름 재사용에 따른
의미 충돌 여지가 없다.

### 6. 파일 경로 충돌
신규 spec 파일 없음. `spec_impact` 는 기존 파일 2개(`14-external-interaction-api.md`,
`2-api-convention.md`)만 가리키며 새 파일을 만들지 않는다. plan 파일명
`plan/in-progress/eia-secret-pattern-token-family.md` 도 기존 `plan/in-progress/` 명명 컨벤션
(작업 슬러그 kebab-case)과 충돌 없이 정합하고, 동일 이름의 기존 plan 파일도 없다
(`find plan -iname "*token-family*"` 결과 본 파일 1개).

## 참고 — 이 관점 밖의 잠재 이슈 (참고용, 등급 없음)

`token` 접두 계열 정규식이 넓어지면 `token: expired` 류 산문·`InteractionToken`/`itk_`/`iext_`/
`wsk_` 같은 **비-민감 문맥의 "token" 어휘**까지 마스킹될 수 있다는 점은 plan 자체가 "받아들이는
오탐" 으로 이미 인지·수용하고 있다. 이는 **식별자 명칭 충돌**이 아니라 정규식의 매칭 범위(오탐률)
문제이므로 본 리뷰(신규 식별자 충돌)의 판정 범위 밖이며 — 필요하다면 security/behavior 계열
검토자의 관점이다.

## 요약

이번 target(`eia-secret-pattern-token-family` 착수 전 --impl-prep)은 신규 ID·엔티티·endpoint·
이벤트·ENV var·spec 파일을 전혀 새로 도입하지 않는다. 코드 변경은 기존 정규식 상수의 **값 확장**
(3개 기존 대안을 1개 패턴으로 흡수)이고, 문서 변경 3건은 모두 이미 다른 절에서 확립된 용어
(`AuthConfig.config.algorithm`, `execution.stop` won't-do, `/api/external/*` 인증 family)를
해당 절에 **정합하게 재인용**하는 정정이다. 검토한 6개 관점 모두에서 기존 사용처와의 의미 충돌을
발견하지 못했다.

## 위험도
NONE
