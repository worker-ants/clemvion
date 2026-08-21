# Rationale 연속성 검토 — masked-marker-contract (라운드 10, `14_48_12`)

## 검토 방법

target(`spec/5-system/14-external-interaction-api.md`, diff-base `origin/main`)의 `## Rationale`
§R17 "프리필 왕복" 절 갱신분(frontmatter `code:` 1행 + 마커 SoT 서술 재작성)을 다음과 대조했다.

- 동일 spec 의 R17 구절(마커 미러/카브아웃/`token` 계열 확장/`whack-a-mole` 답변 등 인접 결정)
- `codebase/packages/masked-markers/src/index.ts`, `sanitize-error-message.ts`,
  `frontend/src/lib/utils/masked-markers.ts` 의 실제 diff (워킹트리 절대경로 기준)
- `plan/in-progress/masked-marker-shared-package.md` (이 변경의 설계 근거 plan)
- `git log --oneline --all -S "MASKED_MARKERS"` — target 이 스스로 인용한 "추출 기각 이력 없음"
  주장의 검증
- 이 task 의 선행 9라운드 리뷰 이력(`review/consistency/2026/08/21/10_45_52`,
  `.../10_58_25`) — 이전 라운드에서 이미 지적된 rationale-continuity WARNING/INFO 가 실제로
  해소됐는지 재확인
- `spec/conventions/cross-node-warning-rules.md` §6, `spec/4-nodes/3-ai/1-ai-agent.md`,
  `spec/5-system/5-expression-language.md` 등 — "backend 생산·frontend 판정 값을 shared
  package SoT 로 둔다" 패턴이 이 저장소의 기존 관행인지 확인

## 발견사항

없음.

target 은 R17 "마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가
미러한다" 라는 **기존 문구를 번복**하지만, 다음 세 가지 이유로 "무근거 번복"(관점 3)이나
"기각된 대안의 재도입"(관점 1)에 해당하지 않는다.

1. **새 Rationale 이 함께 작성됐다**: 교체된 문단이 "SoT 는 공유 패키지 `@workflow/masked-markers`
   다 (2026-08-21 이관)" 이라고 명시하고, 이관 이유(CI 경로 게이팅 — `frontend-checks` 는
   `codebase/backend/**` 변경 시 skip, `backend-checks` 는 그 반대)를 같은 문단 안에 인용문으로
   남겼다. 날짜가 붙은 명시적 정정은 이 문서(R12/R14/R17)의 기존 관행과 동형이다.
2. **"기각 이력 없음" 주장이 실제로 사실이다**: `git log --oneline --all -S "MASKED_MARKERS"`
   전체 이력을 직접 재실행해도 공유 패키지 추출을 기각한 커밋은 없다. 오히려
   `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373` 항목(2026-08-17 등재)이
   "공유 패키지 추출이 선행돼야 계약 테스트가 값싸다 — 그래서 별건으로 남긴다" 고 **이
   경로를 사전에 권고**해 두었던 것을 실측으로 확인했다 — target 은 예견된 후속 작업을
   집행한 것이지 새로 뒤집은 결정이 아니다.
3. **이 저장소의 확립된 원칙(shared-package SoT)을 그대로 따른다**: `@workflow/ai-end-reason`
   (`spec/4-nodes/3-ai/1-ai-agent.md`·`3-information-extractor.md`), `@workflow/graph-warning-rules`
   (`spec/conventions/cross-node-warning-rules.md` §6, "SSOT 보장 — shared package 채택
   (옵션 A)"로 명시적으로 문서화된 원칙), `@workflow/expression-engine`,
   `@workflow/chat-channel-validation` 등 "backend 가 생산·frontend 가 판정하는 값 도메인은
   `codebase/packages/` 공유 패키지를 SoT 로 둔다" 는 패턴이 이미 최소 4개 선례로 확립돼
   있다. target 은 이 원칙을 위반하는 것이 아니라 **적용**한다.

**인접 R17 원칙과의 정합도 확인**: 새 Rationale 은 "공유 프리미티브를 넓히면 무관한 경로가
오염된다"는 R17 자체의 반복 학습 원칙(§ "이름" 단락)을 스스로 인용하며, 이번 이관에서도
`MAX_SANITIZE_DEPTH`(WebSocket 마스커, `depth > N`)를 `MAX_MASK_DEPTH`(마커 스캐너,
`depth >= N`)와 **통합하지 않고 분리 유지**한다 — `codebase/packages/masked-markers/src/index.ts`
의 JSDoc(`> WS 마스커의 MAX_SANITIZE_DEPTH 는 이것이 아니다 … 별개 불변식이므로 합치지
않는다`)에서 실제로 그렇게 구현돼 있음을 확인했다. 원칙을 우회하지 않고 정확히 준수한
사례다.

**"미러가 없어졌다"는 서술과 신설된 `masked-marker-mirror*` 테스트 파일의 외견상 모순**도
검토했다 — 실제로는 모순이 아니다. 새 테스트(`codebase/backend/src/repo-guards/__tests__/
masked-marker-mirror-guard.ts` 등)는 backend/frontend 가 값을 **다시 손으로 복제**(재선언)하는
것을 막는 회귀 가드이지, 옛 "두 값이 일치하는지 대조하는 미러 계약 테스트"가 아니다.
코드 헤더 주석이 이 구분을 명시하고 있고("값의 미러와 탐지 로직의 중복은 다르다"), R17
새 문단의 "이제 대조할 미러가 없다" 는 서술과 상충하지 않는다.

**선행 라운드의 rationale-continuity 지적 재확인**: 이 task 의 1·2라운드(`10_45_52`,
`10_58_25`)에서 나온 rationale-continuity 관련 지적 2건 —
(a) R17 "backend 가 SoT" 문구가 물리적으로 낡는데 갱신 계획이 없음(WARNING),
(b) `spec-sync-external-interaction-api-gaps.md:373`(`12_33_36` 등재) 트래커 항목이 이 작업의
전제조건을 충족했음에도 대체·종결 목록에서 빠짐(WARNING) —
둘 다 현재 HEAD 에서 실제로 해소됐음을 재확인했다: R17 문구는 공유 패키지 SoT 로 갱신됐고,
`spec-sync-...md:373`·`:765` 두 트래커 항목 모두 `[x]` 로 닫히고 "닫았다 (2026-08-21)" 갱신
사유가 남아 있다.

## 요약

target 의 R17 개정은 과거 결정(마커 미러 SoT = backend 파일)을 뒤집지만, 뒤집는 즉시
날짜가 붙은 새 Rationale 을 함께 남겼고, 그 근거("CI 경로 게이팅이 계약 테스트를 막아
값 자체를 옮겼다")는 실제 워크플로 pathspec·plan 문서·git 이력으로 재검증된다. 이 저장소는
이미 4개 이상의 선례에서 "backend 생산·frontend 판정 값의 SoT 는 공유 패키지" 원칙을
확립해 두었고, target 은 이를 위반하지 않고 적용한다. 인접한 R17 원칙("공유 프리미티브를
넓히면 무관한 경로가 오염된다")도 `MAX_SANITIZE_DEPTH`/`MAX_MASK_DEPTH` 분리 유지로
그대로 지켜졌다. 이 task 의 1·2라운드에서 나온 rationale-continuity WARNING 2건은 이후
라운드에서 모두 해소됐고, 신규 발견은 없다.

## 위험도

NONE
