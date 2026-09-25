# Cross-Spec 일관성 검토 — `plan/in-progress/lockfile-libc-pin.md`

## 검토 범위 요약

target 은 `package.json` 의 `packageManager` 필드(pnpm 10.23.0 → 10.34.5)와
`codebase/frontend/Dockerfile.playwright-e2e` 의 corepack 폴백 버전만 바꾸는 순수 툴체인/의존성
핀 조정이다. 데이터 모델, API 계약, 요구사항 ID, 상태 머신, RBAC, 계층 책임 등 제품 spec 의
어느 축도 이 변경이 서술하는 범위 안에 없다 — target 문서 자체가 "spec 영역이 없는 변경
(spec-linked 0건 실측)" 이라고 명시하고 `spec_impact: none` 을 선언한다.

## 발견사항

없음.

- **데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC** — target 에 해당 개념(엔티티,
  endpoint, 요구사항 ID, 상태 머신, 권한 규칙)이 전혀 등장하지 않는다. `spec/1-data-model.md`
  등 대형 파일은 컨텍스트 예산 초과로 이번 프롬프트에 본문이 실리지 않았으나, target 의 성격
  (버전 문자열 두 곳 교체)상 이들 영역과 충돌할 표면이 원천적으로 없다.
- **계층 책임** — `package.json`/Dockerfile 은 빌드·툴체인 계층이며 `spec/0-overview.md` §2.8
  (Flyway), §2.7(Object Storage) 등 인프라 관련 서술과도 영역이 겹치지 않는다. corepack·CI·
  dependabot 이 같은 `packageManager` 값을 읽는다는 target 의 서술(B. 처방 표)은 기존 spec 이
  기술하는 배포·CI 파이프라인 서술과 모순되지 않는다(`spec/0-overview.md` 는 pnpm 버전 핀을
  규정하지 않는다).
- **spec 내 `pnpm` 언급과의 충돌 여부** — `spec/conventions/{cafe24,makeshop}-*catalog*.md`,
  `spec/conventions/rag-evaluation.md`, `spec/7-channel-web-chat/0-architecture.md` 5개 파일이
  `pnpm` 을 언급하지만 전부 `pnpm --filter backend test -- ...` 형태의 버전-비종속 커맨드
  참조이며, 특정 pnpm 버전이나 `libc:`/lockfile 직렬화를 규정하지 않는다. 핀 상향으로 이
  커맨드들의 동작이 바뀌지 않는다.
- **관련 plan(`plan/in-progress/deps-guard-hardening.md`)과의 정합** — target 의 "가드를 새로
  세우지 않는 이유" 절은 그 트래커의 2026-08-09/2026-09-10 실측·미해결 체크박스와 일치한다
  (해당 트래커도 "별도 PR 로 판단" 하라고 명시적으로 남겨 두었다). plan 간 서술은 상충하지
  않는다. 다만 이는 spec 이 아니라 plan-to-plan 정합이라 본 리뷰의 핵심 관점(spec 충돌) 밖이며
  참고로만 기록한다.

## 요약

target 은 pnpm 툴체인 핀 버전만 두 파일에서 교체하는 저위험 의존성 변경이며, 제품 spec 이
정의하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 것도 서술하거나
변경하지 않는다. `spec/` 내 pnpm 언급 5건은 모두 버전-비종속 커맨드라 충돌 표면이 없다.
`spec_impact: none` 선언과 실측(스코프 0건)이 서로 부합하므로 Cross-Spec 관점에서 반영할
발견사항이 없다.

## 위험도

NONE
