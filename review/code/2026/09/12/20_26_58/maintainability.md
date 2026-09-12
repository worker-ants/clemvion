# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `CHAT_CHANNEL_CODES` 배열명이 실제 원소와 어긋난다 (pre-existing, 이번 diff 범위 밖)
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — `CHAT_CHANNEL_CODES` 상수 선언부 (파일 내 `const CHAT_CHANNEL_CODES = [...]` 블록, 이번 diff 의 게이트 범위 밖이라 줄 번호 대신 식별자로 기재)
  - 상세: 이번 PR 은 바로 위쪽 `LOCALIZED_ERROR_CODES` 블록의 주석을 고쳐 `TRIGGER_NOT_FOUND` 가 chat-channel API 코드가 **아니라** hooks webhook 인입 경로 코드임을 명확히 했다(`ERROR_KO` 주석도 같은 취지로 정정). 그런데 그 정정이 근거로 삼은 `CHAT_CHANNEL_CODES` 배열 자체는 이름이 "chat channel 코드"이면서 `TRIGGER_NOT_FOUND` 를 여전히 원소로 포함한다(주석으로 예외 처리를 밝혀 두긴 했으나 배열명은 그대로). `git log -S`로 확인한 결과 이 배열과 캐주얼 주석은 이번 PR 이전(#568)부터 있던 것이라 이번 diff 가 만든 결함은 아니지만, 이번 PR 이 "같은 파일 안에서 서로 반증하던 주석 두 개"를 정정한 취지를 감안하면 이름-내용 불일치도 같은 클래스의 잔여 부채다. 다음에 이 배열을 "chat-channel 전용 코드 목록"이라는 이름만 보고 재사용하면 다시 같은 혼선이 재발할 수 있다.
  - 제안: 별도 후속으로 `CHAT_CHANNEL_CODES` 를 `CHAT_CHANNEL_AND_INBOUND_HOOK_CODES` 등으로 개명하거나 `TRIGGER_NOT_FOUND` 를 별도 상수로 분리해 이름이 내용을 정확히 반영하게 한다. (이번 PR 스코프는 아님 — plan 트래커에 있다면 별항으로 남겨도 무방.)

- **[INFO]** `UuidParamViolation.missing` 의 유니온 타입이 식별자와 표시 문구를 겸한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` — `UuidParamViolation` 인터페이스의 `missing` 필드 (`readonly ('ParseUUIDPipe' | "@ApiParam format:'uuid'")[]`)
  - 상세: 두 번째 유니온 멤버 `"@ApiParam format:'uuid'"` 는 타입 리터럴이면서 동시에 실패 메시지에 그대로 노출되는 사람이 읽는 문구다. 식별자와 표시 문구가 한 문자열로 묶여 있어, 나중에 메시지 문구를 다듬고 싶어지면(예: 오타 수정, 표현 변경) 타입 시그니처 자체를 바꿔야 하고 이를 비교하는 모든 자리(`param-uuid-pipe.spec.ts` 의 `key()`, `missing.join(...)` 등)를 함께 살펴야 한다. 지금은 소비처가 한 스펙 파일로 국한돼 있어 실질 위험은 낮다.
  - 제안: 급하지 않음. 소비처가 늘어나면 식별자(`'API_PARAM_FORMAT_UUID'` 등)와 표시 문구를 분리하는 것을 고려.

- **[INFO]** `scanUuidParams` 내부 `visit` 클로저의 중첩 깊이
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:139-174` (`scanUuidParams` 함수 내부 `const visit = (node) => { ... }`)
  - 상세: `if (isMethodDeclaration) → for (parameters) → for (decorators) → if/if/if` 로 4단 중첩이다. AST 워커의 전형적인 형태라 저장소의 자매 가드들과 스타일은 일치하고, 판정 로직도 이미 `isIdShaped`/`decoratorCallName`/`apiParamUuidFlags`/`isExcludedFromOpenApi` 로 상당 부분 함수로 분리돼 있어 심각한 문제는 아니다. 다만 파라미터·데코레이터 이중 루프 안의 판정 블록(누락 축 계산)만 별도 함수로 한 번 더 뽑으면 `visit` 자체의 가독성과 단위 테스트 용이성이 조금 더 좋아진다.
  - 제안: 필요 시 `checkParamDecorator(param, decorators, declared, excluded, sf)` 형태로 추출. 블로킹 아님.

- **[INFO]** `ParseUUIDPipe` 존재 판정이 텍스트 부분일치이며, 이는 이미 문서화된 트레이드오프
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` — `scanUuidParams` 함수 JSDoc (파일 헤더 부근, "**`ParseUUIDPipe` 존재는 텍스트 부분일치로 본다**" 단락) 및 `if (!pipes.includes('ParseUUIDPipe')) missing.push('ParseUUIDPipe');`
  - 상세: 별칭 import(`ParseUUIDPipe as UuidPipe`)가 생기면 오탐(가짜 위반), 이름에 그 문자열을 포함한 다른 심볼이 있으면 미탐(가짜 통과)이 발생할 수 있음을 저자가 이미 명시했고 실측(별칭 0건)으로 현재는 안전하다고 밝혔다. 결함은 아니지만, 이 가드가 "베이스라인 0 을 강제하는 회귀 방지막" 이라는 점을 고려하면 향후 누군가 별칭 import 를 도입해도 조용히 통과할 수 있는 사각지대로 남는다 — 이미 알려진 리스크이므로 새 지적이라기보다 유지보수 시 유의할 점으로만 남긴다.
  - 제안: 조치 불요. 별칭 import 가 실제로 생기면 그때 심볼 해석 기반으로 강화.

## 요약

`triggers.controller.ts` 의 `rotateBotToken` UUID 파이프 누락(500 마스킹 → 400)을 고치면서, 같은 결함 클래스의 재발을 막는 AST 기반 정적 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture)를 저장소 기존 `repo-guards/__tests__/` 명명 규칙(`<name>-guard.ts` + `<name>.spec.ts` + `fixtures/<name>/`)과 공용 유틸(`collectTsFiles`/`toPosixRelative`)을 그대로 재사용해 일관되게 추가했다. 판정 로직은 `isIdShaped`/`decoratorCallName`/`apiParamUuidFlags`/`isExcludedFromOpenApi` 등 작은 단일 책임 함수로 잘 분리돼 있고, vacuity floor(스캔 대상 0건 방지)·대조군 fixture(양성/음성/면제·반대방향 캐너리·디코이 텍스트)까지 갖춰 테스트 자체의 신뢰도도 높다. 각 결정에 실측 수치와 근거를 남기는 문서화 스타일도 저장소 전반의 관례와 일치한다. 발견된 항목은 모두 INFO 수준으로, 하나(배열명-내용 불일치)는 이번 diff 이전부터 있던 부채이고 나머지는 이미 저자가 트레이드오프로 인지·문서화한 사항이거나 사소한 리팩터링 여지다. 문서(MDX)·CHANGELOG·plan 트래커 갱신도 코드 변경과 정합적으로 동반 갱신되어 있다.

## 위험도
LOW
