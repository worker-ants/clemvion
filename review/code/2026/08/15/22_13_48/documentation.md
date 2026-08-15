# 문서화(Documentation) Review — `22_13_48`

## 검토 방법

이 diff(`origin/main`..HEAD)는 `ws-event-types-extract` 작업의 전체 커밋과 그 사이 6라운드(`19_27_37`
~`21_49_51`)의 review/consistency 산출물을 포함한다. 프롬프트가 크기 제한으로 여러 파일의 diff 를
생략했으므로, 각 라운드가 이미 반영을 확인했다고 주장한 항목은 프롬프트 게이트가 아니라 `Read`/`git
diff`/`git log`로 현재 소스(HEAD)를 직접 열어 재검증했다. 특히 마지막 문서화 라운드(`20_27_08`) 이후
새로 들어온 실질 diff(`git diff a6d764ac6..HEAD -- codebase/ plan/ spec/`)에 집중했다 — `import type`
정리 4곳, `websocket-events.types.spec.ts` 가드 전면 재작성(+JSDoc), plan 문서 갱신뿐이었다.

## 발견사항

- **[INFO]** 직전 3개 리뷰 라운드가 반복한 "이 저장소는 CHANGELOG.md 를 쓰지 않는다"는 전제가 사실과 다르다
  - 위치: `CHANGELOG.md`(루트, 이번 diff 대상 아님 — 프롬프트에 포함되지 않아 게이트 없음). 잘못된 주장이
    적힌 곳은 `review/code/2026/08/15/20_27_08/documentation.md`(프롬프트 라인 1508-1510,
    `이 저장소는 CHANGELOG.md 를 쓰지 않고 spec Rationale + plan 으로...`), 같은 문구가
    `20_50_49/documentation.md`(프롬프트 라인 1824-1826)와 그 다음 라운드에도 반복됨.
  - 상세: 직접 확인한 결과 `CHANGELOG.md` 는 루트에 실존하고(1,137줄) `git log -- CHANGELOG.md` 기준
    바로 이 시리즈의 형제 커밋들(`e3825cc2c`·`8c2bddbcd`·`161bae56e`·`f0b46311d`, 그리고 **이 브랜치의
    직전 선행 커밋인 `8e0728a90`** "종결 emit 에 타입 초크포인트 — 반복 결함의 구조적 원인 (#1174)")이
    각자 `## Unreleased` 항목을 추가하며 활발히 유지되는 파일이다. "쓰지 않는다"는 서술 자체가 실측 없이
    반복 전파된 잘못된 전제다 — 이 저장소에 이미 기록된 "유예 근거는 실측해야 한다" 실패 형태의 재발이다.
    다만 **결론(이번 diff 에 CHANGELOG 항목이 불필요하다)은 실제 관행과 부합할 가능성이 높다** — 같은
    시리즈에서 순수 내부 리팩터·무동작변경 커밋(`463aee139` ResumableNodeHandler 제네릭화,
    `cc92347a5` auth 헬퍼 통합, `a6d916192` docs-guard DFS 통합)도 CHANGELOG.md 를 건드리지 않은 반면,
    wire·behavior 영향이 있는 커밋만 항목을 추가하는 패턴이 뚜렷하다. 이 브랜치는 3라운드 넘게 "값 평가
    순서만 정리, 동작 무변경"으로 반복 검증됐으므로 실제 규칙("무동작변경 순수 리팩터는 CHANGELOG 대상
    아님")에는 부합한다 — **근거 문장만 틀렸고 결론은 우연히 맞다.**
  - 제안: 이번 라운드에서 CHANGELOG 항목을 새로 요구하지 않는다(결론은 유효). 다만 향후 이 review 산출물을
    "레퍼런스"로 인용할 일이 있다면, "CHANGELOG.md 를 쓰지 않는다"가 아니라 "무동작변경 순수 리팩터는
    관행상 CHANGELOG 대상이 아니다"로 근거를 정정해 둘 가치가 있다. 조치 불요(Critical/Warning 아님).

