### 발견사항

- **[INFO]** Webhook 본문 크기 제한 설명이 단순 수치 갱신이 아닌 조건부 분기 구조로 개선됨
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` L36 / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` L80
  - 상세: 기존 "1MB" 단일 값에서 "공개 32KB / 인증 1MB(Planned)" 이중 경로로 변경되었으며, `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 오류 코드도 함께 문서화됨. 공개 webhook 32KB 제한은 실제 구현 완료 상태이나, 인증 webhook 1MB 제한은 "Planned — not yet implemented"로 명시되어 있어 현재 실제 동작과 문서가 완전히 일치하지 않는 혼합 상태임.
  - 제안: 인증 webhook 1MB 제한 구현 시 "(Planned — not yet implemented)" 마킹을 제거해야 함. `plan/in-progress/spec-sync-webhook-gaps.md`에서 이미 추적 중이므로 별도 조치 불필요.

- **[WARNING]** 429 rate limit 수치 변경(per-trigger 60 → global 100 req/min)이 한국어·영문 문서에만 반영되고 인라인 설명이 없음
  - 위치: `triggers.en.mdx` L47 / `triggers.mdx` L91
  - 상세: `429 Too Many Requests` 응답 설명이 "per-trigger 60 req/min"에서 "instance-wide global 100 req/min"으로 변경되었으나, 문서 내 어디에도 이 변경의 배경(per-trigger 범위에서 글로벌 범위로의 정책 전환)이 설명되지 않음. 클라이언트가 `Retry-After` 헤더나 limit 범위를 참고할 방법이 없어 버스팅 로직 구현 시 혼란이 생길 수 있음.
  - 제안: 429 응답 코드 행에 scope(global vs per-trigger)와 `Retry-After` 헤더 지원 여부를 짧게 주석 형태로 추가하거나, Callout 블록으로 rate limit 정책을 명시. 현 diff 범위 내 즉각 필수는 아님.

- **[INFO]** Inbound command 429 RATE_LIMITED에 "(Planned — not yet implemented)" 마킹 추가
  - 위치: `triggers.en.mdx` L56 / `triggers.mdx` L100
  - 상세: spec §5.1·§8.4 정합. 미구현 항목임을 사용자에게 명확히 알리는 올바른 문서화 패턴.
  - 제안: 구현 완료 시 마킹 제거. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에서 추적 중.

- **[INFO]** 영문·한국어 문서 병렬 동기화 정상 확인
  - 위치: `triggers.en.mdx` / `triggers.mdx` 전체 diff
  - 상세: 두 파일의 변경 내용이 의미적으로 일치함. 특히 오류 코드 이름(`PUBLIC_WEBHOOK_BODY_TOO_LARGE`), 수치(32KB, 1MB, 100 req/min), Planned 마킹이 모두 대응됨.
  - 제안: 추가 조치 불필요.

- **[INFO]** CHANGELOG 업데이트 필요성 판단
  - 위치: 프로젝트 루트 CHANGELOG (존재 여부 미확인)
  - 상세: 이번 변경이 코드 변경 없이 문서가 기존 spec·코드 상태를 따라잡는 보정(doc-sync)이라면 CHANGELOG는 불필요함. 단, 코드 레이어에서 per-trigger → global 전환이 별도 PR에서 이미 완료된 경우 해당 PR의 CHANGELOG에 반영되어야 했을 내용이며 이번 PR에서는 범위 외.
  - 제안: 동작 변경 PR과 이번 문서 보정 PR이 분리된 경우, 동작 변경 PR 릴리즈 노트에 rate limit 정책 변경이 기재되어 있는지 확인 권장.

- **[INFO]** review/ 산출물 파일(RESOLUTION.md, SUMMARY.md, _resolution_log.md, _resolution_state.json, _retry_state.json)은 문서화 관점 리뷰 대상 외
  - 상세: 이들 파일은 리뷰 워크플로우 내부 상태 추적 파일로, 공개 API 문서·사용자 가이드·코드 문서화와 무관함. 문서화 관점 발견사항 없음.

### 요약

이번 변경은 순수 MDX 문서 수정으로, 코드 변경이 전혀 없다. 핵심 변경은 세 가지다: (1) webhook 본문 크기 제한이 단일 1MB에서 공개 32KB / 인증 1MB(Planned) 이중 분기로 정확히 기술됨, (2) 웹훅 429 rate limit 범위가 per-trigger 60에서 global 100 req/min으로 수정됨, (3) inbound command RATE_LIMITED에 미구현 마킹이 추가됨. 영문·한국어 문서가 모두 일관되게 갱신되었고, 미구현 항목은 "Planned" 마킹으로 명확히 구분되어 있어 전반적인 문서화 품질은 양호하다. 다만 429 rate limit 정책 변경(per-trigger → global)의 배경이나 `Retry-After` 헤더 지원 여부 등 클라이언트가 실제로 필요로 할 수 있는 추가 컨텍스트가 문서에 없는 점이 개선 여지로 남는다.

### 위험도

LOW
