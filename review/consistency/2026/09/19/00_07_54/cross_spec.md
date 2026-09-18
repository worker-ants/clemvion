# Cross-Spec 일관성 검토 — 웹훅 `endpoint_path` 전역 유일 (3차)

## 검토 방법

1차(`review/consistency/2026/09/18/23_39_46`, BLOCK:YES Critical 2·WARNING 1)와 2차(`…/23_54_40`,
BLOCK:YES Critical 2·WARNING 1)가 지적한 항목이 draft 의 S1~S10·「채팅 채널 트리거 — R-CC-21 과의
관계」·「`--spec` 1차/2차 처분」에서 실제로 해소됐는지 절대경로로 직접 확인했다. 대상: `spec/1-data-model.md`,
`spec/2-navigation/2-trigger-list.md`, `spec/5-system/{2-api-convention,3-error-handling,12-webhook,15-chat-channel}.md`,
`spec/data-flow/{10-triggers,11-workflow,14-chat-channel}.md`, `spec/7-channel-web-chat/{4-security,5-admin-console,0-architecture}.md`,
`codebase/backend/migrations/{V002__indexes.sql,README.md}`, `codebase/backend/src/modules/triggers/triggers.service.ts`.

## 발견사항

이번 3차 검토에서 새로운 CRITICAL/WARNING 은 발견하지 못했다. 1·2차 Critical·WARNING 은 아래와 같이 실측 확인상 전부 해소됐다.