- **[INFO]** 회귀 가드 JSDoc 의 "네 라운드 연속" 서술이 같은 문단에 나열된 라운드 수(3개)와 어긋나 보인다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 파일 헤더 JSDoc
    (`## 간선을 세는 곳은 하나뿐이다` 절, "처음엔 열거가 두 벌이었다..." 문단)
  - 상세: "리뷰가 **네 라운드 연속** 좁은 쪽이 놓친 형태를 하나씩 찾아냈다 — `export … from`(`20_05_17`)
    → 별칭 오판정(`20_27_08`) → `require()`(`20_50_49`)." 라고 쓰여 있는데, 같은 문장에 실제로 라벨이
    붙은 라운드는 3개뿐이다. `git show fa1bca013`(20_50_49 라운드 대응 커밋) 커밋 메시지를 보면 리뷰어가
    "import/export from/별칭 오판정에 이어 4번째로 재발한" 이라고 표현했는데, 이는 **최초의 좁은
    구현 자체(`ts.isImportDeclaration` 만 순회하던 원판)를 재발 인스턴스 #1 로 세는** 관습적 카운트다.
    plan 문서(`ws-event-types-extract.md`)의 "수렴 판정 (6라운드)" 표를 함께 봐야 이 숫자가 이해되며,
    이 파일의 JSDoc 만 단독으로 읽으면 "3개 라운드인데 왜 네 라운드라고 하지?" 라는 혼동이 생길 수 있다.
    사실관계 오류는 아니며(커밋 이력과 일치), 순수 가독성 문제다.
  - 제안: (선택) "처음 좁게 짠 구현 자체를 1번째로 세면" 같은 한 구절만 보태면 이 JSDoc 만으로도 자기완결적이
    된다. 우선순위 낮음 — Critical/Warning 아님, 병합 차단 사유 아님.

## 그 외 확인 — 직전 라운드 지적 사항의 최종 반영 재검증 (전부 해소 확인)

- **`import type` 미표시 부류 고정 (`20_05_17` W1 → `20_27_08` W1 → `20_50_49`/`21_49_51` 부류화)**:
  `execution-event-emitter.service.spec.ts`, `websocket.service.spec.ts`, `execution-engine.service.ts`
  의 `ChatChannelRoutingInfo` 를 포함해 현재 HEAD 전 소스 파일이 `import type`/인라인 `type` 으로 통일돼
  있음을 직접 열람으로 확인. 다섯 번째 가드 테스트(`타입 전용 심볼을 type 표시 없이 import 하는 곳이
  없다`)가 타입 모듈을 파싱해 동적으로 목록을 얻으므로 하드코딩 재발 위험이 없다.
- **가드 헬퍼 개명(`valueEdgeToWebsocketService` → `moduleRefs`/`importLeavesValueEdge` 등)**: 실제
  소스(`codebase/`)에는 옛 이름의 잔존 참조가 없음을 `grep` 으로 확인. plan 문서(`ws-event-types-extract.md`)
  에 남은 옛 이름 언급은 이력 서술이라 정상.
- **`websocket.service.ts` re-export "값 4 + 타입 8" 표기**: 실제 코드(`export { ... }` 4개 값,
  `export type { ... }` 8개 타입)와 plan 정정 서술이 일치함을 대조 확인.
- **`spec/5-system/6-websocket-protocol.md` frontmatter**: `code:` 목록에 `websocket-events.types.ts`
  1줄만 추가, 본문 변경 없음. `spec_impact: none`과 무모순 — 재확인.
- **plan 체크리스트 상태**: `plan/in-progress/ws-event-types-extract.md` 하단 체크리스트가 "fresh
  `/ai-review`"·"`--impl-done`"·"push 게이트"를 여전히 미체크(`[ ]`)로 남겨 두었는데, 이는 이번
  리뷰 라운드가 바로 그 "fresh `/ai-review`" 턴이므로 실제 상태와 정합한다(성급한 완료 체크 없음).

## 요약

이번 라운드에서 실질적으로 새로 들어온 코드 diff(마지막 문서화 라운드 `20_27_08` 이후)는 `import type`
정리 4곳과 회귀 가드 테스트(`websocket-events.types.spec.ts`) 전면 재작성뿐이며, 두 곳 모두 자기 설계
근거·재발 이력·판별 기준을 JSDoc/인라인 주석으로 상세히 남겨 문서화 위생이 매우 높다. 새로 도입된 Critical/
Warning 급 문서화 결함은 없다. 다만 이번 라운드에서 직접 실측해 발견한 것은, 지난 3개 리뷰 라운드가
반복 인용한 "이 저장소는 CHANGELOG.md 를 쓰지 않는다"는 근거가 **사실이 아니다**(CHANGELOG.md 는
1,137줄짜리 활성 파일이고 이 브랜치의 직전 선행 커밋 `8e0728a90` 을 포함해 같은 시리즈 다수 커밋이
항목을 추가한다)는 점이다. 다행히 실제 관행(무동작변경 순수 리팩터는 CHANGELOG 미기재)과 대조하면
이번 브랜치에 항목이 없어도 되는 결론 자체는 유지되므로 병합을 막을 사유는 아니다 — 근거 문장의 정정만
권고한다. 두 번째로, 회귀 가드 JSDoc 의 "네 라운드 연속" 표현이 같은 문단의 라운드 라벨 수(3개)와
바로 대조되지 않아 약간의 가독성 혼동이 있을 수 있으나 사실관계 오류는 아니다. README/CHANGELOG/API
문서 갱신 필요성(신규 공개 API·엔드포인트·환경변수·설정 옵션 없음)·spec frontmatter 정합성은 모두
기존 판정대로 문제없다.

## 위험도

LOW
