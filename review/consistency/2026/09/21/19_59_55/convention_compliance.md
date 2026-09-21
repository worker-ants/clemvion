# 정식 규약 준수 검토 — `spec/5-system` (--impl-prep)

## 검토 맥락

이번 --impl-prep 게이트를 촉발한 실제 작업(`plan/in-progress/e2e-race-helper.md`)은
`codebase/backend/test/helpers/concurrency.ts` 신설 + 아홉 개 동시성 e2e 파일 리팩터이며
`spec_impact: none`(프로덕션 코드·spec 변경 0, 테스트 전용)이다. 그런데 본 체크에 전달된
target 은 `spec/5-system` 디렉터리 **전체 18개 파일**(총 약 1.1MB)로, 이번 diff 가 실제로
건드리는 내용과 직접 연결되지 않는다. 이는 target 문서 자체의 결함이 아니라 orchestrator 의
scope 계산에 관한 관찰이므로 별도 등급 없이 기록만 남긴다 — 아래 발견사항은 scope 로 전달된
`spec/5-system` 문서군을 `spec/conventions/**` 대비 독립적으로 점검한 결과다.

## 확인한 것 (위반 없음 — 근거만 기록)

- **감사 액션 명명** (`spec/conventions/audit-actions.md`) — 최근 병합된 9건의 동시-삭제 감사
  중복 수정(`user.2fa_disabled` · `model_config.delete` · `auth_config.delete` · `member.removed`)이
  전부 §3 도메인별 분류 레지스트리에 `<resource>.<verb>` dot-prefix·해당 시제 분류로 등재돼 있고,
  `spec/5-system/1-auth.md` §4.1/§4.1.A 의 카탈로그와도 정확히 일치한다. 위반 없음.
- **파일·frontmatter 명명** — `spec/5-system/*.md` 18개 전부 `id`(파일 slug 와 일치) ·
  `status`(`implemented`/`partial`) · `code:` 배열 frontmatter 를 갖추고 있고, 넘버링
  (1~17 + `_product-overview.md`)에 gap 이 없다. `14-external-interaction-api.md` 본문의
  `id: 1/2/3/4/99` 는 SSE 예시 코드블록 안의 `id:` 필드이지 frontmatter 가 아니다(오탐 아님, 확인만).
- **에러 코드 명명** (`spec/conventions/error-codes.md`) — §3 historical-artifact 예외 레지스트리·
  §5 rename 이력이 `spec/5-system/3-error-handling.md`·`14-external-interaction-api.md` 의 교차
  참조와 정합한다. 새 위반을 찾지 못했다.

## 발견사항

- **[INFO]** `## Overview` 헤딩 표기 불일치 (4/18 파일)
  - target 위치: `spec/5-system/5-expression-language.md`(`## 1. 개요`) ·
    `7-llm-client.md`(`## 1. 개요`) · `11-mcp-client.md`(`## 1. 개요`) ·
    `16-system-status-api.md`(헤딩 없이 서론 문단만)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 **권장**)" —
    `## Overview (제품 정의)` / 본문 / `## Rationale`
  - 상세: 같은 디렉터리의 14/18 파일(`1-auth.md`, `2-api-convention.md`, `12-webhook.md` 등)은
    `## Overview` 헤딩을 쓰는 반면 위 4개 파일은 `## 1. 개요`(한국어, 번호 접두) 또는 헤딩
    없이 서론만 쓴다. 규약 문서 자체가 "권장"이라 명시하고 있어 CRITICAL/WARNING 대상은
    아니며, grep 상 이 파일들은 오래전부터 이 형태였다(이번 PR 이 만든 편차가 아니다).
  - 제안: 액션이 필요하다면 project-planner 턴에서 4개 파일의 첫 섹션 헤딩만
    `## Overview` 로 통일 — 내용 이동은 불필요, 헤딩 텍스트만 교체. 이번 e2e-race-helper
    PR(spec 변경 0, 테스트 전용) 범위에서 처리할 항목은 아니다.

- **[INFO]** `spec/5-system` 는 다른 다중파일 영역과 달리 `0-*.md` 진입 파일이 없음
  - target 위치: `spec/5-system/` 디렉터리 전체 (첫 파일이 `1-auth.md`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` 명명 컨벤션 —
    `spec/<영역>/0-overview.md` — 기술 아키텍처 개요
  - 상세: `2-navigation`(`0-dashboard.md`) · `3-workflow-editor`(`0-canvas.md`) ·
    `4-nodes`(`0-overview.md`) · `7-channel-web-chat`(`0-architecture.md`) ·
    `data-flow`(`0-overview.md`) 는 모두 `0-` 로 시작하는 파일이 있으나 `5-system` 은
    `1-auth.md` 부터 시작한다. 다만 다른 영역들의 `0-*.md` 도 반드시 "아키텍처 개요"는
    아니고(`0-dashboard.md`/`0-canvas.md` 는 일반 콘텐츠 페이지), 이 규칙이 엄격히
    "0 은 항상 아키텍처 개요 문서" 를 강제하는지는 불명확 — 오래된 구조적 선택으로 보이며
    이번 diff 와 무관.
  - 제안: 규약 갱신이 더 적절해 보인다 — "0-" prefix 가 실제로는 "그 영역의 자연스러운
    시작점" 정도의 관례이지 엄격한 "아키텍처 개요 전용" 규칙이 아니라면 SKILL.md 표현을
    완화하거나, 반대로 강제하고 싶다면 `5-system` 재넘버링은 별도 project-planner 작업으로
    분리해야 한다(현재 diff 범위 아님).

## 요약

이번 --impl-prep 게이트가 실어 온 target(`spec/5-system` 18개 파일 전체)은 실제 트리거 작업
(`e2e-race-helper`, 테스트 전용·`spec_impact: none`)과 내용상 연결점이 없다. 그 전제 위에서
target 문서군을 `spec/conventions/**` 대비 점검한 결과 CRITICAL·WARNING 급 위반은 발견하지
못했다 — 감사 액션 명명·에러 코드 명명·frontmatter 규약은 모두 정합했고, 최근 병합된 9건의
동시성 감사 중복 수정도 `audit-actions.md` 레지스트리와 정확히 일치한다. 발견한 두 건은 모두
"권장" 수준 문서 구조 편차(Overview 헤딩 표기 불일치, `0-` 진입 파일 부재)로 오래전부터
존재해 온 패턴이며 이번 PR 의 범위(테스트 헬퍼 추출)와 무관하다.

## 위험도

LOW
