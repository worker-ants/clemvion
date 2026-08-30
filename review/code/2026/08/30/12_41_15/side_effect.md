# 부작용(Side Effect) 리뷰

## 리뷰 대상
1. `codebase/backend/src/common/__test-utils__/source-scan.ts` — `hasRawUpdateReturning` 신규
2. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 회귀 가드 `describe` 신규 (파일시스템 재귀 스캔 포함)
3. `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — `.query<T>()` 제네릭 타입 인자만 변경
4. `plan/in-progress/update-returning-tuple-shape.md` — 문서(체크리스트/배너) 갱신
5. `review/consistency/2026/08/30/12_17_21/*` — consistency-check 산출 아티팩트 (전부 신규 파일)

뮤테이션 검증은 수행하지 않았다(순수 정적 diff 로 부작용 여부가 충분히 판단 가능한 변경 — 로직 재현 필요 없음). 저장소 트리에는 아무것도 쓰지 않았다.

## 발견사항

- **[INFO]** 테스트 스위트에 실행 시점 재귀 파일시스템 스캔이 새로 추가됨
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:164` (`listSources`), `:184` (`discover`)
  - 상세: `discover()` 가 `codebase/backend/src` 전체를 `readdirSync` 로 재귀 탐색하고 `.ts` 파일마다 `readFileSync` 로 전문을 읽어 정규식을 돌린다. 이 함수는 4개의 `it` 블록 중 3곳(`:191`,`:205`,`:218`)에서 각각 독립 호출돼, 테스트 1회 실행마다 전체 소스 트리를 3회 재스캔한다. 기존 `describe`(라인 53~)는 손으로 고른 3개 파일만 읽던 것과 달리, 이번 변경은 **테스트 실행이 소스 트리 전체 상태에 결합**되는 새로운 형태의 부작용이다 — 다른 PR 이 어딘가에 새 `.ts` 파일을 추가/이동하기만 해도 이 테스트의 결과가 (의도대로) 달라질 수 있다.
  - 이는 diff 자체의 서술("입력 집합을 손으로 고르지 않고 발견한다")과 plan 의 뮤테이션 실측(목록 밖 신설 → RED 확인)이 명시적으로 의도한 설계이므로 결함은 아니다. 다만 순수 부작용 관점에서는 "테스트가 읽기 전용 파일시스템 side effect 를 새로 도입했고, 그 side effect 의 범위(`src/**` 전체)가 향후 계속 넓어질 수 있다"는 점은 기록해 둔다.
  - 제안: 조치 불요(설계 의도). CI 실행 시간에 눈에 띄는 영향이 생기면 `discover()` 결과를 `beforeAll` 로 1회만 계산해 3회 스캔을 1회로 줄이는 최적화를 고려할 수 있다(현재는 순수성 유지를 위해 매 `it` 마다 재호출하는 형태 — 부작용 관점에서는 안전하지만 다소 낭비).

- **[INFO]** `kb-stats.helper.ts` 는 런타임 동작이 바뀌지 않는 순수 타입 변경
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:37` (`.query<[...]>` 제네릭 인자)
  - 상세: `{ entity_count; relation_count }[]` → `[{...}[], number]` 로 제네릭 타입 인자만 바뀌었다. TypeScript 제네릭은 컴파일 타임에 지워지므로 SQL 문자열, 파라미터, 실행 경로, 반환값 처리(반환값 자체를 소비하지 않음)는 diff 전후로 동일하다. 함수 시그니처(`refresh(knowledgeBaseId: string): Promise<void>`)도 변경 없음 — 호출자 영향 없음.
  - 제안: 조치 불요. 부작용 관점에서 안전함을 확인.

- **[INFO]** `hasRawUpdateReturning` 은 순수 함수, 부작용 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:93`
  - 상세: 인자로 받은 `src` 문자열만 정규식으로 스캔해 `boolean` 을 반환한다. 전역 상태·환경 변수·파일시스템·네트워크 접근이 전혀 없다. 정규식 `CALL` 은 함수 스코프 지역 변수로 매 호출마다 재생성되므로 `lastIndex` 잔존에 의한 상태 누수도 없다(전역/모듈 스코프 정규식이 아님을 확인).
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/08/30/12_17_21/*` 8개 신규 파일은 기존 워크플로 산출물
  - 위치: `review/consistency/2026/08/30/12_17_21/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 전부 `new file mode 100644` — 기존 파일 수정·삭제 없음. `CLAUDE.md` 의 "일관성 검토 산출물 → `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 정확히 일치하는 경로다. `_retry_state.json` 은 세션 내 sub-agent 호출 좌표(prompt_file/output_file 경로)만 기록하며 예상 밖의 경로·자격증명은 없음.
  - 제안: 조치 불요 — 예상된 워크플로 산출물.

- **[INFO]** 함수 시그니처·공개 API 변경 없음
  - 위치: 전체 diff
  - 상세: `hasRawUpdateReturning` 은 신규 export 로 기존 소비자에 영향이 없는 additive 변경이다. `countCalls`/`stripComments` 는 변경되지 않았다. `updateReturningRows` 자체의 시그니처도 이 diff 범위에서 건드리지 않는다. 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 관찰되지 않았다.

## 요약

이번 변경은 테스트 인프라(발견형 회귀 가드)와 문서 확장이 중심이며, 프로덕션 런타임에 영향을 주는 코드는 `kb-stats.helper.ts` 의 순수 타입 주석 변경 하나뿐이라 실질적 부작용 위험은 낮다. 유일하게 주목할 새 부작용은 `update-returning-rows.spec.ts` 가 테스트 실행 시점에 `codebase/backend/src` 전체를 재귀적으로 읽어 들이는 파일시스템 스캔을 도입한 것인데, 이는 diff 의 설계 의도(손으로 고른 목록 대신 전수 발견)와 plan 의 뮤테이션 실측으로 명시적으로 정당화된 것이라 결함이 아니라 특성으로 분류했다. 전역 상태·환경 변수·네트워크·이벤트/콜백·공개 시그니처에 대한 의도치 않은 변경은 발견되지 않았고, 리뷰 산출물 8개 신규 파일도 규약이 정한 경로에 정확히 위치한다.

## 위험도
LOW
