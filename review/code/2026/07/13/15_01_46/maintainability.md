# 유지보수성(Maintainability) Review

대상: §3.2 엣지 실행 상태 스타일 구현 최종본(3회차 fresh review) — CHANGELOG.md, globals.css,
custom-edge.tsx, use-edge-execution-state.ts(신규)+test, workflow-canvas.tsx, edge-utils.ts/test,
mdx 문서(ko/en), plan/spec-sync-edge-gaps.md, spec/3-workflow-editor/2-edge.md,
review/code/2026/07/13/{14_20_12,14_42_20}/*(선행 2회 ai-review 산출물 커밋).

본 diff 는 이미 2회의 ai-review(14:20 MEDIUM→해소, 14:42 LOW→해소, maintainability 는 2회차에
NONE)를 거쳐 수렴한 코드다. 실제 애플리케이션 코드(파일 1~13, 42)를 재검토한 결과 2회차 이후
변경이 없고, 지적됐던 항목은 모두 실제로 반영됨을 재확인했다. 신규로 추가된 것은 선행 리뷰
라운드의 산출물(md/json 리포트, 14~41번 파일)뿐으로, 이는 애플리케이션 코드가 아니라 감사
기록이라 가독성/네이밍/함수길이/중첩/매직넘버/복잡도 같은 코드 메트릭이 적용되지 않는다.

## 발견사항

- **[INFO]** flowing/completed 상호배타 판정이 중첩 삼항으로 구현(이월, 미변경)
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:369-373`
    (`const className = state.flowing ? FLOWING_EDGE_CLASS : state.completed ? COMPLETED_EDGE_CLASS : undefined;`)
  - 상세: 2단 중첩 자체의 가독성 저해는 작지만, `flowing`/`completed` 가 동시에 true 일 수 없다는
    불변식이 `resolveEdgeExecutionState` 구현과 주석에만 의존하고 타입/코드로 강제되지 않는다.
    1·2회차 리뷰에서 동일하게 INFO 로 지적·의도적 이월된 항목이며 이번 라운드에도 그대로 남아있다.
  - 제안: 상태 종류가 늘지 않는다면 현행 유지 무방. 확장 시 조회 테이블(`{flowing, completed}` →
    className 매핑) 또는 짧은 헬퍼로 추출.

- **[INFO]** 마칭 점선 CSS 선언이 두 selector 에 완전히 동일하게 중복(이월, 미변경)
  - 위치: `codebase/frontend/src/app/globals.css` — 기존 hover 하이라이트 규칙(`edge-flow` 재사용
    블록)과 신규 `.edge-flowing .react-flow__edge-path { stroke-dasharray: 8 4; animation: edge-flow
    0.6s linear infinite; }` 가 동일 선언 2벌을 각각 보유.
  - 상세: keyframe 재사용은 의도적이라 좋으나, `stroke-dasharray`/`animation` 값이 바뀌면 두 곳을
    함께 고쳐야 하는 이중 관리 지점이 유지된다.
  - 제안: comma-separated selector 또는 공용 클래스(`.edge-marching-dashes`)로 단일화. 우선순위 낮음.

- **[INFO]** `#22c55e` 가 CSS keyframe 과 TS 상수(`PORT_TYPE_COLORS.data`)에 이중 하드코딩(이월)
  - 위치: `globals.css` `@keyframes edge-complete-flash`, `edge-utils.ts` `PORT_TYPE_COLORS.data`
  - 상세: 두 값이 우연히 같은 그린이지만 의미는 다르다(포트색 vs 실행완료 고정색). 한쪽만 디자인
    변경되면 다른 쪽과 의도치 않게 어긋날 수 있다.
  - 제안: 지금 조치 불요. 향후 리팩터 시 "포트색과 무관한 고정 성공색" 주석 한 줄 권장.

- **[INFO]** className 합성 전략이 자매 훅과 비대칭(overwrite vs Set 병합, 이월)
  - 위치: `use-edge-execution-state.ts`(`{...edge, className, ...}` 직접 대입) vs
    `use-edge-highlighting.ts`(공백 분리 `Set` 기반 add/delete)
  - 상세: 현재는 `workflow-canvas.tsx` 에서 실행상태 훅이 하이라이팅 훅보다 먼저 적용돼 안전하지만,
    "엣지에 상태 className 을 입히는" 두 훅이 서로 다른 병합 패턴을 쓰고 있어 향후 세 번째 훅
    추가나 순서 변경 시 className 유실 위험이 사람의 기억(주석)에만 의존한다. 1·2회차에서도 동일
    지적, 이번 라운드도 동작엔 문제 없어 미조치.
  - 제안: 조치 불요(현 2-훅 규모에서 저위험). 세 번째 훅 추가 시 공용 병합 헬퍼로 강제할 것을 권장.

- **[INFO]** `edge-utils.ts` 응집도 지속 확장(이월)
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 포트 색상·연결 유효성·드래그 조립·stale pruning 에 이어 실행 상태 판정(`resolveEdgeExecutionState`,
    `buildEdgeStyle`, `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`)까지 누적. 기존 관행의 연장이라
    이번 diff 로 인한 신규 문제는 아니다.
  - 제안: 당장 불요. §4/§5 작업 시 파일 분할 검토(예: `edge-execution-state.ts` 분리).

- **[INFO]** 한국어 사용자 문서 어휘가 문서군 내에서 완전히 통일되지 않음(이월, 비차단)
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`
    ("비활성(꺼진) 노드") vs 같은 편집기 문서군의 "비활성화된 노드" 표현
  - 상세: 오탈자는 이미 정정됐고 의미도 명확하나, 형태가 완전히 통일되진 않음. 오류는 아님.
  - 제안: 선택 사항 — 다음 mdx 편집 시 용어 통일 검토.

## 요약

3회차 fresh review 결과, 애플리케이션 코드(파일 1~13, 42)는 2회차 이후 변경이 없으며 1회차에서
지적된 WARNING 7건(자매 훅 대비 재렌더 최적화 비대칭으로 인한 전체 엣지 재생성, 신규 훅 단위
테스트 부재, 주석-구현 불일치 2건, CSS 클래스 접두사 `wc-` 불일치, 국문 어휘 오류)이 모두 실제
코드 상태와 대조해 반영·해소돼 있음을 재확인했다: `useEdgeExecutionState` 는 per-edge bail-out(상태
불변 엣지는 원본 객체 참조 반환)과 `nodes` 참조 대신 정렬된 disabled-id 문자열에 의존하는 안정
키(`disabledKey`)를 도입해 자매 훅(`useEdgeHighlighting`)의 최적화 계약에 합류했고, style 조립은
순수 함수 `buildEdgeStyle` 로 분리돼 단위 테스트(5케이스)가 가능하며, `resolveEdgeExecutionState`
(9케이스)·`useEdgeExecutionState` renderHook(7케이스, 재렌더 참조 안정성 포함)로 신규 로직이
촘촘히 커버된다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고 네이밍(`FLOWING_EDGE_CLASS` 등)도
기존 무접두 컨벤션과 통일됐으며, spec/CHANGELOG/plan/mdx(ko·en) 동반 갱신도 정확히 대응된다.
신규로 추가된 리뷰 산출물 파일(14~41번, 선행 라운드의 md/json 리포트)은 애플리케이션 코드가
아닌 감사 기록이라 코드 유지보수성 메트릭 적용 대상이 아니며 별도 결함도 없다. 남은 항목은 모두
1·2회차부터 의도적으로 이월된 경미한 INFO(중첩 삼항, CSS 중복 선언, 색상 값 이중 하드코딩,
훅 간 합성 전략 비대칭, edge-utils.ts 응집도, 국문 어휘 미세 불일치)이며, 이번 라운드에서 신규로
발견된 CRITICAL/WARNING 급 결함은 없다.

## 위험도

NONE
