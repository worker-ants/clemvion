# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** Webhook 429 rate limit 수치 변경 — spec WH-SC-05 · §7 · §8 과 정합
  - 위치: `triggers.en.mdx` L141 / `triggers.mdx` L152 (변경 후 최종 파일 기준)
  - 상세: 변경 전 "60 req/min per-trigger" 표기는 스펙과 불일치한 상태였다. `spec/5-system/12-webhook.md` WH-SC-05(line 70)는 "글로벌 throttler 100 req/min"을 명시하고, `spec/5-system/2-api-convention.md` §7 표(line 191)도 "Webhook 수신 — 100 req/min (글로벌 throttler `default`)"으로 확정돼 있다. 변경 후 문서 표기("instance-wide global 100 req/min" / "인스턴스 전역 글로벌 100 req/min")는 이 spec SoT와 line-level로 일치한다.
  - 제안: 추가 조치 불필요.

### 발견사항 2
- **[INFO]** Retry-After 헤더 언급 — spec §7 (api-convention) 과 정합
  - 위치: `triggers.en.mdx` L141 / `triggers.mdx` L152
  - 상세: 변경된 429 설명에 "The response carries a `Retry-After` header telling you when to retry" / "응답에 `Retry-After` 헤더로 재시도 대기 시간을 안내해요"가 추가됐다. `spec/5-system/2-api-convention.md` line 197은 "Rate Limit 초과 시 `429` 응답 + `Retry-After` 헤더"를 정의한다. 문서 기술이 spec과 일치한다.
  - 제안: 추가 조치 불필요.

### 발견사항 3
- **[INFO]** 413 / 본문 크기 분리 임계 표기 — spec WH-NF-02 와 정합
  - 위치: `triggers.en.mdx` L86/L140 / `triggers.mdx` L97/L151
  - 상세: 변경 후 표기("public webhooks cap at 32KB (`413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`); authenticated webhooks at 1MB (Planned — not yet enforced)")는 `spec/5-system/12-webhook.md` WH-NF-02(line 106)의 "분리 임계 (결정: 옵션 C)": 공개 webhook 32KB, 인증 webhook 1MB(미구현 Planned)와 정확히 일치한다. 에러 코드 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`, 수치, 구현 상태 모두 spec SoT와 일치.
  - 제안: 추가 조치 불필요.

### 발견사항 4
- **[INFO]** Inbound command 429 RATE_LIMITED "(Planned — not yet implemented)" 마킹 — spec §5.1 · §8.4 와 정합
  - 위치: `triggers.en.mdx` L292 / `triggers.mdx` (한국어 해당 줄)
  - 상세: `spec/5-system/14-external-interaction-api.md` line 344는 "미구현 (Planned): 현재 `/interact`·status 조회에 per-execution rate-limit이 적용되지 않아 본 코드는 발생하지 않는다"고 명시하고, §8.4 표(line 726)도 "execution 당 분당 60 — 미구현 (Planned)"으로 기재한다. 변경 후 "(Planned — not yet implemented)" 마킹은 spec 상태를 정확히 반영한다.
  - 제안: 추가 조치 불필요.

### 발견사항 5
- **[WARNING]** Inbound command rate limit 수치(60건/분) — 미구현 항목으로 향후 재검토 가능성
  - 위치: `triggers.en.mdx` L292 / `triggers.mdx` 해당 줄
  - 상세: 현재 문서는 "More than 60 inbound commands per minute per execution (Planned — not yet implemented)"를 유지한다. `spec/5-system/14-external-interaction-api.md` §8.4 표(line 726)도 "execution 당 분당 60"을 미구현 예정 수치로 보유 중이다. 60건 수치는 spec과 일치하나, 미구현 기능이라 실제 구현 시 수치가 변경될 수 있다. 현 시점에서는 spec SoT와 수치가 일치하므로 기능 오류가 아니다.
  - 제안: 현 리뷰 범위 내 즉각 수정 불필요. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 EIA-NX-11/§8.4/§5.1 추적 항목에 "구현 시 문서 수치 재검토" 체크가 이미 포함돼 있으므로 추가 항목 불필요.

### 발견사항 6
- **[INFO]** review/code/2026/06/28/12_28_46/ 산출물 (RESOLUTION, SUMMARY, 상태 파일) — 요구사항 관점 무관
  - 위치: `review/code/2026/06/28/12_28_46/RESOLUTION.md`, `SUMMARY.md`, `_resolution_state.json`, `_resolution_log.md`, `_retry_state.json`, `api_contract.md`, `documentation.md`, `meta.json`
  - 상세: 이 파일들은 이전 리뷰 세션의 산출물로, 기능 요구사항·비즈니스 로직과 무관하다. 내용은 이전 리뷰의 추적·상태 기록이며 오류 없음을 확인했다.
  - 제안: 추가 조치 불필요.

## 요약

이번 변경은 `triggers.en.mdx`와 `triggers.mdx` 두 MDX 문서 파일에서 webhook rate limit 수치(per-trigger 60 → global 100 req/min)와 인증/공개 webhook 본문 크기 분리 임계(32KB/1MB), inbound command RATE_LIMITED 미구현 마킹을 갱신한 순수 문서 수정이다. 변경된 모든 수치·에러 코드·구현 상태 마킹은 `spec/5-system/12-webhook.md`(WH-SC-05, WH-NF-02) 및 `spec/5-system/2-api-convention.md`(§7), `spec/5-system/14-external-interaction-api.md`(§5.1, §8.4)의 spec SoT와 line-level로 정합한다. 기능 완전성·비즈니스 로직·에러 시나리오 관점에서 결함이 없다. 유일한 주의 사항은 inbound rate limit 수치(60건)가 미구현 예정 수치라 구현 시 재검토가 필요하다는 점이나, 이는 현 spec SoT와 일치하는 상태이며 기존 plan에서 추적 중이다.

## 위험도

NONE
