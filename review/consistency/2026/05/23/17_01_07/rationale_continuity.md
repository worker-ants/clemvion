# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### [INFO] 결정 C — `/spec-coverage` CI 비차단 정책의 선례 인용이 불완전
- **target 위치**: 결정 C (`## 의식적 결정 포인트 (4)`) — "`/spec-coverage` 가 CI 차단 아닌 보고형 — NLP 휴리스틱 false-positive 부담 > 검출 가치. i18n-userguide ratchet 패턴 선례"
- **과거 결정 출처**: `spec/conventions/i18n-userguide.md §Rationale — "왜 P2-b 는 hard fail 이 아닌 ratchet 인가"` (기존 코드베이스 잔존 + 일괄 0화 비현실적 → baseline ratchet)
- **상세**: i18n-userguide 의 ratchet 패턴은 "기존 잔존이 있어 한 번에 0화 불가" 라는 구체적 사유로 hard fail 이 아닌 ratchet 을 채택한 것이다. target 이 이를 "선례" 로 인용하지만, `/spec-coverage` 의 비차단 사유는 "NLP 휴리스틱 기반 false-positive 부담" 으로 성격이 다르다 — 기존 잔존 문제가 아니라 휴리스틱 신뢰도 문제다. 선례 인용이 부정확하여 Rationale 연속성 상의 혼선이 있다. 단, target 자체는 신설 SKILL.md §Rationale 에 구체 사유를 이전한다고 명시하고 있어 최종 산출물에서 해소될 가능성이 높다.
- **제안**: `의식적 결정 포인트 (4)` 의 "i18n-userguide ratchet 패턴 선례" 문구를 "i18n-userguide 의 ratchet (P2-b) 은 기존 잔존 문제가 사유, `/spec-coverage` 비차단은 NLP 휴리스틱 신뢰도 문제 — 별개 사유" 로 구분 명기. 후속 plan 5 의 SKILL.md §Rationale 에서 충분히 기술하도록 지금 플랜에서도 사유 분리를 명시한다.

---

### [INFO] 결정 A — `status: archived` 명명 근거에서 `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` 와 "의미 도메인이 다름" 을 명시했으나 해당 파일의 Rationale 절은 없음
- **target 위치**: 결정 A `status` enum 설명 — "`archived` … 명명 근거: `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` 와 의미 도메인이 달라 혼동 방지"
- **과거 결정 출처**: `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `status: deprecated` 정의 (Cafe24 가 제거한 endpoint 상태)
- **상세**: target 이 `archived` 를 채택하면서 기존 `deprecated` 와의 충돌 방지를 근거로 드는 것은 올바른 Rationale 연속성 유지다. 다만 `cafe24-api-catalog/_overview.md` 에는 `## Rationale` 절이 없어 "의미 도메인 차이" 를 기존 Rationale 에서 추적할 수 없다. 결정 자체는 sound 하지만, 미래 검토자가 `_overview.md` 에서 근거를 찾으면 발견하지 못할 것이다.
- **제안**: `spec/conventions/spec-impl-evidence.md §Rationale` (신설 예정) 에 `archived` 명명 사유를 작성할 때 "cafe24-api-catalog 의 `deprecated` 는 Cafe24 endpoint 폐기 상태이고 우리 spec 의 상태와 도메인이 달라 혼동 방지" 를 Rationale 본문에 직접 기술. 참조 파일에 Rationale 절이 없으므로 인용 표기를 "`_overview.md §3` 의 enum 항목 정의" 로 구체화하여 추적 가능하게 한다.

---

