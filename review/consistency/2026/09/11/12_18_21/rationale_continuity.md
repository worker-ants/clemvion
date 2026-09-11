# Rationale 연속성 검토

## 검토 방법 메모

`_prompts/rationale_continuity.md` 번들은 컨텍스트 예산 초과로 `## 구현 변경 사항`(git diff 본문, 원래 34,843자)과 `spec/5-system/15-chat-channel.md`(원래 86,989자) 등 17개 파일 본문이 절단되어 있었다. 프롬프트 지시(§⚠️ 현재 구현 코드의 기준)에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-details-code-c8f31a`, 현재 세션 CWD와 동일)에서 직접 `git diff origin/main...HEAD`를 재현해 실제 변경분을 확인했다. `spec/5-system` 델타 0개는 사실이며(§api-convention·§error-handling 관련 spec 결정은 이미 `origin/main`에 병합된 선행 커밋 `df1962e25`·`c0f2a885c`·`fad828884`·`3f04761cd`·`94e19be8d`에 포함), 이번 diff(11개 파일 / 코드 변경 약 440줄)는 그 이미 합의된 spec 규칙(`2-api-convention.md §5.3` "field를 실으면 code도 싣는다", 2026-09-11 규약화)을 코드에 배선하는 후속 구현이다.

## 발견사항

- **[INFO]** `common/`과 `nodes/core/error-codes.ts` 간 canonical `ErrorCode` 사용 비대칭에 대한 spec Rationale 부재
  - target 위치: `codebase/backend/src/common/utils/password.util.ts` (diff 내 주석, `validatePasswordStrength` 상단)
  - 과거 결정 출처: `spec/conventions/error-codes.md` §Overview "적용 범위"/"대표 surface는 둘이다" — `ErrorCode`/`EngineErrorCode` 두 const의 비대칭 경계를 규정하나 "어느 레이어가 그 const를 import해야 하는가"는 다루지 않음
  - 상세: 이번 diff는 `triggers.service.ts`(modules/**)에서는 `ErrorCode.INVALID_FIELD`(canonical import)를 쓰고, `password.util.ts`(common/**)에서는 리터럴 `'INVALID_FIELD'`를 유지한다. 코드 주석이 그 이유("common/이 nodes/를 import하는 선례 0건, 같은 층의 `validation.pipe.ts`도 리터럴 사용")를 밝히고 있어 임의 결정은 아니나, 이 layering 판단 자체는 `error-codes.md`의 기존 Rationale이 직접 다루지 않는 새로운 세부 결정이다. 기존 원칙(§Overview "프로젝트 전체의 에러 코드 문자열에 적용"—명명 규율은 문자열 형태와 무관하게 적용됨)과 충돌하지는 않지만, 다음에 이 비대칭을 보는 사람이 "왜 어떤 곳은 상수, 어떤 곳은 리터럴인가"를 다시 조사하게 될 수 있다.
  - 제안: CRITICAL/WARNING 아님 — 코드 주석으로 충분히 설명되어 있으므로 즉각 조치 불필요. 다음 spec 갱신 시 `error-codes.md` §Overview 나 `2-api-convention.md §5.3`에 "common/ 레이어는 `ErrorCode` enum을 import하지 않고 리터럴을 유지한다(9모듈 import 경로 변경은 별도 트래커)"는 한 줄을 추가하면 이 비대칭이 우연이 아니라 의도임이 spec 차원에서도 고정된다.

## 특기: 확인했으나 문제 없음으로 판정한 지점

- `details[].code`에 `INVALID_FIELD`를 배선한 15개 발행 지점(`triggers.service.ts` 13곳 + `password.util.ts` 배열 2곳)은 `2-api-convention.md §5.3`의 "field를 실으면 code도 싣는다 — 형태와 무관 (2026-09-11 규약화)" 규칙을 그대로 따른다. 이 규칙은 이미 `origin/main`에 병합돼 있어 이번 diff가 그 결정을 뒤집는 것이 아니라 이행하는 것이다.
- `triggers.service.ts`의 `AUTH_CONFIG_NOT_FOUND`(top-level 특화 코드) + `details.field='authConfigId'` + 신규 `details.code='INVALID_FIELD'` 조합은 얼핏 §5.3의 구 원칙("top-level을 특화 코드로 바꾸면서 같은 사유를 details[].code에도 넣지 않는다")과 겹쳐 보이나, 2026-09-11 규약화 문구가 "형태와 무관"이라고 명시적으로 일반화했고 `field`가 이미 존재하던 자리에 `code`만 추가한 것이라 새 원칙의 적용 범위 안에 있다. 겹쳐-쓰기 금지 조항은 "동일 사유를 details[].code에 중복 등록하는 것"을 겨냥한 것이지, field-present 항목에 code를 채우는 이번 규칙과는 별개 축이다.
- `provider` PATCH 차단(`details.field='provider'`)은 `spec/2-navigation/2-trigger-list.md` Rationale R-12("provider 를 바꾸는 PATCH 는 400 VALIDATION_ERROR, botTokenRef 가 trigger id 에서만 재유도되므로 전환을 허용하면 다른 provider 의 토큰을 넘기게 된다")와 완전히 일치하며, 이번 diff는 그 위에 `code` 필드만 추가했다.
- `botToken`에 `@MinLength(1)` 추가는 R-CC-10(rotate 단일 경로 — 토큰 *변경*은 rotate API 전용)의 대상이 아니다. 이번 변경은 **최초 설정(POST 생성)** 시점의 빈 문자열 검증이며 rotate 경로 자체를 건드리지 않는다. `ChatChannelUpdateConfigDto`는 `OmitType`으로 부모 데코레이터를 제거하고 `@IsEmpty()`를 재선언하므로 `@MinLength(1)`이 PATCH 경로로 새지 않는다 — 테스트(`trigger-dto-validation.spec.ts` `[C]`)가 이 경계를 캐너리로 고정한다.
- `Rationale R-2`(폐기)의 "PATCH `hmacSecret` 입력 vs rotate 분리" 구조나 `R-14`(대체안 — `authConfigId` 단일 경로)는 이번 diff가 재도입하거나 우회하는 대상이 아니다 — 이번 diff는 chat-channel `details[].code` 배선과 `botToken` 빈 문자열 검증에 한정된다.

## 요약

이번 diff(11개 파일)는 `spec/5-system/2-api-convention.md §5.3`에 이미 기록된 "details 항목이 field를 실으면 code도 싣는다"(2026-09-11 규약화, `origin/main`에 이미 병합)라는 합의된 규칙을 코드 15개 발행 지점에 배선하는 후속 구현이며, `spec/2-navigation/2-trigger-list.md`의 R-12(provider 불변성)·R-CC-10(rotate 단일 경로) 등 관련 Rationale과 상충하지 않는다. 과거에 기각된 대안(R-2의 PATCH-기반 rotate 분리 설계, §5.3의 "410 기본값 미설정" 등)을 재도입하는 지점도 발견되지 않았다. 유일한 특이사항은 `common/`과 `nodes/`(modules/**) 사이의 `ErrorCode` canonical 상수 사용 비대칭인데, 코드 주석으로 근거가 설명돼 있어 즉각적 문제는 아니고 향후 spec 갱신 시 한 줄 보강을 제안하는 INFO 수준이다.

## 위험도
LOW
