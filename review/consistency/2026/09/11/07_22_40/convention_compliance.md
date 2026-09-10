# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-drift-3.md`

## 검토 방법

`spec/conventions/2-api-convention.md`(경로상 `spec/5-system/2-api-convention.md`) §5.3·§5.4,
`spec/conventions/error-codes.md`, `spec/conventions/secret-store.md` §2.1·§2.2·§5.1,
`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` 을 직접 열어
target 이 인용하는 조항 원문과 대조했다. 또한 target 이 근거로 삼는 실측 주장(줄 번호·코드 동작)을
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`dto/chat-channel-config.dto.ts`, `dto/trigger-dto-validation.spec.ts`,
`common/pipes/validation.pipe.ts` 원본과 대조해 각 인용의 정확성을 확인했다.

## 발견사항

없음 — CRITICAL·WARNING 위반을 발견하지 못했다.

### 확인한 준수 사항 (참고용, 조치 불요)

- **D-2 (신규 코드 미신설)** 는 `2-api-convention.md §5.3` "도메인 세부 사유를 어디에 싣는가" 표의
  판정 기준과 일치한다 — `chatChannel`/`provider` 두 신규 400 분기는 `VALIDATION_ERROR` 기본값 +
  `details.field` 만 쓰고 `details[].code` 를 신설하지 않으므로, 기존 `botTokenRef`/
  `inboundSigningPlaintext` 분기(§5.4.1, 중앙 카탈로그 `3-error-handling.md §1` 미등재)와 **동일한
  선례 패턴**을 따른다. `TRIGGER_ENDPOINT_PATH_CONFLICT`(§1.10, `details.code` 를 가진 케이스만
  중앙 카탈로그에 "공용 가시성" 등재)와 대조하면 이 구분(코드 유무에 따라 등재 위치가 갈림)이
  기존 관행임이 확인된다 — target 의 D-2 는 이 관행을 정확히 재적용한다.
- **D-1 (두 갈래 형태를 모두 SoT 로 인정)** 은 `§5.4` 말미 "형태 선택은 발행 지점의 책임이며, 그
  엔드포인트를 문서화하는 절에 어느 형태인지 적는다" 는 문장을 텍스트 그대로 실행한 것이다 — 배열
  (파이프, `code:'INVALID_FIELD'` 포함) vs 객체(서비스 가드, `code` 없음) 두 형태 모두 §5.3 이
  "둘 다 유효" 하다고 명시한 형태이며, target 은 이를 강제로 단일화하지 않는 쪽을 정확히 골랐다.
- **인용 정확도**: `2-api-convention.md:205`, `validation.pipe.ts:58`,
  `providers/slack.md:275`, `providers/discord.md:297`, `secret-store.md:301`,
  `triggers.service.ts:655,662,670,702,710`(서비스 가드 `code` 부재) 등 target 이 제시한 파일:줄
  인용을 전수 대조했고 전부 원문과 정확히 일치했다. `store()` 10곳 열거(`15-chat-channel.md`
  200·201·373·390, `chat-channel-adapter.md` 354·359, `providers/telegram.md` 58·219,
  `providers/slack.md` 278, `secret-store.md` 301)도 `spec/` 전수 grep 으로 재현해 정확함을 확인했다
  (괄호 없는 산문체 인용 `SecretResolver.store 로`·`` `SecretResolver.store` `` 도 포함해 세어야
  10 이 나온다 — target 의 셈이 이 방식을 정확히 반영한다).
- **`normalizeNotificationSecretRef` 재측정**: target 이 이번 턴에 새로 측정했다고 주장하는
  "notification 축도 실제로는 `rotate()`" 주장을 `triggers.service.ts:945` 구현으로 직접 확인했다 —
  `this.secrets.rotate(ref, trigger.workspaceId, plaintext)` 이 맞고, `secret-store.md:301` 예시
  코드(`store()`)만 낡아 있었다. `secret-store.md §2.1` 자신의 "`rotate()` 권장" 문구와도 정합된다.
  주장한 코드 위치·결론 모두 정확하다.
- **역참조 근거(`R-CC-21`, `R-12`)** 존재를 확인했다 — `15-chat-channel.md:735`(R-CC-21),
  `2-trigger-list.md:333`(R-12, "변경하려면 트리거 삭제·재생성" 문구 정확 인용).
- **frontmatter**: `worktree`/`started`/`owner` 필수 필드(`plan-frontmatter.test.ts` 대상 — top-level
  `plan/in-progress/*.md`) 모두 존재. `spec_impact` 는 6개 경로의 YAML 리스트이고(Gate C 형식,
  bare string 아님) 6개 전부 실존 파일임을 확인했다. `review-citations.md §3` 은 `plan/**` 문서를
  인용 규약 적용 대상에서 명시적으로 제외하므로, 본문의 bare `hh_mm_ss` 형태 인용(`07_11_12` 등)도
  위반이 아니다.
- **후속 위임 경계**: 서비스 가드의 `details[].code` 부재는 코드 변경이 필요한 사안이라 이 턴에서
  고치지 않고 "후속 신규 등재" 로 분리했다 — `developer`/`project-planner` 쓰기 권한 경계
  (spec 은 planner, `codebase/` 는 developer) 를 지킨 판단이다.

## 요약

target 은 `2-api-convention.md §5.3/§5.4`, `error-codes.md`, `secret-store.md §2.1` 이 실제로
규정하는 내용을 정확히 인용하고, 제시한 파일:줄·카운트(10곳 `store()`, 5필드 `details.field`,
tracker 라인 `:2034`/`:2073`/`:2137`/`:2160` 등)를 코드·기존 spec 원문 대조로 전수 재현했으며 전부
일치했다. 신규 400 두 분기에 새 top-level 코드를 만들지 않고 기존 `VALIDATION_ERROR` +
`details.field` 를 재사용해 중앙 카탈로그(`3-error-handling.md §1`) 미등재로 남기는 결정은 이미
존재하는 `botTokenRef` 케이스의 선례와 정확히 같은 패턴이라 규약 위반이 아니다. `details.field`
형태를 파이프/서비스 두 갈래로 나눠 SoT 로 인정하는 D-1 도 §5.4 "형태 선택은 발행 지점의 책임"
문장을 그대로 따른다. 코드 층의 기존 결함(서비스 가드의 `code` 부재)은 스코프를 정확히 갈라
developer 후속으로 넘겼다. 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL·WARNING 위반을
발견하지 못했다.

## 위험도
NONE
