# Rationale 연속성 검토

## 검토 방법 메모

`_prompts/rationale_continuity.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/15-chat-channel.md`
등 16개 spec 파일과 `<git diff origin/main...HEAD -- code_areas>` 본문이 절단되어 있었다. 프롬프트
지시(§⚠️ 현재 구현 코드의 기준)에 따라 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/impl-details-code-c8f31a`, 현재 세션 CWD와
동일)에서 직접 `git diff origin/main...HEAD` 및 `spec/5-system/15-chat-channel.md` 원문을 읽어
확인했다.

`spec/5-system` 델타는 0개 파일이 맞다 — 관련 spec 결정(`2-api-convention.md §5.3` "field 를 실으면
code 도 싣는다", 2026-09-11 규약화)은 이미 `origin/main` 에 병합된 선행 커밋들
(`df1962e25`·`c0f2a885c`·`fad828884`·`f947b49f4` 등)에 포함돼 있다. 이번 diff(10개 파일 / 코드
변경 약 460줄, 문서 포함)는 그 **이미 합의된 spec 규칙을 코드에 배선하는 후속 구현**이다.

또한 직전 라운드(`review/consistency/2026/09/11/12_18_21/rationale_continuity.md`)가 같은 diff를
동일 관점에서 이미 검토했고, 그 이후 커밋 `9fcce3f47`가 그 라운드의 W2 지적(아래 authConfigId
항목)에 대응해 코드 주석과 durable 트래커 등재를 추가했다. 본 라운드는 그 갱신된 상태를 기준으로
독립적으로 재확인한 결과이며, 결론은 직전 라운드와 대체로 일치한다(재조사로 확인, 맹신 아님).

## 발견사항

- **[INFO]** `authConfigId` 자리 — top-level 도메인 코드 + generic `details.code` 병기가 §5.3
  "겹쳐 쓰지 않는다" 문면과 표면적으로 인접하나, 이미 판정 보류로 명시 트래킹됨
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`assertAuthConfigOwnership` 부근, `AUTH_CONFIG_NOT_FOUND` 발행부)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" — *"둘을 겹쳐 쓰지 않는다 — top-level 을 특화 코드로 바꾸면서 같은 사유를 `details[].code` 에도 넣으면 소비자가 어느 쪽으로 분기할지 갈린다"* / 같은 절 2026-09-11 신설 문구 *"`field` 를 실으면 `code` 도 싣는다 — 형태와 무관"*
  - 상세: `details[].code` 를 실은 13자리 중 12곳은 top-level 이 상태 기본값(`VALIDATION_ERROR`)인데 이 한 곳만 top-level 이 이미 도메인 특화 코드(`AUTH_CONFIG_NOT_FOUND`)다. 그 위에 신규 `details.code: 'INVALID_FIELD'` 를 병기하면 "같은 사유를 양쪽에 넣지 않는다"는 구 원칙과 "field 있으면 code 필수"라는 신규 일반화 원칙이 같은 자리에서 충돌 소지가 있다. 다만 `INVALID_FIELD` 는 *"이 필드가 잘못됐다"* 는 generic 표지일 뿐 `AUTH_CONFIG_NOT_FOUND` 가 이미 말하는 도메인 사유와 **동일 정보가 아니므로**, "같은 사유 중복"에 해당하는지 자체가 해석 문제이지 명백한 위반은 아니다. 코드는 이 긴장을 인라인 주석(`triggers.service.ts:1005` 부근)으로 명시하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 판정 대기 항목으로 이미 등재했다(출처: `review/code/2026/09/11/12_00_40` W1 · `review/consistency/2026/09/11/12_18_21`(plan_coherence) W2). 즉 이번 diff 가 **새로 저지른 무근거 번복이 아니라, 두 원칙의 적용 범위가 겹치는 지점을 발견하고 의도적으로 `code` 유지 쪽을 택하며 근거·추적 링크를 남긴 사례**다.
  - 제안: CRITICAL/WARNING 아님 — 이미 durable 트래커에 planner 결정 대기로 등재돼 있어 이번 라운드에서 추가 조치 불필요. 다음 `--spec` 턴에서 §5.3 "겹쳐 쓰지 않는다" 문구에 "generic `INVALID_FIELD` 는 도메인 특화 코드와 겹치는 사유로 보지 않는다"는 carve-out 한 줄을 명시하면 이 자리가 향후 재조사 대상에서 빠진다.

- **[INFO]** `common/` vs `modules/**(nodes/)` 간 canonical `ErrorCode` 상수 사용 비대칭에 대한 spec Rationale 부재 (직전 라운드와 동일 지적, 재확인)
  - target 위치: `codebase/backend/src/common/utils/password.util.ts` (`validatePasswordStrength` 상단 주석)
  - 과거 결정 출처: `spec/conventions/error-codes.md` §Overview "적용 범위"/"대표 surface 는 둘이다" — `ErrorCode`/`EngineErrorCode` 비대칭 경계는 규정하나 "어느 레이어가 그 const 를 import 해야 하는가"는 다루지 않음
  - 상세: 이번 diff 는 `triggers.service.ts`(modules/**)에서는 `ErrorCode.INVALID_FIELD`(canonical import)를, `password.util.ts`(common/**)에서는 리터럴 `'INVALID_FIELD'`를 유지한다. 코드 주석이 근거("common/ 이 nodes/ 를 import 하는 선례 0건, 같은 층의 `validation.pipe.ts` 도 리터럴 사용")를 밝히고 있어 임의 결정은 아니며, 기존 원칙과 직접 충돌하지도 않는다. 다만 이 layering 판단 자체가 spec Rationale 에 아직 없어 다음 사람이 같은 조사를 반복할 여지가 있다 — 이 역시 `9fcce3f47` 이후 durable 트래커(`spec-draft-nullable-notation-followups.md` 잔여 개선 목록 "layering 비대칭 Rationale")에 이미 등재돼 있다.
  - 제안: CRITICAL/WARNING 아님 — 다음 spec 갱신 시 `error-codes.md` 또는 `2-api-convention.md §5.3`에 "common/ 레이어는 `ErrorCode` enum 을 import 하지 않고 리터럴을 유지한다(승격은 별도 트래커)"는 한 줄 보강을 제안.

## 특기: 확인했으나 문제 없음으로 판정한 지점

- `details[].code` 에 `INVALID_FIELD` 를 배선한 발행 지점 전부(`triggers.service.ts` 다수 + `password.util.ts` 배열 2곳 + `chat-channel-config.dto.ts`/`CustomValidationPipe` 경로)는 `2-api-convention.md §5.3` 의 "field 를 실으면 code 도 싣는다 — 형태와 무관 (2026-09-11 규약화)" 규칙을 그대로 이행한다. 이 규칙은 이미 `origin/main` 에 병합돼 있어 이번 diff 가 그 결정을 뒤집는 것이 아니라 배선하는 것이다.
- `provider` PATCH 차단(`details.field='provider'`, 신규 `code` 병기)은 `spec/2-navigation/2-trigger-list.md` §2.3.1 서술 및 `spec/5-system/15-chat-channel.md §5.4.1.2` (provider 불변성 — `botTokenRef` 가 trigger id 에서만 재유도되므로 전환 허용 시 다른 provider 의 토큰이 새 adapter 로 넘어간다)와 완전히 일치한다. 이번 diff 는 그 위에 `code` 필드만 추가했다.
- `botToken` 에 `@MinLength(1)` 추가는 `spec/5-system/15-chat-channel.md` R-CC-10(rotate 단일 경로 — 토큰 *변경* 은 rotate API 전용)의 대상이 아니다. 이번 변경은 **최초 설정(POST 생성)** 시점의 빈 문자열 검증이며, `ChatChannelUpdateConfigDto` 가 `OmitType` 으로 부모 데코레이터(`@MinLength`)를 제거하고 `@IsEmpty()` 를 재선언하므로 PATCH 경로로 새지 않는다 — `trigger-dto-validation.spec.ts` `[C]` 케이스가 이 경계를 캐너리로 고정한다.
- 특히 R-CC-21 "기각한 대안" 항목 중 *"`SecretResolver.rotate` 에 빈 값 가드를 넣어 이 경로만 막기 — 증상을 가리고 원인을 남긴다"* 는, 이번 diff 의 `@MinLength(1)` 이 **`rotate()` 가 아니라 DTO 입력 층**에 건 가드이므로 그 기각된 대안의 재도입이 **아니다**. 코드 주석도 "`rotate` 자체의 빈 값 가드는 별개 항목" 이라고 명시해 그 경계를 스스로 지킨다.
- `Rationale R-2`(webhook hmacSecret PATCH-vs-rotate 분리, 이후 R-14 로 폐기됨)의 설계나 §5.3 의 "410 기본값 미설정" 결정 등, 과거 명시적으로 기각·폐기된 대안을 이번 diff 가 재도입하는 지점은 발견되지 않았다.
- `chat-channel-rejection-messages.const.ts` 신설(`Record<ChatChannelBlockedField, string>` 양방향 완전성 타입)은 기존 `satisfies` 판본의 편도 검증 한계를 보완하는 것으로, 기존 원칙을 뒤집는 것이 아니라 강화다.

## 요약

이번 diff(10개 파일)는 `spec/5-system/2-api-convention.md §5.3`에 이미 기록된 "details 항목이
field 를 실으면 code 도 싣는다"(2026-09-11 규약화, `origin/main` 에 이미 병합)라는 합의된 규칙을
코드 발행 지점에 배선하는 후속 구현이며, `15-chat-channel.md`의 R-CC-10·R-CC-21·§5.4.1.2 등
관련 Rationale과 상충하지 않는다. 과거에 명시적으로 기각된 대안(R-CC-21의 `rotate()` 빈 값 가드,
R-2의 PATCH-기반 rotate 분리 등)을 재도입하는 지점도 없다. 유일하게 인접해 보이는 긴장
(`authConfigId` 자리의 top-level 도메인 코드 + generic `details.code` 병기)은 새로 발견된 위반이
아니라, 개발자 스스로가 §5.3의 두 문면이 겹치는 지점을 인지해 인라인 주석과 durable
트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 planner 판정 대기로 이미
등재해 둔 상태이며, 직전 라운드(`12_18_21`)의 동일 검토 결론과도 일치한다. `common/`↔`modules/**`
간 `ErrorCode` 상수 사용 비대칭도 같은 성격의 기록된 INFO다.

## 위험도
LOW
