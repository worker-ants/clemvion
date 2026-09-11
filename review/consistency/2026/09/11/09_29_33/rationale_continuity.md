# Rationale 연속성 검토 — spec-draft-chat-channel-conventions

## 검토 범위

target: `plan/in-progress/spec-draft-chat-channel-conventions.md` (CV-1~CV-4, 4개 결정)
비교 대상: 번들에 포함된 `2-trigger-list.md`·`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`·`15-chat-channel.md` 의 `## Rationale` **및** 번들에서 예산상 누락된
`spec/conventions/swagger.md`·`spec/conventions/chat-channel-adapter.md` 를 리포지토리에서
직접 읽어 대조했다 (`related_specs` 가 `conventions/` 를 자주 못 담는 기존 결함 — 이번엔 직접
보완).

## 발견사항

발견된 CRITICAL 또는 WARNING 없음. 아래는 확인 과정에서 교차검증한 근거와, 문서 완결성을
높일 수 있는 INFO 제안이다.

- **[INFO]** CV-2 신규 명명 규칙은 `swagger.md` 에 선례가 전혀 없는 축이라 "번복" 위험이 없다
  — 그러나 `§1-7` Rationale 절에 실제 반례(`ChatChannelUpdateConfigDto` 를 접두 대상에서
  제외한 근거)를 명시적으로 남겨 두는 편이 좋다.
  - target 위치: `## 결정 > CV-2`, `변경안` 표 2행
  - 상세: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:378` 의
    `ChatChannelUpdateConfigDto` 가 실제로 `<Domain><Role>Dto` 계열(형제:
    `ChatChannelUiMappingDto`·`ChatChannelBotIdentityDto`·`ChatChannelConfigDto`)임을 실측
    확인했다. target 의 "범위를 넘은 일반화" 진단(18/18 접두는 top-level 요청 바디 집합의
    성질)은 정확하다. 다만 이 반례는 미래에 "왜 Update 접두가 아니냐"는 재질문을 반드시
    받을 이름이므로, `§1-7` 본문 예시에 이 클래스명을 직접 인용해 두면 다음 편집자가 같은
    조사를 반복하지 않는다.
  - 제안: `swagger.md §1-7` 본문(또는 그 Rationale)에
    `ChatChannelUpdateConfigDto`(nested 변형, 접두 미적용)를 반례로 명시.

- **[INFO]** CV-3(멱등 각주)와 `15-chat-channel.md R-CC-21` 의 telegram caveat 박스가 같은
  사실("telegram 은 `setupChannel()` 재호출마다 새 값을 발급/재저장한다")을 두 문서에
  독립적으로 서술하게 된다.
  - target 위치: `## 결정 > CV-3`, `변경안` 표 4행 (`chat-channel-adapter.md §1.1`)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `R-CC-21` 본문 caveat
    (`⚠️ 이 항목의 「비밀」은 두 축 한정이다 (2026-09-10 정정)`) 및 §5.4.1 캐이오한
    "telegram — server-issued" 행.
  - 상세: 두 서술이 지금 당장 모순되지는 않는다(오히려 서로 강화). 다만 한쪽이 나중에
    업데이트되고 다른 쪽이 안 따라가면 drift 재발 소지가 있다 — 이 spec 세트 자체가 최근
    "PATCH 는 비밀을 쓰지 않는다" 축에서 이미 그런 drift(§5.4.1 필드명 층 vs 값 층)를
    한 번 겪었다.
  - 제안: `chat-channel-adapter.md §1.1` 각주에서 `15-chat-channel.md R-CC-21`(또는
    §5.4.1.1 telegram 행)을 cross-link 로 인용해 SoT 를 한쪽으로 좁혀 두면 향후 drift 를
    구조적으로 막는다. (target 의 변경안이 이미 각주 신설을 계획하므로, cross-link 한 줄만
    추가하면 되는 낮은 비용의 보강이다.)

## 확인 완료 — 잠재 충돌 후보였으나 실측 결과 문제 없음

