# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-fix-isactive-drawer-toggle.md`
검토 범위: spec/, plan/in-progress/, spec/conventions/

---

## 발견사항

### 발견사항 1
- **[INFO]** R-16 식별자가 다른 파일에서 이미 사용 중 (파일별 독립 컨벤션 확인 필요)
  - target 신규 식별자: `spec/2-navigation/2-trigger-list.md` 에 신설 예정인 **R-16** (drawer read-only 표시 + ⋮ 행 액션 단일 편집 경로 결정 근거)
  - 기존 사용처: `spec/6-brand.md:487` — `### R-16. 투명 배경 + 흑백 단일 분리 (2026-05-25, 3차 개정)`. 브랜드 자산 컨테이너 fill 전체 투명화 + 워드마크 흑백 단일 분리에 관한 결정. `spec/2-navigation/10-auth-flow.md:454` 에서 `spec/6-brand.md R-16` 으로 cross-reference 중.
  - 상세: 두 R-16 은 각각 별개 파일에 속하며 의미도 전혀 다르다. 그러나 프로젝트 Rationale 번호 컨벤션은 **파일별 독립 번호** 임을 `spec/2-navigation/2-trigger-list.md:339` 이 명시하고 있다 ("파일별 독립 Rationale 번호 컨벤션 — R-2 는 7개 파일, R-3/R-5 는 각 4개 파일에서 재사용"). 따라서 동일 번호가 다른 파일에 공존하는 것은 허용된 패턴이다. cross-reference 시 `spec/6-brand.md R-16` 처럼 파일 경로를 함께 명시하면 모호성이 없다.
  - 제안: 조치 불필요. 다만, target 에서 R-16 을 본문에서 인용할 때 `Rationale R-16` 단독 표기 대신 파일 컨텍스트를 명확히 하는 편이 독자 혼선을 예방한다. 기존 R-14 참조 스타일(`[R-14](#r-14-...)` 앵커 링크)을 동일하게 적용하면 충분하다.

---

## 추가 검토 결과 (이슈 없음)

아래 식별자는 충돌·중복 없음을 확인했다.

1. **R-4 참조** — target 이 §2.3.1 `isActive` 행 비고에서 기존 `(Rationale R-4)` 를 유지·인용한다. `spec/2-navigation/2-trigger-list.md:220` 의 `### R-4. isActive 편집 경로를 PATCH body 와 /toggle 양쪽 모두 유지` 와 동일 의미로 참조하는 것이므로 충돌 없음.

2. **엔티티/타입명** — target 은 새 엔티티·DTO·인터페이스명을 도입하지 않는다. 변경은 §2.3.1 매트릭스 셀 텍스트와 Rationale 섹션 추가에 국한된다.

3. **API endpoint** — 신규 endpoint 없음. `PATCH /triggers/:id { isActive }` 및 `PATCH body` / `/toggle` 는 기존 spec 에서 이미 정의된 경로다.

4. **이벤트/메시지명** — webhook·queue·SSE 이벤트명 변경 없음.

5. **환경변수·설정키** — 신규 ENV var / config key 없음.

6. **파일 경로** — target 이 변경하는 파일은 기존 `spec/2-navigation/2-trigger-list.md` 이며 신규 파일 생성 없음. 명명 컨벤션 충돌 없음.

---

## 요약

target 문서가 도입하는 신규 식별자는 `spec/2-navigation/2-trigger-list.md` 내의 **R-16** 하나이다. 동일 번호가 `spec/6-brand.md` 에 이미 존재하지만, 프로젝트는 파일 범위 독립 번호 컨벤션을 채택하고 있어 동일 파일 내 중복만을 충돌로 본다. 현재 `2-trigger-list.md` 에는 R-15 까지만 존재하므로 파일 내 순번 충돌은 없다. 나머지 엔티티명·API endpoint·이벤트명·환경변수·파일 경로 관점에서 신규 식별자 도입이 없어 충돌 사항은 발견되지 않았다.

---

## 위험도

NONE
