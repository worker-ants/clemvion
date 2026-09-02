# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검증 방법

번들의 관련 plan 은 컨텍스트 예산으로 대부분 절단(`⚠️ 본문 생략됨`)돼 있어, 로컬 파일시스템에서
`plan/in-progress/` 전체를 `EngineErrorCode`/`ErrorCode`/`error-codes.md` 로 grep 해 관련
plan 10개를 전수 확인했다(대상: `spec-update-node-cancellation-shutdown-classification.md`,
`auth-guard-reflection-hardening.md`, `spec-sync-websocket-protocol-gaps.md`,
`cafe24-backlog-residual.md`, `spec-sync-external-interaction-api-gaps.md`,
`expression-engine-error-shape-spec-broken-on-main.md`,
`spec-conventions-engine-error-code-surface.md`, `node-output-redesign/cafe24.md`,
`node-output-redesign/http-request.md`, target 자신). 또한 target 이 인용하는 실측(코드 위치·
`overlap` 테스트·`spec/1-data-model.md:474` 공존 서술·직전 라운드 `21_30_10`/`21_34_02` 의
plan_coherence·cross_spec 산출물)을 직접 열어 대조했다.

## 발견사항

- **[INFO]** 직전 라운드(`21_30_10`)의 plan_coherence WARNING 이 이번 개정으로 해소됨 — 확인 메모
  - target 위치: `## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` 절 전체
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §할 일
    "`[x]` '판단 기준을 함께 적을지' 에 대한 답 (2026-09-01)"
  - 상세: `21_30_10` plan_coherence 는 착수 근거 plan 이 "이 항목의 실제 무게"라 부른 질문
    (판단 기준을 함께 적을지)이 초판에서 답해지지 않은 채 사라진 것을 WARNING 으로 지적하고
    (a) 기준 서술 추가 또는 (b) "지금은 병기만" 명시적 결정 + 착수 plan 체크리스트 반영 중
    하나를 요구했다. 이번 target 은 (b) 를 택했고, **같은 근거·같은 재개 신호("세 번째 자매
    const 가 생길 때")로 target 과 착수 plan(`spec-conventions-engine-error-code-surface.md`)
    양쪽에 동일하게 기록**돼 있어 질문이 사라지지 않는다. `cross_spec` WARNING #1(데이터모델
    공존 미반영)도 `## 변경 제안` 4번째 불릿("`Execution.error` 는 두 family 가 공존하는
    필드")으로, WARNING #2(범위 경계 부재)도 `### 범위 한정 — 일반 원칙 선언이 아니다` 절로
    각각 반영됐다. 새로 열린 미해결 결정 충돌은 발견하지 못했다.
  - 제안: 조치 불필요 — 후속 라운드에서 이 결론이 뒤집히면(예: "재개 신호"가 실은 이미
    충족됐다고 판단되면) 재검토.

- **[INFO]** 착수 plan(`spec-conventions-engine-error-code-surface.md`) 의 `worktree`/체크박스
  2개가 아직 draft 적용 전 상태 — 적용 커밋에서 동시 갱신 필요 (직전 라운드 INFO 이월)
  - target 위치: 해당 없음(target 자체는 아직 `spec/conventions/error-codes.md` 를 쓰지 않은
    draft 산문)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` frontmatter
    (`worktree: (unstarted)`) + §할 일 미체크 2건("병기" · "착수 시 `/consistency-check --spec`")
  - 상세: `spec/conventions/error-codes.md` §Overview 를 직접 읽어 확인한 결과 "적용 범위"
    문단은 여전히 `ErrorCode` 단수만 대표 surface 로 서술한다 — 즉 이 draft 는 아직 실제
    spec 에 반영되지 않은 상태이고, 착수 plan 의 두 체크박스도 이에 맞게 미체크로 정합하다.
    문제는 아니며, 실제 편집 커밋에서 두 문서(착수 plan 체크박스 + `worktree`)와 target 자신을
    함께 `plan/complete/` 로 정리하는 절차가 남아 있음을 표시해 둔다.
  - 제안: draft 를 실제로 `spec/conventions/error-codes.md` 에 적용하는 커밋에서 착수 plan
    체크리스트 갱신 + `worktree` 실값 반영 + 두 plan 문서 모두 `complete/` 이동을 함께 수행할 것.

- **[INFO, 낮은 확신]** `WsErrorCode`(`ws-error-codes.ts`) 가 "세 번째 자매 const" 재개 신호의
  후보인지 애매함 — 참고용 메모
  - target 위치: `## 판단 기준은 이번에 안 쓴다` 절의 "재개 신호: 세 번째 자매 const 가 생길 때"
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md:83` ("`WsErrorCode` enum
    확장")
  - 상세: 저장소에 이미 `ErrorCode`/`EngineErrorCode` 외에 `WsErrorCode`(별도 파일
    `codebase/backend/src/modules/websocket/ws-error-codes.ts`)가 존재한다. 다만 이것은
    ARCH#5 ⑤ 가 다룬 긴장(같은 파일의 "canonical string SoT 하나" 원칙과 central-enum-확장
    선례 사이의 이탈)과 **결이 다르다** — WS 프로토콜 레벨 에러는 애초부터 별 파일·별 모듈로
    분리된 기존 패턴이라 "central enum 을 이탈해 자매 const 를 만든" 사례로 보기 어렵다.
    확신은 낮지만, 다음에 "세 번째 자매 const" 재개 여부를 판정할 사람이 이 존재를 먼저
    검토·기각할 수 있도록 포인터만 남긴다 — target 의 결정을 무효화하는 근거는 아니다.
  - 제안: 조치 불필요. 판단 기준을 실제로 쓰게 되는 시점에 이 사례를 함께 검토할 것.

## 요약

target(`spec-draft-error-code-two-surfaces.md`)은 착수 근거 plan
(`spec-conventions-engine-error-code-surface.md`)이 요구한 유일한 미결 사항 —
"언제 central enum 을 확장하고 언제 자매 const 를 만드는가"의 판단 기준을 함께 적을지 —
에 대해 이번 라운드에서 명시적 결정(지금은 미작성, 재개 신호 명시)을 내렸고, 그 결정을 착수
plan 체크리스트에도 동일하게 반영해 직전 `21_30_10` plan_coherence WARNING 을 해소했다.
`plan/in-progress/` 전체를 `EngineErrorCode`/`error-codes.md` 로 전수 grep 한 결과, 이 draft 의
좁은 범위(§Overview "적용 범위" 문단, 대표 surface 열거만 확장) 와 정면 충돌하거나 이 draft가
전제하는 선행 조건을 무효화하는 다른 in-progress 항목은 발견되지 않았다. 남는 것은 draft를
실제로 spec 에 적용하는 커밋에서 착수 plan 의 체크박스·`worktree`를 함께 정리해야 한다는
절차적 이월(직전 라운드부터 이미 추적 중)뿐이다.

## 위험도

NONE