- **CV-1 이 `2-api-convention.md §5.3` "둘을 겹쳐 쓰지 않는다" 원칙을 위반하는지**: 위반
  아님. CV-1 은 top-level 을 여전히 상태 기본값(`VALIDATION_ERROR`)으로 두고
  `details[].code` 만 일반 기본값(`INVALID_FIELD`)으로 채우므로, 이미 §5.3 예시 자체가 쓰는
  기존 패턴(top-level `VALIDATION_ERROR` + `details[].code: INVALID_FIELD`)의 연장이다.
  `field` 없는 6곳(진단 payload)을 범위 밖으로 명시 카브아웃한 것도 그 원칙을 정확히
  지킨 것이다.
- **CV-1 이 `15-chat-channel.md §5.4.1.2` "details[].code 는 두 항목 모두 서비스 가드
  갈래라 싣지 않는다"(오늘 `f947b49f4` 로 확정된 실측 서술)를 무근거로 뒤집는지**: 뒤집지
  않는다. CV-4 가 이 문장을 **삭제·교체하지 않고** "현재 관측값(실측) + 계약값(CV-1) 병기"
  로 명시 계획했고(`변경안` 5a/5b/5c, `기각한 대안` 표 5행), 이는 프로젝트 관례
  (`feedback_documented_guarantee_wider_than_built` 류)와도 정합한다.
- **CV-* 라벨이 `R-CC-21` 의 `D-1`/`D-2` 와 충돌하는지**: 충돌 없음. `codebase/backend/src`
  10곳 이상이 `[R-CC-21 / D-1]`·`R-CC-21 / D-2` 를 그대로 인용 중임을 실측 확인했고
  (`triggers.service.ts`·`update-trigger.dto.ts`·`chat-channel-config.dto.ts`·
  `*.spec.ts`), target 이 새 결정에 `CV-*` 를 쓰기로 한 것은 그 인용을 깨지 않기 위한 정당한
  네임스페이스 분리다.
- **CV-1 이 `2-trigger-list.md R-12`/§3 註 를 stale 하게 만드는지**: 만들지 않는다. 그
  문서의 네 자리(§3 두 註·R-12·frontmatter `code:` 주석)는 전부 주어가 `details.field` 축이지
  `details.code` 축이 아님을 실측 확인했다(`spec/` 전역 grep). `TRIGGER_ENDPOINT_PATH_CONFLICT`
  는 이미 `code` 를 싣는 선례라 CV-1 이후에도 그대로 참이다.
- **CV-3 이 `chat-channel-adapter.md §1.1` "yes — 같은 config 재호출 OK" 를 뒤집는지**:
  뒤집지 않는다. "재호출해도 등록이 깨지지 않는다"는 명제 자체는 유지되고, 각주는 "그 멱등이
  시크릿 값의 불변까지 보장하지는 않는다"는 **추가 정보**만 얹는다 — 이는 이미
  `15-chat-channel.md R-CC-21`·§5.4.1 telegram 행이 확립한 것과 같은 구분이라 새 결정이
  아니라 컨벤션 쪽 문서를 정합화하는 것이다.
- **CV-1 의 기본 코드 `INVALID_FIELD` 가 신규 카탈로그 등재를 요구한다는 target 의 주장**:
  사실이다. `3-error-handling.md §2.1`·`2-api-convention.md §5.3` 양쪽에 `INVALID_FIELD` 가
  이미 등재돼 있음을 실측 확인했다 — 신규 등재 불필요라는 target 의 판단은 정확하다.

## 요약

target 은 직전 `--spec`(`09_03_56`) 라운드가 지적한 CRITICAL 3건(라벨 충돌·감사 로그
오분류·§5.4.1.2 정면 충돌)을 전부 겨냥해 재작성됐고, 실제로 과거 Rationale 을 재확인한
결과 CV-1~CV-4 어느 것도 기각된 대안을 이유 없이 재도입하거나 합의된 원칙(§5.3 "겹쳐 쓰지
않는다", R-CC-10/R-CC-21 의 PATCH 비밀 미기록 invariant, chat-channel-adapter 인터페이스
최소주의)을 위반하지 않는다. `§5.4.1.2` 의 실측 문장을 삭제 대신 계약값과 병기하기로 한
결정은 이 프로젝트가 반복적으로 강조해 온 "실측 vs 계약" 인식론적 지위 구분을 정확히
지킨 사례다. 남은 것은 두 건의 저비용 INFO(교차링크 보강)뿐이다.

## 위험도

LOW