### [INFO] 결정 C — `/spec-coverage` 산출물 경로 `review/consistency/coverage/<YYYY>/...` 신설이 CLAUDE.md 정보 저장 위치 표 기존 패턴과 부분 불일치
- **target 위치**: 결정 C `산출물 위치` — `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`
- **과거 결정 출처**: `CLAUDE.md §정보 저장 위치` 표 — 일관성 검토 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 정의. 루트 경로 아래에 직접 날짜가 온다.
- **상세**: 기존 패턴은 `review/consistency/<YYYY>/...` 이고, target 은 `review/consistency/coverage/<YYYY>/...` 로 중간에 `coverage` 서브 디렉토리를 삽입한다. target 은 이를 "기존 `review/consistency/` 하위로 통합. 신규 최상위 경로 신설 회피" 라고 설명하며 cross_spec W-1 반영이라 명시하고 있다. 또한 결정 E-6 에서 CLAUDE.md 정보 저장 위치 표에 새 row 추가를 명시한다. 따라서 합의된 원칙을 무시하는 것이 아니라 인식하고 확장하는 것이다. 단, CLAUDE.md 갱신 전까지 기존 패턴을 아는 독자에게 일관성 혼선이 있다.
- **제안**: 결정 E-6 의 CLAUDE.md 갱신이 본 spec PR 안에 포함되는지, 아니면 후속 plan 에 포함되는지 명시. 현재 `## 산출물 위치` 절은 "메타 갱신: ... CLAUDE.md (정보 저장 위치 표)" 를 본 PR 범위로 열거하고 있어 동일 PR 에서 갱신될 예정임을 시사하나, 검토 시점에 확인 불가.

---

### [INFO] 결정 A — `spec-only` TTL 30일 → 90일 완화가 기존 TTL 30일 결정의 원래 Rationale 없이 번복
- **target 위치**: 결정 A `status` enum — `spec-only` TTL 30일 → 90일 완화. "(수정안 — 30일 → 90일 완화)" 표기.
- **과거 결정 출처**: TTL 30일 결정의 원래 Rationale 은 이 plan 이 신설하는 `spec/conventions/spec-impl-evidence.md` 에 처음 정의되므로 기존 Rationale 절이 없다. 즉 "과거" 결정이 다른 문서에 있지 않고, 이 plan 자체가 최초다.
- **상세**: target 은 plan 초안 상의 30일 값을 90일로 수정하면서 "(수정안 — 30일 → 90일 완화)" 라고 표기한다. 이 30일은 이전 consistency-check 세션의 cross_spec W-3 / naming_collision W-1 지적에서 나온 내부 조정이다. 원래 값의 Rationale 은 기존 spec 어디에도 없으므로 "기존 Rationale 에서 기각된 대안" 에 해당하지 않는다. 단, 완화 이유 ("장기 로드맵 spec 의 즉시 fail 회피 — cross_spec W-3 + naming_collision W-1 종합 반영") 가 target 에 명기되어 있어 결정 번복의 근거는 확인 가능하다.
- **제안**: 신설 `spec/conventions/spec-impl-evidence.md §Rationale` 에 "30일 초안 → 90일 채택: 장기 로드맵 항목에 `backlog` 상태 신설로 pressure 완화. 30일은 월간 스프린트 주기와 충돌, 90일은 분기 단위 리뷰 주기에 부합" 처럼 최종 채택값 기준으로 Rationale 을 작성하도록 후속 plan 2 스코프에 명시. 중간 값 30일을 흔적으로 남기지 않도록 plan 확정 후 plan 문서에서 "(수정안 —)" 표기 제거 권장.

---

## 요약

`plan/in-progress/spec-harness-impl-coverage.md` 는 전반적으로 기존 Rationale 을 인식하고 참조하는 방식으로 작성되어 있다. 명시적으로 기각된 대안을 이유 없이 재도입하거나 합의된 invariant 를 우회하는 설계는 발견되지 않았다. 주요 결정 포인트들 (CI 비차단, archived 명명, 산출물 경로, TTL 값) 은 각각 사유를 동반하고 있으며, 신설 spec 의 §Rationale 절에 이전하겠다고 명시하고 있어 최종 산출물 수준에서는 Rationale 연속성이 유지될 것으로 보인다. 다만 세 가지 INFO 항목 — i18n-userguide ratchet 선례의 사유 혼동, cafe24-api-catalog Rationale 추적 가능성, CLAUDE.md 갱신 시점의 명확화 — 은 후속 spec 작성 시 보완할 것을 권장한다.

---

## 위험도

LOW
