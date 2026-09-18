# 신규 식별자 충돌 검토 — `spec-draft-webhook-endpoint-path-global-unique.md` (3차, 2차 Critical 2·WARNING 1 해소 반영본 — S8~S10 신설)

## 발견사항

- **[INFO]** S8~S10(2차 처분 반영분)이 도입한 값은 기존 표 행의 **값 치환**일 뿐 새 식별자가 아님
  - target 신규 식별자: 해당 없음 — S8(`spec/5-system/2-api-convention.md` §12.2), S9(`spec/5-system/12-webhook.md` 필드 표), S10(`spec/7-channel-web-chat/5-admin-console.md` «`endpointPath` 검증» 불릿)
  - 기존 사용처: `spec/5-system/2-api-convention.md:572` (`| \`Trigger.endpoint_path\` | 워크스페이스 단위 | 동일 워크스페이스 내에서 중복 불가. 다른 워크스페이스와는 독립 |` — 실측, S8 이 정확히 이 행을 대상), `spec/5-system/12-webhook.md:148` (`| \`endpointPath\` | URL 경로 (고유, UUID 기반 자동 생성) |` — 실측, S9 대상), `spec/7-channel-web-chat/5-admin-console.md:112` (`… 공개 webhook path 이므로 경로 주입·중복 가로채기 방지는 그 규약(+ DB unique)이 단일 책임 …` — 실측, S10 대상)
  - 상세: 셋 다 기존 행/문장의 **의미(워크스페이스 단위 → 전역)** 만 바꾸고, 새 필드명·새 제약명·새 API 식별자를 만들지 않는다. `2-api-convention.md` §12.2 표에는 `Trigger.endpoint_path` 한 행만 있어 S8 이 다른 행과 섞일 위험도 없다(전수 확인).
  - 제안: 없음 — 충돌 없음.

- **[INFO]** 마이그레이션 V131·V132, 인덱스명 `idx_trigger_endpoint_path` — 3차에서도 재확인, 변경 없음
  - target 신규 식별자: `V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`(+`.conf`), 인덱스 `idx_trigger_endpoint_path`
  - 기존 사용처: `codebase/backend/migrations/` 최신 파일은 `V130__model_config_workspace_kind_index.sql`(실측 — `ls` 결과 V131·V132 없음). `grep -rln "V131\|V132" plan spec codebase`(review 제외)는 0건 — 병렬 세션·다른 in-progress 문서가 이 번호를 선점하지 않았다. `grep -rn "idx_trigger_endpoint_path"`는 target 문서 자신과 이전 두 회차 review 산출물에서만 나온다.
  - 상세: `V102__trigger_endpoint_path_uuid_check.sql` / `V103__trigger_endpoint_path_uuid_validate.sql` 이 같은 `trigger_endpoint_path_` 접두어를 쓰지만 접미어로 명확히 구분된다(1·2차와 동일 결론). `V131`/`V132` 이름은 `codebase/backend/migrations/README.md` 의 명명 규칙(`V<N>__설명`, 정수 단조증가, 더블언더스코어)을 그대로 따른다.
  - 제안: 없음.

- **[INFO]** 삭제 대상 `idx_trigger_workspace_endpoint`, 재배선 대상 `TRIGGER_ENDPOINT_PATH_CONFLICT`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` — 신규 식별자 아님(1·2차와 동일)
  - target 신규 식별자: 해당 없음 — V002 가 만든 기존 인덱스(`idx_trigger_workspace_endpoint`, `codebase/backend/migrations/V002__indexes.sql`)를 교체 대상으로 참조하고, 기존 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `triggers.service.ts`)·기존 에러 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)의 값/의미 범위만 바꾼다.
  - 기존 사용처: `codebase/backend/migrations/V002__indexes.sql`, `triggers.service.ts`, `triggers.controller.ts`, `spec/5-system/3-error-handling.md`, `spec/2-navigation/2-trigger-list.md`, `spec/5-system/2-api-convention.md`.
  - 상세: 물리적 사건(UNIQUE violation)은 그대로이고 범위(워크스페이스 단위 → 전역)만 넓어진다 — "다른 의미로 이미 쓰이는 이름을 새로 재도입"에 해당하지 않아 본 checker 의 충돌 정의 밖.
  - 제안: 없음.

- **[INFO]** 채팅 채널 설계 변경(2차 Critical 2 반영 — 상태 컬럼 미사용)이 새 식별자를 만들지 않음을 재확인
  - target 신규 식별자: 해당 없음 — 이번 개정은 오히려 1차 처분 초안에 있던 `chat_channel_health='degraded'` 재사용 아이디어를 **철회**하고, NOTICE 로그의 `chat_channel=true` 표시자(DB 컬럼도 spec 식별자도 아님)만 남겼다.
  - 기존 사용처: `spec/5-system/15-chat-channel.md`(`chat_channel_health`·`chat_channel_last_error`·R-CC-19·R-CC-21·CCH-AD-02·CCH-SE-01 — 전부 기존 식별자, 이번 draft 는 이 컬럼들을 **건드리지 않는다**고 명시)
  - 상세: 새 컬럼·새 상태값을 도입하지 않으므로 R-CC-19 «degraded 의 두 경로 정합» 닫힌 열거와 충돌할 여지 자체가 사라졌다(2차 Critical 2 가 지적한 문제의 근본 해소).
  - 제안: 없음.

- **[INFO]** 트래커 신규 항목·plan 파일 경로 — 중복 없음, 새 spec 파일 미생성 (재확인)
  - target 신규 식별자: plan 파일 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`, 트래커 신규 항목 「지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다(묘비 부재)」
  - 기존 사용처: `ls plan/in-progress | grep -i "webhook\|endpoint"` 결과 자기 자신 1건뿐. `spec_impact` 7개 파일(1-data-model·12-webhook·2-trigger-list·3-error-handling·10-triggers·2-api-convention·5-admin-console) 각각을 S1~S10 이 정확히 커버하고(전수 대조), 새 spec 파일을 만들지 않는다.
  - 제안: 없음.

## 요약

3차 개정(2차 `--spec` BLOCK:YES → Critical 2·WARNING 1 반영본, S8~S10 신설)이 새로 추가한 부분을 포함해 전수 확인한 결과, target 이 새로 도입하는 식별자는 마이그레이션 번호 V131·V132 와 인덱스명 `idx_trigger_endpoint_path` 뿐이며 둘 다 기존 마이그레이션·spec·다른 in-progress plan 어디에도 선점되어 있지 않다(`ls`·전수 `grep` 실측). 이번 회차의 실질 신규 변경분(S8 `2-api-convention.md` §12.2, S9 `12-webhook.md` 필드 표, S10 `5-admin-console.md` 불릿)은 모두 기존 표 행·문장의 **값(워크스페이스 단위 → 전역)** 만 바꾸는 것이고 새 필드명·제약명·API 식별자를 만들지 않는다. 채팅 채널 관련 2차 Critical 2 반영(상태 컬럼 미사용으로 설계 변경)도 기존 컬럼을 재사용하지 않는 방향이라 새 식별자·새 의미 충돌 여지가 오히려 줄었다. `idx_trigger_workspace_endpoint`(삭제 대상)·`TRIGGER_ENDPOINT_PATH_CONFLICT`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(재배선 대상)는 신규 식별자가 아니라 기존 식별자의 값·범위 재배선이므로 본 checker 의 "새 식별자 vs 기존 다른 의미" 정의 밖이다. Critical·WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
