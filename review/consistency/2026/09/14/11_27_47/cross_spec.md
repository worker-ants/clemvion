# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 요약

- 선언된 target: `spec/conventions/` (scope 델타 **0개 파일** — 이 브랜치는 spec 을 바꾸지 않음)
- 실제 diff (`origin/main...HEAD`): 코드/테스트 6개 파일(434줄) + `plan/in-progress/*.md` 2개 +
  이전 세션 산출물(`review/consistency/2026/09/14/10_44_37/**`)
- 코드 diff 전량이 **테스트 전용**이다: 신규 정적 가드(`repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}`),
  기존 e2e/spec 파일에 대한 어서션 추가(`schedule-trigger.e2e-spec.ts`), 주석 정정(`trigger-workflow-ref.spec.ts`,
  `trigger-workflow-ref.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`).
- 프로덕션 코드(`modules/**`) 변경 0, `spec/**` 변경 0, 신규 엔티티·엔드포인트·상태 머신·RBAC 규칙 0.

이 구성상 "데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임" 6개 관점 모두 **새로 도입되는
정의가 없다** — 충돌이 성립하려면 두 정의 중 하나가 있어야 하는데 본 diff 는 기존 정의를 재확인하는
테스트만 추가한다. 다만 diff 안의 주석이 다른 spec 영역(`secret-store.md §R4`, `2-navigation/3-schedule.md §4`,
`5-system/2-api-convention.md §5.4`)의 내용을 **명시적으로 인용해 주장**하므로, 그 인용이 실제 spec 문언과
어긋나는지를 1차 검증 대상으로 삼았다.

## 검증한 인용 3건 (모두 원문과 일치 — 충돌 없음)

1. **`secret-store.md §R4`** — diff 는 "R4 는 프로덕션 삭제 경로(`TriggersService.remove()` →
   `deleteByPrefix`)의 explicit cascade 요구이고, e2e teardown 이 raw `DELETE FROM trigger` 로
   `secret_store` 고아 row 를 안 지우는 것은 테스트 인프라 한정이라 R4 와 무관"이라고 주장한다.
   `spec/conventions/secret-store.md` R4 원문("trigger 삭제 시의 명시적 cleanup 책임은
   `TriggersService.delete()` 가 진다... `ON DELETE CASCADE` 는 채택하지 않는다")과 대조한 결과
   **정확히 일치**하며, 실제 `triggers.service.ts:860`에 `deleteByPrefix` 호출이 존재함을 확인했다.
   프로덕션 경로는 R4 대로 유지되고, 이 diff 가 건드리는 것은 e2e teardown 뿐이다.
2. **`2-navigation/3-schedule.md §4`** — diff(plan 문서)는 "스케줄 응답 `trigger.workflow` 는
   이미 양성 3 + 생성 음성 대조 1 로 고정돼 있다"고 주장한다. `spec/2-navigation/3-schedule.md:153`
   원문("e2e 가 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정한다")과 일치한다.
3. **`5-system/2-api-convention.md §5.4`** (부재 표현 — null vs 키 생략) — diff 가 추가한
   `expectTriggerWorkflowRef(row, { present: true, ... })` 어서션은 목록/수정/재활성 응답에
   해당하며, spec 이 규정한 "생성 응답만 키 생략, 나머지는 present"와 일치한다 (충돌 없음).

## 발견사항

없음 — CRITICAL/WARNING 급 cross-spec 충돌을 발견하지 못했다.

- **[INFO]** plan 트래커에 새로 등재된 두 항목(`_overview.md` frontmatter 부재,
  `__` 이중 언더스코어 표기 미정의)은 이전 세션(`review/consistency/2026/09/14/10_44_37`)의
  `convention_compliance` checker 가 이미 WARNING 으로 낸 것을 developer 가 tracker 에 옮겨 적은
  것으로, 본 diff 가 새로 만든 충돌이 아니다. Cross-spec(본 관점) 스코프 밖이므로 재-flag 하지
  않는다 — 다만 다음 `--spec` 라운드에서 `convention_compliance` 관점으로 처리될 필요가 있음을
  참고로 남긴다.
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 두 항목
  - 충돌 대상: 없음 (신규 정의 아님, 기존 관찰의 재등재)

## 요약

이번 diff 는 `spec/conventions/` 를 포함해 `spec/**` 를 전혀 변경하지 않았고(plan `spec_impact: none`
과 일치), 실제 코드 변경도 트리거 비밀 컬럼 3중 사본 정적 가드·`workflow` 관계 양성 커버리지
어서션·주석 정정 등 순수 테스트 하드닝으로 국한된다. 새로 도입되는 엔티티·엔드포인트·요구사항 ID·
상태 전이·RBAC·계층 책임 정의가 없어 구조적으로 cross-spec 충돌이 성립할 표면이 없으며, diff 내
spec 인용 3건(`secret-store.md §R4`, `3-schedule.md §4`, `2-api-convention.md §5.4`)을 원문과 대조한
결과 모두 정확했다. Cross-Spec 일관성 관점에서 이 변경은 안전하다.

## 위험도

NONE
