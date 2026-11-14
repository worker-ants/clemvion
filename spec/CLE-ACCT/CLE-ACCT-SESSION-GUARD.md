---
id: "CLE-ACCT-SESSION-GUARD"
title: "세션과 토큰 — 운영 환경 가드"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SESSION"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SESSION"]
area: "CLE-ACCT"
content_hash: "a7011fe9c3b2721558138e950556d4034836585f73077ce7c1545cc7f272df2d"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2e634466c3140a08e9eae3913cfe32e7347a14ed86732ad41a91bad9a9be44aa"
etag: "sha256-a78b62fd7dd4863221da469dd45fd02385cceeef7537c67e80b1cb50256b8e23"
---
> 구현 상태: 구현됨 · 상위: [세션과 토큰](CLE-ACCT-SESSION.md)

## 개요

이 문서는 [세션과 토큰](CLE-ACCT-SESSION.md) 의 하위 문서로 운영 환경 부팅 가드(`assertProductionConfig`)가 막는 설정의 전체 목록, 두 암호화 키의 검사 기준, 이 가드에 넣는 설정과 넣지 않는 설정의 기준을 정한다.

## 운영 환경 가드

`NODE_ENV=production` 에서 아래 설정 가운데 하나라도 안전하지 않으면 서버가 기동하지 않는다. `main.ts` 가 bootstrap 첫 단계에서 `assertProductionConfig`(`common/config/production-guards.ts`)를 부른다. 이 함수는 첫 위반에서 바로 예외를 던진다. 그래서 여러 설정이 함께 걸려도 메시지에는 코드가 먼저 검사한 하나만 나온다. 아래 표의 행 순서는 검사 순서가 아니다. 예외 메시지는 `production fail-closed 가드:` 로 시작한다. 개발·테스트·e2e(`NODE_ENV≠production`)에서는 검사하지 않는다.

이 절이 `assertProductionConfig` 가 검사하는 대상의 전체 목록이다. 다른 문서는 목록을 옮겨 적지 않고 이 절을 링크한다. 검사를 더하거나 빼면 아래 표에도 행을 더하거나 뺀다. 단위 테스트 `production-guards.spec.ts` 가 `assertProductionConfig` 가 읽는 환경 변수와 표의 첫 열을 대조한다.

