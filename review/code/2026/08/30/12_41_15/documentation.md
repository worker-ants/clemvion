# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 이번 diff 의 변경사항(발견형 구조 가드로의 확장, `kb-stats.helper.ts` 의 잠재적 타입 오류 수정)을 반영하지 않았다.
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음 — 12개 변경 파일 목록에 부재). 관련 기존 항목은 `CHANGELOG.md:559` (`## Unreleased — \`UPDATE … RETURNING\` 의 결과를 8곳이 행 배열로 오인했다`).
  - 상세: 이 저장소는 CHANGELOG 를 "릴리스 시점 일괄 작성"이 아니라 **수정 시점 즉시 작성**하는 것이 실측으로 확인된 관행이다(`plan/in-progress/update-returning-tuple-shape.md:260-266` 자체가 이 관행을 근거로 이전 라운드의 유예를 스스로 뒤집은 이력이 있다). 이번 diff 는 두 가지 실질 변경을 담는다: (1) `hasRawUpdateReturning` + 신규 `describe` 블록으로 회귀 가드를 "손으로 고른 3파일"에서 `src/**` 전수 발견으로 확장 — 이는 `CHANGELOG.md:559` 항목이 이미 "회귀 가드"를 언급한 그 가드의 구조 자체를 바꾸는 후속 조치다. (2) `kb-stats.helper.ts` 의 `.query<>()` 제네릭이 `{...}[]`(행 배열, 거짓 선언)에서 `[{...}[], number]`(튜플, 실제 shape)로 정정됐다 — plan 본문(`plan/in-progress/update-returning-tuple-shape.md:343-348`)이 이를 "이 트래커의 원 결함이 4개월 산 이유의 절반"과 같은 클래스의 잠재 결함으로 명시적으로 기술하고 있음에도, `CHANGELOG.md:559` 의 "8곳" 목록에는 `kb-stats.helper.ts` 가 없다(당시엔 발견되지 않은 9번째 후보였다). 두 변경 모두 CHANGELOG 에 새 항목 또는 기존 `:559` 항목에 대한 후속 각주로 반영돼야, "이 저장소가 8곳을 고쳤다"는 이전 서술이 "발견형 가드로 재발 방지 범위를 넓혔고 9번째 잠재 지점도 정정했다"는 최신 상태와 어긋나지 않는다.
  - 제안: `CHANGELOG.md` 에 항목을 추가하거나(신규 Unreleased 섹션 또는 기존 `:559` 항목 하단에 "후속" 문단) — 이번 plan 이 아직 `in-progress` 상태이므로 plan 완료(`plan/complete/` 이동) 시점에 한 번에 반영해도 되지만, 그렇다면 plan 체크리스트에 "CHANGELOG 갱신 대기" 항목을 명시적으로 남겨 두는 것을 권장한다(현재 체크리스트에는 이 잔여 항목이 없다).

- **[INFO]** `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 이 아직 미등재 — 이미 `review/consistency/2026/08/30/12_17_21/SUMMARY.md:23`(WARNING #4) 가 같은 사실을 포착했다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:402-403`(plan 본문이 스스로 이 gap 을 인지·기록함).
  - 상세: `spec/` 은 developer 쓰기 권한 밖이라 이번 코드 PR 로는 처리 불가 — planner 턴 필요. 문서 추적 무결성(spec-pending-plan-existence 가드가 참조) 관점에서는 실질 gap 이지만, 이미 별도 채널(consistency-check)에 등재돼 있어 이 리뷰가 새로 발견한 사항은 아니다. 중복 차단 목적으로 참고 표기만 남긴다.

- **[INFO]** 신규 공개 함수 `hasRawUpdateReturning`(`codebase/backend/src/common/__test-utils__/source-scan.ts:93`)와 신규 `describe` 블록(`codebase/backend/src/common/utils/update-returning-rows.spec.ts:135`)의 JSDoc/주석 수준은 이 리뷰 관점에서 결함이 없다 — "왜 필요한가", "판정 축", "이 축이 안 보는 것(의도)"을 각각 명시하고, 오탐 사례(`INSERT … RETURNING`, `INSERT … ON CONFLICT DO UPDATE … RETURNING`)를 표로 문서화했다. 코드를 직접 대조한 결과 문서 서술과 정규식 동작이 정확히 일치한다(`.query(` 만 매치 → QueryBuilder `.update().execute()` 는 구조적으로 제외된다는 서술을 `execution-engine.service.ts` 의 `.createQueryBuilder()` 호출부로 직접 확인). `ALLOWED` 허용목록의 4개 사유 문구도 실제 소스(`integration-oauth.service.ts`, `agent-memory-admin.service.ts`, `stuck-document-recovery.service.ts`)와 대조해 정확함을 확인했다.

- **[INFO]** `kb-stats.helper.ts` 의 신규 인라인 주석(라인 29-35)은 기존 주석(라인 26-28, "RETURNING 절은 향후 호출자가 활용할 수 있도록 유지")을 삭제하지 않고 그 옆에 정정 맥락을 덧붙이는 방식을 취했다 — 이 저장소의 "원문은 취소선으로 남기고 인접 서술은 건드리지 않는다"는 자기반증형 소정정 관례와 정신적으로 일치하며(다만 여기는 spec 이 아니라 코드 주석이라 그 절차의 적용 대상은 아니다), 다음 사람이 왜 타입이 바뀌었는지 놓치지 않도록 하는 좋은 문서화다. 문제 없음.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 매우 높은 수준이다 — 신규 공개 함수의 JSDoc, 신규 테스트 블록의 설계 근거(왜 발견형인가, 왜 래퍼로 가지 않았나), plan 파일의 예측/실측 뮤테이션 표까지 이 저장소의 확립된 관례를 정확히 따르고 있으며, 직접 대조 검증한 모든 서술(정규식 동작, allowlist 사유, 대상 파일 실측)이 코드와 일치했다. 유일한 실질 gap 은 이번 diff 가 담은 두 가지 실질 변경(발견형 가드 확장, `kb-stats.helper.ts` 잠재 타입 오류 정정)이 `CHANGELOG.md` 에 반영되지 않았다는 점이며, 이는 이 저장소 스스로 실측 확인한 "즉시 작성" 관행과 어긋난다. spec frontmatter `pending_plans:` 미등재는 이미 별도 채널이 포착했으므로 참고 수준으로만 남긴다.

## 위험도
LOW
