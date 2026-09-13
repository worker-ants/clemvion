# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 및 방법

- 검토 모드: `--impl-prep`, target scope `spec/conventions/`.
- 조립된 프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/` 280여개 파일 중 **7개만 전문
  포함**(`audit-actions.md` · `cafe24-api-catalog/_overview.md` · `.../category.md` ·
  `.../store.md` · `.../translation.md` · `cafe24-api-metadata.md` · `spec/0-overview.md`,
  실측: 헤더 뒤 4줄 윈도우에서 "본문 생략됨" 마커 유무로 전수 확인). 이 7개는 이 plan(가이드
  식별자 실재성 가드)과 **무관한 영역**이고, 정작 관련 있는
  `spec/conventions/error-codes.md`·`spec/conventions/user-guide-evidence.md`·
  `spec/conventions/spec-impl-evidence.md`·`secret-store.md` 등은 전부 절단됐다(알파벳 순
  조립이 budget 벽에 먼저 걸린 결과로 보임 — 프롬프트 자체의 지시대로 "여기 없다≠없다"를
  근거로 삼지 않고 아래는 전부 워킹트리에서 `Read`로 직접 열어 확인했다).
- plan 본문(`plan/in-progress/guide-identifier-existence.md`)을 읽어 실제 변경 범위를
  파악: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` +
  `guide-error-code-existence.test.ts`(기존 3축 가드)에 **환경변수 축**을 추가하고
  방어적 허용목록을 신설하는 harness-only 작업이다. `spec/**` 자체를 고치는 draft 는 없다.
  이번 리뷰는 그 실제 변경분이 `spec/**` 다른 영역과 충돌하는지를 검증했다.

## 발견사항

- **[WARNING] 가드 헤더가 주장하는 SoT 와 그 SoT 문서의 `code:` 프런트매터가 어긋난다**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` 헤더
    주석 3~4행 — `"SoT: spec/conventions/user-guide-evidence.md (가드 가족) · spec/conventions/error-codes.md (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md §1 (카탈로그)"`
  - 충돌 대상: `spec/conventions/user-guide-evidence.md` frontmatter `code:` 목록(6개 경로 —
    `impl-anchor.tsx`·`impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·
    `triggers-coverage.test.ts`·`impl-anchor-parse.ts`·`tree-walk.ts`/`tree-walk.test.ts`)
  - 상세: `guide-error-code-scan.ts`는 스스로를 `user-guide-evidence.md`가 소유하는
    "가드 가족" 이라고 선언하지만, 그 spec 문서의 `code:` evidence 목록에는
    `guide-error-code-scan.ts`·`guide-error-code-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 세 파일이 **하나도 없다**(spec 전체 grep 0건 —
    실측). `spec-impl-evidence.md §4`(직접 확인: `spec-code-paths.test.ts` 는 `status ∈
    {partial, implemented}` 인 spec 의 `code:` 글로브가 **≥1 파일 매치**만 요구)라서 이
    누락이 현재 CI 게이트를 깨지는 않는다 — 즉 CRITICAL 은 아니다. 그러나 spec 이 스스로
    선언한 "이 문서가 이 코드 가족의 SoT" 라는 소유권 주장과 실제 evidence 등재가
    불일치하는 상태이고, 이번 plan 은 바로 이 미등재 파일들에 **새 축(환경변수)을 추가**해
    코드량을 더 늘린다 — drift 가 이번 작업으로 더 벌어진다.
  - 제안: `developer` 는 `spec/**` 쓰기 권한이 없으므로 직접 고칠 수 없다(본 변경은
    예고 문장의 자기-반증형 소정정 다섯 조건에도 해당하지 않음 — 제품 정의/코드 evidence
    목록은 예외 대상에서 명시적으로 제외됨). `plan/in-progress/guide-identifier-existence.md`
    체크리스트나 후속 항목에 "`user-guide-evidence.md` frontmatter `code:` 에
    `guide-error-code-scan.ts`·`guide-error-code-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 3개 경로 추가" 를 `project-planner` 턴
    대상으로 명시 등재할 것을 권고한다. BLOCK 사유는 아니다(게이트 통과에 영향 없음).

- **[INFO] 신설 허용목록이 기존 named allowlist 컨벤션과 이름·모델 충돌 없음 (확인 후 기각)**
  - target 위치: plan §C "허용목록을 방어적으로 만든다" (외부 시스템 이름 · 상한 ·
    여전히 인용되는지 단언 · 기준집합 부재 단언 4강제)
  - 충돌 대상 후보로 점검: `spec/conventions/cafe24-restricted-scopes.md`(scope allowlist),
    `spec/conventions/egress-masking.md`(`allowlistFanoutNodeOutput`),
    `spec/conventions/node-output.md`(`NODE_OUTPUT_ALLOWED_KEYS`)
  - 상세: 세 기존 allowlist 는 각각 카페24 승인 scope·아웃바운드 필드 마스킹·노드 출력
    키 화이트리스트로 도메인이 완전히 분리돼 있고, 이번 plan 의 "가이드가 인용해도 되는
    외부 어휘 허용목록"과 이름·엔티티·검증 대상이 겹치지 않는다. 데이터 모델·API 계약
    충돌 없음.

- **[INFO] env 선언처(.env.example·compose) 를 기준집합에 통합해도 `secret-store.md` 와
  충돌 없음 (확인 후 기각)**
  - target 위치: plan §B "기준집합 = 소스 토큰 ∪ env 선언처"
  - 충돌 대상 후보: `spec/conventions/secret-store.md`(`.env.example` `ENCRYPTION_KEY`
    placeholder 정책, R5)
  - 상세: `secret-store.md` 는 `.env.example` 의 **값**(placeholder vs 실 키)에 대한
    운영 안전장치만 규정하며, 환경변수 **이름**의 enumeration/SoT 를 소유하지 않는다.
    plan 이 `.env.example`/compose 를 이름 기준집합 소스로 쓰는 것은 이 문서가 규정하는
    범위와 다른 축이라 모순이 없다.

## 요약

이번 plan 은 `spec/**` 을 전혀 수정하지 않는 harness-only(테스트 파일 확장) 작업이라 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC 다섯 관점에서는 검증 대상 표면 자체가 없다. 유일한
실질 발견은 대상 가드 가족이 스스로 주장하는 SoT(`user-guide-evidence.md`)와 그 spec 의
`code:` evidence 목록이 어긋나 있다는 것으로, 게이트를 깨지는 않지만(existence-only 검증) 이번
작업이 같은 미등재 파일에 코드를 더 얹으므로 다음 `project-planner` 턴에서 정리할 항목으로
등재할 것을 권고한다. 신설 허용목록·기준집합 확장은 기존 named allowlist·secret-store 정책과
검토했을 때 충돌이 없었다. 프롬프트 번들 자체는 예산 초과로 이 plan 과 실제 관련 있는 문서
대부분(`error-codes.md`·`user-guide-evidence.md`·`spec-impl-evidence.md`)을 누락했으나,
워킹트리 직접 조회로 보완했다.

## 위험도
LOW
