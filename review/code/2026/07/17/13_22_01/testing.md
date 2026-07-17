# 테스트(Testing) 리뷰 — 최종 라운드

**대상**: 커밋 `9fa668538` (테스트 파일 1개, assertion 2줄 추가) · 프로덕션 코드 무변경

## 검증 내용

직전 라운드 CRITICAL("Inv-9 테스트가 불변량을 pin 하지 못함")에 대해 적용된 수정을 다음 방법으로 독립 재검증했다.

1. **적용된 assertion이 제안과 일치하는지**: `git show 9fa668538`로 diff 확인 결과, 직전 라운드에서 제시한 수정안과 정확히 일치.
   ```ts
   expect(screen.getAllByTitle("참조 탭에서 보기").length).toBeGreaterThan(0);
   expect(
     screen.getAllByText(/환불\.md · 약관\.md/).length,
   ).toBeGreaterThanOrEqual(2);
   ```
   위치도 제안대로 탭 클릭(`fireEvent.click(screen.getByText("참조"))`) **이전**.

2. **불변량을 실제로 pin 하는지 — 독립 mutation 재현**: `RagRetrievalRow`(`conversation-inspector.tsx`)의 `ReferencesChip` 호출부 `sources` prop을 `sources.map((s) => ({ ...s, documentName: "decoy.md" }))`로 오염시켜 재실행.
   - **Red 확인**: `AssertionError: expected 1 to be greater than or equal to 2` (정확히 커밋 메시지가 주장한 실패 메시지와 일치).
   - 원본 복구 후 `git diff` clean 확인.
   - 근거: `RagRetrievalRow`는 `onJumpToReferences`가 있을 때 `ReferencesChip`(title="참조 탭에서 보기", 텍스트 `uniqueDocumentNames(sources).slice(0, MAX_VISIBLE_DOC_NAMES=2).join(" · ")`)을 렌더하고, 별도로 assistant 버블 하단(`turnRefIndex` 파생, line ~1299)도 동일 컴포넌트를 렌더한다. 두 렌더 경로는 서로 다른 소스 함수 호출이므로, 개수(①)나 References 탭(③)만 보는 이전 assertion으로는 🔎 행 자신이 무엇을 보여주는지 한 번도 검증되지 않았다 — 새 assertion이 이 갭을 정확히 메운다.

3. **회귀 확인**: `npx vitest run src/components/editor/run-results/` → **264/264 passed**, 16 test files 전부 green. mutation 원복 후 재실행도 green.

4. **다른 테스트 약화 여부**: diff는 기존 assertion ①(청크 수)·③(References 탭)을 그대로 두고 ②(chip 존재 확인)만 "존재 확인 + 문서명 동일성 확인" 2단계로 강화한 것. 다른 `describe`/`it` 블록·fixture·mock에는 손대지 않음 — 약화 없음.

## 발견사항

없음. 이번 델타(assertion 2줄) 범위 내에서 CRITICAL/WARNING 없음.

## 요약

직전 라운드 CRITICAL이 지적한 "테스트가 존재하되 불변량을 pin 하지 못하는" 상태는 이번 델타로 완전히 해소되었다. 제시된 수정안이 코드 변경 없이 그대로 적용되었고, 독립적으로 재현한 mutation(RagRetrievalRow의 문서명 decoy 치환)이 정확히 예측된 방식(`expected 1 to be greater than or equal to 2`)으로 red가 되는 것을 실측 확인했다. 전체 run-results 테스트 스위트(264개)도 green이며 기존 assertion을 약화시키지 않았다. mutation testing으로 실제 검출력을 증명한 드문 사례로, 테스트 품질 관점에서 추가 조치가 필요 없다.

## 위험도

NONE
