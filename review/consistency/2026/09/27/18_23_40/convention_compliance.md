# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done)

검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`). 대상 정식 규약: `spec/conventions/**`.

## 검토 범위와 방법

이번 라운드는 `spec/2-navigation/` 자체의 신규 변경이 **0개 파일**이라, 검토 축을 두 갈래로 잡았다:

1. **구현 diff(19개 파일/1081줄)** — `git -C <worktree> diff origin/main` 로 직접 열람. 특히
   `common/utils/optional-non-null.ts`(신설 `IsOptionalNonNull` 데코레이터)와 그것을 쓰는
   `update-trigger.dto.ts` · `update-workflow.dto.ts` · `update-folder.dto.ts` · `update-schedule.dto.ts` ·
   `update-knowledge-base.dto.ts` · `update-model-config.dto.ts` (뒤 두 파일 제외하고 전부 `spec/2-navigation/`
   문서가 SoT 로 잡는 모듈)를 `spec/conventions/swagger.md` · `error-codes.md` 원문과 문장 단위로 대조했다.
2. **`spec/2-navigation/` 기존 서술** — `1-workflow-list.md` · `2-trigger-list.md` 를 diff 가 건드린 API
   표면(`endpointPath`, 폴더/워크플로 PATCH)과 대조해 이번 구현이 spec 서술과 여전히 부합하는지, 그리고
   spec 자체가 `spec/conventions/**` 표기 규약(에러 코드 표기·DTO 명명 인용 등)을 유지하는지 확인했다.

`review/code/2026/09/27/17_47_49` (1R) · `18_13_53` (2R) 코드 리뷰가 이미 기능·보안·테스트 관점을 훑었고
Critical 0 · Warning 0 로 수렴했다(2R `documentation.md`) — 본 보고서는 그와 **다른 렌즈**(정식 규약
문언과의 축자 대조)만 추가한다.

## 대조한 정식 규약

`swagger.md`(§1-3·§1-4·§1-7·§3 보안·정책 캐비엇·§5) · `error-codes.md`(§1) ·
`spec/5-system/2-api-convention.md §5.3·§5.4`(참조용 — SoT 층위 확인) · `spec-impl-evidence.md`(§2.1 `code:` 의무).

## 발견사항

- **[WARNING] `endpointPath` null-거부 캐비엇이 §3 "보안·정책 캐비엇" 의 SoT-링크 패턴을 따르지 않음**
  - target 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` — `endpointPath`
    필드의 JSDoc(신설 3줄) 및 `@ApiPropertyOptional({ description: … })` 말미에 붙은
    "`null` 은 400 `VALIDATION_ERROR` — 경로를 유지하려면 키를 생략한다." (커밋 `e5de5226c`, 1R WARNING #2 조치)
  - 위반 규약: `spec/conventions/swagger.md` §3 "반드시 적는다 — 보안·정책 캐비엇" — "**요청** 값이 정책으로
    거부될 수 있는 필드(예약어·재제출 금지 값 등)" 는 "다만 **상세 근거는 spec 본문에 두고 여기서는 요약
    1~2문장 + SoT 링크**로 적는다" 를 요구한다.
  - 상세: `endpointPath` 는 PATCH 로 null 을 보내면 전에는 200 과 함께 webhook 수신 경로가 조용히
    지워지던(§3의 "예약어·재제출 금지 값" 과 동류의 *비직관적 거부*) 필드라 이 캐비엇 조항의 대상이
    맞는데, 추가된 문장은 SoT 링크 없이 완결 서술로만 존재한다. 같은 트리거 도메인의 자매 필드
    (`chat-channel-config.dto.ts` 의 `botTokenRef`/`inboundSigningRef` — `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)
    는 "SoT: `spec/conventions/secret-store.md §5.5`" 처럼 규약 링크를 명시적으로 붙이는 것이 이 저장소의
    확립된 관례다. 그리고 이 캐비엇이 가리켜야 할 spec 쪽 착지점(`spec/2-navigation/2-trigger-list.md`
    §2.3.1 `endpointPath` 행)은 여전히 409 `RESOURCE_CONFLICT`(UNIQUE·예약 충돌)만 서술하고, 이번에 새로
    생긴 400 `VALIDATION_ERROR`(null 거부) 캐비엇은 **적혀 있지 않다** — 링크를 붙이고 싶어도 현재는
    붙일 spec 본문 근거 자리가 없다.
  - 제안: (a) `2-trigger-list.md` §2.3.1 `endpointPath` 행에 한 문장 추가 — "`null` 은 400
    `VALIDATION_ERROR`(경로 유지하려면 키 생략)" 및 API 규약 §5.4 PATCH tri-state 인용, (b) DTO 의
    Swagger `description` 은 그 문장 + `[API 규약 §5.4]` 또는 위 spec 앵커로의 링크로 축약. 다만 이 캐비엇
    자체가 한 문장으로 완결돼 실질적 오독 위험은 낮으므로, 굳이 갱신하지 않고 현행을 유지하려면 그
    판단(“1문장 이내는 링크 생략 허용”)을 §3 캐비엇 조항에 명문화하는 것도 대안이다.

- **[INFO] 신규 회귀 테스트가 `repo-guards/__tests__/` 의 지배적 AST-가드 페어링 패턴과 다른 형태**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts` (신설, 43케이스
    표 기반 `class-validator` 런타임 검증)
  - 위반 규약: 명문 조항은 없음 — `spec/conventions/swagger.md` 가 이 디렉토리를 반복 인용하며 "정규식이
    아니라 AST 인 이유는…" 식으로 설명하는 **경험적 패턴**(디렉토리 내 기존 18개 항목이 전부
    `<name>-guard.ts`(AST 파서 구현) + `<name>.spec.ts`(그 가드를 호출하는 테스트) 페어)과의 형태 차이.
  - 상세: 이 신규 파일은 소스를 AST 로 파싱하는 가드가 아니라, 13개 DTO를 직접 import 해 `validate()` 로
    43개 필드의 null 거부/키생략 허용을 표로 재확인하는 **런타임 동작 회귀 테스트**이고, 짝이 되는
    `-guard.ts` 파일이 없다. 다만 같은 디렉토리에 이미 `esm-native-load.spec.ts` (가드 파일 없이 런타임
    실측만 담는 전례)가 있어 **완전한 예외는 아니다** — "저장소 전역 불변식을 고정하는 회귀 테스트의
    보관소" 라는 넓은 해석에서는 이 파일도 그 결에 든다.
  - 제안: 조치 불요에 가깝다(전례 존재). 다만 다음에 이 종류(런타임 표-기반 회귀)의 테스트를 또 추가할
    때는 `repo-guards/__tests__/` 대신 `common/utils/optional-non-null.spec.ts` 같은 도메인 근접 위치를
    우선 검토하거나, 이 디렉토리의 실제 역할(AST 가드 전용이 아니라 "저장소 전역 불변식 회귀 스위트"임)을
    `swagger.md` 어딘가에 한 문장으로 명문화해 다음 사람이 폴더 이름만 보고 오독하지 않게 하는 편이 낫다.

## 대조해 확인한 준수 사례 (관찰 — 위반 아님)

- **`swagger.md` §5.4 PATCH tri-state 와 신설 `IsOptionalNonNull` 의 경계**: 유틸 자체의 JSDoc이
  "쓰지 말아야 할 자리: 컬럼이 nullable 이고 `null` 이 값을 지운다는 뜻인 필드 — 거기는 `@IsOptional()` +
  `nullable: true` 가 맞다(API 규약 §5.4 의 PATCH tri-state)" 라고 명시해 규약의 tri-state 정의(생략=유지·
  `null`=초기화·값=설정)와 정확히 같은 경계선을 긋는다. 실제 diff 도 이 경계를 지켰다 — 예:
  `update-model-config.dto.ts` 의 `defaultParams`(열린 map, §1-4 대상)와 `update-schedule.dto.ts` 의
  `parameterValues` 는 여전히 값 자체는 `@IsOptional()`+구조 그대로이고, `IsOptionalNonNull` 은 각 DTO의
  **NOT NULL 컬럼**(name/isActive/tags/sortOrder 등)에만 적용됐다.
- **`error-codes.md` §1 (의미 기반·`UPPER_SNAKE_CASE`·prefix-less 공용 코드)**: 이번 fix 가 새로 노출하는
  코드는 `VALIDATION_ERROR` 하나뿐이고, 이는 §1 이 "시스템 전역 공용 코드"로 명시한 prefix-less 예외
  범주와 정확히 일치한다. 새 도메인 특화 코드를 신설하지 않아 §2 rename 안정성 정책과도 충돌하지 않는다.
- **`CustomValidationPipe` 의 `details[].code` 형태(`spec/5-system/2-api-convention.md §5.3`)**:
  `IsOptionalNonNull` 이 던지는 커스텀 메시지도 파이프를 그대로 통과하므로 `{ field, message,
  code: 'INVALID_FIELD' }` 형태가 그대로 유지된다 — `2-trigger-list.md` §2.3.1 이 이미 문서화한
  `inboundSigningPlaintext`/`botTokenRef` PATCH 차단 캐비엇과 **동일 형태**라 신규 불일치가 없다.
- **`swagger.md` §1-7 (`Update` 접두 범위)**: 이번에 손댄 DTO(`UpdateTriggerDto` · `UpdateWorkflowDto` ·
  `UpdateFolderDto` · `UpdateScheduleDto` · `UpdateKnowledgeBaseDto` · `UpdateModelConfigDto`)는 전부
  top-level 요청 바디 DTO로 그대로 유지되고, 신설 `IsOptionalNonNull` 은 클래스가 아니라 property
  데코레이터라 §1-7 명명 범위와 무관하다.
- **에러 메시지 언어**: `IsOptionalNonNull` 의 커스텀 메시지("`$property must not be null …`")는 영어인데,
  `spec/5-system/2-api-convention.md §5.3` 의 정본 예시 JSON 도 `"message": "Workflow name is required"` 로
  영어를 쓴다 — 한국어 강제 조항(그런 조항은 `swagger.md` §3 의 JSDoc/설명 톤에만 있고 class-validator
  런타임 메시지에는 없음) 위반이 아니다.
- **`spec-impl-evidence.md` §2.1 `code:` 의무**: 신설 `common/utils/optional-non-null.ts` 는 여러 도메인이
  공유하는 cross-cutting 유틸이라 `1-workflow-list.md`/`2-trigger-list.md` 등 개별 문서의 `code:` 글로브에
  추가로 등재될 의무는 없다(§2.1 요건은 "≥1 매치"이며, 기존에도 `common/pipes/validation.pipe.ts` 같은
  공유 계층은 개별 nav 문서 `code:` 에 등재되지 않는 것이 기존 관례).
- **`spec/2-navigation/` 델타 0**: 이번 diff 는 `spec/2-navigation/` 문서를 전혀 바꾸지 않았다. 이는
  스코프-절단 고지가 명시한 대로 "코드 전용 PR" 의 정상 상태이며, 그 자체를 CRITICAL 근거로 쓰지 않았다.

## 요약

이번 PATCH null-검증 구현은 `spec/conventions/swagger.md`·`error-codes.md` 가 정한 PATCH tri-state 경계·
에러 코드 명명·`details[]` 형태를 정확히 지켰고, 이미 2라운드 코드 리뷰(Critical 0·Warning 0)를 통과했다.
본 검토가 다른 렌즈에서 새로 찾은 것은 **WARNING 1건**(`endpointPath` null-거부 캐비엇이 §3 이 요구하는
"요약+SoT 링크" 패턴 중 링크 축을 빠뜨렸고, 그 링크가 가리킬 spec 본문(`2-trigger-list.md` §2.3.1)도
아직 이 캐비엇을 담지 않음)과 **INFO 1건**(신규 회귀 테스트의 `repo-guards/__tests__/` 배치가 그 디렉토리의
지배적 AST-가드 페어링 관례와 형태가 다르나, 완전한 전례 없음은 아님)뿐이다. `spec/2-navigation/` 자체는
이번 diff 로 손대지 않았고, 기존 서술(§2.3.1 의 `inboundSigningPlaintext`/`botTokenRef` 캐비엇 등)은
규약과 문자 그대로 일치했다.

## 위험도

LOW
