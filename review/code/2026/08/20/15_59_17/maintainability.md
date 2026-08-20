STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17, 라운드 5)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지를
다루며, 이미 네 라운드(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34`)의 유지보수성
리뷰를 거쳤다. `15_32_34` 는 애플리케이션 코드에서 신규 지적 사항 없음(ISSUES=0)으로
수렴했었다. 그 직후 커밋 `38b4669bd`(라운드4 RESOLUTION, W1 — 무효 JSON 으로 마스킹 차단이
풀리는 우회를 막는 "세 번째 조건" 추가)가 `codebase/frontend/src/components/executions/
rerun-modal.tsx` 와 그 테스트를 다시 건드렸다. `git diff origin/main...HEAD --stat --
codebase/` 로 실측한 애플리케이션 코드 변경분은 23개 파일(664 insertions/154 deletions)로
`15_32_34` 시점과 동일하고, 이번 라운드는 그 위에 새로 얹힌 `rerun-modal.tsx`/
`rerun-modal.test.tsx` 증분을 `Read` 로 직접 열어 재검토했다. 나머지 파일(백엔드 DTO·주석,
프런트 i18n·문서, `masked-markers.ts` 등)은 이전 라운드들이 이미 상세 검토해 정리됐고 이번
diff 에서 변경되지 않아 재검토하지 않았다.

## 발견사항

- **[WARNING]** 새로 추가된 헬퍼 선언이 기존 JSDoc 블록과 그 설명 대상 선언 사이에 끼어들어, 큰 설명 블록이 자신이 설명하는 대상과 시각적으로 분리됐다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:329-371` (`blockedByMaskedInput` 의 JSDoc 시작부터 실제 선언까지)
  - 상세: 329~357행의 큰 JSDoc(`## 판정이 두 조건의 합인 이유`, `### 세 번째 조건 — object/array 필드의 coerce 실패`, `**토글 ON 이면 막지 않는다**` 등)은 내용상 364행의 `blockedByMaskedInput` 선언을 설명하는 문서다. 그런데 이번 diff 가 그 사이에 `isStructuredField` 헬퍼(359~362행)와 그 자신의 별도 JSDoc(358행 `/** 선언된 타입이 object/array 인가 ... */`)을 끼워 넣으면서, 큰 블록이 "바로 아래 선언(`isStructuredField`)을 설명하는 문서"처럼 보이게 됐고 정작 `blockedByMaskedInput` 자체에는 바로 위에 아무 문서도 없는 모양이 됐다. 이 파일은 정확히 같은 결함 클래스(하나의 선언 위에 JSDoc 블록이 분리/오배치되는 문제)를 이번 PR 안에서 이미 한 번 지적받고 고쳤다(라운드1 `14_44_08` WARNING 8 — "연속된 두 JSDoc 블록을 하나로 병합"). 이번 W1 패치가 그 문제를 다른 형태로 재도입했다.
  - 제안: `isStructuredField` 헬퍼(와 그 한 줄 설명)를 큰 JSDoc 블록 **위**로 옮기거나, 큰 JSDoc 블록의 "세 번째 조건" 섹션 뒤에 `isStructuredField` 도 함께 언급한 뒤 헬퍼를 `blockedByMaskedInput` 바로 앞(문서 없이, 문서는 이미 위에서 다뤘음을 명시)에 두어, 문서와 대상 선언이 인접하도록 재배치한다.

- **[WARNING]** `type === "object" || type === "array"` 조건이 이번 diff 로 같은 파일 안에서 세 번째로 중복됐다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:162` (`displayValue`), `:179` (`coerceInput`, 기존 두 곳은 이 PR 이전부터 존재 — `git log -p` 로 커밋 `b7b6f3f20` 기원 확인), `:360-361` (`isStructuredField`, 이번 diff 신규)
  - 상세: "이 파라미터 타입이 object/array 인가"라는 동일한 판정이 이제 세 곳에서 각자 리터럴 비교로 반복된다. 이번 PR 은 바로 이 changeset 자체에서 "마커 판별기를 흩어진 두 곳(backend 미러)에서 `lib/utils/masked-markers.ts` 한 곳으로 승격"하는 리팩터를 단행했을 만큼 "동일 판정이 여러 곳에 흩어지면 한쪽만 갱신돼 조용히 어긋난다"는 위험에 민감한 PR 인데, 같은 파일 안에서는 정반대로 판정을 세 번째로 흩어 놓았다. 지금 당장은 안전하지만(세 곳 모두 동일 리터럴), 이후 `TriggerParameterType` 에 새 "구조적" 타입(예: `"file"`)이 추가되면 세 곳 중 한 곳만 갱신되고 나머지가 조용히 stale 로 남을 수 있다 — 특히 `isStructuredField` 를 놓치면 이번 PR 이 막으려던 마스킹 우회(W1)가 새 타입에 대해 재현된다.
  - 제안: `function isStructuredType(type: TriggerParameterType): boolean { return type === "object" || type === "array"; }` 같은 단일 헬퍼로 추출해 `displayValue`/`coerceInput`/`isStructuredField` 세 곳이 이를 재사용하게 한다.

## 확인했으나 재지적하지 않은 것

- `isStructuredField` 를 `useCallback` 으로 감싸지 않고 매 렌더 재생성하는 점 — 같은 파일의 `setParam` 도 동일하게 plain 함수라 기존 스타일과 일관되고, `fields` 배열이 소규모라 성능상 실질적 영향이 없다.
- `blockedByMaskedInput` 자체가 `useMemo` 없이 렌더 본문에서 직접 계산되는 점 — 이 PR 이전부터의 구조이고 이번 diff 가 만든 변화가 아니다.
- 신규 테스트 `[캐너리] object 필드를 무효 JSON 으로 만들어도 계속 막는다` (`rerun-modal.test.tsx`) — 스키마 비동기 도착 → 유효 JSON 으로 언블록 → 마커 재삽입 + JSON 파괴로 재검증하는 흐름이 명확하고, 이 파일의 기존 캐너리 테스트 스타일(주석으로 "왜 이 순서인가"를 남김)과 일관된다. 문제 없음.

## 요약

라운드 1~4에서 지적된 유지보수성 결함(연속 JSDoc 블록 분리, JSDoc 주제문이 구 결론을
현재형으로 단언, 식별자 반전 위험, 트레일링 빈 줄)은 이번 diff 시점에도 여전히 해소된
상태다. 다만 라운드4 처분(W1, object/array coerce 실패 우회 차단)이 `rerun-modal.tsx` 에
새로 얹은 세 번째 판정 조건이 이 파일에서 이미 두 번 지적/수정된 바로 그 결함 클래스
("문서와 대상 선언의 분리")를 다른 형태로 재도입했고, 별도로 "구조적 타입 판정"을 세
번째로 중복시켰다. 두 건 모두 기능적 결함은 아니며(테스트로 뮤테이션 고정돼 동작은
정확) 범위도 한 파일 두 함수/한 문서 블록으로 좁아 CRITICAL 로 볼 근거는 없지만, 이
PR 전체가 "동일 불변식이 여러 곳에 흩어지면 한쪽만 갱신돼 조용히 뚫린다"는 실제 CRITICAL
을 반복 경험한 만큼, 지금 단계(3곳, 각 1줄)에서 정리해 두는 편이 이후 재발 비용을 낮춘다.

## 위험도

LOW
