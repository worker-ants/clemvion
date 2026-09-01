# 정식 규약 준수 검토 — `spec/conventions/error-codes.md`

## 검토 범위

- **scope delta**: `spec/conventions/error-codes.md` 1개 파일, 실 diff 12줄 추가/1줄 삭제 (Overview 절에
  "대표 surface 는 둘이다 — `ErrorCode`/`EngineErrorCode` 자매 const, 키 비중첩" 단락 추가).
- 구현 diff 중 `codebase/backend/src/nodes/core/error-codes.ts` 는 이 spec 변경과 짝을 이루는 코드 주석
  확장(4줄)이며, 이번 스코프의 유일한 코드 변경이다. 나머지 3개 파일(frontend `__tests__` 3종)은 문서
  링크 검사 하네스 변경으로 본 error-codes 규약과 무관.
- 대상 문서 전체(frontmatter + Overview + §1~§5 + Rationale)를 규약 관점에서 검토했고, 이번 PR 델타가
  건드린 지점은 정밀 검증(코드 대조·anchor 실측), 나머지 기존 서술은 구조·명명 규약 관점에서 스팟 체크.

## 검증 방법

1. `spec/conventions/error-codes.md` 가 인용하는 외부 anchor 전수(약 15개)를 실제 파일의 heading 과
   대조 — `3-error-handling.md §1/§1.1/§1.3/§2.1/§3.2/§6`, `2-api-convention.md §5.3/§6`,
   `swagger.md §2-4`, `node-output.md §3.2`, `node-cancellation.md §2.4/§5.1`, `1-auth.md §1.5.4`,
   `10-auth-flow.md §5.4`, `12-workspace.md §1.2/§1.3/§1.8/§1.9`, `4-execution-engine.md §7.1`,
   `2-code.md §5.3 계열`, `0-common.md §1`, `1-manual-trigger.md §6`, `12-webhook.md §5.2`,
   `14-external-interaction-api.md §6.4·§R17`, `11-mcp-client.md §8.2`,
   `2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정".
   **전부 실존**하며 내용도 error-codes.md 의 인용 취지와 일치(예: `node-output.md §3.2`·
   `3-error-handling.md §3.2` 둘 다 실제로 `UPPER_SNAKE_CASE` 표기를 선언 — 후자 제목이 "Route to
   Error Port 상세"라 오인하기 쉬우나 본문 필드표에 표기 규정이 있어 인용이 정확함을 확인).
2. 이번 델타가 주장하는 코드 사실을 워킹트리에서 직접 대조:
   - `ErrorCode`/`EngineErrorCode` 가 같은 파일 `error-codes.ts` 안의 자매 const 임 — 확인
     (14행/153행).
   - "키가 겹치지 않는다(테스트로 고정)" — `error-codes.spec.ts:55` `shares no code with ErrorCode`
     테스트가 `Object.keys(EngineErrorCode).filter(k => k in ErrorCode)` 를 `[]` 로 단언 — 확인.
   - `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ErrorCode`(엔진도 발행) 쪽에, `WORKER_HEARTBEAT_TIMEOUT` 이
     `EngineErrorCode` 쪽에 있다는 §3 레지스트리 서술 — 라인 79/166 위치로 확인.
3. frontmatter 를 `spec-impl-evidence.md` §2 스키마와 대조 — `id: error-codes`(basename 일치,
   kebab-case), `status: implemented`, `code:` 1건(`codebase/backend/src/nodes/core/error-codes.ts`,
   실존 파일) — §3 라이프사이클 표의 `implemented` 요구조건(`code:` ≥1 매치) 충족, `pending_plans`
   불요.
4. 문서 구조(Overview → 본문 §1~§5 → Rationale)와 `spec/conventions/` 디렉토리 관례(flat reference,
   `_index` 불요 — `spec-impl-evidence.md §4.2` 에 그렇게 명시돼 있고 실제로 해당 디렉토리에 `_*.md`
   없음) 대조 — 부합.
5. §1 의미 기반 명명 원칙과 §3 historical-artifact 예외 레지스트리의 관계 — 레지스트리에 오른 모든
   lowercase/PascalCase 코드(`invitation_not_found` 계열, `AbortError` 등)가 "위반이지만 등록된 예외"로
   명시적으로 flag 돼 있어, §1 원칙을 몰래 어기는 게 아니라 규약이 정한 예외 처리 절차를 그대로 따름.

## 발견사항

검토 범위(델타 12줄 + anchor 전수 대조 + frontmatter + 문서 구조) 안에서 CRITICAL/WARNING 급 규약
위반을 찾지 못했다. 아래는 사소한 INFO 관찰 1건.

- **[INFO]** Overview 섹션 헤딩 표기 스타일 불일치 (참고용, 위반 아님)
  - target 위치: `spec/conventions/error-codes.md` 라인 62 `## Overview`
  - 위반 규약: 없음 — CLAUDE.md/SKILL.md 는 "Overview/본문/Rationale 3섹션"만 권장할 뿐 헤딩 문구를
    강제하지 않는다.
  - 상세: 같은 번들에 포함된 `spec-impl-evidence.md` 는 `## Overview (제품 정의)` 로 괄호 주석을
    붙이는 반면 `error-codes.md` 는 `## Overview` 단독으로 쓴다. 두 표기 모두 규약 위반은 아니며,
    conventions 문서군 전체에 통일된 서브타이틀 관례가 없다는 점만 기록.
  - 제안: 규약을 갱신할 필요는 없음 — 각 문서 저자 재량으로 두는 현행이 합리적. 굳이 통일하려면
    `spec/conventions/**` 전수에 대한 별도 소정정 plan 이 필요(이번 스코프 밖).

## 요약

이번 리뷰 스코프(`spec/conventions/error-codes.md` 델타 12줄)는 `ErrorCode`/`EngineErrorCode` 가
같은 파일의 비중첩 자매 const 라는 기존 실무를 문서화하는 순수 명문화 변경이며, 주장하는 모든 사실
(자매 const 위치, 비중첩 테스트, 개별 코드의 소속 const)을 워킹트리 코드와 대조해 확인했다. 문서가
인용하는 15개 안팎의 타 spec/conventions anchor 는 전부 실존하고 인용 취지와 내용이 일치하며,
frontmatter 는 `spec-impl-evidence.md` 스키마를 충족하고, 문서 구조는 Overview/본문/Rationale 3섹션
관례를 따른다. §3 historical-artifact 레지스트리에 오른 명명 규약 위반 코드들은 규약이 정한 예외
등록 절차(근거·SoT 명시)를 정확히 밟고 있어 §1 원칙의 은밀한 우회가 아니다. CRITICAL/WARNING 급
발견사항은 없다.

## 위험도

NONE
