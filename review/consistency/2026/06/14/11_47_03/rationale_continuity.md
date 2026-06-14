STATUS: OK

---

# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/6-config.md` (--impl-done, diff-base=origin/main)
대상 변경: AuthConfig 편집 폼 (edit mode) — 백엔드 shallow-merge·비밀값 보호 + 프론트 편집 다이얼로그·`buildAuthConfigUpdatePayload`·`formStateFromAuthConfig`

---

## 발견사항

### 발견사항 없음 (합격)

검토 대상 Rationale 목록:

- `spec/2-navigation/6-config.md § Rationale R-2` — "항상 마스킹 + Reveal 엔드포인트": 평문 노출은 create / regenerate / reveal 3 경로만
- `spec/1-data-model.md §2.17.2` — 마스킹·노출 정책 단일 진실 (secret 류 항상 `***<last4>`, 평문 3경로만)
- `spec/1-data-model.md §2.17.3` — `bearer_token` 자동 발급 강제
- `spec/2-navigation/6-config.md §A.4` — Reveal 흐름 (Admin+ · 비밀번호 재확인 · audit 기록)

**점검 1 — 기각된 대안의 재도입**: 이번 diff 는 편집 폼에서 비밀값(key/token/secret/password)을 payload 에 포함하지 않도록 `buildAuthConfigUpdatePayload` 를 분리했고, `SECRET_CONFIG_KEYS` 집합으로 backend 에서도 필터링한다. Rationale R-2·§2.17.2 가 "평문 노출은 create/regenerate/reveal 3 경로만" 으로 정의한 원칙을 정확히 준수하며, 이를 우회하는 새로운 평문 경로를 도입하지 않는다. 기각된 대안("사용자 입력 bearer_token") 도 재도입 없음 — bearer_token 편집 폼의 `config` 는 빈 객체(`{}`)로 전송된다.

**점검 2 — 합의된 원칙 위반**: §A.4 마스킹 원칙(`***<last4>` 마스킹 값이 역류해도 실 비밀 미보존 파손 금지)을 backend `update` 메서드가 명시적으로 구현한다 — 마스킹 값이 `SECRET_CONFIG_KEYS` 에 걸려 shallow-merge 에서 제외된다. `formStateFromAuthConfig` 도 비밀 필드를 폼 상태에 싣지 않는다(`password: ""`). 위반 없음.

**점검 3 — 결정의 무근거 번복**: spec §A.2 현황 주석은 "생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공" 이라고 적혀 있다. 이번 diff 는 이 상태를 편집 폼 추가로 확장하지만, 기존 결정을 번복하는 것이 아니라 미구현이라고 명시된 기능을 채우는 것이다. 번복에 해당하지 않으므로 새 Rationale 부재가 문제가 되지 않는다. type 불변 정책(편집 시 type lock)은 신규 결정이지만 §2.17.3 "비밀값 재발급은 regenerate 경로" 와 완전히 일관한다 — type 변경이 비밀값 재발급을 수반하므로 삭제·재생성 경로로 일원화한다는 논리는 기존 Rationale 의 자연스러운 귀결이다.

**점검 4 — 암묵적 가정 충돌**: §2.17.2 invariant "평문 노출 3 경로 한정" 이 PATCH 편집 경로를 암묵적으로 4번째 평문 경로로 만드는지 확인했다. diff 는 그러지 않는다 — PATCH 페이로드에 비밀값이 들어오더라도 backend 가 필터링하고, frontend 는 아예 싣지 않는다. `ipWhitelist=[]` 의 "빈 배열 전송 = 전체 삭제" 의미론도 기존 DTO(`UpdateAuthConfigDto`) 와 정합하며, 새 invariant 도입이 아니다.

---

## 요약

이번 구현(AuthConfig 편집 폼)은 기존 `spec/2-navigation/6-config.md § Rationale R-2` 와 `spec/1-data-model.md §2.17.2` 가 확립한 "비밀값 평문 노출은 create/regenerate/reveal 3 경로만" 원칙을 정확히 준수한다. 기각된 대안(사용자 입력 bearer 토큰, 비밀값 PATCH 전송)의 재도입 없음, 합의된 마스킹 invariant 위반 없음, 기존 결정의 무근거 번복 없음이 모두 확인되었다. type 불변 정책(편집 시 type select disabled)은 spec 에 명시된 결정은 아니나 비밀값 재발급 단일 경로 원칙의 논리적 귀결로서 기존 Rationale 와 충돌하지 않는다. spec §A.2 현황 주석("편집 폼 미구현")은 이번 변경으로 구현 완료되므로 spec 동기화 후속 갱신이 권장되나, 이는 Rationale 연속성 위반이 아니라 문서 동기화 사항이다.

---

## 위험도

NONE
