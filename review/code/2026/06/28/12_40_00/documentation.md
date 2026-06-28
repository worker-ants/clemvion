# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] 인증 webhook 1MB 한도 "Planned" 표현 일관성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/objective-bose-ede03d/codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` — URL/method 섹션 및 응답 코드 테이블
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/objective-bose-ede03d/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` — 동일 섹션
- 상세: 영문 문서에서 "Planned — not yet enforced"(URL 섹션)와 "Planned — not yet implemented"(응답 코드 테이블)로 표현이 미세하게 달리 쓰였다. 한국어 문서("아직 미적용 — 예정" vs "미구현 — 예정")도 유사하게 약간 다른 어휘를 사용한다. 기능 상태를 나타내는 동일 Planned 항목이 두 위치에서 다른 문구로 표현되면 독자 혼란을 유발할 수 있다.
- 제안: "Planned — not yet implemented"로 단일화하거나, 최소한 같은 문서 내에서 동일 상태를 동일 문구로 기술한다.

### [INFO] 응답 코드 테이블 — 413 항목 설명이 길어진 것에 대한 가독성
- 위치: `triggers.en.mdx` 응답 코드 테이블 413 행 / `triggers.mdx` 동일 행
- 상세: 기존 "Body exceeded the 1MB limit." 한 문장에서 "Public webhook body over 32KB (`PUBLIC_WEBHOOK_BODY_TOO_LARGE`). The 1MB cap for authenticated webhooks is Planned — not yet implemented."로 두 개의 구별 문장이 한 셀에 들어갔다. 표 셀에서 두 가지 조건을 설명하는 복합 문장은 스캔 시 가독성이 떨어진다.
- 제안: 413 행을 두 행으로 분리하거나(공개/인증 각 행), 또는 셀 내 조건 구분을 `<br/>` 또는 별도 인라인 마킹으로 명확히 표시하는 것을 검토한다. 현 diff 범위 내 즉각 수정 필수 사항은 아니나 향후 문서 개선 시 고려 권장.

### [INFO] CHANGELOG 업데이트 필요성
- 위치: 프로젝트 루트 또는 spec CHANGELOG
- 상세: rate limit 정책 변경(per-trigger 60 req/min → global 100 req/min)이 문서에 반영되었다. 이 변경이 코드·spec 에서 이미 적용된 상태의 문서 보정이라면 CHANGELOG 는 필요 없다. 그러나 이전 리뷰(12_28_46 SUMMARY INFO #6)에서 "동작 변경 동반 시 명기" 조건부 권고가 있었고, 코드 측 변경 여부가 이 diff 에서 확인되지 않는다.
- 제안: 코드 측에서도 실제로 per-trigger 60 → global 100 전환이 이루어진 경우 CHANGELOG 또는 릴리즈 노트에 rate limit 정책 변경을 기재한다. 동작 변경이 없는 순수 문서 보정이라면 생략 가능.

### [INFO] 영문/한국어 문서 동기화 상태 확인
- 위치: `triggers.en.mdx` 와 `triggers.mdx` 전체
- 상세: 이번 diff 에서 수정된 세 항목(webhook 본문 크기, 413 설명, 429 rate limit 수치) 모두 영문·한국어 양쪽에 동기화되어 반영되었다. 인라인 코드·숫자(32KB, 1MB, 100 req/min)도 양쪽 일치한다. 이번 변경 자체의 동기화는 양호하다.
- 제안: 추가 조치 불필요.

### [WARNING] 미구현 inbound rate limit 수치의 문서 안정성
- 위치: `triggers.en.mdx` — Inbound commands 오류 응답 테이블 429 행 / `triggers.mdx` 동일 행
- 상세: "More than 60 inbound commands per minute per execution (Planned — not yet implemented)"로 60건 수치가 명시되어 있다. 이 수치는 아직 구현되지 않은 예정 값이며, 실제 구현 시 변경될 가능성이 있다. 문서에 구체적 수치를 선행 기재하면 구현 단계에서 수치가 달라질 경우 문서·코드·spec 삼중 불일치가 발생한다. 기존 SUMMARY(12_28_46) WARNING #1 에서도 동일 사항이 지적되어 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 추적 중임이 확인된다.
- 제안: 구현 계획(plan) 에 "EIA inbound rate-limit 구현 시 문서 수치(60건/분) 재검토" 체크리스트 항목이 이미 추적되고 있으므로 현 diff 범위 내 즉각 수정은 불필요하다. 구현 시점에 문서 수치를 반드시 재검토한다.

## 요약

이번 diff 는 순수 MDX 사용자 문서 수정으로, webhook 본문 크기 정책(단일 1MB → 공개 32KB / 인증 1MB Planned 분리)과 rate limit 정책(per-trigger 60 → global 100 req/min) 두 항목을 영문·한국어 양쪽에 동기화하여 spec SoT 와 정합을 맞춘 변경이다. 문서화 관점에서 실제 코드 변경이 없는 문서 보정이므로 독스트링·API 신규 엔드포인트·환경변수 문서화 이슈는 없다. 주요 관찰 사항은 동일 Planned 상태를 가리키는 두 개의 미세하게 다른 표현("not yet enforced" vs "not yet implemented"), 413 테이블 셀의 복합 설명 가독성, 그리고 미구현 inbound rate limit 수치(60건)가 구현 시 변경될 경우 문서 불일치 위험이다. 이 중 마지막 항목은 기존 plan 에서 추적 중이므로 현시점 즉각 수정이 필요한 사안은 없다.

## 위험도

LOW