| 설정 | 기동을 막는 값 | 막는 위험 |
| --- | --- | --- |
| `JWT_SECRET` | 없음, 공백뿐인 값, 기본 sentinel(`dev-jwt-secret`), 저장소에 커밋된 예시 값, 앞뒤 공백을 뗀 길이가 32자 미만 | 기본값이나 예측 가능한 비밀로 서명하면 누구나 액세스 토큰을 위조해 인증을 우회한다(CWE-521 약한 비밀) |
| `INTERACTION_JWT_SECRET` | 설정했을 때만 검사한다. 빈 값, 공백뿐인 값, 저장소에 커밋된 예시 값(`JWT_SECRET` 의 예시 값 포함), 앞뒤 공백을 뗀 길이가 32자 미만. 설정하지 않으면 `JWT_SECRET` 으로 서명하므로 위 행이 대신 막는다 | 실행 단위 인터랙션 토큰(`iext_*`)의 서명 비밀이다. 예측 가능한 값이면 누구나 토큰을 위조해 남의 실행에 입력을 보내거나 실행을 취소한다([External Interaction API 「인터랙션 토큰」](../CLE-IX/CLE-EIA.md#인터랙션-토큰)) |
| `ENCRYPTION_KEY`(마스터키) | [암호화 키 검사](#암호화-키-검사) 에 걸리는 값 | 시크릿 저장소 값과 모델 설정의 API 키가 사실상 평문이 된다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)) |
| `INTEGRATION_ENCRYPTION_KEY`(통합 암호화 키) | [암호화 키 검사](#암호화-키-검사) 에 걸리는 값 | 통합 자격 증명과 인증 설정이 평문으로 저장된다. 대상 컬럼은 [통합 데이터와 흐름 「암호화」](../CLE-INT/CLE-INT-DATA.md#암호화) 표에 있다 |
| `MCP_ALLOW_INSECURE_URL` | 켜짐 | MCP 클라이언트의 SSRF 방어(https 만 허용, 호스트 차단 목록)를 통째로 우회한다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)) |
| `OAUTH_STUB_MODE` | 켜짐 | 실제 OAuth 제공자 검증을 건너뛰어 소셜 로그인 인증이 무력해진다 |
| `LLM_STUB_MODE` | 켜짐 | 실제 LLM 호출 대신 스텁 응답을 돌려준다([LLM 클라이언트 「LLM 스텁 모드」](../CLE-AI/CLE-AI-LLM.md#llm-스텁-모드)) |
| `ALLOW_HTTP_HOOKS` | 켜짐 | 알림 웹훅 URL 에 `http://` 를 허용한다. 그러면 서명한 알림 본문과 `X-Clemvion-*` 헤더가 평문으로 나간다([EIA 알림 웹훅 「SSRF 방지」](../CLE-IX/CLE-EIA-NOTIFY.md#ssrf-방지)) |

이 가드는 플래그 값이 정확히 `true` 또는 `1` 이면 켜진 것으로 보고 기동을 막는다(`isFlagOn`). `TRUE` · `yes` · `on` · 빈 문자열은 꺼진 것으로 본다. 기능을 실제로 켜는 판정은 설정마다 따로 한다. `OAUTH_STUB_MODE` · `LLM_STUB_MODE` 는 `true` 일 때만, `MCP_ALLOW_INSECURE_URL` 은 `true` 나 `1` 일 때, `ALLOW_HTTP_HOOKS` 는 `1` 일 때만 켜진다. 가드가 막는 값이 켜지는 값을 모두 담으므로 운영 환경에서 이 기능이 켜진 채 기동하는 일은 없다. 단위 테스트가 설정마다 기능을 켜는 판정과 가드를 대조해 이 관계를 확인한다.

`JWT_SECRET` 은 앞뒤 공백을 뗀 값으로 검사한다. 뗀 값이 비었으면 공백뿐인 값으로 보고 막는다. 예시 값 대조와 길이 하한도 뗀 값에 적용한다. 뗀 값은 검사에만 쓰고 토큰 서명에 쓰는 값은 바꾸지 않는다. 예시 값 목록의 정본은 `production-guards.ts` 의 `INSECURE_JWT_SECRETS` 다. 코드의 기본 sentinel 과 저장소에 커밋된 예시 값(`.env.example`, 배포 예시 Secret, 로컬 · e2e 설정, README)을 담는다. 이 문서에는 예시 값을 옮기지 않는다. 단위 테스트가 저장소의 예시 파일 값과 이 목록을 대조한다.

`INTERACTION_JWT_SECRET` 도 같은 방식으로 검사한다. 다만 변수가 없으면 검사하지 않는다. 그때는 `JWT_SECRET` 으로 서명하기 때문이다. 빈 문자열은 «설정하지 않음» 으로 보지 않고 막는다. 서명 비밀을 고르는 코드가 빈 값을 `JWT_SECRET` 으로 대신하지 않기 때문이다. 예시 값 목록의 정본은 `production-guards.ts` 의 `INSECURE_INTERACTION_JWT_SECRETS` 다. 이 목록은 `INSECURE_JWT_SECRETS` 를 모두 담는다. 그래서 `JWT_SECRET` 의 예시 값을 이 자리에 넣어도 막는다.

### 암호화 키 검사

마스터키와 통합 암호화 키는 같은 규칙으로 검사한다. 이 규칙의 정본은 이 절이다.

- 값이 없거나 빈 문자열이면 막는다.
- 공백뿐인 값을 막는다.
- 저장소에 커밋된 예시 값을 막는다. `.env.example`, 배포 예시 Secret, 로컬 · e2e 설정, README 에 적힌 값이다.
- 예시 값은 원래 값과 앞뒤 공백을 뗀 값을 모두 목록과 대조한다. 뗀 값은 대조에만 쓰고 키로 쓰는 값은 바꾸지 않는다.
- 예시 값 목록의 정본은 `production-guards.ts` 의 두 상수다. 마스터키는 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 와, 통합 암호화 키는 `INSECURE_INTEGRATION_ENCRYPTION_KEYS` 와 대조한다. 뒤 목록은 앞 목록을 모두 담는다. 그래서 마스터키 예시 값을 통합 암호화 키 자리에 넣어도 막는다. 통합 암호화 키에만 있는 예시 값을 마스터키 자리에 넣으면 막지 않는다.
- 이 문서에는 예시 값을 옮기지 않는다. 단위 테스트 `production-guards.spec.ts` 가 저장소의 예시 파일 값과 두 목록을 대조한다.
- 길이 하한은 두지 않는다. 키를 만드는 방식은 [시크릿 저장소 「마스터키」](../CLE-INT/CLE-INT-SECRET.md#마스터키) 와 [통합 데이터와 흐름 「키」](../CLE-INT/CLE-INT-DATA.md#키) 가 정한다.
- 거부 메시지에 키 값을 싣지 않는다.

이 가드 밖에서 키가 없을 때의 동작은 키마다 다르다. 마스터키가 없거나 빈 값이면 환경과 상관없이 `SecretResolver` 초기화가 부팅을 멈춘다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 17). 운영 환경 밖에서 통합 암호화 키가 없으면 transformer 가 경고를 남기고 평문으로 저장한다([통합 데이터와 흐름 「키가 없을 때」](../CLE-INT/CLE-INT-DATA.md#키가-없을-때)).

### 가드에 넣는 것과 넣지 않는 것

`assertProductionConfig` 에는 환경 변수만으로 부팅 직전에 판정할 수 있고 정당한 용도가 없는 설정만 넣는다.

- 모듈 안 컨텍스트가 필요한 부팅 검사는 그 모듈에 둔다. EIA 의 종료 토큰 폐기 스케줄러 등록 fail-fast 는 [External Interaction API](../CLE-IX/CLE-EIA.md) 에 있다. 워크스페이스 멤버십 가드의 부팅 자가 검증은 [워크스페이스와 멤버](CLE-ACCT-WS.md) 에 있다.
- `INTERACTION_JWT_SECRET` 은 환경 변수만으로 판정할 수 있어 이 함수가 검사한다. `InteractionTokenService` 생성자는 그와 별도로 두 서명 비밀이 모두 없으면 예외를 던진다([External Interaction API](../CLE-IX/CLE-EIA.md) 의 「인터랙션 토큰」 절).
- 정당한 용도가 있는 완화 플래그는 기동을 막지 않고 경고 로그만 남긴다. 이 판정은 `main.ts` 가 한다. 예를 들어 `ALLOW_PRIVATE_HOST_TARGETS` 의 뜻은 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 이 정한다. 이 플래그가 기동을 막지 않고 경고만 남기는 이유는 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 에 있다. `MAIL_REQUIRE_TLS=false` 는 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 이 정한다.

## 구현 위치

- `codebase/backend/src/common/config/production-guards.ts` (`assertProductionConfig`, 플래그 판정 `isFlagOn`, `JWT_SECRET` 예시 값 목록 `INSECURE_JWT_SECRETS`, 암호화 키 예시 값 목록 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` · `INSECURE_INTEGRATION_ENCRYPTION_KEYS`)
- `codebase/backend/src/common/config/production-guards.spec.ts` (가드 분기, 저장소 예시 파일 값 대조, 설정마다 기능을 켜는 판정과 가드의 대조, 이 문서 「운영 환경 가드」 표와 검사 대상의 대조)
- `codebase/backend/src/main.ts` (가드를 부르는 곳, 경고만 남기는 완화 플래그 판정)

## Rationale

### 운영 환경 가드를 한 함수에 모은다

`NODE_ENV=production` 의 부팅 거부 검사를 `assertProductionConfig` 한 함수에 모았다. 같은 성격의 비밀·stub(`INTERACTION_JWT_SECRET`, `OAUTH_STUB_MODE`, `LLM_STUB_MODE`)에 production throw 표준이 이미 있었다. 위치(`main.ts` 부팅)와 패턴도 같았다. 한 함수로 모으면 비밀을 더할 때 빠뜨리는 일을 구조로 막는다. 환경 변수만으로 부팅 직전에 판정할 수 있는 절대 금지 항목만 넣는다. 정당한 용도가 있는 항목(예: throw 가 아니라 warn 인 `ALLOW_PRIVATE_HOST_TARGETS`)은 일부러 뺐다. 설정이 없으면 기동을 거부하는 쪽이 안전하지 않은 부팅보다 낫다는 fail-closed 의도다. 개발·테스트·e2e 는 영향이 없다. `INTERACTION_JWT_SECRET` 은 처음에 DI 컨텍스트가 필요하다며 뺐다가 2026-11-06 에 이 함수로 옮겼다(「[`INTERACTION_JWT_SECRET` 을 운영 환경 가드에 더했다 (2026-11-06)](#interaction_jwt_secret-을-운영-환경-가드에-더했다-2026-11-06)」).

`JWT_SECRET` 에는 32자 길이 하한을 두고 두 암호화 키에는 두지 않는다. `JWT_SECRET` 은 서명 키라 짧으면 무차별 대입에 약하다. 두 암호화 키는 이미 그 키로 암호화한 값이 있으면 키를 바꾸는 순간 그 값을 복호화하지 못한다. 그래서 짧아도 비밀인 키는 막지 않는다. 키 길이 계약은 NERV Task `CLE-T-C6GCKV` 가 정한다. 공백뿐인 값과 앞뒤 공백이 붙은 예시 값까지 막는 이유는 [시크릿 저장소 「R5」](../CLE-INT/CLE-INT-SECRET.md#r5-envexample-에는-형식-예시만-두고-production-에서-막는다) 에 있다.

`INTEGRATION_ENCRYPTION_KEY` 는 2026-10-31 에 목록에 더했다. `assertProductionConfig` 는 이 키를 이미 검사했는데 목록에는 빠져 있었다. 키가 없으면 통합 자격 증명과 인증 설정이 평문으로 저장되므로 운영 환경에서는 부팅을 거부한다. 결정 배경은 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다. 범위 문장도 «인증 계열의 공통 부팅 가드» 에서 «`assertProductionConfig` 의 공통 부팅 가드» 로 바꿨다. 목록에는 원래 `MCP_ALLOW_INSECURE_URL` · `LLM_STUB_MODE` 같은 인증 밖 항목이 있어 «인증 계열» 이 사실과 맞지 않았다.

### 운영 환경 가드 목록을 본문으로 옮기고 암호화 키 검사 규칙을 한 곳에 모았다 (2026-10-31)

- 가드 목록은 원래 Rationale 에 있었다. 무엇이 기동을 막는지는 기술 명세라 본문 [운영 환경 가드](#운영-환경-가드) 절로 옮겼다. 제목을 그대로 두어 `#운영-환경-가드` 앵커를 링크하던 문서는 고치지 않아도 본문 절을 가리킨다. Rationale 의 옛 절은 「운영 환경 가드를 한 함수에 모은다」 로 제목을 바꾸고 이유만 남겼다. 같은 제목이 둘이면 앵커가 갈리기 때문이다.
- 암호화 키 검사 규칙(없음 · 공백뿐 · 공개 예시 값 · 앞뒤 공백을 뗀 값 대조)은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md), [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md), [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 에 사본으로 있었다. 가드 조건이 바뀌면 여러 문서를 함께 고쳐야 했고 빠뜨려도 알려 주는 검사가 없었다. 그래서 규칙은 본문 [암호화 키 검사](#암호화-키-검사) 한 곳에 두고 나머지는 링크로 줄였다.
- 정본을 이 문서에 둔 이유는 두 가지다. 가드 목록이 이미 여기 있다. 그리고 두 키를 같은 함수가 같은 규칙으로 검사한다. 키를 무엇에 쓰는지, 키를 어떻게 만드는지, 운영 환경 밖에서 키가 없으면 어떻게 되는지는 그대로 시크릿 저장소와 통합 데이터와 흐름이 정한다. 이 문서로 옮긴 것은 운영 환경 가드가 키를 거부하는 기준뿐이다.
- 시크릿 저장소에 정본을 두는 안도 견줬다. 시크릿 저장소는 규약 문서라 규범을 두기에 맞다. 하지만 그러면 가드 목록 가운데 두 행의 기준만 다른 문서로 떨어져 목록을 읽을 때 두 문서를 오가야 한다. 그래서 택하지 않았다.
- 날짜가 붙은 결정 기록(시크릿 저장소 R13 의 결정 목록, R5 의 2026-10-10 확장 단락 등)은 그때의 사실이라 문장을 그대로 두었다. 지금의 규칙을 말하는 문장만 링크로 바꿨다.
- 같은 묶음에서 두 군데를 코드와 용어 사전에 맞췄다. 옛 목록은 플래그 셋을 «true 면 throw» 라고 적었지만 코드(`isFlagOn`)는 `true` 와 `1` 을 모두 켜짐으로 본다. 마스터키가 암호화하는 대상의 «LLM 프로바이더 API 키» 는 용어 사전의 «모델 설정의 API 키» 로 바꿨다.
- 요구사항 줄은 더하지 않았다. 이 변경은 문서 위치와 사본을 정리한 것이고 가드 동작은 그대로다. 요구사항 줄이 있는 항목은 `JWT_SECRET` 뿐이다. 두 암호화 키와 플래그의 부팅 거부는 본문 [운영 환경 가드](#운영-환경-가드) 절이 정한다. 이 항목들을 요구사항 줄로 올리는 일은 새 요구 번호를 받아 따로 다룬다.

### `JWT_SECRET` 을 앞뒤 공백을 뗀 값으로 검사하고 알림 웹훅 http 허용 플래그를 가드에 더했다 (2026-11-05)

- **`JWT_SECRET` 의 앞뒤 공백**: 예전 가드는 원래 값만 목록과 대조하고 길이를 쟀다. 그래서 공개 placeholder 뒤에 개행이 붙은 값(38자)이 운영 부팅을 통과했다. Kubernetes Secret 이나 `.env` 로 값을 옮기다 보면 개행이 붙기 쉽다. 공백만으로 된 32자 이상 값도 통과했다. 두 암호화 키는 [시크릿 저장소 「R5」](../CLE-INT/CLE-INT-SECRET.md#r5-envexample-에는-형식-예시만-두고-production-에서-막는다) 의 결정대로 이미 뗀 값으로도 대조했다. 같은 함수 안에서 키마다 공백 처리를 달리할 이유가 없어 `JWT_SECRET` 도 같은 방식으로 바꿨다.
- **길이 하한도 뗀 값으로 잰다**: 앞뒤 공백은 비밀을 강하게 만들지 않는다. 31자 비밀 뒤에 개행을 붙여 32자를 채운 값은 31자 비밀과 같다. 그래서 운영 중인 배포라도 뗀 길이가 32자 미만이면 이제 부팅이 막힌다. 그 배포는 서명 키를 새로 만들어야 하고, 키를 바꾸면 이미 발급한 토큰이 무효가 되어 사용자가 다시 로그인한다.
- **서명에 쓰는 값은 바꾸지 않는다**: `jwt.config.ts` 에서 값을 다듬어 서명에도 뗀 값을 쓰는 안을 견줬다. 그러면 앞뒤 공백이 붙은 키로 운영 중인 배포는 이 변경과 함께 서명 키가 바뀌어 발급한 토큰이 모두 무효가 된다. 가드의 목적은 약한 키로 기동하지 않게 하는 것이라 서명 동작은 그대로 두었다.
- **커밋된 예시 값**: 로컬 overlay 와 e2e compose 의 `JWT_SECRET` 은 32자를 넘고 목록에 없어 운영 부팅을 통과했다. 두 암호화 키처럼 저장소에 커밋된 예시 값을 모두 목록에 넣고 단위 테스트가 예시 파일과 목록을 대조한다. 두 설정은 `NODE_ENV` 가 production 이 아니어서 지금 동작은 바뀌지 않는다.
- **`ALLOW_HTTP_HOOKS`**: 개발용 플래그인데 가드 목록에 없었다. 운영에서 켜지면 `http://` 알림 URL 을 등록할 수 있고 서명한 본문과 헤더가 평문으로 나간다. `ALLOW_PRIVATE_HOST_TARGETS` 와 달리 운영에서 켤 정당한 용도가 없어서 경고가 아니라 기동 거부로 둔다. 이 플래그는 `1` 일 때만 기능을 켜지만 가드는 다른 플래그와 같은 `isFlagOn` 판정으로 `true` 도 막는다. 가드가 막는 값이 켜지는 값을 모두 담으면 충분하고, 플래그마다 판정을 따로 두면 오히려 빠뜨리기 쉽다.
- **표와 코드를 테스트로 잇는다**: 이 문서의 표와 `assertProductionConfig` 사이에 대조하는 장치가 없어서, 검사를 더하고 표를 고치지 않아도 알 수 없었다. 이제 단위 테스트가 함수가 읽는 환경 변수를 기록해 표의 첫 열과 견준다. 테스트는 저장소의 스펙 미러를 읽는다. 그래서 검사를 더한 코드는 표에 행을 더한 스펙이 승인되고 미러를 받기 전까지 단위 테스트를 통과하지 못한다. 스펙보다 코드가 먼저 머지되지 않게 하려는 의도다.

### `INTERACTION_JWT_SECRET` 을 운영 환경 가드에 더했다 (2026-11-06)

[운영 환경 가드](#운영-환경-가드) 표에 행을 더하고 「가드에 넣는 것과 넣지 않는 것」 의 예시를 고쳤다. 요구사항 줄은 [External Interaction API](../CLE-IX/CLE-EIA.md)  쪽 요구사항 줄을 고쳤다(번호는 [상위 문서 「하위 문서」](CLE-ACCT-SESSION.md#하위-문서)). 서명 비밀의 쓰임과 대체 순서를 정하는 문서가 그쪽이라 이 문서에 새 요구 번호를 받지 않았다.

- **무엇이 빠져 있었나**: 예전 운영 가드는 `INTERACTION_JWT_SECRET` 과 `JWT_SECRET` 이 모두 없을 때만 부팅을 막았다(생성자 예외). `INTERACTION_JWT_SECRET` 을 설정했으면 값이 `.env.example` 의 예시 값이든 공백뿐이든 짧든 그 값으로 실행 단위 토큰(`iext_*`)에 서명했다. 이 토큰을 위조하면 남의 실행에 입력을 보내거나 실행을 취소할 수 있다. `JWT_SECRET` 과 위험의 성격이 같은데 규칙은 훨씬 느슨했다.
- **결정을 바꾼 이유**: [운영 환경 가드를 한 함수에 모은다](#운영-환경-가드를-한-함수에-모은다) 는 이 항목을 DI 컨텍스트가 필요하다며 일부러 뺐다. 그 전제가 맞지 않았다. 서명 비밀은 환경 변수 둘로 정해진다. `INTERACTION_JWT_SECRET` 이 있으면 그 값이고, 없으면 `JWT_SECRET` 인데 그 값은 이 함수가 이미 검사한다. 그래서 「환경 변수만으로 부팅 직전에 판정할 수 있다」 는 이 함수의 기준을 만족한다. 같은 함수에 두면 `JWT_SECRET` 과 같은 규칙(앞뒤 공백을 뗀 값, 예시 값 목록, 32자 하한)을 함께 쓰고, 표와 코드를 대조하는 단위 테스트가 이 항목도 지킨다.
- **변수가 없으면 검사하지 않는다**: 없으면 `JWT_SECRET` 으로 서명하므로 `JWT_SECRET` 행이 그 경우를 막는다. 같은 값을 두 번 검사하지 않는다.
- **빈 문자열은 막는다**: 서명 비밀을 고르는 코드는 `??` 로 대체하므로 빈 문자열을 `JWT_SECRET` 으로 대신하지 않는다. 그래서 빈 값은 예전에도 생성자 예외로 운영 부팅이 막혔다. 이 가드도 같은 값을 막아 동작이 바뀌지 않는다.
- **생성자 예외는 남긴다**: `main.ts` 를 거치지 않고 모듈을 띄우는 경로(테스트 · 스크립트)에서 서명 비밀 없이 운영 모드로 뜨지 않게 하는 마지막 방어다.
- **배포 영향**: 운영에서 쓰던 `INTERACTION_JWT_SECRET` 이 이 가드에 걸리면 서버가 기동하지 않는다. 서명 비밀을 새로 만들어야 하고, 바꾸면 이미 발급한 `iext_*` 는 모두 검증에 실패한다.

기각한 대안:

- **생성자에 같은 검사를 더한다**: 규칙이 `assertProductionConfig` 와 생성자 두 곳으로 갈린다. 표와 코드를 대조하는 단위 테스트도 이 항목을 보지 못한다.
- **빈 값을 `JWT_SECRET` 으로 대신 쓰게 바꾼다(`??` 를 `||` 로)**: 서명 비밀의 대체 순서를 바꾸는 일이라 이번 범위 밖이다. 이 Task 는 서명 방식과 대체 순서를 바꾸지 않는다.
