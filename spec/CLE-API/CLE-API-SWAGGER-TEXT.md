---
id: "CLE-API-SWAGGER-TEXT"
title: "OpenAPI 문서화 — 설명 문구와 내부 참조"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-SWAGGER"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-SWAGGER"]
area: "CLE-API"
content_hash: "c9a6d8544a2a4ef0eea97c3abc29fa5ee0229a3e8d19a52e6c48dcf62f07530c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "c4e492b54da27a462efcf93f12c7100927c0fac25ca94350ff36cd8a9622a39d"
etag: "sha256-ee3166abac45859121444dba6e1e4833d460dd6f75e19af11a6c3cb2373369d9"
---
## 개요

이 문서는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 하위 문서로 OpenAPI 에 실리는 설명 문구(§3)를 정한다. 설명의 톤과 길이, JSDoc 과 `//` 주석의 분리, 길이와 무관하게 적어야 하는 보안·정책 캐비엇, 공개 문장의 저장소 내부 참조 금지와 그 가드가 대상이다. DTO · 컨트롤러 데코레이터 패턴은 [DTO 패턴](CLE-API-SWAGGER-DTO.md) 과 [컨트롤러와 응답 DTO](CLE-API-SWAGGER-ROUTE.md) 가 정한다.

## 3. 주석과 설명 톤

- 한국어로 간결하게 쓴다. `~한다` 와 `~합니다` 를 섞어 써도 된다(기존 프로젝트 문서 스타일 유지).
- 이 톤 규칙은 OpenAPI `description` 에만 적용한다. 앱 화면 문구와 사용자 가이드는 해요체로 통일하며 그 기준은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 다.
- 가능하면 "무엇을 하는지" 와 "제약·부수 효과" 를 담는다.

**길이: 강제하는 것과 지향하는 것을 가른다** (2026-08-23 개정).

| 대상 | 길이 | 성격 |
| --- | --- | --- |
| 엔드포인트 `summary` | 10~20자 | **강제**. 목록 UI 에서 잘린다 |
| 엔드포인트 `description` | 50~150자 | **강제** |
| DTO `description` | 한 줄 요약 지향 (약 40자) | **지향**. 상한이 아니다 |

DTO `description` 은 "한 줄로 읽히는가" 가 기준이지 글자 수가 아니다. 필드의 제약·부수 효과를 담느라 길어지는 것은 위반이 아니다. 아래 보안·정책 캐비엇은 애초에 길이 논의 밖이다. 근거는 Rationale "DTO 길이는 왜 강제가 아닌가".

**JSDoc 은 공개 OpenAPI 로 나간다. 내부 서사를 담지 않는다** (2026-09-05 규약화, 2026-10-03 저장소 내부 참조 금지 추가, 규칙 17).

