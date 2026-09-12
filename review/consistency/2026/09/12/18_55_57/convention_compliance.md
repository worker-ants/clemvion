# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-doc-batch.md`

## 검토 범위와 방법

target 은 `spec/` 에 아직 반영되지 않은 **spec draft**(`--spec` 모드)다. 9개 변경안이 건드리는
정식 규약·spec 문서(`swagger.md`, `error-codes.md`, `chat-channel-adapter.md`,
`2-api-convention.md`, `3-error-handling.md`, `15-chat-channel.md`, `slack.md`)를 전문 직접
`Read` 하고, draft 가 인용하는 실측 대상(코드 파일·`review_guard._glob_to_regex` 구현·
`dto-class-name-collision.spec.ts`·`triggers.service.ts`·`chat-channel-input-rules.ts`·
`15-chat-channel.md §5.4` 에러 표)을 직접 열어 대조했다. 컨텍스트 예산으로 생략된 274개
convention 파일 중 target 이 실제로 인용·개정하는 5개(swagger·error-codes·
chat-channel-adapter·그리고 target 자체가 SoT 로 참조하는 review-citations)는 별도로 열람했다.

## 발견사항

이번 배치에서 정식 규약(`spec/conventions/**`)을 위반하는 CRITICAL/WARNING 급 항목은
**발견되지 않았다.** 9개 변경안을 각각 대조한 결과는 아래와 같다.

