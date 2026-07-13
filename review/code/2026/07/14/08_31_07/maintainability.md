# 유지보수성(Maintainability) 리뷰

대상: 직전 WARNING 조치분 — (1) `hooks.service.spec.ts` 의 chat-channel nodeId 부재 검증을 `expect.not.objectContaining` 관용구로 통일, (2) `CHANGELOG.md` / `spec/5-system/4-execution-engine.md` §7.5.1 커버리지 표의 chat-channel 면제 범위(scope 단위 vs 진입점 단위) 문구 정확도 수정.

## 발견사항

- **[INFO]** 테스트 assertion 이 기존 관용구와 통일되어 가독성·견고성이 개선됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1185-1190` (diff 기준 원래 816행대)
  - 상세: 종전 `const dtoArg = interactionService.interact.mock.calls[0][1] as {...}; expect(dtoArg.nodeId).toBeUndefined();` 은 (a) `mock.calls[0]` 인덱스 하드코딩으로 호출 순서가 바뀌면 조용히 잘못된 호출을 검증할 위험이 있었고, (b) 인라인 타입 캐스팅이 필요했다. 신규 `expect(interactionService.interact).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ nodeId: expect.anything() }))` 는 같은 파일 바로 위(1175-1184행)의 `toHaveBeenCalledWith(expect.objectContaining(...), expect.objectContaining(...))` 패턴과 동일 관용구라 일관성(점검관점 8)이 높아지고, 캐스팅·인덱스 의존이 사라져 가독성·견고성이 함께 개선됐다.
  - 제안: 없음 — 개선만 있는 변경.

- **[INFO]** spec 표 셀 문장이 길어져 정보 밀도가 다소 높아짐 (문서 전용, 기능 영향 없음)
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1 nodeId 검사 커버리지 표, "chat-channel `scope: 'in_process_trusted'`" 행
  - 상세: 종전 한 문장("nodeId 를 알지 못한 채 고정 매핑 — nodeId 를 싣지 않는다")에서, 면제 단위가 "진입점" 이 아니라 "scope" 임을 명시하고 nodeId 를 아는 form 제출 경로(`handleFormStep`, `pendingFormModal.nodeId`)도 동일 policy 로 면제됨을 부연하는 2문장 구조로 늘었다. 정확도는 개선됐으나 표 셀 안에 인과 설명이 누적되는 패턴(WS continuation 행도 유사하게 괄호 부연을 포함)이 기존 표 관례와 일치하므로 새로 도입된 문제는 아니다.
  - 제안: 현재로선 조치 불필요. 향후 이 표의 셀 설명이 한 번 더 늘어난다면(예: 행마다 3문장 이상) 각주(footnote) 분리를 고려할 수 있다는 정도의 참고 사항.

- **[INFO]** CHANGELOG 엔트리 문장이 이미 매우 긴 단일 문단에 절 하나가 추가되어 더 길어짐
  - 위치: `CHANGELOG.md` "외부 EIA `/interact` 명령의 `nodeId`..." 항목, **커버리지** 문장
  - 상세: 기존에도 한 항목이 여러 문장·용어를 압축한 긴 단락이었고, 이번 diff 는 "scope 단위로 면제"·"form 제출은 nodeId 를 알더라도 동일 policy" 구절을 추가해 문장이 더 늘었다. 다만 이 프로젝트의 CHANGELOG 컨벤션 자체가 조사한 다른 다수 항목과 마찬가지로 배경·근거를 한 항목에 밀도 있게 담는 스타일이라, 이번 diff 가 새로 만든 패턴은 아니다.
  - 제안: 조치 불필요 (기존 프로젝트 컨벤션과 일치).

## 요약

이번 델타는 순수 문서 정확도 교정(CHANGELOG, spec 표 문구)과 테스트 assertion 관용구 통일(하드코딩 인덱스+캐스팅 → 기존 파일에 이미 쓰이던 `toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining(...))` 패턴)로 구성되어 있으며, 새로운 로직·함수·조건 분기가 도입되지 않았다. 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도 관점에서 지적할 사항이 없고, 테스트 변경은 오히려 일관성과 견고성을 개선하는 방향이다. 문서 쪽 문장 길이 증가는 기존 스타일과 정합적이라 문제로 보지 않는다.

## 위험도

NONE
