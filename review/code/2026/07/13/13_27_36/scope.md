# 변경 범위(Scope) 리뷰 — spec §1.3 역방향 연결 · 기존 엣지 재연결/분리

## 발견사항

- **[INFO]** `edge-utils.ts` `firstInputHandleId` 예약 포트(`emit`) 스킵 추가는 §1.3 요구사항 문면(역방향 연결/재연결) 자체가 아니라 §1.2 자동 연결의 latent 결함 보강
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`(`RESERVED_INPUT_HANDLE_IDS`), `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`
  - 상세: CHANGELOG·spec 본문 모두 이를 "부수 강화(latent 위험 해소)"로 명시하고, `plan/in-progress/spec-sync-edge-gaps.md`의 §1.2 이월 항목 (e)에서 "§1.3 착수 시 강화"로 이미 사전 추적·승인된 스코프임을 확인했다. 현재 노드 정의상 미발생(현행 컨테이너 첫 입력은 항상 `in`)이라 실질 동작 변화도 없다.
  - 제안: 조치 불요 — 사전 합의된 스코프. 정보 목적으로만 기록.

- **[INFO]** `editor-store.ts`의 `onConnect` 내부 검증 로직(자기연결/중복/컨테이너 충돌)이 `evaluateConnection` 헬퍼로 추출되며 기존 함수 본문이 리팩터링됨
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` (`evaluateConnection`, `buildEdgeDataForConnection`, `onConnect` 재작성)
  - 상세: 이는 `onReconnect`가 `onConnect`와 "동일한 유효성"을 적용해야 한다는 §1.3 요구(diff 내 주석·spec §1.3 서술에 명시)를 만족하기 위한 필연적 공유이며, 커밋된 `review/code/2026/07/13/12_40_48/RESOLUTION.md` WARNING #2가 명시적으로 요청한 조치다(같은 작업 내 리뷰 라운드에서 이미 합의). 순수 리팩터 범위를 벗어나 새 기능(over-engineering)을 얹지 않았고, `onConnect`의 관찰 가능한 동작(토스트 메시지·거부 조건)은 diff 전후 동일하다.
  - 제안: 조치 불요 — 작업 목적(§1.3 재연결에 동일 유효성 적용)에 직접 종속된 리팩토링.

- **[INFO]** `containers-and-tools.mdx`/`.en.mdx` 문구가 "드래그가 아니라 연결선을 다시 연결"에서 "노드를 컨테이너 안으로 드래그해 넣는 게 아니라 `body`/`emit` 연결선을 다시 연결"로 더 구체화됨
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/containers-and-tools.mdx`, `containers-and-tools.en.mdx`
  - 상세: 이번 PR로 엣지 끝점 드래그 재연결(reconnect)이 실제 구현되어 "연결선을 다시 연결"이라는 기존 문구의 모호성(엣지 전체를 지우고 새로 긋는지, 끝점만 옮기는지)이 새 UX와 정합해야 할 필요가 생겼다 — §1.3 구현에 직접 종속된 문서 정합화이지 무관한 수정이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/07/13/{12_40_48,13_06_50}/*` (SUMMARY/RESOLUTION/개별 리뷰어 산출물/`_retry_state.json`/`meta.json`) 다수가 이번 커밋 diff에 포함
  - 위치: 파일 14~32
  - 상세: 리뷰 산출물은 본 저장소 컨벤션상 `.gitignore` 대상이 아니며(사용자 메모리: "plan 체크박스 = 실제 상태" — review/ 커밋 관례) 동일 작업의 리뷰 이력을 보존하는 정상 워크플로다. 코드 변경 자체와 무관한 diff이지만 "요청 외 추가 수정"이 아니라 harness 표준 산출물이다.
  - 제안: 조치 불요.

- **[INFO]** `NodeSearchPopupState.dragSource` 단방향 유니온 재설계(§1.2 이월 항목 (b))는 "불요 확정"으로 종결되고 실제 코드 변경은 없음
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 서술
  - 상세: 코드 diff에 해당 재설계가 반영되지 않았는데, 이는 스코프 누락이 아니라 "역방향 연결이 우리 팝업 경로가 아닌 React Flow 네이티브 경로라 재설계 자체가 불필요"라는 명시적 판단이며 plan 텍스트와 일치한다.
  - 제안: 조치 불요.

CRITICAL/WARNING 등급 항목 없음. 요청 범위(§1.3: 역방향 연결 확인 + 기존 엣지 재연결/분리 구현)를 벗어난 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트 변경, 의도치 않은 설정 변경은 발견되지 않았다.

## 요약
전체 diff(코드 3개 신규/수정 파일 + 테스트 2건 + 문서 4개 + spec/plan/CHANGELOG + 리뷰 산출물)는 spec §1.3 "역방향 연결 확인 + 기존 엣지 재연결/분리" 구현이라는 단일 목적에 긴밀히 종속돼 있다. `evaluateConnection` 추출과 `firstInputHandleId` 예약 포트 스킵은 표면적으로는 리팩토링·기능 확장처럼 보이나, 둘 다 (1) 같은 작업의 §1.2 이월 항목·리뷰 라운드에서 사전 승인된 스코프이고 (2) §1.3 요구사항(onReconnect의 onConnect 동일 유효성 적용)에 직접 종속돼 있어 범위 이탈로 보지 않는다. containers-and-tools 문서 문구 수정도 새 재연결 UX에 맞춘 정합화로 판단된다. 무관한 파일 수정, 불필요한 포맷팅/주석/임포트 변경, 의도하지 않은 설정 변경은 없다.

## 위험도
NONE
