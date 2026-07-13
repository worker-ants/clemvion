### 발견사항

- **[INFO]** 이번 라운드 diff 는 실질적으로 "리뷰 산출물 + spec 문서" 메타 변경 — 신규/수정 테스트 코드 자체는 본 payload 에 없음
  - 위치: 리뷰 대상 10개 파일 전부 `review/code/2026/07/13/16_49_37/*.md`·`meta.json`(9개) + `spec/3-workflow-editor/2-edge.md`(1개)
  - 상세: 이 diff 에는 실제 프로덕션/테스트 코드(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `workflow-canvas.tsx`, 각 `__tests__/*`)가 포함되어 있지 않다. 즉 "테스트 존재 여부/커버리지 갭/Mock 적절성/테스트 격리" 같은 관점을 직접 적용할 코드가 이 payload 안에는 없고, 파일 8(`16_49_37/testing.md`, 직전 라운드의 testing 리뷰 결과물)과 spec 문서 갱신만 대상이다. 아래 발견은 이 한계를 감안해, 리포에 직접 접근해 실제 코드 상태를 교차검증한 결과다.

- **[INFO]** (검증됨, 결함 아님) 직전 testing 리뷰(파일 8)가 남긴 INFO 3건이 그 직후 커밋(`9036bb565`, "ai-review 3회차 반영 — 바이트 계산 상한·콜백 안정화·테스트 강화")에서 실제로 해소되어 있음을 워크트리에서 직접 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx:70-84,145-156`, `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts:78-93`
  - 상세: (1) `EdgeDataModal` "정상 데이터" 단언이 `expect(pre?.textContent).not.toContain("[3 items]")` 로 축약 마커 부재를 먼저 명시적으로 단언한 뒤 `toContain("1"/"2"/"3")` 을 검사하도록 강화됨(느슨한 단언 문제 해소). (2) `실행 상태가 completed 가 아니어도(running) 출력이 있으면 미리보기를 렌더한다` 케이스가 추가돼 `seedResult` 의 `status` 파라미터화와 함께 non-completed 경로가 커버됨. (3) `빈 컬렉션({}/[])은 isEmpty=false` 회귀 테스트가 추가됨. 여기에 더해 바이트 근사(`bytesApprox`) 관련 신규 케이스 2건(작은 값=정확 바이트, 100KB 초과=char 수 근사)도 추가되어 있다. `RESOLUTION.md`(`review/code/2026/07/13/16_49_37/RESOLUTION.md`)가 주장하는 "관련 vitest 5파일 96 passed | 1 skipped"(직전 라운드의 92 passed 대비 증가)와 실측 테스트 코드가 정확히 일치한다. 자동 리뷰가 지적한 INFO 를 실제로 해소하고 회귀 테스트로 고정한 좋은 사례.

- **[INFO]** 잔여 — testing.md(파일 8)가 권고한 두 변형(`running`/`failed`) 중 `failed` 상태 케이스는 이번 fix 커밋에도 추가되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx`(`seedResult` 는 `status` 를 파라미터화했지만 실제 호출부에는 `"running"` 케이스만 존재, `"failed"` 호출 없음)
  - 상세: `useEdgeFlowData`(`edge-data-preview.tsx`)는 `status` 를 검사하지 않고 output 존재 여부만으로 렌더 여부를 판단하는 것이 의도된 동작이라, `running` 케이스 하나로도 "status 무관" 동작의 핵심은 이미 회귀 가드된다. 다만 `failed`(에러만 있고 output 없음/부분 output 있음) 조합은 여전히 미검증이라, "실행 실패 노드에 hover 했을 때의 동작"이 코드 리뷰만으로 확인된 상태이며 테스트로 고정되어 있진 않다. 병합 차단 사유는 아님.
  - 제안: `seedResult("a", undefined, "failed")` (또는 부분 output 포함) 케이스 1건 추가해 커버리지를 완전히 닫을 수 있음. 우선순위 낮음.

- **[INFO]** `onOpenModal` 인라인 콜백 → `openDataModal`/`closeDataModal` `useCallback` 추출 리팩터가 순서 보존 여부를 검증하는 테스트 없이 이뤄짐
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:266-274` — `openDataModal = useCallback((id) => { edgeHoverPreview.dismiss(); setDataModalEdgeId(id); }, [edgeHoverPreview])`
  - 상세: 직접 확인한 결과 `dismiss()` → `setDataModalEdgeId(id)` 순서(툴팁을 먼저 지우고 모달을 여는 순서)는 리팩터 전후 동일하게 보존되어 있어 이번 변경 자체는 안전하다. 다만 이 순서를 검증하는 테스트는 여전히 없다 — `workflow-canvas.tsx` 레벨 통합 테스트 하네스 부재는 3라운드 전부터 문서화된 기지 갭(`plan/in-progress/spec-sync-edge-gaps.md` 이월)이며, 이번 인라인→`useCallback` 추출처럼 겉보기엔 사소한 리팩터가 (예: 인자 순서 실수로) 조용히 동작을 바꿔도 잡아낼 회귀 가드가 이 경로에는 없다는 점을 참고로 남긴다. 신규 결함이 아니며 병합 차단 사유 아님.
  - 제안: 우선순위 낮음 — 향후 canvas 통합 테스트 하네스 도입 시 "모달 오픈 시 툴팁이 사라지는지"를 명시적 케이스로 포함.

- **[INFO]** `review/code/2026/07/13/16_49_37/testing.md`(파일 8) 자체의 내용 정확성 — 재검증 결과 신뢰 가능
  - 상세: 파일 8이 주장한 "CHANGELOG 가 주장하는 테스트 수(31개)가 diff 실측과 정확히 일치"·"formatBytes 경계 테스트가 `< 1024`/`< 1024*1024` strict-less-than 분기와 정확히 대응"·"stale-index 테스트가 `row?.nodeId === nodeId` 방어 분기를 재현" 등의 서술을 실제 테스트 코드(`formatBytes` 경계 4케이스, `execution-store.test.ts` 등)와 대조한 결과 과장이나 오기재 없이 정확하다. 이 리뷰 산출물 자체의 신뢰도는 문제 없음.

### 요약

이번 diff(17:13:05 라운드)는 실제 신규 코드가 아니라 직전(16:49:37) 라운드의 리뷰 산출물 9개와 spec 문서 갱신만을 대상으로 하므로, 테스트 관점의 직접적 결함 발견 대상이 제한적이다. 리포를 직접 열람해 교차검증한 결과, 파일 8(직전 testing.md)이 남긴 INFO 3건(모달 단언 느슨함·non-completed status 미검증·빈 컬렉션 미검증)은 그 직후 커밋(`9036bb565`)에서 이미 실제 테스트로 해소되었고(vitest 92→96 passed), `RESOLUTION.md` 의 주장과 실측 코드가 정확히 일치한다 — 자동 리뷰 피드백이 실제 회귀 가드로 이어지는 바람직한 사이클이 확인된다. 잔여 항목은 모두 병합을 막지 않는 INFO 수준이다: `failed` 상태 변형 미검증(권고된 두 케이스 중 하나만 반영), `onOpenModal`→`useCallback` 리팩터의 순서 보존을 검증할 통합 테스트 하네스 부재(기존에 문서화된 이월 갭의 연장, 이번 라운드의 신규 회귀 아님). 파일 8 자체의 서술 정확성도 재검증했으며 문제없다.

### 위험도
NONE
