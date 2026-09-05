# Plan 정합성 검토 — impl-done (scope=spec/, diff-base=origin/main)

## 발견사항

없음.

### 근거 (조사 경과)

이번 델타(4개 spec 파일 + `codebase/backend/migrations/README.md`)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 목록의 두 항목을 그대로 성문화한 것이다.

- **`## 후속` 체크리스트**(해당 plan 436~455줄): "CREATE INDEX CONCURRENTLY IF NOT EXISTS 재실행 위험" 과 "코드 주석의 리뷰 세션 ID 인용" 두 항목이 이미 `[x]` 로 닫혀 있고, 각각 `plan/complete/spec-draft-migration-rerun-and-citations.md`(status: complete)를 상세 근거로 가리킨다.
- 그 완료 plan 의 `spec_impact`(`spec/conventions/migrations.md`, `spec/conventions/review-citations.md`)가 이번 diff 의 대상 파일과 정확히 일치한다. README §5 의 "인덱스 교체는 DROP-먼저" 3문장 패턴·V056/V106 표·`review-citations.md` 전문이 그 plan 이 적어 둔 실측(2026-09-05, DROP-first 3형태 실측·mixed 판정 에러 메시지·인용 507→514회 재측정)과 문장 단위로 일치한다.
- **미해결 결정 우회 여부** — 완료 plan §③, in-progress plan 457~462줄이 남긴 유일한 미결 항목은 `Flyway mixed=true 도입 여부`(양쪽 위험을 다 피하는 `indisvalid` 분기 `DO` 블록을 쓰려면 필요하나, 혼합 금지 가드를 저장소 전역에서 해제하는 대가가 있어 "별도 결정 항목"으로 명시 유보됨)다. 이번 diff 는 이 결정을 **선점하지 않는다** — `codebase/backend/migrations/README.md` 는 `mixed=true` 를 설정 파일 어디에도 반영하지 않고 본문에서도 "도입 여부는 별도 결정 항목입니다" 라고 그대로 남겨 두었다(`grep -rn "mixed" codebase/backend/migrations/` 로 확인, 실 설정 없음).
- 두 번째 미결 항목("해소 불가 bare 인용 8건 채우기", developer 트랙)도 이번 diff 범위 밖으로 남아 있고, `review-citations.md` §2 자체가 그 8건을 "미해소" 로 명시해 self-consistent 하다.
- `spec/conventions/spec-impl-evidence.md` 의 `code:` 필드 정의에 추가된 각주("시행 코드가 없는 순수 문서형 convention" 예외)는 `review-citations.md` Rationale 이 스스로 언급하는 대칭 갱신이며, 다른 in-progress plan 중 이 필드의 의미를 다르게 규정하거나 충돌하는 항목은 없다(`plan/in-progress/**` 전수 grep, 매치 없음).
- `spec/data-flow/8-notifications.md` 에 추가된 V056 경고문(⚠️ 각주)은 새 결정이 아니라 이미 성문화된 README §5 패턴을 가리키는 포인터일 뿐이며, append-only 원칙(§3)과도 충돌하지 않는다.
- 그 외 `plan/in-progress/**` 전체를 키워드(`migration`, `V0NN`, `notification`, `dismiss`, `review-citations`, `spec-impl-evidence`, `pending_plans`)로 훑었으나, 이번 델타가 가정하는 선행조건이 미해소 상태로 남아 있는 plan 이나, 이번 변경으로 무효화·신설되어야 하는데 반영되지 않은 후속 항목은 발견되지 않았다.

## 요약

이번 spec 델타는 이미 종결된 `plan/complete/spec-draft-migration-rerun-and-citations.md` 를 문장 단위로 그대로 적용한 것이며, 그 상위 in-progress plan(`spec-draft-nullable-notation-followups.md`)의 체크리스트·미결 항목 표기와 정확히 일치한다. 유일하게 남은 미해결 결정(`Flyway mixed=true` 도입 여부)은 이번 diff 에서 선점되지 않고 그대로 열려 있으며, 다른 in-progress plan 과의 충돌·후속 누락도 확인되지 않았다.

## 위험도

NONE
