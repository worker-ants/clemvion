# 신규 식별자 충돌 검토 — spec-draft-details-code-landed

## 발견사항

- **[WARNING]** `AUTH_CONFIG_NOT_FOUND` 등재(§1.11 신규)가 카탈로그의 `_NOT_FOUND` 명명 관례를 깬다
  - target 신규 식별자: `3-error-handling.md` 신규 `§1.11` 에 등재되는 `AUTH_CONFIG_NOT_FOUND`
    (변경안 3, `triggers.service.ts:1022` `BadRequestException` → **HTTP 400**)
  - 기존 사용처: `3-error-handling.md §1.3` `RESOURCE_NOT_FOUND`(404) · `ALERT_RULE_NOT_FOUND`(404,
    L84) · `MODEL_CONFIG_NOT_FOUND`(404, L85) · `VARIABLE_NOT_FOUND`(L126) · §1.6 `EXECUTION_NOT_FOUND`
    (404, L191) · §1.9 `WORKSPACE_NOT_FOUND`/`USER_NOT_FOUND`(둘 다 404, L230) — 카탈로그에 등재된
    `*_NOT_FOUND` 접미사 코드는 **전부 404**다. 심지어 같은 문서(L85-86)가 `MODEL_CONFIG_NOT_FOUND`
    (404)와 `MODEL_CONFIG_DEFAULT_MISSING`(400, PR4b Rationale L605-610)을 **의도적으로 다른 이름**으로
    갈라 "같은 코드가 404/400 두 status 를 갖는 모호성" 을 없앤 선례가 있다.
  - 상세: `AUTH_CONFIG_NOT_FOUND` 는 이름만 보면 "리소스 부재 → 404" 로 읽히지만 실제로는 400
    (`BadRequestException`, `assertAuthConfigInWorkspace`)이다. 카탈로그를 접미사 패턴으로 훑는
    소비자(사람이든 코드 생성기든)에게는 `_NOT_FOUND` = 404 라는 이 저장소 자체의 확립된 계약을
    깨는 새 예외가 생긴다 — `MODEL_CONFIG_DEFAULT_MISSING` 선례가 바로 이 혼선을 피하려고 만들어진
    이름이라는 점에서 이번 등재가 그 선례와 반대 방향으로 간다.
  - 제안: 등재 문구(변경안 3, §1.11)에 `MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 분리
    선례를 인용해 "이 코드는 이름과 달리 400 이다 — cross-workspace 참조 차단은 리소스 자체의
    부재가 아니라 **입력값 검증(binding 대상 오류)** 으로 분류했기 때문" 이라는 한 줄을 명시할 것.
    코드(`triggers.service.ts`)를 되돌리는 옵션은 target 의 「기각한 대안」 표가 이미 배제했으므로
    (머지됨·§5.3 이 그 조합을 허용), 남는 선택지는 **문서 쪽에서 예외를 인정하고 이유를 적는 것**뿐.

- **[INFO]** 「결정」 절의 라벨 회피 근거 중 `D-3`·`D-9` 가 `15-chat-channel.md` 에 **독립 토큰으로는
  존재하지 않는다**
  - target 신규 식별자: 없음(오히려 target 은 신규 라벨을 만들지 않기로 결정 — 그 근거 문장)
  - 기존 사용처: `15-chat-channel.md:685,690,692,694` 는 `R-D-3`/`R-D-9`(discord.md 소속 요구사항
    ID, `providers/discord.md` 의 `R-D-3` 를 인용) 뿐이고, 독립된 `D-3`/`D-9` 결정 라벨은 이 파일에
    없다. 실제로 존재하는 것은 `D-1`·`D-2`(L803-804, R-CC-21 인접) 뿐이다.
  - 상세: 이것이 실제 충돌을 만들지는 않는다 — target 은 어차피 새 라벨을 **전혀** 도입하지 않기로
    했으므로(순번 없는 "결정 1~5"/"변경안 1a~5") 근거의 부정확함이 이번 PR 의 실질 결정에 영향을
    주지 않는다. 다만 "라벨 네임스페이스를 두 번 틀렸다" 는 자기반성 문단이 세 번째 사례에서도
    다시 정밀도가 떨어진 것이라, 트래커 문서 어딘가(같은 문단 각주 등)에서 인용 시 `R-D-3`/`R-D-9`
    로 정정해 두면 다음 사람이 grep 결과를 그대로 믿고 반복 조사하는 비용을 줄일 수 있다.
  - 제안: 「결정」 절 문장을 *"`D-1`·`D-2` 가 살아 있고, discord.md 의 `R-D-3`·`R-D-9` 도 같은
    네임스페이스를 공유한다"* 정도로 정정(선택 사항 — 결정 자체는 바뀌지 않음).

## 비대상(충돌 없음, 확인 완료)

- `§1.11`(신규 섹션 번호, `3-error-handling.md`) — 기존 `§1.1`~`§1.10` 전수 확인, 빈 번호 확인.
  다른 `plan/in-progress/*.md`(`spec-conventions-engine-error-code-surface.md`·`spec-sync-auth-gaps.md`·
  `spec-sync-external-interaction-api-gaps.md` 등 `3-error-handling.md` 를 건드리는 트래커 전부) 도
  동시에 `§1.11` 을 선점하지 않는다 — 병렬 세션 번호 충돌 없음.
- `INVALID_FIELD`(변경안 4a/4b/4c 병기 대상) — `2-api-convention.md §5.3`·`3-error-handling.md §2.1`
  에 이미 등재된 generic 코드 재사용. slack.md/discord.md/2-trigger-list.md 어디에도 이 이름이
  다른 의미로 쓰이는 자리 없음.
- `AUTH_CONFIG_NOT_FOUND` 라는 **문자열 자체**는 spec·codebase 전체에서 `triggers.service.ts`/
  `2-trigger-list.md:176` 한 가지 의미로만 쓰인다(다른 의미의 기존 사용처 없음) — 위 WARNING 은
  "다른 의미로 이미 쓰이고 있다" 는 CRITICAL 등급 사유가 아니라 **명명 관례 위반**에 해당해
  WARNING 으로 등급화했다.
- `D-1`~`D-9`/`CV-*`/`DEC-*` 라벨 네임스페이스 회피 자체는 target 이 grep 으로 선검증했고, 실측
  결과(`ED-CV-01~06`·`CCH-CV-01~05` 요구사항 ID 계열 확인, `DEC-*` 가 `spec-draft-nullable-notation-followups.md`
  에서 이미 쓰임 확인)도 정확하다 — 새 라벨을 만들지 않기로 한 결론은 근거가 충분하다.
- `R-12`(`2-trigger-list.md:334`)·`R-CC-21`/`D-1`/`D-2`(`15-chat-channel.md`)·`§1.10`
  (`TRIGGER_ENDPOINT_PATH_CONFLICT`) — target 이 인용만 하고 재정의하지 않음. 충돌 없음.
- 신규 API endpoint·webhook/queue/SSE 이벤트명·ENV var·config key·spec 파일 경로 — target 은 이
  카테고리에서 **어떤 신규 식별자도 도입하지 않는다**(기존 5개 파일의 기존 절에 서술·예시·카탈로그
  등재만 추가). 파일 경로 신규 생성 없음, 명명 컨벤션 위반 없음.

## 요약

target 문서가 새로 도입하는 식별자는 사실상 `3-error-handling.md §1.11`(신규 섹션 번호)와 그 절에
등재되는 `AUTH_CONFIG_NOT_FOUND` 하나뿐이며, 나머지는 전부 기존 코드(`INVALID_FIELD`)의 병기이거나
기존 요구사항 ID/결정 라벨의 인용이다. `§1.11` 자체는 번호·병렬 트래커 충돌이 없어 깨끗하다.
유일한 실질 발견은 `AUTH_CONFIG_NOT_FOUND` 가 카탈로그의 `_NOT_FOUND` = 404 관례(같은 문서가
`MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 을 상태코드로 갈라 세운 바로 그 관례)를
깨고 400 으로 등재된다는 점이다 — 다른 의미로 이미 쓰이는 이름과의 충돌은 아니므로 CRITICAL 은
아니지만, 그 불일치를 등재 문구에 한 줄로 밝혀 두지 않으면 다음 카탈로그 독자가 상태 코드를
오추정할 소지가 있다. 그 외 라벨 회피 근거 문장의 `D-3`/`D-9` 인용 정밀도는 결론에 영향 없는
INFO 수준이다.

## 위험도

LOW
