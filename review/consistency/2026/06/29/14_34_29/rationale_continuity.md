# Rationale 연속성 검토 결과

**대상**: `spec/conventions/spec-impl-evidence.md`
**검토 시각**: 2026-06-29
**변경 요약**: §2.1 `user_guide` 필드 설명에 KO/EN 로케일 쌍 등재 규약 + "build-time 가드 미적용" 명시 추가; §5.3 예시에 `telegram.en.mdx` 로케일 쌍 추가.

---

## 발견사항

### [INFO] `user_guide` build-time 가드 미적용 선언 — Rationale 항목 부재

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §2.1 `user_guide` 행 (`**현재 build-time 가드 미적용** — 선언적 cross-link 전용이라 경로 오기는 빌드에서 검출되지 않음`)
- **과거 결정 출처**: 동일 문서 `## Rationale R-6` — `code:` 도메인 분리 근거(spec frontmatter vs user-guide MDX)만 다루며, `user_guide` 필드의 가드 미적용 결정 근거는 Rationale 에 없음.
- **상세**: §2.1 의 새 설명은 `user_guide:` 가 `§4 가드 대상 아님` 임을 본문에서 처음 명시한다. 이는 기존 Rationale 와 충돌하지 않으나(기존 결정을 번복하는 것이 아님), "왜 `user_guide:` 는 가드를 두지 않는가"의 설계 결정이 Rationale 에 명문화되어 있지 않다. §4 가드 표에서 `user_guide:` 가 빠진 것은 구현 시점부터 암묵적으로 유지되어 왔으나, 이제 본문이 이를 명시적으로 선언한 만큼 Rationale 에도 근거 항이 있으면 이후 독자의 "왜 가드가 없는가 — 빠진 건 아닌가" 오독을 방지할 수 있다.
- **제안**: Rationale 에 `R-10` (또는 기존 R-6 하위 항) 을 추가해 "`user_guide:` 는 선언적 cross-link 전용이라 경로 오기가 spec 약속(구현 surface)의 정합을 깨지 않으므로 build 차단이 불필요하다. `code:`/`pending_plans:` 는 spec 이 *약속한* 구현 path 라 매치 실패 = 미구현이지만, `user_guide:` 는 문서간 연결 힌트라 stale path 가 있어도 spec 의도(surface 정의) 자체는 훼손되지 않는다" 취지의 근거를 추가.

---

## 요약

이번 변경(diff 2줄)은 기존 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. `user_guide:` 필드의 KO/EN 로케일 쌍 규약 추가와 §5.3 예시 보충은 기존 `code:` 가드 분리 원칙(R-6), `user_guide` 선택 필드 성격, build-time 가드 대상 범위 모두와 일관된다. 유일한 미흡은 "왜 `user_guide:` 는 §4 가드 대상에서 제외했는가"의 결정 근거가 Rationale 에 없다는 점이며, 이는 번복이 아닌 기록 누락이라 INFO 수준이다.

## 위험도

LOW
