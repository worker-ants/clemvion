# Cross-Spec 일관성 검토 — `spec/conventions/frontend-layering.md` 신설

검토 대상: `plan/in-progress/spec-draft-frontend-layering.md` (draft) + 실제 작성된
`spec/conventions/frontend-layering.md` + `spec/0-overview.md` §4 등재.
모드: `--spec`.

## 방법

payload 로 전달된 `spec/0-overview.md`·`spec/1-data-model.md` 전문 검토에 더해, 실제
워크트리(`spec-frontend-layering`)의 파일을 직접 열어 다음을 실측 대조했다:

- `spec/conventions/frontend-layering.md` (신설 전문)
- `spec/0-overview.md` §4 표 실제 등재 행
- `spec/conventions/execution-context.md` 의 "3계층"(L0/L1/L2) 용어
- `spec/7-channel-web-chat/0-architecture.md` §1 "레이어 분리" 용어
- `spec/conventions/data-hydration-surfaces.md`, `spec/4-nodes/5-data/1-transform.md`
  (target 이 근거로 삼는 코드 경로의 교차 검증)
- `spec/conventions/spec-impl-evidence.md` §3 (frontmatter `status:partial`/`pending_plans` 요건)
- 실 코드: `codebase/frontend/eslint.config.mjs`,
  `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`,
  `codebase/frontend/src/app/` 디렉터리 구조, `codebase/channel-web-chat/eslint.config.mjs`

## 발견사항

- **[INFO]** "레이어" 용어 동음이의어 disambiguation 이 3개 영역 중 2개만 커버
  - target 위치: `spec/conventions/frontend-layering.md` `## Overview` 각주
    (`> 본 문서의 "레이어" 는 ... 0-overview.md 의 Data Layer, execution-context.md 의
    3계층 등 타 문서의 동명 용어와 무관하다.`)
  - 충돌 대상: `spec/7-channel-web-chat/0-architecture.md` §1 "레이어 분리"
    (Host page / SDK loader / Widget SPA(iframe) / Clemvion API 4-레이어, 배포·격리 경계 개념)
  - 상세: target 은 스스로 "레이어" 동음이의어 충돌 가능성을 인지하고 `0-overview.md`
    의 Data Layer 및 `execution-context.md` 의 3계층(L0/L1/L2 강제 계층 — 변수명 예약
    강제라는 전혀 다른 개념) 두 곳을 명시적으로 배제했다. 그러나 spec 트리 안에서 "레이어"
    라는 단어를 표 형태로 정의하는 세 번째 문서가 `7-channel-web-chat/0-architecture.md`
    §1 이며, 공교롭게도 그쪽도 "4개 레이어" 표를 쓴다(우연의 일치, 실질 개념은 배포/격리
    경계로 완전히 다름). 실질 충돌 위험은 낮다 — `codebase/channel-web-chat` 은
    `codebase/frontend` 와 별개 앱이고 별도 `eslint.config.mjs` 를 쓰며(레이어 가드 없음,
    실측 확인) target 의 스코프(`codebase/frontend/src/`)와 물리적으로 겹치지 않는다.
    다만 target 문서가 이미 "동명 용어 무관" 각주를 선제적으로 다는 관행을 스스로 세웠으므로,
    그 관행의 완전성이 부분적이라는 점만 지적한다.
  - 제안: (선택) 각주에 `7-channel-web-chat/0-architecture.md §1 "레이어 분리"` 를 세
    번째 항목으로 추가해 "spec/ 전체에서 '레이어'를 표로 정의하는 문서 3곳 모두 상호
    무관함"을 명시. 블로킹 아님 — 다음 편집 기회에 반영해도 무방.

- **[INFO]** `0-overview.md` §2.1 이 `codebase/frontend` 의 Next.js App Router 채택을
  명시하지 않음
  - target 위치: `spec/conventions/frontend-layering.md` §1 계층 정의 표
    (`src/app/** | Next.js App Router 라우트·페이지`)
  - 충돌 대상: `spec/0-overview.md` §2.1 Client (SPA) (`- **기술**: React 기반 SPA`)
  - 상세: 실제 코드베이스(`codebase/frontend/package.json` 의 `"next": "^16.2.3"`,
    `src/app/(auth)`·`(editor)`·`(main)` route group 구조)로 확인한 결과 target 의
    "Next.js App Router" 서술은 사실과 일치한다. 모순은 아니며 "React 기반 SPA" 라는
    상위 서술과도 양립 가능(Next.js 는 React 기반)하지만, `0-overview.md` §2.1 은 구체
    프레임워크(Next.js)를 언급하지 않아 두 문서의 구체성 수준이 어긋난다.
    `7-channel-web-chat/_product-overview.md` 는 이미 자기 영역을 "Next.js CSR" 로
    명시하는 선례가 있어, 메인 frontend 도 동일한 구체성으로 맞추면 향후 독자 혼란(어느
    문서가 SoT인지)을 줄일 수 있다.
  - 제안: 본 PR 스코프는 아님(target 이 건드릴 필요 없음). `0-overview.md` §2.1 갱신은
    별도 기회에 project-planner 가 판단.

