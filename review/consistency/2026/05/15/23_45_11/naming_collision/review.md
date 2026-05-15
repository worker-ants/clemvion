# 신규 식별자 충돌 검토 — spec-draft-brand-rollback

검토 대상: `plan/in-progress/spec-draft-brand-rollback.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-15

---

## 발견사항

### 발견사항 없음 — 충돌 0건

target draft가 도입 또는 정정하는 모든 식별자를 6개 점검 관점별로 분석한 결과, CRITICAL · WARNING · INFO 어느 등급의 충돌도 발견되지 않았다. 근거를 점검 관점별로 아래에 기술한다.

---

### 점검 관점별 검토 결과

#### 1. 요구사항 ID 충돌

target draft는 새로운 요구사항 ID를 신설하지 않는다. 폐기 대상으로 명시된 R-2/R-3/R-4/R-8/R-10은 모두 `spec/6-brand.md` 내부의 Rationale 항목이며, 동일 번호를 다른 의미로 재사용하는 것이 아니라 해당 항목 자체를 삭제하는 방식이다. 신설 항목은 R-13 단일건이며, 이 번호는 기존 spec/6-brand.md에 존재하지 않는다(현행 파일 기준 R-12까지 확인). 충돌 없음.

`spec/2-navigation/10-auth-flow.md`의 R-1, R-2는 **같은 번호를 재사용(대체)** 하는 것으로 draft에 명시("이전 R-1, R-2는 본 행으로 대체 — 같은 번호 재사용")되어 있다. 이는 업데이트이지 신규 ID 도입이 아니므로 충돌에 해당하지 않는다. `spec/2-navigation/_layout.md`의 R-2도 동일 패턴(신설 행 추가)으로, 기존 R-1은 그대로 유지된다.

#### 2. 엔티티/타입명 충돌

target draft가 도입하는 신규 엔티티·타입명은 없다. 폐기하는 컬러 토큰명(`vine-900`, `vine-800`, `vine-700`, `vine-600`, `vine-500`, `vine-400`, `vine-300`, `ink`, `ink-60`, `ink-40`, `soil-50`, `soil-100`, `vine-border`, `vine-dark-*` 계열)은 기존 `spec/6-brand.md §8.2`에서 정의된 것들로, draft는 이 정의 자체를 폐기·삭제하는 방향이다. 다른 spec 파일(1-data-model.md, 0-overview.md 등)은 이 토큰명을 사용하지 않는다. `spec/2-navigation/10-auth-flow.md §1`의 `soil-50` 인용이 삭제 대상으로 명시되어 있어, 해당 파일 내 유일한 사용처도 함께 정리된다. 충돌 없음.

#### 3. API endpoint 충돌

target draft는 API endpoint를 신규로 추가하거나 변경하지 않는다. 변경 대상은 순수 spec 텍스트(§8 컬러 토큰 설명, 로고 변종 명시, 배경 색 표현)이며 endpoint 정의와 무관하다. 충돌 없음.

#### 4. 이벤트/메시지명 충돌

target draft는 webhook·queue·SSE 이벤트명을 신규로 도입하지 않는다. 충돌 없음.

#### 5. 환경변수·설정키 충돌

target draft는 환경변수나 config key를 신규로 도입하지 않는다. 충돌 없음.

#### 6. 파일 경로 충돌

target draft가 변경을 적용하는 파일 3종(`spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md`)은 모두 기존에 존재하는 파일이며, 신규 파일을 만들지 않는다. plan 문서(`plan/in-progress/spec-draft-brand-rollback.md`)도 이미 존재하는 worktree의 in-progress 파일이다. CLAUDE.md 명명 컨벤션(`spec/6-brand.md` = `N-name.md` 패턴, `_layout.md` = 언더스코어 prefix, `10-auth-flow.md` = 숫자 prefix) 모두 적합하다. 충돌 없음.

---

## 추가 관찰 (INFO 등급 아님, 단순 메모)

- `spec/2-navigation/10-auth-flow.md §1` 현행 본문에 `soil-50` 인용과 `Full logo (light)` 표현이 남아 있다. draft는 이를 정정 대상으로 명확히 식별하고 교체 텍스트를 제시하고 있으므로, spec 반영 시 해당 인용들이 자연스럽게 제거된다. 별도 조치 불필요.
- `spec/2-navigation/_layout.md §2.1` 현행에도 `Full logo (light)` 표현이 있다. draft의 정정안이 이를 `Full logo`로 교체한다. 충돌과 무관하지만 반영 대상임을 확인.

---

## 요약

target draft(`spec-draft-brand-rollback.md`)는 `spec/6-brand.md §8.2` 컬러 토큰 정식화를 폐기하고 관련 2개 파일의 토큰 인용을 정정하는 순수 삭제·정정 작업이다. 새로운 식별자(요구사항 ID, 엔티티명, endpoint, 이벤트명, 환경변수, 파일 경로)를 도입하지 않으며, 기존 식별자와 충돌하는 신규 이름도 없다. 신설하는 유일한 식별자인 R-13은 기존 spec에 해당 번호가 없어 충돌이 없다. 식별자 충돌 관점에서 본 draft는 안전하게 반영 가능하다.

---

## 위험도

NONE
