# 유지보수성(Maintainability) 리뷰

## 검토 범위 요약

이번 변경 세트는 두 겹으로 구성된다.

1. `output-shape.test.ts`(신규 mutation 고립 테스트 3건) + `output-shape.ts`(JSDoc "no known producer" 근거 보강) — 직전 리뷰(`review/code/2026/07/17/20_06_14`)에서 이미 검토된 내용과 diff 가 동일하다 (로직 변경 없음, 재확인만 수행).
2. `hydration-coverage.test.ts` 주석 수정 + `review/code/2026/07/17/20_06_14/**`(RESOLUTION.md, SUMMARY.md, meta.json, `_retry_state.json`, 개별 리뷰어 산출물)의 신규 커밋 — 직전 라운드에서 본 리뷰어(maintainability)가 낸 WARNING("`result-timeline.tsx:168`"이라는 하드코딩 라인 번호가 이미 drift 상태)에 대한 실제 조치분이다.

## 발견사항

- **[INFO]** 직전 WARNING 정상 이행 확인 (하드코딩 라인 번호 → 함수명 기반 참조)
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/hydration-coverage.test.ts:54-60`
  - 상세: `result-timeline.tsx:168` 이라는 stale 라인 번호 참조를 제거하고 "See the `buildConvConfigFromStructured` call site in result-timeline.tsx" 로 교체했다. 실제로 `result-timeline.tsx:28`(import)·`:180`(호출부)에 `buildConvConfigFromStructured` 가 존재함을 직접 확인했다 — 참조가 정확하고, 함수명 기반이라 향후 파일 내 라인 이동에도 stale 해지지 않는다. 같은 파일의 다른 항목(`error` 필드, L66-71)도 이미 라인 번호가 아닌 SoT 문서/함수 설명으로 참조하는 스타일이라, 이번 수정이 파일 내 기존 컨벤션과도 정합적이다.
  - 제안: 없음 (조치 완료, 잘 반영됨).

- **[INFO]** 직전 라운드의 INFO 3건(변수명 결합·JSDoc/테스트 이중 SoT·JSDoc 내 언어 혼용)이 이번에도 그대로 잔존
  - 위치: `output-shape.test.ts` 신규 3개 테스트(라인 735-791) 주석의 `hasLegacyMessages`/`outputInteraction`/`hasConvConfig`/`metaInteraction`/`isCanonicalWaiting` 인용, `output-shape.ts:959-994`(`isConversationOutput` JSDoc)의 영어→한국어 전환
  - 상세: `output-shape.ts`/`output-shape.test.ts` 의 diff 는 직전 라운드와 동일하므로 이 파일들 자체는 변경되지 않았고, 따라서 이 관찰들은 새 발견이 아니라 미해결 상태의 재확인이다. `RESOLUTION.md` 가 이를 "차단 사유 아님 — 다음 `isConversationOutput` 분기 편집 시 함께 정리"로 명시적으로 defer 처리했으므로 재차 WARNING 으로 격상하지 않는다.
  - 제안: 없음 (RESOLUTION.md 의 후속 처리 방침 유지 권장).

- **[INFO]** 리뷰 세션 산출물(SUMMARY.md/RESOLUTION.md) 간 서술 중복
  - 위치: `review/code/2026/07/17/20_06_14/SUMMARY.md`(경고 표 항목 1) ↔ `RESOLUTION.md`(조치 항목 표 WARNING 1)
  - 상세: 동일 WARNING 에 대한 설명("`result-timeline.tsx:168` 로 기재됐으나 실제 호출은 180번 라인")이 두 문서에 거의 동일한 문장으로 반복된다. 이는 실행 코드가 아니라 리뷰 파이프라인 산출물(SUMMARY=합의 집계, RESOLUTION=조치 로그)의 구조적 특성상 불가피한 중복이며, 프로젝트 컨벤션(`review/code/**` 산출물 보존)에 부합한다. 유지보수성 관점에서 실질적 위험은 없음.
  - 제안: 없음 (구조적 중복, 조치 불요).

- **[INFO]** `_retry_state.json` 의 `routing_status: "pending"` 이 최종 상태와 불일치하는 스냅샷으로 영구 커밋됨
  - 위치: `review/code/2026/07/17/20_06_14/_retry_state.json`
  - 상세: 파일 내 `routing_status` 는 `"pending"`, `agents_success`/`agents_fatal` 은 빈 배열로 남아 있으나, 같은 디렉터리의 `SUMMARY.md`/`RESOLUTION.md` 는 라우팅·전체 리뷰가 이미 `done` 상태로 완료됐음을 보여준다. 오케스트레이션 스크립트가 세션 시작 시점의 상태만 기록하고 종료 후 갱신하지 않는 설계로 보이며, 향후 이 디렉터리만 훑어보는 사람이 "라우팅이 안 끝난 세션"으로 오인할 여지가 작게 있다. 다만 이는 애플리케이션 코드가 아니라 harness 상태 파일이라 이번 PR 범위 밖의 구조적 특성이다.
  - 제안: 없음(차단 사유 아님). 후속 개선 여지로만 참고 — harness 스크립트가 최종 상태를 반영해 재기록하도록 하면 감사(audit) 시 혼동을 줄일 수 있음.

## 요약

이번 diff 의 실질 코드 변경은 `hydration-coverage.test.ts` 주석 한 곳뿐이며, 직전 라운드 maintainability WARNING("하드코딩 라인 번호 참조 drift")을 함수명 기반 참조로 정확하고 적절하게 해결했다 — 실측(`buildConvConfigFromStructured` 위치)으로 확인했고, 파일 내 기존 주석 스타일과도 일관된다. `output-shape.ts`/`output-shape.test.ts` 는 직전 라운드와 diff 가 동일해 새로운 발견은 없으며, 그때 남겨둔 INFO 3건(변수명 결합·이중 SoT·언어 혼용)은 RESOLUTION.md 가 의도적으로 defer 한 상태를 유지하고 있어 재차 문제 삼지 않는다. 나머지 변경은 프로젝트 컨벤션에 따라 `review/code/**` 에 영속 보관되는 리뷰 세션 산출물(SUMMARY/RESOLUTION/개별 리뷰어 리포트/상태 JSON)이며, 실행 코드가 아니므로 함수 길이·중첩·복잡도 등 대부분의 유지보수성 축과는 무관하다. Critical/Warning 급 신규 결함 없음.

## 위험도
NONE
