# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] Webhook 429 rate limit 수치 변경 — 스펙과 일치, 양 언어 동기화 완료
- 위치: `triggers.en.mdx` line 36 / `triggers.mdx` line 534
- 상세: "60 req/min per-trigger" → "global 100 req/min" (EN), "분당 60건" → "글로벌 100 req/min" (KO). spec/5-system/12-webhook.md WH-SC-05 및 §6·§8에 명시된 "글로벌 throttler 100 req/min" 정책과 정합. 영문·한국어 문서가 동일하게 갱신되었으므로 문서 간 불일치 없음.
- 제안: 없음. 변경은 스펙 SoT와 완전히 일치한다.

### [INFO] Inbound command 429 "Planned — not yet implemented" 주석 추가 — 스펙과 일치
- 위치: `triggers.en.mdx` line 45 / `triggers.mdx` line 543
- 상세: spec/5-system/14-external-interaction-api.md line 344 에 "미구현 (Planned): 현재 `/interact`·status 조회에 per-execution rate-limit 이 적용되지 않아 본 코드는 발생하지 않는다" 고 명시되어 있다. 동일 spec §8.4 rate-limit 테이블(line 726)에도 "execution 당 분당 60 — 미구현 (Planned)" 기재. 문서의 "Planned — not yet implemented" / "(미구현 — 예정)" 주석은 스펙 상태를 정확하게 반영한다.
- 제안: 없음.

### [WARNING] Inbound 명령 rate limit 수치(60건) — 미구현 항목이므로 향후 수치 결정 시 재확인 필요
- 위치: `triggers.en.mdx` line 45 / `triggers.mdx` line 543
- 상세: 현재 문서는 "More than 60 inbound commands per minute per execution (Planned — not yet implemented)"를 유지한다. spec/5-system/14-external-interaction-api.md §8.4 테이블도 "execution 당 분당 60" 수치를 보유하고 있으나 미구현 상태다. 미구현 기능의 수치는 추후 구현 단계에서 변경될 수 있으며, 그 시점에 문서·스펙·코드가 함께 업데이트되어야 한다.
- 제안: 구현 계획(plan/in-progress 또는 신규 plan)에 "EIA inbound rate-limit 구현 시 문서 수치 재검토" 체크리스트 항목을 추가해 두는 것이 좋다. 현 리뷰 범위 내 즉각 수정 사항은 없다.

### [INFO] Webhook 본문 최대 크기(1MB) 문서 기재 — 스펙과 부분 불일치 (기존 이슈, 이번 diff 외)
- 위치: `triggers.en.mdx` (전체 파일 컨텍스트 line 139) / `triggers.mdx` (line 648) — 이번 diff 에 포함되지 않은 기존 라인
- 상세: 두 파일 모두 "Maximum body size is 1MB" / "본문 최대 크기는 1MB" 로 기재되어 있다. 그러나 spec/5-system/12-webhook.md WH-NF-02(line 106)에 따르면 공개 webhook은 32KB, 인증 webhook은 1MB 이며, 인증 webhook의 1MB 게이트는 "미구현 (Planned)"이다. 이번 변경과 직접 관련은 없으나 동일 섹션에 위치한 잠재적 문서 부정확성이다.
- 제안: 이번 PR 범위 밖이므로 별도 이슈로 추적하거나 기존 plan/in-progress/spec-sync-webhook-gaps.md에 포함되어 있는지 확인할 것. 이번 diff에서 수정 요구는 하지 않는다.

### [INFO] CHANGELOG 업데이트 필요성
- 위치: 프로젝트 루트 또는 doc 변경 이력 관리 위치
- 상세: rate limit 정책 변경(per-trigger 60 → global 100)은 API 사용자에게 영향을 주는 동작 변경이다. 이번 변경이 이미 적용된 동작을 반영한 문서 수정인지(spec과 코드가 이미 global 100 req/min이었던 경우), 아니면 동작 변경과 동시에 일어나는 것인지에 따라 CHANGELOG 기재 여부가 달라진다.
- 제안: 이번 PR이 동작 변경을 동반하는 경우 CHANGELOG 또는 릴리즈 노트에 "webhook rate limit: per-trigger 60 req/min → global 100 req/min"을 명기할 것. 문서만 수정(코드·spec은 이미 global 100)인 경우에는 CHANGELOG 불필요.

## 요약

이번 변경은 두 개의 MDX 문서 파일(한국어·영어 각 1개)에서 webhook 수신 rate limit 수치와 inbound 명령 rate limit의 미구현 상태를 업데이트한다. 변경된 내용은 모두 spec/5-system/12-webhook.md 및 spec/5-system/14-external-interaction-api.md의 SoT와 정합하며, 한국어·영어 문서 간 불일치도 없다. 독스트링·JSDoc·README·API 엔드포인트 자체 변경은 없고, 환경변수 추가도 없으므로 별도 문서화 작업이 필요한 항목은 없다. 유일한 주의 사항은 Inbound rate limit 60건 수치가 미구현 기능에 대한 예정 수치이므로 실제 구현 시 재검토가 필요하다는 점이다.

## 위험도

LOW
