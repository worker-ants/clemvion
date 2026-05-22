# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] spec/2-navigation/2-trigger-list.md §2.3.1 필드 권한 매트릭스 — "Recent Calls" 행 미제거
- 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 표, `Recent Calls | (목록) | read-only | 클릭 시 실행 상세로 이동` 행
- 상세: drawer 에서 Recent Calls 카드를 제거했으나, §2.3.1 필드 권한 매트릭스 표에는 해당 행이 그대로 남아 있다. 코드(카드 제거) 와 spec(표 행 존재) 사이에 작은 불일치가 생긴다. 커밋 메시지는 §2.3 표 1행 제거를 언급하고 있지만, 실제 diff 에서 §2.3.1 매트릭스의 `Recent Calls` 행은 삭제되지 않았다.
- 제안: §2.3.1 매트릭스에서 `Recent Calls` 행도 제거하거나, 해당 기능이 별도 Dialog 로 이동됐음을 명시하는 메모를 추가하는 것이 spec-code 일관성 측면에서 깔끔하다. 단, 이는 spec 파일이므로 `developer` 가 직접 수정하기보다 이미 기록된 범위 내 정리임을 감안하면 허용 가능한 residual 이다.

### [INFO] i18n 키 위치: `triggers.externalInteraction.eventsLabel` vs 플랜 내 `triggers.externalInteraction.notificationUrl` 재사용 계획
- 위치: `plan/in-progress/trigger-drawer-cleanup.md` §2 작업 단위, EIA 카드 "URL" 항목
- 상세: 플랜 문서에서 EIA 카드의 "URL" dt 를 `t("triggers.externalInteraction.notificationUrl")` (기존 키) 로 쓰겠다고 명시되어 있다. 그러나 실제 구현 코드(`trigger-detail-drawer.tsx`)에서는 `t("triggers.detail.urlLabel")` (신규 키) 를 사용하고 있다. 플랜 예고와 구현 사이의 키 선택이 다르지만, 두 키의 번역 텍스트("URL")가 동일하므로 UX 에는 영향이 없다. 단, `triggers.externalInteraction.notificationUrl` 의 번역값이 ko에서는 "수신 URL", en에서는 "Destination URL" 로 단순 "URL" 과는 뉘앙스가 다르다 — 신규 키 `urlLabel`("URL") 을 쓴 것이 오히려 더 정확한 선택이다.
- 제안: 현재 구현이 더 정확하므로 코드 변경은 불필요하다. 다만 플랜 문서가 최종 구현과 달라 사후에 혼란을 줄 수 있으므로, 플랜 완료 시 완료 문서에 최종 키 선택 근거를 기록하면 좋다.

### [INFO] 포맷팅 변경 — `trigger.type` 표시 로직 변경
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, OverviewCard 함수, Type dt
- 상세: 기존 코드는 `trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1)` (문자열 capitalize) 방식이었다. 변경 후 `trigger.type === "webhook" ? t("triggers.typeWebhook") : ...` 의 3항 분기로 교체되었다. 이는 순수 i18n 교체 범위에서 로직 변경을 수반하지만, i18n 적용의 필수 부수 효과(하드코딩 문자열 제거)이며 KO 로케일에서 올바른 번역이 나오려면 이 변경이 반드시 필요하다. 범위를 이탈한 변경이 아니라 의도된 i18n 교체의 일부로 판단된다.
- 제안: 없음 (정당한 변경).

---

## 요약

변경 범위 관점에서 이 PR 은 선언된 작업 단위(Recent Calls 카드 제거 + 영문 라벨 i18n 적용 + i18n dict KO/EN parity + plan 파일 신설 + spec 업데이트)에 충실하게 구현되었다. 범위 외 리팩토링, 기능 확장, 무관한 파일 수정은 발견되지 않았다. 유일한 잠재적 불일치는 `spec/2-navigation/2-trigger-list.md` 의 §2.3.1 필드 권한 매트릭스에 "Recent Calls" 행이 미제거 상태로 남아 있는 것이지만, 이는 코드 동작에는 영향이 없는 spec 문서 레벨의 잔류 항목이다. 그 외 모든 변경은 명세된 범위 내에 있으며 포맷팅·주석·임포트 변경도 작업 의도에 부합하는 수준이다.

## 위험도

LOW
