# 정식 규약 준수 검토 — `spec/5-system/` (impl-prep)

## 검토 범위 및 방법

- 검토 모드: `--impl-prep`, target `spec/5-system/` (18개 파일 + `_product-overview.md`).
- 대조 대상: `spec/conventions/**` (egress-masking, audit-actions, error-codes, node-output, swagger 등 전문 확인. cafe24/makeshop 카탈로그류는 본 target 과 무관해 스코프 제외).
- 프롬프트 예산 초과로 15개 파일 본문이 생략되어, 관련도가 높은 파일(`1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, `12-webhook.md`, `4-execution-engine.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `_product-overview.md`)은 저장소에서 `Read` 로 직접 열어 확인했다.
- 현재 워크트리(`masked-marker-test-gaps-b5e5a8`)는 `main` 대비 2개 커밋(`bdcfdc514` egress-masking 규약 신설, `923b5892e` 코스메틱 4건)이 이미 앞서 있고, 금번 plan(`masked-marker-test-gaps.md`)은 `spec_impact: none`(테스트 전용)이다 — 즉 이번 게이트는 **신규 spec 변경**이 아니라 구현 착수 전 **기존 target 번들이 정식 규약과 정합한지**를 확인하는 성격이다.

## 발견사항

### [INFO] `spec/5-system/*.md` 6개 파일에 `## Overview` 섹션 헤더 부재

- target 위치: `spec/5-system/2-api-convention.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md` — frontmatter 직후 `> 관련 문서: ...` 줄만 있고 바로 `## 1. ...`(본문)로 진입한다.
- 위반 규약: `.claude/skills/project-planner/SKILL.md` §"단일 진실 원칙"("각 spec 문서는 3섹션 (Overview / 본문 / Rationale)")·§"섹션" 표(`## Overview (제품 정의)` / 본문 / `## Rationale`). CLAUDE.md 도 "Spec 문서 3섹션 구성 … 권장"으로 동일 원칙을 가리킨다.
- 상세: 같은 폴더의 `1-auth.md`(`## Overview` at L54)·`3-error-handling.md`(`## Overview` at L1372)는 섹션을 갖춘 반면, 위 6개 파일은 `## Rationale` 은 있으나 `## Overview` 가 없다. `_product-overview.md` 는 영역 전체의 Overview 를 별도 파일로 가지므로 예외가 합리적이지만(SKILL.md "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"), 그 규정은 "영역 전체" Overview 를 말하는 것이지 개별 spec 파일의 자기-소개 Overview 를 면제한다고 명시하지 않는다 — 그래서 같은 조건(다중 파일 영역)인 `1-auth.md`/`3-error-handling.md` 는 그럼에도 자체 Overview 를 갖췄다. 즉 폴더 내부에서도 관행이 일관되지 않는다.
- 이번 diff 로 신규 도입된 문제는 아니다(pre-existing) — 금번 plan 은 `spec_impact: none` 이라 이 6개 파일 중 어느 것도 이번에 손대지 않았고, 심사 대상 결정(masked marker 재제출 거부 테스트)과 직접 관련도 없다. impl-prep 차단 사유로 볼 근거는 없다.
- 제안: 차단 사유는 아니므로 이번 PR 은 그대로 진행. 추후 spec 정리 라운드에서 6개 파일에 짧은 `## Overview` 단락(현재 도입부 문장을 승격)을 추가하거나, SKILL.md §"섹션" 표에 "단일 파일이 개요+본문을 겸할 만큼 짧은 문서는 Overview 헤더 생략 가능"이라는 예외를 명문화해 관행과 규약을 맞출 것.

## 준수 확인 (검토 근거로 남김)

이번 diff(`bdcfdc514`·`923b5892e`, spec_impact 관련 실질 변경분)와 그 대상이 참조하는 conventions 를 교차 검증했고, 아래는 모두 규약을 준수한다:

- **신설 `spec/conventions/egress-masking.md`**: frontmatter(`id`/`status`/`code`) 패턴이 `audit-actions.md`·`error-codes.md` 등 기존 convention 문서와 일치. `## Overview` → 본문(§1~§3) → `## Rationale`(신설 배경 + 기각 대안) 3섹션 구조를 정확히 따른다.
- **"마커 리터럴 금지" 자기 규율**: 문서 스스로 선언한 "본 문서는 마커 리터럴을 적지 않는다"를 실제로 지킨다(`VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER` 이름으로만 지칭, 값 미기재). 반면 `12-webhook.md`/`14-external-interaction-api.md`/`5-expression-language.md`/`4-execution-engine.md`/`6-websocket-protocol.md` 는 `[REDACTED]` 등 리터럴을 그대로 적는데, 이는 egress-masking.md 가 명시한 예외("EIA 는 wire 계약 서술이라 정상") 와 같은 레이어(관측 가능한 wire 값 서술)이므로 규약 위반이 아니다.
- **SoT 분리 무결성**: `egress-masking.md`(좌표계) / `14-external-interaction-api.md §R17`(정책·범위) / `error-codes.md §4.2`(details[].code 정규화) / `node-output.md`(echo 금지) 4곳이 서로를 정확한 앵커로 포인터 참조하며 순환 재선언이 없다.
- **에러 코드 명명**: 신규/변경된 `MASKED_VALUE_RESUBMITTED`(`error.details[].code`), `INVALID_TRIGGER_PARAMETERS`(re-run 경로 흡수) 모두 `UPPER_SNAKE_CASE`·의미 기반 명명 원칙(`error-codes.md §1`)을 따르고, rename 은 `error-codes.md §5` 의 "등급 B(잔여 위험 인수)"로 정식 등재되어 있다.
- **audit-actions 정합**: `1-auth.md §4.1` 액션 카탈로그가 `conventions/audit-actions.md §3` 레지스트리와 표기(dot-prefix, 언더스코어 토큰, 시제 분류)까지 1:1 일치. 앵커(`#41-기록-대상-액션` 등) 전수 확인, 깨진 참조 없음.
- **manual-trigger ↔ 5-system 교차 정합**: `spec/4-nodes/7-trigger/1-manual-trigger.md §6`(masked 재제출 거부 2-phase 검증 시점·`throwIfAny`가 구현하는 트레이드오프)이 EIA §R17·error-codes §4.2 와 정확히 부합해, 금번 plan 이 겨냥하는 코드 좌표(phase 경계·`resolveTriggerParametersRejectingMasked`)가 spec 상에서도 동일하게 서술돼 있다 — 신규 테스트가 잘못된 상수/경계를 겨냥할 위험이 낮다.
- **swagger/DTO 패턴**: `2-api-convention.md §5.1~§5.4`(응답 봉투·비페이징 컬렉션·null vs 키 생략)이 `swagger.md §1-3·§2-5·§6` 을 정확한 앵커로 인용하며 모순 없음.
- **파일·문서 명명**: `spec/5-system/<n>-<slug>.md` 넘버링·kebab-case, `_product-overview.md` 언더스코어 prefix, `../0-overview.md` 루트 진입점 참조 모두 CLAUDE.md 명명 컨벤션을 따른다.

## 요약

target(`spec/5-system/`)은 `spec/conventions/**` 전반에 대해 매우 높은 수준으로 정합하다. 이번 plan 이 실질적으로 새로 들여온 spec 변경(egress-masking 규약 신설 + `14-external-interaction-api.md`/`6-websocket-protocol.md`/`node-output.md` 포인터 추가)은 SoT 분리·명명·마커 리터럴 금지 자기 규율·앵커 유효성 모두를 만족하며 CRITICAL/WARNING 급 위반이 없다. 유일한 발견은 `spec/5-system/*.md` 6개 파일이 3섹션(Overview/본문/Rationale) 구조 중 `## Overview` 헤더를 생략한 pre-existing 구조적 비일관성으로, 이번 diff 나 이번 구현 착수 대상과 무관해 INFO 로 낮춰 등재했다. `--impl-prep` 게이트를 차단할 사유는 없다.

## 위험도

LOW