- **[INFO] `INVALID_BOT_TOKEN` / `BOT_TOKEN_INVALID` 근접 명명**
  - target 위치: §7 (`3-error-handling.md §1.12` 신설안)
  - 위반 규약: 없음 (참고: `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙)
  - 상세: 어순만 다른 두 코드가 각각 "입력 형식 오류(컨트롤러 검증)"와 "provider 자격 증명
    거부"를 가리킨다. `error-codes.md §1` 은 "이름만으로 분기 의미가 드러난다"를 원칙으로
    하는데, 이 두 이름은 붙여 놓고 봐야 구분된다. 다만 **이 코드들은 이미
    `triggers.controller.ts`/`triggers.service.ts`/`chat-channel-input-rules.ts` 에 구현·배포돼
    있고**(`INVALID_BOT_TOKEN` — `triggers.controller.ts:296`, `BOT_TOKEN_INVALID` —
    `chat-channel-input-rules.ts:311`), 이번 planner 턴은 신규 명명이 아니라 이미 wire 에 나간
    코드를 카탈로그에 **등재**하는 문서 캐치업이다. `error-codes.md §2` 의 rename 금지 정책상
    이 시점에 개명은 선택지가 아니며, draft 는 이미 "이름이 두 갈래다 … 혼동 주의" 콜아웃으로
    이 위험을 명시하고 있다.
  - 제안: 규약 위반은 아니므로 target 수정 불요. 다음에 이 두 코드 중 하나를 실제로 만질
    기회가 오면(§2 예외 없이는 개명 불가하므로 사실상 요원하지만) `error-codes.md §3` historical
    registry 에 "이름이 부정확/혼동 유발" 사례로 등재하는 것을 고려할 수 있다는 점만 남겨 둔다.

- **[INFO] fixture glob 관용구 불일치**
  - target 위치: §3 변경안 (b), `swagger.md` frontmatter `code:` 추가분
  - 위반 규약: 없음 (참고: `spec/conventions/swagger.md` frontmatter 의 기존 fixture 항목 스타일)
  - 상세: `swagger.md` 의 기존 대조군 fixture 항목은 파일명 접두 관용구를 쓴다
    (`fixtures/user-eager-relation*.ts`, `fixtures/user-relation-load*.ts`). draft 가 추가하는
    항목은 `fixtures/dto-class-collision/*.ts` — 디렉터리+와일드카드 형태다. 실제
    fixture 배치(`fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts`)와 `_glob_to_regex`
    의미론(단일 `*` 는 `/` 를 안 넘음)을 대조한 결과 **매칭은 정확하다** — 세 파일 모두 잡히고
    과잉 포획도 없다. 순수 표기 관용구 차이일 뿐 기능적 결함은 아니다.
  - 제안: 무수정으로 충분. 통일하고 싶다면 `fixtures/dto-class-collision*.ts` 대신
    `fixtures/dto-class-collision/*` 형태를 유지해도 무방 — 두 형태 다 정본 매처를 통과한다.

## 교차검증 상세 (문제 없음으로 확인된 항목)

- **§1 glob 확장(`dto/**/chat-channel-*.dto.ts`)**: `review_guard._glob_to_regex` 소스를 직접
  읽어 `*` 는 세그먼트 내부(`[^/]*`), `**/` 는 `(?:.*/)?` 로 컴파일됨을 확인. draft 의 매칭표
  (MISS→MATCH, 비대상 MISS 유지)가 실제 컴파일 결과와 일치한다. 게다가
  `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 파일 자체의 `//` 주석이 이미
  "glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓히는 planner 항목이 트래커에 있다"고 명시해
  독립적으로 이 변경안을 뒷받침한다.
- **§3 (a) DTO 클래스명 유일성 가드 문서화**: `dto-class-name-collision-guard.ts` /
  `.spec.ts` 를 열어 "modules/·common/ 의 `*.dto.ts` 를 AST 로 훑어 중복 0 을 고정"한다는
  draft 서술이 실제 스캔 범위(`SCAN_ROOTS = ['modules', 'common']`)·판정 방식(AST, 정규식
  아님)과 정확히 일치함을 확인. `ChatChannelBotIdentityDto`(입력, 전 필드 optional) vs
  `ChatChannelRotateBotIdentityDto`(응답, `botId`/`username` 필수 + `teamId`) 선례도 실제 DTO
  선언과 일치.
- **§3 (b) frontmatter 등재**: 기존 `swagger-dto-contract*.ts` 항목이 `-guard.ts`와 `.spec.ts`
  둘 다 매칭하는 것과 동일한 관용구로 `dto-class-name-collision*.ts` 를 추가 — 저장소의 기존
  glob 관행과 일치.
- **§4 네 번째 `code` 의미 추가**: `chat-channel-adapter.md §1.1.2` 의 기존 3행 표에 새 행을
  더하는 형태이며 열 구조(무엇/소유/값 도메인)를 그대로 따른다. Node/undici 시스템 에러가
  `.code` 를 갖는다는 사실관계도 통상적으로 맞다.
- **§5 slack 5값 확정**: `slack.md §3.1` 현재 본문(4값 + `...`)을 확인했고, 코드 상수
  SoT 화·CCA §1.1.2 cross-link 이 `chat-channel-adapter.md` 의 기존 인용 패턴과 일치한다.
- **§6 rate-limit 표 신설**: `2-api-convention.md §7` 표의 기존 행 포맷(범위/제한/헤더, SoT
  cross-link, 도메인 전용 rate-limiter 서술)과 정확히 같은 스타일이며, `15-chat-channel.md §3.6
  CCH-NF-03` 이 이미 실측·구현된 요구사항인데 §7 표에 행이 없는 gap 을 확인했다 — 표가 스스로
  선언한 "throttle 수치의 단일 진실" 의무에 대한 정당한 보완이다. `202` 예외 표기는
  `2-api-convention.md §6` 의 `410` 행이 이미 쓰고 있는 "예외 — chat-channel 은 … 이 아니라
  … 다" 서술 패턴과 동형이라 규약 스타일과 어긋나지 않는다.
- **§7 에러 코드 카탈로그 신설**: 제안된 6행(`INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED`·
  `CHAT_CHANNEL_PROVIDER_UNKNOWN`·`CHAT_CHANNEL_ENDPOINT_REQUIRED`·`BOT_TOKEN_INVALID`·
  `CHAT_CHANNEL_SETUP_FAILED`)의 코드·HTTP status·설명을 `15-chat-channel.md §5.4` 의 기존
  에러 표와 1:1 대조한 결과 완전히 일치한다. `3-error-handling.md §1.10/§1.11` 의 기존 섹션
  포맷(표 헤더 `코드 | status | 설명 | 도메인 SoT`, `UPPER_SNAKE_CASE 규약([conventions/error-
  codes.md])` 인용구, "공용 카탈로그 가시성 등재" 문구)을 그대로 재사용해 §1.12 로 신설하는
  형태도 선행 섹션과 정확히 동형이다. `3-error-handling.md` 전체에 이 6개 코드의 기존 등재가
  없음을 grep 으로 확인해 중복 등재 위험도 없다.
- **§8 절 번호 중복 기각**: 앵커 슬러그가 제목 텍스트 기반이라 `#### 3.1~3.6`과 `### 3.1~3.3`이
  실제로 충돌하지 않는다는 전제를 확인했고, 처방 대신 인용 규칙만 못박는 결정은 `#970`
  선례(무한 표면으로 확장하지 않는다)와 일치하는 방향이다. `spec/conventions/review-citations.md`
  는 리뷰 세션 인용 형식(날짜 포함 여부)을 규율하는 별개 규약이라 이 절 번호 인용 이슈와는
  적용 대상이 다르며, target 이 review-citations.md 를 위반하지도 않는다.
- **§9 완료 주석**: `15-chat-channel.md` 의 대상 문장("몰랐다 … 구현 정정은 developer
  후속이다.")이 실제로 그 자리에 남아 있고, `R-CC-23` 앵커도 실재함을 확인.
- **spec_impact 정합성**: frontmatter `spec_impact` 6개 경로가 §1~9 각 변경안이 실제로 건드리는
  6개 spec 파일과 1:1 대응(15-chat-channel.md, swagger.md, chat-channel-adapter.md, slack.md,
  2-api-convention.md, 3-error-handling.md) — `spec_impact` 는 실재 spec 경로 리스트여야 한다는
  Gate C 요건을 충족한다.

## 요약

target 은 이미 구현·배포된 코드(#1324/#1326)를 뒤늦게 문서화하는 배치이고, 9개 변경안 전부가
`review_guard._glob_to_regex` 구현·실제 DTO/가드 파일·`15-chat-channel.md §5.4` 도메인 에러
표·`2-api-convention.md`/`3-error-handling.md` 의 기존 섹션 포맷을 직접 대조해도 어긋나지
않았다. 명명·출력 포맷·문서 구조·API 문서 데코레이터 패턴·금지 항목 다섯 관점 모두에서 CRITICAL/
WARNING 급 위반을 찾지 못했다. 유일하게 남는 것은 이미 배포된 두 에러 코드(`INVALID_BOT_TOKEN`/
`BOT_TOKEN_INVALID`)의 근접 명명이 `error-codes.md §1` 이 이상으로 삼는 "이름만으로 분기 의미가
드러난다"에 완전히 부합하지는 않는다는 INFO 수준 관찰이며, 이는 이번 문서화 턴의 책임 범위
밖(이미 wire 에 나간 코드, §2 rename 금지)이고 draft 스스로 이미 콜아웃으로 경고하고 있다.

## 위험도
NONE