플러그인이 `introspectComments` 로 **프로퍼티** JSDoc 을 `description` 에 그대로 싣는다([개요](CLE-API-SWAGGER.md#개요)). 즉 DTO 필드의 `/** ... */` 는 API 소비자가 읽는 문장이다. 컨트롤러 메서드 JSDoc 은 operation 설명으로 실리고 데코레이터의 `description` · `summary` 문자열도 그대로 나간다. 클래스 JSDoc 은 플러그인이 싣지 않지만 같은 분리를 따른다. 응답 DTO 파일의 `/** */` 는 한 채널로 다룬다([리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md)). 정정 경위, 리뷰 참조, "왜 이렇게 바꿨는지" 같은 내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다. `//` 는 플러그인이 읽지 않는다.

저장소 내부 참조(규칙 17 의 여섯 형태)는 DTO · 컨트롤러 파일의 `/** */` 블록 전부와 `description` · `summary` 에 적지 않는다. 클래스 JSDoc 도 같은 채널이라 내부 참조를 적지 않는다. 플러그인이 싣지 않는 자리라도 마찬가지다.

| 무엇 | 어디 |
| --- | --- |
| 소비자가 이 필드를 쓰려면 알아야 하는 것 | JSDoc `/** */` |
| 왜 이 값이 이 타입인지의 경위, 리뷰·PR 참조, 스펙 근거 | 바로 위 `//` 주석. 스펙은 키 링크로 가리킨다([스펙과 구현 근거 규약 규칙 18 · R-14](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md)) |

`alert-rule-response.dto.ts` 의 `threshold` 가 이 분리를 적용한 예다. 내부 서사는 기존 DTO 를 소급해 정리하지 않는다([§1-4](CLE-API-SWAGGER-DTO.md#1-4-nested-enum-union) 와 같은 원칙). 그 자리를 다음에 건드릴 때 함께 맞춘다. 가드가 세는 여섯 형태는 전환 단계 4c 에서 기존 자리까지 걷어 베이스라인이 0 이다(규칙 17). 경로 없는 절 번호 인용은 남아 있다(`CLE-T-BCS6QZ`).

**반드시 적는다: 보안·정책 캐비엇** (2026-08-17 규약화, 2026-08-22 요청 필드까지 확장, 2026-08-23 "예외" 에서 "적극 지시" 로 재정의).

아래 두 부류는 길이를 이유로 줄이지 않는다. 짧게 쓰면 정보가 사라지는 자리다. DTO 길이가 강제가 아니므로 이것은 상한의 면제가 아니라 지시다. 다른 필드는 짧게 써도 되지만 이 둘은 **길어도 적어야 한다**.

| 부류 | 소비자가 그 설명 없이는 알 수 없는 것 |
| --- | --- |
| **응답** 값이 저장된 값과 다를 수 있는 필드(응답 마스킹 대상 등) | "왜 DB 와 값이 다른가" |
| **요청** 값이 정책으로 거부될 수 있는 필드(예약어, 재제출 금지 값 등) | "왜 이 값을 보내면 400 인가" |

다만 상세 근거는 문서 본문에 두고 설명에는 1~2문장 요약만 적는다. 기준 문서는 설명이 아니라 바로 위 `//` 주석에 키 링크로 적는다(규칙 17). 응답 마스킹과 재제출 거부의 기준은 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이다. 근거는 Rationale "보안·정책 캐비엇: 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가".

## 구현 위치

- `codebase/backend/src/repo-guards/__tests__/openapi-internal-ref-guard.ts` 와 `openapi-internal-ref.spec.ts`, 대조군 `fixtures/openapi-internal-ref/**` (규칙 17)
- `codebase/frontend/src/lib/__tests__/public-surface-internal-refs.test.ts` (규칙 17 과 같은 패턴으로 배포 SVG 와 외부 SDK README · `package.json` 을 보는 프런트엔드 가드)
- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts` (교차 참조. 응답 DTO JSDoc 의 리뷰 인용을 보는 가드다. 기준은 [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이다)
- `codebase/frontend/src/lib/docs/__tests__/review-citation-form.test.ts` 와 `codebase-mentions.ts` (교차 참조. [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 규칙 9 · 10 을 보는 가드다. 기준은 그 규약이다)

## Rationale

### DTO 길이는 왜 강제가 아닌가 (§3)

**실측이 먼저다** (2026-08-23). 집계 기준을 적어 둔다. 적지 않으면 재현이 안 된다. 같은 숫자를 독립적으로 다시 세면 아래 세 기준을 다르게 잡아 다른 값(요청 약 118/368)이 나왔다. 방향(대량 초과)은 재현됐지만 절대값은 기준에 민감하다.

1. 대상: `codebase/backend/src/**/dto/**/*.dto.ts` (다른 위치의 DTO 는 제외)
2. 요청·응답 분류: 경로에 `/responses/` 가 있거나 파일 이름이 `-response.dto.ts` 면 응답
3. 길이: `description:` 뒤에 이어지는 문자열 리터럴을 모두 이어 붙인 뒤 글자 수를 센다(`'a' + 'b'` → `ab`). 템플릿 리터럴과 변수 참조는 세지 않는다

| 범위 | 40자 초과 |
| --- | --- |
| 요청 DTO | 116/335 (34%) |
| 응답 DTO | 58/128 (**45%**) |
| 전체 | **174/463 (37%)** |

아래 보안·정책 캐비엇 항목의 `114/333` 은 2026-08-22 실측이고 이 표는 2026-08-23 재실측이다. 차이(+2/+2)는 그 사이 `ReRunRequestDto`·`ExecuteWorkflowDto` 에 필드 설명이 더해진 것이다. 모집단이 바뀐 것이지 어느 쪽이 틀린 것이 아니다.

**37% 미준수는 "규칙이 안 지켜진다" 가 아니라 "그건 규칙이 아니었다" 는 뜻이다.** 옛 문면도 이미 `10~40자 내외` 로 완충을 달아 강제할 의도가 아니었음을 스스로 드러내고 있었다.

세 갈래를 놓고 골랐다.

| 대안 | 기각 사유 |
| --- | --- |
| 수치를 현실에 맞게 **올린다** | 새 숫자도 근거 없이 임의적이다. 같은 문제가 몇 달 뒤 반복된다 |
| 규칙을 유지하고 **초과분 174건을 정리** | §3 스스로 "소비자가 알 방법이 그 설명뿐" 이라 한 정보를 지우게 된다. 비용도 크다 |
| **강제가 아님을 명문화** (채택) | 문면이 현실과 의도 양쪽에 맞는다 |

이는 §3 이 자기 예외를 들일 때 쓴 "새로 만든 관행이 아니라 이미 굳은 관행의 추인" 논리를 기본 규칙에도 적용한 것이다. 예외만 추인하고 본칙을 두면 규약이 한 발만 현실에 딛게 된다.

**강제를 남겨 둔 곳이 있다.** 엔드포인트 `summary` 는 목록 UI 에서 잘리므로 길이가 기능적 제약이다. DTO `description` 은 그렇지 않다. 그 차이가 강제와 지향을 가르는 기준이다.

이 결정은 2026-08-22 개정이 "기본 수치 규칙 자체가 현실과 벌어져 있을 수 있지만 별개 판단" 으로 남겨 둔 유보를 푼 것이다(2026-08-23 사용자 택일).

**`deprecated` 패턴은 아직 §1 로 일반화하지 않는다.** 같은 날 `ExecuteWorkflowDto.input` 이 형제와의 같은 이름 다른 뜻을 `deprecated: true` 로 풀었지만(이름을 바꾸면 wire 계약이 깨져 기각) 사례가 하나뿐이다. rule of three 를 채우기 전에 규칙으로 올리면 다음 사례가 이 형태와 다를 때 규칙이 먼저 틀린다. 세 번째 사례가 나오면 [DTO 패턴 §1](CLE-API-SWAGGER-DTO.md#1-dto-패턴) 에 소절로 올린다. 인접 선례도 함께 센다. [Cafe24 operation 메타데이터](CLE-C24-META) 는 같은 상황에서 **필드를 제거**했다(백엔드 `label` 을 프론트엔드 i18n 사전 하나로). 그쪽은 내부 메타데이터라 제거 비용이 작았고 `ExecuteWorkflowDto.input` 은 공개 wire 필드라 제거라는 선택지가 애초에 없다. 두 사례는 다른 문제이므로 rule of three 를 셀 때 한 칸으로 합치지 않는다.

### 보안·정책 캐비엇: 왜 길이를 이유로 줄이지 않는가, 그리고 왜 양방향인가 (§3)

**왜 이 자리는 길어도 되는가** (2026-08-17 도입, 2026-08-23 틀 정정): 소비자가 OpenAPI 만 보고 통합할 때 "이 필드는 내가 저장한 값과 다르게 돌아온다" 를 알 방법이 그 `description` 뿐이다. 짧은 한 줄에 그 사실과 이유를 함께 담을 수 없다.

2026-08-17~08-22 에는 이것을 "예외" 라고 불렀다. 그때는 DTO 길이가 강제 상한이었으니 면제가 맞는 틀이었다. 2026-08-23 개정으로 그 상한이 지향이 되면서 면제할 대상이 사라졌고(없는 상한을 면제할 수는 없다) 같은 내용이 "이 둘은 길어도 반드시 적어라" 는 지시로 뒤집혔다. 내용은 그대로이고 틀만 바뀌었다.

**새 관행이 아니라 추인이었다.** 도입 시점 실측으로 이미 9곳 넘는 DTO 가 이 형태를 쓰고 있었고(`execution-response.dto.ts`, `background-run-response.dto.ts` 등) 두 라운드 연속 규약 위반으로 지적됐다. 규약이 현실을 반영하도록 고쳤다.

**왜 요청 필드까지 넓혔나** (2026-08-22): 논거가 대칭인데 문면만 한쪽이었다. 응답 쪽 질문이 "왜 DB 와 값이 다른가" 라면 요청 쪽은 "왜 이 값을 보내면 400 인가" 이고 소비자가 알 방법이 그 설명뿐이라는 점도 같다. 계기는 `ReRunRequestDto.inputOverride` 였다. 마스킹 마커와 정확히 같은 값이 `MASKED_VALUE_RESUBMITTED` 로 거부된다는 사실을 적어야 했는데 이것은 응답이 아니라 요청이 거부되는 규칙이라 기존 문면이 덮지 못했다([응답 자격 증명 마스킹](CLE-API-EGRESS.md)).

**요청 쪽도 추인이다** (2026-08-22 실측, `codebase/backend/src/**/dto/**/*.dto.ts` 중 `responses/` 와 `*-response.dto.ts` 제외): 요청 DTO 73개 파일의 `description` 333개 중 114개(34%)가 40자를 넘는다. 가장 긴 것은 `chat-channel-config.dto.ts` 435자이고 상위권에 이 캐비엇이 겨냥한 바로 그 부류가 있다. `create-auth-config.dto.ts`(248자, 인증 상세 설정), `chat-channel-config.dto.ts`(386자, provider 발급 웹훅 인증 자료)다.

**넓히지 않은 것**: 위 34% 는 보안·정책 캐비엇 부류보다 넓다. 즉 기본 수치 규칙 자체가 현실과 벌어져 있을 수 있었는데 그것은 이 캐비엇의 문제가 아니라 별개 판단이라 이때는 건드리지 않았다. 그 판단은 "DTO 길이는 왜 강제가 아닌가" 에서 내려졌다.

### 공개 문장의 저장소 내부 참조를 왜 가드로 세는가 (규칙 17, 2026-10-03)

2026-09-05 규약화(규칙 14)는 내부 서사만 `//` 주석으로 보냈다. 저장소 내부 참조는 금지하지 않았다. 오히려 §3 보안·정책 캐비엇은 설명에 1~2문장 요약과 기준 문서 링크를 적으라고 했다. EIA `context` 의 `ConversationThreadDto` 문단도 description 이 대화 스레드 문서를 가리킨다고 적었다. 2026-10-03 에 이 두 지시를 뒤집었다. 기준 문서 링크는 바로 위 `//` 주석으로 옮겼고 공개 문장에서는 저장소 내부 참조를 금지했다(규칙 17).

이 참조는 외부 소비자에게 쓸모가 없다. 옛 스펙 트리는 전환 단계 5 에서 지웠으므로 경로는 죽은 문자열이다. 외부 소비자는 NERV 스펙 키도 열어 볼 수 없다. 그래서 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 공개 문장에는 사실만 남기고 필요한 근거는 바로 위 `//` 주석의 키 링크로 옮겼다. 같은 변경에서 가드 `openapi-internal-ref` 를 세웠다. 4c 가 걷은 곳은 모두 91곳(50파일)이고 베이스라인은 0 이다.

- **두 파일 종류의 `/** */` 를 모두 본다.** `*.dto.ts` · `*.controller.ts` 의 모든 `/** */` 블록(클래스 · 멤버 · 파일 수준 선언)과 두 파일 종류의 `description` · `summary` 문자열 속성을 본다. 파일 종류는 `nest-cli.json` 의 플러그인 suffix 와 같다. 클래스 JSDoc 처럼 플러그인이 싣지 않는 자리도 같은 채널로 센다. [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 이 응답 DTO 파일의 `/** */` 를 한 채널로 보고 클래스 JSDoc 을 `//` 와 같게 보는 안 (A) 를 기각한 것과 같은 이유다. 쓰는 사람이 플러그인 동작을 보고 자리마다 판단하지 않아도 된다. 클래스 설명을 `@ApiSchema({ description })` 로 옮겨 적을 때 참조가 딸려 나가지도 않는다.
- **찾는 형태는 여섯이다.** 저장소 스펙 경로(`spec/…`), 옛 스펙 파일 이름, NERV 스펙 키(`CLE-…`), 요구사항 ID(`REQ-…-NNN`), 옛 요구사항 ID, 옛 plan 경로(`plan/in-progress/` · `plan/complete/` · `plan/research/`)다. 옛 스펙 파일 이름은 `spec/` 없이 적은 옛 트리 파일 이름(`15-chat-channel.md` · `../../2-navigation/4-integration.md`)이다. 옛 트리 파일 이름은 번호로 시작하므로 가드는 번호로 시작하는 `.md` 이름(`\b\d+-[a-z][\w-]*\.md\b`)을 잡는다. 번호 없는 `README.md` 같은 이름은 잡지 않는다. 옛 요구사항 ID 는 옛 트리 스펙의 앵커 ID(`WH-SC-01` · `CCH-ERR-03`)다. 대문자 묶음 둘 이상 뒤에 두 자리 숫자가 오는 모양으로 잡는다. 옛 트리의 이런 ID 690개가 모두 두 자리라서(2026-10-03 실측) `HMAC-SHA-256` 같은 세 자리 표준 이름은 잡지 않는다. `SHA-256` 처럼 대문자 묶음이 하나인 이름도 잡지 않는다. NERV 키 패턴은 NERV Task 키(`CLE-T-…`)도 잡는다.
- **옛 plan 경로에 `plan/research/` 가 든다** (2026-11-07). 전환 단계 3 에서 `plan/` 을 통째로 지웠으므로 `plan/research/` 도 죽은 경로다. `legacy-path-ratchet` 의 `REMOVED_PLAN_PATH`(`codebase/frontend/src/lib/docs/__tests__/codebase-mentions.ts`)도 이 경로까지 센다([스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md) R-15). 둘을 다르게 둘 근거가 없어 가드 `openapi-internal-ref` 와 프런트엔드 `public-surface-internal-refs` 의 패턴에 함께 넣었다. 두 패턴은 사본이라 함께 고친다. 2026-11-07 실측으로 두 가드가 보는 파일에 `plan/research/` 는 0건이라 걷을 자리는 없었다.
- **`//` 와 `/* */` 주석은 보지 않는다.** 근거를 옮겨 적는 자리라 일부러 비워 둔다.
- **기존 자리까지 걷었다.** [DTO 패턴 §1-4](CLE-API-SWAGGER-DTO.md#1-4-nested-enum-union) 와 이 문서 §3 의 비소급 원칙은 내부 서사에 걸린다. 내부 참조는 기계로 판정되고 문구를 지우면 끝난다. 전환 단계 5 에서 옛 트리를 지운 뒤로는 죽은 문자열이다. 그래서 기존 자리까지 걷었다.
- **베이스라인은 0 이다.** 공개 문장에서 내부 참조를 빼는 일은 언제나 할 수 있다. 그래서 예외를 둘 자리가 없다.
- **못 보는 것이 있다.** 상수나 헬퍼로 조립한 설명은 보지 못한다. 가드는 문자열 리터럴과 `+` 연결, 템플릿 리터럴의 고정 부분만 읽는다. 두 파일 종류 밖의 파일(`*.query.ts` 등)과 `example` · `@ApiTags` 같은 다른 키도 보지 않는다. 경로 없는 절 번호 인용(`[Spec EIA §4]`, 상수로 조립한 설명 속 `(spec 통합 §8 · §9.2)` 등)은 모양이 일정하지 않아 잡지 못한다. 그 인용은 남아 있고 정리는 NERV Task `CLE-T-BCS6QZ` 가 맡는다.
- **리뷰 인용은 다른 가드가 본다.** 응답 DTO JSDoc 의 리뷰 인용은 `dto-jsdoc-citation` 이 본다([리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md)). 그 규약 규칙 9 · 10 이 금지한 두 형태(`finding` 바로 뒤 소문자 16진 8자로 줄인 발견 ID, `.review/` 아래 code · consistency · merge · spec-coverage 경로)는 `review-citation-form` 이 `codebase/**` 의 텍스트 파일에서 본다(전환 단계 4g, 2026-10-03). 요청 DTO · 컨트롤러 JSDoc 과 `description` · `summary` 문자열도 그 범위에 든다. 그 가드가 읽는 파일, 잡는 형태, 잡지 못하는 형태는 그 규약의 [강제 범위](../CLE-ENG/CLE-ENG-REVIEWCITE.md#강제-범위) 에 있다. 그 밖의 리뷰 인용 형식(옛 리뷰 경로, 날짜 없는 시각, 전체 발견 ID)은 응답 DTO 파일 밖에서는 어느 가드도 보지 않는다(그 규약의 강제 범위).
- **규칙 17 의 「Task 키 제외」** (2026-11-07). 규칙 17 이 목록 밖에 둔 리뷰 인용은 발견 ID 와 옛 리뷰 경로처럼 Task 키가 아닌 것이다. NERV Task 키(`CLE-T-…`)는 NERV 키 모양이라 여섯 형태에 들고 가드 `openapi-internal-ref` 가 그 형태로 잡는다. 이 겹침을 Rationale 해석으로만 두지 않고 규칙만 읽어도 알 수 있게 규칙 문구에 적었다. 판정은 그대로다.
- **리뷰 인용 금지의 범위를 규칙 17 에 맞췄다** (2026-11-07). 규칙 17 은 DTO · 컨트롤러 파일의 `/** */` 전부를 공개 채널로 본다. [리뷰 산출물 인용 규약](../CLE-ENG/CLE-ENG-REVIEWCITE.md) 규칙 6 은 필드 · 컨트롤러 · 응답 DTO 클래스의 `/** */` 만 금지해 요청 DTO 클래스와 파일 수준 선언이 비어 있었다. 그 규칙 6 의 범위를 두 파일 종류의 `/** */` 전부로 넓혀 맞췄다.
- **프런트엔드 공개 표면도 같은 패턴으로 본다.** `public-surface-internal-refs`(`codebase/frontend/src/lib/__tests__/public-surface-internal-refs.test.ts`)가 배포 SVG 와 외부 SDK(`@workflow/sdk` · `@workflow/web-chat`)의 README · `package.json` 을 같은 패턴으로 본다.
