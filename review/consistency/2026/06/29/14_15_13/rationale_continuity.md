# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/spec-impl-evidence.md`
검토 모드: spec draft (--spec)

## 변경 범위

diff 기준 변경은 두 곳에 한정:

1. **§2.1 `user_guide` 필드 정의 확장** — "가이드가 KO/EN 양쪽으로 존재하면 로케일 쌍 (`<name>.mdx` + `<name>.en.mdx`) 을 모두 등재 — §5.3 예시" 문구 추가.
2. **§5.3 완성 머지 예시 확장** — `user_guide:` 블록에 주석(KO/EN 양쪽 존재 시 로케일 쌍 모두 등재) 및 `telegram.en.mdx` 경로 항목 추가.

---

## 발견사항

### 없음 — 충돌·번복·재도입 없음

네 개 점검 관점을 순서대로 적용한 결과:

**1. 기각된 대안의 재도입**
`spec-impl-evidence.md` 의 Rationale(R-1 ~ R-9) 및 관련 spec Rationale(`user-guide-evidence.md`, `i18n-userguide.md`) 어디에도 "로케일 쌍(KO/EN)을 `user_guide:` 에 함께 등재하는 방식을 거부한다" 는 결정이 없다. 재도입된 기각 대안은 없다.

**2. 합의된 원칙 위반**
- R-6 는 `user_guide` 가드(`registry.test.ts`)가 stale 허용이며 spec `.md` 가드(`spec-code-paths.test.ts`)와 별개임을 명시한다. 이번 변경은 `user_guide` 필드의 의미론을 좁히거나 가드 동작을 바꾸지 않는다 — "로케일 쌍이 존재하면 모두 등재하라"는 권장 사항(optional field에 대한 정합 가이드)이므로 R-6 의 도메인 분리 원칙과 충돌하지 않는다.
- `i18n-userguide.md §Principle 5` 는 `.en.mdx` sibling 미존재를 위반으로 보지 않는다고 명시하고, `왜 .en.mdx sibling 누락은 위반이 아닌가` 항에서 점진적 추가 방식을 정상으로 인정한다. 이번 변경은 "존재하는 경우 함께 등재하라"는 것이지 "반드시 생성하라"를 강제하지 않으므로 i18n-userguide 원칙과 충돌하지 않는다.

**3. 결정의 무근거 번복**
`user_guide` 필드에 대해 "단일 파일만 등재" 또는 "로케일 불문하고 대표 파일 하나"를 명시한 과거 결정이 존재하지 않는다. 변경은 기존 결정의 번복이 아닌 미기술 영역의 명료화다.

**4. 암묵적 가정 충돌**
R-5 의 역방향 링크 강제 원칙, R-7 의 카탈로그 제외 논리, R-8·R-9 의 Gate C/D 설계 등 어떤 invariant도 로케일 쌍 등재 권장과 충돌하지 않는다. `user_guide` 는 선택(optional) 필드이고 가드 대상도 아니라 변경이 빌드 동작에 영향을 주지 않는다.

---

## 요약

이번 변경은 `spec/conventions/spec-impl-evidence.md` 의 `user_guide` 선택 필드에 대해 "KO/EN 양쪽 파일이 존재할 때 로케일 쌍을 모두 등재하라"는 권장 가이드를 §2.1 정의 및 §5.3 예시에 추가한 것이다. 기존 Rationale(R-1~R-9)이 명시적으로 거부한 대안을 재채택하거나 합의된 invariant를 우회하는 내용이 없으며, 새 정책을 도입한 것도 아닌 순수 명료화(clarification)다. `i18n-userguide.md` 의 로케일 규약과도 방향이 일치하며 충돌이 없다. Rationale 연속성 관점에서 이슈는 발견되지 않는다.

## 위험도

NONE
