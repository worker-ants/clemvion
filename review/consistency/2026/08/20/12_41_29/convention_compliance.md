# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-inputdata-egress-masking.md`

## 검토 범위 메모

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 중 실제 본문이 실린 것은
`audit-actions.md`·`cafe24-api-catalog/**`(대부분 title-only stub) 뿐이었고, 이 draft 와
직접 관련 있는 `error-codes.md`·`secret-store.md`·`execution-context.md`·`swagger.md`·
`spec-impl-evidence.md` 등은 예산 초과로 절단돼 있었다. 해당 파일들은 저장소에서 직접
읽어(`spec/conventions/*.md`) 검토를 보완했다. 아울러 CLAUDE.md 가 요구하는 "문서 구조 규약"
판단을 위해 `plan/complete/spec-draft-*.md` 및 `plan/in-progress/spec-draft-eia-*.md` 형제
문서 다수를 표본으로 대조했다.

## 발견사항

- **[INFO]** `## Overview` 섹션 부재 — 혼재 관행이라 목적문의 이탈이 아님
  - target 위치: 문서 최상단, 제목(`# spec draft — ...`) 직후 바로 `## 미러 전수 — 세지
    말고 훑었다` 로 진입 (Overview 섹션 없음)
  - 위반(권고) 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 각
    SKILL.md 참고
  - 상세: `plan/complete/spec-draft-eia-error-masking-catalog.md`(같은 §R17 계보의 직전
    완결 문서)와 형제 in-progress 문서 `spec-draft-eia-62-waiting-payload.md` 는 제목 직후
    명시적 `## Overview` 헤딩을 둔다. 반면 이 draft 의 **가장 가까운 직계 선행 문서**인
    `plan/complete/spec-draft-eia-fanout-masking.md`(같은 R17 "카브아웃 vs 마스킹" 논의의
    바로 전 라운드)와 또 다른 형제 `spec-draft-eia-notification-payload-contract.md` 는
    `## Overview` 없이 바로 본문 논증(`## 왜` / `## 변경 1`)으로 들어간다. 즉 이 저장소의
    `spec-draft-*.md` 산출물 자체가 이미 두 패턴이 혼재하며, 이를 강제하는 build guard 도
    없다(`plan-frontmatter.test.ts` 는 frontmatter 3필드만 검사, 섹션 구조는 보지 않는다).
    target 은 후자(Overview 생략) 패턴을 따랐고, 이는 target 만의 이탈이라기보다 기존에도
    허용되던 관행이다.
  - 제안: 강제 사항은 아니나, 일관성을 위해 제목 직후 1~2문단짜리 `## Overview` 를 추가해
    "무엇을·왜 지금 뒤집는가" 를 요약하면 독자가 본문(미러 전수 표)에 들어가기 전 맥락을
    얻는다. 규약 쪽을 갱신할 필요는 없다 — 이미 "권장" 수준이고 두 패턴 다 실제로 쓰인다.

