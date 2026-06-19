# AI Review SUMMARY (follow-up) — 모델 select 위젯 방어적 경고 + multiselect

**대상**: follow-up diff `git diff 99906a6b..HEAD` (전체 맥락 `origin/main...HEAD`).
**리뷰어**: side-effect / requirement / testing (3종, bg bgIsolation → 텍스트 반환 + main 기록).

## 전체 위험도: LOW (Critical 0, 코드 결함 0)

| reviewer | risk | 결과 |
| --- | --- | --- |
| side-effect | NONE | useResolvedChatConfig 반환타입 변경 파일내부 한정(외부 호출처 0), isStale 로딩 false-positive 차단(테스트됨), looksLikeExpression 오탐 0(모델명에 `{{` 없음), div 래핑 무해, multiselect: candidate-lookup switch `default` 낙하 + system-context-schema 가 이미 사용 → **type-fix 정합**(부작용 0) |
| requirement | NONE | FU1/FU3/FU4 요구 충족, FU2 판단(noModelsFound) 정확, i18n KO/EN 의미 일치·올바른 행동 안내 |
| testing | LOW | 경고 분기 커버 양호. 보강 권고 3건(아래) |

## 조치 분류

### FIX (적용 완료 — 테스트 보강)
- **[testing W]** stale + expression **동시** 발화 케이스(삭제 provider + 구 expression 값) 미검증 → 케이스 추가.
- **[testing W]** expression **미발화** 분기(정상 모델명) 미검증 → chat·embedding 각 케이스 추가.
- **[testing I]** locale store teardown 미비 → afterEach 에 `setLocale("ko")` 리셋 추가.
- 위젯 테스트 14 → 17 cases.

### NO-FIX (근거)
- **[side-effect "Warning"]** 신규 위젯 3-way 정합 — reviewer 가 "확인 중 일시 혼동, 실제 문제 없음" 으로
  자체 해소. backend union·frontend UiWidget·WIDGET_REGISTRY 모두 동기화 확인.
- **[testing I]** i18n 문자열 내용 자체 미검증 — testid 검증으로 충분(프로젝트 관행). dict parity
  guard(`i18n.test.ts`)가 KO/EN 키 대칭 자동 검증.

### 범위 외 (요구사항 명시 범위)
- **[requirement I]** embedding 위젯엔 stale 경고 없음 — FU1 이 "chat" 으로 명시 범위. embedding 의
  stale fallback 도 잠재적 UX 이슈이나 요구사항 밖(추후 후보).

## 런타임·spec 일치 (requirement/side-effect 확인 PASS)
- FU4 multiselect: spec §2.6.2 "기본 입력(10)" 와 정합(기존 backend↔spec 갭 해소).
- 저장 형태·런타임 resolve·fallback 체인 무변경 → 하위호환 유지(expression 저장값은 경고+보존).
- spec 4문서 ↔ 구현 정합 follow-up 후에도 유지.
</content>
