# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`, 대상: `spec/5-system/`, diff-base: `origin/main`

변경 범위 (spec):
- `spec/5-system/7-llm-client.md` — §5.5에 `list-models-cap.ts` 코드 경로 + 500 결과 상한 설명 추가
- `spec/2-navigation/6-config.md` — preview-models · `:id/models` API 표 행에 "결과 수 방어적 상한 500" 추가
- `spec/5-system/2-api-convention.md` — §7 Rate Limiting 표에 초대 발송/재발송 throttle 행 추가
- `spec/data-flow/7-llm-usage.md` — preview-models · `:id/models` 설명에 "결과 수 상한 500" 추가

---

## 발견사항

- **[INFO]** api-convention §7 표 내부 throttle 상수 명칭 표기 깊이 불일치
  - target 위치: `spec/5-system/2-api-convention.md` §7 Rate Limiting 표 — 신규 7번째 행 (초대 발송/재발송)
  - 충돌 대상: 동일 표 5번째 행 (Provider probe API)
  - 상세: 신규 초대 행은 `SENSITIVE_ACTION_THROTTLE(별칭 INVITATION_THROTTLE)` 로 기반 공유 상수와 도메인 별칭을 함께 노출한다. 기존 Provider probe 행은 도메인 별칭 `PROVIDER_PROBE_THROTTLE` 만 기재하고 그것이 동일한 `SENSITIVE_ACTION_THROTTLE` 의 별칭임을 표기하지 않는다. 두 행 모두 10 req/min 이라 수치 충돌은 없으나, 같은 표 안에서 상수 표기 깊이가 불균일하다. 코드(`throttle.ts`)에서 두 별칭(`PROVIDER_PROBE_THROTTLE`, `INVITATION_THROTTLE`)이 동일하게 `SENSITIVE_ACTION_THROTTLE` 를 alias 하므로 기능적 모순은 아니다.
  - 제안: Provider probe 행을 `SENSITIVE_ACTION_THROTTLE(별칭 PROVIDER_PROBE_THROTTLE)` 로 일치시키거나, 초대 행을 `INVITATION_THROTTLE` 만으로 줄여 두 행의 표기 깊이를 통일한다. 어느 방향이든 수치가 같으므로 런타임 영향 없음.

- **[INFO]** `1-auth.md` §1.5.1 / `data-flow/12-workspace.md` §1.2 가 `SENSITIVE_ACTION_THROTTLE` 공유 관계를 미반영
  - target 위치: `spec/5-system/2-api-convention.md` §7 신규 행 — "provider probe 와 공통 tier 상수 `SENSITIVE_ACTION_THROTTLE`" 표기
  - 충돌 대상: `spec/5-system/1-auth.md` §1.5.1 ("Rate Limit | 분당 10건 (`INVITATION_THROTTLE`, ...)"), `spec/data-flow/12-workspace.md` §1.2 ("rate limit: 초대 발급·재발송은 분당 10건(`INVITATION_THROTTLE`)")
  - 상세: api-convention 신규 행은 `INVITATION_THROTTLE` 이 `SENSITIVE_ACTION_THROTTLE` 의 별칭임을 명시하지만, 기존 auth spec 과 data-flow spec 은 `INVITATION_THROTTLE` 만 언급하고 공유 기반 상수를 언급하지 않는다. 세 문서 모두 10 req/min 수치는 일치하므로 기능 충돌 없음.
  - 제안: `1-auth.md` §1.5.1 과 `data-flow/12-workspace.md` §1.2 의 `INVITATION_THROTTLE` 언급에 괄호로 "(= `SENSITIVE_ACTION_THROTTLE`)" 를 덧붙이는 동기화는 선택적 개선이다. throttle 수치의 단일 진실이 api-convention §7 이므로 현 상태도 운영상 문제 없음.

---

## 요약

이번 변경(500 모델 목록 상한 + 초대 throttle 행 추가)은 기능적 cross-spec 충돌을 일으키지 않는다. 500 캡은 `spec/5-system/7-llm-client.md` §5.5 · `spec/2-navigation/6-config.md` §3 · `spec/data-flow/7-llm-usage.md` 세 곳에 일관되게 기술됐고, 초대 throttle 수치(10 req/min)는 `1-auth.md` §1.5.1 · `data-flow/12-workspace.md` §1.2 · 신규 api-convention 행이 모두 일치한다. RBAC 매트릭스·API 엔드포인트 계약·상태 전이는 변경 없이 유지된다. 발견된 두 건 모두 INFO 등급의 명칭 표기 스타일 비일관성이며, 동기화는 선택적 개선 사안이다.

---

## 위험도

LOW
