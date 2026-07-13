# 변경 범위(Scope) Review

대상: §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리) 구현 + 직전 ai-review(`review/code/2026/07/13/12_40_48`) CRITICAL 1건·WARNING 3건 반영. 21개 파일.

## 발견사항

- **[INFO]** `editor-store.ts` `onConnect` 함수 본체가 이번 diff 에서 리팩터링됨(인라인 자기연결/중복/컨테이너충돌 체크 → `evaluateConnectionRejection` 공용 헬퍼 호출로 치환, `buildEdgeDataForConnection` 헬퍼 추출)
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` (`onConnect` L710 부근)
  - 상세: §1.3 신규 기능(`onReconnect`) 자체와 무관하게 기존 `onConnect` 로직도 함께 손댄 변경이라 표면적으로는 "요청 이상의 수정"처럼 보일 수 있으나, `review/code/2026/07/13/12_40_48/RESOLUTION.md` Warning #2(architecture/maintainability 리뷰어의 "onConnect/onReconnect 검증+데이터파생 로직 중복" 지적)에 대한 명시적 반영 조치다. 즉 동일 PR 사이클 내 직전 ai-review 피드백을 흡수한 결과이지 무관한 리팩토링이 아니다. 동작 변경 없이 순수 추출(behavior-preserving)이며 신규 테스트가 `onConnect` 기존 케이스를 그대로 통과시킴을 diff 상 확인.
  - 제안: 조치 불요(의도된 범위 내 변경).

- **[INFO]** store 메서드명 `deleteEdge` → `removeEdge` 리네임이 인터페이스·구현·`workflow-canvas.tsx`·`use-edge-reconnect.ts`·테스트 전 파일에 전파됨
  - 위치: `editor-store.ts`(interface+구현), `workflow-canvas.tsx`(변수 바인딩), `use-edge-reconnect.ts`(파라미터명), `editor-store.test.ts`
  - 상세: 이 역시 §1.3 기능 자체 범위 밖처럼 보일 수 있으나 직전 리뷰 Warning #4(기존 `workflowsApi.deleteEdge` 즉시-REST-DELETE 와의 동명 충돌) 반영이다. 리네임이 관련 파일 전체에 누락 없이 일관되게 전파됐음을 diff 로 확인(예: `use-edge-reconnect.test.ts` 의 `removeEdge` 변수명, `workflow-canvas.tsx` 의 `const removeEdge = useEditorStore((s) => s.removeEdge)`).
  - 제안: 조치 불요.

- **[INFO]** `edge-utils.ts` `firstInputHandleId` 예약 포트(`emit`) 스킵 로직 추가는 §1.3 본 요청("역방향 연결 + 재연결/분리")과 직접적 기능 범위가 다르나, CHANGELOG 항목 3·plan 체크박스 (e) 항목·spec §1.3 각주에 "부수 강화"로 명시적으로 스코프에 포함시켜 문서화됐고, §1.2 ai-review(`12_02_54`) 가 이미 지적한 latent 결함의 후속 조치로 사전에 plan 에 예고된 이월 항목이다(신규 확장 아님).
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`, `edge-utils.test.ts`
  - 제안: 조치 불요 — 임의 확장이 아니라 계획된 항목.

- **[INFO]** `review/code/2026/07/13/12_40_48/*`(RESOLUTION.md, SUMMARY.md, meta.json, `_retry_state.json`, architecture.md, maintainability.md, requirement.md, security.md, side_effect.md) 9개 신규 파일이 이번 diff 에 포함됨
  - 상세: 코드 변경과 무관해 보이지만, 프로젝트 컨벤션상 리뷰 산출물(`review/`)은 gitignore 대상이 아니며 RESOLUTION·SUMMARY 도 커밋 대상이다. 직전 리뷰 라운드의 근거 기록을 남기는 정상 워크플로우이지 무관한 파일 혼입이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `connecting-nodes.mdx`(ko) frontmatter `code:` 목록에 `use-edge-reconnect.ts`/`edge-utils.ts` 추가, `connecting-nodes.en.mdx` 는 본문만 갱신되고 frontmatter 변경 없음
  - 상세: en.mdx 파일 자체가 YAML frontmatter 를 갖지 않는 구조(ko 버전만 `code:`/`spec:` 메타데이터를 보유)로 보여, 두 파일 간 실제 불일치는 아니다. 이는 documentation/user_guide_sync 리뷰어 영역이라 scope 판정에는 영향 없음.
  - 제안: 조치 불요(참고용 기록).

이 외 포맷팅-only 변경, 미사용 임포트, 목적 불명 주석, 임의 설정 변경은 diff 전체에서 발견되지 않았다.

## 요약
전체 diff 는 spec §1.3 구현(역방향 연결 확인 + 기존 엣지 재연결/분리)과 그 직전 ai-review(`12_40_48`)가 지적한 CRITICAL 1건(자기연결 드롭 시 오삭제)·WARNING 3건(검증/데이터파생 중복, TS2304 미-import, `deleteEdge` 명명 충돌)에 대한 반영으로 구성되며, 표면적으로 "요청 밖 리팩토링"처럼 보이는 `onConnect` 헬퍼 추출과 `deleteEdge`→`removeEdge` 리네임은 모두 동일 PR 사이클의 직전 리뷰 피드백을 흡수한 명시적 조치로 근거가 문서(RESOLUTION.md)에 남아 있다. `firstInputHandleId` 예약 포트 강화도 plan/CHANGELOG/spec 에 "부수"로 사전 고지된 항목이다. 리뷰 산출물 커밋과 mdx 문서 갱신도 프로젝트 컨벤션과 일치한다. 의도 이상의 확장, 무관한 파일·영역 수정, 포맷팅·주석·임포트 노이즈는 발견되지 않았다.

## 위험도
NONE