## 검토 결과 (관점별)

1. **데이터 모델 충돌** — 없음. target 은 엔티티·필드를 정의하지 않는다
   (`spec/1-data-model.md` 대조 결과 신규/변경 필드 없음).
2. **API 계약 충돌** — 없음. target 은 endpoint 를 정의하지 않는다.
3. **요구사항 ID 충돌** — 없음. `id: frontend-layering` frontmatter 는 spec 트리
   전역에서 유일함을 확인 (`grep -rln "^id: frontend-layering$" spec/` → 1건).
   요구사항 ID(`NAV-*`/`ND-*` 류)를 신규 부여하지 않는다.
4. **상태 전이 충돌** — 해당 없음(대상 도메인 없음).
5. **권한·RBAC 모델 충돌** — 해당 없음(대상 도메인 없음).
6. **계층 책임 충돌** — 없음, 오히려 다른 spec 과 상호 보강됨을 확인:
   - `spec/conventions/data-hydration-surfaces.md` 의 `code:` 경로
     (`codebase/frontend/src/lib/conversation/conversation-utils.ts`)가 target 의
     "정본은 `@/lib/conversation/` 에 있고 `@/components/.../conversation-utils.ts` 는
     re-export 껍데기" 서술과 정확히 일치.
   - `spec/4-nodes/5-data/1-transform.md` 의 `code:` 경로
     (`codebase/frontend/src/types/transform.ts`)가 target 의 "`src/types/` 는
     `transform.ts` 하나뿐" 서술과 일치.
   - `spec/conventions/spec-impl-evidence.md` §3 의 `status: partial` 요건
     (`pending_plans:` 의무 + `code:` ≥1 매치)을 target frontmatter 가 정확히 충족함을
     실측 확인 (`code:` 2개 경로 모두 실존 파일, `pending_plans:` 경로가
     `plan/in-progress/spec-draft-frontend-layering.md` 로 실존).
   - `spec/0-overview.md` §4 표 신규 행(`Frontend 레이어 경계 규약 | — |
     ./conventions/frontend-layering.md`)의 포맷이 인접 행(노드 Output 규약,
     ExecutionContext 설계 규약, 에러 코드 명명 규약)과 동일 패턴 — 문서 컨벤션 위반 없음.
   - 다른 spec 의 `code:` frontmatter 가 `eslint.config.mjs` 또는
     `eslint-layering-guard.test.ts` 를 이중 소유하지 않음(중복 커버리지 소유권 충돌 없음).
   - `codebase/channel-web-chat` 은 별도 `eslint.config.mjs` 를 쓰고 레이어 가드가 없어
     target 의 "레이어 가드" 결정이 channel-web-chat 의 기존 아키텍처 결정과 충돌하지 않음.

## 요약

target 은 `codebase/frontend/src/` 내부 디렉터리 의존 방향이라는 좁고 자기완결적인
스코프의 신규 convention 이며, spec 트리의 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC 어느 축과도 실질 충돌이 없다. 오히려 `data-hydration-surfaces.md`,
`4-nodes/5-data/1-transform.md`, `spec-impl-evidence.md` 등 인접 spec 과 코드 경로·
frontmatter 요건이 정확히 정합함을 실측으로 확인했다. 유일한 소음은 "레이어"라는
동음이의어가 spec 전역에 3곳(`0-overview.md` Data Layer, `execution-context.md`
3계층, `7-channel-web-chat/0-architecture.md` 레이어 분리)에서 쓰이는데 target 의
선제적 disambiguation 각주가 2곳만 커버한다는 점 — 실질 위험은 사실상 0(별개
코드베이스·별개 개념)이라 INFO 등급의 문서 완성도 지적에 그친다.

## 위험도

LOW
