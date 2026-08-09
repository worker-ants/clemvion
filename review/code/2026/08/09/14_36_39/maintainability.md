# 유지보수성(Maintainability) 리뷰

## 검토 범위

`codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(신설) 및 spec, `app.module.ts`,
`main.ts`, `common/utils/uuid.ts`/spec, `common/utils/workspace-context.util.ts`/spec,
`common/decorators/workspace.decorator.spec.ts`, `common/guards/roles.guard.spec.ts` 를 실제 소스 라인
번호 기준으로 전문 대조했다. `CHANGELOG.md`, `plan/**`, `review/consistency/2026/08/09/14_01_15/**`
(SUMMARY·checker 리포트·`_retry_state.json`·`meta.json`)는 산문/plan 문서·자동 산출 리뷰 아티팩트이며
실행 코드가 아니므로 함수 길이·중첩·복잡도 관점 심사 대상에서 제외했다(내용상 이상 없음).

## 발견사항

- **[WARNING]** 같은 PR 안에서 "이중 호출 assert" 패턴을 스스로 기각해 놓고 다른 파일에서 다시 사용
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.spec.ts:109-120` (it.each 블록)
  - 상세: `workspace.decorator.spec.ts:43-61` 은 `expectWorkspaceIdRequired` 헬퍼를 도입하며 "이중 호출
    패턴은 (실패 시) 두 단언을 모두 보장하지 못하니 error 를 캡처해 재던지는 방식을 쓴다"고 명시적으로
    문서화했다. 그런데 같은 PR 이 신설한 `workspace-context.util.spec.ts` 의 "형식이 깨진
    X-Workspace-Id 헤더" `it.each` 블록은 정확히 그 기각된 이중 호출 패턴 그대로다 —
    `resolveRequestWorkspaceContext({ 'x-workspace-id': raw }, TOKEN_WS)` 를 `toThrow` 단언용으로 한 번,
    `getResponse()` 코드 확인용으로 또 한 번, 동일 인자로 두 번 호출한다. 함수 자체는 순수 함수라
    실질적 오탐 위험은 낮지만, 같은 세션이 한쪽 파일에서 근거까지 남기며 회피한 패턴을 다른 파일에서
    무근거로 재도입해 "이 저장소의 표준은 무엇인가"를 다음 리더가 혼동하게 만든다.
  - 제안: `workspace.decorator.spec.ts` 의 캡처-재던지기 패턴(또는 동등한 `expect(() => {...}).toThrow()`
    + 캡처)으로 통일하거나, 두 파일 중 하나의 접근을 명시적으로 표준으로 선언하고 나머지를 맞춘다.

- **[INFO]** 워크스페이스 UUID 픽스처 상수가 3개 spec 파일에 거의 동일한 값으로 중복 선언됨
  - 위치: `workspace.decorator.spec.ts:28-30`(`HEADER_WS`/`TOKEN_WS`/`DECOY_WS`),
    `common/guards/roles.guard.spec.ts:13-18`(`WS1`/`OWN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`),
    `common/utils/workspace-context.util.spec.ts:12-14`(`HEADER_WS`/`TOKEN_WS`/`OTHER_WS`)
  - 상세: 세 파일 모두 `'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'`·`'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb'`
    등 동일 리터럴을 파일마다 다른 이름(`HEADER_WS` vs `WS1`, `OTHER_WS` vs `VICTIM_WS`)으로 반복
    정의한다. 각 파일이 자기 완결적으로 읽히는 장점은 있으나, 세 파일이 사실상 같은 결함(헤더 스푸핑)을
    다른 계층에서 검증하는 자매 스위트라는 점을 감안하면 공용 test-fixture 모듈로 추출할 여지가 있다.
    지금 상태로도 이해에 지장은 없어 우선순위는 낮다.
  - 제안: 필요 시 `common/utils/__fixtures__/workspace-ids.ts` 같은 공용 상수 모듈로 승격 검토(강제 아님).

- **[INFO]** `roles.guard.spec.ts` 픽스처 상수 네이밍이 자기 파일 안에서 일관되지 않음
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:13-18`
  - 상세: `OWN_WS`·`VICTIM_WS`·`OTHER_WS`·`DECOY_WS`·`SAME_WS` 는 전부 `_WS` 접미사로 역할을 드러내는데,
    `WS1` 만 숫자 접미사라 패턴이 깨진다(`WS1` 은 "역할 없는 범용 워크스페이스"라는 의미인 듯하나 이름만
    으로는 드러나지 않는다).
  - 제안: `WS1` → 예컨대 `GENERIC_WS` 등 나머지와 같은 명명 규칙으로 통일.

- **[INFO]** 부팅 실패 메시지가 `+` 문자열 연결로 조립됨
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:47-53`
    (`WorkspaceIdReflectionBrokenError` 생성자)
  - 상세: 6줄에 걸친 `'...' + '...' + ...` 연결이다. 내용 자체는 정확하고 원인 후보·영향까지 잘
    담았지만, 템플릿 리터럴(백틱 + 줄바꿈)을 썼다면 각 줄 끝의 공백 관리·`+` 누락 같은 흔한 실수 여지가
    줄고 가독성도 약간 개선된다.
  - 제안: 템플릿 리터럴로 교체(기능 변화 없음, 순수 스타일).

## 요약

이번 변경은 신설 모듈(`workspace-reflection-canary.ts`)에 목적("왜 필요한가"·"무엇을 단언하나"·
"왜 이 방식을 안 썼나")을 밀도 있게 문서화했고, 함수 단위(`countWorkspaceIdConsumingRoutes`,
`assertWorkspaceIdReflectionWorks`)는 짧고 책임이 분명하며 중첩도 2단계를 넘지 않는다. `isUuidShaped`
신설과 `resolveRequestWorkspaceContext` 의 검증 추가도 네이밍이 목적을 정확히 드러내고 매직 넘버 없이
근거가 주석으로 남아 있다. 세 spec 파일에 걸친 UUID 픽스처 치환(임의 문자열 → 실제 형태 UUID)도 명명
의미를 그대로 보존하며 정리됐다. 발견된 항목은 전부 WARNING 이하로, 그중 가장 눈에 띄는 것은 같은 PR
안에서 스스로 문서화해 기각한 "이중 호출 assert" 패턴을 다른 파일에서 무근거로 재사용한 일관성 결여이며,
나머지는 네이밍·스타일 수준의 INFO 다. 구조적 결함이나 과도한 복잡도·중복은 발견되지 않았다.

## 위험도

LOW