- **[해소 확인] 1차 Critical 1 — V131 이 chat-channel provider 등록을 우회** — draft 는 2차 처분에서
  `chat_channel_health` 를 건드리지 않는 쪽으로 설계를 바꿨다(NOTICE `chat_channel=true` + 운영 절차로
  소유 워크스페이스가 재저장 → `setupChannel()` 정상 재등록). `spec/5-system/15-chat-channel.md` R-CC-21
  기각 대안(「`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다」— CCH-AD-02 멱등 전제 근거로
  기각, 806~868행)과 draft 의 처리를 대조한 결과, V131 은 PATCH 도 아니고 `setupChannel()` 을 대체로 호출하지도
  않으므로 R-CC-21 이 명시적으로 금지한 패턴을 재현하지 않는다. draft 의 「그 사이 provider 가 옛 경로로
  보내는 요청은 먼저 만든 쪽이 받고, 채팅 채널이면 그 트리거의 비밀로 서명 검증에 실패해 401」주장은
  `R-CC-12(d)`(711행, auth 실패 401)·`HooksService` 의 chatChannel 분기 서술과 정합한다.
- **[해소 확인] 1차 Critical 2 / 2차 무관 — `data-flow/10-triggers.md` Rationale 절의 반증된 전제** —
  실제 파일 245~253행에 `(workspace_id, endpoint_path)` UNIQUE 전제 문장이 그대로 남아 있음을 확인했다.
  S7 이 이 문장들을 취소선(원문 보존) + `2-trigger-list.md` R-2 선례와 동일한 「정정 (2026-09-18)」 형식
  (실제 R-2 선례 338행 「정정 (2026-09-08)」와 공백 위치까지 일치)으로 정정하도록 명시해 해소 경로가 정확하다.
- **[해소 확인] 1차 WARNING 1 / 2차 무관 — `3-error-handling.md` 카탈로그 행(238행) 누락** — 실제 파일
  234행·238행 모두 `(workspace_id, endpoint_path)` / 「동일 워크스페이스에 같은 endpointPath」 워딩이 남아
  있음을 확인. S5 가 "두 곳"으로 명시해 238행을 포함하도록 수정됐다.
- **[해소 확인] 2차 Critical 1 — `2-api-convention.md` §12.2 표 미갱신** — 실제 572행 「워크스페이스 단위 /
  다른 워크스페이스와는 독립」을 확인. `spec_impact` 에 이 파일이 추가됐고 S8 이 정확히 이 행을 대상으로 한다.
- **[해소 확인] 2차 Critical 2 — V131 이 `degraded` 「두 경로」 닫힌 열거(R-CC-19, CCH-SE-01/NF-03)를
  세 번째 경로로 반증** — 실제 `15-chat-channel.md` 97·123·793행에서 "두 경로" 닫힌 열거를 재확인했다.
  draft 는 이 지적을 받아 V131 이 `chat_channel_health`/`chat_channel_last_error` 컬럼을 **아예 쓰지 않도록**
  설계를 바꿨다(구현 절 「채팅 채널 상태 컬럼은 쓰지 않는다」) — 세 번째 경로를 만들지 않으므로 이 닫힌
  열거와 충돌하지 않는다.
- **[해소 확인] 2차 WARNING 1 — `5-admin-console.md:112` 「DB unique 가 가로채기를 막는다」의 V132 이전
  거짓 서술** — 실제 112행 문구를 확인. `spec_impact` 에 파일 추가됐고 S10 이 이력 문장을 덧붙인다.

### 전수 재확인 (draft 「2차 처분」의 32줄 분류)

`grep -rnE "endpoint_?[pP]ath" spec | grep -iE "unique|유니크|유일|고유|겹|충돌|중복|가로채|squat|스코프|범위|독립|전역|동일|같은|워크스페이스|workspace"` 를
독립적으로 재실행한 결과 정확히 **32줄**이 나와 draft 의 카운트와 일치했다. S1~S10 이 다루는 11줄(§927·1036·126·197·234·238·173·245·247·250·253)
+ 유일성 범위를 새로 고치는 3줄(§572 S8·148 S9·112 S10) + "비유일성 서술"로 분류된 17줄을 재대조한 결과
분류 오류는 없었다. 다만 **`spec/5-system/3-error-handling.md:232`**(섹션 헤딩 `### 1.10 트리거 endpointPath
충돌 세부 코드 …`)가 키워드 "충돌" 매치로 32줄에 포함되는데, draft 의 「2차 처분」 분류 문단(S1~S10 대상
11줄·유일성 3줄·비유일성 17줄 = 31줄)에는 등장하지 않는다 — 산수상 1줄 누락. 다만 이 줄은 스코프를
주장하지 않는 순수 제목이라 **내용 수정이 필요 없다**(비유일성 서술 부류와 실질적으로 동급).

- **[INFO]** draft 「2차 처분」 32줄 분류 문단에서 `3-error-handling.md:232` 누락
  - target 위치: draft 「`--spec` 2차 처분」 문단 (232행 미열거)
  - 충돌 대상: 없음 — `spec/5-system/3-error-handling.md:232` 자체는 스코프 미주장 헤딩이라 수정 불요
  - 상세: draft 가 자체 전수 grep 결과를 「S1~S10 대상 11 + 유일성 3 + 비유일성 17 = 31」로 설명하는데 실제
    독립 재현 결과는 32줄이고 차이는 이 헤딩 한 줄이다. 내용에는 영향 없지만 "32줄 전수 분류"라는 완결성
    주장 자체가 1줄만큼 부정확하다.
  - 제안: 조치 불요(선택) — 재검토 시 언급되면 「232행은 스코프 미주장 헤딩이라 비대상」한 문장만 추가

## 요약

이 draft 는 웹훅 `endpoint_path` 유일성 범위를 워크스페이스 단위에서 전역으로 바꾸는 spec 변경이며, 1·2차
Cross-Spec 검토가 지적한 Critical 4건·WARNING 2건(데이터 모델·API 규약·에러 카탈로그·chat-channel 상태
자원의 닫힌 열거·chat-channel provider 재등록 우회·웹챗 콘솔 서술)을 전부 실측 확인 기준으로 해소했다.
특히 chat-channel 관련 두 축(R-CC-21 의 「setupChannel 우회 금지」와 R-CC-19/CCH-SE-01 의 「degraded 두
경로 닫힌 열거」)을 모두 침범하지 않도록 V131 이 상태 컬럼을 쓰지 않고 운영 절차(NOTICE + 수동 재저장)로
돌리는 설계로 바뀐 점이 두 상충하는 제약을 동시에 만족시킨다. `spec/data-flow/11-workflow.md` 의 「복제·
가져오기는 트리거를 승계하지 않는다」 서술과도 정합해 "정상 경로로는 워크스페이스 간 중복이 생기지
않는다"는 draft 의 전제가 뒷받침된다. 새로 발견한 것은 draft 자체의 32줄 전수 분류 산수 오차 1줄(내용
영향 없음)뿐이다.

## 위험도

LOW
