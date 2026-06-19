# Consistency Check (--impl-done, follow-up) — 모델 select 방어적 경고 + multiselect

**대상**: follow-up 코드 diff vs spec. 검토자: cross-spec (focused — follow-up 의 spec-연결 변경은
multiselect union 정합 1건 + 기존 spec 4문서 정합 유지 확인. convention/plan-coherence 는 직전
full impl-done(2026/06/19/20_56_35)이 동일 feature 영역을 커버, 신규 식별자 추가 없음).

## BLOCK: NO

cross-spec NO-BLOCK (LOW). spec-impl 새 Critical 불일치 0.

## 확인
- **FU4 multiselect**: backend `UiHint.widget` 에 추가 → spec §2.6.2 "기본 입력(10)" 의 multiselect 와
  완전 정합(기존 backend↔spec 갭 해소). backend union 이 §2.6.2 21종을 모두 포함.
- 신규 위젯 2종은 spec §2.6.2 "모델 selector(2)" 와 3-way(backend/frontend/registry) 정합 유지.
- ai-agent §1 표(Model select) / IE §1 / 17-agent-memory §3 정합 유지.
- 경고 UX·`useResolvedChatConfig` 반환타입 변경은 spec 외 internal impl 보강 — 저장 형태·런타임
  resolve 무변경, spec 어느 본문과도 모순 없음.

## 조치한 INFO
- §12.12 "현 결정"(v2) 단락의 `"모델 ID expression 문자열 1개씩"` 문구가 후속 결정(expression→select)과
  표현상 충돌 → "모델 식별자(모델명 문자열) 1개씩 ... v2 expression / 이후 select 전환" 으로 정정.
  provider 무추가 불변식은 보존(문구만 정확화).

## 결론
follow-up ↔ spec 정합 확인. SPEC-CONSISTENCY 게이트 통과(BLOCK: NO).
</content>
