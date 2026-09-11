# Cross-Spec 일관성 검토 — `spec-draft-details-code-landed.md`

## 검토 방법

`_prompts/cross_spec.md` 의 bundle 은 예산 초과로 `15-chat-channel.md` · `2-api-convention.md` ·
`3-error-handling.md` · `slack.md` 등 target 이 가장 많이 인용하는 문서 본문을 절단했다. 이 문서들은
target 의 결정 1~5 가 직접 편집하는 대상이라 절단된 채로는 판정이 불가능해, worktree 의 실제
`spec/**` · `codebase/backend/src/modules/triggers/triggers.service.ts` 를 직접 읽어 대조했다.
아래 발견사항은 전부 그 직접 대조 기준이다.

## 발견사항

### [INFO] `D-3`·`D-9` 가 "살아 있다"는 근거가 실은 `R-D-3`·`R-D-9` 다

- target 위치: `plan/in-progress/spec-draft-details-code-landed.md` `## 결정` 절 상단
  ("편집 대상 `15-chat-channel.md` 에 `D-1`·`D-2`·`D-3`·`D-9` 가 **살아 있고**...")
- 충돌 대상: `spec/5-system/15-chat-channel.md` 685·690·692·694행
- 상세: `15-chat-channel.md` 를 `grep -noE "(^|[^-A-Za-z])D-[0-9]+"` 로 전수 확인하면 독립
  라벨로서의 `D-*` 는 **`D-1`·`D-2`뿐**이다(769~832행 R-CC-21 절, "필드를 받지 않는다"/"경로가
  그 두 비밀을 쓰지 않는다"). `D-3`·`D-9` 로 매칭된 4곳은 전부 `R-D-3`·`R-D-9`
  (Discord provider spec 의 Rationale ID, `providers/discord.md`)에 대한 하이픈-포함
  참조이지, `15-chat-channel.md` 자신이 부여한 `D-*` 결정 라벨이 아니다. 즉 "`D-*` 네임스페이스가
  이미 이 문서 안에서 4개나 쓰이고 있다"는 근거 문장이 실제로는 2개만 참이다.
- 영향: target 의 최종 결론("라벨을 새로 만들지 않고 변경안 번호만 쓴다")은 이 오차와 무관하게
  유효하다 — `D-1`/`D-2` 두 개만으로도 "`D-*` 재사용은 이미 위험하다"는 결론에 충분하다. 판정을
  뒤집을 사안은 아니고, 근거 문장의 정확도 문제다.
- 제안: `## 결정` 절 상단 문장에서 `D-3`·`D-9` 를 빼거나 "`R-D-3`·`R-D-9` 로 참조되는 형태까지
  포함하면 4곳"으로 정정. 블로킹 아님.

## 상세 대조 결과 (충돌 없음 확인)

아래는 절단으로 가려졌던 4개 핵심 문서에 대해 target 의 결정 1~5 가 실제 SoT 와 상충하지 않음을
직접 대조로 확인한 항목이다. 발견사항으로 등재하지 않는 이유를 함께 적는다.

1. **결정 1 (시제 3곳)** — `15-chat-channel.md` 375·415·426행을 직접 읽으면 target 이 지목한
   정확히 그 문장이 지금도 남아 있다: §5.4.1·§5.4.1.1 의 "위 「`code` 없음」은 **배선 전
   관측값**이다" 라벨 2곳, §5.4.1.2 의 "그 PR 이 머지되기 전까지 이 문단은 「아직 안 실린다」를
   서술할 뿐" 시한절 1곳. `git log`(`71feabeea` `#1317`, HEAD)로 배선 PR 이 이미 이 브랜치에
   머지돼 있음도 확인했다 — target 의 "②가 명백히 거짓" 판단과 일치. 충돌 없음.

2. **결정 2 (`authConfigId` 판별 기준)** — `triggers.service.ts:1000-1026`
   (`assertAuthConfigInWorkspace`)를 읽으면 실제 코드가 정확히 target 이 묘사한 형태다:
   top-level `code: 'AUTH_CONFIG_NOT_FOUND'` + `details: { field: 'authConfigId', code:
   ErrorCode.INVALID_FIELD }`, 그리고 코드 주석 자체가 "§5.3 판정 미해결 — planner 결정
   대상"이라고 명시하며 이 draft 트래커를 가리킨다. `2-api-convention.md §5.3`
   (173~253행) 의 "둘을 겹쳐 쓰지 않는다"(207행) 규칙은 **"같은 사유"** 중복만 금지하고,
   `field`-less 진단 payload 예외(233~236행)만 명시할 뿐 "top-level 특화 코드 + generic
   `details.code`" 조합은 다루지 않는다 — target 의 결정 2 는 기존 규칙을 뒤집지 않고 빈 자리를
   채우는 additive 보강이다. 충돌 없음.

3. **결정 3 (`AUTH_CONFIG_NOT_FOUND` 카탈로그 등재)** — `3-error-handling.md` 전역에
   `AUTH_CONFIG_NOT_FOUND` 0건, `conventions/error-codes.md` 도 0건 확인(target 의 실측과 일치).
   §1.10(232~241행, 트리거 endpointPath) 바로 옆에 신규 §1.11 을 두는 안은 heading 번호·"도메인
   spec 참조" 접미 컨벤션과 정합한다. 다만 **표 형태**는 주의가 필요하다 — §1.10 은
   "세부 코드(`details.code`)" 열을 쓰는 표(top-level 은 상태 기본값 유지 패턴)인 반면,
   `AUTH_CONFIG_NOT_FOUND` 는 **top-level 코드**이므로 §1.9(220~230행, `CANNOT_ASSIGN_OWNER` 등)
   가 쓰는 "코드 | status | 설명 | 도메인 SoT" 표 형태가 맞다. target 문서 자체는 이 구분을
   명시하지 않아 실제 편집 시 §1.10 표를 그대로 복제하면 형태가 어긋날 수 있다 — 다만 이는
   target 문서의 "결정"이 틀렸다기보다 집행 단계의 세부 지침 누락이라 INFO 로도 등재하지 않았다
   (체크리스트 항목 "판정 + §5.3 문면 보강 + 카탈로그 등재 셋 다"에서 실제 편집자가 §1.9/§1.10
   두 선례를 비교하면 자연히 걸러진다).

4. **결정 4 (예시 9곳 `details.code` 병기)** — `slack.md:275` · `discord.md:948` 모두
   `details.field='inboundSigningPlaintext'` 만 있고 `code` 없음을 확인했고, 대응 코드
   (`triggers.service.ts` `assertInboundSigningPlaintextByProvider`, 786~849행)는 이미
   `code: ErrorCode.INVALID_FIELD` 를 싣는다 — 문서가 구현보다 좁다는 target 의 진단이 정확하다.
   `2-trigger-list.md` 의 `details.field=` 7자리(119·120·176×2·177·178, `endpoint_path` 제외)도
   전수 grep 으로 재확인했고 전부 `triggers.service.ts` 에서 `code: ErrorCode.INVALID_FIELD` 로
   실제 배선돼 있다(656·734·745·799·817·832·844·510행). 문서-구현 어긋남의 방향(문서가 뒤처짐)이
   결정 4 의 처방과 일치. 충돌 없음.

5. **결정 5 (`botToken` 형식 서술 정정)** — `15-chat-channel.md` 전역에
   `^\d{6,}:[A-Za-z0-9_-]{30,}$` 패턴 0건(§5.4 는 rotation API 응답 계약이지 형식 절이 아님)을
   확인했다. 그 정규식은 `content/docs/06-integrations-and-config/telegram{,.en}.mdx` +
   `i18n/dict/{ko,en}/triggers.ts` 4곳(코드 0건)에만 존재하고, `BOT_TOKEN_INVALID` 는
   `translateSetupChannelError`(`triggers.service.ts:1607-1624`)가 `setupChannel` 의 외부 API
   401/403 을 번역해 발행한다 — 형식 검사 함수(`assertInboundSigningPlaintextByProvider`)는
   `inboundSigningPlaintext` 만 다루고 `botToken` 자체의 형식 정규식은 어디에도 없다. target 의
   "메커니즘이 틀린 서술" 판정과 정확히 일치. 충돌 없음.

## 요약

target 문서가 인용하는 4개 핵심 spec(`15-chat-channel.md`·`2-api-convention.md`·
`3-error-handling.md`·`providers/{slack,discord}.md`)과 대응 구현(`triggers.service.ts`)을 직접
대조한 결과, 결정 1~5 는 모두 실측 근거가 정확하고 기존 spec 규칙을 뒤집지 않는 additive
보강·정정이다 — 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 CRITICAL
급 모순을 찾지 못했다. 유일한 흠은 "결정" 절 상단이 `D-3`·`D-9` 를 `15-chat-channel.md` 자체의
라벨로 오인용한 것(실제로는 `R-D-3`/`R-D-9` 참조)인데, 이는 최종 결론(신규 라벨 네임스페이스를
만들지 않는다)에 영향을 주지 않는 근거 정확도 문제라 INFO 로 등재했다. §1.11 신설 시 §1.10 이 아닌
§1.9 표 형태(top-level 코드 표)를 따라야 한다는 점도 실행 단계 유의사항으로 덧붙였다.

## 위험도

LOW
