# 문서화(Documentation) 리뷰 결과

## 발견사항

### [WARNING] 미구현 inbound rate limit 수치(60건/분) — 향후 구현 시 문서·스펙 동시 갱신 필요
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` diff line +56 / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` diff line +100
- 상세: 두 파일 모두 inbound command 429 항목에 "(Planned — not yet implemented)" / "(미구현 — 예정)" 마킹을 추가하였다. 이 자체는 spec §8.4와 정합하는 올바른 조치이다. 그러나 "60건/분" 수치가 미구현 상태에서 문서에 고정되어 있어, 향후 구현 시 문서·spec·코드 수치가 서로 어긋날 위험이 있다. 미구현 항목에 구체 수치를 노출하면 독자가 해당 수치를 확정된 계약으로 오해할 수 있다.
- 제안: 구현 계획(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 EIA-NX-11 항목)에 "inbound rate-limit 구현 완료 시 triggers.en.mdx·triggers.mdx 수치(60건/분) 재검토 및 '(Planned)' 마킹 제거" 체크리스트 항목 추가. 현 diff 범위 내 즉각 수정은 불필요.

### [INFO] Webhook 429 rate limit 수치 정정 — 스펙과 정합, 영한 동기화 완료
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` diff line +36 / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` diff line +80
- 상세: "per-trigger 60 req/min" → "instance-wide global 100 req/min" (EN), "분당 60건" → "인스턴스 전역 글로벌 100 req/min" (KO) 로 수정되었다. spec/5-system/12-webhook.md WH-SC-05 및 §6·§8의 글로벌 throttler 100 req/min 정책과 정합하며, 영문·한국어 문서가 동일하게 갱신되었다. `Retry-After` 헤더 안내도 동시에 추가되어 API 사용자 가이드로서 충분한 정보를 제공한다.
- 제안: 없음.

### [INFO] Webhook 본문 최대 크기 분리 기재 — 스펙 WH-NF-02 정합
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` diff line +36 / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` diff line +80
- 상세: 기존 단일 "1MB" 기재에서 "공개 webhook 32KB (`PUBLIC_WEBHOOK_BODY_TOO_LARGE`) / 인증 webhook 1MB (Planned)" 분리 기재로 변경하였다. spec/5-system/12-webhook.md WH-NF-02의 옵션C 결정(공개 32KB / 인증 1MB 예정)과 일치한다. 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`가 문서에 명시되어 클라이언트 오류 처리 가이드로서 완결성이 향상되었다.
- 제안: 없음. 단, 인증 webhook 1MB 게이트 구현 완료 시 "(Planned — not yet enforced)" / "(아직 미적용 — 예정)" 마킹을 제거해야 한다는 체크리스트가 `plan/in-progress/spec-sync-webhook-gaps.md` 에 존재하는지 확인 권장.

### [INFO] CHANGELOG 업데이트 필요성 — 이번 변경이 문서 보정인 경우 불필요
- 위치: 프로젝트 루트 CHANGELOG (존재 여부 미확인)
- 상세: webhook rate limit 정책(per-trigger 60 → global 100 req/min) 및 본문 크기 분리(1MB → 32KB/1MB Planned)는 API 사용자에게 체감 변경이다. 이번 diff가 이미 코드·spec에 적용된 동작을 문서에만 보정한 것이라면 CHANGELOG 불필요하다. 실제 동작 변경과 동시에 진행되는 경우라면 릴리즈 노트 기재가 필요하다.
- 제안: 이번 PR이 코드 변경 없는 문서 정합 수정임이 확인된 경우(RESOLUTION.md "코드 변경 없음" 확인) CHANGELOG 업데이트는 불필요. 동작 변경 동반 시 "webhook rate limit: per-trigger 60 req/min → global 100 req/min" 항목 추가.

### [INFO] 영문·한국어 문서 대칭성 — 완전 동기화 확인
- 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` 전체 diff / `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 전체 diff
- 상세: 변경된 세 위치(본문 크기, webhook 429, inbound command 429) 모두 영문·한국어 파일이 동일한 내용으로 갱신되었다. 언어 간 수치·상태 불일치 없음.
- 제안: 없음.

## 요약

이번 변경은 두 개의 MDX 사용자 문서 파일(영문·한국어)에서 webhook 수신 rate limit 수치 정정, 본문 최대 크기 분리 기재, inbound command rate limit 미구현 마킹 추가를 수행한 순수 문서 수정이다. 변경 내용은 spec SoT(WH-SC-05, WH-NF-02, §8.4)와 정합하고 영한 동기화가 완료되었으며, 코드·JSDoc·환경변수·README 변경은 없다. 문서화 관점에서 유일한 주의 사항은 미구현 inbound rate limit의 구체 수치(60건/분)가 향후 구현 시 재검토 없이 stale 상태로 방치될 위험이며, 해당 구현 plan에 체크리스트 항목 추가가 권장된다.

## 위험도

LOW

STATUS: SUCCESS
