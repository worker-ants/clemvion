# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-setup-error-classification.md`

## 검토 범위 및 방법

`spec/conventions/**` 중 프롬프트에 포함되지 않은 파일은 관련성이 의심되는 것 위주로 직접
`Read` 해 확인했다 (`chat-channel-adapter.md`, `error-codes.md`, `review-citations.md`,
`swagger.md`). 아울러 target 이 SoT 로 인용하는 `spec/5-system/2-api-convention.md`,
`spec/5-system/4-execution-engine.md §7.5.2`, `spec/5-system/15-chat-channel.md §5.4/§4.1`
의 실제 본문과 `codebase/backend/src/modules/{triggers,chat-channel}/**` 의 실제 코드를
대조해 target 이 인용하는 verbatim 발췌·수치(R-CC 최대 22·R-CCA 최대 8 등)가 사실과
일치하는지 실측했다.

## 발견사항

- **[WARNING] 502 최초 도입인데 API 문서 규약(swagger.md §2-4)이 다루지 않는 상태 코드다**
  - target 위치: `## 결정 (4) 2-api-convention.md §6 에 502 행 신설` 및 `## 구현 위임` 1번
    항목 (`translateSetupChannelError` 를 `BadGatewayException` 으로 정정)
  - 위반 규약: `spec/conventions/swagger.md §2-4 "상태 코드 응답 규칙"` — 표는
    200/201/204/400/401/403/404/409 만 다루고 5xx/502 데코레이터를 다루지 않는다
  - 상세: 저장소 전체(`codebase/backend/src` grep)에서 `BadGatewayException`·
    `@ApiBadGatewayResponse` 사용례가 **0건**이었다 — 이 draft 가 실현되면 프로젝트
    전체에서 **최초로 502 를 실제 발행**하는 사례가 된다. `@ApiBadGatewayResponse` 데코레이터
    자체는 `@nestjs/swagger` 에 존재하지만(`api-response.decorator.d.ts` 확인)
    `spec/conventions/swagger.md §2-4` 의 "상황 → 데코레이터" 표에는 502(또는 5xx 일반)
    행이 없다. `## 결정 (4)` 는 `2-api-convention.md §6` (상태 코드 의미 카탈로그) 갱신만
    다루고, API 문서 도구 규약(swagger.md)과의 정합은 다루지 않는다. `## 구현 위임` 1~6
    항목에도 "rotate-bot-token 컨트롤러에 `@ApiBadGatewayResponse` 추가" 또는 "swagger.md
    §2-4 표에 502 행 신설 검토" 가 없어, 구현자가 `2-api-convention.md` 만 보고 실제
    OpenAPI 문서화를 누락할 위험이 있다.
  - 제안: `## 구현 위임` 1번 항목에 컨트롤러 데코레이터 갱신(`@ApiBadGatewayResponse` 부착)을
    명시하거나, planner 가 `swagger.md §2-4` 에 502 행을 신설할지(또는 "5xx 는 기존 표에
    없는 것은 커버 대상 아님" 을 명문화할지)를 이 draft 또는 후속 트래커 항목으로 결정해
    둔다. 규약 자체를 갱신하는 편이 맞다면 그 점도 이 draft 의 결정 목록에 명시한다.

- **[INFO] §6 신설 행이 실제 markdown 표 문법이 아니다 (초안 표기)**
  - target 위치: `## 결정 (4)` 본문의 인용 블록
    `> 502 | Bad Gateway | 외부 provider API 호출이 실패 …`
  - 상세: `spec/5-system/2-api-convention.md §6` 의 실제 표는 `| 코드 | 의미 | 사용 상황 |`
    형태의 markdown 표 행인데, draft 는 이를 blockquote 안에 backtick 으로 감싼 문장으로
    적어 최종 반영 시 그대로 붙여넣으면 표가 깨진다. 실제 `spec/` 반영 시 표 행 문법으로
    옮겨야 한다는 점을 명시해 두면 좋다.
  - 제안: 사소한 표기이므로 이 draft 를 `spec/` 에 반영하는 커밋에서 정상 표 행으로
    변환하면 충분하다 — 규약 위반이라기보다 초안 메모의 표기 관례 문제.

- **[INFO] `3-error-handling.md §1` 중앙 카탈로그 미등재는 새로 만든 갭이 아니라 기존 갭이며,
  적절히 범위 밖으로 명시돼 있다**
  - target 위치: `## 안 하는 것` 세 번째 불릿
  - 상세: `2-api-convention.md §5.3` 은 "어느 쪽을 택하든 [에러 처리 §1 카탈로그]에
    등재한다" 는 사실상 MUST 조항이다. `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`
    는 이미 존재·발행 중인 코드라 이 draft 가 신설하는 것은 아니지만, 엄밀히는 그 카탈로그
    미등재 상태가 이 draft 반영 후에도 남는다. 다만 draft 는 이를 인지하고 "기존 갭",
    "이 턴의 동기가 아님", "트래커에 남긴다" 로 명시적으로 스코프 아웃했고 이전 `--spec`
    라운드의 INFO 1 을 인용해 근거를 댔다 — 새로 발생한 미준수가 아니라 **이미 알려진,
    추적되는 갭의 재확인**이므로 이 라운드에서 추가 조치를 요구하지 않는다.

## 정합성 확인 (문제 없음으로 판정한 항목)

다음은 위반처럼 보일 수 있으나 실측 결과 규약을 따르고 있어 발견사항에서 제외했다:

- **Rationale ID 번호**: `R-CC-23`·`R-CCA-9` 는 각 파일의 실제 최댓값(`R-CC-22`, `R-CCA-8`,
  `grep` 실측)의 다음 번호로 정확하다. `R-CC-14` 결번 주장도 실측과 일치한다.
- **`## Rationale` 뒤에 `## 편집 대상 원문`·`## 체크리스트` 가 오는 구조**: CLAUDE.md/
  `project-planner/SKILL.md` 의 "Overview/본문/Rationale" 3섹션 권장과 얼핏 어긋나 보이나,
  `plan/complete/*.md` 전수 조사 결과 `## Rationale` 뒤에 `## 체크리스트`·부록 섹션을 두는
  패턴이 수십 건의 완료 plan 에서 이미 표준적으로 쓰이며, 같은 chat-channel 도메인의
  `plan/complete/spec-draft-chat-channel-binder-drift.md` 도 `## 편집 대상 원문` +
  `## 체크리스트` 를 Rationale 뒤에 두는 동일 구조다. 위반이 아니라 이 저장소의 확립된
  관례.
- **`spec_impact` frontmatter**: 5개 항목 모두 실재 spec 경로이며(`ls` 실측), 배열 형태로
  올바르게 선언했다. 리스트 중간의 `#` YAML 주석은 `plan-scan.ts`(`gray-matter` 기반, 정식
  YAML 파서)로 파싱되므로 과거 harness 의 손-작성 block-list 파서가 겪었던 "주석이 파싱을
  끊는" 결함 클래스의 대상이 아니다(별개 파서·별개 필드).
- **에러 코드 명명**: `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 는 `UPPER_SNAKE_CASE`
  + 도메인 prefix 를 따르며 `error-codes.md §1` 위반이 없다.
  `code` 프로퍼티 기반 판별자로 전환하는 설계는 `error-codes.md §1`("코드 의미로 분기,
  문자열 파싱 금지") 및 `4-execution-engine.md §7.5.2`·`chat-channel-adapter.md R-CCA-5`
  (둘 다 typed code 판별 원칙)와 일치한다.
- **502/503 의미 분리**: "502=외부 provider, 503=우리 인프라" 구분은 새로 발명한 원칙이
  아니라 `4-execution-engine.md` 의 기존 결정(`"Redis 의존성 장애 = upstream 불가용이므로
  502 가 아니라 503"`, 2026-06-14 Rationale)을 명문화하는 것이라 기존 선례와 정합한다.
- **`review-citations.md` 관점의 bare `hh_mm_ss` 인용**: target 은 `plan/**` 문서이고
  `review-citations.md §3` 이 `plan/**` 을 명시적으로 규약 대상에서 제외하므로
  (`/consistency-check --spec 1회차 (11_50_28)` 같은 bare 인용) 위반이 아니다.
- **cross-file 인용 포맷**: 체크리스트가 예고한 `[CCA §R-CCA-9]` 형식은
  `chat-channel-adapter.md` 자신의 "Rationale ID 컨벤션" 각주가 요구하는 정확한 형식이다.
- **verbatim 발췌 정확성**: §5.4 에러 표 두 행, §4.1 문구, R-CCA-5 화이트리스트 서술,
  slack-client.ts 주석 원문, chat-channel-input-rules.spec.ts 캐너리 테스트명 등 target 이
  인용한 모든 "편집 대상 원문" 조각을 실제 소스와 대조한 결과 전부 일치했다.

## 요약

target 문서는 이 저장소의 정식 규약(에러 코드 명명, HTTP 상태 코드 카탈로그, cross-file
Rationale ID 체계, plan frontmatter 스키마, 코드 주석 인용 규약)을 대체로 충실히 따르고
있으며, 인용한 verbatim 발췌·수치도 전수 실측 결과 사실과 일치했다. 가장 두드러진 갭은
API 문서 도구 규약(`swagger.md §2-4`) 쪽으로, 이 draft 가 프로젝트 최초로 502 상태 코드를
실사용으로 끌어들이는데도 그 문서화 데코레이터(`@ApiBadGatewayResponse`) 갱신이 결정·구현
위임 어디에도 명시돼 있지 않다는 점이다(WARNING 1건). 그 외에는 사소한 표기 문제(INFO)와
이미 알려진 채 의도적으로 스코프 아웃된 기존 갭(INFO) 뿐이다.

## 위험도

LOW
