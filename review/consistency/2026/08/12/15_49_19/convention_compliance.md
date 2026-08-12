# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-r8-alignment.md`

## 검토 범위 및 방법

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 텍스트는 컨텍스트 예산 초과로 대부분 절단되어 있었다(`error-codes.md`, `spec-impl-evidence.md`, `swagger.md`, `execution-context.md`, `interaction-type-registry.md` 등 target 과 관련 높은 문서 전부 포함). 이는 기존에 기록된 "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 문제와 동일 패턴이라, 번들 대신 저장소의 실제 파일(`spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`)을 직접 읽어 대조했다. 아울러 target draft 가 수정을 제안하는 실제 spec 원문(`spec/data-flow/15-external-interaction.md`, `spec/5-system/14-external-interaction-api.md`)과 관련 구현 코드(`idempotency.interceptor.ts`)도 직접 열어 diff 앵커의 정확성을 확인했다.

## 발견사항

- **[INFO]** 변경4 블록의 `>` 표기가 "삽입할 문장 인용"인지 "실제 blockquote 마크업 삽입"인지 모호
  - target 위치: `## 변경 4` — "§R8 채택 문단 끝에 한 문장 추가:" 다음의 `>` 인용 블록, "Rationale 보강" 다음의 `>` 인용 블록
  - 위반 규약: 특정 조항 위반은 아니며 문서 포맷 일관성 관점의 제안. `spec/5-system/14-external-interaction-api.md` 의 `## Rationale` 항목들(R1~R15)은 전부 `**채택**: ...` / `**근거**: ...` 형태의 평문 단락이고 `>` blockquote 를 본문 서술에 섞어 쓰지 않는다(예외: 메타성 캐빗 노트에서만 `>` 사용, 예: 같은 문서 §5 서두의 과거 표기 정정 노트).
  - 상세: 변경1~3 은 명시적 `` ```diff `` 블록으로 삽입 위치·문자열을 정확히 지정하는 반면, 변경4 는 산문 지시("문단 끝에 한 문장 추가")와 `>` 인용을 섞어, 실행자가 "이 인용 텍스트를 그대로(마크다운 blockquote 문법 포함) R8 본문에 삽입"하는지 "이 문장 내용만 채택 단락 끝에 이어붙이라"는 것인지 헷갈릴 여지가 있다. R8 항목이 지금 blockquote 없는 평문 단락(`**채택**: ...`, `**근거**: ...`)이므로, 실제 편집 시 blockquote 문자(`>`)가 그대로 들어가면 같은 Rationale 항목 안에서 유일하게 이질적인 포맷이 된다.
  - 제안: 변경4 도 변경1~3 처럼 `` ```diff `` 형태로 앞뒤 문맥과 함께 표기하거나, `>` 대신 "다음 문장을 그대로 이어붙인다" 식의 지시어를 덧붙여 blockquote 마크업이 아님을 명확히 한다. (규약 자체 갱신은 불필요 — target 표현만 다듬으면 됨.)

## 점검했으나 위반 없음으로 확인된 항목 (참고)

- **명명 규약**: `VALIDATION_ERROR`(UPPER_SNAKE_CASE, prefix-less 시스템 전역 공용 코드) 표기는 `error-codes.md §1` 및 실제 `error-codes.ts`(`VALIDATION_ERROR: 'VALIDATION_ERROR'`)와 정확히 일치. 새로 도입하는 코드명·엔드포인트명은 없음.
- **출력 포맷 규약**: 5xx 캐시 제외 서술(변경4)은 `5-system/2-api-convention.md §6` 상태 코드 표(500/503 이 이 API 계열에서 실제 사용되는 상태임을 확인)와 모순되지 않음. `interaction:idempotency:<key>` 등 기존 Redis 키·헤더 명은 손대지 않음.
- **문서 구조 규약**: `spec/data-flow/15-external-interaction.md` 는 `spec-impl-evidence.md §1` 에서 frontmatter 의무 대상에서 명시적으로 제외된 영역(`spec/data-flow/**`) — 변경1~3 이 frontmatter 를 건드리지 않는 것은 정합. `spec/5-system/14-external-interaction-api.md` 는 이미 `id`/`status: partial` frontmatter 보유, draft 는 frontmatter 를 변경하지 않음. 두 문서 모두 Overview/본문/Rationale 구조를 유지한 채 기존 절(§1.2 시퀀스, §외부 의존 표, `## Rationale`, `### R8`) 내부만 편집 — 신규 절 신설이나 구조 이탈 없음.
- **plan frontmatter**: `spec_impact:` 가 YAML 리스트(2개 경로)로 선언되어 Gate C(`spec-impl-evidence.md §R8`, "리스트 또는 no-op sentinel, bare string 금지") 요건과 일치. 두 경로(`spec/data-flow/15-external-interaction.md`, `spec/5-system/14-external-interaction-api.md`) 모두 실존 확인.
- **API 문서 규약(Swagger)**: draft 는 컨트롤러 데코레이터·DTO 를 전혀 건드리지 않는다(순수 spec 서술 정정) — swagger.md 규칙(§2-4, 열린 map 예외 등)이 적용될 변경 자체가 없음.
- **금지 항목**: 변경2 의 콜아웃에서 "spec/** → plan/in-progress/** 링크는 spec-link-integrity 를 깨뜨리므로 걸지 않는다"고 명시적으로 회피 — `spec-impl-evidence.md §4.2` 의 `spec-link-integrity.test.ts` 서술(spec 본문 스캔은 target 필터 없이 `plan/**` 링크까지 검사하며 plan 이동 시 build 가 깨진다)과 정확히 일치하는 판단. 새 diff 텍스트가 인용하는 target 원문(§1.2 L98, §외부 의존 표 L258, Fail-open Rationale 절, R8 채택/근거 단락)은 전부 실제 저장소 원문과 문자 단위로 일치함을 확인 — 앵커 오류 없음.
- **사실 정합성 보강 확인(참고, 본 리뷰 범위 밖이지만 규약 판단에 영향)**: 언급된 구현 갭("`statusCode >= 400` 이 409·410 까지 떨군다")은 `idempotency.interceptor.ts` L144-156 주석에 이미 "선재 결함" 으로 명시적으로 기록돼 있어 draft 의 서술과 정합.

## 요약

target(`plan/in-progress/spec-draft-eia-r8-alignment.md`)은 `spec/conventions/error-codes.md`(명명), `spec/conventions/spec-impl-evidence.md`(frontmatter·Gate C·영역별 frontmatter 면제), 그리고 문서 전반의 SoT 분리 패턴(5-system=규범, data-flow=운영 카탈로그)을 정확히 이해하고 그 경계를 지키며 작성됐다. 제안된 4개 diff 는 모두 실제 target 원문과 정확히 대응하고, 새로 도입하는 이름·코드·포맷이 없어 명명/출력포맷/API문서 규약과 충돌할 표면 자체가 없다. 유일한 지적은 변경4 의 `>` 표기가 삽입 지시인지 인용인지 모호한 문서화 스타일 이슈(INFO)뿐이며, 이는 규약 위반이 아니라 실행자 편의를 위한 표현 개선 제안이다.

## 위험도
NONE