- **[INFO]** swagger.md §3 예외 조항이 정확히 겨냥하는 DTO 서술이 이 전환으로 뒤집히는데,
  draft 는 "식별자 삭제" 까지만 지시하고 "재작성 형태" 는 지시하지 않음
  - target 위치: Rationale 상단, `MASKED_INPUT_DATA_REASON` 처리 각주
    (`developer 턴이 6개 참조처를 전수 삭제한다`)
  - 관련 규약: `spec/conventions/swagger.md` §3 "예외 — 보안·정책 캐비엇 (2026-08-17 규약화)"
    — 값-패턴 마스킹 대상이라 "저장된 값과 다를 수 있는" 필드의 `@ApiProperty` 설명은 길이
    제한 예외를 받되 "상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크" 로
    적으라고 명시하며, 실례로 정확히 `execution-response.dto.ts`·
    `background-run-response.dto.ts` 를 든다.
  - 상세: 오늘 기준 `execution-response.dto.ts` 의 `inputData` JSDoc 은
    `"**값-패턴 마스킹 대상이 아니다**" (근거: MASKED_INPUT_DATA_REASON)` 형태다. 전환 후
    `Execution.inputData` 는 (`outputData`/`error` 형제 필드처럼) **처음으로** 이 swagger
    예외 조항이 규정하는 "요약 1~2문장 + SoT 링크" 패턴을 따라야 하는 쪽으로 뒤집힌다.
    draft 의 Rationale 은 죽은 식별자 참조 제거만 언급하고, 그 자리를 무엇으로 채워야
    하는지(형제 필드와 동형의 마스킹 캐비엇 문구로 재작성)는 명시하지 않는다.
  - 제안: 이 자체는 spec 범위(코드 DTO) 밖이라 target 위반은 아니지만, developer 턴으로
    넘어갈 때 "빈 자리" 로 방치되지 않도록 draft 의 ② 또는 Rationale 에 "DTO JSDoc 은
    swagger.md §3 형식(요약+SoT 링크)으로 재작성한다" 한 줄을 남겨 두면 인수인계 유실을
    막는다.

## 준수 확인된 항목 (참고)

- `spec-draft-*.md` 파일명 패턴 — `plan/{in-progress,complete}` 에 60건 이상의 선례와 일치.
- frontmatter 필수 3필드(`worktree`/`started`/`owner`) 및 `priority`/`status`/`spec_impact`
  선택 필드 — `.claude/docs/plan-lifecycle.md §4` 스키마 준수. `spec_impact` 는 리스트
  형태로 실존 spec 경로 7개(§4 표와 정확히 일치).
- `code:` frontmatter 확장 제안(`rerun-modal.tsx`→`13-replay-rerun.md`,
  `rerun-modal.tsx`+`editor-toolbar.tsx`→`14-external-interaction-api.md`) — 두 파일 모두
  실존 확인. `14-external-interaction-api.md` 가 이미 프런트엔드 파일
  (`dynamic-form-ui.tsx`)을 `code:` 에 섞어 두는 선례(#1181)와 같은 패턴.
- §R17 표면 번호 표기(아라비아 숫자 vs "잔여 ①②③" 원형숫자) 혼용 금지 — draft 스스로
  "(INFO: 아라비아 숫자 유지…)" 로 이 구분을 명시적으로 지키고 있음. 규약 준수 인식이
  드러남.
- 역할 경계 — `MASKED_INPUT_DATA_REASON` 등 코드 식별자 정리는 developer 턴에 위임하고
  draft 자신은 `spec/**` 서술만 바꾼다 (CLAUDE.md "spec/ 변경→planner, codebase/ 변경→
  developer" 원칙 준수).
- `error-codes.md`/`secret-store.md` — 이 draft 가 다루는 마스킹 마커(`***`)는 두 규약이
  규정하는 대상(에러 코드 명명, secret URI scheme)과 레이어가 다르며 draft 는 그 경계를
  침범하지 않는다.

## 요약

target 문서는 이 저장소의 `spec-draft-*.md` 관행(파일명, frontmatter 스키마, `code:` 경로
확장, §R17 표기 규율)을 충실히 따르고 있고, `spec/conventions/**` 를 직접 위반하는 지점은
발견되지 않았다. `## Overview` 섹션 생략은 CLAUDE.md 의 권장 3섹션 구조에서 벗어나 보이지만
같은 계보의 직전 문서도 동일 패턴이라 저장소 관행 안에 있는 이탈이며, swagger.md §3 예외
조항이 곧 적용 대상이 바뀌는 DTO 재작성 지침 누락은 spec 범위 밖의 인수인계 리스크로 INFO
수준이다. 둘 다 CRITICAL/WARNING 으로 볼 근거(강제 가드 위반, 명시적 금지 패턴 답습)가 없다.

## 위험도

LOW
