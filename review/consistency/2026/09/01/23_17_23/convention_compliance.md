# 정식 규약 준수 검토 — `spec/conventions/error-codes.md`

## 검토 범위

- `spec/conventions/` 델타는 `spec/conventions/error-codes.md` 1개 파일, 12줄 변경(추가 11 / 삭제 1)뿐이다
  (`git diff origin/main...HEAD -- spec/conventions/` 로 확인).
- 변경 내용: `## Overview` 의 "적용 범위" 문단을 정정하고, `ErrorCode`/`EngineErrorCode` 가 같은 파일
  (`codebase/backend/src/nodes/core/error-codes.ts`)의 **자매 const** 라는 사실을 새 문단 2개로 설명.
- 프롬프트 번들의 "구현 diff"(frontend `spec-links.test.ts` / `stray-tool-tags.test.ts`)는 이 spec 파일의
  `code:` 대상과 무관한 별개 작업이라 본 검토 범위 밖으로 판단했다(frontmatter `code:` 는
  `nodes/core/error-codes.ts` 하나만 가리킴 — 변경 없음).

## 검증 방법

- `codebase/backend/src/nodes/core/error-codes.ts` 를 절대경로로 직접 읽어 `ErrorCode`/`EngineErrorCode`
  가 실제로 같은 파일의 자매 `const` 인지, 멤버가 `UPPER_SNAKE_CASE` 인지 확인.
- `codebase/backend/src/nodes/core/error-codes.spec.ts` 에서 "키가 겹치지 않는다(테스트로 고정)" 주장의
  근거(`shares no code with ErrorCode` 테스트, `overlap` 배열이 `[]`)를 확인.
- `spec/5-system/3-error-handling.md`, `spec/conventions/node-output.md` §3.2 를 grep 해 새로 언급된
  `EngineErrorCode` 가 그 문서들의 SoT 서술과 충돌하지 않는지 대조.

## 발견사항

이번 델타 범위에서 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

- **[INFO]** "적용 범위" 문단과 바로 다음 문단의 서두가 의미상 중복
  - target 위치: `spec/conventions/error-codes.md` Overview, "**적용 범위**:" 문단 끝
    (`...대표 surface 중 하나. 나머지 하나는 아래 문단 참조)...`) 바로 다음
    "**대표 surface 는 둘이다.**" 문단
  - 위반 규약: 없음 (문서 구조·명명 규약 위반 아님, 순수 산문 스타일 문제)
  - 상세: "대표 surface 중 하나. 나머지 하나는 아래 문단 참조" 라는 전방 참조와 바로 다음 문단의
    "대표 surface 는 둘이다" 가 같은 사실을 두 번 서로 다른 어법으로 진술한다. 읽는 데 지장은 없으나
    한 문장으로 합치면 더 간결하다.
  - 제안: (선택) "적용 범위" 문단의 괄호 안 전방 참조를 지우고, 둘째 문단 "대표 surface 는 둘이다" 로
    바로 이어지게 정리. 기능적 문제가 아니므로 필수 수정 아님.

## 준수 확인 사항 (참고)

- **문서 구조**: 변경 전후 모두 `## Overview` → `## 1.`~`## 5.` 본문 → `## Rationale` 3섹션 구조를 유지
  (`.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 3섹션 권장과 일치). 새 문단은 Overview
  내부에 머물러 섹션 경계를 침범하지 않는다.
- **frontmatter 스키마**: `id`/`status`/`code:` (list) 형식이 `spec/conventions/node-output.md` 등 동일
  폴더의 다른 문서와 일치. 이번 변경으로 frontmatter 자체는 손대지 않았고, `code:` 가 가리키는 파일
  (`nodes/core/error-codes.ts`) 하나만으로 `ErrorCode`+`EngineErrorCode` 두 const 를 모두 커버한다는
  설명과도 정합적이다.
- **명명 규약**: 새로 언급된 `EngineErrorCode` 멤버(`EXECUTION_QUEUE_WAIT_TIMEOUT` 등 4종)는 실제 코드에서
  `UPPER_SNAKE_CASE` 로 확인되어, 본 문서 §1 의 "표기는 `UPPER_SNAKE_CASE`"(SoT 는 `node-output.md`
  §3.2·`3-error-handling.md` §3.2 로 위임, 본 문서는 재선언하지 않는다는 원칙)와 충돌하지 않는다.
- **SoT 분리 원칙**: 새 문단은 "§1 카탈로그의 '엔진 수준 에러' 분류와 1:1 대응하지 않는다 — 추론하지
  말 것" 이라고 명시해, 카탈로그·분류 SoT(`3-error-handling.md`)를 재선언하지 않고 오히려 오독을
  선제 차단한다. Rationale 끝단의 "왜 SoT 를 분리하는가" 서술과도 방향이 같다.
- **사실 정합성**(참고 — 본 checker 의 1차 관점은 아니나 명명 규약 판단의 전제이므로 확인):
  "같은 파일에 자매 const", "키가 겹치지 않는다(테스트로 고정)" 두 주장 모두 코드/테스트로 실측
  확인됨(`error-codes.ts:8,147` / `error-codes.spec.ts` "shares no code with ErrorCode" 테스트).

## 요약

이번 검토 대상 델타는 `spec/conventions/error-codes.md` Overview 절에 11줄을 추가해 "대표 surface" 가
`ErrorCode` 뿐 아니라 같은 파일의 자매 const `EngineErrorCode` 도 포함한다는 사실을 명문화한 것으로,
문서 구조(Overview/본문/Rationale)·frontmatter 스키마·`UPPER_SNAKE_CASE` 명명 규약·SoT 분리 원칙 어느
것도 위반하지 않는다. 새로 언급된 식별자(`EngineErrorCode`)와 그 비중복 보장 주장은 코드·테스트로
실측 확인되어 근거도 탄탄하다. 유일한 지적은 인접 두 문단 사이의 경미한 서술 중복(INFO)뿐이다.

## 위험도

NONE
