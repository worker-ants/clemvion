# Cross-Spec 일관성 검토 — `spec/conventions/frontend-layering.md` (impl-done)

## 검토 범위 메모

`--impl-prep` payload 는 `scope=spec/conventions/` (디렉터리 단위) 로 지정돼 있어 프롬프트에
`audit-actions.md`·`cafe24-api-catalog/**`(수백 field-level 문서) 등 이번 변경과 무관한
기존 문서 전체가 컨텍스트로 포함돼 있었다. 실제 diff-base(`29aa918a6`) 대비 변경분은
`spec/conventions/frontend-layering.md` 단 1개 파일이므로(추가 확인: `git diff
29aa918a6 --stat` 결과 동일), 본 리뷰는 그 파일을 target 으로 삼고 나머지 dump 는 배경
컨텍스트로만 사용했다. (프로세스 관찰이며 그 자체는 Critical/Warning 대상 아님.)

## 검토 대상 실제 변경

- `spec/conventions/frontend-layering.md`: frontmatter `status: partial → implemented`,
  `pending_plans` 제거, §4 CI 강제 표를 `files: LOWER_LAYERS = ["src/lib/**", "src/types/**"]`
  로 갱신, §4.1 에 "스코프" 검증 항목 추가.
- 대응 코드: `codebase/frontend/eslint.config.mjs` (`LOWER_LAYERS` export, `files: LOWER_LAYERS`
  블록), `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (신설 "가드
  스코프 — 실제 ESLint 경로 매칭" describe 블록).
- 연관 plan: `plan/complete/spec-draft-frontend-layering.md` (Phase 1~3 전부 체크, 정상
  `plan/complete/` 로 이동 완료).

## 발견사항

검토 관점 6가지(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에 대해
다른 `spec/**` 영역과의 직접 충돌은 발견되지 않았다.

- 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC: 본 문서는 엔티티·엔드포인트·
  요구사항 ID·상태 머신·권한 규칙을 전혀 정의하지 않는다(순수 frontend 디렉터리 의존
  방향 규약). 해당 축의 충돌 가능성 자체가 없음.
- 계층 책임 충돌(본 문서의 핵심 관점): 코드베이스 전반에서 "레이어/계층" 용어가 여러
  문서에서 각기 다른 의미로 쓰이고 있으나(`execution-context.md` §의 "3계층" = 예약 변수명
  강제의 L0/L1/L2 실행 시점 계층, `0-overview.md` §2.6 "Data Layer" = 시스템 아키텍처
  다이어그램의 데이터 계층, `error-codes.md`/`chat-channel-adapter.md` 의 "레이어" = 에러
  코드 분류 레이어), target 문서는 §Overview 에서 "본 문서의 '레이어' 는 frontend 디렉터리
  의존 방향(§1)만을 가리킨다 — 타 문서의 동명 용어와 무관하다" 라고 명시적으로 스코프를
  분리해 두었다. 실제로 `execution-context.md` 의 "3계층"은 확인 결과 정말 다른 개념(변수명
  예약 강제)이라 사전 disambiguation 이 정확하다 — 잠재적 용어 충돌을 target 문서 자신이
  이미 해소한 상태.

**[INFO] 용어 재사용 자체는 관례상 흔함 — 별도 조치 불요**
  - target 위치: `spec/conventions/frontend-layering.md` Overview 각주
  - 충돌 대상: `spec/conventions/execution-context.md`, `spec/0-overview.md` §2.6,
    `spec/conventions/error-codes.md`
  - 상세: "레이어/계층" 이라는 범용 용어가 최소 4개 문서에서 서로 다른 도메인(frontend
    의존 방향 / 변수 예약 강제 시점 / 시스템 아키텍처 다이어그램 / 에러 코드 분류)으로
    쓰이지만, 실제 대조 결과 의미 중첩이나 오독 가능성은 없다 — target 문서가 이미
    명시적 각주로 경계를 그었고, 다른 세 문서도 각자 문맥 안에서 자기 소비로 국한된다.
  - 제안: 조치 불요. 향후 5번째 "레이어" 용례가 추가될 때만 재확인.

## 부가 확인 (실측)

- `spec/0-overview.md` §4 표에 "Frontend 레이어 경계 규약" 행이 정확히 등재돼 있고 링크
  경로(`./conventions/frontend-layering.md`)가 유효함을 확인.
- `codebase/frontend/eslint.config.mjs` 의 `LOWER_LAYERS = ["src/lib/**", "src/types/**"]`,
  규칙 3종(`no-restricted-imports` 1 + `no-restricted-syntax` selector 4)이 spec §4 표
  기술과 정확히 일치.
- `eslint-layering-guard.test.ts` 의 "가드 스코프 — 실제 ESLint 경로 매칭" describe 가
  spec §4.1 "스코프" 항목이 서술하는 내용(합성 config 로는 glob 축소를 못 잡음 → 실제
  `ESLint` API resolve 로 별도 검증)과 1:1 대응.
- `codebase/frontend/src/` 하위 실제 디렉터리(`app, components, content, lib, test,
  types, __tests__`)가 §1 표 + "의존 축 밖" 서술과 정확히 일치(확장자 누락·오탈자 없음).
- `plan/complete/spec-draft-frontend-layering.md` 는 병렬 세션 간 naming collision
  (다른 checker `naming_collision.md` 참조)을 사용자 결정으로 해소한 이력까지 포함해
  frontmatter·phase 체크 상태가 실제 커밋과 일치.

## 요약

target 문서(`spec/conventions/frontend-layering.md`)는 `codebase/frontend/src/` 내부의
디렉터리 의존 방향만을 다루는 순수 frontend 코드 컨벤션으로, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC 등 다른 spec 영역과 교차하는 축 자체가 존재하지 않는다. 유일하게 해당하는
"계층 책임" 관점에서도 "레이어" 라는 범용 용어가 여러 문서에서 재사용되지만, target 문서가
Overview 각주로 스코프를 선제적으로 분리했고 실제 대조 결과 의미 충돌이 없음을 확인했다.
코드(`eslint.config.mjs`, 신규 테스트) 와 spec 본문(§4·§4.1)·`0-overview.md` §4 등재도
전부 실측 대조로 일치했다. Cross-Spec 관점에서 이번 변경을 차단할 근거는 없다.

## 위험도

NONE
