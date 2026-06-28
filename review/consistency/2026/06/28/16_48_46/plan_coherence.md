# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
구현 범위: autoRefresh attention 술어 제외 (frontend needsAttention 가드 + backend findAll expiring/attention 쿼리에 supportsTokenAutoRefresh service_type 제외) + subLabel 'next in' 문구 spec §4.1 정합
대상 spec: `spec/2-navigation/4-integration.md` §2.3/§2.4/§4.1/§9.1/§11.4

---

## 발견사항

- **[INFO]** Rationale 섹션의 `supportsTokenAutoRefresh=true` provider 목록이 §9.1 본문과 불일치
  - target 위치: `spec/2-navigation/4-integration.md` l.1194 (Rationale "왜 derived 필드인가")
  - 관련 plan: `plan/complete/makeshop-integration.md` — MakeShop 도입 시 `autoRefresh` 파생 집합에 makeshop 추가 완료 기록
  - 상세: §9.1 본문(l.794)은 "현재 `service_type='cafe24'`, `service_type='google'`, `service_type='makeshop'` (auth-code+refresh) 이 `true`" 로 정확하게 기술되어 있다. 그러나 Rationale l.1194는 여전히 "현재 `cafe24`/`google` 만 true" 라고 기술되어 있어 makeshop 추가 이전 시점의 표현이 남아 있다. 구현자가 Rationale 를 참조해 `supportsTokenAutoRefresh=true` 서비스 집합을 오판하고 MakeShop 통합을 attention 술어에서 제외하지 않을 위험이 있다.
  - 제안: `spec/2-navigation/4-integration.md` l.1194 Rationale 본문에서 "현재 `cafe24`/`google` 만 true" → "현재 `cafe24`/`google`/`makeshop` 이 true" 로 정정. 단, 구현 착수를 막지는 않음 (§9.1 본문이 SoT 이며 service registry 코드가 이미 정확함).

---

## 요약

`plan/in-progress/` 전체를 검토한 결과, 이번 구현 범위(autoRefresh attention 술어 제외 + subLabel 'next in' 문구)와 충돌하는 미해결 결정 항목은 없다. 모든 관련 결정(가상 필터값 `expiring`/`attention`, `autoRefresh` derived 필드, `supportsTokenAutoRefresh` 서비스 집합, §4.1 보조 라벨 형식)은 spec Rationale 와 complete plan(`makeshop-integration.md`, `cafe24-backlog-residual.md` C-6)에서 이미 합의·확정됐다. 선행 plan 미해소나 후속 항목 누락도 발견되지 않았다. 단, Rationale l.1194 의 `cafe24`/`google` 단독 언급은 makeshop 추가 이후의 stale 표현으로, 구현 완료 후 spec 정정 PR 에서 함께 수정하기를 권장한다.

## 위험도

LOW
